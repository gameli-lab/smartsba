import Anthropic from '@anthropic-ai/sdk'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { UserRole } from '@/types'

export type AIProvider = 'anthropic' | 'openai' | 'gemini'

type ProviderConfig = {
  enabled: boolean
  apiKey: string
  model: string
}

type AIServiceConfig = {
  preferredProvider: AIProvider
  providerOrder: AIProvider[]
  providers: Record<AIProvider, ProviderConfig>
}

export interface LLMTestCase {
  id: string
  title: string
  role: UserRole
  route: string
  objective: string
  preconditions: string[]
  steps: string[]
  expected_result: string
  priority: 'high' | 'medium' | 'low'
}

export interface LLMSecurityFinding {
  severity: 'low' | 'medium' | 'high'
  area: string
  finding: string
  suggested_fix: string
}

let anthropic: Anthropic | null = null
let cachedConfig: { loadedAt: number; config: AIServiceConfig } | null = null

const CONFIG_CACHE_TTL_MS = 60_000
const AI_SETTING_KEYS = [
  'ai.default_provider',
  'ai.anthropic_api_key',
  'ai.anthropic_model',
  'ai.openai_api_key',
  'ai.openai_model',
  'ai.gemini_api_key',
  'ai.gemini_model',
] as const

function normalizeProvider(value: unknown): AIProvider {
  if (value === 'openai' || value === 'gemini') return value
  return 'anthropic'
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function resolveSettingString(settingValue: unknown, fallbackValue: string): string {
  const dbValue = normalizeString(settingValue)
  return dbValue || fallbackValue
}

function normalizeEnabled(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  if (typeof value === 'number') return value !== 0
  return fallback
}

function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function parseLLMJson<T>(text: string): T {
  const cleaned = stripCodeFences(text)
  return JSON.parse(cleaned) as T
}

async function getSettingsMap(): Promise<Record<string, unknown>> {
  const adminClient = createAdminSupabaseClient()
  const { data, error } = await adminClient
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [...AI_SETTING_KEYS])

  if (error) {
    console.warn('Unable to load AI settings from system_settings, falling back to environment variables:', error)
    return {}
  }

  const settings: Record<string, unknown> = {}
  for (const row of data || []) {
    const record = row as { setting_key: string; setting_value: unknown }
    settings[record.setting_key] = record.setting_value
  }

  return settings
}

function buildConfig(settings: Record<string, unknown>): AIServiceConfig {
  const preferredProvider = normalizeProvider(resolveSettingString(settings['ai.default_provider'], process.env.AI_PROVIDER || 'anthropic'))

  const envAnthropicKey = normalizeString(process.env.ANTHROPIC_API_KEY)
  const envOpenAIKey = normalizeString(process.env.OPENAI_API_KEY)
  const envGeminiKey = normalizeString(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY)
  const anthropicApiKey = resolveSettingString(settings['ai.anthropic_api_key'], envAnthropicKey)
  const openaiApiKey = resolveSettingString(settings['ai.openai_api_key'], envOpenAIKey)
  const geminiApiKey = resolveSettingString(settings['ai.gemini_api_key'], envGeminiKey)

  const providers: Record<AIProvider, ProviderConfig> = {
    anthropic: {
      enabled: normalizeEnabled(anthropicApiKey, Boolean(anthropicApiKey)),
      apiKey: anthropicApiKey,
      model: resolveSettingString(settings['ai.anthropic_model'], 'claude-3-5-sonnet-20241022'),
    },
    openai: {
      enabled: normalizeEnabled(openaiApiKey, Boolean(openaiApiKey)),
      apiKey: openaiApiKey,
      model: resolveSettingString(settings['ai.openai_model'], 'gpt-4o-mini'),
    },
    gemini: {
      enabled: normalizeEnabled(geminiApiKey, Boolean(geminiApiKey)),
      apiKey: geminiApiKey,
      model: resolveSettingString(settings['ai.gemini_model'], 'gemini-1.5-pro'),
    },
  }

  const providerOrder: AIProvider[] = [preferredProvider, 'anthropic', 'openai', 'gemini'].filter(
    (provider, index, self) => self.indexOf(provider) === index
  ) as AIProvider[]

  return { preferredProvider, providerOrder, providers }
}

