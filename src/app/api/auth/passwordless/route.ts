'use server'

import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { recordSecurityEvent } from '@/lib/security-monitor'
import { applyRateLimit, getClientIp } from '@/lib/rate-limit'
import { buildOtpCookieValue, OTP_VERIFIED_COOKIE_NAME } from '@/lib/otp-session'
import { sendHubtelOtp, verifyHubtelOtp, resendHubtelOtp } from '@/services/hubtelOtpService'
import { sendLoginOtpEmail, sendMagicLinkEmail } from '@/services/emailService'

const OTP_TTL_MINUTES = 10
const OTP_RATE_LIMIT_WINDOW_MS = 60 * 1000
const OTP_RATE_LIMIT_ATTEMPTS = 5 // Hubtel allows up to 5 requests per minute
const EMAIL_OTP_LENGTH = 6
const EMAIL_OTP_MAX_ATTEMPTS = 6

interface PasswordlessRequest {
  action: 'send' | 'verify' | 'resend' | 'magiclink'
  identifier?: string // Staff ID, Admission Number, Parent Name/Email, or SysAdmin email
  role?: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent'
  schoolId?: string
  wardAdmissionNumber?: string
  requestId?: string // for verify/resend
  prefix?: string // for verify
  code?: string // for verify
  channel?: 'sms' | 'email' // delivery channel
}

interface OtpChallengeRow {
  id: string
  user_id: string
  role: string
  school_id: string | null
  destination: string
  request_id: string | null
  prefix: string | null
  code_hash: string
  expires_at: string
  verified_at: string | null
  attempts: number
  max_attempts: number
}

function normalizeIdentifier(identifier: string): string {
  return identifier.toLowerCase().trim()
}

function generateEmailOtpCode(): string {
  let code = ''
  for (let i = 0; i < EMAIL_OTP_LENGTH; i++) {
    code += Math.floor(Math.random() * 10)
  }
  return code
}

async function hashEmailOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10)
}

async function verifyEmailOtpCode(plainCode: string, hashedCode: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainCode, hashedCode)
  } catch {
    return false
  }
}

interface ResolvedProfile {
  user_id: string
  email: string
  role: string
  school_id: string | null
  phone?: string | null
}

/**
 * Resolve a login identifier (Staff ID, Admission #, Parent name/email, SysAdmin email)
 * to a user profile with phone number.
 */
