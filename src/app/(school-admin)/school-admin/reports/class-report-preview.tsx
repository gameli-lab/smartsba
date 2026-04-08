'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, X } from 'lucide-react'
import type { ClassReportData } from '@/types'

interface Props {
  report: ClassReportData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClassReportPreview({ report, open, onOpenChange }: Props) {
  if (!report) return null

  const { class: klass, session, students, subjects } = report

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-600'
      case 'B':
        return 'bg-blue-600'
      case 'C':
        return 'bg-yellow-600'
      case 'D':
        return 'bg-orange-600'
      case 'E':
        return 'bg-red-600'
      case 'F':
        return 'bg-red-800'
      default:
        return 'bg-gray-600'
    }
  }

  const sortedStudents = [...students].sort((a, b) => {
    const aTotal = a.totals.total_score || 0
    const bTotal = b.totals.total_score || 0
    return bTotal - aTotal
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Class Report</DialogTitle>
            <DialogDescription>
              {klass.name} • {session.academic_year} Term {session.term}
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Class Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600">Total Students</p>
              <p className="text-3xl font-bold text-blue-900">{students.length}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-600">Total Subjects</p>
              <p className="text-3xl font-bold text-purple-900">{subjects.length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600">Average Score</p>
              <p className="text-3xl font-bold text-green-900">
                {(
                  students.reduce((sum, s) => sum + (s.totals.total_score || 0), 0) / students.length
                ).toFixed(1)}
              </p>
            </div>
          </div>

          {/* Students Performance Table */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Student Performance Ranking</h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Rank</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Admission</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Average</th>
                    <th className="px-4 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student, index) => {
                    const avgGrade = student.scores.length > 0
                      ? student.scores.reduce((sum, s) => {
                          const g = s.grade || ''
                          const val = g.charCodeAt(0) - 64 // A=1, B=2, etc
                          return sum + val
                        }, 0) / student.scores.length
                      : 0
                    const topGrade = Math.round(avgGrade)
                    const gradeChars = ['', 'A', 'B', 'C', 'D', 'E', 'F']
                    const estimatedGrade = gradeChars[Math.min(topGrade, 6)] || 'F'

                    return (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-bold text-gray-900">#{index + 1}</td>
                        <td className="px-4 py-2 font-medium">{student.user_profile.full_name}</td>
                        <td className="px-4 py-2 text-gray-600">{student.admission_number}</td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {student.totals.total_score}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {student.totals.average.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge className={`${getGradeColor(estimatedGrade)}`}>
                            {estimatedGrade}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subject Performance */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Subject Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((subject) => {
                const subjectScores = students
                  .flatMap((s) => s.scores)
                  .filter((sc) => sc.subject_id === subject.id)

                const avgScore =
                  subjectScores.length > 0
                    ? subjectScores.reduce((sum, s) => sum + (s.total_score || 0), 0) /
                      subjectScores.length
                    : 0

                return (
                  <div key={subject.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{subject.name}</p>
                        <p className="text-xs text-gray-600">{subject.code || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{avgScore.toFixed(1)}</p>
                        <p className="text-xs text-gray-600">avg</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Download Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
