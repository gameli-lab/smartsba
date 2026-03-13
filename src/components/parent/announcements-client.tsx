"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Announcement {
  id: string
  title: string
  content: string
  created_at: string
  is_urgent: boolean
  target_audience: string[]
  class_ids: string[]
  scope: 'school' | 'class'
}

interface AnnouncementsClientProps {
  announcements: Announcement[]
  wardClassName: string | null
  parentUserId: string
  wardId: string
}

export function AnnouncementsClient({ announcements, wardClassName, parentUserId, wardId }: AnnouncementsClientProps) {
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [readFilter, setReadFilter] = useState<string>('all')
  const [readIds, setReadIds] = useState<string[]>([])

  const storageKey = useMemo(() => `parent-ann-read:${parentUserId}:${wardId}`, [parentUserId, wardId])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        setReadIds([])
        return
      }
      const parsed = JSON.parse(raw)
      setReadIds(Array.isArray(parsed) ? parsed : [])
    } catch {
      setReadIds([])
    }
  }, [storageKey])

  const persistReadIds = (ids: string[]) => {
    setReadIds(ids)
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(ids))
    } catch {
      // Ignore localStorage write errors
    }
  }

  const isRead = (announcementId: string) => readIds.includes(announcementId)

  const toggleRead = (announcementId: string) => {
    if (isRead(announcementId)) {
      persistReadIds(readIds.filter((id) => id !== announcementId))
      return
    }
    persistReadIds([...readIds, announcementId])
  }

  const markAllAsRead = () => {
    persistReadIds(announcements.map((a) => a.id))
  }

  const filteredAnnouncements = announcements.filter((ann) => {
    const matchesUrgency = urgencyFilter === 'all' || (urgencyFilter === 'urgent' && ann.is_urgent)
    const matchesScope = scopeFilter === 'all' || ann.scope === scopeFilter
    const read = isRead(ann.id)
    const matchesRead =
      readFilter === 'all' ||
      (readFilter === 'read' && read) ||
      (readFilter === 'unread' && !read)
    return matchesUrgency && matchesScope && matchesRead
  })

  const unreadCount = announcements.filter((a) => !isRead(a.id)).length

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Filter Announcements</CardTitle>
              <CardDescription>Filter by urgency, scope and read status.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                Unread: {unreadCount}
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                Mark all as read
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">Urgency</label>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="urgent">Urgent Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">Scope</label>
            <Select value={scopeFilter} onValueChange={setScopeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="school">School-wide</SelectItem>
                <SelectItem value="class">Class-specific</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">Read status</label>
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select read status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread only</SelectItem>
                <SelectItem value="read">Read only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Announcements List */}
      {filteredAnnouncements.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No announcements found for the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((ann) => (
            <Card key={ann.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {ann.title}
                      {!isRead(ann.id) && <span className="inline-block h-2 w-2 rounded-full bg-purple-600" aria-label="Unread announcement" />}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {new Date(ann.created_at).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {ann.is_urgent && (
                      <Badge variant="destructive">Urgent</Badge>
                    )}
                    <Badge variant={isRead(ann.id) ? 'secondary' : 'default'}>
                      {isRead(ann.id) ? 'Read' : 'Unread'}
                    </Badge>
                    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                      {ann.scope === 'school' ? 'School-wide' : wardClassName || 'Class'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              {ann.content && (
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ann.content}</p>
                  <div className="mt-4">
                    <Button type="button" size="sm" variant="outline" onClick={() => toggleRead(ann.id)}>
                      {isRead(ann.id) ? 'Mark as unread' : 'Mark as read'}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
