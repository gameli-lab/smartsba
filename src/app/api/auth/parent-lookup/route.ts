import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'

interface ParentLookupBody {
  parentName?: string
  wardAdmissionNumber?: string
  schoolId?: string
}

export async function POST(req: NextRequest) {
  try {
    const { parentName, wardAdmissionNumber, schoolId }: ParentLookupBody = await req.json()

    if (!parentName?.trim() || !wardAdmissionNumber?.trim()) {
      return NextResponse.json({ error: 'Parent name and ward admission number are required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminSupabaseClient()

    let parentQuery = supabaseAdmin
      .from('user_profiles')
      .select('id, user_id, email, school_id, full_name, role, schools(id, name)')
      .eq('role', 'parent')
      .eq('full_name', parentName.trim())

    const { data: wardRows, error: wardError } = await supabaseAdmin
      .from('students')
      .select('id, school_id, admission_number')
      .ilike('admission_number', wardAdmissionNumber.trim())

    if (wardError) {
      console.error('Parent lookup ward query failed', wardError)
      return NextResponse.json({ error: 'Failed to look up parent credentials' }, { status: 500 })
    }

    const scopedWardRows = (wardRows || []).filter((w) => !schoolId || w.school_id === schoolId)
    const wardIds = scopedWardRows.map((w) => w.id)

    if (wardIds.length === 0) {
      return NextResponse.json({ profiles: [] })
    }

    if (schoolId) {
      parentQuery = parentQuery.eq('school_id', schoolId)
    }

    const [{ data: parentRows, error: parentError }, { data: linkRows, error: linkError }] = await Promise.all([
      parentQuery,
      supabaseAdmin
        .from('parent_student_links')
        .select('parent_id, student_id')
        .in('student_id', wardIds),
    ])

    if (parentError || linkError) {
      console.error('Parent lookup query failed', { parentError, linkError })
      return NextResponse.json({ error: 'Failed to look up parent credentials' }, { status: 500 })
    }

    const linkedParentIds = new Set((linkRows || []).map((l) => l.parent_id))
    const profiles = (parentRows || []).filter((p) => linkedParentIds.has(p.id))

    return NextResponse.json({ profiles })
  } catch (err) {
    console.error('Parent lookup handler error', err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
