import { requireTeacher } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveScores } from './actions'

const saveScoresAction = async (formData: FormData) => {
  'use server'
  await saveScores(formData)
}

interface ClassRow {
  id: string
  name: string
  level: number | null
  stream: string | null
}

interface SubjectRow {
  id: string
  name: string
  class_id: string
}

interface SessionRow {
  id: string
  academic_year: string
  term: number
  is_current: boolean
}

interface StudentRow {
  id: string
  admission_number: string
  gender: string | null
  user_profile: {
    full_name: string
  }
}

interface ScoreRow {
  student_id: string
  ca_score: number | null
  exam_score: number | null
  total_score: number | null
  grade: string | null
}

function formatClassName(klass: ClassRow) {
  return `${klass.name}${klass.level ? ` • Level ${klass.level}` : ''}${klass.stream ? ` • ${klass.stream}` : ''}`
}

export default async function TeacherAssessmentsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { assignments, effectiveRole, profile } = await requireTeacher()

  const classIds = Array.from(new Set(assignments.map((a) => a.class_id).filter(Boolean)))
  if (classIds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Assessments & Scores</h1>
            <p className="text-sm text-gray-600">You have no assigned classes yet.</p>
          </div>
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
            {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
          </Badge>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-gray-500">No classes assigned.</CardContent>
        </Card>
      </div>
    )
  }

  const selectedClassId = (typeof searchParams.classId === 'string' && searchParams.classId) || classIds[0]
  const subjectIdsForClass = assignments.filter((a) => a.class_id === selectedClassId && a.subject_id).map((a) => a.subject_id as string)
  const uniqueSubjectIds = Array.from(new Set(subjectIdsForClass))

  const [{ data: classRows }, { data: subjectRows }, { data: sessionRows }] = await Promise.all([
    supabase.from('classes').select('id, name, level, stream').in('id', classIds),
    uniqueSubjectIds.length
      ? supabase.from('subjects').select('id, name, class_id').in('id', uniqueSubjectIds)
      : Promise.resolve({ data: [], error: null } as const),
    supabase
      .from('academic_sessions')
      .select('id, academic_year, term, is_current')
      .eq('school_id', profile.school_id)
      .order('start_date', { ascending: false }),
  ])

  const classes = (classRows || []) as ClassRow[]
  const subjects = (subjectRows || []) as SubjectRow[]
  const sessions = (sessionRows || []) as SessionRow[]

  const selectedSubjectId = (typeof searchParams.subjectId === 'string' && searchParams.subjectId) || subjects[0]?.id
  const selectedSessionId = (typeof searchParams.sessionId === 'string' && searchParams.sessionId) || sessions[0]?.id

  if (!selectedSubjectId || !selectedSessionId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Assessments & Scores</h1>
            <p className="text-sm text-gray-600">Select a class, subject, and session to manage scores.</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-gray-500">No subjects or sessions available.</CardContent>
        </Card>
      </div>
    )
  }

  const [{ data: studentRows }, { data: scoreRows }, { data: subjectRow }] = await Promise.all([
    supabase
      .from('students')
      .select('id, admission_number, gender, user_profile:user_profiles!inner(full_name)')
      .eq('class_id', selectedClassId)
      .eq('school_id', profile.school_id),
    supabase
      .from('scores')
      .select('student_id, ca_score, exam_score, total_score, grade')
      .eq('class_id', selectedClassId)
      .eq('subject_id', selectedSubjectId)
      .eq('session_id', selectedSessionId),
    supabase
      .from('subjects')
      .select('id, class_id')
      .eq('id', selectedSubjectId)
      .maybeSingle(),
  ])

  const subject = (subjectRow as unknown as { id: string; class_id: string }) || null

  if (!subject || subject.class_id !== selectedClassId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Assessments & Scores</h1>
            <p className="text-sm text-gray-600">Selected subject is not valid for this class.</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-gray-500">Choose another class/subject.</CardContent>
        </Card>
      </div>
    )
  }

  const students = (studentRows || []) as StudentRow[]
  const scoreEntries = (scoreRows || []) as ScoreRow[]
  const scores = new Map<string, ScoreRow>()
  scoreEntries.forEach((s) => scores.set(s.student_id, s))

  const readOnly = false // TODO: wire to term lock when available

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Assessments & Scores</h1>
          <p className="text-sm text-gray-600">Enter scores for your assigned subjects only.</p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select class, subject, and term</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Class</label>
              <select name="classId" defaultValue={selectedClassId} className="w-full rounded-md border px-3 py-2 text-sm">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatClassName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Subject</label>
              <select name="subjectId" defaultValue={selectedSubjectId} className="w-full rounded-md border px-3 py-2 text-sm">
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Session / Term</label>
              <select name="sessionId" defaultValue={selectedSessionId} className="w-full rounded-md border px-3 py-2 text-sm">
                {sessions.map((sess) => (
                  <option key={sess.id} value={sess.id}>
                    {sess.academic_year} • Term {sess.term}{sess.is_current ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <Button type="submit" variant="outline">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scores</CardTitle>
          <CardDescription>CA is 0-40, Exam is 0-60. Totals and grades auto-compute on save.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {students.length === 0 ? (
            <p className="text-sm text-gray-500">No students found for this class.</p>
          ) : (
            <form action={saveScoresAction} className="space-y-4">
              <input type="hidden" name="classId" value={selectedClassId} />
              <input type="hidden" name="subjectId" value={selectedSubjectId} />
              <input type="hidden" name="sessionId" value={selectedSessionId} />
              <div className="grid grid-cols-1 gap-3">
                {students.map((student) => {
                  const score = scores.get(student.id)
                  const ca = score?.ca_score ?? ''
                  const exam = score?.exam_score ?? ''
                  const total = score?.total_score ?? ''
                  const grade = score?.grade ?? ''
                  return (
                    <div key={student.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{student.user_profile.full_name}</p>
                          <p className="text-xs text-gray-500">{student.admission_number}</p>
                        </div>
                        <div className="text-xs text-gray-500">{student.gender || '—'}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 items-center text-sm">
                        <div>
                          <label className="text-xs text-gray-600">CA (0-40)</label>
                          <Input
                            type="number"
                            name={`ca_${student.id}`}
                            min={0}
                            max={40}
                            step="1"
                            defaultValue={ca ?? ''}
                            disabled={readOnly}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Exam (0-60)</label>
                          <Input
                            type="number"
                            name={`exam_${student.id}`}
                            min={0}
                            max={60}
                            step="1"
                            defaultValue={exam ?? ''}
                            disabled={readOnly}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Total</label>
                          <Input value={total} readOnly disabled />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Grade</label>
                          <Input value={grade} readOnly disabled />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {!readOnly && (
                <div className="flex justify-end">
                  <Button type="submit">Save Scores</Button>
                </div>
              )}
              {readOnly && (
                <p className="text-sm text-gray-500">Term is locked; scores are read-only.</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
