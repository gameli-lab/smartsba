'use server'

import { requireSchoolAdmin } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'

/**
 * Refresh JWT claims for the current user
 * This should be called if storage operations are failing due to missing JWT claims
 */
export async function refreshUserClaims() {
  try {
    await requireSchoolAdmin()

    // Call the database function to refresh claims
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('refresh_user_claims')

    if (error) {
      console.error('Failed to refresh user claims:', error)
      return { success: false, error: 'Failed to refresh claims' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error refreshing claims:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
