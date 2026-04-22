import { supabase } from './supabase'
import { UserRole, UserProfile, Teacher, TeacherAssignment, Student } from '@/types'
import { getClientCsrfHeaders } from '@/lib/csrf'
import { buildMfaCookieValue, MFA_VERIFIED_COOKIE_NAME } from '@/lib/mfa-session'

type User = NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>

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

type LoginSecurityRole = 'super_admin' | 'staff' | 'student' | 'parent'

type LoginSecurityResponse = {
  locked?: boolean
  remainingMinutes?: number
  failedAttempts?: number
  retryAfterSeconds?: number
  error?: string
}

async function recordSecurityEvent(_: unknown): Promise<void> {
  // Security events are recorded from server-only paths. This no-op keeps
  // the client-safe auth helpers free of server-only imports.
}

async function callLoginSecurity(action: 'check' | 'record_failure' | 'record_success', params: {
  role: LoginSecurityRole
  identifier: string
  schoolId?: string
}): Promise<LoginSecurityResponse | null> {
  try {
    const response = await fetch('/api/auth/login-security', {
      method: 'POST',
      headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action, ...params }),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as LoginSecurityResponse
  } catch {
    return null
  }
}

function getLockoutMessage(remainingMinutes?: number): string {
  return `Account temporarily locked due to failed attempts. Try again in ${remainingMinutes ?? 1} minute(s).`
}

async function ensureNotLocked(params: {
  role: LoginSecurityRole
  identifier: string
  schoolId?: string
}) {
  const lockoutState = await callLoginSecurity('check', params)
  if (lockoutState?.locked) {
    throw new Error(getLockoutMessage(lockoutState.remainingMinutes))
  }
}

async function recordLoginFailure(params: {
  role: LoginSecurityRole
  identifier: string
  schoolId?: string
}) {
  const result = await callLoginSecurity('record_failure', params)
  if (result?.locked) {
    await recordSecurityEvent({
      actorRole: params.role,
      schoolId: params.schoolId,
      identifier: params.identifier,
      eventType: 'account_locked',
      metadata: {
        remaining_minutes: result.remainingMinutes,
        failed_attempts: result.failedAttempts,
      },
    })
    throw new Error(getLockoutMessage(result.remainingMinutes))
  }
}

