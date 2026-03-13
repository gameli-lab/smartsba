import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'

interface StudentLookupBody {
  admissionNumber?: string
  schoolId?: string
}

type LookupProfile = {
  id: string
  user_id: string
  email: string
  school_id: string | null
  role: string
  admission_number?: string | null
  schools?: {
    id: string
    name: string
  } | null
}

export async function POST(req: NextRequest) {
  try {
    const { admissionNumber, schoolId }: StudentLookupBody = await req.json()

    if (!admissionNumber || !admissionNumber.trim()) {
      return NextResponse.json({ error: 'Admission number is required' }, { status: 400 })
    }

    const normalizedAdmission = admissionNumber.trim()
    const supabaseAdmin = createAdminSupabaseClient()

    let profileQuery = supabaseAdmin
      .from('user_profiles')
      .select('id, user_id, email, school_id, role, admission_number, schools(id, name)')
      .eq('role', 'student')
      .ilike('admission_number', normalizedAdmission)

    let studentQuery = supabaseAdmin
      .from('students')
      .select('user_id, school_id, admission_number')
      .ilike('admission_number', normalizedAdmission)

    if (schoolId) {
      profileQuery = profileQuery.eq('school_id', schoolId)
      studentQuery = studentQuery.eq('school_id', schoolId)
    }

    const [{ data: profileMatches, error: profileError }, { data: studentMatches, error: studentError }] = await Promise.all([
      profileQuery,
      studentQuery,
    ])

    if (profileError || studentError) {
      console.error('Student lookup query failed', { profileError, studentError })
      return NextResponse.json({ error: 'Failed to look up student credentials' }, { status: 500 })
    }

    const directProfiles = (profileMatches || []) as LookupProfile[]
    const matchedUserIds = Array.from(new Set((studentMatches || []).map((row) => row.user_id).filter(Boolean)))

    let studentProfiles: LookupProfile[] = []
    if (matchedUserIds.length > 0) {
      let byStudentUserIdsQuery = supabaseAdmin
        .from('user_profiles')
        .select('id, user_id, email, school_id, role, admission_number, schools(id, name)')
        .eq('role', 'student')
        .in('user_id', matchedUserIds)

      if (schoolId) {
        byStudentUserIdsQuery = byStudentUserIdsQuery.eq('school_id', schoolId)
      }

      const { data, error } = await byStudentUserIdsQuery
      if (error) {
        console.error('Student lookup profile merge query failed', error)
        return NextResponse.json({ error: 'Failed to look up student credentials' }, { status: 500 })
      }
      studentProfiles = (data || []) as LookupProfile[]
    }

    const mergedProfiles = Array.from(
      new Map(
        [...directProfiles, ...studentProfiles].map((profile) => [profile.user_id, profile])
      ).values()
    )

    return NextResponse.json({ profiles: mergedProfiles })
  } catch (err) {
    console.error('Student lookup handler error', err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}