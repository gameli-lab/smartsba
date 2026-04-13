'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { Edit, Eye, Power, Trash2 } from 'lucide-react'
import { toggleStudentStatus, deleteStudent } from './actions'
import { EditStudentDialog } from '@/app/(school-admin)/school-admin/students/edit-student-dialog'
import type { Student, UserProfile, Class } from '@/types'

interface StudentRow extends Student {
  user_profile: UserProfile | null
  classes: Class | null
}

interface Props {
  students: StudentRow[]
  classes: Class[]
}

export function StudentsList({ students, classes }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null)

  const handleToggle = async (id: string, current: boolean) => {
    const action = current ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} this student?`)) return
    setLoadingId(id)
    const result = await toggleStudentStatus(id, !current)
    setLoadingId(null)
    if (!result.success) {
      alert(result.error || `Failed to ${action} student`)
    } else {
      router.refresh()
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete ${name}? This will remove the student from the database and cannot be undone.`)) return
    setLoadingId(id)
    const result = await deleteStudent(id)
    setLoadingId(null)
    if (!result.success) {
      alert(result.error || 'Failed to delete student')
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Admission #</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Guardian</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">
                  {student.user_profile?.full_name || 'Unnamed student'}
                  <div className="text-xs text-gray-500">{student.user_profile?.email || 'No email available'}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{student.admission_number}</Badge>
                </TableCell>
                <TableCell>
                  {student.classes ? (
                    <>
                      <div className="font-medium">{student.classes.name}</div>
                      <div className="text-xs text-gray-500">Level {student.classes.level}{student.classes.stream ? ` • ${student.classes.stream}` : ''}</div>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {student.gender === 'male' ? 'Male' : 'Female'}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {student.guardian_name || '—'}
                  {student.guardian_phone && (
                    <div className="text-xs text-gray-500">{student.guardian_phone}</div>
                  )}
                </TableCell>
                <TableCell>
                  {student.is_active ? (
                    <Badge className="bg-green-600">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/school-admin/students/${student.id}`} className="inline-flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="View profile"
                      >
                        <span className="sr-only">View</span>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingStudent(student)}
                      disabled={loadingId === student.id || !student.user_profile}
                      title={student.user_profile ? 'Edit student' : 'Student profile data is missing'}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${student.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                      onClick={() => handleToggle(student.id, student.is_active)}
                      disabled={loadingId === student.id}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(student.id, student.user_profile?.full_name || student.admission_number)}
                      disabled={loadingId === student.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingStudent && (
        <EditStudentDialog
          student={editingStudent}
          classes={classes}
          open={!!editingStudent}
          onOpenChange={(open: boolean) => !open && setEditingStudent(null)}
        />
      )}
    </>
  )
}
