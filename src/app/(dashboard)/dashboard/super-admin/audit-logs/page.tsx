"use client"

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { FileText, ChevronLeft, ChevronRight, Filter, Search, Activity, AlertCircle } from 'lucide-react'
import { ExportButton } from '@/components/super-admin/ExportButton'
import { exportAuditLogsToCSV } from '../exports/actions'
import { exportAuditLogsToPDF } from '@/lib/pdf-export'

interface AuditLog {
  id: string
  actor_user_id: string
  actor_name: string
  actor_email: string | null
  actor_role: string
  action_type: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'school_created', label: 'School Created' },
  { value: 'school_updated', label: 'School Updated' },
  { value: 'school_deleted', label: 'School Deleted' },
  { value: 'school_activated', label: 'School Activated' },
  { value: 'school_deactivated', label: 'School Deactivated' },
  { value: 'user_role_changed', label: 'User Role Changed' },
  { value: 'bulk_import', label: 'Bulk Import' },
  { value: 'admin_override', label: 'Admin Override' },
]

const ENTITY_TYPES = [
  { value: 'all', label: 'All Entities' },
  { value: 'school', label: 'School' },
  { value: 'user', label: 'User' },
  { value: 'class', label: 'Class' },
  { value: 'session', label: 'Academic Session' },
  { value: 'subject', label: 'Subject' },
]

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [totalLogs, setTotalLogs] = useState(0)

  // Filters
  const [actionType, setActionType] = useState('all')
  const [entityType, setEntityType] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        const profileResponse = (await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()) as { data: { role: string } | null }
        if (profileResponse.data) {
          setUserRole(profileResponse.data.role)
        }
      }
    }
    init()
  }, [])

  const fetchLogs = useCallback(async (cursor?: string | null) => {
    setLoading(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Not authenticated')
      }

      const url = new URL('/api/audit-logs', window.location.origin)
      url.searchParams.set('per_page', '20')

      if (actionType !== 'all') url.searchParams.set('action_type', actionType)
      if (entityType !== 'all') url.searchParams.set('entity_type', entityType)
      if (dateFrom) url.searchParams.set('date_from', new Date(dateFrom).toISOString())
      if (dateTo) url.searchParams.set('date_to', new Date(dateTo).toISOString())
      if (searchQuery) url.searchParams.set('search', searchQuery)
      if (cursor) url.searchParams.set('cursor', cursor)

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch audit logs')
      }

      const json = await res.json()
      setLogs(json.logs || [])
      setNextCursor(json.next_cursor || null)
      setTotalLogs(json.total || (json.logs || []).length)
    } catch (err) {
      console.error('Error fetching audit logs:', err)
      setError((err as Error)?.message ?? 'Error loading audit logs')
    } finally {
      setLoading(false)
    }
  }, [actionType, dateFrom, dateTo, entityType, searchQuery])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleNextPage = () => {
    if (!nextCursor) return
    setCursorStack([...cursorStack, nextCursor])
    fetchLogs(nextCursor)
  }

  const handlePrevPage = () => {
    if (cursorStack.length === 0) return
    const newStack = [...cursorStack]
    newStack.pop()
    setCursorStack(newStack)
    const prevCursor = newStack.length > 0 ? newStack[newStack.length - 1] : null
    fetchLogs(prevCursor)
  }

  const handleReset = () => {
    setActionType('all')
    setEntityType('all')
    setDateFrom('')
    setDateTo('')
    setSearchQuery('')
    setCursorStack([])
    fetchLogs()
  }

  const handleExportCSV = async () => {
    if (!userId || !userRole) {
      alert('Not authenticated')
      return
    }

    const result = await exportAuditLogsToCSV(userId, userRole, {
      actionType: actionType !== 'all' ? actionType : undefined,
      entityType: entityType !== 'all' ? entityType : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })

    if (result.success && result.data && result.filename) {
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', result.filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      alert(result.error || 'Export failed')
    }
  }

  const handleExportPDF = async () => {
    const logsWithActorName = logs.map((log) => ({
      ...log,
      actor_name: log.actor_name || 'Unknown',
    }))

    const result = await exportAuditLogsToPDF(logsWithActorName, {
      actionType: actionType !== 'all' ? actionType : undefined,
      entityType: entityType !== 'all' ? entityType : undefined,
    })

    if (!result.success) {
      alert(result.error || 'Export failed')
    }
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes('created')) return 'bg-green-100 text-green-800 border-green-200'
    if (action.includes('updated')) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (action.includes('deleted')) return 'bg-red-100 text-red-800 border-red-200'
    if (action.includes('activated')) return 'bg-green-100 text-green-800 border-green-200'
    if (action.includes('deactivated')) return 'bg-gray-100 text-gray-800 border-gray-200'
    return 'bg-purple-100 text-purple-800 border-purple-200'
  }

  const formatActionType = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Activity Logs</h1>
          <p className="mt-2 text-sm text-gray-600">Complete audit trail of critical system actions</p>
        </div>
        <ExportButton
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          disabled={loading}
        />
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLogs}</div>
            <p className="text-xs text-gray-500 mt-1">Across all filters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              Critical Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter((l) => l.action_type.includes('deleted') || l.action_type.includes('override')).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Deletions & overrides</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-600" />
              Page Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-gray-500 mt-1">Current page</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-purple-600" />
            <CardTitle>Filters & Search</CardTitle>
          </div>
          <CardDescription>Filter audit logs by action, entity, or date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Search Input */}
            <div>
              <Label htmlFor="search">Search Actor or Entity</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="action-type">Action Type</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger id="action-type" className="mt-1">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger id="entity-type" className="mt-1">
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Read-only activity trail</CardDescription>
            </div>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              {logs.length} records
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : error ? (
            <div className="rounded-lg border bg-red-50 p-6 text-red-800">
              <p className="text-sm">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-lg border bg-gray-50 p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-sm text-gray-600">No audit logs found</p>
              <p className="mt-1 text-xs text-gray-500">
                Activity logs will appear here once actions are performed
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={getActionBadgeColor(log.action_type)}>
                            {formatActionType(log.action_type)}
                          </Badge>
                          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                            {log.entity_type}
                          </Badge>
                        </div>

                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">Actor:</span>
                            <span className="text-gray-900">{log.actor_name}</span>
                            {log.actor_email && (
                              <span className="text-gray-500">({log.actor_email})</span>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {log.actor_role}
                            </Badge>
                          </div>

                          {log.entity_id && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">Entity ID:</span>
                              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                {log.entity_id}
                              </code>
                            </div>
                          )}

                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                                View Metadata
                              </summary>
                              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={cursorStack.length === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <span className="text-sm text-gray-600">
                  Page {cursorStack.length + 1}
                </span>

                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!nextCursor}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
