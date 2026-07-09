import { createServerComponentClient } from '@/lib/supabase'
import { buildTeacherDashboardData } from '@/services/teacherDashboardService'
import { redirect } from 'next/navigation'
import { TeacherAssignment, UserProfile } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────────────────

type TeacherDashboardData = Awaited<ReturnType<typeof buildTeacherDashboardData>>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTerm(term?: string | null) {
  if (!term) return 'Not set'
  const labels: Record<string, string> = { '1': 'Term 1', '2': 'Term 2', '3': 'Term 3' }
  return labels[term] ?? `Term ${term}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TeacherPage({
  searchParams,
}: {
  searchParams?: { classId?: string; subjectId?: string; sessionId?: string }
}) {
  const supabase = await createServerComponentClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  // ── Profile ─────────────────────────────────────────────────────────────────
  const { data: profileRow, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profileRow) redirect('/login')

  const profile = profileRow as UserProfile

  if (profile.role !== 'teacher') redirect('/login')

  // ── Teacher row ─────────────────────────────────────────────────────────────
  const { data: teacherRow, error: teacherError } = await supabase
    .from('teachers')
    .select('id, school_id')
    .eq('user_id', user.id)
    .maybeSingle()

  // If teacher row is missing, show a clear error rather than crashing
  if (teacherError || !teacherRow) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Teacher Dashboard</h1>
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Teacher profile not found
            </p>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
              Your account is registered as a teacher but no teacher record was found. 
              Please contact your school administrator to complete your profile setup.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const teacher = teacherRow as { id: string; school_id: string }

  // ── Assignments ─────────────────────────────────────────────────────────────
  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('teacher_assignments')
    .select('*')
    .eq('teacher_id', teacher.id)

  const assignments = ((assignmentRows ?? []) as TeacherAssignment[])

  const effectiveRole: 'class_teacher' | 'subject_teacher' = assignments.some(a => a.is_class_teacher)
    ? 'class_teacher'
    : 'subject_teacher'

  // ── Build dashboard data (same service the API route used) ──────────────────
  let dashData: TeacherDashboardData | null = null
  let dashError: string | null = null

  try {
    dashData = await buildTeacherDashboardData({
      profile,
      assignments,
      effectiveRole,
      filters: {
        classId:   searchParams?.classId,
        subjectId: searchParams?.subjectId,
        sessionId: searchParams?.sessionId,
      },
    })
  } catch (err) {
    dashError = err instanceof Error ? err.message : 'Failed to load dashboard data'
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Teacher Dashboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Welcome back, {profile.full_name}.
          </p>
        </div>
        <Badge
          variant="outline"
          className="w-fit border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
        >
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      {/* Error state */}
      {dashError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Failed to load dashboard
            </p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-300">{dashError}</p>
          </CardContent>
        </Card>
      )}

      {/* Dashboard content */}
      {dashData && <TeacherDashboardContent data={dashData} effectiveRole={effectiveRole} />}
    </div>
  )
}

// ─── Dashboard content component ─────────────────────────────────────────────

function TeacherDashboardContent({
  data,
  effectiveRole,
}: {
  data: TeacherDashboardData
  effectiveRole: 'class_teacher' | 'subject_teacher'
}) {
  const session = (data as any).currentSession as { academic_year?: string; term?: string } | null
  const stats   = (data as any).stats as {
    totalStudents?: number | null
    totalSubjects?: number | null
    scoresEntered?: number | null
    pendingScores?: number | null
    classesAssigned?: number | null
  } | null

  const summaryCards = [
    { label: 'Students',        value: stats?.totalStudents   ?? 'N/A' },
    { label: 'Subjects',        value: stats?.totalSubjects   ?? 'N/A' },
    { label: 'Scores Entered',  value: stats?.scoresEntered   ?? 'N/A' },
    { label: 'Pending Scores',  value: stats?.pendingScores   ?? 'N/A' },
  ]

  return (
    <div className="space-y-6">
      {/* Term badge */}
      {session && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Current term: <span className="font-medium text-gray-700 dark:text-gray-200">
            {session.academic_year} • {formatTerm(session.term)}
          </span>
        </p>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(card => (
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
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assignments summary */}
      {(data as any).assignments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My Assignments</CardTitle>
            <CardDescription>Classes and subjects you are assigned to this term.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {((data as any).assignments as any[]).map((a: any) => (
                <div
                  key={a.id ?? `${a.class_name}-${a.subject_name}`}
                  className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3 dark:bg-gray-800"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {a.subject_name ?? 'Unknown Subject'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {a.class_name ?? 'Unknown Class'}{a.stream ? ` – ${a.stream}` : ''}
                    </p>
                  </div>
                  {a.is_class_teacher && (
                    <Badge variant="secondary" className="text-xs">Class Teacher</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}