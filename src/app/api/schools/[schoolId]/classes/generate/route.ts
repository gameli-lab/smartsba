import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { provisionSchoolAcademicStructure } from '@/lib/school-provisioning'

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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const auth = await requireSuperAdminForApi()
    if ('error' in auth) return auth.error

    const { schoolId } = await params

    const { data: school } = await auth.admin
      .from('schools')
      .select('id')
      .eq('id', schoolId)
      .maybeSingle()

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    const setup = await provisionSchoolAcademicStructure(schoolId)
    return NextResponse.json({ success: true, setup }, { status: 200 })
  } catch (error) {
    console.error('Error in classes regenerate POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
