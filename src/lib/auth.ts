import { redirect } from 'next/navigation'
import { supabase, createServerComponentClient, createAdminSupabaseClient } from './supabase'
import { UserRole, UserProfile, Teacher, TeacherAssignment, Student } from '@/types'
import type { User } from '@supabase/supabase-js'

export interface LoginCredentials {
  identifier: string // Email, Staff ID, Admission Number, or Parent Name/Email
  password: string
  role: UserRole
  schoolId?: string // School ID for multi-school verification (optional - can be discovered)
  wardAdmissionNumber?: string // For parent login
}

export interface AuthResult {
  user: User
  profile: UserProfile
}

export interface SchoolOption {
  id: string
  name: string
}

type LookupProfile = Partial<UserProfile> & {
  schools?: { id: string; name: string } | null
}

/**
 * Custom error thrown when multiple schools are found for an identifier
 * Frontend should catch this and show a school selection dialog
 */
export class MultipleSchoolsFoundError extends Error {
  schools: SchoolOption[]

  constructor(schools: SchoolOption[]) {
    super('Multiple schools found for this identifier')
    this.name = 'MultipleSchoolsFoundError'
    this.schools = schools
  }
}

export class AuthService {
  // Super Admin login with email
  static async loginSuperAdmin(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    // Verify role is super_admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      throw new Error('Invalid super admin credentials')
    }

    const typedProfile = profile as UserProfile
    if (typedProfile.role !== 'super_admin') {
      await supabase.auth.signOut()
      throw new Error('Invalid super admin credentials')
    }

    // Set custom JWT claims for proper authorization
    await AuthService.setUserClaims(data.user.id)

