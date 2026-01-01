"use server"

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

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
  try {
    let query = supabase.from('system_settings').select('*').order('setting_key')

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
    // Verify user is super_admin
    const { data: profile } = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized: Super admin privileges required' }
    }

    // Get current setting for audit log
    const { data: currentSetting } = (await supabase
      .from('system_settings')
      .select('setting_value, category')
      .eq('setting_key', settingKey)
      .single()) as { data: { setting_value: any; category: string } | null }

    // Update setting
    const { error: updateError } = (await (supabase
      .from('system_settings') as any)
      .update({
        setting_value: settingValue,
        updated_by: userId,
      })
      .eq('setting_key', settingKey)) as { error: any }

    if (updateError) {
      console.error('Error updating system setting:', updateError)
      return { success: false, error: updateError.message }
    }

    // Log to audit trail
    await supabase.rpc('log_audit_action' as any, {
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

    revalidatePath('/dashboard/super-admin/settings')

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
    const { data: profile } = (await supabase
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
