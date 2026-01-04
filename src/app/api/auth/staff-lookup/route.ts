import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    let query = supabaseAdmin
      .from('user_profiles')
      .select('id, user_id, email, staff_id, school_id, role, schools(id, name)')
      .ilike('staff_id', staffId.trim())
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
