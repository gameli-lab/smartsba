'use client'

import { useState } from 'react'
import { AcademicSession } from '@/types'
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
import { CheckCircle, Edit, Trash2, Circle } from 'lucide-react'
import { setCurrentSession, deleteAcademicSession } from './actions'
import { useRouter } from 'next/navigation'
import { EditSessionDialog } from '@/app/(school-admin)/school-admin/academic-sessions/edit-session-dialog'

interface SessionsListProps {
  sessions: AcademicSession[]
}

export function SessionsList({ sessions }: SessionsListProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null)

  const handleSetCurrent = async (sessionId: string) => {
    if (!confirm('Set this session as the current active session?')) return

    setLoadingId(sessionId)
    const result = await setCurrentSession(sessionId)
    
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || 'Failed to set current session')
    }
    setLoadingId(null)
  }

  const handleDelete = async (sessionId: string, academicYear: string, term: number) => {
    if (!confirm(`Delete ${academicYear} Term ${term}? This action cannot be undone.`)) return

    setLoadingId(sessionId)
    const result = await deleteAcademicSession(sessionId)
    
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || 'Failed to delete session')
    }
    setLoadingId(null)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Academic Year</TableHead>
            <TableHead>Term</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Vacation</TableHead>
            <TableHead>Reopening</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell className="font-medium">{session.academic_year}</TableCell>
              <TableCell>
                <Badge variant="outline">Term {session.term}</Badge>
              </TableCell>
              <TableCell>{formatDate(session.start_date)}</TableCell>
              <TableCell>{formatDate(session.end_date)}</TableCell>
              <TableCell className="text-sm text-gray-600">
                {session.vacation_date ? formatDate(session.vacation_date) : '—'}
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {session.reopening_date ? formatDate(session.reopening_date) : '—'}
              </TableCell>
              <TableCell>
                {session.is_current ? (
                  <Badge className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Current
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetCurrent(session.id)}
                    disabled={loadingId === session.id}
                    className="h-7 text-xs"
                  >
                    <Circle className="h-3 w-3 mr-1" />
                    Set as Current
                  </Button>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingSession(session)}
                    disabled={loadingId === session.id}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(session.id, session.academic_year, session.term)}
                    disabled={session.is_current || loadingId === session.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingSession && (
        <EditSessionDialog
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </>
  )
}
