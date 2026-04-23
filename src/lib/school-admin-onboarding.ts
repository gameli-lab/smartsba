import { createAdminSupabaseClient } from '@/lib/supabase'
import { generateCompliantPassword } from '@/lib/password-policy'
import { sendSchoolCreatedEmail } from '@/services/emailService'
import logAudit from '@/lib/audit'

export type SchoolAdminCredentialResult = {
  email: string
  username: string
  staff_id: string
  temporary_password: string | null
  login_url: string
  email_sent: boolean
  email_error?: string | null
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

function generateSecureTemporaryPassword(): string {
  return generateCompliantPassword(12, {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
  })
}

export async function provisionSchoolAdminAccount(input: SchoolAdminOnboardingInput): Promise<SchoolAdminCredentialResult> {
  const admin = createAdminSupabaseClient()
  const loginUrl = getLoginUrl()
  const normalizedEmail = input.adminEmail.trim().toLowerCase()
  const temporaryPassword = generateSecureTemporaryPassword()

  const existingUser = await findUserByEmail(normalizedEmail)

  let userId = existingUser?.id
  let assignedExisting = Boolean(existingUser)

  if (!existingUser) {
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
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
      password: temporaryPassword,
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
        password_change_required: true,
        password_changed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (profileError) {
    throw profileError
  }

  const emailResult = await sendSchoolCreatedEmail({
    schoolName: input.schoolName,
    adminName: input.adminName,
    adminEmail: normalizedEmail,
    adminUserId: userId,
    temporaryPassword,
    schoolId: input.schoolId,
  }).catch((error: unknown) => ({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' }))

  try {
    await logAudit(admin, input.actorUserId, 'school_admin_onboarded', 'user_profile', userId, {
      schoolId: input.schoolId,
      email: normalizedEmail,
      assigned_existing: assignedExisting,
      email_sent: emailResult.success,
    })
  } catch {
    // Non-blocking audit
  }

  return {
    email: normalizedEmail,
    username: normalizedEmail,
    staff_id: input.staffId,
    temporary_password: temporaryPassword,
    login_url: loginUrl,
    email_sent: emailResult.success,
    email_error: emailResult.success ? null : emailResult.error || 'Failed to send email',
    assigned_existing: assignedExisting,
    user_id: userId,
  }
}
