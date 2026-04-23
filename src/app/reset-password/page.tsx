'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClientCsrfHeaders } from '@/lib/csrf'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const requestId = searchParams.get('requestId') || ''
  const token = searchParams.get('token') || ''
  const forceReset = searchParams.get('mode') === 'force'
  const nextPath = searchParams.get('next') || '/login'
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!forceReset && (!requestId || !token)) {
      setError('Invalid or missing reset link.')
    }
  }, [forceReset, requestId, token])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const requestBody = forceReset
        ? { forceReset: true, newPassword, confirmPassword }
        : { requestId, token, newPassword, confirmPassword }

      const response = await fetch('/api/password-reset/complete', {
        method: 'POST',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(requestBody),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update password')
      }

      setSuccess(payload.message || 'Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')

      if (forceReset) {
        // Give the user a moment to read the success state before leaving.
        setTimeout(() => {
          router.replace(nextPath)
        }, 1200)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Set New Password</h1>
        <p className="text-sm text-gray-600">
          {forceReset
            ? 'Your account requires a password change before continuing.'
            : 'Enter a new password to complete your reset request.'}
        </p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <form className="space-y-4" onSubmit={submit}>
        <input
          type="password"
          placeholder="New password"
          className="w-full rounded border px-3 py-2"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm password"
          className="w-full rounded border px-3 py-2"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={loading || (!forceReset && (!requestId || !token))}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}