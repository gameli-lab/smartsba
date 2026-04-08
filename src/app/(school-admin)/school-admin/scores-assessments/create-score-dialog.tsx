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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Plus } from 'lucide-react'
import { createScore } from './actions'

interface Props {
  studentId: string
  studentName: string
  subjectId: string
  subjectName: string
  sessionId: string
}

export function CreateScoreDialog({ studentId, studentName, subjectId, subjectName, sessionId }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const caScore = (formData.get('ca_score') as string) ? Number(formData.get('ca_score')) : undefined
    const examScore = (formData.get('exam_score') as string) ? Number(formData.get('exam_score')) : undefined

    const result = await createScore({
      student_id: studentId,
      subject_id: subjectId,
      session_id: sessionId,
      ca_score: caScore,
      exam_score: examScore,
      subject_remark: (formData.get('subject_remark') as string) || undefined,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to create score')
      return
    }

    setOpen(false)
    e.currentTarget.reset()
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null)
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-3 w-3" />
          Add Score
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Score</DialogTitle>
          <DialogDescription>
            {studentName} • {subjectName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CA Score (0-40)</Label>
              <Input
                name="ca_score"
                type="number"
                min={0}
                max={40}
                step={0.5}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Exam Score (0-60)</Label>
              <Input
                name="exam_score"
                type="number"
                min={0}
                max={60}
                step={0.5}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Remark</Label>
            <Textarea name="subject_remark" rows={2} placeholder="Subject remark or comment" />
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
              Save Score
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
