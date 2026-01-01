import { requireStudent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function formatTerm(term?: number | null) {
  if (!term) return 'Not set'
  return `Term ${term}`
}

export default async function StudentDashboardPage() {
  const guard = await requireStudent()

  if (!guard.student) {
    return (
      <div className="rounded-lg border bg-amber-50 p-6 text-amber-800">
        <h1 className="text-lg font-semibold">Student profile not found</h1>
        <p className="mt-2 text-sm">Please contact your school administrator to complete your enrollment.</p>
      </div>
    )
  }

  const { student, profile } = guard

  const [{ data: session }, classResult, { data: aggregatesData }, { data: announcementsData }, { data: attendanceData }] = await Promise.all([
    supabase
      .from('academic_sessions')
      .select('id, academic_year, term')
      .eq('school_id', profile.school_id)
      .eq('is_current', true)
      .maybeSingle(),
    student.class_id
      ? supabase
          .from('classes')
          .select('name, stream')
          .eq('id', student.class_id)
          .maybeSingle()
      : Promise.resolve({ data: null } as const),
    supabase
      .from('student_aggregates')
      .select('aggregate_score, total_subjects, class_position')
      .eq('student_id', student.id)
      .eq('session_id', session?.id || '')
      .maybeSingle(),
    supabase
      .from('announcements')
      .select('id, title, content, created_at, is_urgent, target_audience')
      .eq('school_id', profile.school_id)
      .contains('target_audience', ['student'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('attendance')
      .select('present_days, total_days, percentage')
      .eq('student_id', student.id)
      .eq('session_id', session?.id || '')
      .maybeSingle(),
  ])

  const classRow = classResult.data as { name: string; stream?: string | null } | null
  const currentClass = classRow ? (classRow.stream ? `${classRow.name} - ${classRow.stream}` : classRow.name) : 'Not assigned'
  
  const aggregates = (aggregatesData || null) as
    | { aggregate_score: number | null; total_subjects: number | null; class_position: number | null }
    | null
  const termAverage = aggregates?.aggregate_score ?? null
  const totalSubjects = aggregates?.total_subjects ?? null
  const classPosition = aggregates?.class_position ?? null
  
  const attendance = (attendanceData || null) as { present_days: number; total_days: number; percentage: number } | null
  
  const announcements = (announcementsData || []) as Array<{
    id: string
    title: string
    content?: string | null
    created_at: string
    is_urgent?: boolean | null
    target_audience?: string[] | null
  }>

  const summaryCards = [
    { label: 'Current Term Average', value: termAverage !== null ? `${termAverage}%` : 'N/A' },
    { label: 'Class Position', value: classPosition !== null ? `${classPosition}` : 'N/A' },
    { label: 'Total Subjects Offered', value: totalSubjects !== null ? `${totalSubjects}` : 'N/A' },
    { label: 'Attendance', value: attendance ? `${attendance.percentage}%` : 'Coming soon' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Student Dashboard</h1>
          <p className="text-sm text-gray-600">Overview of your current term performance and announcements.</p>
        </div>
        {session ? (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            {session.academic_year} • {formatTerm(session.term)}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">{card.value ?? '—'}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Term Summary</CardTitle>
            <CardDescription>Your academic progress this term.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Class</span>
                <span className="text-sm text-gray-900">{currentClass}</span>
              </div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Term Average</span>
                <span className="text-lg font-semibold text-gray-900">{termAverage !== null ? `${termAverage}%` : 'N/A'}</span>
              </div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Class Position</span>
                <span className="text-lg font-semibold text-gray-900">{classPosition !== null ? `${classPosition}` : 'N/A'}</span>
              </div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Subjects</span>
                <span className="text-lg font-semibold text-gray-900">{totalSubjects !== null ? `${totalSubjects}` : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Announcements</CardTitle>
            <CardDescription>Recent updates from your school.</CardDescription>
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
    </div>
  )
}
