'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  findGuardianParentCandidates,
  linkStudentGuardianToParent,
  promoteGuardianFromStudent,
  syncGuardianSnapshotToLinkedParents,
} from '@/app/(school-admin)/school-admin/parents/actions'

interface Props {
  studentId: string
  disabled?: boolean
}

export function PromoteGuardianButton({ studentId, disabled = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [showResolver, setShowResolver] = useState(false)
  const [candidates, setCandidates] = useState<Array<{ id: string; full_name: string; email: string | null; phone: string | null }>>([])
  const [selectedParentId, setSelectedParentId] = useState('')

  const onPromote = () => {
    setError(null)
    setSuccess(null)
    setTempPassword(null)

    startTransition(async () => {
      const result = await promoteGuardianFromStudent(studentId)
      if (!result.success) {
        setError(result.error || 'Failed to create/link parent from guardian info.')

        if ((result.error || '').toLowerCase().includes('multiple parent accounts')) {
          const candidateResult = await findGuardianParentCandidates(studentId)
          if (candidateResult.success && candidateResult.candidates.length > 0) {
            setCandidates(candidateResult.candidates)
            setSelectedParentId(candidateResult.candidates[0]?.id || '')
            setShowResolver(true)
          }
        }

        return
      }

      const modeText = result.createdNew ? 'Created new parent account' : 'Linked existing parent account'
      setSuccess(`${modeText}. Linked wards: ${result.linkedCount}.`)
      if (result.tempPassword) {
        setTempPassword(result.tempPassword)
      }
    })
  }

  const onResolve = () => {
    if (!selectedParentId) return
    setError(null)
    setSuccess(null)
    setTempPassword(null)

    startTransition(async () => {
      const result = await linkStudentGuardianToParent(studentId, selectedParentId)
      if (!result.success) {
        setError(result.error || 'Failed to link selected parent.')
        return
      }
      setShowResolver(false)
      setSuccess(`Linked selected parent. Linked wards: ${result.linkedCount}.`)
    })
  }

  const onSyncSnapshot = () => {
    setError(null)
    setSuccess(null)
    setTempPassword(null)

    startTransition(async () => {
      const result = await syncGuardianSnapshotToLinkedParents(studentId)
      if (!result.success) {
        setError(result.error || 'Failed to sync guardian snapshot.')
        return
      }
      setSuccess(`Synced guardian snapshot to ${result.updatedParentCount} linked parent account(s).`)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onPromote} disabled={disabled || isPending}>
          {isPending ? 'Processing...' : 'Create/Link Parent from Guardian Info'}
        </Button>
        <Button type="button" variant="ghost" onClick={onSyncSnapshot} disabled={isPending}>
          Sync Guardian Snapshot
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {success ? <p className="text-xs text-green-700">{success}</p> : null}
      {tempPassword ? (
        <p className="text-xs text-amber-700">
          Temporary parent password: <span className="font-mono">{tempPassword}</span>
        </p>
      ) : null}

      <Dialog open={showResolver} onOpenChange={setShowResolver}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Parent Match</DialogTitle>
            <DialogDescription>
              Multiple parent candidates matched guardian info. Select the correct parent to link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Parent Candidate</Label>
            <Select value={selectedParentId} onValueChange={setSelectedParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.full_name} ({parent.email || parent.phone || 'No contact'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowResolver(false)}>Cancel</Button>
              <Button type="button" onClick={onResolve} disabled={!selectedParentId || isPending}>
                {isPending ? 'Linking...' : 'Link Selected Parent'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
