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
import { updateSubject } from './actions'
import type { Subject, Class } from '@/types'

interface Props {
  subject: Subject
  classes: Class[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditSubjectDialog({ subject, classes, open, onOpenChange }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [classId, setClassId] = useState(subject.class_id)
  const [isCore, setIsCore] = useState(subject.is_core)

  useEffect(() => {
    if (open) {
      setClassId(subject.class_id)
      setIsCore(subject.is_core)
      setError(null)
    }
  }, [open, subject])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const result = await updateSubject({
      id: subject.id,
      name: (formData.get('name') as string) || subject.name,
      class_id: classId,
      code: (formData.get('code') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
      is_core: isCore,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to update subject')
      return
    }

    router.refresh()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Subject</DialogTitle>
          <DialogDescription>Update subject details.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Subject Name *</Label>
              <Input name="name" defaultValue={subject.name} required />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input name="code" defaultValue={subject.code || ''} />
            </div>
            <div className="space-y-2">
              <Label>Core Subject?</Label>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCore(!isCore)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                    isCore
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {isCore && <span className="text-white text-xs">✓</span>}
                </button>
                <span className="text-sm text-gray-600">Core/Required</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea name="description" rows={3} defaultValue={subject.description || ''} />
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
