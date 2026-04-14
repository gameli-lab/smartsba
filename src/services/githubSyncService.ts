import { createAdminSupabaseClient } from '@/lib/supabase'

export type GitHubSyncMode = 'pr_only' | 'direct_commit' | 'hybrid'
export type EffectiveGitHubSyncMode = 'pr_only' | 'direct_commit'

interface GitHubConfig {
  token: string
  repoOwner: string
  repoName: string
  prodMode: GitHubSyncMode
  defaultBranch: string
}

interface ExecuteGitHubSyncInput {
  filePath?: string
  content?: string
  files?: Array<{ filePath: string; content: string }>
  commitMessage: string
  pullRequestTitle?: string
  pullRequestBody?: string
  branchName?: string
  requestedMode?: EffectiveGitHubSyncMode
}

interface GitHubRepoResponse {
  default_branch?: string
}

interface GitHubContentResponse {
  sha?: string
}

interface GitHubRefResponse {
  object?: {
    sha?: string
  }
}

interface GitHubPullResponse {
  html_url?: string
  number?: number
}

interface GitHubSyncResult {
  mode: EffectiveGitHubSyncMode
  branch: string
  commitSha?: string
  pullRequestUrl?: string
  pullRequestNumber?: number
  filesUpdated: number
}

const REQUIRED_SETTINGS = [
  'github.token',
  'github.repo_owner',
  'github.repo_name',
  'github.prod_mode',
  'github.default_branch',
] as const

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeMode(value: unknown): GitHubSyncMode {
  if (value === 'pr_only' || value === 'direct_commit' || value === 'hybrid') {
    return value
  }
  return 'hybrid'
}

async function getSettingsMap(): Promise<Record<string, unknown>> {
  const adminClient = createAdminSupabaseClient()
  const { data } = await adminClient
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [...REQUIRED_SETTINGS])

  const settings: Record<string, unknown> = {}
  for (const row of data || []) {
    const typed = row as { setting_key: string; setting_value: unknown }
    settings[typed.setting_key] = typed.setting_value
  }

  return settings
}

async function getGitHubConfig(): Promise<GitHubConfig> {
  const settings = await getSettingsMap()

  const token = normalizeString(settings['github.token']) || normalizeString(process.env.GITHUB_TOKEN)
  const repoOwner = normalizeString(settings['github.repo_owner']) || normalizeString(process.env.GITHUB_REPO_OWNER)
  const repoName = normalizeString(settings['github.repo_name']) || normalizeString(process.env.GITHUB_REPO_NAME)
  const prodMode = normalizeMode(settings['github.prod_mode'] || process.env.GITHUB_PROD_MODE)
  const defaultBranch = normalizeString(settings['github.default_branch']) || normalizeString(process.env.GITHUB_DEFAULT_BRANCH) || 'main'

  if (!token || !repoOwner || !repoName) {
    throw new Error('GitHub integration is not configured. Required: github.token, github.repo_owner, github.repo_name')
  }

  return {
    token,
    repoOwner,
    repoName,
    prodMode,
    defaultBranch,
  }
}

function getEffectiveMode(prodMode: GitHubSyncMode, requestedMode?: EffectiveGitHubSyncMode): EffectiveGitHubSyncMode {
  const isProduction = process.env.NODE_ENV === 'production'

  if (prodMode === 'pr_only') return 'pr_only'
  if (prodMode === 'direct_commit') return 'direct_commit'

  if (requestedMode) {
    if (isProduction && requestedMode === 'direct_commit') {
      return 'pr_only'
    }
    return requestedMode
  }

  return isProduction ? 'pr_only' : 'direct_commit'
}

