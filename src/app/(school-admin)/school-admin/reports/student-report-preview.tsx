'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Download, X } from 'lucide-react'
import type { ReportCardData } from '@/types'

interface Props {
  report: ReportCardData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentReportPreview({ report, open, onOpenChange }: Props) {
  if (!report) return null

  const { student, class: klass, session, scores, totals, class_teacher_remark } = report

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A':
        return 'text-green-700 bg-green-50'
      case 'B':
        return 'text-blue-700 bg-blue-50'
      case 'C':
        return 'text-yellow-700 bg-yellow-50'
      case 'D':
        return 'text-orange-700 bg-orange-50'
      case 'E':
        return 'text-red-700 bg-red-50'
      case 'F':
        return 'text-red-900 bg-red-100'
      default:
        return 'text-gray-700 bg-gray-50'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Report Card</DialogTitle>
            <DialogDescription>
              {student.user_profile.full_name} • {klass.name}
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600">Full Name</p>
              <p className="font-semibold text-gray-900">{student.user_profile.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Admission Number</p>
              <p className="font-semibold text-gray-900">{student.admission_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Class</p>
              <p className="font-semibold text-gray-900">
                {klass.name} (Level {klass.level})
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Session</p>
              <p className="font-semibold text-gray-900">
                {session.academic_year} • Term {session.term}
              </p>
            </div>
          </div>

          {/* Scores Table */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Scores by Subject</h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Subject</th>
                    <th className="px-4 py-2 text-right">CA (40)</th>
                    <th className="px-4 py-2 text-right">Exam (60)</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-center">Grade</th>
                    <th className="px-4 py-2 text-left">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score) => (
                    <tr key={score.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{score.subject.name}</td>
                      <td className="px-4 py-2 text-right">{score.ca_score ?? '—'}</td>
                      <td className="px-4 py-2 text-right">{score.exam_score ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {score.total_score ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {score.grade ? (
                          <Badge className={`${getGradeColor(score.grade)}`}>
                            {score.grade}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">{score.subject_remark || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600">Total CA</p>
              <p className="text-xl font-bold text-blue-900">{totals.total_ca}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-600">Total Exam</p>
              <p className="text-xl font-bold text-purple-900">{totals.total_exam}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600">Grand Total</p>
              <p className="text-xl font-bold text-green-900">{totals.grand_total}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-xs text-orange-600">Average</p>
              <p className="text-xl font-bold text-orange-900">{totals.average.toFixed(2)}</p>
            </div>
          </div>

          {/* Class Teacher Remark */}
          {class_teacher_remark && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-2">Class Teacher's Remark</h3>
              <p className="text-amber-800">{class_teacher_remark.remark}</p>
              {class_teacher_remark.promotion_status && (
                <p className="text-xs text-amber-700 mt-2">
                  <strong>Promotion Status:</strong> {class_teacher_remark.promotion_status}
                </p>
              )}
            </div>
          )}

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
