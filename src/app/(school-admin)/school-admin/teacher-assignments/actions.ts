'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'

interface CreateAssignmentInput {
  class_id: string
  subject_id: string
  teacher_id: string
  academic_year?: string
}

interface UpdateAssignmentInput {
  id: string
  teacher_id?: string
  academic_year?: string
}

function currentAcademicYear() {
  const now = new Date()
  const year = now.getFullYear()
  return `${year}-${year + 1}`
}

async function ensureSameSchool<T extends { school_id: string }>(entity: T | null, schoolId: string, notFoundMessage: string) {
  if (!entity || entity.school_id !== schoolId) {
    return { error: notFoundMessage }
  }
  return null
}

export async function createAssignment(input: CreateAssignmentInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = createAdminSupabaseClient()

    if (!input.class_id || !input.subject_id || !input.teacher_id) {
      return { success: false, error: 'Class, subject, and teacher are required' }
    }

    // Verify class
    const { data: klass } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', input.class_id)
      .single()

    const classCheck = await ensureSameSchool(klass, schoolId, 'Class not found')
    if (classCheck) return { success: false, error: classCheck.error }

    // Verify subject
    const { data: subject } = await supabase
      .from('subjects')
      .select('id, school_id')
      .eq('id', input.subject_id)
      .single()

    const subjectCheck = await ensureSameSchool(subject, schoolId, 'Subject not found')
    if (subjectCheck) return { success: false, error: subjectCheck.error }

    // Verify teacher
    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('id, school_id, is_active')
      .eq('id', input.teacher_id)
      .single()

    const teacher = teacherRow as { id: string; school_id: string; is_active: boolean } | null

    const teacherCheck = await ensureSameSchool(teacher, schoolId, 'Teacher not found')
    if (teacherCheck) return { success: false, error: teacherCheck.error }

    if (!teacher?.is_active) {
      return { success: false, error: 'Teacher must be active to assign' }
    }

    // Prevent duplicate assignment for class + subject
    const { data: existing } = await supabase
      .from('teacher_assignments')
      .select('id')
      .eq('class_id', input.class_id)
      .eq('subject_id', input.subject_id)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'This class already has a teacher for the selected subject' }
    }

    const academicYear = input.academic_year || currentAcademicYear()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('teacher_assignments')
      .insert({
        class_id: input.class_id,
        subject_id: input.subject_id,
        teacher_id: input.teacher_id,
        is_class_teacher: false,
        academic_year: academicYear,
      })

    if (error) {
      console.error('Error creating assignment:', error)
      return { success: false, error: 'Failed to create assignment' }
    }

    try {
      revalidatePath('/school-admin/teacher-assignments')
    } catch (e) {
      console.error('Revalidation error:', e)
    }
    return { success: true }
  } catch (error) {
    console.error('Error in createAssignment:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateAssignment(input: UpdateAssignmentInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = createAdminSupabaseClient()

    if (!input.id) return { success: false, error: 'Assignment ID is required' }

    // Fetch assignment with relations to verify ownership
    const { data: assignmentRow } = await supabase
      .from('teacher_assignments')
      .select('id, class_id, subject_id, teacher_id')
      .eq('id', input.id)
      .single()

    const assignment = assignmentRow as { id: string; class_id: string; subject_id: string; teacher_id: string } | null

    if (!assignment) return { success: false, error: 'Assignment not found' }

    // Verify class belongs to school
    const { data: klass } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', assignment.class_id)
      .single()

    const classCheck = await ensureSameSchool(klass, schoolId, 'Class not found')
    if (classCheck) return { success: false, error: classCheck.error }

    // If changing teacher, verify teacher
    if (input.teacher_id) {
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('id, school_id, is_active')
        .eq('id', input.teacher_id)
        .single()

      const teacher = teacherRow as { id: string; school_id: string; is_active: boolean } | null

      const teacherCheck = await ensureSameSchool(teacher, schoolId, 'Teacher not found')
      if (teacherCheck) return { success: false, error: teacherCheck.error }
      if (!teacher?.is_active) return { success: false, error: 'Teacher must be active to assign' }
    }

    const academicYear = input.academic_year || currentAcademicYear()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('teacher_assignments')
      .update({
        ...(input.teacher_id && { teacher_id: input.teacher_id }),
        academic_year: academicYear,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)

    if (error) {
      console.error('Error updating assignment:', error)
      return { success: false, error: 'Failed to update assignment' }
    }

    try {
      revalidatePath('/school-admin/teacher-assignments')
    } catch (e) {
      console.error('Revalidation error:', e)
    }
    return { success: true }
  } catch (error) {
    console.error('Error in updateAssignment:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function deleteAssignment(id: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = createAdminSupabaseClient()

    if (!id) return { success: false, error: 'Assignment ID is required' }

    // Fetch assignment and verify class ownership
    const { data: assignmentRow } = await supabase
      .from('teacher_assignments')
      .select('id, class_id')
      .eq('id', id)
      .single()

    const assignment = assignmentRow as { id: string; class_id: string } | null

    if (!assignment) return { success: false, error: 'Assignment not found' }

    const { data: klass } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', assignment.class_id)
      .single()

    const classCheck = await ensureSameSchool(klass, schoolId, 'Class not found')
    if (classCheck) return { success: false, error: classCheck.error }

    const { error } = await supabase
      .from('teacher_assignments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting assignment:', error)
      return { success: false, error: 'Failed to delete assignment' }
    }

    try {
      revalidatePath('/school-admin/teacher-assignments')
    } catch (e) {
      console.error('Revalidation error:', e)
    }
    return { success: true }
  } catch (error) {
    console.error('Error in deleteAssignment:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function setClassTeacher(classId: string, teacherId: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = createAdminSupabaseClient()

    if (!classId || !teacherId) return { success: false, error: 'Class and teacher are required' }

    const { data: klass } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', classId)
      .single()

    const classCheck = await ensureSameSchool(klass, schoolId, 'Class not found')
    if (classCheck) return { success: false, error: classCheck.error }

    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('id, school_id, is_active')
      .eq('id', teacherId)
      .single()

    const teacher = teacherRow as { id: string; school_id: string; is_active: boolean } | null

    const teacherCheck = await ensureSameSchool(teacher, schoolId, 'Teacher not found')
    if (teacherCheck) return { success: false, error: teacherCheck.error }
    if (!teacher?.is_active) return { success: false, error: 'Teacher must be active to assign' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('classes')
      .update({ class_teacher_id: teacherId, updated_at: new Date().toISOString() })
      .eq('id', classId)

    if (error) {
      console.error('Error setting class teacher:', error)
      return { success: false, error: 'Failed to set class teacher' }
    }

    try {
      revalidatePath('/school-admin/teacher-assignments')
    } catch (e) {
      console.error('Revalidation error:', e)
    }
    return { success: true }
  } catch (error) {
    console.error('Error in setClassTeacher:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