async function githubRequest<T>(
  config: GitHubConfig,
  path: string,
  init?: RequestInit,
  allow404 = false
): Promise<T | null> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  if (allow404 && response.status === 404) {
    return null
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GitHub API request failed (${response.status}): ${text}`)
  }

  return (await response.json()) as T
}

async function getDefaultBranch(config: GitHubConfig): Promise<string> {
  const repo = await githubRequest<GitHubRepoResponse>(config, `/repos/${encodeURIComponent(config.repoOwner)}/${encodeURIComponent(config.repoName)}`)
  return repo?.default_branch || config.defaultBranch
}

async function getBranchHeadSha(config: GitHubConfig, branch: string): Promise<string> {
  const ref = await githubRequest<GitHubRefResponse>(
    config,
    `/repos/${encodeURIComponent(config.repoOwner)}/${encodeURIComponent(config.repoName)}/git/ref/heads/${encodeURIComponent(branch)}`
  )

  const sha = ref?.object?.sha
  if (!sha) {
    throw new Error(`Unable to resolve head SHA for branch: ${branch}`)
  }

  return sha
}

async function ensureBranch(config: GitHubConfig, baseBranch: string, branchName: string): Promise<void> {
  const existing = await githubRequest<GitHubRefResponse>(
    config,
    `/repos/${encodeURIComponent(config.repoOwner)}/${encodeURIComponent(config.repoName)}/git/ref/heads/${encodeURIComponent(branchName)}`,
    undefined,
    true
  )

  if (existing?.object?.sha) {
    return
  }

  const baseSha = await getBranchHeadSha(config, baseBranch)
  await githubRequest(
    config,
    `/repos/${encodeURIComponent(config.repoOwner)}/${encodeURIComponent(config.repoName)}/git/refs`,
    {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    }
  )
}

async function upsertFile(
  config: GitHubConfig,
  branch: string,
  filePath: string,
  content: string,
  commitMessage: string
): Promise<string | undefined> {
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  const existing = await githubRequest<GitHubContentResponse>(
    config,
    `/repos/${encodeURIComponent(config.repoOwner)}/${encodeURIComponent(config.repoName)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    undefined,
    true
  )

  const payload: Record<string, unknown> = {
    message: commitMessage,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  }

  if (existing?.sha) {
    payload.sha = existing.sha
  }

  const result = await githubRequest<{ content?: { sha?: string }; commit?: { sha?: string } }>(
    config,
    `/repos/${encodeURIComponent(config.repoOwner)}/${encodeURIComponent(config.repoName)}/contents/${encodedPath}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  )

  return result?.commit?.sha || result?.content?.sha
}

function normalizeFiles(input: ExecuteGitHubSyncInput): Array<{ filePath: string; content: string }> {
  if (Array.isArray(input.files) && input.files.length > 0) {
    return input.files.filter((f) => f?.filePath && typeof f.content === 'string')
  }

  if (input.filePath && typeof input.content === 'string') {
    return [{ filePath: input.filePath, content: input.content }]
  }

  return []
}

async function createPullRequest(
  config: GitHubConfig,
  baseBranch: string,
  headBranch: string,
  title: string,
  body?: string
): Promise<{ url?: string; number?: number }> {
  const pr = await githubRequest<GitHubPullResponse>(
    config,
    `/repos/${encodeURIComponent(config.repoOwner)}/${encodeURIComponent(config.repoName)}/pulls`,
    {
      method: 'POST',
      body: JSON.stringify({
        title,
        body: body || 'Automated update generated by SmartSBA AI Hub.',
        base: baseBranch,
        head: headBranch,
      }),
    }
  )

  return {
    url: pr?.html_url,
    number: pr?.number,
  }
}

export async function executeGitHubSync(input: ExecuteGitHubSyncInput): Promise<GitHubSyncResult> {
  const config = await getGitHubConfig()
  const baseBranch = await getDefaultBranch(config)
  const mode = getEffectiveMode(config.prodMode, input.requestedMode)
  const files = normalizeFiles(input)

  if (files.length === 0) {
    throw new Error('GitHub sync requires at least one file. Provide filePath+content or files[]')
  }

  if (mode === 'direct_commit') {
    let commitSha: string | undefined
    for (const file of files) {
      commitSha = await upsertFile(config, baseBranch, file.filePath, file.content, input.commitMessage)
    }

    return {
      mode,
      branch: baseBranch,
      commitSha,
      filesUpdated: files.length,
    }
  }

  const branch = input.branchName || `ai-sync/${Date.now()}`
  await ensureBranch(config, baseBranch, branch)
  let commitSha: string | undefined
  for (const file of files) {
    commitSha = await upsertFile(config, branch, file.filePath, file.content, input.commitMessage)
  }

  const pr = await createPullRequest(
    config,
    baseBranch,
    branch,
    input.pullRequestTitle || input.commitMessage,
    input.pullRequestBody
  )

  return {
    mode,
    branch,
    commitSha,
    pullRequestUrl: pr.url,
    pullRequestNumber: pr.number,
    filesUpdated: files.length,
  }
}
