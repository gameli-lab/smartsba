'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { setUserStatus, resetUserPassword } from './actions'
import { formatDate } from '@/lib/utils'

interface UserRow {
  id: string
  user_id: string
  full_name: string
  email: string
  role: string
  status?: 'active' | 'disabled' | null
}

interface LoginEvent {
  id: string
  actor_user_id: string
  action: string
  created_at: string
}

interface Props {
  users: UserRow[]
  loginActivity: LoginEvent[]
}

export function SecurityClient({ users, loginActivity }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleStatus = (id: string, status: 'active' | 'disabled') => {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await setUserStatus(id, status)
      if (!result.success) {
        setError(result.error || 'Failed to update status')
        return
      }
      setMessage('User status updated')
      window.location.reload()
    })
  }

  const handleReset = (id: string) => {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await resetUserPassword(id)
      if (!result.success) {
        setError(result.error || 'Failed to reset password')
        return
      }
      setMessage('Password reset initiated')
    })
  }

  const statusBadge = (status?: string | null) => {
    if (status === 'disabled') return <Badge className="bg-red-600">Disabled</Badge>
    return <Badge className="bg-green-600">Active</Badge>
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Security & Access</CardTitle>
          <CardDescription>Activate/deactivate users and reset passwords.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="capitalize">{u.role.replace('_', ' ')}</TableCell>
                    <TableCell>{statusBadge(u.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {u.status === 'disabled' ? (
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleStatus(u.id, 'active')}>
                          Activate
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleStatus(u.id, 'disabled')}>
                          Deactivate
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleReset(u.id)}>
                        Reset Password
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login Activity (basic)</CardTitle>
          <CardDescription>Recent audit log entries by users. TODO: replace with dedicated login tracking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loginActivity.length === 0 ? (
            <p className="text-sm text-gray-500">No activity recorded.</p>
          ) : (
            <div className="space-y-2">
              {loginActivity.map((log) => (
                <div key={log.id} className="rounded border bg-white p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">{log.action}</span>
                    <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500">User ID: {log.actor_user_id}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
