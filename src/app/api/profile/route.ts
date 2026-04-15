import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'

type ProfileUpdateBody = {
  fullName?: string
  phone?: string
  address?: string
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = (await req.json()) as ProfileUpdateBody
    const fullName = body.fullName?.trim()
    const phone = body.phone?.trim() || null
    const address = body.address?.trim() || null

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()

    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { error: updateError } = await admin
      .from('user_profiles')
      .update({
        full_name: fullName,
        phone,
        address,
      })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (profile.role === 'parent') {
      const { error: parentUpdateError } = await admin
        .from('parents')
        .upsert(
          { user_id: user.id, contact_phone: phone },
          { onConflict: 'user_id' }
        )

      if (parentUpdateError) {
        return NextResponse.json({ error: parentUpdateError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (routeError) {
    console.error('Profile update failed:', routeError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
