import { createAdminSupabaseClient } from '@/lib/supabase'
import logAudit from '@/lib/audit'

export type SchoolAdminCredentialResult = {
  email: string
  username: string
  staff_id: string
  login_url: string
  assigned_existing: boolean
  user_id: string
}

export type SchoolAdminOnboardingInput = {
  schoolId: string
  schoolName: string
  adminName: string
  adminEmail: string
  staffId: string
  phone?: string | null
  actorUserId: string
}

function getLoginUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`
}

async function findUserByEmail(email: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.auth.admin.listUsers()

  if (error) {
    throw error
  }

  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null
}

async function findProfileByEmail(email: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('user_profiles')
    .select('id, user_id, school_id, role, email, full_name, staff_id')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as {
    id: string
    user_id: string
    school_id: string | null
    role: string
    email: string
    full_name: string
    staff_id: string | null
  } | null
}

export async function provisionSchoolAdminAccount(input: SchoolAdminOnboardingInput): Promise<SchoolAdminCredentialResult> {
  const admin = createAdminSupabaseClient()
  const loginUrl = getLoginUrl()
  const normalizedEmail = input.adminEmail.trim().toLowerCase()

  const existingUser = await findUserByEmail(normalizedEmail)
  const existingProfile = await findProfileByEmail(normalizedEmail)

  if (existingProfile?.role === 'super_admin') {
    throw new Error('This email belongs to a platform super admin account and cannot be reassigned as a school admin.')
  }

  if (existingProfile?.school_id && existingProfile.school_id !== input.schoolId) {
    throw new Error('This email already belongs to another school. Use a unique headmaster email for this school.')
  }

  let userId = existingUser?.id
  let assignedExisting = Boolean(existingUser)

  if (!existingUser) {
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: {
        full_name: input.adminName,
        role: 'school_admin',
        school_id: input.schoolId,
        created_by: input.actorUserId,
        created_at: new Date().toISOString(),
      },
    })

    if (createUserError || !createdUser.user) {
      throw createUserError || new Error('Failed to create school admin user')
    }

    userId = createdUser.user.id
  } else {
    const { error: updateUserError } = await admin.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      user_metadata: {
        full_name: input.adminName,
        role: 'school_admin',
        school_id: input.schoolId,
        updated_by: input.actorUserId,
        updated_at: new Date().toISOString(),
      },
      app_metadata: {
        role: 'school_admin',
        school_id: input.schoolId,
      },
    })

    if (updateUserError) {
      throw updateUserError
    }
  }

  if (existingProfile && existingProfile.school_id && existingProfile.school_id === input.schoolId) {
    assignedExisting = true
  }

  if (!userId) {
    throw new Error('Unable to resolve school admin user id')
  }

  const { error: profileError } = await admin
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        school_id: input.schoolId,
        role: 'school_admin',
        email: normalizedEmail,
        full_name: input.adminName,
        staff_id: input.staffId || null,
        phone: input.phone || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (profileError) {
    throw profileError
  }

  try {
    await logAudit(admin, input.actorUserId, 'school_admin_onboarded', 'user_profile', userId, {
      schoolId: input.schoolId,
      email: normalizedEmail,
      assigned_existing: assignedExisting,
      passwordless: true,
    })
  } catch {
    // Non-blocking audit
  }

  return {
    email: normalizedEmail,
    username: normalizedEmail,
    staff_id: input.staffId,
    login_url: loginUrl,
    assigned_existing: assignedExisting,
    user_id: userId,
  }
}
