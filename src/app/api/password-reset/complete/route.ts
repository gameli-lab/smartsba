import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { createServerComponentClient } from '@/lib/supabase'
import { getPasswordPolicyFromSettings, validatePasswordPolicy } from '@/lib/password-policy'
import { recordSecurityEvent } from '@/lib/security-monitor'

export async function POST(req: NextRequest) {
  try {
    const { requestId, token, newPassword, confirmPassword, forceReset } = await req.json()

    if (!newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'Missing password fields' }, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    const policy = await getPasswordPolicyFromSettings()
    const validation = validatePasswordPolicy(newPassword, policy)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors[0] || 'Password does not meet policy requirements' }, { status: 400 })
    }

    const supabaseAdmin = createAdminSupabaseClient()

    if (forceReset) {
      const supabase = await createServerComponentClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (passwordError) {
        return NextResponse.json({ error: 'Failed to update user password' }, { status: 500 })
      }

      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          password_change_required: false,
          password_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (profileUpdateError) {
        return NextResponse.json({ error: 'Failed to clear password change requirement' }, { status: 500 })
      }

      await recordSecurityEvent({
        actorUserId: user.id,
        identifier: user.email || user.id,
        eventType: 'password_reset_completed',
        metadata: { mode: 'forced_initial_reset' },
      })

      return NextResponse.json({ success: true, message: 'Password updated successfully' }, { status: 200 })
    }

    if (!requestId || !token) {
      return NextResponse.json({ error: 'Missing requestId or token fields' }, { status: 400 })
    }
    const { data: resetRequest, error } = await supabaseAdmin
      .from('password_reset_requests')
      .select('id, user_id, status, reset_token, expires_at, school_id')
      .eq('id', requestId)
      .single()

    if (error || !resetRequest) {
      return NextResponse.json({ error: 'Password reset request not found' }, { status: 404 })
    }

    if (resetRequest.status !== 'approved') {
      return NextResponse.json({ error: 'This password reset request has not been approved yet' }, { status: 409 })
    }

    if (!resetRequest.reset_token || resetRequest.reset_token !== token) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 403 })
    }

    if (new Date(resetRequest.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This password reset link has expired' }, { status: 410 })
    }

    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(resetRequest.user_id, {
      password: newPassword,
    })

    if (passwordError) {
      return NextResponse.json({ error: 'Failed to update user password' }, { status: 500 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('password_reset_requests')
      .update({
        status: 'completed',
        reset_token: null,
      })
      .eq('id', requestId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to finalize password reset' }, { status: 500 })
    }

    await recordSecurityEvent({
      actorUserId: resetRequest.user_id,
      schoolId: resetRequest.school_id,
      identifier: requestId,
      eventType: 'password_reset_completed',
      metadata: { request_id: requestId },
    })

    await supabaseAdmin
      .from('user_profiles')
      .update({
        password_change_required: false,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', resetRequest.user_id)

    return NextResponse.json({ success: true, message: 'Password updated successfully' }, { status: 200 })
  } catch (error) {
    console.error('Password reset completion error:', error)
    return NextResponse.json({ error: 'Failed to complete password reset' }, { status: 500 })
  }
}