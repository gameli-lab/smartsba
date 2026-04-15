import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { runSecurityRuleChecks, persistSecurityRuleCheckRun } from '@/services/securityRuleEngineService'

interface ProfileRow {
  role: string
}

interface RuleChecksBody {
  content: string
  target?: string
  includeAIAdvisory?: boolean
}

async function requireSuperAdmin(request: NextRequest): Promise<{ userId: string } | { error: string; status: number }> {
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

  const typedProfile = profile as ProfileRow
  if (typedProfile.role !== 'super_admin') {
    return { error: 'SysAdmin privileges required', status: 403 }
  }

  return { userId: user.id }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = (await request.json()) as RuleChecksBody

    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const input = {
      content: body.content,
      target: body.target,
      includeAIAdvisory: body.includeAIAdvisory,
    }

    const result = await runSecurityRuleChecks(input)
    const runId = await persistSecurityRuleCheckRun(auth.userId, input, result)

    return NextResponse.json({
      success: true,
      runId,
      result,
    })
  } catch (error) {
    console.error('Security rule checks failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Security rule checks failed',
      },
      { status: 500 }
    )
  }
}
