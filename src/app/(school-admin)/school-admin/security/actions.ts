'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'

export async function setUserStatus(userProfileId: string, status: 'active' | 'disabled') {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!userProfileId) return { success: false, error: 'User id is required' }

    const { data: target, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, school_id')
      .eq('id', userProfileId)
      .single()

    if (fetchError || !target || target.school_id !== schoolId) {
      return { success: false, error: 'User not found' }
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ status })
      .eq('id', userProfileId)

    if (updateError) {
      return { success: false, error: 'Failed to update status' }
    }

    revalidatePath('/school-admin/security')
    return { success: true }
  } catch (error) {
    console.error('setUserStatus error:', error)
    return { success: false, error: 'Unexpected error' }
  }
}

export async function resetUserPassword() {
  // TODO: Implement password reset via service-role admin API or email flow.
  return { success: false, error: 'Password reset not available in this environment (TODO).' }
}

export async function fetchLoginActivity(userIds: string[]) {
  // Basic placeholder: relies on audit_logs actor_user_id if available
  if (!userIds.length) return []

  const { data } = await supabase
    .from('audit_logs')
    .select('id, actor_user_id, action, created_at')
    .in('actor_user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data as { id: string; actor_user_id: string; action: string; created_at: string }[] | null) || []
}
