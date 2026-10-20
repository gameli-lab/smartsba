"use server"

import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/auth-guards'
import { revalidatePath } from 'next/cache'

interface BulkResult {
  success: boolean
  successCount: number
  failureCount: number
  failures: Array<{ id: string; error: string }>
  message: string
}

interface RpcClient {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<unknown>
}

async function getSuperAdminSession() {
  try {
    const auth = await requireSuperAdmin()
    return { auth, error: null }
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'digest' in err &&
      typeof (err as { digest: unknown }).digest === 'string' &&
      (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw err
    }
    return { auth: null, error: 'Unauthorized: SysAdmin privileges required' }
  }
}

export async function bulkActivateSchools(
  schoolIds: string[],
  _userId?: string,
  _userRole?: string
): Promise<BulkResult> {
  const { auth, error: authError } = await getSuperAdminSession()
  if (authError || !auth) {
    return {
      success: false,
      successCount: 0,
      failureCount: schoolIds.length,
      failures: schoolIds.map((id) => ({ id, error: authError || 'Unauthorized' })),
      message: authError || 'Unauthorized: SysAdmin privileges required',
    }
  }

  const { user, profile } = auth
  const supabase = createAdminSupabaseClient()

  try {
    const { data: existingSchools, error: queryError } = await supabase
      .from('schools')
      .select('id, name')
      .in('id', schoolIds)

    if (queryError) {
      return {
        success: false,
        successCount: 0,
        failureCount: schoolIds.length,
        failures: schoolIds.map((id) => ({ id, error: queryError.message })),
        message: 'Failed to query schools',
      }
    }

    const existingIds = new Set((existingSchools || []).map((s) => s.id))
    const missingIds = schoolIds.filter((id) => !existingIds.has(id))
    const validIds = schoolIds.filter((id) => existingIds.has(id))

    const failures: Array<{ id: string; error: string }> = missingIds.map((id) => ({
      id,
      error: 'School not found',
    }))

    let successCount = 0

    if (validIds.length > 0) {
      const { error: updateError } = await supabase
        .from('schools')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .in('id', validIds)

      if (updateError) {
        validIds.forEach((id) => failures.push({ id, error: updateError.message }))
      } else {
        successCount = validIds.length
      }
    }

    try {
      await (supabase as unknown as RpcClient).rpc('log_audit_action', {
        p_actor_user_id: user.id,
        p_actor_role: profile.role,
        p_action_type: 'bulk_activate',
        p_entity_type: 'school',
        p_entity_id: null,
        p_metadata: {
          school_ids: schoolIds,
          success_count: successCount,
          failure_count: failures.length,
          failures,
        },
      })
    } catch (auditErr) {
      console.warn('Failed to write audit log:', auditErr)
    }

    revalidatePath('/dashboard/super-admin/schools')

    return {
      success: failures.length === 0,
      successCount,
      failureCount: failures.length,
      failures,
      message: `Activated ${successCount} of ${schoolIds.length} schools${
        failures.length > 0 ? ` (${failures.length} failed)` : ''
      }`,
    }
  } catch (err) {
    console.error('Error in bulkActivateSchools:', err)
    return {
      success: false,
      successCount: 0,
      failureCount: schoolIds.length,
      failures: schoolIds.map((id) => ({ id, error: 'Operation failed' })),
      message: 'Failed to activate schools',
    }
  }
}

