'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth-guards'
import { createServerComponentClient } from '@/lib/supabase'

interface SubjectInput {
  name: string
  level_group: 'NURSERY' | 'KG' | 'PRIMARY' | 'JHS'
  code?: string
  description?: string
  is_core?: boolean
}

interface UpdateSubjectInput extends Partial<SubjectInput> {
  id: string
}

export async function createSubject(input: SubjectInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    if (!input.name || !input.level_group) {
      return { success: false, error: 'Name and level are required' }
    }

    // Unique per level group (only check active subjects)
    const { data: duplicate } = await supabase
      .from('subjects')
      .select('id')
      .eq('school_id', schoolId)
      .eq('level_group', input.level_group)
      .eq('name', input.name)
      .eq('is_active', true)
      .maybeSingle()

    if (duplicate) {
      return { success: false, error: 'A subject with this name already exists for this level' }
    }

    const { error } = await supabase
      .from('subjects')
      .insert({
        school_id: schoolId,
        level_group: input.level_group,
        name: input.name,
        code: input.code || null,
        description: input.description || null,
        is_core: input.is_core || false,
        // Ensure new subjects default to active even if DB default isn't set
        is_active: true,
      })

    if (error) {
      console.error('Error creating subject:', error)
      return { success: false, error: 'Failed to create subject' }
    }

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
      .select('id, school_id, level_group, name')
      .eq('id', input.id)
      .single()

    const subject = subjectRow as { id: string; school_id: string; level_group: string; name: string } | null
    if (!subject || subject.school_id !== schoolId) return { success: false, error: 'Subject not found' }

    const nextLevelGroup = input.level_group ?? subject.level_group
    const nextName = input.name ?? subject.name

    const { data: duplicate } = await supabase
      .from('subjects')
      .select('id')
      .eq('level_group', nextLevelGroup)
      .eq('name', nextName)
      .eq('is_active', true)
      .neq('id', input.id)
      .maybeSingle()

    if (duplicate) {
      return { success: false, error: 'Another subject with this name already exists for this level' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('subjects')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.level_group !== undefined && { level_group: input.level_group }),
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

// Permanently delete subject (for correcting mistakes)
// Safety checks prevent deleting subjects already used in assignments/scores.
export async function deleteSubject(id: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    if (!id) return { success: false, error: 'Subject ID is required' }

    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('id, school_id, name')
      .eq('id', id)
      .single()

    const subject = subjectRow as { id: string; school_id: string; name: string } | null
    if (!subject || subject.school_id !== schoolId) return { success: false, error: 'Subject not found' }

    const [{ count: assignmentCount }, { count: scoreCount }] = await Promise.all([
      supabase
        .from('teacher_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', id),
      supabase
        .from('scores')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', id),
    ])

    if ((scoreCount || 0) > 0) {
      return { success: false, error: 'Cannot delete a subject with recorded scores' }
    }

    if ((assignmentCount || 0) > 0) {
      return { success: false, error: 'Remove teacher assignments before deleting this subject' }
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