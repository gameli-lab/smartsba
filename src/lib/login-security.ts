import 'server-only'

import { createHash } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase'

const DEFAULT_LOCKOUT_ATTEMPTS = 5
const DEFAULT_LOCKOUT_DURATION_MINUTES = 30

type SecurityRole = 'super_admin' | 'staff' | 'student' | 'parent'

type SettingRow = {
  setting_key: string
  setting_value: unknown
}

type LoginAttemptRow = {
  failed_attempts: number
  locked_until: string | null
}

type SecuritySettings = {
  maxAttempts: number
  lockoutDurationMinutes: number
}

function parseSettingNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

export function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase()
}

export function createScopeKey(role: SecurityRole, identifier: string, schoolId?: string): string {
  const normalizedIdentifier = normalizeIdentifier(identifier)
  const normalizedSchool = schoolId?.trim().toLowerCase() || 'global'
  return createHash('sha256').update(`${role}|${normalizedSchool}|${normalizedIdentifier}`).digest('hex')
}

export async function getLoginSecuritySettings(): Promise<SecuritySettings> {
  const supabaseAdmin = createAdminSupabaseClient()
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['security.login_lockout_attempts', 'security.login_lockout_duration_minutes'])

  if (error || !data) {
    return {
      maxAttempts: DEFAULT_LOCKOUT_ATTEMPTS,
      lockoutDurationMinutes: DEFAULT_LOCKOUT_DURATION_MINUTES,
    }
  }

  const rows = data as SettingRow[]
  const maxAttemptsRaw = rows.find((row) => row.setting_key === 'security.login_lockout_attempts')?.setting_value
  const lockoutDurationRaw = rows.find((row) => row.setting_key === 'security.login_lockout_duration_minutes')?.setting_value

  return {
    maxAttempts: parseSettingNumber(maxAttemptsRaw, DEFAULT_LOCKOUT_ATTEMPTS),
    lockoutDurationMinutes: parseSettingNumber(lockoutDurationRaw, DEFAULT_LOCKOUT_DURATION_MINUTES),
  }
}

export async function checkLockout(scopeKey: string): Promise<{ locked: boolean; remainingMinutes?: number }> {
  const supabaseAdmin = createAdminSupabaseClient()
  const { data, error } = await supabaseAdmin
    .from('login_attempts')
    .select('failed_attempts, locked_until')
    .eq('scope_key', scopeKey)
    .maybeSingle()

  if (error || !data) {
    return { locked: false }
  }

  const row = data as LoginAttemptRow
  if (!row.locked_until) {
    return { locked: false }
  }

  const lockedUntilMs = new Date(row.locked_until).getTime()
  const now = Date.now()

  if (Number.isNaN(lockedUntilMs) || lockedUntilMs <= now) {
    await supabaseAdmin
      .from('login_attempts')
      .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
      .eq('scope_key', scopeKey)

    return { locked: false }
  }

  const remainingMinutes = Math.ceil((lockedUntilMs - now) / (60 * 1000))
  return { locked: true, remainingMinutes }
}

export async function recordFailedAttempt(input: {
  scopeKey: string
  role: SecurityRole
  schoolId?: string
  identifierHint: string
}): Promise<{ locked: boolean; remainingMinutes?: number; failedAttempts: number }> {
  const supabaseAdmin = createAdminSupabaseClient()
  const settings = await getLoginSecuritySettings()

  const { data, error } = await supabaseAdmin
    .from('login_attempts')
    .select('failed_attempts, locked_until')
    .eq('scope_key', input.scopeKey)
    .maybeSingle()

  const row = (!error && data ? (data as LoginAttemptRow) : null)
  const failedAttempts = (row?.failed_attempts ?? 0) + 1

  let lockedUntil: string | null = row?.locked_until ?? null
  if (failedAttempts >= settings.maxAttempts) {
    lockedUntil = new Date(Date.now() + settings.lockoutDurationMinutes * 60 * 1000).toISOString()
  }

  await supabaseAdmin
    .from('login_attempts')
    .upsert(
      {
        scope_key: input.scopeKey,
        role: input.role,
        school_id: input.schoolId ?? null,
        identifier_hint: input.identifierHint,
        failed_attempts: failedAttempts,
        locked_until: lockedUntil,
        last_attempt_at: new Date().toISOString(),
      },
      { onConflict: 'scope_key' }
    )

  if (!lockedUntil) {
    return { locked: false, failedAttempts }
  }

  const remainingMinutes = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / (60 * 1000)))
  return { locked: true, remainingMinutes, failedAttempts }
}

export async function clearFailedAttempts(scopeKey: string): Promise<void> {
  const supabaseAdmin = createAdminSupabaseClient()
  await supabaseAdmin
    .from('login_attempts')
    .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
    .eq('scope_key', scopeKey)
}