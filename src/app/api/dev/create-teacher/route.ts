import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      full_name,
      email,
      staff_id,
      phone,
      gender,
      date_of_birth,
      address,
      specialization,
      qualification,
      hire_date,
      school_id,
    } = body

    if (!full_name || !email || !staff_id || !school_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const adminSupabase = createAdminSupabaseClient()

    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (authError || !authUser?.user) {
      console.error('Auth create error', authError)
      return NextResponse.json({ success: false, error: 'Failed to create auth user' }, { status: 500 })
    }

    const userId = authUser.user.id

    // ensure school exists (dev convenience)
    try {
      const { data: existingSchool } = await (adminSupabase as any)
        .from('schools')
        .select('id')
        .eq('id', school_id)
        .maybeSingle()
      if (!existingSchool) {
        await (adminSupabase as any).from('schools').insert({ id: school_id, name: `Dev School ${school_id.slice(0,8)}` })
      }
    } catch (e) {
      console.error('Ensure school error', e)
    }

    const { error: profileError } = await (adminSupabase as any)
      .from('user_profiles')
      .insert({
        user_id: userId,
        school_id,
        role: 'teacher',
        email,
        full_name,
        staff_id,
        phone: phone || null,
        gender: gender || null,
        date_of_birth: date_of_birth || null,
        address: address || null,
        status: 'active',
      })

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(userId)
      console.error('Profile create error', profileError)
      return NextResponse.json({ success: false, error: 'Failed to create profile', details: profileError }, { status: 500 })
    }

    const { error: teacherError } = await (adminSupabase as any)
      .from('teachers')
      .insert({
        school_id,
        user_id: userId,
        staff_id,
        specialization: specialization || null,
        qualification: qualification || null,
        hire_date: hire_date || null,
        is_active: true,
      })

    if (teacherError) {
      await adminSupabase.from('user_profiles').delete().eq('user_id', userId)
      await adminSupabase.auth.admin.deleteUser(userId)
      console.error('Teacher record error', teacherError)
      return NextResponse.json({ success: false, error: 'Failed to create teacher record' }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId, passwordless: true })
  } catch (error) {
    console.error('Dev create teacher error', error)
    return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
  }
}
