'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { createParentAndLink } from './actions'

interface StudentOption {
  id: string
  name: string
  admission_number: string
}

interface Props {
  students: StudentOption[]
}

export function CreateParentDialog({ students }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  const onSubmit = async (formData: FormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    const result = await createParentAndLink({
      full_name: (formData.get('full_name') as string) || '',
      email: (formData.get('email') as string) || '',
      phone: (formData.get('phone') as string) || undefined,
      relationship: (formData.get('relationship') as string) || undefined,
      student_ids: selectedStudents,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to create parent')
      return
    }

    const createdNew = Boolean(result.createdNew)
    const linkedCount = Number(result.linkedCount || 0)
    if (createdNew) {
      setSuccessMessage(
        linkedCount > 0
          ? `Parent account created and linked to ${linkedCount} ward${linkedCount === 1 ? '' : 's'}.`
          : 'Parent account created. No wards linked yet.'
      )
    } else {
      setSuccessMessage(
        linkedCount > 0
          ? `Existing parent account linked to ${linkedCount} ward${linkedCount === 1 ? '' : 's'}.`
          : 'Parent account already exists and is ready. No new links were added.'
      )
    }
    setTempPassword((result.tempPassword as string | null) || null)
    router.refresh()
  }

  const resetAndClose = () => {
    setOpen(false)
    setError(null)
    setTempPassword(null)
    setSuccessMessage(null)
    setSelectedStudents([])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Parent</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Parent Account</DialogTitle>
          <DialogDescription>Create a parent and link wards in one step.</DialogDescription>
        </DialogHeader>

        {successMessage ? (
          <div className="space-y-4">
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{successMessage}</p>
            {tempPassword && (
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <Input value={tempPassword} readOnly className="font-mono" />
                <p className="text-xs text-amber-700">Share this password once. It is not shown again.</p>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={resetAndClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form action={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Full Name *</Label>
                <Input name="full_name" required />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="phone" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Relationship Label</Label>
                <Input name="relationship" placeholder="Guardian, Mother, Father..." />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Link Wards (optional)</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                {students.map((student) => (
                  <label key={student.id} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={selectedStudents.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} />
                    <span>{student.name} ({student.admission_number})</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetAndClose} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Parent'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
