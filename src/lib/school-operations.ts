// Enhanced school operations with proper validation and error handling
// Improved from temporary bypass to production-ready functions

import { supabase } from './supabase';

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
    const { data, error } = await (supabase as any)
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
    const { data: existingUsers, error: fetchError } = await (supabase as any)
      .from("user_profiles")
      .select("user_id, email, role")
      .eq("school_id", schoolId);

    if (fetchError) {
      console.error('Error fetching existing users:', fetchError);
      return { error: fetchError, data: null };
    }

    console.log('Found users for school:', existingUsers?.length || 0, existingUsers);

    if (!existingUsers || existingUsers.length === 0) {
      console.log('No users found for school, skipping user deactivation');
      return { error: null, data: null };
    }

    // Type assertion needed until Supabase types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
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
    console.log('Attempting to delete school:', schoolId);
    
    // TODO: Implement proper transaction handling or use CASCADE constraints
    // For now, this is a direct delete operation
    // Type assertion needed until Supabase types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("schools")
      .delete()
      .eq("id", schoolId);
    
    if (error) {
      return { error, data: null };
    }

    console.log('School deletion result:', data);
    return { error: null, data };
  } catch (error) {
    console.error('Exception in deleteSchool:', error);
    return { error: error instanceof Error ? error : new Error('Unknown error'), data: null };
  }
};
