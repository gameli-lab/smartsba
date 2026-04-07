'use server'

import { supabase } from '@/lib/supabase'
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

const supabaseAdmin = supabase as unknown as SupabaseWithAdminLookup

export async function updateSchoolStatusWithEmail(
  schoolId: string,
  newStatus: 'active' | 'inactive',
  reason?: string
) {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: 'Unauthorized', data: null }
    }

    // Get user profile for audit
    const { data: userProfileData } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('user_id', user.id)
      .single()

    const userProfile = userProfileData as UserProfileRow | null

    if (!userProfile) {
      return { error: 'User profile not found', data: null }
    }

    // Get school details
    const { data: schoolData } = await supabase
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
    const { data: adminProfileData } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .eq('school_id', schoolId)
      .eq('role', 'school_admin')
      .limit(1)
      .single()

    const adminProfile = adminProfileData as AdminProfileRow | null

    if (adminProfile) {
      // Get admin email from auth.users
      const adminLookup = await supabaseAdmin.auth.admin.getUserById(adminProfile.user_id)
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
      supabase,
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
