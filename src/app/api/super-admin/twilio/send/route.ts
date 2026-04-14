import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { sendSMS, resolveTwilioSender } from '@/services/twilioService'
import { enqueueTwilioMessage } from '@/services/twilioQueueService'

interface ProfileRow {
  role: string
  school_id: string | null
}

interface SendSMSBody {
  to: string
  body: string
  schoolId?: string | null
  dryRun?: boolean
  queue?: boolean
}

async function resolveActor(request: NextRequest): Promise<
  | { userId: string; profile: ProfileRow }
  | { error: string; status: number }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return { error: 'Server configuration error', status: 500 }
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return { error: 'Authorization header required', status: 401 }
  }

  const anonClient = createClient(supabaseUrl, anonKey)
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(token)

  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 }
  }

  const adminClient = createAdminSupabaseClient()
  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role, school_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'Unable to verify user role', status: 403 }
  }

  return {
    userId: user.id,
    profile: profile as ProfileRow,
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveActor(request)
    if ('error' in actor) {
      return NextResponse.json({ error: actor.error }, { status: actor.status })
    }

    const parsed = (await request.json()) as SendSMSBody

    if (!parsed.to || !parsed.body) {
      return NextResponse.json({ error: 'Missing required fields: to, body' }, { status: 400 })
    }

    const role = actor.profile.role
    if (role !== 'super_admin' && role !== 'school_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (role === 'school_admin') {
      if (!actor.profile.school_id) {
        return NextResponse.json({ error: 'School context is required for school admin SMS sending' }, { status: 403 })
      }

      if (parsed.schoolId && parsed.schoolId !== actor.profile.school_id) {
        return NextResponse.json({ error: 'School admins can only send SMS for their own school' }, { status: 403 })
      }
    }

    const schoolId = parsed.schoolId || actor.profile.school_id

    if (parsed.dryRun) {
      const sender = await resolveTwilioSender(schoolId)
      return NextResponse.json({
        success: true,
        dryRun: true,
        sender,
      })
    }

    const useQueue = parsed.queue !== false

    if (useQueue) {
      const queued = await enqueueTwilioMessage({
        to: parsed.to,
        body: parsed.body,
        schoolId,
        createdBy: actor.userId,
      })

      return NextResponse.json({
        success: true,
        queued: true,
        queueId: queued.id,
      })
    }

    const result = await sendSMS({
      to: parsed.to,
      body: parsed.body,
      schoolId,
    })

    return NextResponse.json({
      success: true,
      queued: false,
      result,
    })
  } catch (error) {
    console.error('Twilio send endpoint failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'SMS send failed',
      },
      { status: 500 }
    )
  }
}
