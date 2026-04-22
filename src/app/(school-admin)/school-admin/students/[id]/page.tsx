import { notFound } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth-guards'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toggleStudentStatus } from '@/app/(school-admin)/school-admin/students/actions'
import { PromoteGuardianButton } from './promote-guardian-button'
import type { Student, UserProfile, Class } from '@/types'

interface StudentWithRelations extends Student {
  user_profile: UserProfile
  classes: Class
}

interface ParentLink {
  parent_id: string
  parents: {
    id: string
    full_name: string
    email?: string | null
    phone?: string | null
  }
}

interface PromotionRow {
  id: string
  promotion_status: string | null
  remark: string | null
  created_at: string
  academic_sessions?: { id: string; academic_year: string; term: number } | null
  next_class?: { id: string; name: string; level: number | null; stream?: string | null } | null
}

interface AggregateRow {
  session_id: string
  aggregate_score: number | null
  total_subjects: number | null
  class_position: number | null
  academic_sessions?: { id: string; academic_year: string; term: number } | null
}

interface StudentBaseRow extends Student {
  user_id: string
  class_id: string
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = createAdminSupabaseClient()
  const { id: studentId } = await params

  const { data: studentBaseData } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle()

  const studentBase = studentBaseData as StudentBaseRow | null

  if (!studentBase) {
    return notFound()
  }

  const [profileRes, classRes, parentsRes, promotionRes, aggregatesRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, admission_number, phone, address, gender, date_of_birth, status, school_id, role, created_at, updated_at')
      .eq('user_id', studentBase.user_id)
      .maybeSingle(),
    supabase
      .from('classes')
      .select('id, school_id, name, level, stream, description, class_teacher_id, created_at, updated_at')
      .eq('id', studentBase.class_id)
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabase
      .from('parent_student_links')
      .select(
        `
        parent_id,
        parents:user_profiles!inner(
          id,
          full_name,
          email,
          phone
        )
      `
      )
      .eq('student_id', studentId),
    supabase
      .from('class_teacher_remarks')
      .select(
        `
        id,
        promotion_status,
        remark,
        created_at,
        academic_sessions:academic_sessions!session_id(
          id,
          academic_year,
          term
        ),
        next_class:classes!next_class_id(
          id,
          name,
          level,
          stream
        )
      `
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    supabase
      .from('student_aggregates')
      .select(
        `
        session_id,
        aggregate_score,
        total_subjects,
        class_position,
        academic_sessions:academic_sessions!session_id(
          id,
          academic_year,
          term
        )
      `
      )
      .eq('student_id', studentId)
      .order('session_id', { ascending: false }),
  ])

  const userProfile = profileRes.data as UserProfile | null
  const studentClass = classRes.data as Class | null

  const student = userProfile && studentClass
    ? ({
        ...studentBase,
        user_profile: userProfile,
        classes: studentClass,
      } as StudentWithRelations)
    : null

  if (!student) {
    return notFound()
  }

  const parents = (parentsRes.data || []) as ParentLink[]
  const promotions = (promotionRes.data || []) as PromotionRow[]
  const aggregates = (aggregatesRes.data || []) as AggregateRow[]

  const toggleStatusAction = async () => {
    'use server'
    await toggleStudentStatus(student.id, !student.is_active)
    revalidatePath(`/school-admin/students/${student.id}`)
    revalidatePath('/school-admin/students')
  }

