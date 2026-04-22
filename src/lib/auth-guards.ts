import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { supabase, createServerComponentClient, createAdminSupabaseClient } from './supabase'
import { UserProfile, Teacher, TeacherAssignment, Student } from '@/types'
import { isMfaCookieVerified, MFA_VERIFIED_COOKIE_NAME } from '@/lib/mfa-session'
import { getAssumeRoleContextForActor } from '@/lib/assume-role'
import type { AuthResult } from './auth'

type User = NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>

export interface TeacherGuardResult extends AuthResult {
  teacher: Teacher
  assignments: TeacherAssignment[]
  effectiveRole: 'class_teacher' | 'subject_teacher'
}

export interface StudentGuardResult extends AuthResult {
  student: Student | null
}

export interface ParentGuardResult extends AuthResult {
  wards: Array<{
    student: Student
    relationship: string
    is_primary: boolean
  }>
}

type GuardRole = 'school_admin' | 'teacher' | 'student' | 'parent'

type RoleGuardContext = {
  actorUser: User
  effectiveUser: User
  profile: UserProfile
  isAssumed: boolean
}

async function requirePrivilegedMfa(userId: string): Promise<void> {
  const supabaseAdmin = createAdminSupabaseClient()
  const { data: enrollment } = await (supabaseAdmin as any)
    .from('mfa_enrollments')
    .select('enabled, last_used_at')
    .eq('user_id', userId)
    .maybeSingle()

  const enrollmentRow = enrollment as { enabled?: boolean; last_used_at?: string | null } | null
  if (!enrollmentRow?.enabled || !enrollmentRow.last_used_at) {
    redirect('/mfa-challenge')
  }

  const cookieStore = await cookies()
  const providedCookie = cookieStore.get(MFA_VERIFIED_COOKIE_NAME)?.value

  if (!isMfaCookieVerified(userId, enrollmentRow.last_used_at, providedCookie)) {
    redirect('/mfa-challenge')
  }
}

async function resolveRoleGuardContext(requiredRole: GuardRole): Promise<RoleGuardContext> {
  const serverSupabase = await createServerComponentClient()

  const { data: { user }, error } = await serverSupabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  const currentUser = user as User

  const { data: actorProfileRow, error: actorProfileError } = await serverSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', currentUser.id)
    .single()

  if (actorProfileError || !actorProfileRow) {
    redirect('/login')
  }

  const actorProfile = actorProfileRow as unknown as UserProfile

  if (actorProfile.role === requiredRole) {
    if (requiredRole === 'school_admin') {
      await requirePrivilegedMfa(currentUser.id)
    }

    return {
      actorUser: currentUser,
      effectiveUser: currentUser,
      profile: actorProfile,
      isAssumed: false,
    }
  }

  if (actorProfile.role !== 'super_admin') {
    redirect('/login')
  }

  await requirePrivilegedMfa(currentUser.id)

  const assumeContext = await getAssumeRoleContextForActor(currentUser.id)
  if (!assumeContext || assumeContext.assumedRole !== requiredRole) {
    redirect('/dashboard/super-admin')
  }

  const resolvedAssumeContext = assumeContext as NonNullable<typeof assumeContext>

  const adminSupabase = createAdminSupabaseClient()
  const { data: assumedProfileRow, error: assumedProfileError } = await adminSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', resolvedAssumeContext.assumedUserId)
    .eq('role', requiredRole)
    .maybeSingle()

  if (assumedProfileError || !assumedProfileRow) {
    redirect('/dashboard/super-admin')
  }

  const assumedProfile = assumedProfileRow as unknown as UserProfile
  const effectiveUser = {
    ...currentUser,
    id: assumedProfile.user_id,
    email: assumedProfile.email || currentUser.email,
  } as User

  return {
    actorUser: currentUser,
    effectiveUser,
    profile: assumedProfile,
    isAssumed: true,
  }
}

export async function requireSchoolAdmin(): Promise<AuthResult> {
  const context = await resolveRoleGuardContext('school_admin')

  if (!context.profile.school_id) {
    redirect('/login')
  }

  return { user: context.effectiveUser, profile: context.profile }
}

