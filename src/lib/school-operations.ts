// Temporary helper to bypass TypeScript issues after database migration
// This allows the status toggle and delete functionality to work
// while we wait for proper type regeneration

import { supabase } from './supabase';

export const updateSchoolStatus = async (schoolId: string, status: string) => {
  // Cast to any to bypass TypeScript until types are regenerated
  const supabaseAny = supabase as any;
  
  return await supabaseAny
    .from("schools")
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", schoolId);
};

export const updateUserProfiles = async (schoolId: string, status: string) => {
  try {
    console.log('Attempting to update user profiles for school:', schoolId, 'to status:', status);
    
    // First, check if any users exist for this school
    const { data: existingUsers, error: fetchError } = await supabase
      .from("user_profiles")
      .select("user_id, email, role")
      .eq("school_id", schoolId);

    if (fetchError) {
      console.error('Error fetching existing users:', fetchError);
      return { error: fetchError };
    }

    console.log('Found users for school:', existingUsers?.length || 0, existingUsers);

    if (!existingUsers || existingUsers.length === 0) {
      console.log('No users found for school, skipping user deactivation');
      return { error: null, data: null };
    }

    // Cast to any to bypass TypeScript until types are regenerated
    const supabaseAny = supabase as any;
    
    const result = await supabaseAny
      .from("user_profiles")
      .update({ status })
      .eq("school_id", schoolId);

    console.log('User profiles update result:', result);
    return result;
  } catch (error) {
    console.error('Exception in updateUserProfiles:', error);
    return { error };
  }
};

export const deleteSchool = async (schoolId: string) => {
  try {
    console.log('Attempting to delete school:', schoolId);
    
    const result = await supabase
      .from("schools")
      .delete()
      .eq("id", schoolId);
    
    console.log('School deletion result:', result);
    return result;
  } catch (error) {
    console.error('Exception in deleteSchool:', error);
    return { error };
  }
};
