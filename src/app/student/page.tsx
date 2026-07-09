import { createServerComponentClient, createAdminSupabaseClient } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requireStudentWithAutoInit, renderStudentProfileError } from './utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type Session = {
  id: string
  academic_year: string
  term: '1' | '2' | '3'
} | null

type Aggregates = {
  aggregate_score: number | null
  total_subjects: number | null
  class_position: number | null
  overall_position: number | null
} | null

type Attendance = {
  present_days: number
  total_days: number
  percentage: number
} | null

type Announcement = {
  id: string
  title: string
  content?: string | null
  created_at: string
  is_urgent?: boolean | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTerm(term: '1' | '2' | '3' | null | undefined): string {
  if (!term) return 'Not set'
  const labels: Record<'1' | '2' | '3', string> = { '1': 'Term 1', '2': 'Term 2', '3': 'Term 3' }
  return labels[term]
}

function formatPosition(pos: number | null): string {
  if (pos === null) return 'N/A'
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = pos % 100
  const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]
  return `${pos}${suffix}`
}

function formatAggregate(score: number | null): string {
  // Ghanaian aggregate: sum of grade numbers (lower = better). Not a percentage.
  if (score === null || score === 0) return 'N/A'
  return `Agg. ${score}`
}

function formatAttendance(att: Attendance): string {
  if (!att || att.total_days === 0) return 'N/A'
  return `${att.percentage}% (${att.present_days}/${att.total_days} days)`
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function StudentDashboardPage() {
  const guardResult = await requireStudentWithAutoInit()
  if (!guardResult.success) return renderStudentProfileError(guardResult.error!)
  const { student, profile } = guardResult.guard!

  const supabase = await createServerComponentClient()

  // Step 1: fetch current session — all other queries depend on its id
  const { data: sessionData } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  const session = sessionData as Session

  // Step 2: parallel fetch — only fire session-dependent queries if session exists
  const sessionId = session?.id ?? null

  const [
    classResult,
    aggregatesResult,
    announcementsResult,
    attendanceResult,
  ] = await Promise.all([
    // Class — try RLS client first
    student?.class_id
      ? supabase
          .from('classes')
          .select('name, stream')
          .eq('id', student.class_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Aggregates — only query if we have a session
    sessionId
      ? supabase
          .from('student_aggregates')
          .select('aggregate_score, total_subjects, class_position, overall_position')
          .eq('student_id', student?.id ?? '')
          .eq('session_id', sessionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Announcements — always fetch
    supabase
      .from('announcements')
      .select('id, title, content, created_at, is_urgent')
      .eq('school_id', profile.school_id)
      .contains('target_audience', ['student'])
      .order('created_at', { ascending: false })
      .limit(5),

    // Attendance — only query if we have a session
    sessionId
      ? supabase
          .from('attendance')
          .select('present_days, total_days, percentage')
          .eq('student_id', student?.id ?? '')
          .eq('session_id', sessionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  // Class fallback: if RLS blocked the class fetch, use admin client (display-only)
  let classRow = classResult.data as { name: string; stream?: string | null } | null
  if (!classRow && student?.class_id) {
    try {
      const { data } = await createAdminSupabaseClient()
        .from('classes')
        .select('name, stream')
        .eq('id', student.class_id)
        .maybeSingle()
      classRow = data as typeof classRow
    } catch {
      // Non-fatal — display will show 'Not assigned'
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const currentClass = classRow
    ? [classRow.name, classRow.stream].filter(Boolean).join(' – ')
    : 'Not assigned'

  const aggregates = aggregatesResult.data as Aggregates
  const attendance = attendanceResult.data as Attendance
  const announcements = (announcementsResult.data ?? []) as Announcement[]

  const noSession = !session

  const summaryCards = [
    {
      label: 'Aggregate Score',
      value: noSession ? 'No active term' : formatAggregate(aggregates?.aggregate_score ?? null),
      sub: aggregates?.overall_position != null ? `Overall: ${formatPosition(aggregates.overall_position)}` : null,
    },
    {
      label: 'Class Position',
      value: noSession ? 'No active term' : formatPosition(aggregates?.class_position ?? null),
      sub: null,
    },
    {
      label: 'Total Subjects',
      value: noSession ? 'No active term' : (aggregates?.total_subjects != null ? `${aggregates.total_subjects}` : 'N/A'),
      sub: null,
    },
    {
      label: 'Attendance',
      value: noSession ? 'No active term' : formatAttendance(attendance),
      sub: null,
    },
  ]

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Student Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Overview of your current term performance and announcements.
          </p>
        </div>
        {session ? (
          <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
            {session.academic_year} • {formatTerm(session.term)}
          </Badge>
        ) : (
          <Badge variant="outline" className="w-fit border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
            No active term
          </Badge>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {card.value}
              </div>
              {card.sub && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Body grid ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Term summary */}
        <Card>
          <CardHeader>
            <CardTitle>Current Term Summary</CardTitle>
            <CardDescription>Your academic progress this term.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Class',          value: currentClass },
              { label: 'Aggregate Score', value: formatAggregate(aggregates?.aggregate_score ?? null) },
              { label: 'Class Position', value: formatPosition(aggregates?.class_position ?? null) },
              { label: 'Overall Position', value: formatPosition(aggregates?.overall_position ?? null) },
              { label: 'Total Subjects', value: aggregates?.total_subjects != null ? `${aggregates.total_subjects}` : 'N/A' },
              { label: 'Attendance',     value: formatAttendance(attendance) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border bg-gray-50 p-4 dark:bg-gray-800"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Announcements</CardTitle>
            <CardDescription>Recent updates from your school.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No announcements yet.</p>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{ann.title}</p>
                    {ann.is_urgent && (
                      <Badge variant="destructive" className="shrink-0 text-xs">Urgent</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(ann.created_at).toLocaleString()}
                  </p>
                  {ann.content && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
                      {ann.content}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}