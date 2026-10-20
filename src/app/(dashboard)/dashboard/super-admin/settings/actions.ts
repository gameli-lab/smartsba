"use server"

import { createServerSupabaseClient } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/auth-guards'
import { revalidatePath } from 'next/cache'
import { unstable_noStore as noStore } from 'next/cache'
import { clearAIConfigCache } from '@/services/aiLLMService'

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
  setting_value: unknown
  description: string | null
  category: string
  updated_at: string
  updated_by: string | null
}

interface CurrentSettingRow {
  setting_value: unknown
  category: string
}

interface LogAuditParams {
  p_actor_user_id: string
  p_actor_role: string
  p_action_type: string
  p_entity_type: string
  p_entity_id: string | null
  p_metadata: Record<string, unknown>
}

interface AuditRpcClient {
  rpc(fn: 'log_audit_action', params: LogAuditParams): Promise<{ error: { message?: string } | null }>
}

function getAuditRpcClient(): AuditRpcClient {
  return getSupabase() as unknown as AuditRpcClient
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

function isSensitiveSettingKey(settingKey: string): boolean {
  return /api_key|password|secret|token/i.test(settingKey)
}

function redactSettingValue(settingKey: string, settingValue: unknown): unknown {
  if (!isSensitiveSettingKey(settingKey)) {
    return settingValue
  }

  if (settingValue === null || settingValue === undefined || settingValue === '') {
    return settingValue
  }

  return '[REDACTED]'
}

function deriveCategoryFromSettingKey(settingKey: string): string | null {
  const [category] = settingKey.split('.')
  if (!category) return null
  return category
}

export async function getSystemSettings(category?: string): Promise<{
  settings: SystemSetting[]
  error: string | null
}> {
  noStore() // Prevent caching to ensure fresh data
  
  try {
    const { auth, error: authError } = await getSuperAdminSession()
    if (authError || !auth) {
      return { settings: [], error: authError || 'Unauthorized' }
    }

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
  settingValue: unknown,
  _userId?: string,
  _userRole?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const category = deriveCategoryFromSettingKey(settingKey)
    if (!category) {
      return { success: false, error: 'Invalid setting key format' }
    }

    const { auth, error: authError } = await getSuperAdminSession()
    if (authError || !auth) {
      return { success: false, error: authError || 'Unauthorized: SysAdmin privileges required' }
    }

    const { user, profile } = auth
    const actorUserId = user.id
    const actorRole = profile.role

    // Get current setting for audit log
    const { data: currentSetting } = (await getSupabase()
      .from('system_settings')
      .select('setting_value, category')
      .eq('setting_key', settingKey)
      .single()) as { data: CurrentSettingRow | null }

    // Update or create setting
    const { data: updateData, error: updateError } = await getSupabase()
      .from('system_settings')
      .upsert(
        {
          setting_key: settingKey,
          category,
          setting_value: settingValue,
          updated_by: actorUserId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'setting_key',
        }
      )
      .select()

    if (updateError) {
      console.error('Error updating system setting:', updateError)
      return { success: false, error: updateError.message }
    }

    if (!updateData || updateData.length === 0) {
      console.warn('No rows updated. Setting may not exist in database.')
      return { success: false, error: 'Setting not found in database' }
    }

    // Log to audit trail
    const { error: auditError } = await getAuditRpcClient().rpc('log_audit_action', {
      p_actor_user_id: actorUserId,
      p_actor_role: actorRole,
      p_action_type: 'system_setting_updated',
      p_entity_type: 'system_setting',
      p_entity_id: null,
      p_metadata: {
        setting_key: settingKey,
        old_value: redactSettingValue(settingKey, currentSetting?.setting_value),
        new_value: redactSettingValue(settingKey, settingValue),
        category: currentSetting?.category,
      },
    })

    if (auditError) {
      console.warn('Warning: Failed to log audit action:', auditError)
    }

    revalidatePath('/dashboard/super-admin/settings')

    if (settingKey.startsWith('ai.')) {
      clearAIConfigCache()
    }

    return { success: true }
  } catch (err) {
    console.error('Error in updateSystemSetting:', err)
    return { success: false, error: 'Failed to update setting' }
  }
}

export async function updateMultipleSettings(
  updates: Array<{ key: string; value: unknown }>,
  _userId?: string,
  _userRole?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { auth, error: authError } = await getSuperAdminSession()
    if (authError || !auth) {
      return { success: false, error: authError || 'Unauthorized: SysAdmin privileges required' }
    }

    // Update each setting
    for (const update of updates) {
      const result = await updateSystemSetting(update.key, update.value)
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
