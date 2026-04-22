'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'

function normalizeScore(raw: FormDataEntryValue | null, max: number): number | undefined {
  if (raw === null) return undefined
  const num = Number(raw)
  if (Number.isNaN(num)) return undefined
  const clamped = Math.max(0, Math.min(max, num))
  return clamped
}

function calculateGrade(total: number): string | undefined {
  if (Number.isNaN(total)) return undefined
  if (total >= 90) return 'A'
  if (total >= 80) return 'B'
  if (total >= 70) return 'C'
  if (total >= 60) return 'D'
  if (total >= 50) return 'E'
  return 'F'
}

export async function saveScores(formData: FormData) {
  const { profile, assignments } = await requireTeacher()

  const classId = formData.get('classId') as string | null
  const subjectId = formData.get('subjectId') as string | null
  const sessionId = formData.get('sessionId') as string | null

  if (!classId || !subjectId || !sessionId) {
    return { success: false, error: 'Class, subject, and session are required.' }
  }

  const isAssigned = assignments.some((a) => a.class_id === classId && a.subject_id === subjectId)
  if (!isAssigned) {
    return { success: false, error: 'You are not assigned to this subject for the selected class.' }
  }

  const { data: subjectRowData } = await supabase
    .from('subjects')
    .select('id, class_id, school_id')
    .eq('id', subjectId)
    .maybeSingle()

  const subjectRow = subjectRowData as { id: string; class_id: string; school_id: string } | null

  if (!subjectRow || subjectRow.class_id !== classId || subjectRow.school_id !== profile.school_id) {
    return { success: false, error: 'Subject not found for this class.' }
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
    .select('id, class_id, school_id')
    .eq('class_id', classId)
    .eq('school_id', profile.school_id)

  const studentIds = new Set((studentRows || []).map((s: { id: string }) => s.id))

  const payload: Array<{ student_id: string; subject_id: string; session_id: string; ca_score?: number; exam_score?: number; total_score?: number; grade?: string; entered_by: string; updated_at: string }> = []

  studentIds.forEach((studentId) => {
    const ca = normalizeScore(formData.get(`ca_${studentId}`), 40)
    const exam = normalizeScore(formData.get(`exam_${studentId}`), 60)
    if (ca === undefined && exam === undefined) {
      return
    }
    const total = (ca || 0) + (exam || 0)
    payload.push({
      student_id: studentId,
      subject_id: subjectId,
      session_id: sessionId,
      ca_score: ca,
      exam_score: exam,
      total_score: total,
      grade: calculateGrade(total),
      entered_by: profile.user_id,
      updated_at: new Date().toISOString(),
    })
  })

  if (payload.length === 0) {
    return { success: false, error: 'No scores to save.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('scores')
    .upsert(payload, { onConflict: 'student_id,subject_id,session_id' })

  if (error) {
    console.error('Error saving scores', error)
    return { success: false, error: 'Failed to save scores.' }
  }

  revalidatePath('/teacher/assessments')
  return { success: true }
}
