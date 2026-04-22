'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth-guards'
import { supabase, createServerComponentClient } from '@/lib/supabase'
import { uploadSchoolAsset, deleteSchoolAsset } from '@/lib/storage'
import { School } from '@/types'

interface UpdateSchoolProfileInput {
  name: string
  motto?: string
  address?: string
  phone?: string
  email?: string
  website?: string
}

/**
 * Update school profile basic information
 */
export async function updateSchoolProfile(input: UpdateSchoolProfileInput) {
  try {
    // Verify school admin access
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    // Validate required fields
    if (!input.name || input.name.trim().length === 0) {
      return { success: false, error: 'School name is required' }
    }

    if (input.name.length > 200) {
      return { success: false, error: 'School name must be less than 200 characters' }
    }

    // Validate email format if provided
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      return { success: false, error: 'Invalid email format' }
    }

    // Validate phone format if provided (basic validation)
    if (input.phone && !/^[\d\s\-\+\(\)]+$/.test(input.phone)) {
      return { success: false, error: 'Invalid phone number format' }
    }

    // Update school record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('schools')
      .update({
        name: input.name.trim(),
        motto: input.motto?.trim() || null,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        website: input.website?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schoolId)

    if (error) {
      console.error('Error updating school profile:', error)
      return { success: false, error: 'Failed to update school profile' }
    }

    // Revalidate pages that display school info
    revalidatePath('/school-admin')
    revalidatePath('/school-admin/school-profile')

    return { success: true }
  } catch (error) {
    console.error('Error in updateSchoolProfile:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Upload school asset (logo, stamp, or signature)
 */
export async function uploadSchoolAssetAction(formData: FormData) {
  try {
    // Verify school admin access
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    const file = formData.get('file') as File
    const type = formData.get('type') as 'logo' | 'stamp' | 'signature'

    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    if (!type || !['logo', 'stamp', 'signature'].includes(type)) {
      return { success: false, error: 'Invalid asset type' }
    }

    // Create server-side Supabase client with authenticated session
    const serverSupabase = await createServerComponentClient()

    // Get current school data to delete old file if exists
    const { data: school } = await serverSupabase
      .from('schools')
      .select('logo_url, stamp_url, head_signature_url')
      .eq('id', schoolId)
      .single()

    const typedSchool = school as Pick<School, 'logo_url' | 'stamp_url' | 'head_signature_url'> | null

    // Upload new file with server-side client
    const filePath = await uploadSchoolAsset(file, schoolId, type, serverSupabase)

    if (!filePath) {
      return { success: false, error: 'Failed to upload file' }
    }

    // Update school record with new file path
    const updateField = type === 'logo' ? 'logo_url' : type === 'stamp' ? 'stamp_url' : 'head_signature_url'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (serverSupabase as any)
      .from('schools')
      .update({
        [updateField]: filePath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schoolId)

    if (error) {
      // If update fails, try to delete the uploaded file
      await deleteSchoolAsset(filePath, serverSupabase)
      console.error('Error updating school record:', error)
      return { success: false, error: 'Failed to update school record' }
    }

    // Delete old file if it exists
    if (typedSchool) {
      const oldPath = typedSchool[updateField as keyof typeof typedSchool]
      if (oldPath) {
        await deleteSchoolAsset(oldPath, serverSupabase)
      }
    }

    // Revalidate pages
    revalidatePath('/school-admin')
    revalidatePath('/school-admin/school-profile')

    return { success: true, filePath }
  } catch (error) {
    console.error('Error in uploadSchoolAssetAction:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete school asset
 */
export async function deleteSchoolAssetAction(type: 'logo' | 'stamp' | 'signature') {
  try {
    // Verify school admin access
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!['logo', 'stamp', 'signature'].includes(type)) {
      return { success: false, error: 'Invalid asset type' }
    }

    // Create server-side Supabase client with authenticated session
    const serverSupabase = await createServerComponentClient()

    // Get current file path
    const { data: school } = await serverSupabase
      .from('schools')
      .select('logo_url, stamp_url, head_signature_url')
      .eq('id', schoolId)
      .single()

    const typedSchool = school as Pick<School, 'logo_url' | 'stamp_url' | 'head_signature_url'> | null

    if (!typedSchool) {
      return { success: false, error: 'School not found' }
    }

    const updateField = type === 'logo' ? 'logo_url' : type === 'stamp' ? 'stamp_url' : 'head_signature_url'
    const filePath = typedSchool[updateField as keyof typeof typedSchool]

    if (!filePath) {
      return { success: false, error: 'No file to delete' }
    }

    // Update school record to remove file reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (serverSupabase as any)
      .from('schools')
      .update({
        [updateField]: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schoolId)

    if (error) {
      console.error('Error updating school record:', error)
      return { success: false, error: 'Failed to update school record' }
    }

    // Delete the file from storage
    await deleteSchoolAsset(filePath, serverSupabase)

    // Revalidate pages
    revalidatePath('/school-admin')
    revalidatePath('/school-admin/school-profile')

    return { success: true }
  } catch (error) {
    console.error('Error in deleteSchoolAssetAction:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
