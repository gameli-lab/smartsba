import { requireStudent } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ scoreId: string }>
}

export default async function SubjectResultPage({ params }: PageProps) {
  const { scoreId } = await params
  const guard = await requireStudent()

  if (!guard.student) {
    redirect('/student')
  }

  const { student } = guard

  // Fetch the specific score
  const { data: scoreData } = await supabase
    .from('scores')
    .select(`
      id,
      ca_score,
      exam_score,
      total_score,
      grade,
      subject_remark,
      session:academic_sessions(id, academic_year, term),
      subject:subjects(id, name, code)
    `)
    .eq('id', scoreId)
    .eq('student_id', student.id)
    .maybeSingle()

  // Verify score belongs to student
  if (!scoreData) {
    return (
      <div className="space-y-4">
        <Link href="/student/results">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Results
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Score not found or you don&apos;t have access to view it.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const score = scoreData as {
    id: string
    ca_score: number | null
    exam_score: number | null
    total_score: number | null
    grade: string | null
    subject_remark: string | null
    session: { id: string; academic_year: string; term: number } | null
    subject: { id: string; name: string; code?: string | null } | null
  }

  // Fetch term comparison (previous terms for same subject)
  const { data: historicalScores } = await supabase
    .from('scores')
    .select(`
      id,
      total_score,
      grade,
      session:academic_sessions(academic_year, term)
    `)
    .eq('student_id', student.id)
    .eq('subject_id', score.subject?.id || '')
    .neq('id', scoreId)
    .order('session(academic_year)', { ascending: false })
    .order('session(term)', { ascending: false })
    .limit(5)

  const history = (historicalScores || []) as Array<{
    id: string
    total_score: number | null
    grade: string | null
    session: { academic_year: string; term: number } | null
  }>

  return (
    <div className="space-y-6">
      <div>
        <Link href="/student/results">
          <Button variant="ghost" size="sm" className="mb-4">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Results
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {score.subject?.name || 'Subject'}
              {score.subject?.code && (
                <span className="ml-2 text-lg text-gray-500">({score.subject.code})</span>
              )}
            </h1>
            <p className="text-sm text-gray-600">
              {score.session?.academic_year} • Term {score.session?.term}
            </p>
          </div>
          {score.grade && (
            <Badge variant="outline" className="text-lg px-4 py-2">
              Grade {score.grade}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Class Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {score.ca_score !== null ? score.ca_score : '—'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Out of 30</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Exam Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {score.exam_score !== null ? score.exam_score : '—'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Out of 70</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {score.total_score !== null ? score.total_score : '—'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Out of 100</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher&apos;s Remark</CardTitle>
          <CardDescription>Feedback from your subject teacher.</CardDescription>
        </CardHeader>
        <CardContent>
          {score.subject_remark ? (
            <p className="text-sm text-gray-700">{score.subject_remark}</p>
          ) : (
            <p className="text-sm text-gray-500">No remark provided yet.</p>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Term Comparison</CardTitle>
            <CardDescription>Your performance in this subject over previous terms.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.session?.academic_year} • Term {item.session?.term}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {item.total_score !== null ? item.total_score : '—'}
                      </p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                    {item.grade && (
                      <Badge variant="outline">Grade {item.grade}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
