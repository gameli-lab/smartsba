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
import { deleteSubject } from './actions'
import { EditSubjectDialog } from './edit-subject-dialog'
import type { Subject, Class } from '@/types'

interface Props {
  subjects: Subject[]
  classes: Class[]
}

export function SubjectsList({ subjects, classes }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)

  const getClassName = (classId: string) => {
    return classes.find((c) => c.id === classId)?.name || 'Unknown'
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete subject "${name}"? Remove teacher assignments first.`)) return
    setLoadingId(id)
    const result = await deleteSubject(id)
    setLoadingId(null)
    if (!result.success) {
      alert(result.error || 'Failed to delete subject')
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
              <TableHead>Code</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((subject) => (
              <TableRow key={subject.id}>
                <TableCell className="font-medium">{subject.name}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {subject.code || '—'}
                </TableCell>
                <TableCell className="text-sm">
                  <Badge variant="outline">{getClassName(subject.class_id)}</Badge>
                </TableCell>
                <TableCell>
                  {subject.is_core ? (
                    <Badge className="bg-blue-600">Core</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-600">Elective</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                  {subject.description || '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingSubject(subject)}
                      disabled={loadingId === subject.id}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(subject.id, subject.name)}
                      disabled={loadingId === subject.id}
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

      {editingSubject && (
        <EditSubjectDialog
          subject={editingSubject}
          classes={classes}
          open={!!editingSubject}
          onOpenChange={(open: boolean) => !open && setEditingSubject(null)}
        />
      )}
    </>
  )
}
