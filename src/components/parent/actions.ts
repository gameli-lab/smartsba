"use server"

import { requireParent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function submitProfileUpdateRequest(
  updateType: 'name' | 'phone' | 'photo',
  newValue: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, profile } = await requireParent()

    // Map updateType to field names
    const fieldMap = {
      name: 'full_name',
      phone: 'contact_phone',
      photo: 'photo_url',
    }

    const field = fieldMap[updateType]

    // Get current phone value if needed
    let currentValue: string | null = null
    if (updateType === 'phone') {
      const { data: parentData } = await supabase
        .from('parents')
        .select('contact_phone')
        .eq('user_id', user.id)
        .maybeSingle()
      currentValue = (parentData as { contact_phone: string | null } | null)?.contact_phone || null
    }

    // Insert into profile_update_requests table
    // Note: This table may not exist yet - will need to be created
    const { error } = await supabase
      .from('profile_update_requests')
      .insert({
        user_id: user.id,
        user_type: 'parent',
        field_name: field,
        current_value: currentValue,
        requested_value: newValue,
        reason,
        status: 'pending',
      } as any) // Type assertion since table doesn't exist yet

    if (error) {
      console.error('Error submitting profile update request:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in submitProfileUpdateRequest:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
