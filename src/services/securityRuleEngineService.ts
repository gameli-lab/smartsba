import { createAdminSupabaseClient } from '@/lib/supabase'
import { generateSuperAdminResponse } from '@/services/aiLLMService'
import { createHash } from 'crypto'

type Severity = 'low' | 'medium' | 'high'

export interface SecurityRuleFinding {
  id: string
  severity: Severity
  area: string
  finding: string
  suggested_fix: string
  rule_id: string
  evidence?: string
}

interface RunRuleChecksInput {
  content: string
  target?: string
  includeAIAdvisory?: boolean
}

interface RunRuleChecksResult {
  findings: SecurityRuleFinding[]
  summary: {
    total: number
    high: number
    medium: number
    low: number
  }
  aiAdvisory?: string
}

interface RuleDefinition {
  id: string
  severity: Severity
  area: string
  pattern: RegExp
  finding: string
  suggested_fix: string
}

const RULES: RuleDefinition[] = [
  {
    id: 'hardcoded-secret-pattern',
    severity: 'high',
    area: 'Secrets Management',
    pattern: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    finding: 'Possible hardcoded secret detected in source text.',
    suggested_fix: 'Move secrets to environment variables or secure settings storage and rotate exposed credentials.',
  },
  {
    id: 'unsafe-eval-usage',
    severity: 'high',
    area: 'Code Execution',
    pattern: /\beval\s*\(/gi,
    finding: 'Use of eval() detected, which can introduce remote code execution risks.',
    suggested_fix: 'Remove eval and replace with safe parsing or explicit control flow.',
  },
  {
    id: 'missing-auth-guard-clue',
    severity: 'medium',
    area: 'Authorization',
    pattern: /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)[\s\S]{0,800}$/gim,
    finding: 'API handler found; verify explicit authentication and role checks exist.',
    suggested_fix: 'Enforce authentication and role guard in all privileged endpoints.',
  },
  {
    id: 'broad-cors-allow-all',
    severity: 'medium',
    area: 'CORS Policy',
    pattern: /access-control-allow-origin\s*[:=]\s*['"]\*['"]/gi,
    finding: 'Wildcard CORS origin detected.',
    suggested_fix: 'Restrict CORS origins to known trusted domains.',
  },
  {
    id: 'dangerous-sql-delete',
    severity: 'high',
    area: 'Data Safety',
    pattern: /delete\s+from\s+\w+\s*;?/gi,
    finding: 'Potentially broad SQL delete statement detected.',
    suggested_fix: 'Use scoped DELETE statements with WHERE clauses and role checks.',
  },
  {
    id: 'service-role-in-client-clue',
    severity: 'high',
    area: 'Privilege Boundary',
    pattern: /['"]use client['"][\s\S]{0,1000}(service[_-]?role|createAdminSupabaseClient)/gi,
    finding: 'Potential service-role usage detected in client context.',
    suggested_fix: 'Move privileged operations to server actions or API routes.',
  },
]

function isRuleEngineEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return true
}

async function loadRuleEngineEnabled(): Promise<boolean> {
  const adminClient = createAdminSupabaseClient()
  const { data } = await adminClient
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'security.rule_engine_enabled')
    .single()

  const row = data as { setting_value?: unknown } | null
  return isRuleEngineEnabled(row?.setting_value)
}

function runRules(content: string): SecurityRuleFinding[] {
  const findings: SecurityRuleFinding[] = []

  for (const rule of RULES) {
    const match = content.match(rule.pattern)
    if (!match || match.length === 0) {
      continue
    }

    findings.push({
      id: `${rule.id}-${findings.length + 1}`,
      severity: rule.severity,
      area: rule.area,
      finding: rule.finding,
      suggested_fix: rule.suggested_fix,
      rule_id: rule.id,
      evidence: match[0]?.slice(0, 180),
    })
  }

  return findings
}

function summarizeFindings(findings: SecurityRuleFinding[]) {
  return {
    total: findings.length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  }
}

export async function runSecurityRuleChecks(input: RunRuleChecksInput): Promise<RunRuleChecksResult> {
  const enabled = await loadRuleEngineEnabled()
  if (!enabled) {
    return {
      findings: [],
      summary: {
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      aiAdvisory: 'Security rule engine is disabled in settings (security.rule_engine_enabled=false).',
    }
  }

  const findings = runRules(input.content)
  const summary = summarizeFindings(findings)

  let aiAdvisory: string | undefined
  if (input.includeAIAdvisory !== false) {
    const compactFindings = findings
      .map((f) => `- [${f.severity.toUpperCase()}] ${f.area}: ${f.finding}`)
      .join('\n')

    try {
      aiAdvisory = await generateSuperAdminResponse(
        `You are reviewing security findings for target: ${input.target || 'unknown target'}\n\nRule-based findings:\n${compactFindings || '- No rule-based findings'}\n\nProvide a short remediation plan (prioritized, 5 bullets max).`,
        700,
        'cyber'
      )
    } catch {
      aiAdvisory = 'AI advisory unavailable. Rule-based findings are still valid.'
    }
  }

  return {
    findings,
    summary,
    aiAdvisory,
  }
}

export async function persistSecurityRuleCheckRun(
  actorUserId: string,
  input: RunRuleChecksInput,
  result: RunRuleChecksResult
): Promise<string> {
  const adminClient = createAdminSupabaseClient()
  const contentHash = createHash('sha256').update(input.content).digest('hex')

  const { data, error } = await adminClient
    .from('security_rule_check_runs')
    .insert({
      actor_user_id: actorUserId,
      target: input.target || null,
      content_hash: contentHash,
      findings: result.findings,
      summary: result.summary,
      ai_advisory: result.aiAdvisory || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to persist security rule check run')
  }

  return (data as { id: string }).id
}
