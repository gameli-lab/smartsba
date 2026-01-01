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
import { setStudentPromotion } from './actions'

interface StudentData {
  id: string
  full_name: string
  total_score: number
  avg_score: number
}

interface NextClass {
  id: string
  name: string
  level: number
  stream?: string
}

interface Props {
  student: StudentData
  nextClasses: NextClass[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PromotionRemarkDialog({ student, nextClasses, open, onOpenChange }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'promoted' | 'repeated' | 'withdrawn' | ''>('')
  const [nextClassId, setNextClassId] = useState('')

  useEffect(() => {
    if (open) {
      setStatus('')
      setNextClassId('')
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!status) {
      setError('Please select a promotion status')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await setStudentPromotion({
      student_id: student.id,
      session_id: (formData.get('session_id') as string) || '',
      promotion_status: status as 'promoted' | 'repeated' | 'withdrawn' | 'pending',
      remark: (formData.get('remark') as string) || undefined,
      next_class_id: nextClassId || undefined,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to save promotion status')
      return
    }

    router.refresh()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promotion Decision</DialogTitle>
          <DialogDescription>{student.full_name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Score: <span className="font-bold text-gray-900">{student.total_score}</span></p>
            <p className="text-sm text-gray-600">Average: <span className="font-bold text-gray-900">{student.avg_score.toFixed(2)}</span></p>
          </div>

          <div className="space-y-2">
            <Label>Promotion Status *</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="promoted">Promoted</SelectItem>
                <SelectItem value="repeated">Repeated</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === 'promoted' && (
            <div className="space-y-2">
              <Label>Next Class *</Label>
              <Select value={nextClassId} onValueChange={setNextClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select next class" />
                </SelectTrigger>
                <SelectContent>
                  {nextClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (Level {c.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Remark</Label>
            <Textarea name="remark" rows={3} placeholder="Teacher comment" />
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
            <Button type="submit" disabled={isSubmitting || !status}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Status
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
