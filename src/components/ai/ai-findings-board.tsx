'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

type FindingStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'

type FindingSeverity = 'low' | 'medium' | 'high'

interface FindingRow {
  id: string
  session_id: string
  severity: FindingSeverity
  area: string
  finding: string
  suggested_fix: string
  status: FindingStatus
  created_at: string
  ai_sessions?: {
    actor_role?: string
    task_type?: string
  }
}

function severityClass(severity: FindingSeverity) {
  if (severity === 'high') return 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/30'
  if (severity === 'medium') return 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30'
  return 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/30'
}

function statusClass(status: FindingStatus) {
  if (status === 'resolved') return 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950/30'
  if (status === 'dismissed') return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800'
  if (status === 'in_progress') return 'text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/30'
  return 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/30'
}

export function AIFindingsBoard({ title = 'AI Security Findings' }: { title?: string }) {
  const [findings, setFindings] = useState<FindingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<'all' | FindingSeverity>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | FindingStatus>('all')

  const fetchFindings = async () => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setFindings([])
        setLoading(false)
        return
      }

      const response = await fetch('/api/ai/findings', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        setError(payload.error || 'Failed to load AI findings')
        setFindings([])
        setLoading(false)
        return
      }

      setFindings((payload.findings || []) as FindingRow[])
    } catch (e) {
      console.error(e)
      setError('Failed to load AI findings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchFindings()
  }, [])

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false
      if (statusFilter !== 'all' && f.status !== statusFilter) return false
      return true
    })
  }, [findings, severityFilter, statusFilter])

  const updateStatus = async (findingId: string, status: FindingStatus) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const response = await fetch('/api/ai/findings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ findingId, status }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        setError(payload.error || 'Failed to update finding status')
        return
      }

      setFindings((prev) => prev.map((f) => (f.id === findingId ? { ...f, status } : f)))
    } catch (e) {
      console.error(e)
      setError('Failed to update finding status')
    }
  }

  return (
    <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-gray-100">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-[180px]">
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as 'all' | FindingSeverity)}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[180px]">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | FindingStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={fetchFindings} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {filteredFindings.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">No findings available for selected filters.</p>
        ) : (
          <ul className="space-y-3">
            {filteredFindings.map((f) => (
              <li key={f.id} className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${severityClass(f.severity)}`}>{f.severity.toUpperCase()}</span>
                  <span className={`text-xs px-2 py-1 rounded ${statusClass(f.status)}`}>{f.status.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(f.created_at).toLocaleString()}</span>
                </div>

                <p className="font-medium text-gray-900 dark:text-gray-100">{f.area}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{f.finding}</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">Fix: {f.suggested_fix}</p>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Set status:</span>
                  <Select value={f.status} onValueChange={(v) => updateStatus(f.id, v as FindingStatus)}>
                    <SelectTrigger className="w-[170px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
