import { requireSchoolAdmin } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeachersList } from '@/app/(school-admin)/school-admin/teachers/teachers-list'
import { CreateTeacherDialog } from '@/app/(school-admin)/school-admin/teachers/create-teacher-dialog'
import { ImportTeachersDialog } from './import-teachers-dialog'
import { TeachersFilters } from './teachers-filters'
import { Badge } from '@/components/ui/badge'
import type { Teacher, UserProfile, Class, Subject } from '@/types'

interface TeacherWithProfile extends Teacher {
  user_profile: UserProfile
  teacher_assignments: { count: number }[]
}

/**
 * Teacher Management Page
 */
export default async function TeachersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = createAdminSupabaseClient()

  // Current academic session badge
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term, is_current')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  const [{ data: classesData }, { data: subjectsData }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, level, stream')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name, code, class_id')
      .eq('school_id', schoolId)
      .order('name'),
  ])

  // Build base query with filters
  let teachersQuery = supabase
    .from('teachers')
    .select(`
      *
    `)
    .eq('school_id', schoolId)

  // Apply search filter (name or staff_id)
  const search = searchParams.search as string | undefined
  if (search) {
    teachersQuery = teachersQuery.or(
      `user_profile.full_name.ilike.%${search}%,user_profile.staff_id.ilike.%${search}%`
    )
  }

  // Apply status filter
  const status = searchParams.status as string | undefined
  if (status === 'active') {
    teachersQuery = teachersQuery.eq('is_active', true)
  } else if (status === 'inactive') {
    teachersQuery = teachersQuery.eq('is_active', false)
  }

  // Apply class/subject filters using teacher_assignments lookups
  const classId = searchParams.classId as string | undefined
  const subjectId = searchParams.subjectId as string | undefined

  if (classId || subjectId) {
    const assignmentQuery = supabase
      .from('teacher_assignments')
      .select('teacher_id, teachers!inner(school_id)')
      .eq('teachers.school_id', schoolId)
    if (classId) assignmentQuery.eq('class_id', classId)
    if (subjectId) assignmentQuery.eq('subject_id', subjectId)

    type AssignmentRow = { teacher_id: string }
    const { data: assignmentRows } = await assignmentQuery
    const teacherIds = Array.from(new Set((assignmentRows ?? []).map((row: AssignmentRow) => row.teacher_id)))

    if (teacherIds.length === 0) {
      teachersQuery = teachersQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    } else {
      teachersQuery = teachersQuery.in('id', teacherIds)
    }
  }

  const { data: rawTeachers, error: teachersError } = await teachersQuery.order('created_at', { ascending: false })
  
  if (teachersError) {
    console.error('Error fetching teachers:', teachersError)
  }

  console.log('Teachers query result:', { count: rawTeachers?.length, error: teachersError })

  // Fetch user profiles for all teachers
  if (rawTeachers && rawTeachers.length > 0) {
    const userIds = (rawTeachers as any[]).map(t => t.user_id)
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, id, full_name, email, staff_id, phone, gender, date_of_birth, address, status')
      .in('user_id', userIds)

    // Create a map of user_id -> profile
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]))

    // Attach profiles to teachers
    const teachersWithProfiles = (rawTeachers as any[]).map(t => ({
      ...t,
      user_profile: profileMap.get(t.user_id),
      teacher_assignments: []
    }))

    const teachers = teachersWithProfiles as TeacherWithProfile[]
    
    return renderTeachersPage(teachers, classesData, subjectsData, currentSession)
  }

  const teachers: TeacherWithProfile[] = []
  return renderTeachersPage(teachers, classesData, subjectsData, currentSession)
}

function renderTeachersPage(
  teachers: TeacherWithProfile[],
  classesData: any,
  subjectsData: any,
  currentSession: any
) {
  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Management</h1>
          <p className="text-gray-600 mt-1">
            Manage teachers, their information, and status
          </p>
          {currentSession && (
            <div className="mt-2">
              <Badge variant="secondary">
                Term {currentSession.term} • {currentSession.academic_year}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <ImportTeachersDialog />
          <CreateTeacherDialog />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Teachers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {teachers.length}
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">👥</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Teachers</p>
                <p className="text-3xl font-bold text-green-700 mt-2">
                  {teachers.filter(t => t.is_active).length}
                </p>
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
                <p className="text-sm font-medium text-gray-600">Inactive Teachers</p>
                <p className="text-3xl font-bold text-gray-500 mt-2">
                  {teachers.filter(t => !t.is_active).length}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-gray-600">⏸</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teachers List */}
      <Card>
        <CardHeader>
          <CardTitle>All Teachers</CardTitle>
          <CardDescription>
            View and manage all teachers in your school
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeachersFilters classes={(classesData || []) as Class[]} subjects={(subjectsData || []) as Subject[]} />
          {teachers.length > 0 ? (
            <TeachersList teachers={teachers} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No teachers found</p>
              <CreateTeacherDialog />
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}