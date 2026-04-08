// Enhanced school operations with proper validation and error handling
// Improved from temporary bypass to production-ready functions

import { createAdminSupabaseClient } from './supabase';

// Create admin client lazily - only when needed, not at module import time
let adminSupabase: ReturnType<typeof createAdminSupabaseClient> | null = null

function getAdminSupabase() {
  if (!adminSupabase) {
    adminSupabase = createAdminSupabaseClient()
  }
  return adminSupabase
}

interface OperationResult<T = unknown> {
  error: Error | null;
  data: T | null;
}

export const updateSchoolStatus = async (
  schoolId: string, 
  status: string
): Promise<OperationResult> => {
  // Input validation
  if (!schoolId || typeof schoolId !== 'string' || schoolId.trim() === '') {
    return { error: new Error('School ID is required and must be a non-empty string'), data: null };
  }

  const allowedStatuses = ['active', 'inactive'];
  if (!allowedStatuses.includes(status)) {
    return { error: new Error(`Status must be one of: ${allowedStatuses.join(', ')}`), data: null };
  }

  try {
    console.log('Updating school status:', schoolId, status);
    
    // Type assertion needed until Supabase types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getAdminSupabase() as any)
      .from("schools")
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", schoolId);
    
    if (error) {
      return { error, data: null };
    }

    return { error: null, data };
  } catch (error) {
    console.error('Error updating school status:', error);
    return { error: error instanceof Error ? error : new Error('Unknown error'), data: null };
  }
};

export const updateUserProfiles = async (
  schoolId: string, 
  status: string
): Promise<OperationResult> => {
  // Input validation
  if (!schoolId || typeof schoolId !== 'string' || schoolId.trim() === '') {
    return { error: new Error('School ID is required and must be a non-empty string'), data: null };
  }

  if (!status || typeof status !== 'string' || status.trim() === '') {
    return { error: new Error('Status is required and must be a non-empty string'), data: null };
  }

  try {
    console.log('Attempting to update user profiles for school:', schoolId, 'to status:', status);
    
    // First, check if any users exist for this school
    // Type assertion needed until Supabase types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingUsers, error: fetchError } = await (getAdminSupabase() as any)
      .from("user_profiles")
      .select("user_id, email, role")
      .eq("school_id", schoolId);

    if (fetchError) {
      console.error('Error fetching existing users:', fetchError);
      return { error: fetchError, data: null };
    }

    console.log('Found users for school:', existingUsers?.length || 0);

    if (!existingUsers || existingUsers.length === 0) {
      console.log('No users found for school, skipping user deactivation');
      return { error: null, data: null };
    }

    // Type assertion needed until Supabase types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getAdminSupabase() as any)
      .from("user_profiles")
      .update({ status })
      .eq("school_id", schoolId);

    if (error) {
      return { error, data: null };
    }

    console.log('User profiles update result:', data);
    return { error: null, data };
  } catch (error) {
    console.error('Exception in updateUserProfiles:', error);
    return { error: error instanceof Error ? error : new Error('Unknown error'), data: null };
  }
};

export const deleteSchool = async (schoolId: string): Promise<OperationResult> => {
  // Input validation
  if (!schoolId || typeof schoolId !== 'string' || schoolId.trim() === '') {
    return { error: new Error('School ID is required and must be a non-empty string'), data: null };
  }

  try {
    console.log('Starting transactional school deletion:', schoolId);
    
    // Begin transaction using Supabase RPC function for atomic operations
    // First, verify the school exists and get basic info for logging
    // Type assertion needed until Supabase types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: schoolInfo, error: schoolCheckError } = await (getAdminSupabase() as any)
      .from("schools")
      .select("id, name, created_at")
      .eq("id", schoolId)
      .single();

    if (schoolCheckError) {
      if (schoolCheckError.code === 'PGRST116') {
        return { error: new Error(`School with ID ${schoolId} not found`), data: null };
      }
      return { error: schoolCheckError, data: null };
    }

    console.log('School to delete:', {
      id: schoolInfo.id,
      name: schoolInfo.name,
      created_at: schoolInfo.created_at
    });

    // Get related data counts for logging and verification
    const relatedDataQueries = await Promise.allSettled([
      // Type assertion needed until Supabase types are regenerated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getAdminSupabase() as any).from("user_profiles").select("id", { count: 'exact', head: true }).eq("school_id", schoolId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getAdminSupabase() as any).from("classes").select("id", { count: 'exact', head: true }).eq("school_id", schoolId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getAdminSupabase() as any).from("students").select("id", { count: 'exact', head: true }).eq("school_id", schoolId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getAdminSupabase() as any).from("teachers").select("id", { count: 'exact', head: true }).eq("school_id", schoolId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getAdminSupabase() as any).from("academic_sessions").select("id", { count: 'exact', head: true }).eq("school_id", schoolId),
    ]);

    const relatedCounts = {
      user_profiles: relatedDataQueries[0].status === 'fulfilled' ? relatedDataQueries[0].value.count || 0 : 'unknown',
      classes: relatedDataQueries[1].status === 'fulfilled' ? relatedDataQueries[1].value.count || 0 : 'unknown',
      students: relatedDataQueries[2].status === 'fulfilled' ? relatedDataQueries[2].value.count || 0 : 'unknown',
      teachers: relatedDataQueries[3].status === 'fulfilled' ? relatedDataQueries[3].value.count || 0 : 'unknown',
      academic_sessions: relatedDataQueries[4].status === 'fulfilled' ? relatedDataQueries[4].value.count || 0 : 'unknown',
    };

    console.log('Related data to be cascaded:', relatedCounts);

    // Use the safe database function for deletion with comprehensive logging
    // Type assertion needed until Supabase types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deleteResult, error } = await (getAdminSupabase() as any)
      .rpc('safe_delete_school', { target_school_id: schoolId });
    
    if (error) {
      console.error('School deletion RPC failed:', error);
      return { error, data: null };
    }

    // Check if the database function succeeded
    if (!deleteResult || !deleteResult.success) {
      const errorMessage = deleteResult?.error || 'Unknown database deletion error';
      console.error('School deletion failed:', errorMessage);
      return { error: new Error(errorMessage), data: null };
    }

    console.log('School deletion completed successfully:', {
      schoolId,
      result: deleteResult,
      fallbackCounts: relatedCounts,
      timestamp: new Date().toISOString()
    });

    return { 
      error: null, 
      data: {
        deletedSchool: deleteResult.deleted_school,
        relatedRecordsDeleted: deleteResult.related_records_deleted,
        timestamp: deleteResult.timestamp,
        fallbackCounts: relatedCounts
      }
    };
  } catch (error) {
    console.error('Exception during school deletion:', error);
    return { error: error instanceof Error ? error : new Error('Unknown error during school deletion'), data: null };
  }
};
