'use client'

import { useState } from 'react'
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
import { Loader2 } from 'lucide-react'
import { generateStudentReportCard, generateClassReport, getReportMetadata, type ReportMetadata } from './actions'
import type { AcademicSession, Class } from '@/types'

type ClassMetadata = Pick<ReportMetadata, 'students'>

interface Props {
  sessions: AcademicSession[]
  classes: Class[]
}

export function ReportsClient({ sessions, classes }: Props) {
  const [reportType, setReportType] = useState<'student' | 'class'>('student')
  const [selectedSession, setSelectedSession] = useState(sessions[0]?.id || '')
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [classMetadata, setClassMetadata] = useState<ClassMetadata | null>(null)

  const handleClassChange = async (classId: string) => {
    setSelectedClass(classId)
    setSelectedStudent('')
    setError(null)

    if (reportType === 'student') {
      setIsLoading(true)
      const result = await getReportMetadata(classId)
      setIsLoading(false)

      if (result.success) {
        const { data } = result
        setClassMetadata(data)
        const firstStudent = data.students[0]
        if (firstStudent) {
          setSelectedStudent(firstStudent.id)
        }
      } else {
        setError(result.error || 'Failed to fetch class data')
      }
    }
  }

  const handleGenerateStudentReport = async () => {
    if (!selectedStudent || !selectedSession) {
      setError('Please select both a student and session')
      return
    }

    setIsLoading(true)
    setError(null)
    const result = await generateStudentReportCard(selectedStudent, selectedSession)
    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to generate report')
      return
    }

  }

  const handleGenerateClassReport = async () => {
    if (!selectedClass || !selectedSession) {
      setError('Please select both a class and session')
      return
    }

    setIsLoading(true)
    setError(null)
    const result = await generateClassReport(selectedClass, selectedSession)
    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to generate report')
      return
    }

  }

  return (
    <div className="space-y-6">
      {/* Report Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Report Type</CardTitle>
          <CardDescription>Choose the type of report you want to generate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button
              onClick={() => setReportType('student')}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                reportType === 'student'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-gray-900">Student Report Card</p>
              <p className="text-sm text-gray-600">Individual student performance</p>
            </button>
            <button
              onClick={() => setReportType('class')}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                reportType === 'class'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-gray-900">Class Report</p>
              <p className="text-sm text-gray-600">Entire class performance</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Generation */}
      <Card>
        <CardHeader>
          <CardTitle>
            {reportType === 'student' ? 'Student Report Card' : 'Class Report'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Session Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700">Academic Session *</label>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.academic_year} • Term {session.term}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700">Class *</label>
            <Select value={selectedClass} onValueChange={handleClassChange}>
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

          {/* Student Selection (only for student report) */}
          {reportType === 'student' && classMetadata && (
            <div>
              <label className="text-sm font-medium text-gray-700">Student *</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {classMetadata.students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.user_profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Generate Button */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={reportType === 'student' ? handleGenerateStudentReport : handleGenerateClassReport}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
