import { requireSchoolAdmin } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateParentDialog } from './create-parent-dialog'
import { LinkParentDialog } from './link-parent-dialog'
import { ParentsList } from './parents-list'

export const dynamic = 'force-dynamic'

interface ParentProfile {
  id: string
  user_id: string
  full_name: string
  email: string
  status: 'active' | 'disabled'
  phone: string | null
}

interface StudentOption {
  id: string
  user_id: string
  admission_number: string
  full_name: string
  guardian_name: string | null
  guardian_email: string | null
  guardian_phone: string | null
}

interface LinkRow {
  id: string
  parent_id: string
  student_id: string
  relationship: string
}

export default async function ParentsPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = createAdminSupabaseClient()

  // School students with names
  const { data: studentRows } = await supabase
    .from('students')
    .select('id, user_id, admission_number, guardian_name, guardian_email, guardian_phone')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  const studentsBase = (studentRows || []) as Array<{
    id: string
    user_id: string
    admission_number: string
    guardian_name: string | null
    guardian_email: string | null
    guardian_phone: string | null
  }>
  const studentUserIds = studentsBase.map((s) => s.user_id)
  const studentIds = studentsBase.map((s) => s.id)

  const [{ data: studentProfiles }, { data: linksData }] = await Promise.all([
    studentUserIds.length
      ? supabase
          .from('user_profiles')
          .select('user_id, full_name')
          .in('user_id', studentUserIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; full_name: string }> }),
    studentIds.length
      ? supabase
          .from('parent_student_links')
          .select('id, parent_id, student_id, relationship')
          .in('student_id', studentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; parent_id: string; student_id: string; relationship: string }> }),
  ])

  const studentNameMap = new Map((studentProfiles || []).map((p) => [p.user_id, p.full_name]))
  const students: StudentOption[] = studentsBase.map((s) => ({
    id: s.id,
    user_id: s.user_id,
    admission_number: s.admission_number,
    full_name: studentNameMap.get(s.user_id) || 'Student',
    guardian_name: s.guardian_name,
    guardian_email: s.guardian_email,
    guardian_phone: s.guardian_phone,
  }))

  const links = (linksData || []) as LinkRow[]
  const parentIds = Array.from(new Set(links.map((l) => l.parent_id)))

  const [{ data: linkedParentProfilesData }, { data: schoolParentProfilesData }] = await Promise.all([
    parentIds.length
      ? supabase
          .from('user_profiles')
          .select('id, user_id, full_name, email, status, phone')
          .in('id', parentIds)
          .eq('role', 'parent')
      : Promise.resolve({ data: [] as ParentProfile[] }),
    supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, status, phone')
      .eq('role', 'parent')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
  ])

  const parentProfiles = Array.from(
    new Map(
      ([...(linkedParentProfilesData || []), ...(schoolParentProfilesData || [])] as ParentProfile[]).map((parent) => [parent.id, parent])
    ).values()
  )

  const studentById = new Map(students.map((s) => [s.id, s]))
  const linksByParent = new Map<string, LinkRow[]>()
  links.forEach((link) => {
    linksByParent.set(link.parent_id, [...(linksByParent.get(link.parent_id) || []), link])
  })

  const parentsForList = parentProfiles.map((parent) => ({
    id: parent.id,
    full_name: parent.full_name,
    email: parent.email,
    status: parent.status || 'active',
    phone: parent.phone,
    links: (linksByParent.get(parent.id) || []).map((link) => ({
      linkId: link.id,
      studentId: link.student_id,
      studentName: studentById.get(link.student_id)?.full_name || 'Student',
      admissionNumber: studentById.get(link.student_id)?.admission_number || 'N/A',
      relationship: link.relationship,
    })),
  }))

  const total = parentsForList.length
  const active = parentsForList.filter((p) => p.status !== 'disabled').length
  const linked = parentsForList.filter((p) => p.links.length > 0).length

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Parent Management</h1>
            <Badge variant="secondary">School Admin</Badge>
          </div>
          <p className="text-gray-600 mt-1">Create parent accounts and link parents to wards.</p>
        </div>
        <div className="flex gap-2">
          <LinkParentDialog
            parents={parentsForList.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }))}
            students={students.map((s) => ({ id: s.id, name: s.full_name, admission_number: s.admission_number }))}
          />
          <CreateParentDialog
            students={students.map((s) => ({
              id: s.id,
              name: s.full_name,
              admission_number: s.admission_number,
              guardian_name: s.guardian_name,
              guardian_email: s.guardian_email,
              guardian_phone: s.guardian_phone,
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Total Parents</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Active</p>
            <p className="text-3xl font-bold text-green-700 mt-2">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Linked To Wards</p>
            <p className="text-3xl font-bold text-blue-700 mt-2">{linked}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Parents</CardTitle>
          <CardDescription>Manage linked wards and account status.</CardDescription>
        </CardHeader>
        <CardContent>
          {parentsForList.length === 0 ? (
            <p className="text-sm text-gray-500">No parents linked to this school yet.</p>
          ) : (
            <ParentsList parents={parentsForList} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
