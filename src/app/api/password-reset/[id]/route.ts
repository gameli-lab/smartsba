import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { recordSecurityEvent } from '@/lib/security-monitor'

type Action = 'approve' | 'reject'

function getSupabaseClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const supabase = createClient(url, anonKey)
  const supabaseAdmin = createAdminSupabaseClient()
  return { supabase, supabaseAdmin }
}

async function requireAdminUser(request: NextRequest) {
  const { supabase, supabaseAdmin } = getSupabaseClients()
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { error: NextResponse.json({ error: 'Authorization header required' }, { status: 401 }) }
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, user_id, role, school_id, email, full_name')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Unable to verify user permissions' }, { status: 500 }) }
  }

  if (profile.role !== 'school_admin' && profile.role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'SysAdmin privileges required' }, { status: 403 }) }
  }

  return { user, profile: profile as { id: string; user_id: string; role: string; school_id: string | null; email: string | null; full_name: string | null }, supabaseAdmin }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const adminResult = await requireAdminUser(request)
    if ('error' in adminResult) return adminResult.error

    const { profile, supabaseAdmin } = adminResult
    const { data: resetRequest, error } = await supabaseAdmin
      .from('password_reset_requests')
      .select('id, user_id, requesting_profile_id, school_id, requested_at, status, approving_admin_id, approved_at, rejection_reason, reset_token, expires_at, user_profiles!password_reset_requests_requesting_profile_id_fkey(full_name, email, role)')
      .eq('id', resolvedParams.id)
      .single()

    if (error || !resetRequest) {
      return NextResponse.json({ error: 'Password reset request not found' }, { status: 404 })
    }

    const requestSchoolId = (resetRequest as { school_id?: string | null }).school_id
    if (profile.role === 'school_admin' && requestSchoolId && profile.school_id !== requestSchoolId) {
      return NextResponse.json({ error: 'This request does not belong to your school' }, { status: 403 })
    }

    return NextResponse.json({ request: resetRequest }, { status: 200 })
  } catch (error) {
    console.error('Failed to fetch password reset request:', error)
    return NextResponse.json({ error: 'Failed to load password reset request' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const adminResult = await requireAdminUser(request)
    if ('error' in adminResult) return adminResult.error

    const { profile, supabaseAdmin } = adminResult
    const body = (await request.json()) as { action?: Action; rejectionReason?: string }

    if (body.action !== 'approve' && body.action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data: resetRequest, error } = await supabaseAdmin
      .from('password_reset_requests')
      .select('id, user_id, school_id, status, expires_at, reset_token')
      .eq('id', resolvedParams.id)
      .single()

    if (error || !resetRequest) {
      return NextResponse.json({ error: 'Password reset request not found' }, { status: 404 })
    }

    if (profile.role === 'school_admin' && resetRequest.school_id && profile.school_id !== resetRequest.school_id) {
      return NextResponse.json({ error: 'This request does not belong to your school' }, { status: 403 })
    }

    if (resetRequest.status !== 'pending') {
      return NextResponse.json({ error: 'This request has already been processed' }, { status: 409 })
    }

    if (new Date(resetRequest.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin
        .from('password_reset_requests')
        .update({ status: 'rejected', rejection_reason: 'Request expired', approving_admin_id: profile.id, approved_at: new Date().toISOString() })
        .eq('id', resolvedParams.id)

      return NextResponse.json({ error: 'This request has expired' }, { status: 410 })
    }

    if (body.action === 'reject') {
      const { error: updateError } = await supabaseAdmin
        .from('password_reset_requests')
        .update({
          status: 'rejected',
          rejection_reason: body.rejectionReason || 'Rejected by admin',
          approving_admin_id: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', resolvedParams.id)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 })
      }

      await recordSecurityEvent({
        actorUserId: profile.user_id,
        actorRole: profile.role,
        schoolId: resetRequest.school_id,
        identifier: resolvedParams.id,
        eventType: 'password_reset_approved',
        metadata: { action: 'reject' },
      })

      return NextResponse.json({ success: true, status: 'rejected' }, { status: 200 })
    }

    const resetToken = uuidv4()
    const { error: updateError } = await supabaseAdmin
      .from('password_reset_requests')
      .update({
        status: 'approved',
        approving_admin_id: profile.id,
        approved_at: new Date().toISOString(),
        reset_token: resetToken,
      })
      .eq('id', resolvedParams.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 })
    }

    await recordSecurityEvent({
      actorUserId: profile.user_id,
      actorRole: profile.role,
      schoolId: resetRequest.school_id,
      identifier: resolvedParams.id,
      eventType: 'password_reset_approved',
      metadata: { action: 'approve' },
    })

    return NextResponse.json({
      success: true,
      status: 'approved',
      requestId: resolvedParams.id,
      token: resetToken,
      resetLink: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/reset-password?requestId=${resolvedParams.id}&token=${resetToken}`,
    }, { status: 200 })
  } catch (error) {
    console.error('Failed to update password reset request:', error)
    return NextResponse.json({ error: 'Failed to update password reset request' }, { status: 500 })
  }
}