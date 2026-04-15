import { NextRequest, NextResponse } from 'next/server'
import {
  checkLockout,
  clearFailedAttempts,
  createScopeKey,
  normalizeIdentifier,
  recordFailedAttempt,
} from '@/lib/login-security'
import { applyRateLimit, getClientIp } from '@/lib/rate-limit'

type SecurityAction = 'check' | 'record_failure' | 'record_success'
type SecurityRole = 'super_admin' | 'staff' | 'student' | 'parent'

interface LoginSecurityBody {
  action?: SecurityAction
  identifier?: string
  role?: SecurityRole
  schoolId?: string
}

function isSecurityRole(role: string): role is SecurityRole {
  return role === 'super_admin' || role === 'staff' || role === 'student' || role === 'parent'
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginSecurityBody
    const { action, identifier, role, schoolId } = body

    if (!action || !identifier || !role || !isSecurityRole(role)) {
      return NextResponse.json({ error: 'Invalid login security request' }, { status: 400 })
    }

    const normalizedIdentifier = normalizeIdentifier(identifier)
    if (!normalizedIdentifier) {
      return NextResponse.json({ error: 'Identifier is required' }, { status: 400 })
    }

    const ip = getClientIp(req.headers)
    const rateLimitKey = `auth:login-security:${ip}:${role}:${normalizedIdentifier}`
    const rateLimit = applyRateLimit(rateLimitKey, { limit: 20, windowMs: 15 * 60 * 1000 })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
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

    const scopeKey = createScopeKey(role, normalizedIdentifier, schoolId)

    if (action === 'check') {
      const lockoutState = await checkLockout(scopeKey)
      return NextResponse.json(lockoutState)
    }

    if (action === 'record_success') {
      await clearFailedAttempts(scopeKey)
      return NextResponse.json({ success: true })
    }

    if (action === 'record_failure') {
      const result = await recordFailedAttempt({
        scopeKey,
        role,
        schoolId,
        identifierHint: normalizedIdentifier.slice(0, 8),
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (error) {
    console.error('Login security handler error:', error)
    return NextResponse.json({ error: 'Failed to process login security request' }, { status: 500 })
  }
}