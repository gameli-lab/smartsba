'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type MfaAuditResponse = {
  summary: {
    failedVerificationLast24h: number
    failedVerificationSpikes: number
    backupCodeUsageLast7d: number
    activeMfaEnrollments: number
    alertThresholdPerHour: number
    maxFailuresInSingleHour: number
  }
  failedVerificationSpikes: Array<{ hour: string; count: number }>
  backupCodeUsageEvents: Array<{ id: string; actor_user_id: string | null; created_at: string; metadata: Record<string, unknown> | null }>
  recentFailedEvents: Array<{ id: string; actor_user_id: string | null; created_at: string; risk_score: number; metadata: Record<string, unknown> | null }>
  lastVerifications: Array<{
    user_id: string
    role: string
    school_id: string | null
    enabled_at: string | null
    last_used_at: string | null
    full_name: string | null
    email: string | null
  }>
  notifications: Array<{
    level: 'info' | 'warning' | 'critical'
    message: string
  }>
}

function notificationClass(level: 'info' | 'warning' | 'critical'): string {
  switch (level) {
    case 'critical':
      return 'border-red-300 bg-red-50 text-red-800'
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-800'
    default:
      return 'border-blue-300 bg-blue-50 text-blue-800'
  }
}

export default function MfaAuditPage() {
  const [data, setData] = useState<MfaAuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          setError('Not authenticated')
          return
        }

        const response = await fetch('/api/super-admin/mfa-audit', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const payload = (await response.json()) as MfaAuditResponse & { error?: string }
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load MFA audit data')
        }

        setData(payload)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load MFA audit data')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  if (loading) {
    return <div className="p-6">Loading MFA audit...</div>
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  if (!data) {
    return <div className="p-6">No MFA audit data available.</div>
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">MFA Audit</h1>
        <p className="text-sm text-gray-600">Track MFA failures, backup-code usage, and verification recency.</p>
      </div>

      <div className="rounded border bg-gray-50 p-4 text-sm text-gray-700">
        Alert threshold: <strong>{data.summary.alertThresholdPerHour} failed MFA verifications/hour</strong>. 
        Highest hour observed in last 24h: <strong>{data.summary.maxFailuresInSingleHour}</strong>.
      </div>

      {data.notifications.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Notifications</h2>
          {data.notifications.map((notification, index) => (
            <div key={`${notification.level}-${index}`} className={`rounded border p-3 text-sm ${notificationClass(notification.level)}`}>
              <strong className="mr-2 uppercase">{notification.level}</strong>
              {notification.message}
            </div>
          ))}
        </section>
      ) : (
        <section className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          <strong>Healthy:</strong> No active MFA alert notifications.
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded border p-4">
          <p className="text-xs text-gray-500">Failed Verifications (24h)</p>
          <p className="text-2xl font-bold">{data.summary.failedVerificationLast24h}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-xs text-gray-500">Failure Spikes</p>
          <p className="text-2xl font-bold">{data.summary.failedVerificationSpikes}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-xs text-gray-500">Backup Code Usage (7d)</p>
          <p className="text-2xl font-bold">{data.summary.backupCodeUsageLast7d}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-xs text-gray-500">Active MFA Enrollments</p>
          <p className="text-2xl font-bold">{data.summary.activeMfaEnrollments}</p>
        </div>
      </div>

      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Failed Verification Spikes</h2>
        {data.failedVerificationSpikes.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No suspicious spike detected in the last 24 hours.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.failedVerificationSpikes.map((spike) => (
              <li key={spike.hour} className="rounded bg-amber-50 p-2">
                <strong>{new Date(spike.hour).toLocaleString()}</strong>: {spike.count} failed verifications
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Backup Code Usage Events</h2>
        {data.backupCodeUsageEvents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No backup-code usage in the last 7 days.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Time</th>
                  <th className="p-2">User</th>
                  <th className="p-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {data.backupCodeUsageEvents.map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="p-2">{new Date(event.created_at).toLocaleString()}</td>
                    <td className="p-2 font-mono text-xs">{event.actor_user_id || 'N/A'}</td>
                    <td className="p-2 text-xs">{JSON.stringify(event.metadata || {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Last Verification by User</h2>
        {data.lastVerifications.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No active MFA enrollments found.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Last Used</th>
                  <th className="p-2">Enabled At</th>
                </tr>
              </thead>
              <tbody>
                {data.lastVerifications.map((entry) => (
                  <tr key={entry.user_id} className="border-t">
                    <td className="p-2">{entry.full_name || 'Unknown'}</td>
                    <td className="p-2">{entry.email || 'N/A'}</td>
                    <td className="p-2">{entry.role}</td>
                    <td className="p-2">{entry.last_used_at ? new Date(entry.last_used_at).toLocaleString() : 'Never'}</td>
                    <td className="p-2">{entry.enabled_at ? new Date(entry.enabled_at).toLocaleString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
