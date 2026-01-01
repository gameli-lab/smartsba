import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeachersList } from '@/app/(school-admin)/school-admin/teachers/teachers-list'
import { CreateTeacherDialog } from '@/app/(school-admin)/school-admin/teachers/create-teacher-dialog'
import { ImportTeachersDialog } from './import-teachers-dialog'
import type { Teacher, UserProfile } from '@/types'

interface TeacherWithProfile extends Teacher {
  user_profile: UserProfile
  teacher_assignments: { count: number }[]
}

/**
 * Teacher Management Page
 */
export default async function TeachersPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  // Fetch all teachers with their profile information and assignments count
  const { data: rawTeachers } = await supabase
    .from('teachers')
    .select(`
      *,
      user_profile:user_profiles!inner(
        id,
        full_name,
        email,
        staff_id,
        phone,
        gender,
        date_of_birth,
        address,
        status
      ),
      teacher_assignments(count)
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  
  const teachers = (rawTeachers || []) as TeacherWithProfile[]

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Management</h1>
          <p className="text-gray-600 mt-1">
            Manage teachers, their information, and status
          </p>
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
          {teachers.length > 0 ? (
            <TeachersList teachers={teachers} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No teachers added yet</p>
              <CreateTeacherDialog />
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
