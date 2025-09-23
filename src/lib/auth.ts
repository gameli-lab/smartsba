import { supabase } from './supabase'
import { UserRole, UserProfile } from '@/types'
import type { User } from '@supabase/supabase-js'

export interface LoginCredentials {
  identifier: string // Email, Staff ID, Admission Number, or Parent Name
  password: string
  role: UserRole
  schoolId?: string // School ID for multi-school verification
  wardAdmissionNumber?: string // For parent login
}

export interface AuthResult {
  user: User
  profile: UserProfile
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

  // School Admin & Teacher login with Staff ID and School verification
  static async loginStaff(staffId: string, password: string, schoolId?: string): Promise<AuthResult> {
    // Find user by staff_id and optionally school_id
    const query = supabase
      .from('user_profiles')
      .select('*')
      .eq('staff_id', staffId)
      .in('role', ['school_admin', 'teacher'])

    // If school ID provided, verify user belongs to that school
    if (schoolId) {
      query.eq('school_id', schoolId)
    }

    const { data: profile, error: profileError } = await query.single()

    if (profileError || !profile) {
      throw new Error(schoolId 
        ? 'Invalid staff credentials or user does not belong to selected school'
        : 'Invalid staff credentials'
      )
    }

    const typedProfile = profile as UserProfile

    // Additional security check - if school was provided, ensure it matches
    if (schoolId && typedProfile.school_id !== schoolId) {
      throw new Error('User does not belong to the selected school')
    }

    // Get the user's email from the profile to sign in
    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: typedProfile.email,
      password,
    })

    if (authError) throw authError

    // Set custom JWT claims for proper authorization
    await AuthService.setUserClaims(authUser.user.id)

    return { user: authUser.user, profile: typedProfile }
  }

  // Student login with Admission Number and School verification
  static async loginStudent(admissionNumber: string, password: string, schoolId?: string): Promise<AuthResult> {
    // Find user by admission_number and optionally school_id
    const query = supabase
      .from('user_profiles')
      .select('*')
      .eq('admission_number', admissionNumber)
      .eq('role', 'student')

    // If school ID provided, verify user belongs to that school
    if (schoolId) {
      query.eq('school_id', schoolId)
    }

    const { data: profile, error: profileError } = await query.single()

    if (profileError || !profile) {
      throw new Error(schoolId 
        ? 'Invalid student credentials or user does not belong to selected school'
        : 'Invalid student credentials'
      )
    }

    const typedProfile = profile as UserProfile

    // Additional security check - if school was provided, ensure it matches
    if (schoolId && typedProfile.school_id !== schoolId) {
      throw new Error('User does not belong to the selected school')
    }

    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: typedProfile.email,
      password,
    })

    if (authError) throw authError

    return { user: authUser.user, profile: typedProfile }
  }

  // Parent login with Parent Name + Ward Admission Number and School verification
  static async loginParent(parentName: string, wardAdmissionNumber: string, password: string, schoolId?: string): Promise<AuthResult> {
    // Build query to find parent by name and verify ward connection
    let query = supabase
      .from('user_profiles')
      .select(`
        *,
        parent_student_relationships!inner(
          student:students!inner(
            admission_number,
            school_id,
            user_profiles!inner(full_name)
          )
        )
      `)
      .eq('role', 'parent')
      .eq('full_name', parentName)
      .eq('parent_student_relationships.student.admission_number', wardAdmissionNumber)

    // If school ID provided, verify ward belongs to that school
    if (schoolId) {
      query = query.eq('parent_student_relationships.student.school_id', schoolId)
    }

    const { data: parentProfile, error: parentError } = await query.single()

    if (parentError || !parentProfile) {
      throw new Error(schoolId 
        ? 'Invalid parent credentials, ward not found, or ward does not belong to selected school'
        : 'Invalid parent credentials or ward not found'
      )
    }

    const typedProfile = parentProfile as UserProfile

    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: typedProfile.email,
      password,
    })

    if (authError) throw authError

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
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session) return null

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (profileError || !profile) return null

    return { user: session.user, profile: profile as UserProfile }
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
  // Note: This requires the database function to be available
  static async setUserClaims(userId: string): Promise<void> {
    try {
      // For now, we'll comment this out until we can verify the function works
      // The RLS policies will fall back to basic auth.uid() checks
      console.log('Setting claims for user:', userId)
      
      // TODO: Uncomment once the custom claims function is verified to work
      // const { error } = await supabase.rpc('set_custom_claims', { user_id: userId })
      // if (error) {
      //   console.error('Failed to set custom claims:', error)
      // }
    } catch (err) {
      console.error('Error setting custom claims:', err)
    }
  }
}
