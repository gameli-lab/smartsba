import type { SupabaseClient } from '@supabase/supabase-js'
import { getAssumeRoleContextForActor } from './assume-role'

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

export async function logAssumptionAwareAudit(
  supabaseAdmin: SupabaseClient,
  actorUserId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: AuditMetadata
): Promise<void> {
  try {
    const assumeContext = await getAssumeRoleContextForActor(actorUserId)
    if (!assumeContext) return

    await logAudit(supabaseAdmin, actorUserId, action, targetType, targetId, {
      ...(metadata || {}),
      assumption: {
        actor_user_id: actorUserId,
        assumed_user_id: assumeContext.assumedUserId,
        assumed_role: assumeContext.assumedRole,
        issued_at: assumeContext.issuedAt,
        expires_at: assumeContext.expiresAt,
      },
    })
  } catch (err) {
    console.error('Failed to write assumption-aware audit log:', err)
  }
}

export default logAudit;
