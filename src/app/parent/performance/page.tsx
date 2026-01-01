import { requireParent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { PerformanceClient } from '@/components/parent/performance-client'

interface PageProps {
  searchParams: Promise<{ ward?: string }>
}

export default async function ParentPerformancePage({ searchParams }: PageProps) {
  const params = await searchParams
  const { wards } = await requireParent()

  if (wards.length === 0) {
    return (
      <div className="rounded-lg border bg-amber-50 p-6 text-amber-800">
        <h1 className="text-lg font-semibold">No Linked Students</h1>
        <p className="mt-2 text-sm">You do not have any wards linked to your account. Please contact your school administrator.</p>
      </div>
    )
  }

  // Get selected ward or default to primary/first
  const wardId = params.ward || wards.find(w => w.is_primary)?.student.id || wards[0].student.id
  const selectedWard = wards.find(w => w.student.id === wardId)

  if (!selectedWard) {
    return (
      <div className="rounded-lg border bg-red-50 p-6 text-red-800">
        <h1 className="text-lg font-semibold">Ward not found</h1>
        <p className="mt-2 text-sm">The selected ward was not found.</p>
      </div>
    )
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

  const records = (performanceData || []).map((record: any) => ({
    session_id: record.session_id,
    academic_year: record.academic_sessions?.academic_year || '',
    term: record.academic_sessions?.term || 0,
    aggregate_score: record.aggregate_score,
    total_subjects: record.total_subjects,
    class_position: record.class_position,
  }))

  // Extract unique years for filter
  const availableYears = Array.from(
    new Set(records.map((r) => r.academic_year).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Performance History</h1>
        <p className="text-sm text-gray-600">Historical performance records for {studentName}.</p>
      </div>

      {records.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-6">
          <p className="text-sm text-gray-500">No performance history available yet.</p>
        </div>
      ) : (
        <PerformanceClient data={records} availableYears={availableYears} />
      )}
    </div>
  )
}
