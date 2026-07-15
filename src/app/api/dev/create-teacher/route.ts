import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { sendUserCreatedEmail } from '@/services/emailService'

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

    const tempPassword = `Teacher@${Math.random().toString(36).slice(-8)}`

    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password: tempPassword,
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

    // generate plain-text credentials file
    const credentialsText = [
      'Teacher Credentials',
      `Full name: ${full_name}`,
      `Email: ${email}`,
      `Staff ID: ${staff_id}`,
      `Temporary password: ${tempPassword}`,
      `Phone: ${phone || ''}`,
      `Gender: ${gender || ''}`,
      `Date of birth: ${date_of_birth || ''}`,
      `Address: ${address || ''}`,
      `Specialization: ${specialization || ''}`,
      `Qualification: ${qualification || ''}`,
      `Hire date: ${hire_date || ''}`,
    ].join('\n')

    const downloadBase64 = Buffer.from(credentialsText, 'utf8').toString('base64')
    const downloadFilename = `teacher_${staff_id}_${new Date().toISOString().slice(0,10)}.txt`

    // attempt to send email
    try {
      const { data: schoolRow } = await (adminSupabase as any)
        .from('schools')
        .select('name')
        .eq('id', school_id)
        .maybeSingle()
      const schoolName = schoolRow?.name || 'Your School'
      await sendUserCreatedEmail({
        userName: full_name,
        userEmail: email,
        userId,
        role: 'teacher',
        schoolName,
        schoolId: school_id,
        temporaryPassword: tempPassword,
      })
    } catch (e) {
      console.error('Email send failed', e)
    }

    return NextResponse.json({ success: true, tempPassword, downloadBase64, downloadFilename })
  } catch (error) {
    console.error('Dev create teacher error', error)
    return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
  }
}
