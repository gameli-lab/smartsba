import 'server-only'

import { createAdminSupabaseClient } from '@/lib/supabase'

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'account_locked'
  | 'password_reset_requested'
  | 'password_reset_approved'
  | 'password_reset_completed'
  | 'bulk_export'
  | 'mfa_challenge'
  | 'mfa_verified'

export type SecurityEventMetadata = Record<string, unknown>

function estimateRiskScore(eventType: SecurityEventType, metadata: SecurityEventMetadata = {}): number {
  switch (eventType) {
    case 'login_failure':
      return 80
    case 'account_locked':
      return 90
    case 'password_reset_requested':
      return 35
    case 'password_reset_approved':
      return 45
    case 'password_reset_completed':
      return 20
    case 'bulk_export': {
      const recordCount = typeof metadata.record_count === 'number' ? metadata.record_count : 0
      return Math.min(95, 20 + Math.floor(recordCount / 10))
    }
    case 'mfa_challenge':
      return 25
    case 'mfa_verified':
      return 10
    case 'login_success':
    default:
      return 5
  }
}

export async function recordSecurityEvent(input: {
  actorUserId?: string | null
  actorRole?: string | null
  schoolId?: string | null
  identifier?: string | null
  eventType: SecurityEventType
  metadata?: SecurityEventMetadata
}): Promise<void> {
  try {
    const supabaseAdmin = createAdminSupabaseClient()
    const metadata = {
      ...(input.metadata || {}),
      risk_score: estimateRiskScore(input.eventType, input.metadata || {}),
      security_event_type: input.eventType,
    }

    await supabaseAdmin.from('security_events').insert({
      actor_user_id: input.actorUserId ?? null,
      actor_role: input.actorRole ?? null,
      school_id: input.schoolId ?? null,
      identifier: input.identifier ?? null,
      event_type: input.eventType,
      risk_score: metadata.risk_score,
      metadata,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to record security event:', error)
  }
}