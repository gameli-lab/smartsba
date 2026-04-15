import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { checkLockout, createScopeKey, normalizeIdentifier } from '@/lib/login-security'
import { applyRateLimit, getClientIp } from '@/lib/rate-limit'

interface StaffLookupBody {
  staffId?: string
  schoolId?: string
}

export async function POST(req: NextRequest) {
  try {
    const { staffId, schoolId }: StaffLookupBody = await req.json()

    if (!staffId || !staffId.trim()) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 })
    }

    const normalizedStaffId = normalizeIdentifier(staffId)
    const ip = getClientIp(req.headers)
    const rateLimitKey = `auth:staff-lookup:${ip}:${normalizedStaffId}`
    const rateLimit = applyRateLimit(rateLimitKey, { limit: 10, windowMs: 15 * 60 * 1000 })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many authentication attempts. Please try again later.',
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

    const lockoutState = await checkLockout(createScopeKey('staff', normalizedStaffId, schoolId))
    if (lockoutState.locked) {
      return NextResponse.json(
        {
          error: `Account temporarily locked due to failed attempts. Try again in ${lockoutState.remainingMinutes ?? 1} minute(s).`,
          locked: true,
          remainingMinutes: lockoutState.remainingMinutes ?? 1,
        },
        { status: 423 }
      )
    }

    const supabaseAdmin = createAdminSupabaseClient()

    let query = supabaseAdmin
      .from('user_profiles')
      .select('id, user_id, email, staff_id, school_id, role, schools(id, name)')
      .ilike('staff_id', normalizedStaffId)
      .in('role', ['school_admin', 'teacher'])

    if (schoolId) {
      query = query.eq('school_id', schoolId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Staff lookup query failed', error)
      return NextResponse.json({ error: 'Failed to look up staff credentials' }, { status: 500 })
    }

    return NextResponse.json({ profiles: data ?? [] })
  } catch (err) {
    console.error('Staff lookup handler error', err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
