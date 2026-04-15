import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { checkLockout, createScopeKey, normalizeIdentifier } from '@/lib/login-security'
import { applyRateLimit, getClientIp } from '@/lib/rate-limit'

interface ParentLookupBody {
  parentName?: string
  wardAdmissionNumber?: string
  schoolId?: string
}

interface ParentStudentLinkRow {
  student?: {
    guardian_name?: string | null
    guardian_email?: string | null
  } | null
}

interface ParentLookupProfile {
  id: string
  full_name: string | null
  email: string | null
  parent_student_relationships?: ParentStudentLinkRow[] | ParentStudentLinkRow | null
}

export async function POST(req: NextRequest) {
  try {
    const { parentName, wardAdmissionNumber, schoolId }: ParentLookupBody = await req.json()
    const normalizedParentName = parentName?.trim()
    const normalizedWardAdmissionNumber = wardAdmissionNumber?.trim()

    if (!normalizedParentName || !normalizedWardAdmissionNumber) {
      return NextResponse.json({ error: 'Parent name and ward admission number are required' }, { status: 400 })
    }

    const normalizedIdentifier = normalizeIdentifier(normalizedParentName)
    const ip = getClientIp(req.headers)
    const rateLimitKey = `auth:parent-lookup:${ip}:${normalizedIdentifier}:${normalizedWardAdmissionNumber.toLowerCase()}`
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

    const lockoutState = await checkLockout(createScopeKey('parent', normalizedIdentifier, schoolId))
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
      .select(`
        id,
        user_id,
        email,
        school_id,
        full_name,
        role,
        schools(id, name),
        parent_student_relationships!inner(
          student:students!inner(
            id,
            school_id,
            admission_number,
            guardian_name,
            guardian_email
          )
        )
      `)
      .eq('role', 'parent')
      .ilike('parent_student_relationships.student.admission_number', normalizedWardAdmissionNumber)

    if (schoolId) {
      query = query.eq('parent_student_relationships.student.school_id', schoolId)
    }

    const { data: parentRows, error: parentError } = await query

    if (parentError) {
      console.error('Parent lookup profile query failed', { parentError })
      return NextResponse.json({ error: 'Failed to look up parent credentials' }, { status: 500 })
    }

    const normalizedLookup = normalizedIdentifier
    const dedupedProfiles = Array.from(
      new Map(((parentRows || []) as ParentLookupProfile[]).map((profile) => [profile.id, profile])).values()
    )

    const profiles = dedupedProfiles.filter((profile) => {
      const fullName = typeof profile.full_name === 'string' ? profile.full_name.trim().toLowerCase() : ''
      const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : ''

      const relationshipRows = Array.isArray(profile.parent_student_relationships)
        ? profile.parent_student_relationships
        : profile.parent_student_relationships
          ? [profile.parent_student_relationships]
          : []

      const guardianMatch = relationshipRows.some((link) => {
        const guardianName = typeof link?.student?.guardian_name === 'string'
          ? link.student.guardian_name.trim().toLowerCase()
          : ''
        const guardianEmail = typeof link?.student?.guardian_email === 'string'
          ? link.student.guardian_email.trim().toLowerCase()
          : ''
        return guardianName === normalizedLookup || guardianEmail === normalizedLookup
      })

      return fullName === normalizedLookup || email === normalizedLookup || guardianMatch
    })

    if (profiles.length === 0) {
      if ((parentRows || []).length === 1) {
        return NextResponse.json({ profiles: [parentRows![0]], reason: 'single_link_parent_fallback' })
      }

      const reason = (parentRows || []).length === 0
        ? 'no_parent_link_for_ward'
        : 'identifier_not_matching_linked_parent'
      return NextResponse.json({ profiles: [], reason })
    }

    return NextResponse.json({ profiles, reason: null })
  } catch (err) {
    console.error('Parent lookup handler error', err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