async function getAIServiceConfig(): Promise<AIServiceConfig> {
  const now = Date.now()
  if (cachedConfig && now - cachedConfig.loadedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig.config
  }

  const settings = await getSettingsMap()
  const config = buildConfig(settings)
  cachedConfig = { loadedAt: now, config }
  return config
}

export function clearAIConfigCache(): void {
  cachedConfig = null
  anthropic = null
}

function getClient(apiKey?: string): Anthropic {
  if (!anthropic) {
    const resolvedApiKey = apiKey || process.env.ANTHROPIC_API_KEY
    if (!resolvedApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }
    anthropic = new Anthropic({ apiKey: resolvedApiKey })
  }
  return anthropic
}

async function callAnthropic(prompt: string, maxTokens: number, model: string, apiKey?: string): Promise<string> {
  const client = getClient(apiKey)
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic')
  }

  return content.text
}

async function callOpenAI(prompt: string, maxTokens: number, model: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`)
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('OpenAI returned an empty response')
  }

  return text
}

async function callGemini(prompt: string, maxTokens: number, model: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`)
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim()
  if (!text) {
    throw new Error('Gemini returned an empty response')
  }

  return text
}

async function generateWithFallback(prompt: string, maxTokens: number): Promise<string> {
  const config = await getAIServiceConfig()
  const providerErrors: Array<{ provider: AIProvider; error: unknown }> = []

  for (const provider of config.providerOrder) {
    const providerConfig = config.providers[provider]
    if (!providerConfig.enabled || !providerConfig.apiKey) {
      continue
    }

    try {
      if (provider === 'anthropic') {
        return await callAnthropic(prompt, maxTokens, providerConfig.model, providerConfig.apiKey)
      }

      if (provider === 'openai') {
        return await callOpenAI(prompt, maxTokens, providerConfig.model, providerConfig.apiKey)
      }

      return await callGemini(prompt, maxTokens, providerConfig.model, providerConfig.apiKey)
    } catch (error) {
      providerErrors.push({ provider, error })
      console.warn(`AI provider ${provider} failed, trying next configured provider`, error)
    }
  }

  const errorSummary = providerErrors.map(({ provider }) => provider).join(', ')
  throw new Error(errorSummary ? `No configured AI providers succeeded: ${errorSummary}` : 'No AI provider is configured')
}

/**
 * Generate AI-powered test cases for a feature audit
 * Uses Claude to create more sophisticated test scenarios
 */
export async function generateAITestCases(
  role: UserRole,
  features: Array<{ title: string; route: string; check: string }>
): Promise<LLMTestCase[]> {
  const featureList = features.map((f) => `- ${f.title} (${f.route}): ${f.check}`).join('\n')

  try {
    const text = await generateWithFallback(
      `You are a QA expert. Generate comprehensive test cases for a "${role}" user in an education platform. 

Features to test:
${featureList}

For each feature, create 1-2 test cases. Return ONLY valid JSON array (no markdown, no explanation) matching this structure:
[
  {
    "id": "unique-id",
    "title": "test title",
    "role": "${role}",
    "route": "/path",
    "objective": "what should work",
    "preconditions": ["precondition 1", "precondition 2"],
    "steps": ["step 1", "step 2"],
    "expected_result": "what should happen",
    "priority": "high" | "medium" | "low"
  }
]

Include edge cases, permission boundaries, and data validation scenarios. Prioritize critical workflows as "high".`,
      2048
    )

    const testCases = parseLLMJson<LLMTestCase[]>(text)

    return testCases.filter((tc) => tc && tc.id && tc.title && tc.steps?.length)
  } catch (e) {
    console.error('Failed to parse LLM test cases:', e)
    throw new Error('Failed to generate AI test cases from Claude response')
  }
}

/**
 * Generate AI-powered security findings for a role
 * Uses Claude to analyze role-specific security risks
 */
