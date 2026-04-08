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
import { Edit, Archive, RotateCcw, Trash2 } from 'lucide-react'
import { deactivateSubject, reactivateSubject, deleteSubject } from './actions'
import { EditSubjectDialog } from './edit-subject-dialog'
import { LEVEL_GROUPS } from '@/lib/constants/level-groups'
import type { Subject, Class } from '@/types'

interface Props {
  subjects: Subject[]
  classes: Class[]
}

export function SubjectsList({ subjects, classes }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)

  const getLevelLabel = (levelGroup: string) => {
    const group = LEVEL_GROUPS[levelGroup as keyof typeof LEVEL_GROUPS]
    return group ? group.label : levelGroup
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deactivate subject "${name}"? It will be hidden from class rosters.`)) return
    setLoadingId(id)
    const result = await deactivateSubject(id)
    setLoadingId(null)
    if (!result.success) {
      alert(result.error || 'Failed to deactivate subject')
    } else {
      router.refresh()
    }
  }

  const handleReactivate = async (id: string, name: string) => {
    if (!confirm(`Reactivate subject "${name}"? It will be visible in class rosters again.`)) return
    setLoadingId(id)
    const result = await reactivateSubject(id)
    setLoadingId(null)
    if (!result.success) {
      alert(result.error || 'Failed to reactivate subject')
    } else {
      router.refresh()
    }
  }

  const handleDeletePermanent = async (id: string, name: string) => {
    if (!confirm(`Delete subject "${name}" permanently? This cannot be undone.`)) return
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
              <TableHead>Level</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((subject) => (
              <TableRow key={subject.id} className={!subject.is_active ? 'opacity-60' : ''}>
                <TableCell className="font-medium">{subject.name}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {subject.code || '—'}
                </TableCell>
                <TableCell className="text-sm">
                  <Badge variant="outline">{getLevelLabel(subject.level_group)}</Badge>
                </TableCell>
                <TableCell>
                  {subject.is_core ? (
                    <Badge className="bg-blue-600">Core</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-600">Elective</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {subject.is_active ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-600">Inactive</Badge>
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
                      title="Edit subject"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {subject.is_active ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                        onClick={() => handleDelete(subject.id, subject.name)}
                        disabled={loadingId === subject.id}
                        title="Deactivate subject"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:bg-green-50"
                        onClick={() => handleReactivate(subject.id, subject.name)}
                        disabled={loadingId === subject.id}
                        title="Reactivate subject"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-50"
                      onClick={() => handleDeletePermanent(subject.id, subject.name)}
                      disabled={loadingId === subject.id}
                      title="Delete subject permanently"
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
