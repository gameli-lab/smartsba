'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Check } from 'lucide-react'
import { getClassPromotionData, bulkPromoteStudents } from './actions'
import { PromotionList } from './promotion-list'
import type { Class, AcademicSession } from '@/types'

interface Props {
  classes: Class[]
  sessions: AcademicSession[]
}

interface PromotionStudent {
  id: string
  promotion_status?: string | null
}

interface PromotionData {
  class: { name: string }
  students: PromotionStudent[]
  nextClasses: Array<{ id: string; name: string }>
  totalStudents: number
  promotedCount: number
}

export function GradingPromotionClient({ classes, sessions }: Props) {
  const router = useRouter()
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '')
  const [selectedSession, setSelectedSession] = useState(sessions[0]?.id || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promotionData, setPromotionData] = useState<PromotionData | null>(null)
  const [isBulkPromoting, setIsBulkPromoting] = useState(false)

  const handleLoadData = async () => {
    if (!selectedClass || !selectedSession) {
      setError('Please select both class and session')
      return
    }

    setIsLoading(true)
    setError(null)
    const result = await getClassPromotionData(selectedClass, selectedSession)
    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to load promotion data')
      return
    }

    setPromotionData(result.data as PromotionData)
  }

  const handleBulkPromote = async () => {
    if (!promotionData || promotionData.nextClasses.length === 0) {
      setError('No next class available for promotion')
      return
    }

    // TODO: Use LEVEL_GROUPS to validate promotion rules:
    // - Students in JHS 3 cannot be promoted (graduation)
    // - Students from Primary 6 can be promoted to JHS 1
    // - Implement level-aware next class selection based on current class level

    const nextClassId = promotionData.nextClasses[0].id
    const studentIds = promotionData.students
      .filter((s) => !s.promotion_status)
      .map((s) => s.id)

    if (studentIds.length === 0) {
      setError('All students already have a promotion status')
      return
    }

    if (!confirm(`Promote ${studentIds.length} students to ${promotionData.nextClasses[0].name}?`)) {
      return
    }

    setIsBulkPromoting(true)
    setError(null)

    const result = await bulkPromoteStudents({
      class_id: selectedClass,
      current_session_id: selectedSession,
      next_class_id: nextClassId,
      student_ids: studentIds,
      remark: 'Bulk promoted to next class',
    })

    setIsBulkPromoting(false)

    if (!result.success) {
      setError(result.error || 'Failed to bulk promote')
      return
    }

    router.refresh()
    await handleLoadData()
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Class Selection</CardTitle>
          <CardDescription>Select a class and session to view promotion details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Class *</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (Level {c.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Session *</label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.academic_year} • Term {s.term}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button onClick={handleLoadData} disabled={isLoading || !selectedClass || !selectedSession}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Promotion Data */}
      {promotionData && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {promotionData.totalStudents}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">Promoted</p>
                <p className="text-3xl font-bold text-green-700 mt-2">
                  {promotionData.promotedCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">Pending Status</p>
                <p className="text-3xl font-bold text-yellow-700 mt-2">
                  {promotionData.totalStudents - promotionData.promotedCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">Next Class</p>
                <p className="text-lg font-bold text-gray-900 mt-2">
                  {promotionData.nextClasses.length > 0
                    ? promotionData.nextClasses[0].name
                    : 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bulk Action */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleBulkPromote}
                disabled={
                  isBulkPromoting ||
                  promotionData.nextClasses.length === 0 ||
                  promotionData.totalStudents === promotionData.promotedCount
                }
              >
                {isBulkPromoting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Check className="mr-2 h-4 w-4" />
                Promote Remaining to {promotionData.nextClasses[0]?.name}
              </Button>
            </CardContent>
          </Card>

          {/* Student List */}
          <Card>
            <CardHeader>
              <CardTitle>Student Promotion Status</CardTitle>
              <CardDescription>
                {promotionData.class.name} • {promotionData.totalStudents} students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PromotionList
                students={promotionData.students}
                nextClasses={promotionData.nextClasses}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
