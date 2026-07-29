import { requireTeacher } from '@/lib/auth-guards'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SubjectRow {
  id: string
  name: string
  class_id: string
  class: {
    id: string
    name: string
    level: number | null
    stream: string | null
  }
}

interface ClassSubjectRow {
  class_id: string
  subject: {
    id: string
    name: string
    class_id: string
    class: {
      id: string
      name: string
      level: number | null
      stream: string | null
    }
  }
}

export default async function TeacherSubjectsPage() {
  const supabase = createAdminSupabaseClient()
  const { assignments, effectiveRole, teacher } = await requireTeacher()

  // Get class IDs from teacher_assignments
  const assignmentClassIds = Array.from(new Set(assignments.map((a) => a.class_id).filter(Boolean)))

  // Also get classes where this teacher is the class teacher
  let classTeacherClassIds: string[] = []
  if (teacher) {
    const { data: ctClasses } = await supabase
      .from('classes')
      .select('id')
      .eq('class_teacher_id', teacher.id)
    classTeacherClassIds = (ctClasses || []).map((c: { id: string }) => c.id)
  }

  // Merge both sets of class IDs
  const classIds = Array.from(new Set([...assignmentClassIds, ...classTeacherClassIds]))
  const subjectIds = Array.from(new Set(assignments.map((a) => a.subject_id).filter(Boolean)))

  // Get subject names for the teacher's assigned subjects
  const [{ data: subjectRows }, { data: classRows }] = await Promise.all([
    subjectIds.length
      ? supabase.from('subjects').select('id, name').in('id', subjectIds)
      : Promise.resolve({ data: [], error: null } as const),
    classIds.length
      ? supabase.from('classes').select('id, name, level, stream').in('id', classIds)
      : Promise.resolve({ data: [], error: null } as const),
  ])

  const rawSubjects = (subjectRows || []) as Array<{ id: string; name: string }>
  const subjectNameMap = new Map(rawSubjects.map((s) => [s.id, s.name]))
  const classes = (classRows || []) as Array<{ id: string; name: string; level: number | null; stream: string | null }>
  const classMap = new Map(classes.map((c) => [c.id, c]))

  // Build subjects from the teacher's assignments (source of truth)
  const subjects = assignments
    .filter((a) => a.class_id && a.subject_id && subjectNameMap.has(a.subject_id))
    .map((a) => ({
      id: a.subject_id!,
      name: subjectNameMap.get(a.subject_id!)!,
      class_id: a.class_id!,
      class: classMap.get(a.class_id!) || { id: a.class_id!, name: 'Unknown', level: null, stream: null },
    }))

  const grouped = subjects.reduce<Record<string, typeof subjects>>((acc, subj) => {
    const key = subj.class_id
    acc[key] = acc[key] || []
    acc[key].push(subj)
    return acc
  }, {})

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="space-y-6 text-gray-900 dark:text-gray-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My Subjects</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">Subjects assigned to you across classes</p>
          </div>
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
            {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
          </Badge>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-gray-500 dark:text-gray-400">No subject assignments yet.</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My Subjects</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Subjects assigned to you across classes</p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([classId, subs]) => (
          <Card key={classId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-gray-900 dark:text-gray-100">{subs[0]?.class?.name || 'Class'}</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Level {subs[0]?.class?.level ?? '—'}{subs[0]?.class?.stream ? ` • ${subs[0].class.stream}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {subs.map((subj) => (
                <div key={subj.id} className="flex items-center justify-between rounded-lg border px-3 py-2 dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{subj.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Subject ID: {subj.id}</p>
                  </div>
                  <Badge variant="outline">Enter Scores</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
