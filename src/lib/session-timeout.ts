import { createAdminSupabaseClient } from '@/lib/supabase'

const DEFAULT_SESSION_TIMEOUT_MINUTES = 60

interface SessionTimeoutSettingRow {
  setting_value: unknown
}

export async function getSessionTimeoutMinutes(): Promise<number> {
  try {
    const adminSupabase = createAdminSupabaseClient()
    const { data, error } = await adminSupabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'security.session_timeout_minutes')
      .maybeSingle()

    const row = data as SessionTimeoutSettingRow | null

    if (error || !row) {
      return DEFAULT_SESSION_TIMEOUT_MINUTES
    }

    const rawValue = row.setting_value
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return Math.max(1, rawValue)
    }

    if (typeof rawValue === 'string') {
      const parsed = parseInt(rawValue, 10)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_TIMEOUT_MINUTES
    }

    return DEFAULT_SESSION_TIMEOUT_MINUTES
  } catch (error) {
    console.warn('Unable to load session timeout setting, using default:', error)
    return DEFAULT_SESSION_TIMEOUT_MINUTES
  }
}