export async function requireSuperAdmin(): Promise<AuthResult> {
  const serverSupabase = await createServerComponentClient()

  const { data: { user }, error } = await serverSupabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const currentUser = user as User

  const { data: profile, error: profileError } = await serverSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', currentUser.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  const typedProfile = profile as unknown as UserProfile

  if (typedProfile.role !== 'super_admin') {
    redirect('/login')
  }

  await requirePrivilegedMfa(currentUser.id)

  return { user: currentUser, profile: typedProfile }
}

export async function requireTeacher(): Promise<TeacherGuardResult> {
  const context = await resolveRoleGuardContext('teacher')
  const sourceSupabase = context.isAssumed ? createAdminSupabaseClient() : await createServerComponentClient()

  const { data: teacherRow } = await sourceSupabase
    .from('teachers')
    .select('*')
    .eq('user_id', context.effectiveUser.id)
    .single()

  const currentTeacher = teacherRow as Teacher | null
  if (!currentTeacher || currentTeacher.school_id !== context.profile.school_id) {
    redirect('/login')
  }

  const teacher = currentTeacher as Teacher

  const { data: assignmentRows } = await sourceSupabase
    .from('teacher_assignments')
    .select('id, teacher_id, class_id, subject_id, is_class_teacher, academic_year')
    .eq('teacher_id', teacher.id)

  const assignments = (assignmentRows || []) as TeacherAssignment[]
  const effectiveRole = assignments.some((a) => a.is_class_teacher) ? 'class_teacher' : 'subject_teacher'

  return {
    user: context.effectiveUser,
    profile: context.profile,
    teacher,
    assignments,
    effectiveRole,
  }
}

export async function requireStudent(): Promise<StudentGuardResult> {
  const context = await resolveRoleGuardContext('student')
  const sourceSupabase = context.isAssumed ? createAdminSupabaseClient() : await createServerComponentClient()

  const { data: studentRow } = await sourceSupabase
    .from('students')
    .select('*')
    .eq('user_id', context.effectiveUser.id)
    .maybeSingle()

  return {
    user: context.effectiveUser,
    profile: context.profile,
    student: studentRow ? (studentRow as Student) : null,
  }
}

export async function requireParent(): Promise<ParentGuardResult> {
  const adminSupabase = createAdminSupabaseClient()
  const context = await resolveRoleGuardContext('parent')
  const parentProfile = context.profile

  type ParentLinkRow = {
    relationship: string
    is_primary: boolean
    student_id: string
  }

  const fetchParentLinks = async () => {
    const { data: linkRows, error: linkError } = await adminSupabase
      .from('parent_student_links')
      .select('relationship, is_primary, student_id')
      .eq('parent_id', parentProfile.id)

    if (linkError) {
      console.warn('requireParent link query failed on parent_student_links, retrying via relationship view', linkError)
      const { data: fallbackRows, error: fallbackError } = await adminSupabase
        .from('parent_student_relationships')
        .select('relationship, is_primary, student_id')
        .eq('parent_id', parentProfile.id)

      if (fallbackError) {
        return [] as ParentLinkRow[]
      }

      return (fallbackRows || []) as ParentLinkRow[]
    }

    return (linkRows || []) as ParentLinkRow[]
  }

  let links = await fetchParentLinks()

  if (links.length === 0) {
    const { data: parentProfileRow } = await adminSupabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', context.effectiveUser.id)
      .eq('role', 'parent')
      .maybeSingle()

    const parentProfileRecord = parentProfileRow as { id: string } | null

    if (parentProfileRecord?.id) {
      const { data: adminLinks } = await adminSupabase
        .from('parent_student_links')
        .select('relationship, is_primary, student_id')
        .eq('parent_id', parentProfileRecord.id)

      links = (adminLinks || []) as ParentLinkRow[]
    }
  }

  const studentIds = Array.from(new Set(links.map((link) => link.student_id)))
  const studentsById = new Map<string, Student>()

  if (studentIds.length > 0) {
    const { data: studentRows } = await adminSupabase
      .from('students')
      .select('*')
      .in('id', studentIds)

    ;(studentRows || []).forEach((studentRow: Student) => {
      studentsById.set(studentRow.id, studentRow)
    })
  }

  const wards = links
    .map((link) => {
      const student = studentsById.get(link.student_id)

      if (!student) {
        return null
      }

      return {
        student,
        relationship: link.relationship,
        is_primary: link.is_primary,
      }
    })
    .filter((ward): ward is { student: Student; relationship: string; is_primary: boolean } => ward !== null)

  return {
    user: context.effectiveUser,
    profile: context.profile,
    wards,
  }
}
