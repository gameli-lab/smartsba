"use server"

import { createServerSupabaseClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

interface BulkResult {
  success: boolean
  successCount: number
  failureCount: number
  failures: Array<{ id: string; error: string }>
  message: string
}

interface MutationResult {
  error: { message?: string } | null
}

interface TableMutationClient {
  update: (payload: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<MutationResult>
  }
  delete: () => {
    eq: (column: string, value: string) => Promise<MutationResult>
  }
}

interface RpcClient {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<unknown>
}

function getTableMutationClient(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  table: string
): TableMutationClient {
  return supabase.from(table) as unknown as TableMutationClient
}

export async function bulkActivateSchools(
  schoolIds: string[],
  userId: string,
  userRole: string
): Promise<BulkResult> {
  const supabase = createServerSupabaseClient()
  try {
    // Verify user is super_admin
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return {
        success: false,
        successCount: 0,
        failureCount: schoolIds.length,
        failures: schoolIds.map(id => ({ id, error: 'Unauthorized' })),
        message: 'Unauthorized: SysAdmin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const schoolId of schoolIds) {
      const { error } = await getTableMutationClient(supabase, 'schools')
        .update({ status: 'active' })
        .eq('id', schoolId)

      if (error) {
        failures.push({ id: schoolId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await (supabase as unknown as RpcClient).rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'bulk_activate',
      p_entity_type: 'school',
      p_entity_id: null,
      p_metadata: {
        school_ids: schoolIds,
        success_count: successCount,
        failure_count: failures.length,
        failures: failures,
      },
    })

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
      failures: schoolIds.map(id => ({ id, error: 'Operation failed' })),
      message: 'Failed to activate schools',
    }
  }
}

export async function bulkDeactivateSchools(
  schoolIds: string[],
  userId: string,
  userRole: string
): Promise<BulkResult> {
  const supabase = createServerSupabaseClient()
  try {
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return {
        success: false,
        successCount: 0,
        failureCount: schoolIds.length,
        failures: schoolIds.map(id => ({ id, error: 'Unauthorized' })),
        message: 'Unauthorized: SysAdmin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const schoolId of schoolIds) {
      const { error } = await getTableMutationClient(supabase, 'schools')
        .update({ status: 'inactive' })
        .eq('id', schoolId)

      if (error) {
        failures.push({ id: schoolId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await (supabase as unknown as RpcClient).rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'bulk_deactivate',
      p_entity_type: 'school',
      p_entity_id: null,
      p_metadata: {
        school_ids: schoolIds,
        success_count: successCount,
        failure_count: failures.length,
        failures: failures,
      },
    })

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
      failures: schoolIds.map(id => ({ id, error: 'Operation failed' })),
      message: 'Failed to deactivate schools',
    }
  }
}

export async function bulkDeleteSchools(
  schoolIds: string[],
  userId: string,
  userRole: string
): Promise<BulkResult> {
  const supabase = createServerSupabaseClient()
  try {
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return {
        success: false,
        successCount: 0,
        failureCount: schoolIds.length,
        failures: schoolIds.map(id => ({ id, error: 'Unauthorized' })),
        message: 'Unauthorized: SysAdmin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const schoolId of schoolIds) {
      const { error } = await getTableMutationClient(supabase, 'schools')
        .delete()
        .eq('id', schoolId)

      if (error) {
        failures.push({ id: schoolId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await (supabase as unknown as RpcClient).rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'bulk_delete',
      p_entity_type: 'school',
      p_entity_id: null,
      p_metadata: {
        school_ids: schoolIds,
        success_count: successCount,
        failure_count: failures.length,
        failures: failures,
      },
    })

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
      failures: schoolIds.map(id => ({ id, error: 'Operation failed' })),
      message: 'Failed to delete schools',
    }
  }
}

export async function bulkDeleteUsers(
  userIds: string[],
  userId: string,
  userRole: string
): Promise<BulkResult> {
  const supabase = createServerSupabaseClient()
  try {
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return {
        success: false,
        successCount: 0,
        failureCount: userIds.length,
        failures: userIds.map(id => ({ id, error: 'Unauthorized' })),
        message: 'Unauthorized: SysAdmin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const profileId of userIds) {
      // Get user_id first
      const { data: userProfile } = (await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('id', profileId)
        .single()) as { data: { user_id: string } | null }

      if (!userProfile) {
        failures.push({ id: profileId, error: 'User profile not found' })
        continue
      }

      // Delete from user_profiles (auth user will be handled by CASCADE or trigger)
      const { error } = await getTableMutationClient(supabase, 'user_profiles')
        .delete()
        .eq('id', profileId)

      if (error) {
        failures.push({ id: profileId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await (supabase as unknown as RpcClient).rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'bulk_delete',
      p_entity_type: 'user',
      p_entity_id: null,
      p_metadata: {
        user_profile_ids: userIds,
        success_count: successCount,
        failure_count: failures.length,
        failures: failures,
      },
    })

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
      failures: userIds.map(id => ({ id, error: 'Operation failed' })),
      message: 'Failed to delete users',
    }
  }
}

export async function bulkActivateUsers(
  profileIds: string[],
  userId: string,
  userRole: string
): Promise<BulkResult> {
  const supabase = createServerSupabaseClient()
  try {
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return {
        success: false,
        successCount: 0,
        failureCount: profileIds.length,
        failures: profileIds.map(id => ({ id, error: 'Unauthorized' })),
        message: 'Unauthorized: SysAdmin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const profileId of profileIds) {
      const { error } = await getTableMutationClient(supabase, 'user_profiles')
        .update({ status: 'active' })
        .eq('id', profileId)

      if (error) {
        failures.push({ id: profileId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await (supabase as unknown as RpcClient).rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'bulk_activate',
      p_entity_type: 'user',
      p_entity_id: null,
      p_metadata: {
        user_profile_ids: profileIds,
        success_count: successCount,
        failure_count: failures.length,
        failures: failures,
      },
    })

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
      failures: profileIds.map(id => ({ id, error: 'Operation failed' })),
      message: 'Failed to activate users',
    }
  }
}

export async function bulkDeactivateUsers(
  profileIds: string[],
  userId: string,
  userRole: string
): Promise<BulkResult> {
  const supabase = createServerSupabaseClient()
  try {
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return {
        success: false,
        successCount: 0,
        failureCount: profileIds.length,
        failures: profileIds.map(id => ({ id, error: 'Unauthorized' })),
        message: 'Unauthorized: SysAdmin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const profileId of profileIds) {
      const { error } = await getTableMutationClient(supabase, 'user_profiles')
        .update({ status: 'inactive' })
        .eq('id', profileId)

      if (error) {
        failures.push({ id: profileId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await (supabase as unknown as RpcClient).rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'bulk_deactivate',
      p_entity_type: 'user',
      p_entity_id: null,
      p_metadata: {
        user_profile_ids: profileIds,
        success_count: successCount,
        failure_count: failures.length,
        failures: failures,
      },
    })

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
      failures: profileIds.map(id => ({ id, error: 'Operation failed' })),
      message: 'Failed to deactivate users',
    }
  }
}
