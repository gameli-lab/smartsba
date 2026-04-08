'use client'

import Link from 'next/link'
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
import { Edit, Eye, Trash2 } from 'lucide-react'
import { deleteClass } from './actions'
import { EditClassDialog } from './edit-class-dialog'
import type { Class } from '@/types'

interface TeacherOption {
  id: string
  full_name: string
  staff_id: string
  is_active: boolean
}

interface ClassWithTeacher extends Class {
  class_teacher?: TeacherOption | null
  students_count?: number
  subjects_count?: number
  status?: 'active' | 'archived'
}

interface Props {
  classes: ClassWithTeacher[]
  teachers: TeacherOption[]
}

export function ClassesList({ classes, teachers }: Props) {
  const router = useRouter()
  const [editingClass, setEditingClass] = useState<ClassWithTeacher | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete class "${name}" permanently? This cannot be undone.`)) return

    setLoadingId(id)
    const result = await deleteClass(id)
    setLoadingId(null)

    if (!result.success) {
      alert(result.error || 'Failed to delete class')
      return
    }

    router.refresh()
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class Name</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Stream</TableHead>
              <TableHead>Class Teacher</TableHead>
              <TableHead>Student Count</TableHead>
              <TableHead>Subjects Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((klass) => (
              <TableRow key={klass.id}>
                <TableCell className="font-medium">
                  {klass.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{klass.level}</Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{klass.stream || '—'}</TableCell>
                <TableCell className="text-sm">
                  {klass.class_teacher ? (
                    <div>
                      <div className="font-medium">{klass.class_teacher.full_name}</div>
                      <div className="text-xs text-gray-500">{klass.class_teacher.staff_id}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400">Not assigned</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {klass.students_count ?? '—'}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {klass.subjects_count ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={klass.status === 'archived' ? 'outline' : 'secondary'}>
                    {klass.status === 'archived' ? 'Archived' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/school-admin/classes/${klass.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingClass(klass)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(klass.id, klass.name)}
                      disabled={loadingId === klass.id}
                      title="Delete class"
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

      {editingClass && (
        <EditClassDialog
          klass={editingClass}
          teachers={teachers}
          open={!!editingClass}
          onOpenChange={(open: boolean) => !open && setEditingClass(null)}
        />
      )}
    </>
  )
}
