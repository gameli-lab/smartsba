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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { createAcademicSession } from './actions'
import { AcademicTerm } from '@/types'

export function CreateSessionDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [term, setTerm] = useState<AcademicTerm>(1)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    const result = await createAcademicSession({
      academic_year: formData.get('academic_year') as string,
      term,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      vacation_date: (formData.get('vacation_date') as string) || undefined,
      reopening_date: (formData.get('reopening_date') as string) || undefined,
    })

    if (result.success) {
      setOpen(false)
      router.refresh()
      // Reset form
      setTerm(1)
    } else {
      setError(result.error || 'Failed to create session')
    }

    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Academic Session</DialogTitle>
          <DialogDescription>
            Add a new academic year and term to your school calendar
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
                placeholder="e.g., 2024/2025"
                required
              />
              <p className="text-xs text-gray-500">Format: YYYY/YYYY</p>
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
              />
              <p className="text-xs text-gray-500">Optional</p>
            </div>

            {/* Reopening Date */}
            <div className="space-y-2">
              <Label htmlFor="reopening_date">Reopening Date</Label>
              <Input
                id="reopening_date"
                name="reopening_date"
                type="date"
              />
              <p className="text-xs text-gray-500">Optional</p>
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
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
