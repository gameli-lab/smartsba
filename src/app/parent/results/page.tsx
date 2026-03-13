import { requireParent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { selectWard } from '../_lib/ward-selection'
import { renderNoLinkedWardsState, renderWardNotFoundState } from '../_lib/parent-states'

interface PageProps {
  searchParams: Promise<{ ward?: string }>
}

export default async function ParentResultsPage({ searchParams }: PageProps) {
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
        <h1 className="text-2xl font-semibold text-gray-900">Ward Results</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No current academic session is set. Please contact your school administrator.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch ward's scores for current session with subject details
  const { data: scoresData } = await supabase
    .from('student_scores')
    .select(`
      id,
      subject_id,
      ca_score,
      exam_score,
      total_score,
      grade,
      remark,
      subjects (
        name
      )
    `)
    .eq('student_id', student.id)
    .eq('session_id', session.id)
    .order('subject_id')

  const scores = (scoresData || []) as Array<{
    id: string
    subject_id: string
    ca_score: number | null
    exam_score: number | null
    total_score: number | null
    grade: string | null
    remark: string | null
    subjects: { name: string } | null
  }>

  // Fetch aggregate data for summary
  const { data: aggregateData } = await supabase
    .from('student_aggregates')
    .select('aggregate_score, total_subjects, class_position')
    .eq('student_id', student.id)
    .eq('session_id', session.id)
    .maybeSingle()

  const aggregate = (aggregateData || null) as { aggregate_score: number | null; total_subjects: number | null; class_position: number | null } | null

  // Get promotion status if term 3
  let promotionStatus: string | null = null
  if (session.term === 3) {
    const { data: remarkData } = await supabase
      .from('class_teacher_remarks')
      .select('promotion_status')
      .eq('student_id', student.id)
      .eq('session_id', session.id)
      .maybeSingle()

    promotionStatus = (remarkData as { promotion_status: string | null } | null)?.promotion_status ?? null
  }

  // Get student name
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', student.user_id)
    .maybeSingle()

  const studentName = (profileData as { full_name: string } | null)?.full_name || 'Ward'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ward Results</h1>
          <p className="text-sm text-gray-600">Current term results for {studentName}.</p>
        </div>
        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
          {session.academic_year} • Term {session.term}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Term Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">
              {aggregate?.aggregate_score !== null && aggregate?.aggregate_score !== undefined ? `${aggregate.aggregate_score}%` : 'N/A'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Class Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">
              {aggregate?.class_position !== null && aggregate?.class_position !== undefined ? `${aggregate.class_position}` : 'N/A'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">
              {aggregate?.total_subjects !== null && aggregate?.total_subjects !== undefined ? `${aggregate.total_subjects}` : 'N/A'}
            </div>
          </CardContent>
        </Card>
        {session.term === 3 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Promotion Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">
                {promotionStatus || 'Pending'}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Scores Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Results</CardTitle>
          <CardDescription>Detailed breakdown of scores for the current term.</CardDescription>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <p className="text-sm text-gray-500">No results available for this term yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">CA Score</TableHead>
                    <TableHead className="text-right">Exam Score</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((score) => (
                    <TableRow key={score.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <Link
                          href={`/parent/results/${score.id}${params.ward ? `?ward=${params.ward}` : ''}`}
                          className="text-purple-600 hover:text-purple-700 hover:underline"
                        >
                          {score.subjects?.name || 'Unknown Subject'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {score.ca_score !== null ? score.ca_score : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {score.exam_score !== null ? score.exam_score : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {score.total_score !== null ? score.total_score : '-'}
                      </TableCell>
                      <TableCell>
                        {score.grade ? (
                          <Badge variant="outline">{score.grade}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {score.remark || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