    return { user: data.user, profile: typedProfile }
  }

  // School Admin & Teacher login with Staff ID and optional School verification
  static async loginStaff(staffId: string, password: string, schoolId?: string): Promise<AuthResult> {
    const normalizedStaffId = staffId.trim()

    if (!normalizedStaffId) {
      throw new Error('Staff ID is required')
    }

    // Use server-side lookup endpoint (service role) to bypass RLS on user_profiles
    const lookupResponse = await fetch('/api/auth/staff-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: normalizedStaffId, schoolId }),
    })

    if (!lookupResponse.ok) {
      throw new Error('Failed to look up staff credentials')
    }

    const { profiles } = (await lookupResponse.json()) as { profiles: LookupProfile[] }

    if (!profiles || profiles.length === 0) {
      throw new Error('Invalid staff credentials')
    }

    // If multiple schools found and no schoolId provided, ask user to select
    if (profiles.length > 1 && !schoolId) {
      const schools = profiles
        .map((p) => ({
          id: p.school_id,
        name: p.schools?.name || 'Unknown School',
        }))
        .filter((school): school is SchoolOption => Boolean(school.id))
      throw new MultipleSchoolsFoundError(schools)
    }

    const profile = profiles[0] as UserProfile

    // Additional security check - if school was provided, ensure it matches
    if (schoolId && profile.school_id !== schoolId) {
      throw new Error('User does not belong to the selected school')
    }

    // Get the user's email from the profile to sign in
    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    })

    if (authError) throw authError

    // Set custom JWT claims for proper authorization
    await AuthService.setUserClaims(authUser.user.id)

    return { user: authUser.user, profile }
  }

  // Student login with Admission Number and optional School verification
  static async loginStudent(admissionNumber: string, password: string, schoolId?: string): Promise<AuthResult> {
    const normalizedAdmission = admissionNumber.trim()

    if (!normalizedAdmission) {
      throw new Error('Admission number is required')
    }

    const lookupResponse = await fetch('/api/auth/student-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admissionNumber: normalizedAdmission, schoolId }),
    })

    if (!lookupResponse.ok) {
      throw new Error('Failed to look up student credentials')
    }

    const { profiles } = (await lookupResponse.json()) as { profiles: LookupProfile[] }

    if (!profiles || profiles.length === 0) {
      throw new Error('Invalid student credentials')
    }

    // If multiple schools found and no schoolId provided, ask user to select
    if (profiles.length > 1 && !schoolId) {
      const schools = profiles
        .map((p) => ({
          id: p.school_id,
        name: p.schools?.name || 'Unknown School',
        }))
        .filter((school): school is SchoolOption => Boolean(school.id))
      throw new MultipleSchoolsFoundError(schools)
    }

    const typedProfile = profiles[0] as UserProfile

    // Additional security check - if school was provided, ensure it matches
    if (schoolId && typedProfile.school_id !== schoolId) {
      throw new Error('User does not belong to the selected school')
    }

    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: typedProfile.email,
      password,
    })

    if (authError) throw authError

    // Set custom JWT claims for proper authorization
    await AuthService.setUserClaims(authUser.user.id)

    return { user: authUser.user, profile: typedProfile }
  }

  // Parent login with Parent Name/Email + Ward Admission Number and optional School verification
  static async loginParent(parentName: string, wardAdmissionNumber: string, password: string, schoolId?: string): Promise<AuthResult> {
    const lookupResponse = await fetch('/api/auth/parent-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentName: parentName.trim(),
        wardAdmissionNumber: wardAdmissionNumber.trim(),
        schoolId,
      }),
    })

    if (!lookupResponse.ok) {
      throw new Error('Failed to look up parent credentials')
    }

    const { profiles: parentProfiles, reason } = (await lookupResponse.json()) as {
      profiles: LookupProfile[]
      reason?: 'no_parent_link_for_ward' | 'identifier_not_matching_linked_parent' | 'single_link_parent_fallback' | null
    }

    if (!parentProfiles || parentProfiles.length === 0) {
      if (reason === 'no_parent_link_for_ward') {
        throw new Error('No parent account is linked to that ward admission number in the selected school')
      }
      if (reason === 'identifier_not_matching_linked_parent') {
        throw new Error('Parent name/email does not match the linked parent account for that ward')
      }
      throw new Error('Invalid parent name/email, password, or ward admission number')
    }

    // If multiple schools found and no schoolId provided, ask user to select
    if (parentProfiles.length > 1 && !schoolId) {
      const schools = parentProfiles
        .map((p) => ({
          id: p.school_id,
          name: p.schools?.name || 'Unknown School',
        }))
        .filter((school): school is SchoolOption => Boolean(school.id))
      // Deduplicate schools
      const uniqueSchools = Array.from(new Map(schools.map((s) => [s.id, s])).values())
      if (uniqueSchools.length > 1) {
        throw new MultipleSchoolsFoundError(uniqueSchools)
      }
    }

    const typedProfile = parentProfiles[0] as UserProfile

    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: typedProfile.email,
      password,
    })

    if (authError) throw authError

    // Ensure we authenticated the exact parent account resolved by lookup.
    if (typedProfile.user_id !== authUser.user.id) {
      await supabase.auth.signOut()
      throw new Error('Resolved parent account does not match authenticated user')
    }

    // Set custom JWT claims for proper authorization
    await AuthService.setUserClaims(authUser.user.id)

    return { user: authUser.user, profile: typedProfile }
  }

  // Universal login function
  static async login({ identifier, password, role, schoolId, wardAdmissionNumber }: LoginCredentials): Promise<AuthResult> {
    switch (role) {
      case 'super_admin':
        return this.loginSuperAdmin(identifier, password)
      
      case 'school_admin':
      case 'teacher':
        return this.loginStaff(identifier, password, schoolId)
      
      case 'student':
        return this.loginStudent(identifier, password, schoolId)
      
      case 'parent':
        if (!wardAdmissionNumber) {
          throw new Error('Ward admission number is required for parent login')
        }
        return this.loginParent(identifier, wardAdmissionNumber, password, schoolId)
      
      default:
        throw new Error('Invalid role specified')
    }
  }

  // Get current user session
  static async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) return null

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) return null

    return { user, profile: profile as UserProfile }
  }

  // Sign out
  static async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // Check if user has permission for school
  static async checkSchoolAccess(userId: string, schoolId: string): Promise<boolean> {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, school_id')
      .eq('user_id', userId)
      .single()

    if (!profile) return false

    const typedProfile = profile as UserProfile

    // Super admin has access to all schools
    if (typedProfile.role === 'super_admin') return true

    // Others are limited to their school
    return typedProfile.school_id === schoolId
  }

  // Set custom JWT claims for proper authorization with RLS policies
  // NOTE: Supabase doesn't support auth.jwt_custom_claims_set() on hosted instances
  // Storage RLS policies now query user_profiles table directly instead
  static async setUserClaims(userId: string): Promise<void> {
    // This function is kept for backwards compatibility but does nothing
    // The storage policies have been updated to query user_profiles directly
    console.log('setUserClaims called for user:', userId, '(no-op - policies use direct queries)')
  }
}

