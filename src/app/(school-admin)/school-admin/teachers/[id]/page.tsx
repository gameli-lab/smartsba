import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireSchoolAdmin } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Teacher, UserProfile } from '@/types'

interface TeacherWithProfile extends Teacher {
  user_profile: UserProfile
}

interface AssignmentRow {
  id: string
  class_id: string
  subject_id: string
  is_class_teacher: boolean
  academic_year: string
  classes?: { id: string; name: string; level: number | null; stream?: string | null } | null
  subjects?: { id: string; name: string; code?: string | null } | null
}

interface TeacherBaseRow extends Teacher {
  user_id: string
}

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = createAdminSupabaseClient()
  const { id: teacherId } = await params

  const { data: teacherBaseData } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .eq('school_id', schoolId)
    .maybeSingle()

  const teacherBase = teacherBaseData as TeacherBaseRow | null

  if (!teacherBase) {
    return notFound()
  }

  const [{ data: profileRow }, { data: assignmentsData }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, staff_id, phone, gender, date_of_birth, address, status, school_id, role, created_at, updated_at')
      .eq('user_id', teacherBase.user_id)
      .maybeSingle(),
    supabase
      .from('teacher_assignments')
      .select(
        `
        id,
        class_id,
        subject_id,
        is_class_teacher,
        academic_year,
        classes:classes(id, name, level, stream),
        subjects:subjects(id, name, code)
      `
      )
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false }),
  ])

  const teacher = profileRow
    ? ({
        ...teacherBase,
        user_profile: profileRow as UserProfile,
      } as TeacherWithProfile)
    : null

  if (!teacher) {
    return notFound()
  }

  const assignments = (assignmentsData || []) as AssignmentRow[]

  const statusBadge = teacher.is_active ? (
    <Badge className="bg-green-600">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-gray-700">Inactive</Badge>
  )

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">{teacher.user_profile.full_name}</h1>
            {statusBadge}
          </div>
          <p className="text-gray-600 mt-1">Staff ID: {teacher.user_profile.staff_id}</p>
          <p className="text-gray-500 text-sm">Email: {teacher.user_profile.email}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href="/school-admin/teachers" className="inline-flex">
            <Button variant="outline">Back</Button>
          </Link>
          <Link href="/school-admin/teacher-assignments" className="inline-flex">
            <Button variant="secondary">Manage Assignments</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bio & Staff Info</CardTitle>
            <CardDescription>Core profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-800">
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Full Name</span>
              <span className="font-medium">{teacher.user_profile.full_name}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Email</span>
              <span className="font-medium">{teacher.user_profile.email}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Phone</span>
              <span className="font-medium">{teacher.user_profile.phone || '—'}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Gender</span>
              <span className="font-medium capitalize">{teacher.user_profile.gender || '—'}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Date of Birth</span>
              <span className="font-medium">{teacher.user_profile.date_of_birth || '—'}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Address</span>
              <span className="font-medium">{teacher.user_profile.address || '—'}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Specialization</span>
              <span className="font-medium">{teacher.specialization || '—'}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Qualification</span>
              <span className="font-medium">{teacher.qualification || '—'}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Hire Date</span>
              <span className="font-medium">{teacher.hire_date || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Role</CardTitle>
            <CardDescription>Teacher access and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-800">
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Role</span>
              <span className="font-medium">Teacher</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">Account Status</span>
              <span className="font-medium">{teacher.user_profile.status || '—'}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">School ID</span>
              <span className="font-medium">{teacher.school_id}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-2">
              <span className="text-gray-600">User ID</span>
              <span className="font-medium">{teacher.user_id}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Classes</CardTitle>
          <CardDescription>Class teacher roles and class coverage</CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.filter((a) => a.classes).length === 0 ? (
            <p className="text-sm text-gray-500">No class assignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="pr-4 pb-2">Class</th>
                    <th className="pr-4 pb-2">Academic Year</th>
                    <th className="pb-2">Class Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments
                    .filter((a) => a.classes)
                    .map((row) => (
                      <tr key={row.id} className="text-gray-800">
                        <td className="pr-4 py-2">
                          {row.classes?.name}
                          {row.classes?.stream ? ` • ${row.classes.stream}` : ''}
                        </td>
                        <td className="pr-4 py-2">{row.academic_year}</td>
                        <td className="py-2">
                          {row.is_class_teacher ? (
                            <Badge className="bg-indigo-600">Class Teacher</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-700">Subject Teacher</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Subjects</CardTitle>
          <CardDescription>Subjects taught across classes</CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.filter((a) => a.subjects).length === 0 ? (
            <p className="text-sm text-gray-500">No subject assignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="pr-4 pb-2">Subject</th>
                    <th className="pr-4 pb-2">Class</th>
                    <th className="pr-4 pb-2">Academic Year</th>
                    <th className="pb-2">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments
                    .filter((a) => a.subjects)
                    .map((row) => (
                      <tr key={`${row.id}-subj`} className="text-gray-800">
                        <td className="pr-4 py-2">{row.subjects?.name || '—'}</td>
                        <td className="pr-4 py-2">
                          {row.classes?.name || '—'}{row.classes?.stream ? ` • ${row.classes.stream}` : ''}
                        </td>
                        <td className="pr-4 py-2">{row.academic_year}</td>
                        <td className="py-2 text-xs">
                          {row.is_class_teacher ? (
                            <Badge className="bg-indigo-600">Class Teacher</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-700">Subject Teacher</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
