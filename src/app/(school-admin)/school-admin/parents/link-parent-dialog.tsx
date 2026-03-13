'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { linkExistingParentToWard } from './actions'

interface ParentOption {
  id: string
  full_name: string
  email: string
}

interface StudentOption {
  id: string
  name: string
  admission_number: string
}

interface Props {
  parents: ParentOption[]
  students: StudentOption[]
}

export function LinkParentDialog({ parents, students }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [parentId, setParentId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [relationship, setRelationship] = useState('Guardian')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    const result = await linkExistingParentToWard({
      parent_profile_id: parentId,
      student_id: studentId,
      relationship,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to link parent')
      return
    }

    setOpen(false)
    setParentId('')
    setStudentId('')
    setRelationship('Guardian')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Link Existing Parent</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Existing Parent</DialogTitle>
          <DialogDescription>Attach an existing parent account to a ward.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Parent</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                {parents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.full_name} ({parent.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ward</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select ward" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name} ({student.admission_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Relationship</Label>
            <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={onSubmit} disabled={isSubmitting || !parentId || !studentId}>
              {isSubmitting ? 'Linking...' : 'Link Parent'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
