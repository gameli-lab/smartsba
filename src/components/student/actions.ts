"use server"

import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/auth'

interface ProfileUpdateRequest {
  studentId: string
  requestType: 'name' | 'photo'
  requestedValue: string
  reason: string
}

export async function submitProfileUpdateRequest(request: ProfileUpdateRequest) {
  try {
    // Verify user is authenticated and is a student
    const currentUser = await AuthService.getCurrentUser()
    if (!currentUser || currentUser.profile.role !== 'student') {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify the request is for the current user's student profile
    const { data: studentData } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('id', request.studentId)
      .single()

    if (!studentData || (studentData as { user_id: string }).user_id !== currentUser.user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // TODO: Store request in profile_update_requests table
    // This table should have:
    // - id, student_id, request_type, current_value, requested_value, reason, status, created_at, reviewed_by, reviewed_at
    // For now, we'll log this and return success
    // In production, you would:
    // await supabase.from('profile_update_requests').insert({
    //   student_id: request.studentId,
    //   request_type: request.requestType,
    //   requested_value: request.requestedValue,
    //   reason: request.reason,
    //   status: 'pending',
    // })

    console.log('Profile update request:', {
      studentId: request.studentId,
      type: request.requestType,
      value: request.requestedValue,
      reason: request.reason,
    })

    return { success: true }
  } catch (error) {
    console.error('Error submitting profile update request:', error)
    return { success: false, error: 'Failed to submit request' }
  }
}
