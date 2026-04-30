'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { getClientCsrfHeaders } from '@/lib/csrf'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type MfaStatusResponse = {
  role?: string
  schoolId?: string | null
  enrolled?: boolean
  enabled?: boolean
  verified?: boolean
  backupCodesRemaining?: number
  requiredForRole?: boolean
  trustedSessionHours?: number
}

function getDefaultRouteByRole(role?: string): string {
  switch (role) {
    case 'super_admin':
      return '/dashboard/super-admin'
    case 'school_admin':
      return '/school-admin'
    case 'teacher':
      return '/teacher'
    case 'student':
      return '/student'
    case 'parent':
      return '/parent'
    default:
      return '/'
  }
}

function sanitizeNextPath(path: string | null): string | null {
  if (!path) return null
  if (!path.startsWith('/')) return null
  if (path.startsWith('//')) return null
  return path
}

export default function MfaChallengePage() {
  const searchParams = useSearchParams()
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next')), [searchParams])

  const [status, setStatus] = useState<MfaStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [otpState, setOtpState] = useState<'send' | 'verify'>('send')
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null)
  const [otpIsSubmitting, setOtpIsSubmitting] = useState(false)
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState<number | null>(null)

  const challengeRequired = Boolean(nextPath) || Boolean(status?.requiredForRole)

  const loadStatus = async () => {
    try {
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      setSessionEmail(session?.user?.email ?? null)

      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/auth/mfa', {
        credentials: 'same-origin',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const payload = (await response.json()) as MfaStatusResponse & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load MFA status')
      }

      setStatus(payload)

      if (payload.verified && nextPath) {
        const redirectTo = nextPath || getDefaultRouteByRole(payload.role)
        window.location.href = redirectTo
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to load MFA status')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  useEffect(() => {
    if (!otpauthUrl) {
      setQrCodeUrl(null)
      return
    }

    QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    })
      .then(setQrCodeUrl)
      .catch(() => setQrCodeUrl(null))
  }, [otpauthUrl])

  const handleEnroll = async () => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({ action: 'enroll' }),
      })

      const payload = (await response.json()) as {
        success?: boolean
        secret?: string
        otpauthUrl?: string
        backupCodes?: string[]
        error?: string
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to start MFA enrollment')
      }

      setSecret(payload.secret || null)
      setOtpauthUrl(payload.otpauthUrl || null)
      setBackupCodes(payload.backupCodes || [])
      setSuccess('MFA enrollment initialized. Scan the secret in your authenticator app, then verify below.')
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : 'Failed to enroll MFA')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({
          action: 'verify',
          code: verificationCode || undefined,
          backupCode: backupCode || undefined,
        }),
      })

      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to verify MFA code')
      }

      setSuccess(
        nextPath
          ? 'MFA verification successful. Finalizing trusted session...'
          : 'MFA verification successful. Finalizing trusted session...'
      )

      await loadStatus()

      if (!nextPath) {
        setSuccess('MFA verification successful. Your account is now trusted for this session window.')
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Failed to verify MFA')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpSend = async (event: FormEvent) => {
    event.preventDefault()
    setOtpIsSubmitting(true)
    setOtpError(null)
    setOtpSuccess(null)

    try {
      if (!sessionEmail) {
        throw new Error('Your session does not include an email address. Please sign in again.')
      }

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          action: 'send',
          identifier: sessionEmail,
          channel: 'email',
        }),
      })

      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to send OTP code')
      }

      setOtpState('verify')
      setOtpSuccess(payload.message || 'OTP code sent to your email address.')
      setOtpAttemptsRemaining(null)
      setOtpCode('')
    } catch (sendError) {
      setOtpError(sendError instanceof Error ? sendError.message : 'Failed to send OTP code')
    } finally {
      setOtpIsSubmitting(false)
    }
  }

  const handleOtpVerify = async (event: FormEvent) => {
    event.preventDefault()
    setOtpIsSubmitting(true)
    setOtpError(null)
    setOtpSuccess(null)

    try {
      if (!sessionEmail) {
        throw new Error('Your session does not include an email address. Please sign in again.')
      }

      if (!otpCode || otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
        throw new Error('Enter the 6-digit code from your email.')
      }

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          action: 'verify',
          identifier: sessionEmail,
          channel: 'email',
          code: otpCode.trim(),
        }),
      })

      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string; attemptsRemaining?: number }

      if (!response.ok || !payload.success) {
        if (typeof payload.attemptsRemaining === 'number') {
          setOtpAttemptsRemaining(payload.attemptsRemaining)
        }
        throw new Error(payload.error || 'Failed to verify OTP code')
      }

      setOtpSuccess(payload.message || 'OTP verification successful. Redirecting...')
      window.location.href = nextPath || getDefaultRouteByRole(status?.role)
    } catch (verifyError) {
      setOtpError(verifyError instanceof Error ? verifyError.message : 'Failed to verify OTP code')
    } finally {
      setOtpIsSubmitting(false)
    }
  }

  const enrollmentPending = status && (!status.enrolled || !status.enabled)

  if (isLoading) {
    return <div className="mx-auto max-w-xl p-6 text-gray-900 dark:text-gray-100">Loading MFA challenge...</div>
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6 text-gray-900 dark:text-gray-100">
      <div>
        <h1 className="text-2xl font-bold">Multi-Factor Authentication</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {challengeRequired
            ? 'This account must pass MFA before accessing privileged pages.'
            : 'MFA is optional for this role but strongly recommended to protect your account.'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Trusted MFA session duration: {status?.trustedSessionHours || 12} hour(s).
        </p>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
      {success ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{success}</div> : null}

      {enrollmentPending ? (
        <div className="space-y-4 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">Set Up MFA</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Enroll your authenticator app to continue.</p>

          {!secret ? (
            <button
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleEnroll}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Initializing...' : 'Start MFA Setup'}
            </button>
          ) : (
            <div className="space-y-4 rounded border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
              {qrCodeUrl ? (
                <div className="flex justify-center rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                  <img src={qrCodeUrl} alt="MFA enrollment QR code" className="h-64 w-64" />
                </div>
              ) : null}

              <p>
                <strong>Secret:</strong> <span className="break-all font-mono text-xs">{secret}</span>
              </p>
              <p>
                <strong>OTP URI:</strong> <span className="break-all font-mono text-xs text-gray-600 dark:text-gray-300">{otpauthUrl}</span>
              </p>
              {backupCodes.length > 0 ? (
                <div>
                  <p className="font-semibold">Backup Codes (store safely):</p>
                  <ul className="mt-1 grid grid-cols-2 gap-2">
                    {backupCodes.map((code) => (
                      <li key={code} className="rounded bg-white p-2 font-mono text-xs text-gray-900 dark:bg-gray-900 dark:text-gray-100">{code}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <Tabs defaultValue="authenticator" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 rounded-full bg-gray-200/80 p-1 dark:bg-gray-800">
          <TabsTrigger value="authenticator" className="rounded-full text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:text-gray-200 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-50">
            Authenticator
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-full text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:text-gray-200 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-50">
            Email Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="authenticator" className="space-y-4 outline-none">
          <form className="space-y-4 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" onSubmit={handleVerify}>
            <h2 className="text-lg font-semibold">Verify Code</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Enter a 6-digit authenticator code or a backup code.</p>

            <input
              type="text"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              placeholder="123456"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />

            <input
              type="text"
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              placeholder="Backup code (optional)"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />

            <button
              type="submit"
              className="w-full rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
              disabled={isSubmitting || (!verificationCode && !backupCode)}
            >
              {isSubmitting ? 'Verifying...' : challengeRequired ? 'Verify and Continue' : 'Verify MFA'}
            </button>
          </form>
        </TabsContent>

        <TabsContent value="email" className="space-y-4 outline-none">
          <div className="space-y-4 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div>
              <h2 className="text-lg font-semibold">Email Code</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Choose this option if you want a one-time code sent to your email address after password sign-in.</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {sessionEmail ? `Code will be sent to ${sessionEmail}.` : 'Loading your email address from the active session.'}
              </p>
            </div>

            {otpError ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{otpError}</div> : null}
            {otpSuccess ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{otpSuccess}</div> : null}

            {otpState === 'send' ? (
              <form className="space-y-4" onSubmit={handleOtpSend}>
                <Button
                  type="submit"
                  className="w-full rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                  disabled={otpIsSubmitting || !sessionEmail}
                >
                  {otpIsSubmitting ? 'Sending Code...' : 'Send Email Code'}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleOtpVerify}>
                <div>
                  <Label htmlFor="otp-code" className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    Verification Code
                  </Label>
                  <Input
                    id="otp-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="mt-2 h-12 rounded border border-gray-300 bg-white px-3 text-center text-lg tracking-[0.4em] text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>

                {otpAttemptsRemaining !== null ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {otpAttemptsRemaining} attempt{otpAttemptsRemaining === 1 ? '' : 's'} remaining.
                  </p>
                ) : null}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded"
                    onClick={() => {
                      setOtpState('send')
                      setOtpCode('')
                      setOtpError(null)
                      setOtpSuccess(null)
                      setOtpAttemptsRemaining(null)
                    }}
                    disabled={otpIsSubmitting}
                  >
                    Resend Code
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                    disabled={otpIsSubmitting || otpCode.length !== 6 || !sessionEmail}
                  >
                    {otpIsSubmitting ? 'Verifying...' : 'Verify Code'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
