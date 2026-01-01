'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface SubjectInput {
  name: string
  class_id: string
  code?: string
  description?: string
  is_core?: boolean
}

interface UpdateSubjectInput extends Partial<SubjectInput> {
  id: string
}

async function ensureClassInSchool(classId: string, schoolId: string) {
  const { data: classRow } = await supabase
    .from('classes')
    .select('id, school_id')
    .eq('id', classId)
    .single()

  const klass = classRow as { id: string; school_id: string } | null
  if (!klass || klass.school_id !== schoolId) {
    return { error: 'Class not found' }
  }

  return null
}

export async function createSubject(input: SubjectInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.name || !input.class_id) {
      return { success: false, error: 'Name and class are required' }
    }

    const classCheck = await ensureClassInSchool(input.class_id, schoolId)
    if (classCheck) return { success: false, error: classCheck.error }

    // Unique per class
    const { data: duplicate } = await supabase
      .from('subjects')
      .select('id')
      .eq('class_id', input.class_id)
      .eq('name', input.name)
      .maybeSingle()

    if (duplicate) {
      return { success: false, error: 'Subject already exists for this class' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('subjects')
      .insert({
        school_id: schoolId,
        class_id: input.class_id,
        name: input.name,
        code: input.code || null,
        description: input.description || null,
        is_core: input.is_core ?? false,
      })

    if (error) {
      console.error('Error creating subject:', error)
      return { success: false, error: 'Failed to create subject' }
    }

    revalidatePath('/school-admin/subjects')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in createSubject:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateSubject(input: UpdateSubjectInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.id) return { success: false, error: 'Subject ID is required' }

    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('id, school_id, class_id, name')
      .eq('id', input.id)
      .single()

    const subject = subjectRow as { id: string; school_id: string; class_id: string; name: string } | null
    if (!subject || subject.school_id !== schoolId) return { success: false, error: 'Subject not found' }

    const nextClassId = input.class_id ?? subject.class_id
    const classCheck = await ensureClassInSchool(nextClassId, schoolId)
    if (classCheck) return { success: false, error: classCheck.error }

    const nextName = input.name ?? subject.name

    const { data: duplicate } = await supabase
      .from('subjects')
      .select('id')
      .eq('class_id', nextClassId)
      .eq('name', nextName)
      .neq('id', input.id)
      .maybeSingle()

    if (duplicate) {
      return { success: false, error: 'Another subject with this name already exists for the class' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('subjects')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.class_id !== undefined && { class_id: input.class_id }),
        ...(input.code !== undefined && { code: input.code || null }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.is_core !== undefined && { is_core: input.is_core }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)

    if (error) {
      console.error('Error updating subject:', error)
      return { success: false, error: 'Failed to update subject' }
    }

    revalidatePath('/school-admin/subjects')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in updateSubject:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function deleteSubject(id: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!id) return { success: false, error: 'Subject ID is required' }

    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('id, school_id')
      .eq('id', id)
      .single()

    const subject = subjectRow as { id: string; school_id: string } | null
    if (!subject || subject.school_id !== schoolId) return { success: false, error: 'Subject not found' }

    // Avoid deleting when teacher assignments exist to prevent surprise cascades
    const { count: assignmentCount } = await supabase
      .from('teacher_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', id)

    if ((assignmentCount || 0) > 0) {
      return { success: false, error: 'Remove teacher assignments for this subject before deletion' }
    }

    const { error } = await supabase.from('subjects').delete().eq('id', id)

    if (error) {
      console.error('Error deleting subject:', error)
      return { success: false, error: 'Failed to delete subject' }
    }

    revalidatePath('/school-admin/subjects')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in deleteSubject:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