async function resolveProfile(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  input: {
    identifier: string
    role: string
    schoolId?: string
    wardAdmissionNumber?: string
  }
): Promise<ResolvedProfile | null> {
  const { identifier, role, schoolId, wardAdmissionNumber } = input
  const normalized = normalizeIdentifier(identifier)

  if (role === 'super_admin') {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email, role, school_id, phone')
      .eq('role', 'super_admin')
      .ilike('email', normalized)
      .maybeSingle()

    if (error) {
      console.error('Super admin profile lookup failed:', {
        identifier: normalized,
        error: error.message,
      })
      return null
    }

    if (!data) {
      const { data: sameEmailProfileRaw } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, email, role')
        .ilike('email', normalized)
        .limit(1)
        .maybeSingle()

      const sameEmailProfile = sameEmailProfileRaw as { role?: string } | null

      console.warn('Super admin profile not found for passwordless request', {
        identifier: normalized,
        foundProfileWithDifferentRole: Boolean(sameEmailProfile),
        foundRole: sameEmailProfile?.role || null,
      })

      return null
    }

    return data as ResolvedProfile
  }

  if (role === 'school_admin' || role === 'teacher') {
    let query = supabaseAdmin
      .from('user_profiles')
      .select('user_id, email, role, school_id, phone')
      .ilike('staff_id', normalized)
      .in('role', ['school_admin', 'teacher'])

    if (schoolId) {
      query = query.eq('school_id', schoolId)
    }

    const { data } = await query.limit(1).maybeSingle()
    if (!data) return null
    return data as ResolvedProfile
  }

  if (role === 'student') {
    let query = supabaseAdmin
      .from('user_profiles')
      .select('user_id, email, role, school_id, phone')
      .eq('role', 'student')
      .ilike('admission_number', normalized)

    if (schoolId) {
      query = query.eq('school_id', schoolId)
    }

    const { data } = await query.limit(1).maybeSingle()
    if (!data) return null
    return data as ResolvedProfile
  }

  if (role === 'parent') {
    if (!wardAdmissionNumber || !wardAdmissionNumber.trim()) {
      return null
    }

    const { data, error } = await (supabaseAdmin as any)
      .from('user_profiles')
      .select(`
        user_id,
        email,
        role,
        school_id,
        phone,
        parent_student_relationships!inner(
          student:students!inner(
            admission_number
          )
        )
      `)
      .eq('role', 'parent')
      .ilike('parent_student_relationships.student.admission_number', wardAdmissionNumber.trim())

    if (error) {
      console.error('Parent passwordless lookup failed:', error)
      return null
    }

    const profiles = (data || []) as ResolvedProfile[]

    if (profiles.length === 0) {
      return null
    }

    // Prefer an exact email match on the provided identifier
    const matched = profiles.find((p) => p.email?.toLowerCase() === normalized)
    return matched || profiles[0]
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers)
    const body: PasswordlessRequest = await req.json()

    const { action, identifier, role, schoolId, wardAdmissionNumber, requestId, prefix, code, channel = 'sms' } = body

    if (!action || !['send', 'verify', 'resend', 'magiclink'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "send", "verify", "resend", or "magiclink".' }, { status: 400 })
    }

    if (!['sms', 'email'].includes(channel)) {
      return NextResponse.json({ error: 'Channel must be "sms" or "email"' }, { status: 400 })
    }

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    const rateLimitKey = `auth:passwordless:${ip}:${action}:${normalizeIdentifier(identifier || requestId || '')}`
    const rateLimit = applyRateLimit(rateLimitKey, {
      limit: OTP_RATE_LIMIT_ATTEMPTS,
      windowMs: OTP_RATE_LIMIT_WINDOW_MS,
    })

    if (!rateLimit.allowed) {
      await recordSecurityEvent({
        identifier: identifier || requestId,
        eventType: 'otp_challenge',
        metadata: {
          action,
          provider: 'hubtel',
          rate_limit_exceeded: true,
          remaining: rateLimit.remaining,
        },
      })

      return NextResponse.json(
        {
          error: 'Too many OTP attempts. Please try again later.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        }
      )
    }

    const supabaseAdmin = createAdminSupabaseClient()

    // ─── SEND OTP ─────────────────────────────────────────────────────────────
    if (action === 'send') {
      if (!identifier || !identifier.trim()) {
        return NextResponse.json({ error: 'Identifier is required' }, { status: 400 })
      }

      const profile = await resolveProfile(supabaseAdmin, {
        identifier,
        role,
        schoolId,
        wardAdmissionNumber,
      })

      if (!profile) {
        await recordSecurityEvent({
          identifier: normalizeIdentifier(identifier),
          eventType: 'otp_challenge',
          metadata: {
            action: 'send',
            provider: channel === 'sms' ? 'hubtel' : 'internal',
            channel,
            user_found: false,
            role,
          },
        })

        return NextResponse.json(
          { error: 'User not found or invalid credentials' },
          { status: 404 }
        )
      }

      // Clean up expired challenges
      await (supabaseAdmin.from('login_otp_challenges') as any)
        .delete()
        .eq('user_id', profile.user_id)
        .lt('expires_at', new Date().toISOString())

      // ── SMS channel (Hubtel) ──
      if (channel === 'sms') {
        if (!profile.phone) {
          await recordSecurityEvent({
            actorUserId: profile.user_id,
            actorRole: profile.role,
            schoolId: profile.school_id,
            identifier: normalizeIdentifier(identifier),
            eventType: 'otp_challenge',
            metadata: {
              action: 'send',
              provider: 'hubtel',
              channel: 'sms',
              reason: 'no_phone_on_profile',
            },
          })

          return NextResponse.json(
            { error: 'No phone number on record for this account. Please contact your administrator.' },
            { status: 400 }
          )
        }

        // Call Hubtel to send OTP
        const sendResult = await sendHubtelOtp(profile.phone)

        if (!sendResult.success || !sendResult.data) {
          await recordSecurityEvent({
            actorUserId: profile.user_id,
            actorRole: profile.role,
            schoolId: profile.school_id,
            identifier: normalizeIdentifier(identifier),
            eventType: 'otp_challenge',
            metadata: {
              action: 'send',
              provider: 'hubtel',
              channel: 'sms',
              send_failed: true,
              error: sendResult.error,
            },
          })

          return NextResponse.json(
            { error: sendResult.error || 'Failed to send OTP via Hubtel' },
            { status: 500 }
          )
        }

        const { requestId: hubtelRequestId, prefix: hubtelPrefix } = sendResult.data
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

        // Store challenge with Hubtel requestId and prefix
        const { data: challengeData, error: insertError } = await (supabaseAdmin.from('login_otp_challenges') as any)
          .insert({
            user_id: profile.user_id,
            role: profile.role,
            school_id: profile.school_id,
            channel: 'sms',
            destination: profile.phone,
            code_hash: '', // Hubtel manages the code server-side
            attempts: 0,
            max_attempts: 5,
            expires_at: expiresAt,
            provider: 'hubtel',
            request_id: hubtelRequestId,
            prefix: hubtelPrefix,
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('Failed to insert Hubtel OTP challenge:', insertError)
          return NextResponse.json({ error: 'Failed to store OTP session' }, { status: 500 })
        }

        await recordSecurityEvent({
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          identifier: normalizeIdentifier(identifier),
          eventType: 'otp_challenge',
          metadata: {
            action: 'send',
            provider: 'hubtel',
            channel: 'sms',
            challenge_id: challengeData?.id,
            request_id: hubtelRequestId,
          },
        })

        return NextResponse.json({
          success: true,
          message: 'OTP sent to your phone via SMS',
          expiresAt,
          challengeId: challengeData?.id,
          requestId: hubtelRequestId,
          prefix: hubtelPrefix,
        })
      }

      // ── Email channel (internal OTP) ──
      if (!profile.email) {
        await recordSecurityEvent({
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          identifier: normalizeIdentifier(identifier),
          eventType: 'otp_challenge',
          metadata: {
            action: 'send',
            provider: 'internal',
            channel: 'email',
            reason: 'no_email_on_profile',
          },
        })

        return NextResponse.json(
          { error: 'No email address on record for this account. Please contact your administrator.' },
          { status: 400 }
        )
      }

      // Generate 6-digit OTP code
      const otpCode = generateEmailOtpCode()
      const codeHash = await hashEmailOtpCode(otpCode)
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

      // Store challenge with internal provider
      const { data: emailChallengeData, error: emailInsertError } = await (supabaseAdmin.from('login_otp_challenges') as any)
        .insert({
          user_id: profile.user_id,
          role: profile.role,
          school_id: profile.school_id,
          channel: 'email',
          destination: profile.email,
          code_hash: codeHash,
          attempts: 0,
          max_attempts: EMAIL_OTP_MAX_ATTEMPTS,
          expires_at: expiresAt,
          provider: 'internal',
          request_id: null,
          prefix: null,
        })
        .select('id')
        .single()

      if (emailInsertError) {
        console.error('Failed to insert email OTP challenge:', emailInsertError)
        return NextResponse.json({ error: 'Failed to store OTP session' }, { status: 500 })
      }

      // Send email OTP
      const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://smartsba.netlify.app'
      const emailResult = await sendLoginOtpEmail({
        userEmail: profile.email,
        userId: profile.user_id,
        userName: profile.email.split('@')[0],
        code: otpCode,
        expiresMinutes: OTP_TTL_MINUTES,
        loginUrl: `${BASE_URL}/login`,
        schoolId: profile.school_id || undefined,
      })

      if (!emailResult.success) {
        // Clean up failed challenge
        await (supabaseAdmin.from('login_otp_challenges') as any).delete().eq('id', emailChallengeData?.id)

        await recordSecurityEvent({
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          identifier: normalizeIdentifier(identifier),
          eventType: 'otp_challenge',
          metadata: {
            action: 'send',
            provider: 'internal',
            channel: 'email',
            send_failed: true,
            error: emailResult.error,
          },
        })

        return NextResponse.json(
          { error: emailResult.error || 'Failed to send email OTP' },
          { status: 500 }
        )
      }

      await recordSecurityEvent({
        actorUserId: profile.user_id,
        actorRole: profile.role,
        schoolId: profile.school_id,
        identifier: normalizeIdentifier(identifier),
        eventType: 'otp_challenge',
        metadata: {
          action: 'send',
          provider: 'internal',
          channel: 'email',
          challenge_id: emailChallengeData?.id,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'OTP sent to your email address',
        expiresAt,
        challengeId: emailChallengeData?.id,
        channel: 'email',
      })
    }

    // ─── VERIFY OTP ───────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!code) {
        return NextResponse.json(
          { error: 'code is required for verification' },
          { status: 400 }
        )
      }

      // ── SMS channel (Hubtel) ──
      if (channel === 'sms') {
        if (!requestId || !prefix) {
          return NextResponse.json(
            { error: 'requestId and prefix are required for SMS verification' },
            { status: 400 }
          )
        }

        // Find the active challenge by requestId
        const { data: challenges, error: challengeError } = await (supabaseAdmin.from('login_otp_challenges') as any)
          .select('*')
          .eq('request_id', requestId)
          .eq('provider', 'hubtel')
          .is('verified_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)

        if (challengeError) {
          console.error('Failed to fetch Hubtel OTP challenge:', challengeError)
          return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
        }

        const challenge = (challenges || [])[0] as OtpChallengeRow | undefined

        if (!challenge) {
          await recordSecurityEvent({
            eventType: 'otp_challenge',
            metadata: {
              action: 'verify_failed',
              provider: 'hubtel',
              reason: 'no_active_challenge',
              request_id: requestId,
            },
          })

          return NextResponse.json(
            { error: 'No active OTP challenge. Please request a new code.' },
            { status: 404 }
          )
        }

        // Check attempt limit
        if (challenge.attempts >= challenge.max_attempts) {
          await recordSecurityEvent({
            actorUserId: challenge.user_id,
            actorRole: challenge.role,
            schoolId: challenge.school_id,
            eventType: 'otp_challenge',
            metadata: {
              action: 'verify_failed',
              provider: 'hubtel',
              reason: 'max_attempts_exceeded',
              attempts: challenge.attempts,
            },
          })

          return NextResponse.json(
            { error: 'Maximum OTP attempts exceeded. Please request a new code.' },
            { status: 429 }
          )
        }

        // Call Hubtel to verify the code
        const verifyResult = await verifyHubtelOtp(requestId, prefix, code)

        if (!verifyResult.success) {
          const newAttempts = challenge.attempts + 1
          const attemptsRemaining = challenge.max_attempts - newAttempts

          // Increment attempts
          await (supabaseAdmin.from('login_otp_challenges') as any)
            .update({ attempts: newAttempts })
            .eq('id', challenge.id)

          await recordSecurityEvent({
            actorUserId: challenge.user_id,
            actorRole: challenge.role,
            schoolId: challenge.school_id,
            eventType: 'otp_challenge',
            metadata: {
              action: 'verify_failed',
              provider: 'hubtel',
              reason: 'invalid_code',
              attempts: newAttempts,
              attempts_remaining: attemptsRemaining,
            },
          })

          return NextResponse.json(
            {
              error: verifyResult.error || `Invalid OTP code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`,
              attemptsRemaining,
            },
            { status: 400 }
          )
        }

        // Mark challenge as verified
        const verifiedAt = new Date().toISOString()
        const { error: updateError } = await (supabaseAdmin.from('login_otp_challenges') as any)
          .update({ verified_at: verifiedAt })
          .eq('id', challenge.id)

        if (updateError) {
          console.error('Failed to mark Hubtel OTP as verified:', updateError)
          return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
        }

        // Fetch the user's actual email from user_profiles to generate a magic link
        const { data: userProfile } = await (supabaseAdmin
          .from('user_profiles')
          .select('email')
          .eq('user_id', challenge.user_id)
          .maybeSingle() as any)

        const userEmail = userProfile?.email

        if (!userEmail) {
          console.error('No email found for passwordless user:', challenge.user_id)
          return NextResponse.json({ error: 'Failed to establish session - no email on profile' }, { status: 500 })
        }

        // Generate a magic link token for the user so they can establish a session client-side
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: userEmail,
        })

        if (linkError) {
          console.error('Failed to generate magic link for passwordless login:', linkError)
          return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 })
        }

        await recordSecurityEvent({
          actorUserId: challenge.user_id,
          actorRole: challenge.role,
          schoolId: challenge.school_id,
          eventType: 'otp_verified',
          metadata: {
            provider: 'hubtel',
            channel: 'sms',
            attempts: challenge.attempts + 1,
          },
        })

        const response = NextResponse.json({
          success: true,
          message: 'OTP verified successfully',
          user: {
            id: challenge.user_id,
            role: challenge.role,
            schoolId: challenge.school_id,
          },
          tokenHash: linkData?.properties?.hashed_token || null,
          verifiedAt,
        })

        // Set OTP verification cookie so middleware recognizes this session
        response.cookies.set(OTP_VERIFIED_COOKIE_NAME, buildOtpCookieValue(challenge.user_id, verifiedAt), {
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 30 * 60, // 30 minutes
        })

        return response
      }

      // ── Email channel (internal OTP) ──
      if (!identifier || !identifier.trim()) {
        return NextResponse.json({ error: 'Identifier is required for email verification' }, { status: 400 })
      }

      const profile = await resolveProfile(supabaseAdmin, {
        identifier,
        role,
        schoolId,
        wardAdmissionNumber,
      })

      if (!profile) {
        return NextResponse.json({ error: 'User not found or invalid credentials' }, { status: 404 })
      }

      // Find the active email challenge
      const { data: emailChallenges, error: emailChallengeError } = await (supabaseAdmin.from('login_otp_challenges') as any)
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('channel', 'email')
        .eq('provider', 'internal')
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (emailChallengeError) {
        console.error('Failed to fetch email OTP challenge:', emailChallengeError)
        return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
      }

      const emailChallenge = (emailChallenges || [])[0] as OtpChallengeRow | undefined

      if (!emailChallenge) {
        await recordSecurityEvent({
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          eventType: 'otp_challenge',
          metadata: {
            action: 'verify_failed',
            provider: 'internal',
            channel: 'email',
            reason: 'no_active_challenge',
          },
        })

        return NextResponse.json(
          { error: 'No active OTP challenge. Please request a new code.' },
          { status: 404 }
        )
      }

      // Check attempt limit
      if (emailChallenge.attempts >= emailChallenge.max_attempts) {
        await recordSecurityEvent({
          actorUserId: emailChallenge.user_id,
          actorRole: emailChallenge.role,
          schoolId: emailChallenge.school_id,
          eventType: 'otp_challenge',
          metadata: {
            action: 'verify_failed',
            provider: 'internal',
            channel: 'email',
            reason: 'max_attempts_exceeded',
            attempts: emailChallenge.attempts,
          },
        })

        return NextResponse.json(
          { error: 'Maximum OTP attempts exceeded. Please request a new code.' },
          { status: 429 }
        )
      }

      // Verify the code against the stored hash
      const codeValid = await verifyEmailOtpCode(code.trim(), emailChallenge.code_hash)

      if (!codeValid) {
        const newAttempts = emailChallenge.attempts + 1
        const attemptsRemaining = emailChallenge.max_attempts - newAttempts

        await (supabaseAdmin.from('login_otp_challenges') as any)
          .update({ attempts: newAttempts })
          .eq('id', emailChallenge.id)

        await recordSecurityEvent({
          actorUserId: emailChallenge.user_id,
          actorRole: emailChallenge.role,
          schoolId: emailChallenge.school_id,
          eventType: 'otp_challenge',
          metadata: {
            action: 'verify_failed',
            provider: 'internal',
            channel: 'email',
            reason: 'invalid_code',
            attempts: newAttempts,
            attempts_remaining: attemptsRemaining,
          },
        })

        return NextResponse.json(
          {
            error: `Invalid OTP code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`,
            attemptsRemaining,
          },
          { status: 400 }
        )
      }

      // Mark challenge as verified
      const verifiedAt = new Date().toISOString()
      const { error: emailUpdateError } = await (supabaseAdmin.from('login_otp_challenges') as any)
        .update({ verified_at: verifiedAt })
        .eq('id', emailChallenge.id)

      if (emailUpdateError) {
        console.error('Failed to mark email OTP as verified:', emailUpdateError)
        return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
      }

      // Generate a magic link token for the user so they can establish a session client-side
      const { data: emailLinkData, error: emailLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: profile.email,
      })

      if (emailLinkError) {
        console.error('Failed to generate magic link for email OTP login:', emailLinkError)
        return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 })
      }

      await recordSecurityEvent({
        actorUserId: emailChallenge.user_id,
        actorRole: emailChallenge.role,
        schoolId: emailChallenge.school_id,
        eventType: 'otp_verified',
        metadata: {
          provider: 'internal',
          channel: 'email',
          attempts: emailChallenge.attempts + 1,
        },
      })

      const emailResponse = NextResponse.json({
        success: true,
        message: 'OTP verified successfully',
        user: {
          id: emailChallenge.user_id,
          role: emailChallenge.role,
          schoolId: emailChallenge.school_id,
        },
        tokenHash: emailLinkData?.properties?.hashed_token || null,
        verifiedAt,
      })

      // Set OTP verification cookie so middleware recognizes this session
      emailResponse.cookies.set(OTP_VERIFIED_COOKIE_NAME, buildOtpCookieValue(emailChallenge.user_id, verifiedAt), {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 60, // 30 minutes
      })

      return emailResponse
    }

    // ─── MAGIC LINK ───────────────────────────────────────────────────────────
    if (action === 'magiclink') {
      if (!identifier || !identifier.trim()) {
        return NextResponse.json({ error: 'Identifier is required' }, { status: 400 })
      }

      const profile = await resolveProfile(supabaseAdmin, {
        identifier,
        role,
        schoolId,
        wardAdmissionNumber,
      })

      if (!profile) {
        await recordSecurityEvent({
          identifier: normalizeIdentifier(identifier),
          eventType: 'otp_challenge',
          metadata: {
            action: 'magiclink',
            provider: 'internal',
            user_found: false,
            role,
          },
        })

        return NextResponse.json(
          { error: 'User not found or invalid credentials' },
          { status: 404 }
        )
      }

      if (!profile.email) {
        return NextResponse.json(
          { error: 'No email address on record for this account. Please contact your administrator.' },
          { status: 400 }
        )
      }

      // Generate a magic link token
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: profile.email,
      })

      if (linkError) {
        console.error('Failed to generate magic link:', linkError)
        return NextResponse.json({ error: 'Failed to generate sign-in link' }, { status: 500 })
      }

      const tokenHash = linkData?.properties?.hashed_token
      const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://smartsba.netlify.app'

      if (!tokenHash) {
        console.error('Magic link token hash missing:', linkData)
        return NextResponse.json({ error: 'Failed to generate sign-in link' }, { status: 500 })
      }

      const magicLinkUrl = `${BASE_URL}/login?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`

      // Send the magic link email
      const emailResult = await sendMagicLinkEmail({
        userEmail: profile.email,
        userId: profile.user_id,
        userName: profile.email.split('@')[0],
        magicLinkUrl,
        expiresMinutes: OTP_TTL_MINUTES,
        schoolId: profile.school_id || undefined,
      })

      if (!emailResult.success) {
        await recordSecurityEvent({
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          identifier: normalizeIdentifier(identifier),
          eventType: 'otp_challenge',
          metadata: {
            action: 'magiclink',
            provider: 'internal',
            send_failed: true,
            error: emailResult.error,
          },
        })

        return NextResponse.json(
          { error: emailResult.error || 'Failed to send magic link email' },
          { status: 500 }
        )
      }

      // Store a challenge row for audit/tracking
      await (supabaseAdmin.from('login_otp_challenges') as any)
        .insert({
          user_id: profile.user_id,
          role: profile.role,
          school_id: profile.school_id,
          channel: 'email',
          destination: profile.email,
          code_hash: '',
          attempts: 0,
          max_attempts: 1,
          expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
          provider: 'magiclink',
          request_id: null,
          prefix: null,
        })

      await recordSecurityEvent({
        actorUserId: profile.user_id,
        actorRole: profile.role,
        schoolId: profile.school_id,
        identifier: normalizeIdentifier(identifier),
        eventType: 'otp_challenge',
        metadata: {
          action: 'magiclink',
          provider: 'internal',
          channel: 'email',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Sign-in link sent to your email address',
      })
    }

    // ─── RESEND OTP ───────────────────────────────────────────────────────────
    if (action === 'resend') {
      if (!requestId) {
        return NextResponse.json({ error: 'requestId is required for resend' }, { status: 400 })
      }

      // Find the active challenge by requestId
      const { data: challenges, error: challengeError } = await (supabaseAdmin.from('login_otp_challenges') as any)
        .select('*')
        .eq('request_id', requestId)
        .eq('provider', 'hubtel')
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (challengeError) {
        console.error('Failed to fetch Hubtel OTP challenge for resend:', challengeError)
        return NextResponse.json({ error: 'Failed to resend OTP' }, { status: 500 })
      }

      const challenge = (challenges || [])[0] as OtpChallengeRow | undefined

      if (!challenge) {
        return NextResponse.json(
          { error: 'No active OTP challenge. Please request a new code.' },
          { status: 404 }
        )
      }

      // Call Hubtel to resend the OTP
      const resendResult = await resendHubtelOtp(requestId)

      if (!resendResult.success) {
        return NextResponse.json(
          { error: resendResult.error || 'Failed to resend OTP' },
          { status: 500 }
        )
      }

      await recordSecurityEvent({
        actorUserId: challenge.user_id,
        actorRole: challenge.role,
        schoolId: challenge.school_id,
        eventType: 'otp_challenge',
        metadata: {
          action: 'resend',
          provider: 'hubtel',
          request_id: requestId,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'OTP resent to your phone via SMS',
        requestId,
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Passwordless auth API error:', error)
    return NextResponse.json({ error: 'Failed to process passwordless login request' }, { status: 500 })
  }
}