export async function bulkDeactivateSchools(
  schoolIds: string[],
  _userId?: string,
  _userRole?: string
): Promise<BulkResult> {
  const { auth, error: authError } = await getSuperAdminSession()
  if (authError || !auth) {
    return {
      success: false,
      successCount: 0,
      failureCount: schoolIds.length,
      failures: schoolIds.map((id) => ({ id, error: authError || 'Unauthorized' })),
      message: authError || 'Unauthorized: SysAdmin privileges required',
    }
  }

  const { user, profile } = auth
  const supabase = createAdminSupabaseClient()

  try {
    const { data: existingSchools, error: queryError } = await supabase
      .from('schools')
      .select('id, name')
      .in('id', schoolIds)

    if (queryError) {
      return {
        success: false,
        successCount: 0,
        failureCount: schoolIds.length,
        failures: schoolIds.map((id) => ({ id, error: queryError.message })),
        message: 'Failed to query schools',
      }
    }

    const existingIds = new Set((existingSchools || []).map((s) => s.id))
    const missingIds = schoolIds.filter((id) => !existingIds.has(id))
    const validIds = schoolIds.filter((id) => existingIds.has(id))

    const failures: Array<{ id: string; error: string }> = missingIds.map((id) => ({
      id,
      error: 'School not found',
    }))

    let successCount = 0

    if (validIds.length > 0) {
      const { error: updateError } = await supabase
        .from('schools')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .in('id', validIds)

      if (updateError) {
        validIds.forEach((id) => failures.push({ id, error: updateError.message }))
      } else {
        successCount = validIds.length
      }
    }

    try {
      await (supabase as unknown as RpcClient).rpc('log_audit_action', {
        p_actor_user_id: user.id,
        p_actor_role: profile.role,
        p_action_type: 'bulk_deactivate',
        p_entity_type: 'school',
        p_entity_id: null,
        p_metadata: {
          school_ids: schoolIds,
          success_count: successCount,
          failure_count: failures.length,
          failures,
        },
      })
    } catch (auditErr) {
      console.warn('Failed to write audit log:', auditErr)
    }

    revalidatePath('/dashboard/super-admin/schools')

    return {
      success: failures.length === 0,
      successCount,
      failureCount: failures.length,
      failures,
      message: `Deactivated ${successCount} of ${schoolIds.length} schools${
        failures.length > 0 ? ` (${failures.length} failed)` : ''
      }`,
    }
  } catch (err) {
    console.error('Error in bulkDeactivateSchools:', err)
    return {
      success: false,
      successCount: 0,
      failureCount: schoolIds.length,
      failures: schoolIds.map((id) => ({ id, error: 'Operation failed' })),
      message: 'Failed to deactivate schools',
    }
  }
}

export async function bulkDeleteSchools(
  schoolIds: string[],
  _userId?: string,
  _userRole?: string
): Promise<BulkResult> {
  const { auth, error: authError } = await getSuperAdminSession()
  if (authError || !auth) {
    return {
      success: false,
      successCount: 0,
      failureCount: schoolIds.length,
      failures: schoolIds.map((id) => ({ id, error: authError || 'Unauthorized' })),
      message: authError || 'Unauthorized: SysAdmin privileges required',
    }
  }

  const { user, profile } = auth
  const supabase = createAdminSupabaseClient()

  try {
    const { data: existingSchools, error: queryError } = await supabase
      .from('schools')
      .select('id, name')
      .in('id', schoolIds)

    if (queryError) {
      return {
        success: false,
        successCount: 0,
        failureCount: schoolIds.length,
        failures: schoolIds.map((id) => ({ id, error: queryError.message })),
        message: 'Failed to query schools',
      }
    }

    const existingIds = new Set((existingSchools || []).map((s) => s.id))
    const missingIds = schoolIds.filter((id) => !existingIds.has(id))
    const validIds = schoolIds.filter((id) => existingIds.has(id))

    const failures: Array<{ id: string; error: string }> = missingIds.map((id) => ({
      id,
      error: 'School not found',
    }))

    let successCount = 0

    if (validIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('schools')
        .delete()
        .in('id', validIds)

      if (deleteError) {
        validIds.forEach((id) => failures.push({ id, error: deleteError.message }))
      } else {
        successCount = validIds.length
      }
    }

    try {
      await (supabase as unknown as RpcClient).rpc('log_audit_action', {
        p_actor_user_id: user.id,
        p_actor_role: profile.role,
        p_action_type: 'bulk_delete',
        p_entity_type: 'school',
        p_entity_id: null,
        p_metadata: {
          school_ids: schoolIds,
          success_count: successCount,
          failure_count: failures.length,
          failures,
        },
      })
    } catch (auditErr) {
      console.warn('Failed to write audit log:', auditErr)
    }

    revalidatePath('/dashboard/super-admin/schools')

    return {
      success: failures.length === 0,
      successCount,
      failureCount: failures.length,
      failures,
      message: `Deleted ${successCount} of ${schoolIds.length} schools${
        failures.length > 0 ? ` (${failures.length} failed)` : ''
      }`,
    }
  } catch (err) {
    console.error('Error in bulkDeleteSchools:', err)
    return {
      success: false,
      successCount: 0,
      failureCount: schoolIds.length,
      failures: schoolIds.map((id) => ({ id, error: 'Operation failed' })),
      message: 'Failed to delete schools',
    }
  }
}

