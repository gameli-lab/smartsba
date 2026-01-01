'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Edit, Trash2 } from 'lucide-react'
import { deleteScore } from './actions'
import { EditScoreDialog } from './edit-score-dialog'
import { CreateScoreDialog } from './create-score-dialog'
import type { Score } from '@/types'

interface StudentSubjectScore {
  student_id: string
  student_name: string
  subject_id: string
  subject_name: string
  scores: Score[]
}

interface Props {
  studentScores: StudentSubjectScore[]
  sessionId: string
}

export function ScoresTable({ studentScores, sessionId }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingScore, setEditingScore] = useState<Score | null>(null)
  const [editingStudent, setEditingStudent] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this score?')) return
    setLoadingId(id)
    const result = await deleteScore(id)
    setLoadingId(null)
    if (!result.success) {
      alert(result.error || 'Failed to delete score')
    } else {
      router.refresh()
    }
  }

  const getGradeBadgeColor = (grade?: string) => {
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

  return (
    <>
      <div className="space-y-6">
        {studentScores.map((ss) => (
          <div key={ss.student_id} className="border rounded-lg p-4">
            <div className="font-semibold text-gray-900 mb-3">{ss.student_name}</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">CA (40)</TableHead>
                    <TableHead className="text-right">Exam (60)</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead>Remark</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ss.scores.map((score) => (
                    <TableRow key={score.id}>
                      <TableCell className="font-medium">{score.subject_id}</TableCell>
                      <TableCell className="text-right">{score.ca_score ?? '—'}</TableCell>
                      <TableCell className="text-right">{score.exam_score ?? '—'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {score.total_score ?? '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {score.grade ? (
                          <Badge className={`${getGradeBadgeColor(score.grade)}`}>
                            {score.grade}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                        {score.subject_remark || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingScore(score)
                              setEditingStudent(ss.student_name)
                            }}
                            disabled={loadingId === score.id}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(score.id)}
                            disabled={loadingId === score.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={7} className="text-right pr-4">
                      <CreateScoreDialog
                        studentId={ss.student_id}
                        studentName={ss.student_name}
                        subjectId={ss.subject_id}
                        subjectName={ss.subject_name}
                        sessionId={sessionId}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>

      {editingScore && editingStudent && (
        <EditScoreDialog
          score={editingScore}
          studentName={editingStudent}
          subjectName=""
          open={!!editingScore}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setEditingScore(null)
              setEditingStudent(null)
            }
          }}
        />
      )}
    </>
  )
}