export async function generateAISecurityFindings(
  role: UserRole,
  focus?: string
): Promise<LLMSecurityFinding[]> {
  const focusClause = focus ? ` focusing on: ${focus}` : ''

  try {
    const text = await generateWithFallback(
      `You are a security expert analyzing an education platform. Identify security vulnerabilities and misconfigurations for a "${role}" user role${focusClause}.

Consider:
- Authorization/privilege escalation risks
- Data isolation and leakage vulnerabilities
- Input validation issues
- Session management risks
- API security concerns
- Role-based access control bypasses
- Data exposure vectors

Return ONLY a valid JSON array (no markdown, no explanation) of 4-5 findings:
[
  {
    "severity": "high" | "medium" | "low",
    "area": "brief category",
    "finding": "detailed vulnerability description",
    "suggested_fix": "specific remediation step"
  }
]

Focus on realistic, actionable issues specific to an education platform with multiple roles.`,
      2048
    )

    const findings = parseLLMJson<LLMSecurityFinding[]>(text)

    return findings.filter((f) => f && f.severity && f.area && f.finding && f.suggested_fix)
  } catch (e) {
    console.error('Failed to parse LLM security findings:', e)
    throw new Error('Failed to generate AI security findings from Claude response')
  }
}

/**
 * Generate AI-powered next steps for an AI command
 * Uses Claude to provide contextual guidance
 */
export async function generateAINextSteps(
  task: string,
  role: UserRole,
  targetRole?: UserRole,
  findings?: number,
  testCases?: number
): Promise<string[]> {
  const context = [
    `Task: ${task}`,
    `Actor role: ${role}`,
    targetRole ? `Target role: ${targetRole}` : null,
    findings ? `Findings generated: ${findings}` : null,
    testCases ? `Test cases generated: ${testCases}` : null,
  ]
    .filter(Boolean)
    .join('\n')


  try {
    const text = await generateWithFallback(
      `Based on this AI governance audit context, provide 3-4 concrete, actionable next steps:

${context}

Return ONLY a JSON array of strings (no markdown, no explanation):
["step 1", "step 2", "step 3", "step 4"]

Steps should be specific, prioritized, and immediately actionable.`,
      1024
    )

    const steps = parseLLMJson<string[]>(text)

    return steps.filter((s) => typeof s === 'string' && s.length > 0).slice(0, 5)
  } catch (e) {
    console.error('Failed to parse LLM next steps:', e)
    return ['Execute high-priority tests first', 'Document findings in audit logs', 'Implement recommended fixes']
  }
}

/**
 * Generate AI-powered test case refinement
 * Uses Claude to improve existing test cases
 */
export async function refineTestCases(testCases: LLMTestCase[], feedback?: string): Promise<LLMTestCase[]> {
  if (!testCases.length) return testCases

  const casesList = testCases.map((tc) => `- ${tc.title}: ${tc.objective}`).join('\n')
  const feedbackClause = feedback ? ` considering: ${feedback}` : ''

  try {
    const text = await generateWithFallback(
      `You are a QA expert. Improve these test cases for better coverage and clarity${feedbackClause}:

${casesList}

Return ONLY valid JSON array with same structure but improved steps and edge cases:
[
  {
    "id": "id",
    "title": "title",
    "role": "role",
    "route": "route",
    "objective": "objective",
    "preconditions": ["preconditions"],
    "steps": ["improved steps"],
    "expected_result": "result",
    "priority": "priority"
  }
]

Enhance test steps to be more detailed and include edge cases.`,
      2048
    )

    const refined = parseLLMJson<LLMTestCase[]>(text)

    return refined.filter((tc) => tc && tc.id && tc.title)
  } catch (e) {
    console.error('Failed to parse refined test cases:', e)
    return testCases
  }
}

/**
 * Check if Claude API is available and working
 */
export async function checkClaudeAvailability(): Promise<boolean> {
  try {
    const config = await getAIServiceConfig()
    for (const provider of config.providerOrder) {
      const providerConfig = config.providers[provider]
      if (!providerConfig.enabled || !providerConfig.apiKey) {
        continue
      }

      try {
        if (provider === 'anthropic') {
          await callAnthropic('ping', 10, providerConfig.model, providerConfig.apiKey)
          return true
        }

        if (provider === 'openai') {
          await callOpenAI('ping', 10, providerConfig.model, providerConfig.apiKey)
          return true
        }

        await callGemini('ping', 10, providerConfig.model, providerConfig.apiKey)
        return true
      } catch (error) {
        console.warn(`AI availability check failed for ${provider}`, error)
      }
    }

    return false
  } catch (e) {
    console.error('Claude availability check failed:', e)
    return false
  }
}
