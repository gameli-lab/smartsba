"use server"

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

interface BulkResult {
  success: boolean
  successCount: number
  failureCount: number
  failures: Array<{ id: string; error: string }>
  message: string
}

export async function bulkActivateSchools(
  schoolIds: string[],
  userId: string,
  userRole: string
): Promise<BulkResult> {
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
        message: 'Unauthorized: Super admin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const schoolId of schoolIds) {
      const { error } = (await (supabase
        .from('schools') as any)
        .update({ status: 'active' })
        .eq('id', schoolId)) as { error: any }

      if (error) {
        failures.push({ id: schoolId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await supabase.rpc('log_audit_action' as any, {
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
    } as any)

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
        message: 'Unauthorized: Super admin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const schoolId of schoolIds) {
      const { error } = (await (supabase
        .from('schools') as any)
        .update({ status: 'inactive' })
        .eq('id', schoolId)) as { error: any }

      if (error) {
        failures.push({ id: schoolId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await supabase.rpc('log_audit_action' as any, {
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
    } as any)

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
        message: 'Unauthorized: Super admin privileges required',
      }
    }

    const failures: Array<{ id: string; error: string }> = []
    let successCount = 0

    for (const schoolId of schoolIds) {
      const { error } = (await (supabase
        .from('schools') as any)
        .delete()
        .eq('id', schoolId)) as { error: any }

      if (error) {
        failures.push({ id: schoolId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await supabase.rpc('log_audit_action' as any, {
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
    } as any)

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
        message: 'Unauthorized: Super admin privileges required',
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
      const { error } = (await (supabase
        .from('user_profiles') as any)
        .delete()
        .eq('id', profileId)) as { error: any }

      if (error) {
        failures.push({ id: profileId, error: error.message })
      } else {
        successCount++
      }
    }

    // Log to audit trail
    await supabase.rpc('log_audit_action' as any, {
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
    } as any)

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
