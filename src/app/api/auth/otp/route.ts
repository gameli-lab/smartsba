'use server'

import { createHash } from 'crypto'
import bcrypt from 'bcrypt'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { buildOtpCookieValue, OTP_VERIFIED_COOKIE_NAME } from '@/lib/otp-session'
import { recordSecurityEvent } from '@/lib/security-monitor'
import { sendLoginOtpEmail } from '@/services/emailService'
import { sendSms } from '@/services/smsService'
import { applyRateLimit, getClientIp } from '@/lib/rate-limit'

const OTP_LENGTH = 6
const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 6
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const OTP_RATE_LIMIT_ATTEMPTS = 6

function generateOtpCode(): string {
  let code = ''
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += Math.floor(Math.random() * 10)
  }
  return code
}

async function hashOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10)
}

async function verifyOtpCode(plainCode: string, hashedCode: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainCode, hashedCode)
  } catch {
    return false
  }
}

function normalizeIdentifier(identifier: string): string {
  return identifier.toLowerCase().trim()
}

interface OtpRequest {
  action: 'send' | 'verify'
  identifier: string // email or phone number
  channel: 'email' | 'sms'
  code?: string // for verification action
  role?: string // optional: student, teacher, parent, school_admin, super_admin
  schoolId?: string // optional: filter by school
}

