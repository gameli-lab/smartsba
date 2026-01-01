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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Plus, Check, Copy } from 'lucide-react'
import { createStudent } from './actions'
import type { Class } from '@/types'

interface Props {
  classes: Class[]
}

export function CreateStudentDialog({ classes }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [classId, setClassId] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setTempPassword(null)

    const formData = new FormData(e.currentTarget)

    const result = await createStudent({
      full_name: formData.get('full_name') as string,
      email: formData.get('email') as string,
      admission_number: formData.get('admission_number') as string,
      class_id: classId,
      gender: gender as 'male' | 'female',
      date_of_birth: formData.get('date_of_birth') as string,
      admission_date: formData.get('admission_date') as string,
      roll_number: (formData.get('roll_number') as string) || undefined,
      phone: (formData.get('phone') as string) || undefined,
      address: (formData.get('address') as string) || undefined,
      guardian_name: (formData.get('guardian_name') as string) || undefined,
      guardian_phone: (formData.get('guardian_phone') as string) || undefined,
      guardian_email: (formData.get('guardian_email') as string) || undefined,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to create student')
      return
    }

    if (result.tempPassword) {
      setTempPassword(result.tempPassword)
    } else {
      setOpen(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setError(null)
    setTempPassword(null)
    setCopied(false)
    setGender('')
    setClassId('')
  }

  const copyPassword = () => {
    if (!tempPassword) return
    navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>Create a new student record and account</DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle className="text-green-800">Student Created</AlertTitle>
              <AlertDescription className="text-green-700">
                Share this temporary password with the student. They should change it on first login.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex gap-2">
                <Input value={tempPassword} readOnly className="font-mono" />
                <Button type="button" variant="outline" onClick={copyPassword}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-amber-700">Copy this now; it will not be shown again.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Full Name *</Label>
                <Input name="full_name" required placeholder="Student name" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input name="email" type="email" required placeholder="student@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Admission Number *</Label>
                <Input name="admission_number" required placeholder="ADM-001" />
              </div>
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={classId} onValueChange={setClassId}>
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
                <Label>Gender *</Label>
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
                <Label>Date of Birth *</Label>
                <Input name="date_of_birth" type="date" required />
              </div>
              <div className="space-y-2">
                <Label>Admission Date *</Label>
                <Input name="admission_date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label>Roll Number</Label>
                <Input name="roll_number" placeholder="01" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="phone" placeholder="+233..." />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address</Label>
                <Textarea name="address" rows={2} placeholder="Address" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Guardian Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Guardian Name</Label>
                  <Input name="guardian_name" placeholder="Guardian full name" />
                </div>
                <div className="space-y-2">
                  <Label>Guardian Phone</Label>
                  <Input name="guardian_phone" placeholder="+233..." />
                </div>
                <div className="space-y-2">
                  <Label>Guardian Email</Label>
                  <Input name="guardian_email" type="email" placeholder="guardian@example.com" />
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !gender || !classId}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Student
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
