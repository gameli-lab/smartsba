import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ClassDetailPageProps {
  params: { classId: string }
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

interface AssignmentRow {
  id: string
  subject_id: string
  teacher: {
    id: string
    user_profile: {
      full_name: string
      email: string
    }
  }
  is_class_teacher: boolean
}

interface StudentRow {
  id: string
  admission_number: string
  gender: string | null
  user_profile: {
    full_name: string
    email: string
  }
}

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
  const { classId } = params
  const { assignments, effectiveRole, profile } = await requireTeacher()

  const allowedClassIds = new Set(assignments.map((a) => a.class_id))
  if (!allowedClassIds.has(classId)) {
    redirect('/teacher/classes')
  }

  const subjectIdsForTeacher = new Set(assignments.filter((a) => a.class_id === classId).map((a) => a.subject_id))
  const isClassTeacher = assignments.some((a) => a.class_id === classId && a.is_class_teacher)

  const [{ data: classRow }, { data: subjectsData }, { data: studentsData }, { data: assignmentsData }] =
    await Promise.all([
      supabase
        .from('classes')
        .select('id, name, level, stream')
        .eq('id', classId)
        .maybeSingle(),
      supabase
        .from('subjects')
        .select('id, name, class_id')
        .eq('class_id', classId),
      supabase
        .from('students')
        .select('id, admission_number, gender, user_profile:user_profiles!inner(full_name, email)')
        .eq('class_id', classId)
        .eq('school_id', profile.school_id),
      supabase
        .from('teacher_assignments')
        .select('id, subject_id, is_class_teacher, teacher:teachers!inner(id, user_profile:user_profiles!inner(full_name, email))')
        .eq('class_id', classId),
    ])

  const klass = (classRow || null) as ClassRow | null
  if (!klass) {
    redirect('/teacher/classes')
  }

  const subjects = (subjectsData || []) as SubjectRow[]
  const students = (studentsData || []) as StudentRow[]
  const assignmentsBySubject = new Map<string, AssignmentRow[]>()
  ;(assignmentsData || []).forEach((a: any) => {
    const list = assignmentsBySubject.get(a.subject_id) || []
    list.push(a as AssignmentRow)
    assignmentsBySubject.set(a.subject_id, list)
  })

  const visibleSubjects = isClassTeacher
    ? subjects
    : subjects.filter((s) => subjectIdsForTeacher.has(s.id))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{klass.name}</h1>
          <p className="text-sm text-gray-600">
            Level {klass.level ?? '—'}{klass.stream ? ` • ${klass.stream}` : ''}
          </p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          {isClassTeacher ? 'Class Teacher Access' : 'Subject Teacher Access'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subjects</CardTitle>
            <CardDescription>
              {isClassTeacher ? 'All subjects in this class' : 'Subjects assigned to you in this class'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleSubjects.length === 0 ? (
              <p className="text-sm text-gray-500">No subject assignments found.</p>
            ) : (
              <div className="space-y-3">
                {visibleSubjects.map((subj) => {
                  const assignedTeachers = assignmentsBySubject.get(subj.id) || []
                  return (
                    <div key={subj.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{subj.name}</p>
                          <p className="text-xs text-gray-500">Subject ID: {subj.id}</p>
                        </div>
                        <Badge variant="secondary">{assignedTeachers.length || 'No'} teacher(s)</Badge>
                      </div>
                      <div className="mt-2 space-y-1">
                        {assignedTeachers.length === 0 ? (
                          <p className="text-xs text-gray-500">No teacher assignments yet.</p>
                        ) : (
                          assignedTeachers.map((t) => (
                            <div key={t.id} className="text-sm text-gray-700">
                              {t.teacher?.user_profile?.full_name || 'Unknown Teacher'}
                              {t.teacher?.user_profile?.email && (
                                <span className="text-xs text-gray-500"> • {t.teacher.user_profile.email}</span>
                              )}
                              {t.is_class_teacher && (
                                <Badge variant="outline" className="ml-2 border-amber-200 bg-amber-50 text-amber-700">
                                  Class Teacher
                                </Badge>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>All students in this class (read-only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {students.length === 0 ? (
              <p className="text-sm text-gray-500">No students found for this class.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {students.map((student) => (
                  <div key={student.id} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{student.user_profile.full_name}</p>
                      <p className="text-xs text-gray-500">{student.user_profile.email}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mr-2">{student.admission_number}</Badge>
                      <Badge variant="secondary">{student.gender || '—'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
