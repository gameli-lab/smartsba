import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'

type SecurityEventRow = {
  id: string
  actor_user_id: string | null
  actor_role: string | null
  event_type: string
  risk_score: number
  metadata: Record<string, unknown> | null
  created_at: string
}

type EnrollmentRow = {
  user_id: string
  role: string
  school_id: string | null
  enabled: boolean
  enabled_at: string | null
  last_used_at: string | null
}

function readIntegerSetting(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const supabaseAdmin = createAdminSupabaseClient()

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'SysAdmin privileges required' }, { status: 403 })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: thresholdRow } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'security.mfa_failure_spike_threshold_per_hour')
      .maybeSingle()

    const alertThresholdPerHour = Math.max(
      2,
      Math.min(50, readIntegerSetting((thresholdRow as { setting_value?: unknown } | null)?.setting_value, 5))
    )

    const { data: eventRowsRaw, error: eventsError } = await supabaseAdmin
      .from('security_events')
      .select('id, actor_user_id, actor_role, event_type, risk_score, metadata, created_at')
      .in('event_type', ['mfa_challenge', 'mfa_verified'])
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(500)

    if (eventsError) {
      return NextResponse.json({ error: 'Failed to fetch MFA security events' }, { status: 500 })
    }

    const events = ((eventRowsRaw || []) as SecurityEventRow[])

    const failedEvents = events.filter((event) => {
      const action = (event.metadata?.action as string | undefined) || ''
      return event.event_type === 'mfa_challenge' && action === 'verify_failed'
    })

    const backupCodeEvents = events.filter((event) => {
      const usedBackupCode = event.metadata?.used_backup_code
      return event.event_type === 'mfa_verified' && usedBackupCode === true
    })

    const failedLast24h = failedEvents.filter((event) => event.created_at >= twentyFourHoursAgo)
    const failuresByHour = new Map<string, number>()
    for (const event of failedLast24h) {
      const hourKey = new Date(event.created_at).toISOString().slice(0, 13) + ':00:00Z'
      failuresByHour.set(hourKey, (failuresByHour.get(hourKey) || 0) + 1)
    }

    const failedVerificationSpikes = Array.from(failuresByHour.entries())
      .map(([hour, count]) => ({ hour, count }))
      .filter((entry) => entry.count >= alertThresholdPerHour)
      .sort((a, b) => b.hour.localeCompare(a.hour))

    const maxFailuresInSingleHour = Array.from(failuresByHour.values()).reduce((max, value) => Math.max(max, value), 0)

    const { data: enrollmentsRaw, error: enrollmentsError } = await (supabaseAdmin as any)
      .from('mfa_enrollments')
      .select('user_id, role, school_id, enabled, enabled_at, last_used_at')
      .eq('enabled', true)
      .order('last_used_at', { ascending: false })
      .limit(100)

    if (enrollmentsError) {
      return NextResponse.json({ error: 'Failed to fetch MFA enrollment records' }, { status: 500 })
    }

    const enrollments = (enrollmentsRaw || []) as EnrollmentRow[]
    const userIds = Array.from(new Set(enrollments.map((row) => row.user_id).filter(Boolean)))

    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds)

      profileMap = Object.fromEntries(
        (profiles || []).map((row) => [row.user_id, { full_name: row.full_name, email: row.email }])
      )
    }

    const lastVerifications = enrollments.map((row) => ({
      user_id: row.user_id,
      role: row.role,
      school_id: row.school_id,
      enabled_at: row.enabled_at,
      last_used_at: row.last_used_at,
      full_name: profileMap[row.user_id]?.full_name || null,
      email: profileMap[row.user_id]?.email || null,
    }))

    const notifications: Array<{ level: 'info' | 'warning' | 'critical'; message: string }> = []

    if (failedVerificationSpikes.length > 0) {
      notifications.push({
        level: maxFailuresInSingleHour >= alertThresholdPerHour * 2 ? 'critical' : 'warning',
        message: `Detected ${failedVerificationSpikes.length} MFA failure spike window(s) over the ${alertThresholdPerHour}/hour threshold.`,
      })
    }

    if (backupCodeEvents.length >= 3) {
      notifications.push({
        level: 'warning',
        message: `Backup code usage is elevated (${backupCodeEvents.length} events in 7 days). Review affected accounts.`,
      })
    } else if (backupCodeEvents.length > 0) {
      notifications.push({
        level: 'info',
        message: `Backup codes were used ${backupCodeEvents.length} time(s) in the last 7 days.`,
      })
    }

    return NextResponse.json({
      summary: {
        failedVerificationLast24h: failedLast24h.length,
        failedVerificationSpikes: failedVerificationSpikes.length,
        backupCodeUsageLast7d: backupCodeEvents.length,
        activeMfaEnrollments: enrollments.length,
        alertThresholdPerHour,
        maxFailuresInSingleHour,
      },
      failedVerificationSpikes,
      backupCodeUsageEvents: backupCodeEvents.slice(0, 50),
      recentFailedEvents: failedEvents.slice(0, 50),
      lastVerifications,
      notifications,
    })
  } catch (error) {
    console.error('Error in MFA audit route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
