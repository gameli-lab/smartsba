'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getClientCsrfHeaders } from '@/lib/csrf'

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

  const challengeRequired = Boolean(nextPath) || Boolean(status?.requiredForRole)

  const loadStatus = async () => {
    try {
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/auth/mfa', {
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

      if (nextPath) {
        setSuccess('MFA verification successful. Redirecting...')
        const redirectTo = nextPath || getDefaultRouteByRole(status?.role)
        window.location.href = redirectTo
      } else {
        setSuccess('MFA verification successful. Your account is now trusted for this session window.')
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Failed to verify MFA')
    } finally {
      setIsSubmitting(false)
    }
  }

  const enrollmentPending = status && (!status.enrolled || !status.enabled)

  if (isLoading) {
    return <div className="mx-auto max-w-xl p-6">Loading MFA challenge...</div>
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Multi-Factor Authentication</h1>
        <p className="text-sm text-gray-600">
          {challengeRequired
            ? 'This account must pass MFA before accessing privileged pages.'
            : 'MFA is optional for this role but strongly recommended to protect your account.'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Trusted MFA session duration: {status?.trustedSessionHours || 12} hour(s).
        </p>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div> : null}

      {enrollmentPending ? (
        <div className="space-y-4 rounded border p-4">
          <h2 className="text-lg font-semibold">Set Up MFA</h2>
          <p className="text-sm text-gray-600">Enroll your authenticator app to continue.</p>

          {!secret ? (
            <button
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              onClick={handleEnroll}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Initializing...' : 'Start MFA Setup'}
            </button>
          ) : (
            <div className="space-y-3 rounded border bg-gray-50 p-3 text-sm">
              <p><strong>Secret:</strong> {secret}</p>
              <p><strong>OTP URI:</strong> <span className="break-all">{otpauthUrl}</span></p>
              {backupCodes.length > 0 ? (
                <div>
                  <p className="font-semibold">Backup Codes (store safely):</p>
                  <ul className="mt-1 grid grid-cols-2 gap-2">
                    {backupCodes.map((code) => (
                      <li key={code} className="rounded bg-white p-2 font-mono text-xs">{code}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <form className="space-y-4 rounded border p-4" onSubmit={handleVerify}>
        <h2 className="text-lg font-semibold">Verify Code</h2>
        <p className="text-sm text-gray-600">Enter a 6-digit authenticator code or a backup code.</p>

        <input
          type="text"
          value={verificationCode}
          onChange={(event) => setVerificationCode(event.target.value)}
          placeholder="123456"
          className="w-full rounded border px-3 py-2"
        />

        <input
          type="text"
          value={backupCode}
          onChange={(event) => setBackupCode(event.target.value)}
          placeholder="Backup code (optional)"
          className="w-full rounded border px-3 py-2"
        />

        <button
          type="submit"
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          disabled={isSubmitting || (!verificationCode && !backupCode)}
        >
          {isSubmitting ? 'Verifying...' : challengeRequired ? 'Verify and Continue' : 'Verify MFA'}
        </button>
      </form>
    </div>
  )
}
