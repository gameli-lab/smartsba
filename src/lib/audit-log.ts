import type { SupabaseClient } from '@supabase/supabase-js'

type AuditInput = {
  actorUserId: string
  actorRole: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent'
  actionType: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}

export async function writeAuditLog(supabaseAdmin: SupabaseClient, input: AuditInput): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('audit_logs')
      .insert({
        actor_user_id: input.actorUserId,
        actor_role: input.actorRole,
        action_type: input.actionType,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? {},
      })
  } catch (error) {
    console.error('Failed to write audit log entry:', error)
  }
}
