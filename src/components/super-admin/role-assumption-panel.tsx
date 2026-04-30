'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getClientCsrfHeaders } from '@/lib/csrf'

type AssumableRole = 'school_admin' | 'teacher' | 'student' | 'parent'

type Candidate = {
  userId: string
  fullName: string
  email: string
  schoolName: string | null
}

type ActiveAssumption = {
  active: boolean
  assumedRole?: AssumableRole
  assumedUserId?: string
  target?: { full_name?: string | null; email?: string | null } | null
  destinationPath?: string
}

const roleOptions: Array<{ label: string; value: AssumableRole }> = [
  { label: 'School Admin', value: 'school_admin' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' },
  { label: 'Parent', value: 'parent' },
]

export function RoleAssumptionPanel() {
  const router = useRouter()
  const [role, setRole] = useState<AssumableRole>('teacher')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [activeAssumption, setActiveAssumption] = useState<ActiveAssumption>({ active: false })
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.userId === selectedUserId) || null,
    [candidates, selectedUserId]
  )

  const refreshAssumptionStatus = async () => {
    const response = await fetch('/api/super-admin/assume-role', { cache: 'no-store' })
    const payload = (await response.json()) as ActiveAssumption & { error?: string }
    if (response.ok) {
      setActiveAssumption(payload)
    }
  }

  const loadCandidates = async (nextRole: AssumableRole) => {
    setIsLoadingCandidates(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/super-admin/assume-role/candidates?role=${nextRole}`, { cache: 'no-store' })
      const payload = (await response.json()) as { candidates?: Candidate[]; error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load candidates')
      }

      const loaded = payload.candidates || []
      setCandidates(loaded)
      setSelectedUserId(loaded[0]?.userId || '')
    } catch (error) {
      setCandidates([])
      setSelectedUserId('')
      setMessage(error instanceof Error ? error.message : 'Failed to load role candidates')
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  useEffect(() => {
    void refreshAssumptionStatus()
    void loadCandidates(role)
  }, [])

  const handleRoleChange = (value: string) => {
    const nextRole = value as AssumableRole
    setRole(nextRole)
    void loadCandidates(nextRole)
  }

  const startAssumption = async () => {
    if (!selectedUserId) {
      setMessage('Choose a user to assume')
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/super-admin/assume-role', {
        method: 'POST',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role, targetUserId: selectedUserId }),
      })

      const payload = (await response.json()) as { success?: boolean; error?: string; destinationPath?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to start role assumption')
      }

      await refreshAssumptionStatus()
      router.push(payload.destinationPath || '/dashboard/super-admin')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to start role assumption')
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearAssumption = async () => {
    const deletePreviewData = window.confirm(
      'Return to SysAdmin now?\n\nOK = delete data created during this preview session\nCancel = keep the data and just return'
    )

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/super-admin/assume-role', {
        method: 'DELETE',
        headers: getClientCsrfHeaders({
          'X-Preview-Cleanup': deletePreviewData ? 'delete' : 'keep',
        }),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to clear role assumption')
      }

      await refreshAssumptionStatus()
      router.push('/dashboard/super-admin')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to clear role assumption')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Assumption (Preview Mode)</CardTitle>
        <CardDescription>Session-scoped testing as another role with full audit logging.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeAssumption.active ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Active preview: <strong>{activeAssumption.assumedRole?.replace('_', ' ')}</strong>
            {' '}as{' '}
            <strong>{activeAssumption.target?.full_name || activeAssumption.assumedUserId}</strong>
            <div className="mt-2">
              <Button type="button" variant="outline" onClick={clearAssumption} disabled={isSubmitting}>
                Return to SysAdmin
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isLoadingCandidates || candidates.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingCandidates ? 'Loading...' : 'Select user'} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.userId} value={candidate.userId}>
                    {candidate.fullName} {candidate.schoolName ? `(${candidate.schoolName})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedCandidate ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
            <p><strong>Name:</strong> {selectedCandidate.fullName}</p>
            <p><strong>Email:</strong> {selectedCandidate.email}</p>
            <p><strong>School:</strong> {selectedCandidate.schoolName || 'N/A'}</p>
          </div>
        ) : null}

        {message ? <p className="text-sm text-red-700">{message}</p> : null}

        <Button type="button" onClick={startAssumption} disabled={isSubmitting || !selectedUserId}>
          {isSubmitting ? 'Starting...' : 'Start Preview Session'}
        </Button>
      </CardContent>
    </Card>
  )
}
