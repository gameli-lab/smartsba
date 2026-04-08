import { requireParent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { ReportAcknowledgeButton } from '@/components/parent/report-acknowledge-button'

interface PageProps {
  params: Promise<{ scoreId: string }>
  searchParams: Promise<{ ward?: string }>
}

export default async function ParentSubjectDetailPage({ params, searchParams }: PageProps) {
  const { scoreId } = await params
  const urlParams = await searchParams
  const { wards } = await requireParent()

  if (wards.length === 0) {
    return (
      <div className="rounded-lg border bg-amber-50 p-6 text-amber-800">
        <h1 className="text-lg font-semibold">No Linked Students</h1>
        <p className="mt-2 text-sm">You do not have any wards linked to your account. Please contact your school administrator.</p>
      </div>
    )
  }

  // Fetch the score record to verify it belongs to one of the parent's wards
  const { data: scoreData } = await supabase
    .from('student_scores')
    .select(`
      id,
      student_id,
      session_id,
      subject_id,
      ca_score,
      exam_score,
      total_score,
      grade,
      remark,
      subjects (
        name
      ),
      academic_sessions (
        academic_year,
        term,
        school_id
      )
    `)
    .eq('id', scoreId)
    .maybeSingle()

  const score = scoreData as {
    id: string
    student_id: string
    session_id: string
    subject_id: string
    ca_score: number | null
    exam_score: number | null
    total_score: number | null
    grade: string | null
    remark: string | null
    subjects: { name: string } | null
    academic_sessions: { academic_year: string; term: number; school_id: string } | null
  } | null

  if (!score) {
    notFound()
  }

  // Verify this score belongs to one of the parent's wards
  const isOwnWard = wards.some(w => w.student.id === score.student_id)
  if (!isOwnWard) {
    notFound()
  }

  const session = score.academic_sessions
  const subjectName = score.subjects?.name || 'Unknown Subject'

  // Get student name
  const ward = wards.find(w => w.student.id === score.student_id)
  
  if (!ward) {
    notFound()
  }

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', ward.student.user_id)
    .maybeSingle()

  const studentName = (profileData as { full_name: string } | null)?.full_name || 'Ward'

  // Fetch historical data for this subject (previous terms)
  const { data: historicalData } = await supabase
    .from('student_scores')
    .select(`
      id,
      ca_score,
      exam_score,
      total_score,
      grade,
      academic_sessions (
        academic_year,
        term
      )
    `)
    .eq('student_id', score.student_id)
    .eq('subject_id', score.subject_id)
    .neq('id', scoreId)
    .order('academic_sessions(academic_year)', { ascending: false })
    .order('academic_sessions(term)', { ascending: false })
    .limit(3)

  const historicalScores = (historicalData || []) as Array<{
    id: string
    ca_score: number | null
    exam_score: number | null
    total_score: number | null
    grade: string | null
    academic_sessions: { academic_year: string; term: number } | null
  }>

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/parent/results${urlParams.ward ? `?ward=${urlParams.ward}` : ''}`}
          className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Results
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{subjectName}</h1>
          <p className="text-sm text-gray-600">{studentName}&apos;s performance in this subject.</p>
        </div>
        <div className="flex items-center gap-3">
          <ReportAcknowledgeButton scoreId={scoreId} />
          {session && (
            <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
              {session.academic_year} • Term {session.term}
            </Badge>
          )}
        </div>
      </div>

      {/* Current Term Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Current Term Performance</CardTitle>
          <CardDescription>Breakdown of scores for {session ? `${session.academic_year} Term ${session.term}` : 'this term'}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-600">CA Score</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {score.ca_score !== null ? score.ca_score : '-'}
              </div>
              <div className="mt-1 text-xs text-gray-500">Out of 40</div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-600">Exam Score</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {score.exam_score !== null ? score.exam_score : '-'}
              </div>
              <div className="mt-1 text-xs text-gray-500">Out of 60</div>
            </div>
            <div className="rounded-lg border bg-purple-50 p-4">
              <div className="text-sm font-medium text-purple-600">Total Score</div>
              <div className="mt-2 text-2xl font-semibold text-purple-900">
                {score.total_score !== null ? score.total_score : '-'}
              </div>
              <div className="mt-1 text-xs text-purple-600">Out of 100</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium text-gray-600">Grade</div>
              <div className="mt-2">
                {score.grade ? (
                  <Badge variant="outline" className="text-lg">{score.grade}</Badge>
                ) : (
                  <span className="text-gray-500">Not graded</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium text-gray-600">Remark</div>
              <div className="mt-2 text-sm text-gray-900">
                {score.remark || 'No remark provided'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Comparison */}
      {historicalScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Performance</CardTitle>
            <CardDescription>Comparison with previous terms in this subject.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {historicalScores.map((hist) => (
                <div key={hist.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {hist.academic_sessions?.academic_year || 'N/A'} • Term {hist.academic_sessions?.term || 'N/A'}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        CA: {hist.ca_score !== null ? hist.ca_score : '-'} • Exam: {hist.exam_score !== null ? hist.exam_score : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {hist.total_score !== null ? hist.total_score : '-'}
                      </div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                    {hist.grade && (
                      <Badge variant="outline">{hist.grade}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {historicalScores.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No historical data available for this subject.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
