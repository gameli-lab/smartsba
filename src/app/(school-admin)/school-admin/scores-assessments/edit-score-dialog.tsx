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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { updateScore } from './actions'
import type { Score } from '@/types'

interface Props {
  score: Score
  studentName: string
  subjectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditScoreDialog({ score, studentName, subjectName, open, onOpenChange }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [caScore, setCaScore] = useState(score.ca_score?.toString() || '')
  const [examScore, setExamScore] = useState(score.exam_score?.toString() || '')

  useEffect(() => {
    if (open) {
      setCaScore(score.ca_score?.toString() || '')
      setExamScore(score.exam_score?.toString() || '')
      setError(null)
    }
  }, [open, score])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const nextCa = caScore ? Number(caScore) : undefined
    const nextExam = examScore ? Number(examScore) : undefined

    const result = await updateScore({
      id: score.id,
      ca_score: nextCa,
      exam_score: nextExam,
      subject_remark: (formData.get('subject_remark') as string) || undefined,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to update score')
      return
    }

    router.refresh()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Score</DialogTitle>
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
                value={caScore}
                onChange={(e) => setCaScore(e.target.value)}
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
                value={examScore}
                onChange={(e) => setExamScore(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Remark</Label>
            <Textarea
              name="subject_remark"
              rows={2}
              defaultValue={score.subject_remark || ''}
              placeholder="Subject remark or comment"
            />
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
