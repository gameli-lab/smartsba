import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditMetadata = Record<string, unknown>

export async function logAudit(
  supabaseAdmin: SupabaseClient,
  actorUserId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: AuditMetadata
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: actorUserId,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Do not throw — auditing failures shouldn't block main flows
    console.error('Failed to write audit log:', err);
  }
}

export default logAudit;
