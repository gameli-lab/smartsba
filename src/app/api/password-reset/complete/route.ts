import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getPasswordPolicyFromSettings, validatePasswordPolicy } from '@/lib/password-policy'
import { recordSecurityEvent } from '@/lib/security-monitor'

export async function POST(req: NextRequest) {
  try {
    const { requestId, token, newPassword, confirmPassword } = await req.json()

    if (!requestId || !token || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'Missing requestId, token, or password fields' }, { status: 400 })
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

    return NextResponse.json({ success: true, message: 'Password updated successfully' }, { status: 200 })
  } catch (error) {
    console.error('Password reset completion error:', error)
    return NextResponse.json({ error: 'Failed to complete password reset' }, { status: 500 })
  }
}