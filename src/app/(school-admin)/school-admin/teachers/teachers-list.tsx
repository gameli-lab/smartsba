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
import { Edit, Power, Trash2, Eye, ClipboardList } from 'lucide-react'
import { toggleTeacherStatus, deleteTeacher } from './actions'
import { useRouter } from 'next/navigation'
import { EditTeacherDialog } from '@/app/(school-admin)/school-admin/teachers/edit-teacher-dialog'
import Link from 'next/link'
import type { Teacher, UserProfile } from '@/types'

interface TeacherWithProfile extends Teacher {
  user_profile: UserProfile
}

interface TeachersListProps {
  teachers: TeacherWithProfile[]
}

export function TeachersList({ teachers }: TeachersListProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingTeacher, setEditingTeacher] = useState<TeacherWithProfile | null>(null)

  const handleToggleStatus = async (teacherId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} this teacher?`)) return

    setLoadingId(teacherId)
    const result = await toggleTeacherStatus(teacherId, !currentStatus)
    
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || `Failed to ${action} teacher`)
    }
    setLoadingId(null)
  }

  const handleDelete = async (teacherId: string, teacherName: string) => {
    if (!confirm(`Permanently delete ${teacherName}? This will remove the teacher from the database and cannot be undone.`)) return

    setLoadingId(teacherId)
    const result = await deleteTeacher(teacherId)
    
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || 'Failed to delete teacher')
    }
    setLoadingId(null)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Staff ID</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Specialization</TableHead>
            <TableHead>Assignments</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => (
            <TableRow key={teacher.id}>
              <TableCell className="font-medium">
                {teacher.user_profile.full_name}
                {teacher.user_profile.gender && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({teacher.user_profile.gender === 'male' ? 'M' : 'F'})
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{teacher.user_profile.staff_id}</Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {teacher.user_profile.email}
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {teacher.user_profile.phone || '—'}
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {teacher.specialization || '—'}
              </TableCell>
              <TableCell>
                <span className="text-sm font-medium text-blue-600">
                  — classes/subjects
                </span>
              </TableCell>
              <TableCell>
                {teacher.is_active ? (
                  <Badge className="bg-green-600">Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/school-admin/teachers/${teacher.id}`} className="inline-flex">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="View teacher">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingTeacher(teacher)}
                    disabled={loadingId === teacher.id}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Link href={`/school-admin/teacher-assignments?teacherId=${teacher.id}`} className="inline-flex">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Assign teacher">
                      <ClipboardList className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${
                      teacher.is_active 
                        ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' 
                        : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                    }`}
                    onClick={() => handleToggleStatus(teacher.id, teacher.is_active)}
                    disabled={loadingId === teacher.id}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(teacher.id, teacher.user_profile.full_name)}
                    disabled={loadingId === teacher.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingTeacher && (
        <EditTeacherDialog
          teacher={editingTeacher}
          open={!!editingTeacher}
          onOpenChange={(open: boolean) => !open && setEditingTeacher(null)}
        />
      )}
    </>
  )
}
