'use server'

import { requireParent } from '@/lib/auth-guards'
import { createAdminSupabaseClient } from '@/lib/supabase'
import logAudit from '@/lib/audit'

interface MeetingRequestInput {
  wardId: string
  preferredDate?: string
  message: string
}

export async function requestMeeting(input: MeetingRequestInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, wards } = await requireParent()
    const ward = wards.find((w) => w.student.id === input.wardId)

    if (!ward) {
      return { success: false, error: 'Invalid ward selection.' }
    }

    const message = input.message?.trim()
    if (!message || message.length < 10) {
      return { success: false, error: 'Please provide a clear message (at least 10 characters).' }
    }

    const adminSupabase = createAdminSupabaseClient()
    await logAudit(
      adminSupabase,
      user.id,
      'parent_meeting_request',
      'student',
      ward.student.id,
      {
        preferredDate: input.preferredDate || null,
        message,
      }
    )

    return { success: true }
  } catch (error) {
    console.error('requestMeeting error', error)
    return { success: false, error: 'Failed to submit meeting request.' }
  }
}

export async function acknowledgeReport(scoreId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, wards } = await requireParent()
    const adminSupabase = createAdminSupabaseClient()

    const { data: scoreRow, error: scoreError } = await adminSupabase
      .from('student_scores')
      .select('id, student_id, session_id, subject_id')
      .eq('id', scoreId)
      .maybeSingle()

    if (scoreError || !scoreRow) {
      return { success: false, error: 'Report record not found.' }
    }

    const isParentWard = wards.some((w) => w.student.id === scoreRow.student_id)
    if (!isParentWard) {
      return { success: false, error: 'You are not allowed to acknowledge this report.' }
    }

    await logAudit(
      adminSupabase,
      user.id,
      'parent_report_acknowledged',
      'student_score',
      scoreId,
      {
        studentId: scoreRow.student_id,
        sessionId: scoreRow.session_id,
        subjectId: scoreRow.subject_id,
      }
    )

    return { success: true }
  } catch (error) {
    console.error('acknowledgeReport error', error)
    return { success: false, error: 'Failed to acknowledge report.' }
  }
}