async function clearLoginFailures(params: {
  role: LoginSecurityRole
  identifier: string
  schoolId?: string
}) {
  await callLoginSecurity('record_success', params)
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
  // SysAdmin login with email
  static async loginSuperAdmin(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase()
    await ensureNotLocked({ role: 'super_admin', identifier: normalizedEmail })

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      await recordLoginFailure({ role: 'super_admin', identifier: normalizedEmail })
      await recordSecurityEvent({
        actorRole: 'super_admin',
        identifier: normalizedEmail,
        eventType: 'login_failure',
        metadata: { reason: error.message },
      })
      throw error
    }

    // Verify role is super_admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      throw new Error('Invalid SysAdmin credentials')
    }

    const typedProfile = profile as UserProfile
    if (typedProfile.role !== 'super_admin') {
      await supabase.auth.signOut()
      throw new Error('Invalid SysAdmin credentials')
    }

    // Set custom JWT claims for proper authorization
    await AuthService.setUserClaims(data.user.id)
    await clearLoginFailures({ role: 'super_admin', identifier: normalizedEmail })
    await recordSecurityEvent({
      actorUserId: data.user.id,
      actorRole: 'super_admin',
      eventType: 'login_success',
      metadata: { method: 'password' },
    })

    return { user: data.user, profile: typedProfile }
  }

  // School Admin & Teacher login with Staff ID and optional School verification
  static async loginStaff(staffId: string, password: string, schoolId?: string): Promise<AuthResult> {
    const normalizedStaffId = staffId.trim()

    if (!normalizedStaffId) {
      throw new Error('Staff ID is required')
    }

    await ensureNotLocked({ role: 'staff', identifier: normalizedStaffId, schoolId })

    // Use server-side lookup endpoint (service role) to bypass RLS on user_profiles
    const lookupResponse = await fetch('/api/auth/staff-lookup', {
      method: 'POST',
      headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ staffId: normalizedStaffId, schoolId }),
    })

    if (!lookupResponse.ok) {
      const errorPayload = (await lookupResponse.json().catch(() => null)) as LoginSecurityResponse | null
      if (lookupResponse.status === 423) {
        throw new Error(errorPayload?.error || getLockoutMessage(errorPayload?.remainingMinutes))
      }
      if (lookupResponse.status === 429) {
        throw new Error(errorPayload?.error || 'Too many authentication attempts. Please try again later.')
      }
      throw new Error(errorPayload?.error || 'Failed to look up staff credentials')
    }

    const { profiles } = (await lookupResponse.json()) as { profiles: LookupProfile[] }

    if (!profiles || profiles.length === 0) {
      await recordLoginFailure({ role: 'staff', identifier: normalizedStaffId, schoolId })
      await recordSecurityEvent({
        actorRole: 'staff',
        schoolId,
        identifier: normalizedStaffId,
        eventType: 'login_failure',
        metadata: { reason: 'no_profiles_found' },
      })
      throw new Error('Invalid staff credentials')
    }

    const candidateProfiles = profiles as LookupProfile[]

    if (!schoolId) {
      const uniqueSchools = Array.from(
        new Map(
          candidateProfiles
            .map((p) => ({
              id: p.school_id,
              name: p.schools?.name || 'Unknown School',
            }))
            .filter((school): school is SchoolOption => Boolean(school.id))
            .map((school) => [school.id, school])
        ).values()
      )

      if (uniqueSchools.length > 1) {
        throw new MultipleSchoolsFoundError(uniqueSchools)
      }
    }

    const scopedCandidates = schoolId
      ? candidateProfiles.filter((profile) => profile.school_id === schoolId)
      : candidateProfiles

    if (schoolId && scopedCandidates.length === 0) {
      throw new Error('User does not belong to the selected school')
    }

    let lastAuthError: Error | null = null

    for (const profile of scopedCandidates) {
      if (!profile.email) {
        continue
      }

      const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      })

      if (authError) {
        lastAuthError = authError
        await recordSecurityEvent({
          actorRole: 'staff',
          schoolId,
          identifier: normalizedStaffId,
          eventType: 'login_failure',
          metadata: { email: profile.email, reason: authError.message },
        })
        continue
      }

      await AuthService.setUserClaims(authUser.user.id)
      await clearLoginFailures({ role: 'staff', identifier: normalizedStaffId, schoolId })
      await recordSecurityEvent({
        actorUserId: authUser.user.id,
        actorRole: profile.role,
        schoolId,
        identifier: normalizedStaffId,
        eventType: 'login_success',
        metadata: { email: profile.email },
      })
      return { user: authUser.user, profile: profile as UserProfile }
    }

    await recordLoginFailure({ role: 'staff', identifier: normalizedStaffId, schoolId })

    if (lastAuthError) {
      throw lastAuthError
    }

    throw new Error('Invalid staff credentials')
  }

  // Student login with Admission Number and optional School verification
  static async loginStudent(admissionNumber: string, password: string, schoolId?: string): Promise<AuthResult> {
    const normalizedAdmission = admissionNumber.trim()

    if (!normalizedAdmission) {
      throw new Error('Admission number is required')
    }

    await ensureNotLocked({ role: 'student', identifier: normalizedAdmission, schoolId })

    const lookupResponse = await fetch('/api/auth/student-lookup', {
      method: 'POST',
      headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ admissionNumber: normalizedAdmission, schoolId }),
    })

    if (!lookupResponse.ok) {
      const errorPayload = (await lookupResponse.json().catch(() => null)) as LoginSecurityResponse | null
      if (lookupResponse.status === 423) {
        throw new Error(errorPayload?.error || getLockoutMessage(errorPayload?.remainingMinutes))
      }
      if (lookupResponse.status === 429) {
        throw new Error(errorPayload?.error || 'Too many authentication attempts. Please try again later.')
      }
      throw new Error(errorPayload?.error || 'Failed to look up student credentials')
    }

    const { profiles } = (await lookupResponse.json()) as { profiles: LookupProfile[] }

    if (!profiles || profiles.length === 0) {
      await recordLoginFailure({ role: 'student', identifier: normalizedAdmission, schoolId })
      await recordSecurityEvent({
        actorRole: 'student',
        schoolId,
        identifier: normalizedAdmission,
        eventType: 'login_failure',
        metadata: { reason: 'no_profiles_found' },
      })
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

    if (authError) {
      await recordLoginFailure({ role: 'student', identifier: normalizedAdmission, schoolId })
      await recordSecurityEvent({
        actorRole: 'student',
        schoolId,
        identifier: normalizedAdmission,
        eventType: 'login_failure',
        metadata: { email: typedProfile.email, reason: authError.message },
      })
      throw authError
    }

    // Set custom JWT claims for proper authorization
    await AuthService.setUserClaims(authUser.user.id)
    await clearLoginFailures({ role: 'student', identifier: normalizedAdmission, schoolId })
    await recordSecurityEvent({
      actorUserId: authUser.user.id,
      actorRole: 'student',
      schoolId,
      identifier: normalizedAdmission,
      eventType: 'login_success',
      metadata: { email: typedProfile.email },
    })

    return { user: authUser.user, profile: typedProfile }
  }

  // Parent login with Parent Name/Email + Ward Admission Number and optional School verification
  static async loginParent(parentName: string, wardAdmissionNumber: string, password: string, schoolId?: string): Promise<AuthResult> {
    const normalizedParentName = parentName.trim()
    await ensureNotLocked({ role: 'parent', identifier: normalizedParentName, schoolId })

    const lookupResponse = await fetch('/api/auth/parent-lookup', {
      method: 'POST',
      headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        parentName: normalizedParentName,
        wardAdmissionNumber: wardAdmissionNumber.trim(),
        schoolId,
      }),
    })

    if (!lookupResponse.ok) {
      const errorPayload = (await lookupResponse.json().catch(() => null)) as LoginSecurityResponse | null
      if (lookupResponse.status === 423) {
        throw new Error(errorPayload?.error || getLockoutMessage(errorPayload?.remainingMinutes))
      }
      if (lookupResponse.status === 429) {
        throw new Error(errorPayload?.error || 'Too many authentication attempts. Please try again later.')
      }
      throw new Error(errorPayload?.error || 'Failed to look up parent credentials')
    }

    const { profiles: parentProfiles, reason } = (await lookupResponse.json()) as {
      profiles: LookupProfile[]
      reason?: 'no_parent_link_for_ward' | 'identifier_not_matching_linked_parent' | 'single_link_parent_fallback' | null
    }

    if (!parentProfiles || parentProfiles.length === 0) {
      await recordLoginFailure({ role: 'parent', identifier: normalizedParentName, schoolId })
      await recordSecurityEvent({
        actorRole: 'parent',
        schoolId,
        identifier: normalizedParentName,
        eventType: 'login_failure',
        metadata: { reason: 'no_profiles_found', wardAdmissionNumber: wardAdmissionNumber.trim() },
      })
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

    if (authError) {
      await recordLoginFailure({ role: 'parent', identifier: normalizedParentName, schoolId })
      await recordSecurityEvent({
        actorRole: 'parent',
        schoolId,
        identifier: normalizedParentName,
        eventType: 'login_failure',
        metadata: { email: typedProfile.email, reason: authError.message },
      })
      throw authError
    }

    // Ensure we authenticated the exact parent account resolved by lookup.
    if (typedProfile.user_id !== authUser.user.id) {
      await supabase.auth.signOut()
      throw new Error('Resolved parent account does not match authenticated user')
    }

    // Set custom JWT claims for proper authorization
    await AuthService.setUserClaims(authUser.user.id)
    await clearLoginFailures({ role: 'parent', identifier: normalizedParentName, schoolId })
    await recordSecurityEvent({
      actorUserId: authUser.user.id,
      actorRole: 'parent',
      schoolId,
      identifier: normalizedParentName,
      eventType: 'login_success',
      metadata: { email: typedProfile.email },
    })

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
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getClientCsrfHeaders({}),
      })
    } catch {
      // Ignore logout endpoint failures and continue with the client sign-out.
    }

    const { error } = await supabase.auth.signOut()
    if (error) throw error

    if (typeof document !== 'undefined') {
      document.cookie = `${MFA_VERIFIED_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
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

    // SysAdmin has access to all schools
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
