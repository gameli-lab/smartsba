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
import { useRouter } from 'next/navigation'
import type { Class } from '@/types'

interface GuardianSuggestion {
  name: string
  phone?: string
  email?: string
}

interface ParentAccountHint {
  fullName: string
  email?: string
  phone?: string
}

interface Props {
  classes: Class[]
  guardianSuggestions: GuardianSuggestion[]
  parentAccountHints: ParentAccountHint[]
}

export function CreateStudentDialog({ classes, guardianSuggestions, parentAccountHints }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [parentTempPassword, setParentTempPassword] = useState<string | null>(null)
  const [parentInfo, setParentInfo] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedParent, setCopiedParent] = useState(false)
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [classId, setClassId] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setTempPassword(null)
    setParentTempPassword(null)
    setParentInfo(null)

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

    // Ensure the list reflects what is persisted in the database
    router.refresh()

    const parentResolution = result.parentResolution as
      | { status: string; existingRole?: string }
      | undefined

    if (parentResolution?.status === 'created_and_linked') {
      setParentInfo('Parent account was auto-created and linked to this student.')
      setParentTempPassword((result.parentTempPassword as string | null) || null)
    } else if (parentResolution?.status === 'linked_existing_parent') {
      setParentInfo('Existing parent account was auto-linked to this student.')
      setParentTempPassword(null)
    } else if (parentResolution?.status === 'conflict_existing_non_parent_email') {
      setParentInfo(`Guardian email already belongs to a ${parentResolution.existingRole || 'non-parent'} account. Parent was not auto-created.`)
      setParentTempPassword(null)
    } else {
      setParentInfo(null)
      setParentTempPassword(null)
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
    setParentTempPassword(null)
    setParentInfo(null)
    setCopied(false)
    setCopiedParent(false)
    setGender('')
    setClassId('')
    setGuardianName('')
    setGuardianPhone('')
    setGuardianEmail('')
  }

  const handleGuardianNameBlur = () => {
    const normalized = guardianName.trim().toLowerCase()
    if (!normalized) return

    const matches = guardianSuggestions.filter((g) => g.name.trim().toLowerCase() === normalized)
    if (matches.length !== 1) return

    const match = matches[0]
    if (!guardianPhone && match.phone) {
      setGuardianPhone(match.phone)
    }
    if (!guardianEmail && match.email) {
      setGuardianEmail(match.email)
    }
  }

  const normalizePhone = (value: string) => value.replace(/\D/g, '')

  const normalizedGuardianEmail = guardianEmail.trim().toLowerCase()
  const normalizedGuardianPhone = normalizePhone(guardianPhone)
  const normalizedGuardianName = guardianName.trim().toLowerCase()

  const matchingParent =
    parentAccountHints.find(
      (parent) =>
        normalizedGuardianEmail &&
        parent.email &&
        parent.email.trim().toLowerCase() === normalizedGuardianEmail
    ) ||
    parentAccountHints.find(
      (parent) =>
        normalizedGuardianPhone &&
        parent.phone &&
        normalizePhone(parent.phone) === normalizedGuardianPhone
    ) ||
    parentAccountHints.find(
      (parent) =>
        normalizedGuardianName &&
        parent.fullName.trim().toLowerCase() === normalizedGuardianName
    )

  const matchSource =
    matchingParent && normalizedGuardianEmail && matchingParent.email?.trim().toLowerCase() === normalizedGuardianEmail
      ? 'email'
      : matchingParent && normalizedGuardianPhone && matchingParent.phone && normalizePhone(matchingParent.phone) === normalizedGuardianPhone
        ? 'phone'
        : matchingParent
          ? 'name'
          : null

  const copyPassword = () => {
    if (!tempPassword) return
    navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyParentPassword = () => {
    if (!parentTempPassword) return
    navigator.clipboard.writeText(parentTempPassword)
    setCopiedParent(true)
    setTimeout(() => setCopiedParent(false), 2000)
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
            {parentInfo && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-blue-800">Parent Enrollment</AlertTitle>
                <AlertDescription className="text-blue-700">{parentInfo}</AlertDescription>
              </Alert>
            )}
            {parentTempPassword && (
              <div className="space-y-2">
                <Label>Parent Temporary Password</Label>
                <div className="flex gap-2">
                  <Input value={parentTempPassword} readOnly className="font-mono" />
                  <Button type="button" variant="outline" onClick={copyParentPassword}>
                    {copiedParent ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-amber-700">Share only with the guardian. It will not be shown again.</p>
              </div>
            )}
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
                  <Input
                    name="guardian_name"
                    placeholder="Guardian full name"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    onBlur={handleGuardianNameBlur}
                    list="guardian-name-options"
                  />
                  <datalist id="guardian-name-options">
                    {guardianSuggestions.map((guardian) => (
                      <option key={`${guardian.name}-${guardian.phone || ''}-${guardian.email || ''}`} value={guardian.name}>
                        {guardian.phone || guardian.email || ''}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Guardian Phone</Label>
                  <Input
                    name="guardian_phone"
                    placeholder="+233..."
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Guardian Email</Label>
                  <Input
                    name="guardian_email"
                    type="email"
                    placeholder="guardian@example.com"
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                  />
                </div>
              </div>

              {matchingParent && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTitle className="text-amber-800">Possible existing parent account</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    This guardian matches parent <strong>{matchingParent.fullName}</strong>
                    {matchSource ? ` by ${matchSource}` : ''}. You can still create the student now and link later in Parents management.
                  </AlertDescription>
                </Alert>
              )}
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
