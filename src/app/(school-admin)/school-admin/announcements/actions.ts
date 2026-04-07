'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { UserRole } from '@/types'

export interface AnnouncementInput {
  title: string
  content: string
  scope: 'school-wide' | 'class' | 'parents'
  class_ids?: string[]
  is_urgent?: boolean
  expires_at?: string | null
}

interface ClassOwnerRow {
  id: string
  school_id: string
}

interface AnnouncementOwnerRow {
  id: string
  school_id: string
}

export async function createAnnouncement(input: AnnouncementInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.title?.trim()) return { success: false, error: 'Title is required' }
    if (!input.content?.trim()) return { success: false, error: 'Content is required' }

    const scope = input.scope || 'school-wide'
    const isClassScope = scope === 'class'
    const target_audience: UserRole[] = scope === 'parents' ? ['parent'] : ['teacher', 'student', 'parent']
    const class_ids = isClassScope ? input.class_ids?.filter(Boolean) || [] : []

    // Validate class ownership if class_ids provided
    if (class_ids.length) {
      const { data: classes, error } = await supabase
        .from('classes')
        .select('id, school_id')
        .in('id', class_ids)

      if (error) return { success: false, error: 'Failed to validate classes' }
      const invalid = ((classes || []) as ClassOwnerRow[]).some((c) => c.school_id !== schoolId)
      if (invalid) return { success: false, error: 'Invalid class selection' }
    }

    const { error: insertError } = await supabase
      .from('announcements')
      .insert({
        school_id: schoolId,
        title: input.title.trim(),
        content: input.content.trim(),
        target_audience,
        class_ids: class_ids.length ? class_ids : null,
        is_urgent: Boolean(input.is_urgent),
        published_at: new Date().toISOString(),
        expires_at: input.expires_at || null,
        created_by: profile.id,
      })

    if (insertError) {
      console.error('createAnnouncement error:', insertError)
      return { success: false, error: 'Failed to create announcement' }
    }

    revalidatePath('/school-admin/announcements')
    return { success: true }
  } catch (error) {
    console.error('createAnnouncement exception:', error)
    return { success: false, error: 'Unexpected error' }
  }
}

export async function updateAnnouncement(id: string, input: AnnouncementInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!id) return { success: false, error: 'Announcement id is required' }
    if (!input.title?.trim()) return { success: false, error: 'Title is required' }
    if (!input.content?.trim()) return { success: false, error: 'Content is required' }

    const scope = input.scope || 'school-wide'
    const isClassScope = scope === 'class'
    const target_audience: UserRole[] = scope === 'parents' ? ['parent'] : ['teacher', 'student', 'parent']
    const class_ids = isClassScope ? input.class_ids?.filter(Boolean) || [] : []

    // Ensure the announcement belongs to the school
    const { data: existing, error: fetchError } = await supabase
      .from('announcements')
      .select('id, school_id')
      .eq('id', id)
      .single()

    const typedExisting = existing as AnnouncementOwnerRow | null
    if (fetchError || !typedExisting || typedExisting.school_id !== schoolId) {
      return { success: false, error: 'Announcement not found' }
    }

    if (class_ids.length) {
      const { data: classes, error } = await supabase
        .from('classes')
        .select('id, school_id')
        .in('id', class_ids)

      if (error) return { success: false, error: 'Failed to validate classes' }
      const invalid = ((classes || []) as ClassOwnerRow[]).some((c) => c.school_id !== schoolId)
      if (invalid) return { success: false, error: 'Invalid class selection' }
    }

    const { error: updateError } = await supabase
      .from('announcements')
      .update({
        title: input.title.trim(),
        content: input.content.trim(),
        target_audience,
        class_ids: class_ids.length ? class_ids : null,
        is_urgent: Boolean(input.is_urgent),
        expires_at: input.expires_at || null,
      })
      .eq('id', id)

    if (updateError) {
      console.error('updateAnnouncement error:', updateError)
      return { success: false, error: 'Failed to update announcement' }
    }

    revalidatePath('/school-admin/announcements')
    return { success: true }
  } catch (error) {
    console.error('updateAnnouncement exception:', error)
    return { success: false, error: 'Unexpected error' }
  }
}

export async function archiveAnnouncement(id: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!id) return { success: false, error: 'Announcement id is required' }

    // Ensure announcement belongs to school
    const { data: existing, error: fetchError } = await supabase
      .from('announcements')
      .select('id, school_id')
      .eq('id', id)
      .single()

    const typedExisting = existing as AnnouncementOwnerRow | null
    if (fetchError || !typedExisting || typedExisting.school_id !== schoolId) {
      return { success: false, error: 'Announcement not found' }
    }

    const { error: updateError } = await supabase
      .from('announcements')
      .update({ expires_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      console.error('archiveAnnouncement error:', updateError)
      return { success: false, error: 'Failed to archive announcement' }
    }

    revalidatePath('/school-admin/announcements')
    return { success: true }
  } catch (error) {
    console.error('archiveAnnouncement exception:', error)
    return { success: false, error: 'Unexpected error' }
  }
}