/**
 * Server-side auth guard for School Admin role
 * Use this in Server Components and Server Actions to enforce School Admin access
 * 
 * @throws {Error} If user is not authenticated or not a school_admin
 * @returns {Promise<{user: User, profile: UserProfile}>} Authenticated school admin user and profile
 */
export async function requireSchoolAdmin(): Promise<AuthResult> {
  const supabase = await createServerComponentClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  const typedProfile = profile as UserProfile
  
  if (typedProfile.role !== 'school_admin') {
    redirect('/login')
  }
  
  if (!typedProfile.school_id) {
    redirect('/login')
  }
  
  return { user, profile: typedProfile }
}

/**
 * Server-side auth guard for Super Admin role.
 * Use this in Server Components and layouts to enforce Super Admin-only access.
 *
 * @throws Redirects to /login if not authenticated or not super_admin
 * @returns Authenticated super admin user and profile
 */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const serverSupabase = await createServerComponentClient()

  const { data: { user }, error } = await serverSupabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await serverSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  const typedProfile = profile as UserProfile

  if (typedProfile.role !== 'super_admin') {
    redirect('/login')
  }

  return { user, profile: typedProfile }
}

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

/**
 * Server-side auth guard for Teacher role
 * Ensures the user is a teacher and returns their assignments.
 * If no assignments are found, the caller can decide how to render an empty state.
 */
export async function requireTeacher(): Promise<TeacherGuardResult> {
  const serverSupabase = await createServerComponentClient()
  
  const { data: { user }, error } = await serverSupabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await serverSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  const teacherProfile = profile as UserProfile

  if (teacherProfile.role !== 'teacher') {
    redirect('/login')
  }

  const { data: teacherRow } = await serverSupabase
    .from('teachers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!teacherRow || (teacherRow as Teacher).school_id !== teacherProfile.school_id) {
    redirect('/login')
  }

  const { data: assignmentRows } = await serverSupabase
    .from('teacher_assignments')
    .select('id, teacher_id, class_id, subject_id, is_class_teacher, academic_year')
    .eq('teacher_id', (teacherRow as Teacher).id)

  const assignments = (assignmentRows || []) as TeacherAssignment[]
  const effectiveRole = assignments.some((a) => a.is_class_teacher) ? 'class_teacher' : 'subject_teacher'

  return {
    user,
    profile: teacherProfile,
    teacher: teacherRow as Teacher,
    assignments,
    effectiveRole,
  }
}

/**
 * Server-side auth guard for Student role.
 * Redirects if not authenticated or not a student.
 * Returns student record if found; callers handle missing profile state.
 */
export async function requireStudent(): Promise<StudentGuardResult> {
  const serverSupabase = await createServerComponentClient()
  
  const { data: { user }, error } = await serverSupabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await serverSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  const studentProfile = profile as UserProfile

  if (studentProfile.role !== 'student') {
    redirect('/login')
  }

  const { data: studentRow } = await serverSupabase
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    user,
    profile: studentProfile,
    student: studentRow ? (studentRow as Student) : null,
  }
}

/**
 * Server-side auth guard for Parent role.
 * Redirects if not authenticated or not a parent.
 * Returns linked wards (students); callers handle empty wards state.
 */
export async function requireParent(): Promise<ParentGuardResult> {
  const serverSupabase = await createServerComponentClient()
  const adminSupabase = createAdminSupabaseClient()
  
  const { data: { user }, error } = await serverSupabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await serverSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  const parentProfile = profile as UserProfile

  if (parentProfile.role !== 'parent') {
    redirect('/login')
  }

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

  // Safety net: if session-scoped query unexpectedly returns no links,
  // verify with admin client so valid parents do not see false "No Linked Students".
  if (links.length === 0) {
    const { data: parentProfileRow } = await adminSupabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'parent')
      .maybeSingle()

    const parentProfile = parentProfileRow as { id: string } | null

    if (parentProfile?.id) {
      const { data: adminLinks } = await adminSupabase
        .from('parent_student_links')
        .select('relationship, is_primary, student_id')
        .eq('parent_id', parentProfile.id)

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

    ;(studentRows || []).forEach((studentRow) => {
      studentsById.set((studentRow as Student).id, studentRow as Student)
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
    user,
    profile: profile as UserProfile,
    wards,
  }
}
