'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, ChevronRight, Eye, Mail } from 'lucide-react'
import type { EmailLog } from './actions'
import EmailLogDialog from './EmailLogDialog'

interface EmailLogsTableProps {
  logs: EmailLog[]
  count: number
  nextCursor: string | null
}

export default function EmailLogsTable({ logs, count, nextCursor }: EmailLogsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(window.location.search)
    if (search) {
      params.set('search', search)
    } else {
      params.delete('search')
    }
    params.delete('cursor')
    router.push(`?${params.toString()}`)
  }

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search)
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('cursor')
    router.push(`?${params.toString()}`)
  }

  const handleLoadMore = () => {
    const params = new URLSearchParams(window.location.search)
    if (nextCursor) {
      params.set('cursor', nextCursor)
      router.push(`?${params.toString()}`)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      sent: 'default',
      pending: 'secondary',
      failed: 'destructive',
      bounced: 'destructive',
    }
    
    const colors: Record<string, string> = {
      sent: 'bg-green-100 text-green-800 hover:bg-green-100',
      pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
      failed: 'bg-red-100 text-red-800 hover:bg-red-100',
      bounced: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    }

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  const getEmailTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      school_created: 'School Created',
      user_created: 'User Created',
      role_changed: 'Role Changed',
      school_status_changed: 'Status Changed',
    }

    return (
      <Badge variant="outline">
        {labels[type] || type}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Delivery Logs</CardTitle>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          <div className="flex gap-2">
            <Select
              defaultValue="all"
              onValueChange={(value) => handleFilterChange('type', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Email Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="school_created">School Created</SelectItem>
                <SelectItem value="user_created">User Created</SelectItem>
                <SelectItem value="role_changed">Role Changed</SelectItem>
                <SelectItem value="school_status_changed">Status Changed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              defaultValue="all"
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No email logs found</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.recipient_email}
                      </TableCell>
                      <TableCell>
                        {getEmailTypeBadge(log.email_type)}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {log.subject}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.sent_at ? formatDate(log.sent_at) : formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {logs.length} of {count} email logs
              </p>

              {nextCursor && (
                <Button onClick={handleLoadMore} variant="outline">
                  Load More
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>

      {selectedLog && (
        <EmailLogDialog
          log={selectedLog}
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </Card>
  )
}