export async function bulkActivateUsers(
  profileIds: string[],
  _userId?: string,
  _userRole?: string
): Promise<BulkResult> {
  const { auth, error: authError } = await getSuperAdminSession()
  if (authError || !auth) {
    return {
      success: false,
      successCount: 0,
      failureCount: profileIds.length,
      failures: profileIds.map((id) => ({ id, error: authError || 'Unauthorized' })),
      message: authError || 'Unauthorized: SysAdmin privileges required',
    }
  }

  const { user, profile } = auth
  const supabase = createAdminSupabaseClient()

  try {
    const { data: existingUsers, error: queryError } = await supabase
      .from('user_profiles')
      .select('id, user_id')
      .in('id', profileIds)

    if (queryError) {
      return {
        success: false,
        successCount: 0,
        failureCount: profileIds.length,
        failures: profileIds.map((id) => ({ id, error: queryError.message })),
        message: 'Failed to query user profiles',
      }
    }

    const existingIds = new Set((existingUsers || []).map((u) => u.id))
    const missingIds = profileIds.filter((id) => !existingIds.has(id))
    const validIds = profileIds.filter((id) => existingIds.has(id))

    const failures: Array<{ id: string; error: string }> = missingIds.map((id) => ({
      id,
      error: 'User profile not found',
    }))

    let successCount = 0

    if (validIds.length > 0) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .in('id', validIds)

      if (updateError) {
        validIds.forEach((id) => failures.push({ id, error: updateError.message }))
      } else {
        successCount = validIds.length
      }
    }

    try {
      await (supabase as unknown as RpcClient).rpc('log_audit_action', {
        p_actor_user_id: user.id,
        p_actor_role: profile.role,
        p_action_type: 'bulk_activate',
        p_entity_type: 'user',
        p_entity_id: null,
        p_metadata: {
          user_profile_ids: profileIds,
          success_count: successCount,
          failure_count: failures.length,
          failures,
        },
      })
    } catch (auditErr) {
      console.warn('Failed to write audit log:', auditErr)
    }

    revalidatePath('/dashboard/super-admin/users')

    return {
      success: failures.length === 0,
      successCount,
      failureCount: failures.length,
      failures,
      message: `Activated ${successCount} of ${profileIds.length} users${
        failures.length > 0 ? ` (${failures.length} failed)` : ''
      }`,
    }
  } catch (err) {
    console.error('Error in bulkActivateUsers:', err)
    return {
      success: false,
      successCount: 0,
      failureCount: profileIds.length,
      failures: profileIds.map((id) => ({ id, error: 'Operation failed' })),
      message: 'Failed to activate users',
    }
  }
}

export async function bulkDeactivateUsers(
  profileIds: string[],
  _userId?: string,
  _userRole?: string
): Promise<BulkResult> {
  const { auth, error: authError } = await getSuperAdminSession()
  if (authError || !auth) {
    return {
      success: false,
      successCount: 0,
      failureCount: profileIds.length,
      failures: profileIds.map((id) => ({ id, error: authError || 'Unauthorized' })),
      message: authError || 'Unauthorized: SysAdmin privileges required',
    }
  }

  const { user, profile } = auth
  const supabase = createAdminSupabaseClient()

  try {
    const { data: existingUsers, error: queryError } = await supabase
      .from('user_profiles')
      .select('id, user_id')
      .in('id', profileIds)

    if (queryError) {
      return {
        success: false,
        successCount: 0,
        failureCount: profileIds.length,
        failures: profileIds.map((id) => ({ id, error: queryError.message })),
        message: 'Failed to query user profiles',
      }
    }

    const existingIds = new Set((existingUsers || []).map((u) => u.id))
    const missingIds = profileIds.filter((id) => !existingIds.has(id))
    const validIds = profileIds.filter((id) => existingIds.has(id))

    const failures: Array<{ id: string; error: string }> = missingIds.map((id) => ({
      id,
      error: 'User profile not found',
    }))

    let successCount = 0

    if (validIds.length > 0) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .in('id', validIds)

      if (updateError) {
        validIds.forEach((id) => failures.push({ id, error: updateError.message }))
      } else {
        successCount = validIds.length
      }
    }

    try {
      await (supabase as unknown as RpcClient).rpc('log_audit_action', {
        p_actor_user_id: user.id,
        p_actor_role: profile.role,
        p_action_type: 'bulk_deactivate',
        p_entity_type: 'user',
        p_entity_id: null,
        p_metadata: {
          user_profile_ids: profileIds,
          success_count: successCount,
          failure_count: failures.length,
          failures,
        },
      })
    } catch (auditErr) {
      console.warn('Failed to write audit log:', auditErr)
    }

    revalidatePath('/dashboard/super-admin/users')

    return {
      success: failures.length === 0,
      successCount,
      failureCount: failures.length,
      failures,
      message: `Deactivated ${successCount} of ${profileIds.length} users${
        failures.length > 0 ? ` (${failures.length} failed)` : ''
      }`,
    }
  } catch (err) {
    console.error('Error in bulkDeactivateUsers:', err)
    return {
      success: false,
      successCount: 0,
      failureCount: profileIds.length,
      failures: profileIds.map((id) => ({ id, error: 'Operation failed' })),
      message: 'Failed to deactivate users',
    }
  }
}

