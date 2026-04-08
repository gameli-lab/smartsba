'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { PromotionStatus } from '@/types'

interface PromotionInput {
  student_id: string
  session_id: string
  promotion_status: PromotionStatus
  remark?: string
  next_class_id?: string
}

interface BulkPromotionInput {
  class_id: string
  current_session_id: string
  next_session_id?: string
  next_class_id: string
  student_ids: string[]
  remark?: string
}

async function ensureEntityBelongsToSchool<T extends { school_id: string }>(
  entity: T | null,
  schoolId: string,
  notFoundMsg: string
) {
  if (!entity || entity.school_id !== schoolId) {
    return { error: notFoundMsg }
  }
  return null
}

export async function setStudentPromotion(input: PromotionInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.student_id || !input.session_id || !input.promotion_status) {
      return { success: false, error: 'Student, session, and promotion status are required' }
    }

    // Verify student
    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id, user_id')
      .eq('id', input.student_id)
      .single()

    const student = studentRow as { id: string; school_id: string; user_id?: string } | null
    const studentCheck = await ensureEntityBelongsToSchool(student, schoolId, 'Student not found')
    if (studentCheck) return { success: false, error: studentCheck.error }

    // Verify session
    const { data: sessionRow } = await supabase
      .from('academic_sessions')
      .select('id, school_id')
      .eq('id', input.session_id)
      .single()

    const session = sessionRow as { id: string; school_id: string; term?: number } | null
    const sessionCheck = await ensureEntityBelongsToSchool(session, schoolId, 'Session not found')
    if (sessionCheck) return { success: false, error: sessionCheck.error }

    if (session?.term !== 3) {
      return { success: false, error: 'Promotion decisions are only allowed in Term 3.' }
    }

    // Verify next class if provided
    if (input.next_class_id) {
      const { data: nextClassRow } = await supabase
        .from('classes')
        .select('id, school_id')
        .eq('id', input.next_class_id)
        .single()

      const nextClass = nextClassRow as { id: string; school_id: string } | null
      const classCheck = await ensureEntityBelongsToSchool(
        nextClass,
        schoolId,
        'Next class not found'
      )
      if (classCheck) return { success: false, error: classCheck.error }
    }

    // Check for existing remark
    const { data: existing } = await supabase
      .from('class_teacher_remarks')
      .select('id')
      .eq('student_id', input.student_id)
      .eq('session_id', input.session_id)
      .maybeSingle()

    if (existing) {
      // Update existing remark
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('class_teacher_remarks')
        .update({
          promotion_status: input.promotion_status,
          remark: input.remark || null,
          next_class_id: input.next_class_id || null,
          entered_by: profile.user_id,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', input.student_id)
        .eq('session_id', input.session_id)

      if (error) {
        console.error('Error updating remark:', error)
        return { success: false, error: 'Failed to update promotion status' }
      }
    } else {
      // Create new remark
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('class_teacher_remarks')
        .insert({
          student_id: input.student_id,
          session_id: input.session_id,
          promotion_status: input.promotion_status,
          remark: input.remark || null,
          next_class_id: input.next_class_id || null,
          entered_by: profile.user_id,
        })

      if (error) {
        console.error('Error creating remark:', error)
        return { success: false, error: 'Failed to set promotion status' }
      }
    }

    if (input.promotion_status === 'withdrawn') {
      // Also deactivate the student record when withdrawn to reflect archive status
      const { error: studentError } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', input.student_id)

      if (student?.user_id) {
        await supabase
          .from('user_profiles')
          .update({ status: 'disabled' })
          .eq('user_id', student.user_id)
      }

      if (studentError) {
        console.error('Error deactivating withdrawn student:', studentError)
      }
    }

    revalidatePath('/school-admin/grading-promotion')
    return { success: true }
  } catch (error) {
    console.error('Error in setStudentPromotion:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function bulkPromoteStudents(input: BulkPromotionInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.class_id || !input.current_session_id || !input.next_class_id || input.student_ids.length === 0) {
      return { success: false, error: 'All fields and at least one student are required' }
    }

    // Verify class
    const { data: classRow } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', input.class_id)
      .single()

    const klass = classRow as { id: string; school_id: string } | null
    const classCheck = await ensureEntityBelongsToSchool(klass, schoolId, 'Current class not found')
    if (classCheck) return { success: false, error: classCheck.error }

    // Verify current session
    const { data: currSessionRow } = await supabase
      .from('academic_sessions')
      .select('id, school_id')
      .eq('id', input.current_session_id)
      .single()

    const currSession = currSessionRow as { id: string; school_id: string; term?: number } | null
    const currSessionCheck = await ensureEntityBelongsToSchool(
      currSession,
      schoolId,
      'Current session not found'
    )
    if (currSessionCheck) return { success: false, error: currSessionCheck.error }

    if (currSession?.term !== 3) {
      return { success: false, error: 'Bulk promotion is only allowed in Term 3.' }
    }

    // Verify next class
    const { data: nextClassRow } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', input.next_class_id)
      .single()

    const nextClass = nextClassRow as { id: string; school_id: string } | null
    const nextClassCheck = await ensureEntityBelongsToSchool(
      nextClass,
      schoolId,
      'Next class not found'
    )
    if (nextClassCheck) return { success: false, error: nextClassCheck.error }

    // Verify all students belong to school
    const { data: studentsCheck } = await supabase
      .from('students')
      .select('id, school_id')
      .in('id', input.student_ids)
      .eq('school_id', schoolId)

    if ((studentsCheck || []).length !== input.student_ids.length) {
      return { success: false, error: 'Some students not found or do not belong to your school' }
    }

    let successCount = 0
    let errorCount = 0

    // Process each student
    for (const studentId of input.student_ids) {
      // Check for existing remark
      const { data: existing } = await supabase
        .from('class_teacher_remarks')
        .select('id')
        .eq('student_id', studentId)
        .eq('session_id', input.current_session_id)
        .maybeSingle()

      if (existing) {
        // Update existing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('class_teacher_remarks')
          .update({
            promotion_status: 'promoted',
            remark: input.remark || null,
            next_class_id: input.next_class_id,
            entered_by: profile.user_id,
            updated_at: new Date().toISOString(),
          })
          .eq('student_id', studentId)
          .eq('session_id', input.current_session_id)

        if (!error) successCount++
        else errorCount++
      } else {
        // Create new
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('class_teacher_remarks')
          .insert({
            student_id: studentId,
            session_id: input.current_session_id,
            promotion_status: 'promoted',
            remark: input.remark || null,
            next_class_id: input.next_class_id,
            entered_by: profile.user_id,
          })

        if (!error) successCount++
        else errorCount++
      }
    }

    if (successCount > 0) {
      revalidatePath('/school-admin/grading-promotion')
    }

    return {
      success: errorCount === 0,
      result: { promoted: successCount, failed: errorCount },
    }
  } catch (error) {
    console.error('Error in bulkPromoteStudents:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getClassPromotionData(classId: string, sessionId: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    type ClassRow = { id: string; name: string; level: number; stream: string | null; school_id: string }
    type SessionRow = { id: string; academic_year: string; term: number; school_id: string }
    type StudentScoreRow = {
      id: string
      admission_number: string
      roll_number: string | null
      class_id: string
      is_active: boolean
      user_profile: { id: string; full_name: string; email: string }
      session_scores: Array<{ id: string; total_score: number | null; grade?: string | null; subject_id: string }>
    }
    type RemarkRow = {
      id: string
      student_id: string
      promotion_status: PromotionStatus | null
      remark: string | null
      next_class_id: string | null
    }
    type NextClassRow = { id: string; name: string; level: number; stream: string | null }

    // Verify class
    const { data: classRow } = await supabase
      .from('classes')
      .select('id, name, level, stream, school_id')
      .eq('id', classId)
      .single()

    const typedClass = classRow as ClassRow | null
    if (!typedClass || typedClass.school_id !== schoolId) {
      return { success: false, error: 'Class not found' }
    }

    // Verify session
    const { data: sessionRow } = await supabase
      .from('academic_sessions')
      .select('id, academic_year, term, school_id')
      .eq('id', sessionId)
      .single()

    const typedSession = sessionRow as SessionRow | null
    if (!typedSession || typedSession.school_id !== schoolId) {
      return { success: false, error: 'Session not found' }
    }

    if (typedSession.term !== 3) {
      return { success: false, error: 'Promotion data is only available for Term 3.' }
    }

    // Fetch all students in class with their scores
    const { data: studentsData } = await supabase
      .from('students')
      .select(
        `
        id, admission_number, roll_number, class_id, is_active,
        user_profile:user_profiles!inner(id, full_name, email),
        scores!inner(id, total_score, grade, subject_id) AS session_scores
      `
      )
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .eq('session_scores.session_id', sessionId)

    // Fetch promotion remarks for this session
    const { data: remarksData } = await supabase
      .from('class_teacher_remarks')
      .select('id, student_id, promotion_status, remark, next_class_id')
      .eq('session_id', sessionId)
      .in('student_id', (studentsData || []).map((s: StudentScoreRow) => s.id))

    const remarksMap = new Map<string, RemarkRow>()
    ;((remarksData || []) as RemarkRow[]).forEach((r) => remarksMap.set(r.student_id, r))

    // Get next level classes
    const { data: nextClasses } = await supabase
      .from('classes')
      .select('id, name, level, stream')
      .eq('school_id', schoolId)
      .gt('level', typedClass.level)
      .order('level', { ascending: true })

    // Sort by total score descending
    const sortedStudents = ((studentsData || []) as StudentScoreRow[])
      .map((s) => {
        const totalScore = s.session_scores.reduce((sum, sc) => sum + (sc.total_score || 0), 0)
        const avgScore = s.session_scores.length > 0 ? totalScore / s.session_scores.length : 0
        const remark = remarksMap.get(s.id)

        return {
          id: s.id,
          full_name: s.user_profile.full_name,
          admission_number: s.admission_number,
          roll_number: s.roll_number,
          total_score: totalScore,
          avg_score: avgScore,
          subject_count: s.session_scores.length,
          promotion_status: remark?.promotion_status || null,
          promotion_remark: remark?.remark || null,
          next_class_id: remark?.next_class_id || null,
          is_active: s.is_active,
        }
      })
      .sort((a, b) => b.total_score - a.total_score)
      .map((s, idx) => ({ ...s, rank: idx + 1 }))

    return {
      success: true,
      data: {
        class: typedClass,
        session: typedSession,
        students: sortedStudents,
        nextClasses: (nextClasses || []) as NextClassRow[],
        totalStudents: sortedStudents.length,
        promotedCount: sortedStudents.filter((s) => s.promotion_status === 'promoted').length,
      },
    }
  } catch (error) {
    console.error('Error in getClassPromotionData:', error)
    return { success: false, error: 'Failed to fetch promotion data' }
  }
}
