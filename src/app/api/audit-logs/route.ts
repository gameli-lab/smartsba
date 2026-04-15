import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface AuditLogRow {
  id: string
  actor_user_id: string | null
  actor_role: string | null
  action_type: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface ActorProfile {
  full_name: string | null
  email: string | null
}

export async function GET(request: NextRequest) {
  try {
    // Verify environment variables
    const requiredEnvVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([, value]) => !value)
      .map(([key]) => key)

    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL as string,
      requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY as string
    )

    const supabase = createClient(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL as string,
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    )

    // Verify authentication
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Verify user is super_admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return NextResponse.json({ error: 'Unable to verify user permissions' }, { status: 500 })
    }

    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'SysAdmin privileges required' }, { status: 403 })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const perPage = Math.max(1, parseInt(url.searchParams.get('per_page') || '20', 10))
    const actionType = url.searchParams.get('action_type') || 'all'
    const entityType = url.searchParams.get('entity_type') || 'all'
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')

    // Build query
    let query = supabaseAdmin
      .from('audit_logs')
      .select(
        `
        id,
        actor_user_id,
        actor_role,
        action_type,
        entity_type,
        entity_id,
        metadata,
        created_at
      `
      )

    // Apply filters
    if (actionType !== 'all') {
      query = query.eq('action_type', actionType)
    }

    if (entityType !== 'all') {
      query = query.eq('entity_type', entityType)
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Apply cursor for pagination
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(perPage + 1)

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
          created_at: string
          id: string
        }
        // Use OR condition for proper cursor-based pagination with composite ordering
        query = query.or(
          `created_at.lt.${decoded.created_at},(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
        )
      } catch {
        console.warn('Invalid cursor provided')
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
    }

    const rows: AuditLogRow[] = (data || []) as AuditLogRow[]
    let next_cursor: string | null = null

    // Check if there are more results
    if (rows.length > perPage) {
      const last = rows[perPage - 1]
      const payload = { created_at: last.created_at, id: last.id }
      next_cursor = Buffer.from(JSON.stringify(payload)).toString('base64')
      rows.length = perPage
    }

    // Get user profiles for actor_user_ids
    const userIds = [...new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id)))]
    let userProfiles: Record<string, ActorProfile> = {}

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds)

      if (profiles) {
        userProfiles = Object.fromEntries(
          profiles.map((p) => [p.user_id, { full_name: p.full_name, email: p.email }])
        )
      }
    }

    // Format logs for response
    const logs = rows.map((row) => {
      const profile = userProfiles[row.actor_user_id]
      return {
        id: row.id,
        actor_user_id: row.actor_user_id,
        actor_name: profile?.full_name || 'Unknown',
        actor_email: profile?.email || null,
        actor_role: row.actor_role,
        action_type: row.action_type,
        entity_type: row.entity_type,
        entity_id: row.entity_id || null,
        metadata: row.metadata || null,
        created_at: row.created_at,
      }
    })

    return NextResponse.json({ logs, next_cursor }, { status: 200 })
  } catch (err) {
    console.error('Error in audit-logs GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
