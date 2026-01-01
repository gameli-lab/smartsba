'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface ClassInput {
  name: string
  level: number
  stream?: string
  description?: string
  class_teacher_id?: string | null
}

interface UpdateClassInput extends Partial<ClassInput> {
  id: string
}

async function ensureTeacherValid(teacherId: string, schoolId: string) {
  const { data: teacherRow } = await supabase
    .from('teachers')
    .select('id, school_id, is_active')
    .eq('id', teacherId)
    .single()

  const teacher = teacherRow as { id: string; school_id: string; is_active: boolean } | null
  if (!teacher || teacher.school_id !== schoolId) {
    return { error: 'Teacher not found' }
  }

  if (!teacher.is_active) {
    return { error: 'Teacher must be active to assign' }
  }

  return null
}

export async function createClass(input: ClassInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.name || !input.level) {
      return { success: false, error: 'Name and level are required' }
    }

    // Prevent duplicates by school/name/stream
    const query = supabase
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', input.name)

    const { data: existing } = await (input.stream
      ? query.eq('stream', input.stream)
      : query.is('stream', null)
    ).maybeSingle()

    if (existing) {
      return { success: false, error: 'A class with this name/stream already exists' }
    }

    if (input.class_teacher_id) {
      const teacherCheck = await ensureTeacherValid(input.class_teacher_id, schoolId)
      if (teacherCheck) return { success: false, error: teacherCheck.error }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('classes')
      .insert({
        school_id: schoolId,
        name: input.name,
        level: input.level,
        stream: input.stream || null,
        description: input.description || null,
        class_teacher_id: input.class_teacher_id || null,
      })

    if (error) {
      console.error('Error creating class:', error)
      return { success: false, error: 'Failed to create class' }
    }

    revalidatePath('/school-admin/classes')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in createClass:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateClass(input: UpdateClassInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.id) return { success: false, error: 'Class ID is required' }

    const { data: classRow } = await supabase
      .from('classes')
      .select('id, school_id, name, stream')
      .eq('id', input.id)
      .single()

    const klass = classRow as { id: string; school_id: string; name: string; stream: string | null } | null
    if (!klass || klass.school_id !== schoolId) return { success: false, error: 'Class not found' }

    const nextName = input.name ?? klass.name
    const nextStream = input.stream ?? klass.stream

    if (nextName) {
      const dupQuery = supabase
        .from('classes')
        .select('id')
        .eq('school_id', schoolId)
        .eq('name', nextName)
        .neq('id', input.id)

      const { data: duplicate } = await (nextStream
        ? dupQuery.eq('stream', nextStream)
        : dupQuery.is('stream', null)
      ).maybeSingle()

      if (duplicate) {
        return { success: false, error: 'Another class with this name/stream already exists' }
      }
    }

    if (input.class_teacher_id !== undefined && input.class_teacher_id !== null) {
      const teacherCheck = await ensureTeacherValid(input.class_teacher_id, schoolId)
      if (teacherCheck) return { success: false, error: teacherCheck.error }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('classes')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.level !== undefined && { level: input.level }),
        ...(input.stream !== undefined && { stream: input.stream || null }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.class_teacher_id !== undefined && { class_teacher_id: input.class_teacher_id || null }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)

    if (error) {
      console.error('Error updating class:', error)
      return { success: false, error: 'Failed to update class' }
    }

    revalidatePath('/school-admin/classes')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in updateClass:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function deleteClass(id: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!id) return { success: false, error: 'Class ID is required' }

    const { data: classRow } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', id)
      .single()

    const klass = classRow as { id: string; school_id: string } | null
    if (!klass || klass.school_id !== schoolId) return { success: false, error: 'Class not found' }

    // Prevent deletion when dependent records exist to avoid unexpected cascades
    const [{ count: studentCount }, { count: subjectCount }] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', id),
      supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('class_id', id),
    ])

    if ((studentCount || 0) > 0) {
      return { success: false, error: 'Remove or move students before deleting this class' }
    }

    if ((subjectCount || 0) > 0) {
      return { success: false, error: 'Remove subjects linked to this class before deletion' }
    }

    const { error } = await supabase.from('classes').delete().eq('id', id)

    if (error) {
      console.error('Error deleting class:', error)
      return { success: false, error: 'Failed to delete class' }
    }

    revalidatePath('/school-admin/classes')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in deleteClass:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function setClassTeacher(classId: string, teacherId: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!classId || !teacherId) return { success: false, error: 'Class and teacher are required' }

    const { data: classRow } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', classId)
      .single()

    const klass = classRow as { id: string; school_id: string } | null
    if (!klass || klass.school_id !== schoolId) return { success: false, error: 'Class not found' }

    const teacherCheck = await ensureTeacherValid(teacherId, schoolId)
    if (teacherCheck) return { success: false, error: teacherCheck.error }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('classes')
      .update({ class_teacher_id: teacherId, updated_at: new Date().toISOString() })
      .eq('id', classId)

    if (error) {
      console.error('Error setting class teacher:', error)
      return { success: false, error: 'Failed to set class teacher' }
    }

    revalidatePath('/school-admin/classes')
    revalidatePath('/school-admin/teacher-assignments')
    return { success: true }
  } catch (error) {
    console.error('Error in setClassTeacher:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
