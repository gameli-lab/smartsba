import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import logAudit from '@/lib/audit'
import { runAICommand, type AITaskType } from '@/services/aiGovernanceService'
import type { UserRole } from '@/types'

interface AICommandBody {
  task: AITaskType
  targetRole?: UserRole
  focus?: string
}

interface ProfileRow {
  role: UserRole
  school_id: string | null
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
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('session_id')

    let sessionsQuery = (adminClient as any)
      .from('ai_sessions')
      .select('id, actor_user_id, actor_role, school_id, task_type, target_role, focus, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (profile.role !== 'super_admin') {
      sessionsQuery = sessionsQuery.eq('actor_user_id', user.id)
    }

    if (sessionId) {
      sessionsQuery = sessionsQuery.eq('id', sessionId)
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery

    if (sessionsError) {
      console.error('Error reading ai_sessions:', sessionsError)
      return NextResponse.json({ error: 'Failed to load AI session history' }, { status: 500 })
    }

    const sessionIds = (sessions || []).map((s: { id: string }) => s.id)
    const { data: findings } = sessionIds.length
      ? await (adminClient as any)
          .from('ai_findings')
          .select('id, session_id, severity, area, finding, suggested_fix, status, created_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
      : { data: [] }

      const { data: testCases } = sessionIds.length
        ? await (adminClient as any)
          .from('ai_test_cases')
          .select('id, session_id, case_id, title, role, route, objective, preconditions, steps, expected_result, priority, created_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
        : { data: [] }

    const findingsBySession = new Map<string, Array<Record<string, unknown>>>()
    ;((findings || []) as Array<Record<string, unknown>>).forEach((finding) => {
      const sid = String(finding.session_id)
      const list = findingsBySession.get(sid) || []
      list.push(finding)
      findingsBySession.set(sid, list)
    })

    const testCasesBySession = new Map<string, Array<Record<string, unknown>>>()
    ;((testCases || []) as Array<Record<string, unknown>>).forEach((testCase) => {
      const sid = String(testCase.session_id)
      const list = testCasesBySession.get(sid) || []
      list.push(testCase)
      testCasesBySession.set(sid, list)
    })

    const hydratedSessions = ((sessions || []) as Array<Record<string, unknown>>).map((s) => ({
      ...s,
      findings: findingsBySession.get(String(s.id)) || [],
      test_cases: testCasesBySession.get(String(s.id)) || [],
    }))

    return NextResponse.json({ success: true, sessions: hydratedSessions }, { status: 200 })
  } catch (error) {
    console.error('Error in AI history GET:', error)
    return NextResponse.json({ error: 'Failed to load AI history' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveActor(request)

    if ('error' in actor) {
      return NextResponse.json({ error: actor.error }, { status: actor.status })
    }

    const { user, adminClient, profile: typedProfile } = actor

    const parsed = (await request.json()) as AICommandBody

    if (!parsed.task || !['switch_role', 'feature_audit', 'security_audit', 'test_plan'].includes(parsed.task)) {
      return NextResponse.json({ error: 'Invalid task. Use switch_role, feature_audit, security_audit, or test_plan.' }, { status: 400 })
    }

    const result = runAICommand({
      actorRole: typedProfile.role,
      task: parsed.task,
      targetRole: parsed.targetRole,
      focus: parsed.focus,
    })

    const { data: aiSession, error: sessionError } = await (adminClient as any)
      .from('ai_sessions')
      .insert({
        actor_user_id: user.id,
        actor_role: typedProfile.role,
        school_id: typedProfile.school_id,
        task_type: parsed.task,
        target_role: parsed.targetRole || null,
        focus: parsed.focus || null,
        status: 'completed',
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('Error creating ai_session:', sessionError)
      return NextResponse.json({ error: 'Failed to save AI session' }, { status: 500 })
    }

    const sessionId = aiSession.id as string

    await (adminClient as any)
      .from('ai_messages')
      .insert([
        {
          session_id: sessionId,
          role: 'user',
          content: {
            task: parsed.task,
            target_role: parsed.targetRole || null,
            focus: parsed.focus || null,
          },
        },
        {
          session_id: sessionId,
          role: 'assistant',
          content: result,
        },
      ])

    await (adminClient as any).from('ai_actions').insert({
      session_id: sessionId,
      action_name: 'ai_command_executed',
      action_payload: {
        task: parsed.task,
        target_role: parsed.targetRole || null,
      },
      outcome: 'success',
    })

    if (result.security_findings?.length) {
      await (adminClient as any).from('ai_findings').insert(
        result.security_findings.map((finding) => ({
          session_id: sessionId,
          severity: finding.severity,
          area: finding.area,
          finding: finding.finding,
          suggested_fix: finding.suggested_fix,
          status: 'open',
        }))
      )
    }

    if (result.test_cases?.length) {
      await (adminClient as any).from('ai_test_cases').insert(
        result.test_cases.map((testCase) => ({
          session_id: sessionId,
          case_id: testCase.id,
          title: testCase.title,
          role: testCase.role,
          route: testCase.route,
          objective: testCase.objective,
          preconditions: testCase.preconditions,
          steps: testCase.steps,
          expected_result: testCase.expected_result,
          priority: testCase.priority,
        }))
      )
    }

    await logAudit(
      adminClient,
      user.id,
      'ai_command_executed',
      'ai',
      undefined,
      {
        task: parsed.task,
        actor_role: typedProfile.role,
        target_role: parsed.targetRole || null,
        school_id: typedProfile.school_id,
        session_id: sessionId,
      }
    )

    return NextResponse.json({ success: true, session_id: sessionId, result }, { status: 200 })
  } catch (error) {
    console.error('Error in AI command route:', error)
    return NextResponse.json({ error: 'Failed to process AI command' }, { status: 500 })
  }
}
