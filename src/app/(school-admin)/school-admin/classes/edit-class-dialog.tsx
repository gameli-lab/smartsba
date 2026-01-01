'use client'

import { useEffect, useState } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { updateClass } from './actions'
import type { Class } from '@/types'

interface TeacherOption {
  id: string
  full_name: string
  staff_id: string
  is_active: boolean
}

interface Props {
  klass: Class
  teachers: TeacherOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditClassDialog({ klass, teachers, open, onOpenChange }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teacherId, setTeacherId] = useState(klass.class_teacher_id || '')
  const [level, setLevel] = useState(klass.level.toString())

  useEffect(() => {
    if (open) {
      setTeacherId(klass.class_teacher_id || '')
      setLevel(klass.level.toString())
      setError(null)
    }
  }, [open, klass])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const levelValue = Number(level)

    const result = await updateClass({
      id: klass.id,
      name: (formData.get('name') as string) || klass.name,
      level: Number.isFinite(levelValue) ? levelValue : klass.level,
      stream: ((formData.get('stream') as string) || undefined),
      description: ((formData.get('description') as string) || undefined),
      class_teacher_id: teacherId || null,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to update class')
      return
    }

    router.refresh()
    onOpenChange(false)
  }

  const activeTeachers = teachers.filter((t) => t.is_active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Class</DialogTitle>
          <DialogDescription>Update class details or assign a class teacher.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input name="name" defaultValue={klass.name} required />
            </div>
            <div className="space-y-2">
              <Label>Level *</Label>
              <Input
                name="level"
                type="number"
                min={1}
                max={12}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Stream</Label>
              <Input name="stream" defaultValue={klass.stream || ''} />
            </div>
            <div className="space-y-2">
              <Label>Class Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No class teacher</SelectItem>
                  {activeTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.full_name} ({teacher.staff_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea name="description" rows={3} defaultValue={klass.description || ''} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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
