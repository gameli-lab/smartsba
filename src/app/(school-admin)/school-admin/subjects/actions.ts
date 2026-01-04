'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth'
import { createServerComponentClient } from '@/lib/supabase'

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
  const supabase = await createServerComponentClient()
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
    const supabase = await createServerComponentClient()

    if (!input.name || !input.class_id) {
      return { success: false, error: 'Name and class are required' }
    }

    const classCheck = await ensureClassInSchool(input.class_id, schoolId)
    if (classCheck) return { success: false, error: classCheck.error }

    // Unique per class (only check active subjects)
    const { data: duplicate } = await supabase
      .from('subjects')
      .select('id')
      .eq('class_id', input.class_id)
      .eq('name', input.name)
      .eq('is_active', true)
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
    const supabase = await createServerComponentClient()

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
      .eq('is_active', true)
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

export async function deactivateSubject(id: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    if (!id) return { success: false, error: 'Subject ID is required' }

    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('id, school_id, is_active')
      .eq('id', id)
      .single()

    const subject = subjectRow as { id: string; school_id: string; is_active: boolean } | null
    if (!subject || subject.school_id !== schoolId) return { success: false, error: 'Subject not found' }

    if (!subject.is_active) {
      return { success: false, error: 'Subject is already deactivated' }
    }

    const { error } = await supabase
      .from('subjects')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error deactivating subject:', error)
      return { success: false, error: 'Failed to deactivate subject' }
    }

    revalidatePath('/school-admin/subjects')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in deactivateSubject:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function reactivateSubject(id: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    if (!id) return { success: false, error: 'Subject ID is required' }

    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('id, school_id, is_active')
      .eq('id', id)
      .single()

    const subject = subjectRow as { id: string; school_id: string; is_active: boolean } | null
    if (!subject || subject.school_id !== schoolId) return { success: false, error: 'Subject not found' }

    if (subject.is_active) {
      return { success: false, error: 'Subject is already active' }
    }

    const { error } = await supabase
      .from('subjects')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error reactivating subject:', error)
      return { success: false, error: 'Failed to reactivate subject' }
    }

    revalidatePath('/school-admin/subjects')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in reactivateSubject:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Deprecated: Use deactivateSubject instead
export async function deleteSubject(id: string) {
  return deactivateSubject(id)}