interface OtpChallenge {
  id: string
  user_id: string
  role: string
  school_id: string | null
  channel: string
  destination: string
  code_hash: string
  attempts: number
  max_attempts: number
  expires_at: string
  verified_at: string | null
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers)
    const body: OtpRequest = await req.json()

    const { action, identifier, channel, code, role, schoolId } = body

    if (!action || !['send', 'verify'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "send" or "verify".' }, { status: 400 })
    }

    if (!identifier || !identifier.trim()) {
      return NextResponse.json({ error: 'Identifier (email or phone) is required' }, { status: 400 })
    }

    if (!channel || !['email', 'sms'].includes(channel)) {
      return NextResponse.json({ error: 'Channel must be "email" or "sms"' }, { status: 400 })
    }

    const normalizedIdentifier = normalizeIdentifier(identifier)
    const rateLimitKey = `auth:otp:${ip}:${normalizedIdentifier}:${channel}`
    const rateLimit = applyRateLimit(rateLimitKey, {
      limit: OTP_RATE_LIMIT_ATTEMPTS,
      windowMs: OTP_RATE_LIMIT_WINDOW_MS,
    })

    if (!rateLimit.allowed) {
      await recordSecurityEvent({
        identifier: normalizedIdentifier,
        eventType: 'otp_challenge',
        metadata: {
          action,
          channel,
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

    // Find user by email
    let userQuery = supabaseAdmin.from('user_profiles').select('user_id, id, email, role, school_id, phone')

    if (channel === 'email') {
      userQuery = userQuery.ilike('email', normalizedIdentifier)
    } else {
      // For SMS, we'd need a phone number field - for now, just email is supported
      return NextResponse.json(
        { error: 'SMS channel not yet supported. Please use email.' },
        { status: 501 }
      )
    }

    if (role) {
      userQuery = userQuery.eq('role', role)
    }

    if (schoolId) {
      userQuery = userQuery.eq('school_id', schoolId)
    }

    const { data: profiles, error: queryError } = await userQuery

    if (queryError) {
      console.error('OTP user lookup failed:', queryError)
      return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })
    }

    const profile = (profiles || [])[0] as {
      user_id: string
      id: string
      email: string
      role: string
      school_id: string | null
    } | undefined

    if (!profile) {
      // Avoid user enumeration - always record attempt
      await recordSecurityEvent({
        identifier: normalizedIdentifier,
        eventType: 'otp_challenge',
        metadata: {
          action,
          channel,
          user_found: false,
        },
      })

      return NextResponse.json(
        { error: 'User not found or invalid credentials' },
        { status: 404 }
      )
    }

    if (action === 'send') {
      // Clean up expired challenges
      await supabaseAdmin
        .from('login_otp_challenges')
        .delete()
        .eq('user_id', profile.user_id)
        .lt('expires_at', new Date().toISOString())

      // Generate OTP code
      const otpCode = generateOtpCode()
      const codeHash = await hashOtpCode(otpCode)
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

      // Store challenge
      const { data: challengeData, error: insertError } = await supabaseAdmin
        .from('login_otp_challenges')
        .insert({
          user_id: profile.user_id,
          role: profile.role,
          school_id: profile.school_id,
          channel,
          destination: profile.email,
          code_hash: codeHash,
          attempts: 0,
          max_attempts: OTP_MAX_ATTEMPTS,
          expires_at: expiresAt,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to insert OTP challenge:', insertError)
        return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 })
      }

      // Send via email/SMS
      let sendSuccess = false
      let sendError = ''

      try {
        if (channel === 'email') {
          const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://smartsba.local'}/auth/login`
          const result = await sendLoginOtpEmail({
            userEmail: profile.email,
            userId: profile.user_id,
            userName: profile.email.split('@')[0],
            code: otpCode,
            expiresMinutes: OTP_TTL_MINUTES,
            loginUrl,
            schoolId: profile.school_id || undefined,
          })
          sendSuccess = result.success
          if (!sendSuccess) {
            sendError = result.error || 'Failed to send email'
          }
        }
        if (channel === 'sms') {
          const phone = profile['phone'] as string | undefined
          if (!phone) {
            sendError = 'User does not have a phone number on record.'
            sendSuccess = false
          } else {
            const smsBody = `Your SmartSBA OTP code is: ${otpCode}. It expires in ${OTP_TTL_MINUTES} minutes.`
            const smsResult = await sendSms(phone, smsBody)
            sendSuccess = smsResult.success
            if (!sendSuccess) sendError = smsResult.error || 'Failed to send SMS'
          }
        }
      } catch (err) {
        console.error('Failed to send OTP:', err)
        sendError = 'Failed to deliver OTP code'
      }

      if (!sendSuccess) {
        // Clean up failed challenge
        await supabaseAdmin.from('login_otp_challenges').delete().eq('id', challengeData?.id)

        await recordSecurityEvent({
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          identifier: normalizedIdentifier,
          eventType: 'otp_challenge',
          metadata: {
            action,
            channel,
            send_failed: true,
            error: sendError,
          },
        })

        return NextResponse.json({ error: sendError }, { status: 500 })
      }

      await recordSecurityEvent({
        actorUserId: profile.user_id,
        actorRole: profile.role,
        schoolId: profile.school_id,
        identifier: normalizedIdentifier,
        eventType: 'otp_challenge',
        metadata: {
          action: 'send',
          channel,
          challenge_id: challengeData?.id,
        },
      })

      return NextResponse.json({
        success: true,
        message: `OTP sent to ${channel === 'email' ? 'email' : 'phone'}`,
        expiresAt,
        challengeId: challengeData?.id,
      })
    }

    if (action === 'verify') {
      if (!code || !code.trim()) {
        return NextResponse.json({ error: 'OTP code is required for verification' }, { status: 400 })
      }

      // Find active challenge
      const { data: challenges, error: challengeError } = await supabaseAdmin
        .from('login_otp_challenges')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('channel', channel)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (challengeError) {
        console.error('Failed to fetch OTP challenge:', challengeError)
        return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
      }

      const challenge = (challenges || [])[0] as OtpChallenge | undefined

      if (!challenge) {
        await recordSecurityEvent({
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          identifier: normalizedIdentifier,
          eventType: 'otp_challenge',
          metadata: {
            action: 'verify_failed',
            channel,
            reason: 'no_active_challenge',
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
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          identifier: normalizedIdentifier,
          eventType: 'otp_challenge',
          metadata: {
            action: 'verify_failed',
            channel,
            reason: 'max_attempts_exceeded',
            attempts: challenge.attempts,
          },
        })

        return NextResponse.json(
          { error: 'Maximum OTP attempts exceeded. Please request a new code.' },
          { status: 429 }
        )
      }

      // Verify code
      const codeValid = await verifyOtpCode(code.trim(), challenge.code_hash)

      if (!codeValid) {
        const newAttempts = challenge.attempts + 1
        const attemptsRemaining = challenge.max_attempts - newAttempts

        // Update attempts
        await supabaseAdmin
          .from('login_otp_challenges')
          .update({ attempts: newAttempts })
          .eq('id', challenge.id)

        await recordSecurityEvent({
          actorUserId: profile.user_id,
          actorRole: profile.role,
          schoolId: profile.school_id,
          identifier: normalizedIdentifier,
          eventType: 'otp_challenge',
          metadata: {
            action: 'verify_failed',
            channel,
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
      const { error: updateError } = await supabaseAdmin
        .from('login_otp_challenges')
        .update({ verified_at: verifiedAt })
        .eq('id', challenge.id)

      if (updateError) {
        console.error('Failed to mark OTP as verified:', updateError)
        return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
      }

      await recordSecurityEvent({
        actorUserId: profile.user_id,
        actorRole: profile.role,
        schoolId: profile.school_id,
        identifier: normalizedIdentifier,
        eventType: 'otp_verified',
        metadata: {
          channel,
          attempts: challenge.attempts + 1,
        },
      })

      // Build response with cookie
      const response = NextResponse.json({
        success: true,
        message: 'OTP verified successfully',
        user: {
          id: profile.user_id,
          email: profile.email,
          role: profile.role,
          schoolId: profile.school_id,
        },
        verifiedAt,
      })

      // Set OTP verification cookie (httpOnly, secure, sameSite=lax)
      // Cookie TTL: 30 minutes (typical session for completing login)
      response.cookies.set(OTP_VERIFIED_COOKIE_NAME, buildOtpCookieValue(profile.user_id, verifiedAt), {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 60, // 30 minutes
      })

      return response
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('OTP API error:', error)
    return NextResponse.json({ error: 'Failed to process OTP request' }, { status: 500 })
  }
}
