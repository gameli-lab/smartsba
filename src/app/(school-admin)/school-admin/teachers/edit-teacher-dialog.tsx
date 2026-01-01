'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Pencil } from 'lucide-react'
import { updateTeacher } from './actions'
import type { Teacher, UserProfile } from '@/types'

interface EditTeacherDialogProps {
  teacher: Teacher & { user_profile: UserProfile }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditTeacherDialog({ teacher, open, onOpenChange }: EditTeacherDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gender, setGender] = useState<'male' | 'female' | ''>(teacher.user_profile.gender || '')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    const result = await updateTeacher({
      id: teacher.id,
      full_name: formData.get('full_name') as string,
      phone: (formData.get('phone') as string) || undefined,
      gender: gender || undefined,
      date_of_birth: (formData.get('date_of_birth') as string) || undefined,
      address: (formData.get('address') as string) || undefined,
      specialization: (formData.get('specialization') as string) || undefined,
      qualification: (formData.get('qualification') as string) || undefined,
      hire_date: (formData.get('hire_date') as string) || undefined,
    })

    if (result.success) {
      onOpenChange(false)
      router.refresh()
    } else {
      setError(result.error || 'Failed to update teacher')
    }

    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Teacher</DialogTitle>
          <DialogDescription>
            Update teacher information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Personal Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit_full_name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit_full_name"
                  name="full_name"
                  required
                  defaultValue={teacher.user_profile.full_name}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_email">Email Address</Label>
                <Input
                  id="edit_email"
                  value={teacher.user_profile.email}
                  readOnly
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_staff_id">Staff ID</Label>
                <Input
                  id="edit_staff_id"
                  value={teacher.staff_id}
                  readOnly
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">Staff ID cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_phone">Phone Number</Label>
                <Input
                  id="edit_phone"
                  name="phone"
                  type="tel"
                  defaultValue={teacher.user_profile.phone || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_gender">Gender</Label>
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
                <Label htmlFor="edit_date_of_birth">Date of Birth</Label>
                <Input
                  id="edit_date_of_birth"
                  name="date_of_birth"
                  type="date"
                  defaultValue={teacher.user_profile.date_of_birth || ''}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit_address">Address</Label>
                <Textarea
                  id="edit_address"
                  name="address"
                  defaultValue={teacher.user_profile.address || ''}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Professional Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_specialization">Specialization</Label>
                <Input
                  id="edit_specialization"
                  name="specialization"
                  defaultValue={teacher.specialization || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_qualification">Qualification</Label>
                <Input
                  id="edit_qualification"
                  name="qualification"
                  defaultValue={teacher.qualification || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_hire_date">Hire Date</Label>
                <Input
                  id="edit_hire_date"
                  name="hire_date"
                  type="date"
                  defaultValue={teacher.hire_date || ''}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
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
