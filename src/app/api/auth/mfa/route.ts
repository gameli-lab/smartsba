import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { buildMfaCookieValue, MFA_VERIFIED_COOKIE_NAME } from '@/lib/mfa-session'
import { generateBackupCodes, generateMfaSecret, verifyTotpCode } from '@/lib/mfa'
import { recordSecurityEvent } from '@/lib/security-monitor'

type AuthedUser = {
  userId: string
  role: string
  schoolId: string | null
}

function isPrivilegedRole(role: string): boolean {
  return role === 'super_admin' || role === 'school_admin'
}

async function getMfaTrustedSessionHours(supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'security.mfa_trusted_session_hours')
      .maybeSingle()

    if (error || !data) return 12

    const value = (data as { setting_value?: unknown }).setting_value
    const parsed = typeof value === 'number' ? value : parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return 12

    return Math.max(1, Math.min(168, Math.floor(parsed)))
  } catch {
    return 12
  }
}

function getAnonSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing Supabase auth environment variables')
  }

  return createClient(url, anonKey)
}

async function requireAuthenticatedUser(req: NextRequest): Promise<{ user: AuthedUser } | { error: NextResponse }> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { error: NextResponse.json({ error: 'Authorization header required' }, { status: 401 }) }
  }

  const supabase = getAnonSupabaseClient()
  const supabaseAdmin = createAdminSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role, school_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Unable to verify user profile' }, { status: 500 }) }
  }

  return {
    user: {
      userId: user.id,
      role: profile.role,
      schoolId: profile.school_id,
    },
  }
}

function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req)
    if ('error' in authResult) {
      return authResult.error
    }

    const { user } = authResult
    const supabaseAdmin = createAdminSupabaseClient()
    const trustedSessionHours = await getMfaTrustedSessionHours(supabaseAdmin)

    const { data: enrollment } = await (supabaseAdmin as any)
      .from('mfa_enrollments')
      .select('enabled, enabled_at, last_used_at, backup_codes_hashed')
      .eq('user_id', user.userId)
      .maybeSingle()

    const enrollmentRow = enrollment as {
      enabled?: boolean
      enabled_at?: string | null
      last_used_at?: string | null
      backup_codes_hashed?: string[]
    } | null

    const expectedCookie = enrollmentRow?.last_used_at
      ? buildMfaCookieValue(user.userId, enrollmentRow.last_used_at)
      : null

    const providedCookie = req.cookies.get(MFA_VERIFIED_COOKIE_NAME)?.value || null

    return NextResponse.json({
      role: user.role,
      schoolId: user.schoolId,
      enrolled: Boolean(enrollmentRow),
      enabled: Boolean(enrollmentRow?.enabled),
      verified: Boolean(expectedCookie && providedCookie && expectedCookie === providedCookie),
      backupCodesRemaining: Array.isArray(enrollmentRow?.backup_codes_hashed)
        ? enrollmentRow?.backup_codes_hashed.length
        : 0,
      requiredForRole: isPrivilegedRole(user.role),
      trustedSessionHours,
    })
  } catch (error) {
    console.error('Failed to fetch MFA status:', error)
    return NextResponse.json({ error: 'Failed to fetch MFA status' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req)
    if ('error' in authResult) {
      return authResult.error
    }

    const { user } = authResult
    const supabaseAdmin = createAdminSupabaseClient()
    const trustedSessionHours = await getMfaTrustedSessionHours(supabaseAdmin)
    const body = (await req.json()) as { action?: 'enroll' | 'verify'; code?: string; backupCode?: string }

    if (body.action === 'enroll') {
      const { data: existingEnrollment } = await (supabaseAdmin as any)
        .from('mfa_enrollments')
        .select('enabled')
        .eq('user_id', user.userId)
        .maybeSingle()

      if (existingEnrollment?.enabled) {
        return NextResponse.json({ error: 'MFA is already enabled for this account' }, { status: 409 })
      }

      const { secretBase32, otpauthUrl } = generateMfaSecret()
      const { codes, hashedCodes } = generateBackupCodes(10)

      const { error: upsertError } = await (supabaseAdmin as any)
        .from('mfa_enrollments')
        .upsert(
          {
            user_id: user.userId,
            role: user.role,
            school_id: user.schoolId,
            secret_base32: secretBase32,
            backup_codes_hashed: hashedCodes,
            enabled: false,
            enabled_at: null,
            last_used_at: null,
          },
          { onConflict: 'user_id' }
        )

      if (upsertError) {
        return NextResponse.json({ error: 'Failed to enroll MFA for this account' }, { status: 500 })
      }

      await recordSecurityEvent({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        eventType: 'mfa_challenge',
        metadata: { action: 'enroll_started' },
      })

      return NextResponse.json({
        success: true,
        secret: secretBase32,
        otpauthUrl,
        backupCodes: codes,
      })
    }

    if (body.action === 'verify') {
      const { data: enrollment } = await (supabaseAdmin as any)
        .from('mfa_enrollments')
        .select('secret_base32, enabled, enabled_at, backup_codes_hashed')
        .eq('user_id', user.userId)
        .maybeSingle()

      if (!enrollment?.secret_base32) {
        return NextResponse.json({ error: 'MFA enrollment not found. Start enrollment first.' }, { status: 404 })
      }

      const currentBackupHashes = Array.isArray(enrollment.backup_codes_hashed)
        ? [...enrollment.backup_codes_hashed]
        : []

      let valid = false
      let usedBackupCode = false

      if (body.code) {
        valid = verifyTotpCode(enrollment.secret_base32 as string, body.code)
      }

      if (!valid && body.backupCode) {
        const backupHash = hashBackupCode(body.backupCode)
        const index = currentBackupHashes.indexOf(backupHash)
        if (index >= 0) {
          currentBackupHashes.splice(index, 1)
          valid = true
          usedBackupCode = true
        }
      }

      if (!valid) {
        await recordSecurityEvent({
          actorUserId: user.userId,
          actorRole: user.role,
          schoolId: user.schoolId,
          eventType: 'mfa_challenge',
          metadata: { action: 'verify_failed' },
        })

        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }

      const lastUsedAt = new Date().toISOString()
      const { error: updateError } = await (supabaseAdmin as any)
        .from('mfa_enrollments')
        .update({
          enabled: true,
          enabled_at: enrollment.enabled_at || lastUsedAt,
          last_used_at: lastUsedAt,
          backup_codes_hashed: currentBackupHashes,
        })
        .eq('user_id', user.userId)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to verify MFA' }, { status: 500 })
      }

      await recordSecurityEvent({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        eventType: 'mfa_verified',
        metadata: { used_backup_code: usedBackupCode },
      })

      const response = NextResponse.json({
        success: true,
        verifiedAt: lastUsedAt,
        backupCodesRemaining: currentBackupHashes.length,
      })

      response.cookies.set(MFA_VERIFIED_COOKIE_NAME, buildMfaCookieValue(user.userId, lastUsedAt), {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: trustedSessionHours * 60 * 60,
      })

      return response
    }

    return NextResponse.json({ error: 'Invalid MFA action' }, { status: 400 })
  } catch (error) {
    console.error('MFA API error:', error)
    return NextResponse.json({ error: 'Failed to process MFA request' }, { status: 500 })
  }
}