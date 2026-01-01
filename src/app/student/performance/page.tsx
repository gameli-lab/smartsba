import { requireStudent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { PerformanceClient } from '@/components/student/performance-client'

export default async function PerformanceHistoryPage() {
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

  // Fetch all academic sessions for this school
  const { data: sessionsData } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', profile.school_id)
    .order('academic_year', { ascending: false })
    .order('term', { ascending: false })

  const sessions = (sessionsData || []) as Array<{
    id: string
    academic_year: string
    term: number
  }>

  // Fetch current session data as initial
  const { data: currentSessionData } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  const currentSession = currentSessionData as { id: string; academic_year: string; term: number } | null

  let initialData = null
  if (currentSession) {
    const [{ data: aggregateData }, { data: remarkData }] = await Promise.all([
      supabase
        .from('student_aggregates')
        .select('aggregate_score, class_position')
        .eq('student_id', student.id)
        .eq('session_id', currentSession.id)
        .maybeSingle(),
      supabase
        .from('class_teacher_remarks')
        .select('remark, promotion_status')
        .eq('student_id', student.id)
        .eq('session_id', currentSession.id)
        .maybeSingle(),
    ])

    initialData = {
      session: currentSession,
      aggregate: (aggregateData || null) as { aggregate_score: number | null; class_position: number | null } | null,
      remark: (remarkData || null) as { remark: string | null; promotion_status: string | null } | null,
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Performance History</h1>
        <p className="text-sm text-gray-600">View your academic performance across different terms and years.</p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-6">
          <p className="text-sm text-gray-500">No academic sessions available yet.</p>
        </div>
      ) : (
        <PerformanceClient
          studentId={student.id}
          schoolId={profile.school_id}
          sessions={sessions}
          initialData={initialData}
        />
      )}
    </div>
  )
}
