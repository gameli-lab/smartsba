import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requireStudentWithAutoInit, renderStudentProfileError } from '../utils'

export default async function StudentAnnouncementsPage() {
  const guardResult = await requireStudentWithAutoInit()

  if (!guardResult.success) {
    return renderStudentProfileError(guardResult.error!)
  }

  const { student, profile } = guardResult.guard!

  // Fetch announcements targeted to students
  // Include both school-wide and class-specific announcements
  const { data: announcementsData } = await supabase
    .from('announcements')
    .select('id, title, content, created_at, published_at, expires_at, is_urgent, target_audience, class_ids')
    .eq('school_id', profile.school_id)
    .or(`target_audience.cs.{student},class_ids.cs.{${student.class_id}}`)
    .order('created_at', { ascending: false })

  const announcements = (announcementsData || []) as Array<{
    id: string
    title: string
    content: string | null
    created_at: string
    published_at: string | null
    expires_at: string | null
    is_urgent: boolean | null
    target_audience: string[] | null
    class_ids: string[] | null
  }>

  // Filter announcements based on publication status and expiry
  const now = new Date()
  const activeAnnouncements = announcements.filter((ann) => {
    // Check if published
    if (ann.published_at && new Date(ann.published_at) > now) {
      return false
    }
    // Check if expired
    if (ann.expires_at && new Date(ann.expires_at) < now) {
      return false
    }
    return true
  })

  // Separate urgent and regular announcements
  const urgentAnnouncements = activeAnnouncements.filter((ann) => ann.is_urgent)
  const regularAnnouncements = activeAnnouncements.filter((ann) => !ann.is_urgent)

  const isClassSpecific = (ann: typeof announcements[0]) => {
    return ann.class_ids && ann.class_ids.length > 0 && ann.class_ids.includes(student.class_id || '')
  }

  const AnnouncementCard = ({ announcement }: { announcement: typeof announcements[0] }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg">{announcement.title}</CardTitle>
            <CardDescription className="mt-1">
              {new Date(announcement.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2">
            {announcement.is_urgent && (
              <Badge variant="destructive" className="whitespace-nowrap">
                Urgent
              </Badge>
            )}
            {isClassSpecific(announcement) ? (
              <Badge variant="secondary" className="whitespace-nowrap">
                Class-specific
              </Badge>
            ) : (
              <Badge variant="outline" className="whitespace-nowrap">
                School-wide
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {announcement.content && (
        <CardContent>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{announcement.content}</p>
          {announcement.expires_at && (
            <p className="mt-4 text-xs text-gray-500">
              Expires: {new Date(announcement.expires_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Announcements</h1>
        <p className="text-sm text-gray-600">Stay updated with school-wide and class-specific announcements.</p>
      </div>

      {activeAnnouncements.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No announcements available at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {urgentAnnouncements.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Urgent</Badge>
                <h2 className="text-lg font-semibold text-gray-900">Urgent Announcements</h2>
              </div>
              <div className="space-y-4">
                {urgentAnnouncements.map((announcement) => (
                  <AnnouncementCard key={announcement.id} announcement={announcement} />
                ))}
              </div>
            </div>
          )}

          {regularAnnouncements.length > 0 && (
            <div className="space-y-4">
              {urgentAnnouncements.length > 0 && (
                <h2 className="text-lg font-semibold text-gray-900">General Announcements</h2>
              )}
              <div className="space-y-4">
                {regularAnnouncements.map((announcement) => (
                  <AnnouncementCard key={announcement.id} announcement={announcement} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
