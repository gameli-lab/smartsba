import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { EducationLevel, StreamType, provisionSchoolAcademicStructure } from '@/lib/school-provisioning'

type CreateSchoolBody = {
  name: string
  motto?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  logo_url?: string | null
  stamp_url?: string | null
  head_signature_url?: string | null
  status?: 'active' | 'inactive'
  education_levels: EducationLevel[]
  stream_type: StreamType
  stream_count?: number | null
}

async function requireSuperAdminForApi() {
  const supabase = await createServerComponentClient()
  const admin = createAdminSupabaseClient()

  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role')
    .eq('user_id', authResult.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  }

  if (profile.role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'SysAdmin privileges required' }, { status: 403 }) }
  }

  return { admin }
}

function validateSchoolPayload(payload: CreateSchoolBody): string | null {
  if (!payload.name?.trim()) return 'School name is required'

  const levels = payload.education_levels || []
  if (!levels.length) return 'Select at least one education level'

  const allowedLevels: EducationLevel[] = ['KG', 'PRIMARY', 'JHS', 'SHS', 'SHTS']
  if (levels.some((level) => !allowedLevels.includes(level))) {
    return 'Invalid education level supplied'
  }

  if (!['single', 'double', 'cluster'].includes(payload.stream_type)) {
    return 'Invalid stream type'
  }

  if (payload.stream_type === 'cluster') {
    if (!payload.stream_count || payload.stream_count < 2 || payload.stream_count > 26) {
      return 'Cluster stream count must be between 2 and 26'
    }
  }

  if (payload.stream_type !== 'cluster' && payload.stream_count) {
    return 'Stream count is only allowed for cluster stream type'
  }

  return null
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdminForApi()
    if ('error' in auth) return auth.error

    const body = (await request.json()) as CreateSchoolBody
    const validationError = validateSchoolPayload(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const admin = auth.admin

    const { data: insertedSchool, error: insertError } = await admin
      .from('schools')
      .insert({
        name: body.name.trim(),
        motto: body.motto || null,
        address: body.address || null,
        phone: body.phone || null,
        email: body.email || null,
        website: body.website || null,
        logo_url: body.logo_url || null,
        stamp_url: body.stamp_url || null,
        head_signature_url: body.head_signature_url || null,
        status: body.status || 'active',
        education_levels: body.education_levels,
        stream_type: body.stream_type,
        stream_count: body.stream_type === 'cluster' ? body.stream_count ?? null : null,
      })
      .select('*')
      .single()

    if (insertError || !insertedSchool) {
      console.error('School creation failed:', insertError)
      return NextResponse.json({ error: 'Failed to create school' }, { status: 500 })
    }

    const provision = await provisionSchoolAcademicStructure(insertedSchool.id)

    return NextResponse.json(
      {
        school: insertedSchool,
        setup: provision,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in school POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
