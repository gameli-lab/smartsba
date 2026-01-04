import { requireSchoolAdmin } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateStudentDialog } from '@/app/(school-admin)/school-admin/students/create-student-dialog'
import { ImportStudentsDialog } from '@/app/(school-admin)/school-admin/students/import-students-dialog'
import { StudentsList } from '@/app/(school-admin)/school-admin/students/students-list'
import { StudentsFilters } from '@/app/(school-admin)/school-admin/students/students-filters'
import type { Student, UserProfile, Class } from '@/types'

interface StudentWithRelations extends Student {
  user_profile: UserProfile
  classes: Class
}

export const dynamic = 'force-dynamic'

export default async function StudentsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = createAdminSupabaseClient()

  // Get current academic session
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term, is_current')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  // Fetch students and classes separately, then manually join profiles
  let studentsQuery = supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId)

  // Apply class filter
  const classId = searchParams.classId as string | undefined
  if (classId) {
    studentsQuery = studentsQuery.eq('class_id', classId)
  }

  // Apply status filter
  const status = searchParams.status as string | undefined
  if (status === 'active') {
    studentsQuery = studentsQuery.eq('is_active', true)
  } else if (status === 'inactive') {
    studentsQuery = studentsQuery.eq('is_active', false)
  }

  const [{ data: studentsData }, { data: classesData }] = await Promise.all([
    studentsQuery.order('created_at', { ascending: false }),
    supabase
      .from('classes')
      .select('id, name, level, stream')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
  ])

  const students = (studentsData || []) as Student[]
  const classes = (classesData || []) as Class[]

  // Manually fetch user profiles for all students
  const userIds = students.map(s => s.user_id).filter(Boolean)
  
  const { data: profilesData } = await supabase
    .from('user_profiles')
    .select('*')
    .in('user_id', userIds)

  const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]))
  const classesMap = new Map(classes.map(c => [c.id, c]))

  // Combine data manually
  const studentsWithRelations: StudentWithRelations[] = students
    .map(student => {
      const user_profile = profilesMap.get(student.user_id)
      const studentClass = classesMap.get(student.class_id)
      if (!user_profile || !studentClass) return null
      return {
        ...student,
        user_profile,
        classes: studentClass
      }
    })
    .filter(Boolean) as StudentWithRelations[]

  // Apply search filter on the combined data
  const search = searchParams.search as string | undefined
  const filteredStudents = search
    ? studentsWithRelations.filter(s =>
        s.user_profile.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.user_profile.admission_number?.toLowerCase().includes(search.toLowerCase())
      )
    : studentsWithRelations

  const total = filteredStudents.length
  const active = filteredStudents.filter((s) => s.is_active).length
  const inactive = total - active

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Student Management</h1>
            {currentSession && (
              <Badge variant="secondary">
                Term {currentSession.term} • {currentSession.academic_year}
              </Badge>
            )}
          </div>
          <p className="text-gray-600 mt-1">Manage students, their classes, and status</p>
        </div>
        <div className="flex gap-2">
          <ImportStudentsDialog classes={classes} />
          <CreateStudentDialog classes={classes} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{total}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">🎓</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-3xl font-bold text-green-700 mt-2">{active}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-green-600">✔</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-3xl font-bold text-gray-500 mt-2">{inactive}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-gray-600">⏸</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Students</CardTitle>
          <CardDescription>View and manage all students</CardDescription>
        </CardHeader>
        <CardContent>
          <StudentsFilters classes={classes} />
          {filteredStudents.length ? (
            <StudentsList students={filteredStudents} classes={classes} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No students found</p>
              <CreateStudentDialog classes={classes} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
