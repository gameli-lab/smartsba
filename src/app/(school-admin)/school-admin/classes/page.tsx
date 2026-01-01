import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateClassDialog } from './create-class-dialog'
import { ClassesList } from './classes-list'
import type { Class } from '@/types'

interface TeacherOption {
  id: string
  full_name: string
  staff_id: string
  is_active: boolean
}

interface ClassWithTeacher extends Class {
  class_teacher?: TeacherOption | null
}

export default async function ClassesPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  const [{ data: classesData }, { data: teachersData }] = await Promise.all([
    supabase
      .from('classes')
      .select(`
        id,
        name,
        level,
        stream,
        description,
        class_teacher_id,
        created_at,
        updated_at
      `)
      .eq('school_id', schoolId)
      .order('level', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('teachers')
      .select(`
        id,
        staff_id,
        is_active,
        user_profile:user_profiles!inner(
          id,
          full_name
        )
      `)
      .eq('school_id', schoolId)
      .order('staff_id'),
  ])

  const teachers: TeacherOption[] = (teachersData || []).map((t: any) => ({
    id: t.id,
    full_name: t.user_profile.full_name,
    staff_id: t.staff_id,
    is_active: t.is_active,
  }))

  const classesWithTeachers: ClassWithTeacher[] = (classesData || []).map((c: any) => ({
    ...c,
    class_teacher: c.class_teacher_id
      ? teachers.find((t) => t.id === c.class_teacher_id) || null
      : null,
  }))

  const total = classesWithTeachers.length
  const withTeachers = classesWithTeachers.filter((c) => c.class_teacher_id).length

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-600 mt-1">Manage classes, levels, and class teachers</p>
        </div>
        <CreateClassDialog teachers={teachers} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Classes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{total}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">📚</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">With Teachers</p>
                <p className="text-3xl font-bold text-green-700 mt-2">{withTeachers}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-green-600">👨‍🏫</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Without Teachers</p>
                <p className="text-3xl font-bold text-gray-500 mt-2">{total - withTeachers}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-gray-600">⚠️</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Classes</CardTitle>
          <CardDescription>View and manage all classes</CardDescription>
        </CardHeader>
        <CardContent>
          {classesWithTeachers.length ? (
            <ClassesList classes={classesWithTeachers} teachers={teachers} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No classes created yet</p>
              <CreateClassDialog teachers={teachers} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
