"use client"

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
}

export function AnnouncementsClient({ announcements, wardClassName }: AnnouncementsClientProps) {
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [scopeFilter, setScopeFilter] = useState<string>('all')

  const filteredAnnouncements = announcements.filter((ann) => {
    const matchesUrgency = urgencyFilter === 'all' || (urgencyFilter === 'urgent' && ann.is_urgent)
    const matchesScope = scopeFilter === 'all' || ann.scope === scopeFilter
    return matchesUrgency && matchesScope
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Announcements</CardTitle>
          <CardDescription>Filter by urgency and scope.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
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
                    <CardTitle className="text-lg">{ann.title}</CardTitle>
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
                    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                      {ann.scope === 'school' ? 'School-wide' : wardClassName || 'Class'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              {ann.content && (
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ann.content}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
