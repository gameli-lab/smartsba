'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'

function normalizeNumber(raw: FormDataEntryValue | null): number | undefined {
  if (raw === null) return undefined
  const str = String(raw).trim()
  if (!str) return undefined
  const value = Number(str)
  if (Number.isNaN(value)) return undefined
  return value
}

export async function saveAttendance(formData: FormData) {
  const { profile, assignments } = await requireTeacher()

  const classId = formData.get('classId') as string | null
  const sessionId = formData.get('sessionId') as string | null

  if (!classId || !sessionId) {
    return { success: false, error: 'Class and session are required.' }
  }

  const canAccessClass = assignments.some((a) => a.class_id === classId)
  if (!canAccessClass) {
    return { success: false, error: 'You are not assigned to this class.' }
  }

  const { data: sessionRowData } = await supabase
    .from('academic_sessions')
    .select('id, school_id')
    .eq('id', sessionId)
    .maybeSingle()

  const sessionRow = sessionRowData as { id: string; school_id: string } | null
  if (!sessionRow || sessionRow.school_id !== profile.school_id) {
    return { success: false, error: 'Session not found.' }
  }

  const { data: studentRows } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('school_id', profile.school_id)

  const validStudentIds = new Set((studentRows || []).map((s: { id: string }) => s.id))

  const payload: Array<{
    student_id: string
    session_id: string
    present_days: number
    total_days: number
    percentage: number
    entered_by: string
    updated_at: string
  }> = []

  validStudentIds.forEach((studentId) => {
    const presentRaw = normalizeNumber(formData.get(`present_${studentId}`))
    const totalRaw = normalizeNumber(formData.get(`total_${studentId}`))

    if (presentRaw === undefined && totalRaw === undefined) return

    const totalDays = Math.max(0, Math.floor(totalRaw || 0))
    const presentDays = Math.max(0, Math.floor(presentRaw || 0))
    const clampedPresent = Math.min(presentDays, totalDays)

    if (totalDays <= 0) return

    const percentage = Number(((clampedPresent / totalDays) * 100).toFixed(2))

    payload.push({
      student_id: studentId,
      session_id: sessionId,
      present_days: clampedPresent,
      total_days: totalDays,
      percentage,
      entered_by: profile.user_id,
      updated_at: new Date().toISOString(),
    })
  })

  if (payload.length === 0) {
    return { success: false, error: 'No attendance values to save.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('attendance')
    .upsert(payload, { onConflict: 'student_id,session_id' })

  if (error) {
    console.error('Error saving attendance', error)
    return { success: false, error: 'Failed to save attendance.' }
  }

  revalidatePath('/teacher/attendance')
  revalidatePath('/teacher')
  return { success: true }
}
