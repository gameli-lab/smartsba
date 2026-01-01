import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScoresTable } from './scores-table'
import type { AcademicSession, Score } from '@/types'

export default async function ScoresPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  const [{ data: sessionsData }, { data: scoresData }] = await Promise.all([
    supabase
      .from('academic_sessions')
      .select('*')
      .eq('school_id', schoolId)
      .order('academic_year', { ascending: false })
      .order('term', { ascending: false }),
    supabase
      .from('scores')
      .select(`
        *,
        students!inner(id, user_id),
        user_profiles!inner(id, full_name),
        subjects!inner(id, name, class_id),
        academic_sessions!inner(id)
      `)
      .in('students.school_id', [schoolId]),
  ])

  const sessions = (sessionsData || []) as AcademicSession[]
  const currentSession = sessions.find((s) => s.is_current) || sessions[0]

  const scores = (scoresData || []) as Array<Score & {
    students: { id: string; user_id: string }
    user_profiles: { id: string; full_name: string }
    subjects: { id: string; name: string; class_id: string }
    academic_sessions: { id: string }
  }>

  const sessionScores = currentSession
    ? scores.filter((s) => s.session_id === currentSession.id)
    : []

  const grouped = sessionScores.reduce(
    (acc, score) => {
      const key = `${score.student_id}|${score.subject_id}`
      if (!acc[key]) {
        acc[key] = {
          student_id: score.student_id,
          student_name: score.user_profiles.full_name,
          subject_id: score.subjects.name,
          subject_name: score.subjects.name,
          scores: [],
        }
      }
      acc[key].scores.push(score)
      return acc
    },
    {} as Record<string, any>
  )

  const groupedArray = Object.values(grouped)
  const total = groupedArray.length
  const withGrades = groupedArray.filter((g) => g.scores.some((s: Score) => s.grade)).length

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scores & Assessments</h1>
          <p className="text-gray-600 mt-1">Record and view student scores for the current session</p>
        </div>
        {currentSession && (
          <div className="text-right">
            <p className="text-sm text-gray-600">Current Session</p>
            <p className="text-lg font-semibold text-gray-900">
              {currentSession.academic_year} • Term {currentSession.term}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Entries</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{total}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">📊</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">With Grades</p>
                <p className="text-3xl font-bold text-green-700 mt-2">{withGrades}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-green-600">✓</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-700 mt-2">{total - withGrades}</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-yellow-600">⏳</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Scores</CardTitle>
          <CardDescription>
            {currentSession
              ? `${currentSession.academic_year} • Term ${currentSession.term}`
              : 'No sessions available'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentSession && groupedArray.length > 0 ? (
            <ScoresTable studentScores={groupedArray} sessionId={currentSession.id} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {!currentSession
                  ? 'Create an academic session to start entering scores'
                  : 'No scores recorded yet'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
