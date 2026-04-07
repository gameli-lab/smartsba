'use client'

import { useState } from 'react'
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
import { Edit } from 'lucide-react'
import { PromotionRemarkDialog } from './promotion-remark-dialog'

interface StudentRow {
  id: string
  full_name: string
  admission_number: string
  rank: number
  total_score: number
  avg_score: number
  promotion_status: string | null
  promotion_remark: string | null
}

interface NextClass {
  id: string
  name: string
  level: number
  stream?: string
}

interface Props {
  students: StudentRow[]
  nextClasses: NextClass[]
}

export function PromotionList({ students, nextClasses }: Props) {
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null)

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'promoted':
        return <Badge className="bg-green-600">Promoted</Badge>
      case 'repeated':
        return <Badge className="bg-orange-600">Repeated</Badge>
      case 'withdrawn':
        return <Badge className="bg-red-600">Withdrawn</Badge>
      default:
        return <Badge variant="outline" className="text-gray-600">Pending</Badge>
    }
  }

  return (
    <>
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-center">Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Admission #</TableHead>
              <TableHead className="text-right">Total Score</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-left">Remark</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id} className={student.promotion_status === 'promoted' ? 'bg-green-50' : ''}>
                <TableCell className="text-center font-bold text-gray-900">
                  #{student.rank}
                </TableCell>
                <TableCell className="font-medium">{student.full_name}</TableCell>
                <TableCell className="text-sm text-gray-600">{student.admission_number}</TableCell>
                <TableCell className="text-right font-semibold">{student.total_score}</TableCell>
                <TableCell className="text-right">{student.avg_score.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(student.promotion_status)}
                </TableCell>
                <TableCell className="text-xs text-gray-600 max-w-xs truncate">
                  {student.promotion_remark || '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingStudent(student)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingStudent && (
        <PromotionRemarkDialog
          student={editingStudent}
          nextClasses={nextClasses}
          open={!!editingStudent}
          onOpenChange={(open: boolean) => !open && setEditingStudent(null)}
        />
      )}
    </>
  )
}
