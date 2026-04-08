'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { updateStudent } from './actions'
import type { Student, UserProfile, Class } from '@/types'

interface StudentWithRelations extends Student {
  user_profile: UserProfile | null
  classes: Class | null
}

interface Props {
  student: StudentWithRelations
  classes: Class[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditStudentDialog({ student, classes, open, onOpenChange }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gender, setGender] = useState<'male' | 'female' | ''>(student.gender || '')
  const [classId, setClassId] = useState<string>(student.class_id || '')

  if (!student.user_profile) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const result = await updateStudent({
      id: student.id,
      full_name: formData.get('full_name') as string,
      phone: (formData.get('phone') as string) || undefined,
      address: (formData.get('address') as string) || undefined,
      gender: (gender as 'male' | 'female') || undefined,
      date_of_birth: (formData.get('date_of_birth') as string) || undefined,
      admission_date: (formData.get('admission_date') as string) || undefined,
      roll_number: (formData.get('roll_number') as string) || undefined,
      guardian_name: (formData.get('guardian_name') as string) || undefined,
      guardian_phone: (formData.get('guardian_phone') as string) || undefined,
      guardian_email: (formData.get('guardian_email') as string) || undefined,
      class_id: classId || undefined,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to update student')
      return
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>Update student information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Full Name *</Label>
              <Input name="full_name" defaultValue={student.user_profile.full_name} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={student.user_profile.email} readOnly disabled className="bg-gray-50" />
              <p className="text-xs text-gray-500">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label>Admission Number</Label>
              <Input value={student.admission_number} readOnly disabled className="bg-gray-50" />
              <p className="text-xs text-gray-500">Admission number cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={classId || undefined} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (Level {c.level}{c.stream ? ` • ${c.stream}` : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as 'male' | 'female')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input name="date_of_birth" type="date" defaultValue={student.date_of_birth || ''} />
            </div>
            <div className="space-y-2">
              <Label>Admission Date</Label>
              <Input name="admission_date" type="date" defaultValue={student.admission_date || ''} />
            </div>
            <div className="space-y-2">
              <Label>Roll Number</Label>
              <Input name="roll_number" defaultValue={student.roll_number || ''} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" defaultValue={student.user_profile.phone || ''} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Textarea name="address" defaultValue={student.address || student.user_profile.address || ''} rows={2} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Guardian Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guardian Name</Label>
                <Input name="guardian_name" defaultValue={student.guardian_name || ''} />
              </div>
              <div className="space-y-2">
                <Label>Guardian Phone</Label>
                <Input name="guardian_phone" defaultValue={student.guardian_phone || ''} />
              </div>
              <div className="space-y-2">
                <Label>Guardian Email</Label>
                <Input name="guardian_email" type="email" defaultValue={student.guardian_email || ''} />
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
