import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { AssignmentsClient } from './assignments-client'
import type { Class, Subject, Teacher, UserProfile } from '@/types'

interface TeacherWithProfile extends Teacher {
  user_profile: UserProfile
}

export default async function TeacherAssignmentsPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  const [{ data: classesData }, { data: subjectsData }, { data: teachersData }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, level, stream, class_teacher_id')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name, code, class_id')
      .eq('school_id', schoolId)
      .order('name'),
    supabase
      .from('teachers')
      .select(`
        id,
        staff_id,
        is_active,
        user_profile:user_profiles!inner(
          id,
          full_name,
          email
        )
      `)
      .eq('school_id', schoolId)
      .order('staff_id'),
  ])

  const classes = (classesData || []) as Class[]
  const subjects = (subjectsData || []) as Subject[]
  const teachers = (teachersData || []) as TeacherWithProfile[]

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

  const clientSubjects = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    class_id: s.class_id,
  }))

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
