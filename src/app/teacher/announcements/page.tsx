import { requireTeacher } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from './actions'

interface AnnouncementRow {
  id: string
  title: string
  content: string
  is_urgent: boolean | null
  class_ids: string[] | null
  created_at: string
  created_by: string
}

const createAnnouncementAction = async (formData: FormData) => {
  'use server'
  await createAnnouncement(formData)
}

const updateAnnouncementAction = async (formData: FormData) => {
  'use server'
  await updateAnnouncement(formData)
}

const deleteAnnouncementAction = async (formData: FormData) => {
  'use server'
  await deleteAnnouncement(formData)
}

export default async function TeacherAnnouncementsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { assignments, effectiveRole, profile } = await requireTeacher()

  const classIds = Array.from(new Set(assignments.map((a) => a.class_id).filter(Boolean)))
  const isClassTeacherForAny = assignments.some((a) => a.is_class_teacher)

  const filterClassId = (typeof searchParams.classId === 'string' && searchParams.classId) || classIds[0] || null

  const orFilter = filterClassId
    ? `class_ids.is.null,class_ids.cs.{${filterClassId}}`
    : 'class_ids.is.null'

  const { data: announcementsData } = await supabase
    .from('announcements')
    .select('id, title, content, is_urgent, class_ids, created_at, created_by')
    .eq('school_id', profile.school_id)
    .or(orFilter)
    .order('created_at', { ascending: false })

  const announcements = (announcementsData || []) as AnnouncementRow[]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-600">Class teachers can post to their class and parents; subject teachers can view.</p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      {isClassTeacherForAny ? (
        <Card>
          <CardHeader>
            <CardTitle>New Announcement</CardTitle>
            <CardDescription>Send to one of your classes (students and parents).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAnnouncementAction} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Class</label>
                <select name="classId" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={filterClassId || classIds[0]}>
                  {classIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Title</label>
                <Input name="title" placeholder="Exam schedule update" required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Content</label>
                <Textarea name="content" rows={3} placeholder="Share details for students and parents" required />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="is_urgent" />
                Mark as urgent
              </label>
              <Button type="submit">Post Announcement</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-gray-600">
            Subject teachers can view announcements only.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>Latest announcements for your classes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {announcements.length === 0 ? (
            <p className="text-sm text-gray-500">No announcements yet.</p>
          ) : (
            announcements.map((ann) => {
              const isAuthor = ann.created_by === profile.user_id
              return (
                <div key={ann.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{ann.title}</p>
                        {ann.is_urgent && (
                          <Badge variant="destructive">Urgent</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{new Date(ann.created_at).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Class targets: {(ann.class_ids || ['All']).join(', ')}</p>
                    </div>
                    {isAuthor && (
                      <form action={deleteAnnouncementAction}>
                        <input type="hidden" name="id" value={ann.id} />
                        <Button type="submit" variant="ghost" className="text-red-600">Delete</Button>
                      </form>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ann.content}</p>
                  {isAuthor && (
                    <details className="text-sm text-gray-700">
                      <summary className="cursor-pointer text-gray-600">Edit</summary>
                      <form action={updateAnnouncementAction} className="mt-2 space-y-2">
                        <input type="hidden" name="id" value={ann.id} />
                        <Input name="title" defaultValue={ann.title} required />
                        <Textarea name="content" rows={3} defaultValue={ann.content} required />
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" name="is_urgent" defaultChecked={!!ann.is_urgent} />
                          Mark as urgent
                        </label>
                        <Button type="submit" variant="outline">Save</Button>
                      </form>
                    </details>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
