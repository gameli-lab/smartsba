"use client"

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { setClassTeacher } from './actions'

interface TeacherOption {
  id: string
  full_name: string
  staff_id: string
  is_active: boolean
}

interface Props {
  classId: string
  currentTeacherId: string | null
  teachers: TeacherOption[]
}

export function AssignClassTeacher({ classId, currentTeacherId, teachers }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(currentTeacherId || '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeTeachers = teachers.filter((t) => t.is_active)

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await setClassTeacher(classId, value)
      if (!result.success) {
        setError(result.error || 'Failed to set class teacher')
        return
      }
      router.refresh()
    })
  }

  const hasChange = value !== (currentTeacherId || '')

  return (
    <div className="space-y-2">
      {activeTeachers.length === 0 ? (
        <p className="text-xs text-gray-500">No active teachers available to assign.</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="w-full sm:w-64">
            <Select value={value} onValueChange={setValue} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select class teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No class teacher</SelectItem>
                {activeTeachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name} ({teacher.staff_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={isPending || !hasChange} size="sm">
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
