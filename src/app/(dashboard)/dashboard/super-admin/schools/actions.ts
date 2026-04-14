'use server'

import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { updateSchoolStatus as updateStatus } from '@/lib/school-operations'
import { sendSchoolStatusChangedEmail } from '@/services/emailService'
import logAction from '@/lib/audit'

interface UserProfileRow {
  full_name: string
  role: string
}

interface SchoolNameRow {
  name: string
}

interface AdminProfileRow {
  user_id: string
  full_name: string
}

interface AdminUserLookup {
  data: {
    user: {
      email?: string | null
    } | null
  } | null
}

interface SupabaseWithAdminLookup {
  auth: {
    admin: {
      getUserById(userId: string): Promise<AdminUserLookup>
    }
  }
}

async function getSuperAdminContext() {
  const serverSupabase = await createServerComponentClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized', user: null, profile: null }
  }

  const { data: userProfileData } = await serverSupabase
    .from('user_profiles')
    .select('full_name, role')
    .eq('user_id', user.id)
    .single()

  const profile = userProfileData as UserProfileRow | null
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Unauthorized: Super admin privileges required', user: null, profile: null }
  }

  return { error: null as string | null, user, profile }
}

export async function updateSchoolStatusWithEmail(
  schoolId: string,
  newStatus: 'active' | 'inactive',
  reason?: string
) {
  try {
    const authContext = await getSuperAdminContext()
    if (authContext.error || !authContext.user || !authContext.profile) {
      return { error: authContext.error || 'Unauthorized', data: null }
    }

    const { user, profile: userProfile } = authContext
    const serverSupabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()
    const adminLookupClient = adminSupabase as unknown as SupabaseWithAdminLookup

    // Get school details
    const { data: schoolData } = await serverSupabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single()

    const school = schoolData as SchoolNameRow | null

    if (!school) {
      return { error: 'School not found', data: null }
    }

    // Update the school status
    const result = await updateStatus(schoolId, newStatus)
    
    if (result.error) {
      return { error: result.error.message, data: null }
    }

    // Get school admin email to notify
    // Type assertion needed until types are regenerated
    const { data: adminProfileData } = await serverSupabase
      .from('user_profiles')
      .select('user_id, full_name')
      .eq('school_id', schoolId)
      .eq('role', 'school_admin')
      .limit(1)
      .single()

    const adminProfile = adminProfileData as AdminProfileRow | null

    if (adminProfile) {
      // Get admin email from auth.users
      const adminLookup = await adminLookupClient.auth.admin.getUserById(adminProfile.user_id)
      const adminUser = adminLookup.data
      
      if (adminUser?.user?.email) {
        // Send email notification (don't await to avoid blocking)
        sendSchoolStatusChangedEmail({
          schoolName: school.name,
          schoolId,
          adminEmail: adminUser.user.email,
          adminUserId: adminProfile.user_id,
          newStatus,
          changedBy: userProfile.full_name,
          reason,
        }).catch(error => {
          console.error('Failed to send status change email:', error)
          // Don't fail the operation if email fails
        })
      }
    }

    // Log the action
    await logAction(
      adminSupabase,
      user.id,
      newStatus === 'active' ? 'school_activated' : 'school_deactivated',
      'school',
      schoolId,
      {
        school_name: school.name,
        new_status: newStatus,
        reason,
      }
    )

    return { error: null, data: result.data }
  } catch (error) {
    console.error('Error updating school status:', error)
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      data: null 
    }
  }
}

export async function deleteSchool(
  schoolId: string
) {
  try {
    const authContext = await getSuperAdminContext()
    if (authContext.error || !authContext.user) {
      return { error: authContext.error || 'Unauthorized', success: false }
    }

    const { user } = authContext
    const adminSupabase = createAdminSupabaseClient()

    // Get school details before deletion
    const { data: schoolData } = await adminSupabase
      .from('schools')
      .select('name, id')
      .eq('id', schoolId)
      .single()

    const school = schoolData as { name: string; id: string } | null

    if (!school) {
      return { error: 'School not found', success: false }
    }

    // Delete the school (cascade handled by database)
    const { error: deleteError } = await adminSupabase
      .from('schools')
      .delete()
      .eq('id', schoolId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return { 
        error: deleteError.message || 'Failed to delete school', 
        success: false 
      }
    }

    // Log the action
    await logAction(
      adminSupabase,
      user.id,
      'school_deleted',
      'school',
      schoolId,
      {
        school_name: school.name,
        school_id: schoolId,
      }
    )

    return { 
      error: null, 
      success: true,
      message: `School "${school.name}" deleted successfully`
    }
  } catch (error) {
    console.error('Error deleting school:', error)
    return { 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }
  }
}
