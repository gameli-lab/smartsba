"use server"

import { createServerSupabaseClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { unstable_noStore as noStore } from 'next/cache'

// Lazy initialize server client
let serverClient: ReturnType<typeof createServerSupabaseClient> | null = null

function getSupabase() {
  if (!serverClient) {
    serverClient = createServerSupabaseClient()
  }
  return serverClient
}

interface SystemSetting {
  id: string
  setting_key: string
  setting_value: any
  description: string | null
  category: string
  updated_at: string
  updated_by: string | null
}

export async function getSystemSettings(category?: string): Promise<{
  settings: SystemSetting[]
  error: string | null
}> {
  noStore() // Prevent caching to ensure fresh data
  
  try {
    let query = getSupabase().from('system_settings').select('*').order('setting_key')

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching system settings:', error)
      return { settings: [], error: error.message }
    }

    return { settings: data || [], error: null }
  } catch (err) {
    console.error('Error in getSystemSettings:', err)
    return { settings: [], error: 'Failed to fetch settings' }
  }
}

export async function updateSystemSetting(
  settingKey: string,
  settingValue: any,
  userId: string,
  userRole: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('=== updateSystemSetting called ===')
    console.log('settingKey:', settingKey)
    console.log('settingValue:', settingValue)
    console.log('userId:', userId)
    console.log('userRole:', userRole)
    
    // Verify user is super_admin
    const { data: profile } = (await getSupabase()
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    if (!profile || profile.role !== 'super_admin') {
      console.log('User is not super_admin:', profile)
      return { success: false, error: 'Unauthorized: Super admin privileges required' }
    }

    // Get current setting for audit log
    const { data: currentSetting } = (await getSupabase()
      .from('system_settings')
      .select('setting_value, category')
      .eq('setting_key', settingKey)
      .single()) as { data: { setting_value: any; category: string } | null }

    console.log('Current setting:', currentSetting)

    // Update setting
    const { data: updateData, error: updateError, count } = (await (getSupabase()
      .from('system_settings') as any)
      .update({
        setting_value: settingValue,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', settingKey)
      .select()) as { data: any; error: any; count: number }

    console.log('Update response - data:', updateData, 'error:', updateError, 'count:', count)

    if (updateError) {
      console.error('Error updating system setting:', updateError)
      return { success: false, error: updateError.message }
    }

    if (!updateData || updateData.length === 0) {
      console.warn('No rows updated. Setting may not exist in database.')
      return { success: false, error: 'Setting not found in database' }
    }

    console.log('Setting updated successfully:', updateData[0])

    // Log to audit trail
    const { error: auditError } = await getSupabase().rpc('log_audit_action' as any, {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'system_setting_updated',
      p_entity_type: 'system_setting',
      p_entity_id: null,
      p_metadata: {
        setting_key: settingKey,
        old_value: currentSetting?.setting_value,
        new_value: settingValue,
        category: currentSetting?.category,
      },
    } as any)

    if (auditError) {
      console.warn('Warning: Failed to log audit action:', auditError)
      // Don't fail the update if audit logging fails
    }

    revalidatePath('/dashboard/super-admin/settings')

    console.log('=== updateSystemSetting completed successfully ===')
    return { success: true }
  } catch (err) {
    console.error('Error in updateSystemSetting:', err)
    return { success: false, error: 'Failed to update setting' }
  }
}

export async function updateMultipleSettings(
  updates: Array<{ key: string; value: any }>,
  userId: string,
  userRole: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify user is super_admin
    const { data: profile } = (await getSupabase()
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized: Super admin privileges required' }
    }

    // Update each setting
    for (const update of updates) {
      const result = await updateSystemSetting(update.key, update.value, userId, userRole)
      if (!result.success) {
        return { success: false, error: `Failed to update ${update.key}: ${result.error}` }
      }
    }

    return { success: true }
  } catch (err) {
    console.error('Error in updateMultipleSettings:', err)
    return { success: false, error: 'Failed to update settings' }
  }
}
