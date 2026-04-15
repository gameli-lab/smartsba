'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getClientCsrfHeaders } from '@/lib/csrf'

type ResetRequest = {
  id: string
  status: string
  expires_at: string
  requested_at: string
  school_id?: string | null
  user_profiles?: Array<{
    full_name?: string | null
    email?: string | null
    role?: string | null
  }>
}

export default function PasswordResetApprovalPage() {
  const params = useParams<{ id: string }>()
  const requestId = params?.id
  const [requestData, setRequestData] = useState<ResetRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadRequest() {
      if (!requestId) return
      setLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          throw new Error('You must be logged in to review this request.')
        }

        const response = await fetch(`/api/password-reset/${requestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load request')
        }

        setRequestData(payload.request as ResetRequest)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load request')
      } finally {
        setLoading(false)
      }
    }

    void loadRequest()
  }, [requestId])

  const decide = async (action: 'approve' | 'reject') => {
    if (!requestId) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('You must be logged in to process this request.')
      }

      const response = await fetch(`/api/password-reset/${requestId}`, {
        method: 'PATCH',
        headers: getClientCsrfHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({ action }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to process request')
      }

      if (action === 'approve') {
        setSuccess(payload.resetLink ? `Approved. Reset link: ${payload.resetLink}` : 'Approved.')
      } else {
        setSuccess('Request rejected.')
      }
      setRequestData((prev) => prev ? { ...prev, status: action === 'approve' ? 'approved' : 'rejected' } : prev)
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Failed to process request')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading password reset request...</div>
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Password Reset Approval</h1>
        <p className="text-sm text-gray-600">Review and approve or reject the pending password reset request.</p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {requestData && (
        <div className="space-y-3 rounded border p-4">
          <div><strong>Request ID:</strong> {requestData.id}</div>
          <div><strong>Status:</strong> {requestData.status}</div>
          <div><strong>Expires:</strong> {new Date(requestData.expires_at).toLocaleString()}</div>
          <div><strong>School ID:</strong> {requestData.school_id || 'N/A'}</div>
        </div>
      )}

      <div className="flex gap-3">
        <button className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50" disabled={saving || !requestData || requestData.status !== 'pending'} onClick={() => decide('approve')}>
          Approve
        </button>
        <button className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50" disabled={saving || !requestData || requestData.status !== 'pending'} onClick={() => decide('reject')}>
          Reject
        </button>
      </div>
    </div>
  )
}