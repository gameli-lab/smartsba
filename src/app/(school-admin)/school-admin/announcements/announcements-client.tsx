'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
// Using checkbox instead of switch to avoid missing dependency
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createAnnouncement, updateAnnouncement, archiveAnnouncement } from './actions'
import type { Announcement, Class } from '@/types'
import { Loader2, Edit, Archive, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Props {
  initialAnnouncements: Announcement[]
  classes: Pick<Class, 'id' | 'name'>[]
}

type Scope = 'school-wide' | 'class' | 'parents'

interface FormState {
  id?: string
  title: string
  content: string
  scope: Scope
  class_ids: string[]
  is_urgent: boolean
  expires_at: string | null
}

const defaultForm: FormState = {
  title: '',
  content: '',
  scope: 'school-wide',
  class_ids: [],
  is_urgent: false,
  expires_at: null,
}

export function AnnouncementsClient({ initialAnnouncements, classes }: Props) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEdit = Boolean(form.id)

  const handleSubmit = () => {
    setError(null)
    setSuccess(null)

    const payload = {
      title: form.title,
      content: form.content,
      scope: form.scope,
      class_ids: form.scope === 'class' ? form.class_ids : [],
      is_urgent: form.is_urgent,
      expires_at: form.expires_at || null,
    }

    const action = isEdit ? updateAnnouncement(form.id!, payload) : createAnnouncement(payload)

    startTransition(async () => {
      const result = await action
      if (!result.success) {
        setError(result.error || 'Failed to save')
        return
      }
      setSuccess(isEdit ? 'Announcement updated' : 'Announcement created')
      // Refresh list from server? For now optimistic fetch
      // TODO: fetch again if needed; simple client-side append/update for UX
      setForm(defaultForm)
      setTimeout(() => setSuccess(null), 2500)
      window.location.reload()
    })
  }

  const handleEdit = (item: Announcement) => {
    const scope: Scope = item.target_audience.length === 1 && item.target_audience[0] === 'parent'
      ? 'parents'
      : (item.class_ids && item.class_ids.length ? 'class' : 'school-wide')

    setForm({
      id: item.id,
      title: item.title,
      content: item.content,
      scope,
      class_ids: item.class_ids || [],
      is_urgent: item.is_urgent,
      expires_at: item.expires_at ? item.expires_at.slice(0, 16) : null,
    })
    setSuccess(null)
    setError(null)
  }

  const handleArchive = (id: string) => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await archiveAnnouncement(id)
      if (!result.success) {
        setError(result.error || 'Failed to archive')
        return
      }
      setSuccess('Announcement archived')
      window.location.reload()
    })
  }

  const activeAnnouncements = useMemo(
    () => announcements.filter((a) => !a.expires_at || new Date(a.expires_at) > new Date()),
    [announcements]
  )
  const archivedAnnouncements = useMemo(
    () => announcements.filter((a) => a.expires_at && new Date(a.expires_at) <= new Date()),
    [announcements]
  )

  const scopeLabel = (a: Announcement) => {
    if (a.target_audience.length === 1 && a.target_audience[0] === 'parent') return 'Parents-only'
    if (a.class_ids && a.class_ids.length) return 'Class-specific'
    return 'School-wide'
  }

  const resetForm = () => {
    setForm(defaultForm)
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit Announcement' : 'Create Announcement'}</CardTitle>
          <CardDescription>School-wide, class-specific, or parents-only announcements.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Enter announcement title"
              />
            </div>

            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={form.scope}
                onValueChange={(v: Scope) => setForm((f) => ({ ...f, scope: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="school-wide">School-wide</SelectItem>
                  <SelectItem value="class">Class-specific</SelectItem>
                  <SelectItem value="parents">Parents-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.scope === 'class' && (
            <div className="space-y-2">
              <Label>Target Classes</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {classes.map((c) => {
                  const checked = form.class_ids.includes(c.id)
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 border rounded px-2 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setForm((f) => {
                            const next = new Set(f.class_ids)
                            if (e.target.checked) next.add(c.id)
                            else next.delete(c.id)
                            return { ...f, class_ids: Array.from(next) }
                          })
                        }}
                      />
                      <span>{c.name}</span>
                    </label>
                  )
                })}
              </div>
              {form.class_ids.length === 0 && <p className="text-xs text-gray-500">Select at least one class.</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={6}
              placeholder="Write the announcement details"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between border rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">Mark as urgent</p>
                <p className="text-xs text-gray-500">Highlights to recipients</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.is_urgent}
                onChange={(e) => setForm((f) => ({ ...f, is_urgent: e.target.checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires_at">Expires At (optional)</Label>
              <Input
                id="expires_at"
                type="datetime-local"
                value={form.expires_at || ''}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value || null }))}
              />
            </div>

            <div className="flex items-end justify-end gap-2">
              {isEdit && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
              <Button type="button" onClick={handleSubmit} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </CardContent>
      </Card>

      {/* Active announcements */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Active Announcements</h2>
          <Badge variant="secondary">{activeAnnouncements.length}</Badge>
        </div>
        {activeAnnouncements.length === 0 ? (
          <p className="text-sm text-gray-500">No active announcements.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAnnouncements.map((a) => (
              <Card key={a.id}>
                <CardHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{a.title}</CardTitle>
                      <CardDescription>{scopeLabel(a)}</CardDescription>
                    </div>
                    {a.is_urgent && <Badge className="bg-red-600">Urgent</Badge>}
                  </div>
                  <p className="text-xs text-gray-500">Published {a.published_at ? formatDate(a.published_at) : 'Not set'}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{a.content}</p>
                  {a.class_ids && a.class_ids.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {a.class_ids.map((cid) => (
                        <Badge key={cid} variant="outline">Class ID: {cid}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(a)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleArchive(a.id)}>
                      <Archive className="h-4 w-4 mr-1" /> Archive
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Archived announcements */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Archived</h2>
          <Badge variant="secondary">{archivedAnnouncements.length}</Badge>
        </div>
        {archivedAnnouncements.length === 0 ? (
          <p className="text-sm text-gray-500">No archived announcements.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {archivedAnnouncements.map((a) => (
              <Card key={a.id} className="border-dashed">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">{a.title}</CardTitle>
                  <CardDescription>Archived {a.expires_at ? formatDate(a.expires_at) : ''}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.content}</p>
                  <Badge variant="outline">{scopeLabel(a)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
