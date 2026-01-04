import { requireSchoolAdmin } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { AssignmentsClient } from './assignments-client'
import type { Class, Subject, Teacher, UserProfile } from '@/types'

export const dynamic = 'force-dynamic'

interface TeacherWithProfile extends Teacher {
  user_profile: UserProfile
}

export default async function TeacherAssignmentsPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = createAdminSupabaseClient()

  const [{ data: classesData }, { data: subjectsData }, { data: teachersData }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, level, stream, class_teacher_id')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name, code, level_group')
      .eq('school_id', schoolId)
      .order('name'),
    supabase
      .from('teachers')
      .select(`
        id,
        staff_id,
        is_active,
        user_id
      `)
      .eq('school_id', schoolId)
      .order('staff_id'),
  ])

  const classes = (classesData || []) as Class[]
  const subjects = (subjectsData || []) as Subject[]
  
  // Fetch user profiles for teachers separately (no FK)
  const enrichedTeachers: TeacherWithProfile[] = []
  if (teachersData && teachersData.length > 0) {
    const userIds = (teachersData as any[]).map(t => t.user_id)
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, id, full_name, email')
      .in('user_id', userIds)

    // Create a map of user_id -> profile
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]))

    // Attach profiles to teachers
    const teachersData_typed = teachersData as any[]
    enrichedTeachers.push(...teachersData_typed.map(t => ({
      ...t,
      user_profile: profileMap.get(t.user_id) || { id: '', user_id: t.user_id, full_name: 'Unknown', email: '' },
    })))
  }
  const teachers = enrichedTeachers

  const classIds = classes.map((c) => c.id)

  const { data: assignmentsData } = await supabase
    .from('teacher_assignments')
    .select(`
      id,
      class_id,
      subject_id,
      teacher_id,
      academic_year,
      classes(id, name, level, stream),
      subjects(id, name, code),
      teachers(id, staff_id, user_profile:user_profiles!inner(id, full_name))
    `)
    .in('class_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })

  const assignments = (assignmentsData || []).map((row: any) => ({
    id: row.id as string,
    class_id: row.class_id as string,
    subject_id: row.subject_id as string,
    teacher_id: row.teacher_id as string,
    academic_year: row.academic_year as string,
    class_name: row.classes?.name as string,
    class_level: row.classes?.level as number,
    class_stream: row.classes?.stream as string | null,
    subject_name: row.subjects?.name as string,
    subject_code: row.subjects?.code as string | null,
    teacher_name: row.teachers?.user_profile?.full_name as string,
    teacher_staff_id: row.teachers?.staff_id as string,
  }))

  const clientClasses = classes.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    stream: c.stream,
    class_teacher_id: (c as any).class_teacher_id || null,
  }))

  const clientSubjects = subjects.map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    level_group: s.level_group,
  }))

  console.log('Teacher assignments page data:', {
    classesCount: classes.length,
    subjectsCount: clientSubjects.length,
    teachersCount: teachers.length,
    subjectsData: clientSubjects.slice(0, 3)
  })

  const clientTeachers = teachers.map((t) => ({
    id: t.id,
    full_name: t.user_profile.full_name,
    staff_id: t.staff_id,
    email: t.user_profile.email,
    is_active: t.is_active,
  }))

  return (
    <div className="p-8">
      <AssignmentsClient
        classes={clientClasses}
        subjects={clientSubjects}
        teachers={clientTeachers}
        assignments={assignments}
      />
    </div>
  )
}
