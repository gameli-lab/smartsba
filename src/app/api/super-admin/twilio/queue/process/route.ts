import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { processTwilioQueue } from '@/services/twilioQueueService'

interface ProfileRow {
  role: string
}

async function requireSuperAdmin(request: NextRequest): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: 'Server configuration error', status: 500 }
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return { ok: false, error: 'Authorization header required', status: 401 }
  }

  const anonClient = createClient(supabaseUrl, anonKey)
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(token)

  if (authError || !user) {
    return { ok: false, error: 'Invalid or expired token', status: 401 }
  }

  const adminClient = createAdminSupabaseClient()
  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false, error: 'Unable to verify user role', status: 403 }
  }

  if ((profile as ProfileRow).role !== 'super_admin') {
    return { ok: false, error: 'Super admin privileges required', status: 403 }
  }

  return { ok: true }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = (await request.json().catch(() => ({}))) as { batchSize?: number }
    const batchSize = typeof body.batchSize === 'number' && body.batchSize > 0 ? Math.min(body.batchSize, 100) : 20

    const result = await processTwilioQueue(batchSize)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('Twilio queue processing failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Twilio queue processing failed',
      },
      { status: 500 }
    )
  }
}