  const statusBadge = student.is_active ? (
    <Badge className="bg-green-600">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-gray-700">Inactive</Badge>
  )

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">{student.user_profile.full_name}</h1>
            {statusBadge}
          </div>
          <p className="text-gray-600 mt-1">Admission #{student.admission_number}</p>
          <p className="text-gray-500 text-sm">
            Class: {student.classes.name}
            {student.classes.stream ? ` • ${student.classes.stream}` : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href="/school-admin/students" className="inline-flex">
            <Button variant="outline">Back</Button>
          </Link>
          <Link href="/school-admin/grading-promotion" className="inline-flex">
            <Button variant="secondary">Promotion</Button>
          </Link>
          <form action={toggleStatusAction}>
            <Button type="submit" variant={student.is_active ? 'destructive' : 'default'}>
              {student.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </form>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="academic">Academic History</TabsTrigger>
          <TabsTrigger value="parents">Linked Parents</TabsTrigger>
          <TabsTrigger value="promotion">Promotion History</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Info</CardTitle>
                <CardDescription>Profile and enrollment details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-800">
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Full Name</span>
                  <span className="font-medium">{student.user_profile.full_name}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Email</span>
                  <span className="font-medium">{student.user_profile.email}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Admission #</span>
                  <span className="font-medium">{student.admission_number}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Class</span>
                  <span className="font-medium">{student.classes.name}{student.classes.stream ? ` • ${student.classes.stream}` : ''}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Gender</span>
                  <span className="font-medium capitalize">{student.gender || '—'}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Date of Birth</span>
                  <span className="font-medium">{student.date_of_birth || '—'}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Admission Date</span>
                  <span className="font-medium">{student.admission_date || '—'}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Phone</span>
                  <span className="font-medium">{student.user_profile.phone || '—'}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Address</span>
                  <span className="font-medium">{student.user_profile.address || '—'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Guardian</CardTitle>
                <CardDescription>Primary guardian contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-800">
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Name</span>
                  <span className="font-medium">{student.guardian_name || '—'}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Phone</span>
                  <span className="font-medium">{student.guardian_phone || '—'}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Email</span>
                  <span className="font-medium">{student.guardian_email || '—'}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-2">
                  <span className="text-gray-600">Address</span>
                  <span className="font-medium">{student.address || student.user_profile.address || '—'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="academic">
          <Card>
            <CardHeader>
              <CardTitle>Academic History</CardTitle>
              <CardDescription>Aggregates by session</CardDescription>
            </CardHeader>
            <CardContent>
              {aggregates.length === 0 ? (
                <p className="text-sm text-gray-500">No academic records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="pr-4 pb-2">Session</th>
                        <th className="pr-4 pb-2">Aggregate</th>
                        <th className="pr-4 pb-2">Subjects</th>
                        <th className="pb-2">Class Position</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {aggregates.map((row) => (
                        <tr key={`${row.session_id}`} className="text-gray-800">
                          <td className="pr-4 py-2">
                            {row.academic_sessions?.academic_year || '—'} • Term {row.academic_sessions?.term ?? '—'}
                          </td>
                          <td className="pr-4 py-2">{row.aggregate_score ?? '—'}</td>
                          <td className="pr-4 py-2">{row.total_subjects ?? '—'}</td>
                          <td className="py-2">{row.class_position ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parents">
          <Card>
            <CardHeader>
              <CardTitle>Linked Parents</CardTitle>
              <CardDescription>Parent accounts linked to this student</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <PromoteGuardianButton
                studentId={student.id}
                disabled={!student.guardian_name && !student.guardian_email && !student.guardian_phone}
              />

              {parents.length === 0 ? (
                <p className="text-sm text-gray-500">No parents linked yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {parents.map((p) => (
                    <div key={p.parent_id} className="py-2 text-sm text-gray-800">
                      <div className="font-medium">{p.parents.full_name}</div>
                      <div className="text-gray-600 text-xs">{p.parents.email || '—'}</div>
                      <div className="text-gray-600 text-xs">{p.parents.phone || '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promotion">
          <Card>
            <CardHeader>
              <CardTitle>Promotion History</CardTitle>
              <CardDescription>Decisions by session</CardDescription>
            </CardHeader>
            <CardContent>
              {promotions.length === 0 ? (
                <p className="text-sm text-gray-500">No promotion records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="pr-4 pb-2">Session</th>
                        <th className="pr-4 pb-2">Status</th>
                        <th className="pr-4 pb-2">Next Class</th>
                        <th className="pb-2">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {promotions.map((row) => (
                        <tr key={row.id} className="text-gray-800">
                          <td className="pr-4 py-2">
                            {row.academic_sessions?.academic_year || '—'} • Term {row.academic_sessions?.term ?? '—'}
                          </td>
                          <td className="pr-4 py-2 capitalize">{row.promotion_status || 'pending'}</td>
                          <td className="pr-4 py-2">
                            {row.next_class
                              ? `${row.next_class.name}${row.next_class.stream ? ` • ${row.next_class.stream}` : ''}`
                              : '—'}
                          </td>
                          <td className="py-2 text-gray-600 text-xs">{row.remark || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
