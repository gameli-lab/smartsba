import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { executeGitHubSync, type EffectiveGitHubSyncMode } from '@/services/githubSyncService'

interface ProfileRow {
  role: string
}

interface SyncBody {
  filePath?: string
  content?: string
  files?: Array<{ filePath: string; content: string }>
  commitMessage: string
  pullRequestTitle?: string
  pullRequestBody?: string
  branchName?: string
  requestedMode?: EffectiveGitHubSyncMode
}

async function requireSuperAdmin(request: NextRequest): Promise<{ userId: string; error?: string; status?: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return { userId: '', error: 'Server configuration error', status: 500 }
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return { userId: '', error: 'Authorization header required', status: 401 }
  }

  const anonClient = createClient(supabaseUrl, anonKey)
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(token)

  if (authError || !user) {
    return { userId: '', error: 'Invalid or expired token', status: 401 }
  }

  const adminClient = createAdminSupabaseClient()
  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { userId: '', error: 'Unable to verify user role', status: 403 }
  }

  const typedProfile = profile as ProfileRow
  if (typedProfile.role !== 'super_admin') {
    return { userId: '', error: 'Super admin privileges required', status: 403 }
  }

  return { userId: user.id }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 403 })
    }

    const body = (await request.json()) as SyncBody

    const hasSingleFile = Boolean(body.filePath && typeof body.content === 'string')
    const hasBatchFiles = Array.isArray(body.files) && body.files.length > 0

    if ((!hasSingleFile && !hasBatchFiles) || !body.commitMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: commitMessage and either filePath+content or files[]' },
        { status: 400 }
      )
    }

    const result = await executeGitHubSync({
      filePath: body.filePath,
      content: body.content,
      files: body.files,
      commitMessage: body.commitMessage,
      pullRequestTitle: body.pullRequestTitle,
      pullRequestBody: body.pullRequestBody,
      branchName: body.branchName,
      requestedMode: body.requestedMode,
    })

    return NextResponse.json(
      {
        success: true,
        result,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('GitHub sync execution failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'GitHub sync failed',
      },
      { status: 500 }
    )
  }
}
