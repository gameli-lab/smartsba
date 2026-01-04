import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AssignClassTeacher } from './assign-class-teacher'
import { ClassStatusManager } from './class-status-manager'

interface ClassRow {
  id: string
  school_id: string
  name: string
  level: number
  stream: string | null
  description: string | null
  class_teacher_id: string | null
  status?: 'active' | 'archived'
  created_at: string
  updated_at: string
}

interface TeacherOption {
  id: string
  full_name: string
  staff_id: string
  is_active: boolean
}

interface SubjectRow {
  id: string
  name: string
  code: string | null
  is_core: boolean
}

interface StudentRow {
  id: string
  admission_number: string
  roll_number: string | null
  gender: string
  is_active: boolean
  user_profile: { full_name: string }
}

interface TeacherOption {
  id: string
  full_name: string
  staff_id: string
  is_active: boolean
}

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const classId = params.id

  const [{ data: classRow }, { data: sessionRow }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, school_id, name, level, stream, description, class_teacher_id, status, created_at, updated_at')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .single(),
    supabase
      .from('academic_sessions')
      .select('id, academic_year, term')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle(),
  ])

  const klass = classRow as ClassRow | null
  if (!klass) {
    return notFound()
  }

  const currentSession = sessionRow as { id: string; academic_year: string; term: number } | null

  const status: 'active' | 'archived' = (klass.status as 'active' | 'archived') || 'active'

  const [subjectsResult, studentsResult, teachersResult] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, code, is_core')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .order('name', { ascending: true }),
    supabase
      .from('students')
      .select('id, admission_number, roll_number, gender, is_active, user_profile:user_profiles!inner(full_name)')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .order('created_at', { ascending: false }),
    supabase
      .from('teachers')
      .select('id, staff_id, is_active, user_profile:user_profiles!inner(full_name)')
      .eq('school_id', schoolId)
      .order('staff_id'),
  ])

  const subjects = (subjectsResult.data || []) as SubjectRow[]
  const students = (studentsResult.data || []) as StudentRow[]
  const teachers = (teachersResult.data || []) as {
    id: string
    staff_id: string
    is_active: boolean
    user_profile: { full_name: string }
  }[]

  const teacherOptions: TeacherOption[] = teachers.map((t) => ({
    id: t.id,
    full_name: t.user_profile.full_name,
    staff_id: t.staff_id,
    is_active: t.is_active,
  }))

  const classTeacher: TeacherOption | null = klass.class_teacher_id
    ? teacherOptions.find((t) => t.id === klass.class_teacher_id) || null
    : null

  const totalStudents = students.length
  const activeStudents = students.filter((s) => s.is_active).length
  const subjectsCount = subjects.length
  const coreSubjects = subjects.filter((s) => s.is_core).length

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">{klass.name}</h1>
            <Badge variant="secondary">Level {klass.level}</Badge>
            {klass.stream && <Badge variant="outline">Stream {klass.stream}</Badge>}
            <Badge variant={status === 'archived' ? 'outline' : 'secondary'}>
              {status === 'archived' ? 'Archived' : 'Active'}
            </Badge>
            {currentSession ? (
              <Badge variant="outline">Term {currentSession.term} • {currentSession.academic_year}</Badge>
            ) : (
              <Badge variant="outline">Session not set</Badge>
            )}
          </div>
          <p className="text-gray-600">Class detail overview</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href="/school-admin/classes" className="inline-flex">
            <Button variant="outline">Back to Classes</Button>
          </Link>
          <Link href="/school-admin/teacher-assignments" className="inline-flex">
            <Button variant="secondary">Manage Assignments</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm font-medium text-gray-700">
        <a href="#overview" className="px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50">Overview</a>
        <a href="#students" className="px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50">Students</a>
        <a href="#subjects" className="px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50">Subjects</a>
      </div>

      <section id="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Class Info</CardTitle>
              <CardDescription>Basic details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-800">
              <div className="flex justify-between"><span className="text-gray-600">Name</span><span className="font-medium">{klass.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Level</span><span className="font-medium">{klass.level}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Stream</span><span className="font-medium">{klass.stream || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Created</span><span className="font-medium text-gray-700">{new Date(klass.created_at).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Class Teacher</CardTitle>
              <CardDescription>Current assignment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-800">
              {classTeacher ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{classTeacher.full_name}</span>
                    <Badge variant={classTeacher.is_active ? 'secondary' : 'outline'}>
                      {classTeacher.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-gray-600 text-sm">Staff ID: {classTeacher.staff_id}</div>
                  {currentSession && (
                    <div className="text-xs text-gray-500">Academic Year: {currentSession.academic_year}</div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No class teacher assigned.</p>
              )}
              <AssignClassTeacher
                classId={klass.id}
                currentTeacherId={classTeacher?.id || null}
                teachers={teacherOptions}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Enrollment & subjects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-800">
              <div className="flex justify-between"><span className="text-gray-600">Students</span><span className="font-medium">{totalStudents}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Active Students</span><span className="font-medium">{activeStudents}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Subjects</span><span className="font-medium">{subjectsCount}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Core Subjects</span><span className="font-medium">{coreSubjects}</span></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
            <CardDescription>Notes about this class</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed">{klass.description || 'No description provided.'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class Lifecycle</CardTitle>
            <CardDescription>Archive or reactivate this class</CardDescription>
          </CardHeader>
          <CardContent>
            <ClassStatusManager classId={klass.id} status={status} />
          </CardContent>
        </Card>
      </section>

      <section id="students" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Students</h2>
            <p className="text-sm text-gray-600">Read-only roster</p>
          </div>
          <Badge variant="outline">{totalStudents} total</Badge>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Admission #</th>
                <th className="px-4 py-3 text-left font-medium">Roll #</th>
                <th className="px-4 py-3 text-left font-medium">Gender</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No students in this class.</td>
                </tr>
              )}
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{student.user_profile.full_name}</td>
                  <td className="px-4 py-3 text-gray-700">{student.admission_number}</td>
                  <td className="px-4 py-3 text-gray-700">{student.roll_number || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{student.gender}</td>
                  <td className="px-4 py-3">
                    <Badge variant={student.is_active ? 'secondary' : 'outline'}>
                      {student.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="subjects" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Subjects</h2>
            <p className="text-sm text-gray-600">Subjects offered in this class</p>
          </div>
          <Badge variant="outline">{subjectsCount} total</Badge>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">No subjects linked yet.</td>
                </tr>
              )}
              {subjects.map((subject) => (
                <tr key={subject.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{subject.name}</td>
                  <td className="px-4 py-3 text-gray-700">{subject.code || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={subject.is_core ? 'secondary' : 'outline'}>
                      {subject.is_core ? 'Core' : 'Elective'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
