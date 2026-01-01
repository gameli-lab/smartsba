import { requireTeacher } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ClassRow {
  id: string
  name: string
  level: number | null
  stream: string | null
  class_teacher_id: string | null
}

interface SubjectRow {
  id: string
  name: string
  class_id: string
}

export default async function TeacherClassesPage() {
  const { assignments, effectiveRole, profile } = await requireTeacher()

  const classIds = Array.from(new Set(assignments.map((a) => a.class_id).filter(Boolean)))
  const subjectIds = Array.from(new Set(assignments.map((a) => a.subject_id).filter(Boolean)))
  const classTeacherClassIds = assignments.filter((a) => a.is_class_teacher).map((a) => a.class_id)

  const [{ data: classesData }, { data: subjectsData }, { data: studentCounts }] = await Promise.all([
    classIds.length
      ? supabase
          .from('classes')
          .select('id, name, level, stream, class_teacher_id')
          .in('id', classIds)
      : Promise.resolve({ data: [], error: null } as const),
    classIds.length
      ? supabase
          .from('subjects')
          .select('id, name, class_id')
          .in('class_id', classIds)
      : Promise.resolve({ data: [], error: null } as const),
    classIds.length
      ? supabase
          .from('students')
          .select('class_id, id')
          .in('class_id', classIds)
      : Promise.resolve({ data: [], error: null } as const),
  ])

  const subjects = (subjectsData || []) as SubjectRow[]
  const classes = (classesData || []) as ClassRow[]
  const studentCountMap = new Map<string, number>()
  ;(studentCounts || []).forEach((s: { class_id: string }) => {
    const current = studentCountMap.get(s.class_id) || 0
    studentCountMap.set(s.class_id, current + 1)
  })

  const classSubjectMap = new Map<string, SubjectRow[]>()
  subjects.forEach((subj) => {
    const list = classSubjectMap.get(subj.class_id) || []
    list.push(subj)
    classSubjectMap.set(subj.class_id, list)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Classes</h1>
          <p className="text-sm text-gray-600">Classes where you are assigned as class teacher or subject teacher</p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            No class assignments yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((klass) => {
            const subjectsForClass = classSubjectMap.get(klass.id) || []
            const isClassTeacher = classTeacherClassIds.includes(klass.id)
            const studentCount = studentCountMap.get(klass.id) || 0

            return (
              <Card key={klass.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-gray-900">{klass.name}</CardTitle>
                  <CardDescription className="text-gray-600">
                    Level {klass.level ?? '—'}{klass.stream ? ` • ${klass.stream}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={isClassTeacher ? 'default' : 'secondary'}>
                      {isClassTeacher ? 'Class Teacher' : 'Subject Teacher'}
                    </Badge>
                    <Badge variant="outline">{studentCount} students</Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">Subjects</p>
                    {subjectsForClass.length === 0 ? (
                      <p className="text-sm text-gray-500">No subjects found.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {subjectsForClass.map((subj) => (
                          <Badge key={subj.id} variant="secondary">
                            {subj.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-gray-600">
                    Student count reflects total students in the class.
                  </div>

                  <div className="pt-1 text-sm text-gray-500">Action: View details (read-only) — TODO link when detail page is added.</div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
