import { requireParent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buildParentAnnouncementFilter, selectWard } from './_lib/ward-selection'
import { renderNoLinkedWardsState, renderWardNotFoundState } from './_lib/parent-states'
import { MeetingRequestCard } from '@/components/parent/meeting-request-card'

interface PageProps {
  searchParams: Promise<{ ward?: string }>
}

export default async function ParentDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { wards } = await requireParent()

  if (wards.length === 0) {
    return renderNoLinkedWardsState()
  }

  // Get selected ward or default to primary/first
  const { selectedWard } = selectWard(wards, params.ward)

  if (!selectedWard) {
    return renderWardNotFoundState()
  }

  const student = selectedWard.student

  // Fetch current session
  const { data: sessionData } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', student.school_id)
    .eq('is_current', true)
    .maybeSingle()

  const session = sessionData as { id: string; academic_year: string; term: number } | null

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Parent Dashboard</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No current academic session is set. Please contact your school administrator.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch ward's aggregate data
  const [{ data: aggregateData }, { data: announcementsData }, { data: remarkData }, { data: attendanceData }] = await Promise.all([
    supabase
      .from('student_aggregates')
      .select('aggregate_score, total_subjects, class_position')
      .eq('student_id', student.id)
      .eq('session_id', session.id)
      .maybeSingle(),
    supabase
      .from('announcements')
      .select('id, title, content, created_at, is_urgent, target_audience, class_ids')
      .eq('school_id', student.school_id)
      .or(buildParentAnnouncementFilter(student.class_id))
      .order('created_at', { ascending: false })
      .limit(5),
    session.term === 3
      ? supabase
          .from('class_teacher_remarks')
          .select('promotion_status')
          .eq('student_id', student.id)
          .eq('session_id', session.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('attendance')
      .select('present_days, total_days, percentage')
      .eq('student_id', student.id)
      .eq('session_id', session.id)
      .maybeSingle(),
  ])

  const aggregate = (aggregateData || null) as { aggregate_score: number | null; total_subjects: number | null; class_position: number | null } | null
  const announcements = (announcementsData || []) as Array<{
    id: string
    title: string
    content: string | null
    created_at: string
    is_urgent: boolean | null
    target_audience: string[] | null
    class_ids: string[] | null
  }>
  const remark = (remarkData || null) as { promotion_status: string | null } | null
  const attendance = (attendanceData || null) as { present_days: number; total_days: number; percentage: number } | null

  const termAverage = aggregate?.aggregate_score ?? null
  const classPosition = aggregate?.class_position ?? null
  const totalSubjects = aggregate?.total_subjects ?? null
  const promotionStatus = remark?.promotion_status ?? null
  const attendanceRate = attendance?.percentage ?? null
  const unreadAnnouncements = announcements.length
  const urgentAnnouncements = announcements.filter((ann) => Boolean(ann.is_urgent)).length

  // Get student name
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', student.user_id)
    .maybeSingle()

  const studentName = (profileData as { full_name: string } | null)?.full_name || 'Ward'

  const summaryCards = [
    { label: 'Current Term Average', value: termAverage !== null ? `${termAverage}%` : 'N/A' },
    { label: 'Class Position', value: classPosition !== null ? `${classPosition}` : 'N/A' },
    { label: 'Total Subjects', value: totalSubjects !== null ? `${totalSubjects}` : 'N/A' },
    {
      label: 'Attendance',
      value: attendanceRate !== null ? `${attendanceRate}%` : 'N/A',
      hint:
        attendance && attendance.total_days > 0
          ? `${attendance.present_days}/${attendance.total_days} days`
          : 'No attendance records yet',
    },
    {
      label: 'Unread Announcements',
      value: `${unreadAnnouncements}`,
      hint: urgentAnnouncements > 0 ? `${urgentAnnouncements} urgent` : 'No urgent items',
    },
    ...(session.term === 3
      ? [{ label: 'Promotion Status', value: promotionStatus || 'Pending' }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Parent Dashboard</h1>
          <p className="text-sm text-gray-600">Overview of {studentName}&apos;s academic performance.</p>
        </div>
        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
          {session.academic_year} • Term {session.term}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
              {'hint' in card && card.hint ? (
                <p className="mt-1 text-xs text-gray-500">{card.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Academic Summary</CardTitle>
            <CardDescription>Current term performance overview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Term Average</span>
                <span className="text-lg font-semibold text-gray-900">
                  {termAverage !== null ? `${termAverage}%` : 'N/A'}
                </span>
              </div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Class Position</span>
                <span className="text-lg font-semibold text-gray-900">
                  {classPosition !== null ? `${classPosition}` : 'N/A'}
                </span>
              </div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Subjects</span>
                <span className="text-lg font-semibold text-gray-900">
                  {totalSubjects !== null ? `${totalSubjects}` : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Announcements</CardTitle>
            <CardDescription>Recent updates from the school.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-500">No announcements yet.</p>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{ann.title}</p>
                    {ann.is_urgent ? (
                      <Badge variant="destructive" className="text-xs">Urgent</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{new Date(ann.created_at).toLocaleString()}</p>
                  {ann.content ? <p className="mt-2 text-sm text-gray-700 line-clamp-2">{ann.content}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <MeetingRequestCard wardId={student.id} wardName={studentName} />
    </div>
  )
}
