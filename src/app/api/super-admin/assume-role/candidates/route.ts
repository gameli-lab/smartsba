import { NextResponse } from 'next/server'
import { AssumableRole } from '@/lib/assume-role'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'

const ALLOWED_ROLES: AssumableRole[] = ['school_admin', 'teacher', 'student', 'parent']

export async function GET(req: Request) {
  const supabase = await createServerComponentClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile || (profile as { role?: string }).role !== 'super_admin') {
    return NextResponse.json({ error: 'SysAdmin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') as AssumableRole | null

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Valid role is required' }, { status: 400 })
  }

  const { data: rows, error: rowsError } = await admin
    .from('user_profiles')
    .select('user_id, full_name, email, school_id')
    .eq('role', role)
    .order('full_name', { ascending: true })
    .limit(100)

  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 })
  }

  const schoolIds = Array.from(new Set((rows || []).map((row: any) => row.school_id).filter(Boolean))) as string[]
  let schoolMap = new Map<string, string>()

  if (schoolIds.length > 0) {
    const { data: schools } = await admin
      .from('schools')
      .select('id, name')
      .in('id', schoolIds)

    schoolMap = new Map((schools || []).map((school: any) => [school.id, school.name]))
  }

  const candidates = (rows || []).map((row: any) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    schoolId: row.school_id,
    schoolName: row.school_id ? (schoolMap.get(row.school_id) || null) : null,
  }))

  return NextResponse.json({ role, candidates })
}
