import { createServerSupabaseClient } from "./supabase";

export async function getHeaderProps() {
  try {
    const supabase = createServerSupabaseClient();
    
    // Get current session
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return {
        isAuthenticated: false,
        userRole: undefined,
      };
    }

    // Get user profile to fetch role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return {
        isAuthenticated: true,
        userRole: undefined,
      };
    }

    return {
      isAuthenticated: true,
      userRole: profile.role || undefined,
    };
  } catch (error) {
    console.error("Error getting header props:", error);
    return {
      isAuthenticated: false,
      userRole: undefined,
    };
  }
}
