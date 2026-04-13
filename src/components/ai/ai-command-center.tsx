'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { UserRole } from '@/types'

type AITaskType = 'switch_role' | 'feature_audit' | 'security_audit' | 'test_plan'

interface AIResult {
  actor_role: UserRole
  task: AITaskType
  accessible_roles: UserRole[]
  role_switch?: {
    target_role: UserRole
    allowed: boolean
    route: string | null
    note: string
  }
  feature_checklist?: Array<{ title: string; route: string; check: string }>
  security_findings?: Array<{ severity: 'low' | 'medium' | 'high'; area: string; finding: string; suggested_fix: string }>
  test_cases?: Array<{
    id: string
    title: string
    role: UserRole
    route: string
    objective: string
    preconditions: string[]
    steps: string[]
    expected_result: string
    priority: 'high' | 'medium' | 'low'
  }>
  next_steps: string[]
}

interface AISessionHistory {
  id: string
  task_type: AITaskType
  actor_role: UserRole
  target_role?: UserRole | null
  focus?: string | null
  status: 'running' | 'completed' | 'failed'
  created_at: string
  findings?: Array<{
    id: string
    severity: 'low' | 'medium' | 'high'
    area: string
    finding: string
    suggested_fix: string
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed'
  }>
  test_cases?: Array<{
    id: string
    priority: 'high' | 'medium' | 'low'
  }>
}

function severityClass(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/30'
  if (severity === 'medium') return 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30'
  return 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/30'
}

export function AICommandCenter({ initialRole }: { initialRole: UserRole }) {
  const [task, setTask] = useState<AITaskType>('feature_audit')
  const [targetRole, setTargetRole] = useState<UserRole>(initialRole)
  const [focus, setFocus] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AIResult | null>(null)
  const [history, setHistory] = useState<AISessionHistory[]>([])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const token = session?.access_token
      if (!token) {
        setHistory([])
        setHistoryLoading(false)
        return
      }

      const response = await fetch('/api/ai/command', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const payload = await response.json()
      if (response.ok && payload.success) {
        setHistory((payload.sessions || []) as AISessionHistory[])
      }
    } catch (e) {
      console.error('Failed to load AI history:', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const runCommand = async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const token = session?.access_token
      if (!token) {
        setError('You must be logged in to run AI commands.')
        setLoading(false)
        return
      }

      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task,
          targetRole,
          focus: focus || undefined,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setError(payload.error || 'AI command failed')
        setResult(null)
        setLoading(false)
        return
      }

      setResult(payload.result as AIResult)
      await loadHistory()
    } catch (e) {
      console.error(e)
      setError('Failed to execute AI command')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">AI Command Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Task</Label>
              <Select value={task} onValueChange={(v) => setTask(v as AITaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="switch_role">Switch Role Context</SelectItem>
                  <SelectItem value="feature_audit">Feature Audit Checklist</SelectItem>
                  <SelectItem value="test_plan">Generate Test Plan</SelectItem>
                  <SelectItem value="security_audit">Security Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Role</Label>
              <Select value={targetRole} onValueChange={(v) => setTargetRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="school_admin">School Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Focus (optional)</Label>
              <Input
                placeholder="e.g. auth, rls, grade reports"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={runCommand} disabled={loading}>
            {loading ? 'Running...' : 'Run AI Command'}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Actor Role: <span className="font-medium text-gray-900 dark:text-gray-100">{result.actor_role}</span>
            </div>

            {result.role_switch && (
              <div className="space-y-2 text-sm">
                <p className="text-gray-900 dark:text-gray-100 font-medium">Role Switch Outcome</p>
                <p className="text-gray-600 dark:text-gray-300">{result.role_switch.note}</p>
                {result.role_switch.route && (
                  <p className="text-gray-600 dark:text-gray-300">Destination: {result.role_switch.route}</p>
                )}
              </div>
            )}

            {result.feature_checklist && result.feature_checklist.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-900 dark:text-gray-100 font-medium">Feature Checklist</p>
                <ul className="space-y-2">
                  {result.feature_checklist.map((item, idx) => (
                    <li key={`${item.route}-${idx}`} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-300">{item.route}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.check}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.security_findings && result.security_findings.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-900 dark:text-gray-100 font-medium">Security Findings</p>
                <ul className="space-y-2">
                  {result.security_findings.map((f, idx) => (
                    <li key={`${f.area}-${idx}`} className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-1">
                      <span className={`inline-block text-xs px-2 py-1 rounded ${severityClass(f.severity)}`}>
                        {f.severity.toUpperCase()}
                      </span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{f.area}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{f.finding}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-200">Fix: {f.suggested_fix}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.test_cases && result.test_cases.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-900 dark:text-gray-100 font-medium">Generated Test Cases</p>
                <ul className="space-y-2">
                  {result.test_cases.map((t) => (
                    <li key={t.id} className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{t.title}</p>
                        <span className={`text-xs px-2 py-1 rounded ${severityClass(t.priority === 'high' ? 'high' : t.priority === 'medium' ? 'medium' : 'low')}`}>
                          {t.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-300">{t.route}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Objective: {t.objective}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-200">Expected: {t.expected_result}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-gray-900 dark:text-gray-100 font-medium">Next Steps</p>
              <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                {result.next_steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Recent AI Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">Loading session history...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">No AI sessions yet.</p>
          ) : (
            <ul className="space-y-3">
              {history.map((session) => (
                <li key={session.id} className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{session.task_type}</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(session.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Actor: {session.actor_role}
                    {session.target_role ? ` • Target: ${session.target_role}` : ''}
                    {session.focus ? ` • Focus: ${session.focus}` : ''}
                  </p>
                  {session.findings && session.findings.length > 0 && (
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      Findings: {session.findings.length} ({session.findings.map((f) => f.severity).join(', ')})
                    </p>
                  )}
                  {session.test_cases && session.test_cases.length > 0 && (
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      Test Cases: {session.test_cases.length}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
