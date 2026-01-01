import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { AnnouncementsClient } from './announcements-client'
import { Announcement, Class } from '@/types'

export default async function AnnouncementsPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  const [{ data: announcementRows }, { data: classRows }] = await Promise.all([
    supabase
      .from('announcements')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
    supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
  ])

  const announcements = (announcementRows as Announcement[] | null) || []
  const classes = (classRows as Pick<Class, 'id' | 'name'>[] | null) || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
        <p className="text-gray-600">Create, edit, and archive announcements for your school.</p>
      </div>

      <AnnouncementsClient initialAnnouncements={announcements} classes={classes} />
    </div>
  )
}
