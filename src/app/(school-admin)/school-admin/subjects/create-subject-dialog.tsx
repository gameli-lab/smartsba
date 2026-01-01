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
import { createSubject } from './actions'
import type { Class } from '@/types'

interface Props {
  classes: Class[]
}

export function CreateSubjectDialog({ classes }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [classId, setClassId] = useState('')
  const [isCore, setIsCore] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const result = await createSubject({
      name: (formData.get('name') as string) || '',
      class_id: classId,
      code: (formData.get('code') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
      is_core: isCore,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to create subject')
      return
    }

    setOpen(false)
    setClassId('')
    setIsCore(false)
    e.currentTarget.reset()
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null)
      setClassId('')
      setIsCore(false)
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Subject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Subject</DialogTitle>
          <DialogDescription>Add a new subject to a class.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <Label>Subject Name *</Label>
              <Input name="name" required placeholder="Mathematics" />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input name="code" placeholder="MATH" />
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
            <Textarea name="description" rows={3} placeholder="Notes about this subject" />
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
            <Button type="submit" disabled={isSubmitting || !classId}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Subject
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
