import { requireParent } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'
import { PerformanceClient } from '@/components/parent/performance-client'
import { selectWard } from '../_lib/ward-selection'
import { renderNoLinkedWardsState, renderWardNotFoundState } from '../_lib/parent-states'

interface PageProps {
  searchParams: Promise<{ ward?: string }>
}

interface AggregateRecordRow {
  session_id: string
  aggregate_score: number | null
  total_subjects: number | null
  class_position: number | null
  academic_sessions: {
    academic_year: string
    term: number
  } | null
}

interface SubjectTrendRow {
  subject_id: string
  total_score: number | null
  subjects: {
    name: string
  } | null
  academic_sessions: {
    academic_year: string
    term: number
  } | null
}

export default async function ParentPerformancePage({ searchParams }: PageProps) {
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

  // Get student name
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', student.user_id)
    .maybeSingle()

  const studentName = (profileData as { full_name: string } | null)?.full_name || 'Ward'

  // Fetch all performance records for this ward
  const { data: performanceData } = await supabase
    .from('student_aggregates')
    .select(`
      session_id,
      aggregate_score,
      total_subjects,
      class_position,
      academic_sessions (
        academic_year,
        term
      )
    `)
    .eq('student_id', student.id)
    .order('academic_sessions(academic_year)', { ascending: false })
    .order('academic_sessions(term)', { ascending: false })

  const records = ((performanceData || []) as AggregateRecordRow[]).map((record) => ({
    session_id: record.session_id,
    academic_year: record.academic_sessions?.academic_year || '',
    term: record.academic_sessions?.term || 0,
    aggregate_score: record.aggregate_score,
    total_subjects: record.total_subjects,
    class_position: record.class_position,
  }))

  const { data: subjectScoresData } = await supabase
    .from('student_scores')
    .select(`
      subject_id,
      total_score,
      subjects (
        name
      ),
      academic_sessions (
        academic_year,
        term
      )
    `)
    .eq('student_id', student.id)
    .order('academic_sessions(academic_year)', { ascending: true })
    .order('academic_sessions(term)', { ascending: true })

  const subjectTrendData = ((subjectScoresData || []) as SubjectTrendRow[]).map((row) => ({
    subject_id: row.subject_id,
    subject_name: row.subjects?.name || 'Unknown Subject',
    total_score: row.total_score as number | null,
    academic_year: row.academic_sessions?.academic_year || '',
    term: row.academic_sessions?.term || 0,
  }))

  // Extract unique years for filter
  const availableYears = Array.from(
    new Set(records.map((r) => r.academic_year).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Performance History</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">Historical performance records for {studentName}.</p>
      </div>

      {records.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">No performance history available yet.</p>
        </div>
      ) : (
        <PerformanceClient
          data={records}
          availableYears={availableYears}
          subjectTrendData={subjectTrendData}
        />
      )}
    </div>
  )
}
