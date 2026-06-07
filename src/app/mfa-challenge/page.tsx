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
  phone?: string | null  // ← added for SMS tab
}

function getDefaultRouteByRole(role?: string): string {
  switch (role) {
    case 'super_admin':   return '/dashboard/super-admin'
    case 'school_admin':  return '/school-admin'
    case 'teacher':       return '/teacher'
    case 'student':       return '/student'
    case 'parent':        return '/parent'
    default:              return '/'
  }
}

function sanitizeNextPath(path: string | null): string | null {
  if (!path) return null
  if (!path.startsWith('/')) return null
  if (path.startsWith('//')) return null
  return path
}

// Masks a phone number: +233241234567 → +233 **** 4567
function maskPhone(phone: string): string {
  if (phone.length < 6) return phone
  return phone.slice(0, 4) + ' **** ' + phone.slice(-4)
}

export default function MfaChallengePage() {
  const searchParams = useSearchParams()
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next')), [searchParams])

  const [status, setStatus]           = useState<MfaStatusResponse | null>(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCode, setBackupCode]   = useState('')
  const [secret, setSecret]           = useState<string | null>(null)
  const [otpauthUrl, setOtpauthUrl]   = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [qrCodeUrl, setQrCodeUrl]     = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionPhone, setSessionPhone] = useState<string | null>(null)  // ← new

  // --- Email OTP state ---
  const [otpState, setOtpState]               = useState<'send' | 'verify'>('send')
  const [otpCode, setOtpCode]                 = useState('')
  const [otpError, setOtpError]               = useState<string | null>(null)
  const [otpSuccess, setOtpSuccess]           = useState<string | null>(null)
  const [otpIsSubmitting, setOtpIsSubmitting] = useState(false)
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState<number | null>(null)

  // --- SMS OTP state ---
  const [smsState, setSmsState]               = useState<'send' | 'verify'>('send')
  const [smsCode, setSmsCode]                 = useState('')
  const [smsError, setSmsError]               = useState<string | null>(null)
  const [smsSuccess, setSmsSuccess]           = useState<string | null>(null)
  const [smsIsSubmitting, setSmsIsSubmitting] = useState(false)
  const [smsAttemptsRemaining, setSmsAttemptsRemaining] = useState<number | null>(null)

  const challengeRequired = Boolean(nextPath) || Boolean(status?.requiredForRole)

  // ─── Shared: poll MFA status after any OTP verify ───────────────────────────
  async function pollForVerified(token: string) {
    const maxAttempts = 8
    const delayMs = 500
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const resp = await fetch('/api/auth/mfa', {
          credentials: 'same-origin',
          headers: {
            // FIX: was missing Authorization — caused the poll to always 401
            Authorization: `Bearer ${token}`,
          },
        })
        if (resp.ok) {
          const state = (await resp.json()) as MfaStatusResponse & { error?: string }
          setStatus(state)
          if (state.verified) {
            const redirectTo = nextPath || getDefaultRouteByRole(state.role)
            window.location.href = redirectTo
            return true
          }
        }
      } catch {
        // ignore transient errors, keep polling
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
    return false
  }

  // ─── Load MFA status ────────────────────────────────────────────────────────
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
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as MfaStatusResponse & { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load MFA status')
      }

      setStatus(payload)

      // Populate phone from profile if returned
      if (payload.phone) {
        setSessionPhone(payload.phone)
      }

      if (payload.verified && nextPath) {
        window.location.href = nextPath || getDefaultRouteByRole(payload.role)
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to load MFA status')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadStatus() }, [])

  useEffect(() => {
    if (!otpauthUrl) { setQrCodeUrl(null); return }
    QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 256 })
      .then(setQrCodeUrl)
      .catch(() => setQrCodeUrl(null))
  }, [otpauthUrl])

  // ─── TOTP enroll ────────────────────────────────────────────────────────────
  const handleEnroll = async () => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { window.location.href = '/login'; return }

      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
        body: JSON.stringify({ action: 'enroll' }),
      })

      const payload = (await response.json()) as {
        success?: boolean; secret?: string; otpauthUrl?: string; backupCodes?: string[]; error?: string
      }

      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to start MFA enrollment')

      setSecret(payload.secret || null)
      setOtpauthUrl(payload.otpauthUrl || null)
      setBackupCodes(payload.backupCodes || [])
      setSuccess('MFA enrollment initialized. Scan the QR code in your authenticator app, then verify below.')
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : 'Failed to enroll MFA')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── TOTP verify ────────────────────────────────────────────────────────────
  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { window.location.href = '/login'; return }

      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
        body: JSON.stringify({ action: 'verify', code: verificationCode || undefined, backupCode: backupCode || undefined }),
      })

      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to verify MFA code')

      setSuccess('MFA verification successful. Finalizing trusted session...')
      await loadStatus()
      if (!nextPath) setSuccess('MFA verification successful. Your account is now trusted for this session.')
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Failed to verify MFA')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Email OTP send ──────────────────────────────────────────────────────────
  const handleOtpSend = async (event: FormEvent) => {
    event.preventDefault()
    setOtpIsSubmitting(true)
    setOtpError(null)
    setOtpSuccess(null)
    try {
      if (!sessionEmail) throw new Error('Session email not found. Please sign in again.')

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'send', identifier: sessionEmail, channel: 'email' }),
      })

      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to send email OTP')

      setOtpState('verify')
      setOtpSuccess(payload.message || 'Code sent to your email address.')
      setOtpAttemptsRemaining(null)
      setOtpCode('')
    } catch (sendError) {
      setOtpError(sendError instanceof Error ? sendError.message : 'Failed to send email OTP')
    } finally {
      setOtpIsSubmitting(false)
    }
  }

  // ─── Email OTP verify ────────────────────────────────────────────────────────
  const handleOtpVerify = async (event: FormEvent) => {
    event.preventDefault()
    setOtpIsSubmitting(true)
    setOtpError(null)
    setOtpSuccess(null)
    try {
      if (!sessionEmail) throw new Error('Session email not found. Please sign in again.')
      if (!otpCode || otpCode.length !== 6 || !/^\d+$/.test(otpCode)) throw new Error('Enter the 6-digit code from your email.')

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'verify', identifier: sessionEmail, channel: 'email', code: otpCode.trim() }),
      })

      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string; attemptsRemaining?: number }

      if (!response.ok || !payload.success) {
        if (typeof payload.attemptsRemaining === 'number') setOtpAttemptsRemaining(payload.attemptsRemaining)
        throw new Error(payload.error || 'Invalid OTP code')
      }

      setOtpSuccess('OTP verified. Finalizing trusted session...')

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (token) {
        const verified = await pollForVerified(token)
        if (!verified) setOtpSuccess('OTP verified. Please refresh if not redirected automatically.')
      }
    } catch (verifyError) {
      setOtpError(verifyError instanceof Error ? verifyError.message : 'Failed to verify OTP')
    } finally {
      setOtpIsSubmitting(false)
    }
  }

  // ─── SMS OTP send ────────────────────────────────────────────────────────────
  const handleSmsSend = async (event: FormEvent) => {
    event.preventDefault()
    setSmsIsSubmitting(true)
    setSmsError(null)
    setSmsSuccess(null)
    try {
      if (!sessionPhone) throw new Error('No phone number on your account. Contact your administrator.')

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'send', identifier: sessionPhone, channel: 'sms' }),
      })

      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to send SMS code')

      setSmsState('verify')
      setSmsSuccess(payload.message || `Code sent to ${maskPhone(sessionPhone)}.`)
      setSmsAttemptsRemaining(null)
      setSmsCode('')
    } catch (sendError) {
      setSmsError(sendError instanceof Error ? sendError.message : 'Failed to send SMS code')
    } finally {
      setSmsIsSubmitting(false)
    }
  }

  // ─── SMS OTP verify ──────────────────────────────────────────────────────────
  const handleSmsVerify = async (event: FormEvent) => {
    event.preventDefault()
    setSmsIsSubmitting(true)
    setSmsError(null)
    setSmsSuccess(null)
    try {
      if (!sessionPhone) throw new Error('No phone number on your account. Contact your administrator.')
      if (!smsCode || smsCode.length !== 6 || !/^\d+$/.test(smsCode)) throw new Error('Enter the 6-digit code from the SMS.')

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'verify', identifier: sessionPhone, channel: 'sms', code: smsCode.trim() }),
      })

      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string; attemptsRemaining?: number }

      if (!response.ok || !payload.success) {
        if (typeof payload.attemptsRemaining === 'number') setSmsAttemptsRemaining(payload.attemptsRemaining)
        throw new Error(payload.error || 'Invalid SMS code')
      }

      setSmsSuccess('SMS code verified. Finalizing trusted session...')

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (token) {
        const verified = await pollForVerified(token)
        if (!verified) setSmsSuccess('SMS code verified. Please refresh if not redirected automatically.')
      }
    } catch (verifyError) {
      setSmsError(verifyError instanceof Error ? verifyError.message : 'Failed to verify SMS code')
    } finally {
      setSmsIsSubmitting(false)
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
            : 'MFA is optional for this role but strongly recommended.'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Trusted MFA session duration: {status?.trustedSessionHours || 12} hour(s).
        </p>
      </div>

      {error   && <div className="rounded border border-red-200   bg-red-50   p-3 text-sm text-red-700   dark:border-red-900   dark:bg-red-950/40   dark:text-red-300">{error}</div>}
      {success && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{success}</div>}

      {/* ── TOTP Enrollment ── */}
      {enrollmentPending && (
        <div className="space-y-4 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">Set Up Authenticator</h2>
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
              {qrCodeUrl && (
                <div className="flex justify-center rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                  <img src={qrCodeUrl} alt="MFA enrollment QR code" className="h-64 w-64" />
                </div>
              )}
              <p><strong>Secret:</strong> <span className="break-all font-mono text-xs">{secret}</span></p>
              {backupCodes.length > 0 && (
                <div>
                  <p className="font-semibold">Backup Codes (store safely):</p>
                  <ul className="mt-1 grid grid-cols-2 gap-2">
                    {backupCodes.map((code) => (
                      <li key={code} className="rounded bg-white p-2 font-mono text-xs text-gray-900 dark:bg-gray-900 dark:text-gray-100">{code}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MFA Tabs ── */}
      <Tabs defaultValue="authenticator" className="space-y-4">
        <TabsList className={`grid w-full ${sessionPhone ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="authenticator">Authenticator</TabsTrigger>
          <TabsTrigger value="email">Email Code</TabsTrigger>
          {sessionPhone && <TabsTrigger value="sms">SMS Code</TabsTrigger>}
        </TabsList>

        {/* ── TOTP Tab ── */}
        <TabsContent value="authenticator" className="space-y-4 outline-none">
          <form className="space-y-4 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" onSubmit={handleVerify}>
            <h2 className="text-lg font-semibold">Verify Code</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Enter a 6-digit authenticator code or a backup code.</p>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="123456"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <input
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
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

        {/* ── Email OTP Tab ── */}
        <TabsContent value="email" className="space-y-4 outline-none">
          <div className="space-y-4 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div>
              <h2 className="text-lg font-semibold">Email Code</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">A one-time code will be sent to your email address.</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {sessionEmail ? `Code will be sent to ${sessionEmail}.` : 'Loading session...'}
              </p>
            </div>

            {otpError   && <div className="rounded border border-red-200   bg-red-50   p-3 text-sm text-red-700   dark:border-red-900   dark:bg-red-950/40   dark:text-red-300">{otpError}</div>}
            {otpSuccess && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{otpSuccess}</div>}

            {otpState === 'send' ? (
              <form onSubmit={handleOtpSend}>
                <Button type="submit" className="w-full" disabled={otpIsSubmitting || !sessionEmail}>
                  {otpIsSubmitting ? 'Sending...' : 'Send Email Code'}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleOtpVerify}>
                <div>
                  <Label htmlFor="otp-code" className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    Verification Code
                  </Label>
                  <Input
                    id="otp-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="mt-2 h-12 text-center text-lg tracking-[0.4em]"
                  />
                </div>
                {otpAttemptsRemaining !== null && (
                  <p className="text-xs text-gray-500">{otpAttemptsRemaining} attempt{otpAttemptsRemaining === 1 ? '' : 's'} remaining.</p>
                )}
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1"
                    onClick={() => { setOtpState('send'); setOtpCode(''); setOtpError(null); setOtpSuccess(null); setOtpAttemptsRemaining(null) }}
                    disabled={otpIsSubmitting}>
                    Resend Code
                  </Button>
                  <Button type="submit" className="flex-1" disabled={otpIsSubmitting || otpCode.length !== 6 || !sessionEmail}>
                    {otpIsSubmitting ? 'Verifying...' : 'Verify Code'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </TabsContent>

        {/* ── SMS OTP Tab ── */}
        {sessionPhone && (
          <TabsContent value="sms" className="space-y-4 outline-none">
            <div className="space-y-4 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-semibold">SMS Code</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">A one-time code will be sent by SMS.</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Code will be sent to {maskPhone(sessionPhone)}.
                </p>
              </div>

              {smsError   && <div className="rounded border border-red-200   bg-red-50   p-3 text-sm text-red-700   dark:border-red-900   dark:bg-red-950/40   dark:text-red-300">{smsError}</div>}
              {smsSuccess && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{smsSuccess}</div>}

              {smsState === 'send' ? (
                <form onSubmit={handleSmsSend}>
                  <Button type="submit" className="w-full" disabled={smsIsSubmitting || !sessionPhone}>
                    {smsIsSubmitting ? 'Sending...' : 'Send SMS Code'}
                  </Button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={handleSmsVerify}>
                  <div>
                    <Label htmlFor="sms-code" className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Verification Code
                    </Label>
                    <Input
                      id="sms-code"
                      inputMode="numeric"
                      maxLength={6}
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="mt-2 h-12 text-center text-lg tracking-[0.4em]"
                    />
                  </div>
                  {smsAttemptsRemaining !== null && (
                    <p className="text-xs text-gray-500">{smsAttemptsRemaining} attempt{smsAttemptsRemaining === 1 ? '' : 's'} remaining.</p>
                  )}
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1"
                      onClick={() => { setSmsState('send'); setSmsCode(''); setSmsError(null); setSmsSuccess(null); setSmsAttemptsRemaining(null) }}
                      disabled={smsIsSubmitting}>
                      Resend Code
                    </Button>
                    <Button type="submit" className="flex-1" disabled={smsIsSubmitting || smsCode.length !== 6 || !sessionPhone}>
                      {smsIsSubmitting ? 'Verifying...' : 'Verify Code'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
