import { requireTeacher } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ReportableStudent {
  id: string
  admission_number: string
  user_profile: { full_name: string }
  class_id: string
}

interface SubjectScoreRow {
  id: string
  student_id: string
  subject_id: string
  total_score: number | null
  grade: string | null
}

export default async function TeacherReportsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { assignments, effectiveRole, profile } = await requireTeacher()

  const classIds = Array.from(new Set(assignments.map((a) => a.class_id).filter(Boolean)))
  if (classIds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-600">You have no class assignments yet.</p>
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

  const isClassTeacher = assignments.some((a) => a.class_id === selectedClassId && a.is_class_teacher)
  const subjectIdsForClass = assignments
    .filter((a) => a.class_id === selectedClassId && a.subject_id)
    .map((a) => a.subject_id as string)
  const uniqueSubjectIds = Array.from(new Set(subjectIdsForClass))

  const [{ data: studentsData }, { data: scoresData }] = await Promise.all([
    supabase
      .from('students')
      .select('id, admission_number, class_id, user_profile:user_profiles!inner(full_name)')
      .eq('class_id', selectedClassId)
      .eq('school_id', profile.school_id),
    uniqueSubjectIds.length
      ? supabase
          .from('scores')
          .select('id, student_id, subject_id, total_score, grade')
          .in('subject_id', uniqueSubjectIds)
          .eq('class_id', selectedClassId)
      : Promise.resolve({ data: [], error: null } as const),
  ])

  const students = (studentsData || []) as ReportableStudent[]
  const scores = (scoresData || []) as SubjectScoreRow[]
  const scoresByStudent = new Map<string, SubjectScoreRow[]>()
  scores.forEach((s) => {
    const list = scoresByStudent.get(s.student_id) || []
    list.push(s)
    scoresByStudent.set(s.student_id, list)
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-600">View student performance for your assigned classes/subjects.</p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select class to view report access</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Class</label>
              <select name="classId" defaultValue={selectedClassId} className="w-full rounded-md border px-3 py-2 text-sm">
                {classIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button type="submit" variant="outline" className="w-full">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>Class teacher: full student reports. Subject teacher: only subject performance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {students.length === 0 ? (
            <p className="text-sm text-gray-500">No students found.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {students.map((student) => {
                const studentScores = scoresByStudent.get(student.id) || []
                const totalAggregate = studentScores.reduce((sum, s) => sum + (s.total_score || 0), 0)
                return (
                  <div key={student.id} className="px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{student.user_profile.full_name}</p>
                        <p className="text-xs text-gray-500">{student.admission_number}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">Aggregate: {totalAggregate}</Badge>
                      </div>
                    </div>
                    {isClassTeacher ? (
                      <p className="text-xs text-gray-600">Full report access — TODO: link to student report preview/download.</p>
                    ) : (
                      <div className="text-xs text-gray-600">
                        Subject scores:
                        <div className="mt-1 flex flex-wrap gap-2">
                          {studentScores.length === 0 ? (
                            <span className="text-gray-500">No scores yet.</span>
                          ) : (
                            studentScores.map((s) => (
                              <Badge key={s.id} variant="secondary">
                                {s.total_score ?? 0} ({s.grade || '-'})
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
