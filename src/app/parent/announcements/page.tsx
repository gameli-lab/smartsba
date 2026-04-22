import { requireParent } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'
import { AnnouncementsClient } from '@/components/parent/announcements-client'
import { buildParentAnnouncementFilter, selectWard } from '../_lib/ward-selection'
import { renderNoLinkedWardsState, renderWardNotFoundState } from '../_lib/parent-states'

interface PageProps {
  searchParams: Promise<{ ward?: string }>
}

interface AnnouncementRow {
  id: string
  title: string
  content: string | null
  created_at: string
  is_urgent: boolean | null
  target_audience: string[] | null
  class_ids: string[] | null
}

export default async function ParentAnnouncementsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { user, wards } = await requireParent()

  if (wards.length === 0) {
    return renderNoLinkedWardsState()
  }

  // Get selected ward or default to primary/first
  const { selectedWard } = selectWard(wards, params.ward)

  if (!selectedWard) {
    return renderWardNotFoundState()
  }

  const student = selectedWard.student

  // Get student name
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', student.user_id)
    .maybeSingle()

  const studentName = (profileData as { full_name: string } | null)?.full_name || 'Ward'

  // Fetch announcements for parents at this school
  // Filter by: target_audience contains 'parent' OR class_ids contains ward's class
  const { data: announcementsData } = await supabase
    .from('announcements')
    .select('id, title, content, created_at, is_urgent, target_audience, class_ids')
    .eq('school_id', student.school_id)
    .or(buildParentAnnouncementFilter(student.class_id))
    .order('created_at', { ascending: false })

  const announcements = ((announcementsData || []) as AnnouncementRow[]).map((ann) => ({
    id: ann.id,
    title: ann.title,
    content: ann.content || '',
    created_at: ann.created_at,
    is_urgent: ann.is_urgent || false,
    target_audience: ann.target_audience || [],
    class_ids: ann.class_ids || [],
    scope: ((ann.class_ids && ann.class_ids.length > 0) ? 'class' : 'school') as 'class' | 'school',
  }))

  // Get class name
  const { data: classData } = await supabase
    .from('classes')
    .select('name')
    .eq('id', student.class_id)
    .maybeSingle()

  const className = (classData as { name: string } | null)?.name || null

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Announcements</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">School announcements and updates for {studentName}.</p>
      </div>

      <AnnouncementsClient
        announcements={announcements}
        wardClassName={className}
        parentUserId={user.id}
        wardId={student.id}
      />
    </div>
  )
}
