import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import logAudit from '@/lib/audit'
import type { UserRole } from '@/types'

type FindingStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'

interface ProfileRow {
  role: UserRole
  school_id: string | null
}

interface FindingUpdateBody {
  findingId: string
  status: FindingStatus
}

async function resolveActor(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return { error: 'Server configuration error', status: 500 as const }
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { error: 'Authorization header required', status: 401 as const }
  }

  const anonClient = createClient(supabaseUrl, anonKey)
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(token)

  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 as const }
  }

  const adminClient = createAdminSupabaseClient()
  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role, school_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'Unable to verify user role', status: 403 as const }
  }

  return {
    user,
    adminClient,
    profile: profile as ProfileRow,
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveActor(request)

    if ('error' in actor) {
      return NextResponse.json({ error: actor.error }, { status: actor.status })
    }

    const { user, adminClient, profile } = actor

    let query = (adminClient as any)
      .from('ai_findings')
      .select(`
        id,
        session_id,
        severity,
        area,
        finding,
        suggested_fix,
        status,
        created_at,
        ai_sessions!inner(id, actor_user_id, school_id, actor_role, task_type)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (profile.role === 'super_admin') {
      // no additional filter
    } else if (profile.role === 'school_admin') {
      query = query.eq('ai_sessions.school_id', profile.school_id)
    } else {
      query = query.eq('ai_sessions.actor_user_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching AI findings:', error)
      return NextResponse.json({ error: 'Failed to load AI findings' }, { status: 500 })
    }

    return NextResponse.json({ success: true, findings: data || [] }, { status: 200 })
  } catch (error) {
    console.error('Error in AI findings GET:', error)
    return NextResponse.json({ error: 'Failed to load findings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await resolveActor(request)

    if ('error' in actor) {
      return NextResponse.json({ error: actor.error }, { status: actor.status })
    }

    const { user, adminClient, profile } = actor
    const body = (await request.json()) as FindingUpdateBody

    if (!body.findingId || !['open', 'in_progress', 'resolved', 'dismissed'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid finding update payload' }, { status: 400 })
    }

    const { data: existing, error: findError } = await (adminClient as any)
      .from('ai_findings')
      .select('id, session_id, status, ai_sessions!inner(actor_user_id, school_id)')
      .eq('id', body.findingId)
      .single()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const ownerUserId = existing.ai_sessions?.actor_user_id as string | undefined
    const ownerSchoolId = existing.ai_sessions?.school_id as string | undefined

    const canUpdate =
      profile.role === 'super_admin' ||
      (profile.role === 'school_admin' && ownerSchoolId === profile.school_id) ||
      ownerUserId === user.id

    if (!canUpdate) {
      return NextResponse.json({ error: 'Not authorized to update this finding' }, { status: 403 })
    }

    const { error: updateError } = await (adminClient as any)
      .from('ai_findings')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.findingId)

    if (updateError) {
      console.error('Error updating finding status:', updateError)
      return NextResponse.json({ error: 'Failed to update finding status' }, { status: 500 })
    }

    await logAudit(
      adminClient,
      user.id,
      'ai_finding_status_updated',
      'ai_finding',
      body.findingId,
      { status: body.status, actor_role: profile.role, school_id: profile.school_id }
    )

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error in AI findings PATCH:', error)
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 })
  }
}
