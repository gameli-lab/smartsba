import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { syncSubjectToggleForSchool } from '@/lib/school-provisioning'

type ToggleSubjectBody = {
  level_group: 'KG' | 'PRIMARY' | 'JHS' | 'SHS' | 'SHTS'
  subject_key: string
  is_enabled: boolean
}

async function requireSchoolAccess(schoolId: string) {
  const supabase = await createServerComponentClient()
  const admin = createAdminSupabaseClient()

  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role, school_id')
    .eq('user_id', authResult.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  }

  const role = profile.role
  const userSchoolId = profile.school_id

  if (role !== 'super_admin' && role !== 'school_admin') {
    return { error: NextResponse.json({ error: 'Insufficient privileges' }, { status: 403 }) }
  }

  if (role === 'school_admin' && userSchoolId !== schoolId) {
    return { error: NextResponse.json({ error: 'Access denied for this school' }, { status: 403 }) }
  }

  return { admin }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId } = await params
    const auth = await requireSchoolAccess(schoolId)
    if ('error' in auth) return auth.error

    const body = (await request.json()) as ToggleSubjectBody
    if (!body.level_group || !body.subject_key) {
      return NextResponse.json({ error: 'level_group and subject_key are required' }, { status: 400 })
    }

    const { data: schoolSubjectSetting, error: settingError } = await auth.admin
      .from('school_subject_settings')
      .update({ is_enabled: body.is_enabled, updated_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('level_group', body.level_group)
      .eq('subject_key', body.subject_key)
      .select('subject_name')
      .single()

    if (settingError || !schoolSubjectSetting) {
      console.error('Failed to update subject toggle:', settingError)
      return NextResponse.json({ error: 'Subject toggle setting not found' }, { status: 404 })
    }

    await syncSubjectToggleForSchool({
      schoolId,
      levelGroup: body.level_group,
      subjectName: schoolSubjectSetting.subject_name,
      isEnabled: body.is_enabled,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error in subject toggle PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
