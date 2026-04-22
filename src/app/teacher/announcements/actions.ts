'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'
import type { Announcement } from '@/types'

function parseBool(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1'
}

export async function createAnnouncement(formData: FormData) {
  const { profile, assignments } = await requireTeacher()

  const title = (formData.get('title') as string | null)?.trim()
  const content = (formData.get('content') as string | null)?.trim()
  const classId = formData.get('classId') as string | null
  const isUrgent = parseBool(formData.get('is_urgent'))

  if (!title || !content || !classId) {
    return { success: false, error: 'Title, content, and class are required.' }
  }

  const isClassTeacher = assignments.some((a) => a.class_id === classId && a.is_class_teacher)
  if (!isClassTeacher) {
    return { success: false, error: 'Only class teachers can send announcements.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('announcements').insert({
    school_id: profile.school_id,
    title,
    content,
    target_audience: ['student', 'parent'],
    class_ids: [classId],
    is_urgent: isUrgent,
    created_by: profile.user_id,
  })

  if (error) {
    console.error('createAnnouncement error', error)
    return { success: false, error: 'Failed to create announcement.' }
  }

  revalidatePath('/teacher/announcements')
  return { success: true }
}

export async function updateAnnouncement(formData: FormData) {
  const { profile } = await requireTeacher()

  const id = formData.get('id') as string | null
  const title = (formData.get('title') as string | null)?.trim()
  const content = (formData.get('content') as string | null)?.trim()
  const isUrgent = parseBool(formData.get('is_urgent'))

  if (!id || !title || !content) {
    return { success: false, error: 'Id, title, and content are required.' }
  }

  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, created_by')
    .eq('id', id)
    .maybeSingle()

  const existing = announcement as Pick<Announcement, 'id' | 'created_by'> | null

  if (!existing || existing.created_by !== profile.user_id) {
    return { success: false, error: 'You can only edit your own announcements.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('announcements')
    .update({ title, content, is_urgent: isUrgent })
    .eq('id', id)

  if (error) {
    console.error('updateAnnouncement error', error)
    return { success: false, error: 'Failed to update announcement.' }
  }

  revalidatePath('/teacher/announcements')
  return { success: true }
}

export async function deleteAnnouncement(formData: FormData) {
  const { profile } = await requireTeacher()
  const id = formData.get('id') as string | null
  if (!id) return { success: false, error: 'Announcement id required.' }

  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, created_by')
    .eq('id', id)
    .maybeSingle()

  const existing = announcement as Pick<Announcement, 'id' | 'created_by'> | null

  if (!existing || existing.created_by !== profile.user_id) {
    return { success: false, error: 'You can only delete your own announcements.' }
  }

  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) {
    console.error('deleteAnnouncement error', error)
    return { success: false, error: 'Failed to delete announcement.' }
  }

  revalidatePath('/teacher/announcements')
  return { success: true }
}
