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
import { Loader2, Plus } from 'lucide-react'
import { createClass } from './actions'

interface TeacherOption {
  id: string
  full_name: string
  staff_id: string
  is_active: boolean
}

interface Props {
  teachers: TeacherOption[]
}

export function CreateClassDialog({ teachers }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teacherId, setTeacherId] = useState('')
  const [stream, setStream] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const levelValue = Number(formData.get('level'))

    const result = await createClass({
      name: (formData.get('name') as string) || '',
      level: levelValue,
      stream: stream || undefined,
      description: (formData.get('description') as string) || undefined,
      class_teacher_id: teacherId || undefined,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to create class')
      return
    }

    // Clear state and close dialog (form will remount fresh next time)
    setTeacherId('')
    setStream('')
    setOpen(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null)
      setTeacherId('')
      setStream('')
    }
    setOpen(next)
  }

  const activeTeachers = teachers.filter((t) => t.is_active)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Class
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Class</DialogTitle>
          <DialogDescription>Define a class with optional stream and class teacher.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class Name / Number *</Label>
              <Input name="name" required placeholder="e.g. JHS 1" />
            </div>
            <div className="space-y-2">
              <Label>Level *</Label>
              <Input name="level" type="number" min={1} max={12} required placeholder="1" />
            </div>
            <div className="space-y-2">
              <Label>Stream</Label>
              <Select value={stream} onValueChange={setStream}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose stream" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No stream</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {activeTeachers.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                      No active teachers available
                    </div>
                  ) : (
                    <>
                      <SelectItem value="none">No teacher</SelectItem>
                      {activeTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.full_name} ({teacher.staff_id})
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea name="description" rows={3} placeholder="Notes about this class" />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Class
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