export async function bulkDeleteUsers(
  userIds: string[],
  _userId?: string,
  _userRole?: string
): Promise<BulkResult> {
  const { auth, error: authError } = await getSuperAdminSession()
  if (authError || !auth) {
    return {
      success: false,
      successCount: 0,
      failureCount: userIds.length,
      failures: userIds.map((id) => ({ id, error: authError || 'Unauthorized' })),
      message: authError || 'Unauthorized: SysAdmin privileges required',
    }
  }

  const { user, profile } = auth
  const supabase = createAdminSupabaseClient()

  try {
    const { data: existingProfiles, error: queryError } = await supabase
      .from('user_profiles')
      .select('id, user_id')
      .in('id', userIds)

    if (queryError) {
      return {
        success: false,
        successCount: 0,
        failureCount: userIds.length,
        failures: userIds.map((id) => ({ id, error: queryError.message })),
        message: 'Failed to query user profiles',
      }
    }

    const existingIds = new Set((existingProfiles || []).map((u) => u.id))
    const missingIds = userIds.filter((id) => !existingIds.has(id))
    const validProfiles = (existingProfiles || []).filter((u) => userIds.includes(u.id))
    const validProfileIds = validProfiles.map((u) => u.id)

    const failures: Array<{ id: string; error: string }> = missingIds.map((id) => ({
      id,
      error: 'User profile not found',
    }))

    let successCount = 0

    if (validProfileIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('user_profiles')
        .delete()
        .in('id', validProfileIds)

      if (deleteError) {
        validProfileIds.forEach((id) => failures.push({ id, error: deleteError.message }))
      } else {
        successCount = validProfileIds.length
        const authUserIds = validProfiles
          .map((u) => u.user_id)
          .filter((uid): uid is string => Boolean(uid))
        if (authUserIds.length > 0) {
          await Promise.allSettled(authUserIds.map((uid) => supabase.auth.admin.deleteUser(uid)))
        }
      }
    }

    try {
      await (supabase as unknown as RpcClient).rpc('log_audit_action', {
        p_actor_user_id: user.id,
        p_actor_role: profile.role,
        p_action_type: 'bulk_delete',
        p_entity_type: 'user',
        p_entity_id: null,
        p_metadata: {
          user_profile_ids: userIds,
          success_count: successCount,
          failure_count: failures.length,
          failures,
        },
      })
    } catch (auditErr) {
      console.warn('Failed to write audit log:', auditErr)
    }

    revalidatePath('/dashboard/super-admin/users')

    return {
      success: failures.length === 0,
      successCount,
      failureCount: failures.length,
      failures,
      message: `Deleted ${successCount} of ${userIds.length} users${
        failures.length > 0 ? ` (${failures.length} failed)` : ''
      }`,
    }
  } catch (err) {
    console.error('Error in bulkDeleteUsers:', err)
    return {
      success: false,
      successCount: 0,
      failureCount: userIds.length,
      failures: userIds.map((id) => ({ id, error: 'Operation failed' })),
      message: 'Failed to delete users',
    }
  }
}
