import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { testConfiguredAIProviders, type AIProvider } from '@/services/aiLLMService'

interface ProfileRow {
  role: string
}

interface TestAIRequestBody {
  providers?: AIProvider[]
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
    .select('role')
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

    if (actor.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const parsed = (await request.json().catch(() => ({}))) as TestAIRequestBody
    const results = await testConfiguredAIProviders(parsed.providers)

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error('AI test endpoint failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI test failed',
      },
      { status: 500 }
    )
  }
}