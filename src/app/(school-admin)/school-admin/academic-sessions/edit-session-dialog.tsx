'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Loader2 } from 'lucide-react'
import { updateAcademicSession } from './actions'
import { AcademicSession, AcademicTerm } from '@/types'

interface EditSessionDialogProps {
  session: AcademicSession
  onClose: () => void
}

export function EditSessionDialog({ session, onClose }: EditSessionDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [term, setTerm] = useState<AcademicTerm>(session.term)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    const result = await updateAcademicSession({
      id: session.id,
      academic_year: formData.get('academic_year') as string,
      term,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      vacation_date: (formData.get('vacation_date') as string) || undefined,
      reopening_date: (formData.get('reopening_date') as string) || undefined,
    })

    if (result.success) {
      onClose()
      router.refresh()
    } else {
      setError(result.error || 'Failed to update session')
    }

    setIsSubmitting(false)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Academic Session</DialogTitle>
          <DialogDescription>
            Update the academic session details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Academic Year */}
            <div className="space-y-2">
              <Label htmlFor="academic_year">
                Academic Year <span className="text-red-500">*</span>
              </Label>
              <Input
                id="academic_year"
                name="academic_year"
                defaultValue={session.academic_year}
                placeholder="e.g., 2024/2025"
                required
              />
            </div>

            {/* Term */}
            <div className="space-y-2">
              <Label htmlFor="term">
                Term <span className="text-red-500">*</span>
              </Label>
              <Select value={term.toString()} onValueChange={(v) => setTerm(parseInt(v) as AcademicTerm)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Term 1</SelectItem>
                  <SelectItem value="2">Term 2</SelectItem>
                  <SelectItem value="3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={session.start_date}
                required
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end_date">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={session.end_date}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Vacation Date */}
            <div className="space-y-2">
              <Label htmlFor="vacation_date">Vacation Date</Label>
              <Input
                id="vacation_date"
                name="vacation_date"
                type="date"
                defaultValue={session.vacation_date || ''}
              />
            </div>

            {/* Reopening Date */}
            <div className="space-y-2">
              <Label htmlFor="reopening_date">Reopening Date</Label>
              <Input
                id="reopening_date"
                name="reopening_date"
                type="date"
                defaultValue={session.reopening_date || ''}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
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
