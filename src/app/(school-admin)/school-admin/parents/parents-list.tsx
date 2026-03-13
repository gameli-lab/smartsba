'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Power, Unlink } from 'lucide-react'
import { toggleParentStatus, unlinkParentFromWard } from './actions'

interface WardLink {
  linkId: string
  studentId: string
  studentName: string
  admissionNumber: string
  relationship: string
}

interface ParentRow {
  id: string
  full_name: string
  email: string
  status: 'active' | 'disabled'
  phone: string | null
  links: WardLink[]
}

interface Props {
  parents: ParentRow[]
}

export function ParentsList({ parents }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const onToggleStatus = async (parentId: string, nextStatus: 'active' | 'disabled') => {
    setLoadingId(parentId)
    const result = await toggleParentStatus(parentId, nextStatus)
    setLoadingId(null)
    if (!result.success) {
      alert(result.error || 'Failed to update status')
      return
    }
    router.refresh()
  }

  const onUnlink = async (linkId: string, studentName: string) => {
    if (!confirm(`Unlink this parent from ${studentName}?`)) return
    setLoadingId(linkId)
    const result = await unlinkParentFromWard(linkId)
    setLoadingId(null)
    if (!result.success) {
      alert(result.error || 'Failed to unlink ward')
      return
    }
    router.refresh()
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parent</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Linked Wards</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parents.map((parent) => (
            <TableRow key={parent.id}>
              <TableCell>
                <div className="font-medium">{parent.full_name}</div>
                <div className="text-xs text-gray-500">{parent.email}</div>
              </TableCell>
              <TableCell className="text-sm text-gray-600">{parent.phone || '—'}</TableCell>
              <TableCell>
                {parent.links.length === 0 ? (
                  <span className="text-sm text-gray-500">No wards linked</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {parent.links.map((link) => (
                      <span key={link.linkId} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                        {link.studentName} ({link.admissionNumber})
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => onUnlink(link.linkId, link.studentName)}
                          disabled={loadingId === link.linkId}
                          title="Unlink ward"
                        >
                          <Unlink className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {parent.status === 'active' ? (
                  <Badge className="bg-green-600">Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-500">Disabled</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${parent.status === 'active' ? 'text-orange-600' : 'text-green-600'}`}
                  onClick={() => onToggleStatus(parent.id, parent.status === 'active' ? 'disabled' : 'active')}
                  disabled={loadingId === parent.id}
                >
                  <Power className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
