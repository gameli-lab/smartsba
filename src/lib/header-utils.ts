import { createServerComponentClient } from "./supabase";
import { getAssumeRoleContextForActor } from "./assume-role";

export interface HeaderProps {
  isAuthenticated: boolean
  userRole?: string
  userName?: string
  userEmail?: string
  schoolName?: string
  contextInfo?: string  // e.g. "St. Mary's School • 2024/2025 • Term 1"
  assumedRole?: string
}

export async function getHeaderProps(): Promise<HeaderProps> {
  try {
    const supabase = await createServerComponentClient();

    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return { isAuthenticated: false };
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, full_name, email, school_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return { isAuthenticated: true };
    }

    const base: HeaderProps = {
      isAuthenticated: true,
      userRole: profile.role || undefined,
      userName: profile.full_name || undefined,
      userEmail: profile.email || undefined,
    };

    if (profile.role === 'super_admin') {
      const assumeContext = await getAssumeRoleContextForActor(user.id)
      if (assumeContext) {
        base.assumedRole = assumeContext.assumedRole
      }
    }

    // For all school-affiliated users fetch school name + current session
    if (profile.school_id) {
      const [schoolRes, sessionRes] = await Promise.all([
        supabase
          .from("schools")
          .select("name")
          .eq("id", profile.school_id)
          .single(),
        supabase
          .from("academic_sessions")
          .select("academic_year, term")
          .eq("school_id", profile.school_id)
          .eq("is_current", true)
          .maybeSingle(),
      ]);

      const schoolName = (schoolRes.data as { name: string } | null)?.name;
      const session = sessionRes.data as {
        academic_year: string;
        term: number;
      } | null;

      const sessionText = session
        ? `${session.academic_year} • Term ${session.term}`
        : null;

      const contextInfo = [schoolName, sessionText]
        .filter(Boolean)
        .join(" • ") || undefined;

      return { ...base, schoolName: schoolName || undefined, contextInfo };
    }

    return base;
  } catch (error) {
    console.error("Error getting header props:", error);
    return { isAuthenticated: false };
  }
}
