import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { upsertClassSubjectOverride } from '@/lib/school-provisioning'

type ClassSubjectOverrideBody = {
  subject_id: string
  is_enabled: boolean
}

async function requireClassSchoolAccess(classId: string) {
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

  if (profile.role !== 'super_admin' && profile.role !== 'school_admin') {
    return { error: NextResponse.json({ error: 'Insufficient privileges' }, { status: 403 }) }
  }

  const { data: classRow, error: classError } = await admin
    .from('classes')
    .select('id, school_id')
    .eq('id', classId)
    .maybeSingle()

  if (classError || !classRow) {
    return { error: NextResponse.json({ error: 'Class not found' }, { status: 404 }) }
  }

  if (profile.role === 'school_admin' && classRow.school_id !== profile.school_id) {
    return { error: NextResponse.json({ error: 'Access denied for this class' }, { status: 403 }) }
  }

  return { admin, schoolId: classRow.school_id }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
    const auth = await requireClassSchoolAccess(classId)
    if ('error' in auth) return auth.error

    const body = (await request.json()) as ClassSubjectOverrideBody
    if (!body.subject_id) {
      return NextResponse.json({ error: 'subject_id is required' }, { status: 400 })
    }

    await upsertClassSubjectOverride({
      schoolId: auth.schoolId,
      classId,
      subjectId: body.subject_id,
      isEnabled: body.is_enabled,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Science can only be assigned') || message.includes('level') ? 400 : 500
    console.error('Error in class subject override PATCH:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
