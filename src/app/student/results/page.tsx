import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requireStudentWithAutoInit, renderStudentProfileError } from '../utils'

export default async function StudentResultsPage() {
  const guardResult = await requireStudentWithAutoInit()

  if (!guardResult.success) {
    return renderStudentProfileError(guardResult.error!)
  }

  const { student, profile } = guardResult.guard!

  // Fetch current session
  const { data: sessionData } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  const session = sessionData as { id: string; academic_year: string; term: number } | null

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Results</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No current academic session is set. Please contact your administrator.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch scores for current term
  const { data: scoresData } = await supabase
    .from('scores')
    .select(`
      id,
      ca_score,
      exam_score,
      total_score,
      grade,
      subject_remark,
      subject:subjects(name, code)
    `)
    .eq('student_id', student.id)
    .eq('session_id', session.id)
    .order('subject(name)')

  const scores = (scoresData || []) as Array<{
    id: string
    ca_score: number | null
    exam_score: number | null
    total_score: number | null
    grade: string | null
    subject_remark: string | null
    subject: { name: string; code?: string | null } | null
  }>

  // Fetch aggregates for term average and class position
  const { data: aggregateData } = await supabase
    .from('student_aggregates')
    .select('aggregate_score, class_position')
    .eq('student_id', student.id)
    .eq('session_id', session.id)
    .maybeSingle()

  const aggregate = (aggregateData || null) as { aggregate_score: number | null; class_position: number | null } | null
  const termAverage = aggregate?.aggregate_score ?? null
  const classPosition = aggregate?.class_position ?? null

  // Fetch promotion status (only for term 3)
  let promotionStatus: string | null = null
  if (session.term === 3) {
    const { data: remarkData } = await supabase
      .from('class_teacher_remarks')
      .select('promotion_status')
      .eq('student_id', student.id)
      .eq('session_id', session.id)
      .maybeSingle()

    const remark = remarkData as { promotion_status?: string | null } | null
    promotionStatus = remark?.promotion_status ?? null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Results</h1>
          <p className="text-sm text-gray-600">View your current term scores and performance.</p>
        </div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          {session.academic_year} • Term {session.term}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Term Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{termAverage !== null ? `${termAverage}%` : 'N/A'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Class Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{classPosition !== null ? classPosition : 'N/A'}</div>
          </CardContent>
        </Card>

        {session.term === 3 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Promotion Status</CardTitle>
            </CardHeader>
            <CardContent>
              {promotionStatus ? (
                <Badge
                  variant={promotionStatus === 'promoted' ? 'default' : promotionStatus === 'repeated' ? 'secondary' : 'outline'}
                  className="text-sm"
                >
                  {promotionStatus.charAt(0).toUpperCase() + promotionStatus.slice(1)}
                </Badge>
              ) : (
                <div className="text-sm text-gray-500">Pending</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subject Scores</CardTitle>
          <CardDescription>Detailed breakdown of your performance in each subject.</CardDescription>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <p className="text-sm text-gray-500">No scores recorded for this term yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-center">Class Score</TableHead>
                    <TableHead className="text-center">Exam Score</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead>Teacher Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((score) => (
                    <TableRow key={score.id} className="cursor-pointer hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <Link href={`/student/results/${score.id}`} className="block">
                          {score.subject?.name || 'Unknown Subject'}
                          {score.subject?.code && (
                            <span className="ml-2 text-xs text-gray-500">({score.subject.code})</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/student/results/${score.id}`} className="block">
                          {score.ca_score !== null ? score.ca_score : '—'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/student/results/${score.id}`} className="block">
                          {score.exam_score !== null ? score.exam_score : '—'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        <Link href={`/student/results/${score.id}`} className="block">
                          {score.total_score !== null ? score.total_score : '—'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/student/results/${score.id}`} className="block">
                          {score.grade ? (
                            <Badge variant="outline">{score.grade}</Badge>
                          ) : (
                            '—'
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <Link href={`/student/results/${score.id}`} className="block">
                          <span className="text-sm text-gray-700 line-clamp-1">
                            {score.subject_remark || '—'}
                          </span>
                        </Link>
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
