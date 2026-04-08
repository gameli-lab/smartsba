import { SupabaseClient } from '@supabase/supabase-js';

export interface AdminData {
  name: string;
  email: string;
  role: string;
  staff_id?: string;
  phone?: string;
}

export interface AdminCreationResult {
  name: string;
  email: string;
  role: string;
  staff_id?: string;
  phone?: string;
  pending_creation: boolean;
  password?: string;
  error?: string;
}

export class AdminCreationService {
  constructor(private supabaseClient: SupabaseClient) {}

  async createAdmins(admins: AdminData[], schoolId: string): Promise<AdminCreationResult[]> {
    try {
      // Refresh session to ensure we have a valid access token
      const { data: refreshedSession, error: refreshError } = await this.supabaseClient.auth.refreshSession();
      const session = refreshedSession?.session;

      if (refreshError || !session?.access_token) {
        console.error("No valid session for admin creation", refreshError);
        return this.mapToFailedResults(admins, "Session expired. Please sign in again and retry.");
      }

      // Make API call to create admins
      const response = await fetch("/api/create-admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ schoolId, admins }),
      });

      const result = await response.json();

      if (response.ok && result.createdAdmins) {
        console.log("✅ Admin creation API success:", result);
        return result.createdAdmins;
      } else {
        console.error("❌ Admin creation API failed:", result);
        return this.mapToFailedResults(admins, result.error || "API call failed");
      }
    } catch (error) {
      console.error("❌ Admin creation service error:", error);
      return this.mapToFailedResults(admins, "Service error");
    }
  }

  private mapToFailedResults(admins: AdminData[], errorMessage: string): AdminCreationResult[] {
    return admins.map((admin) => ({
      ...admin,
      pending_creation: true,
      error: errorMessage,
    }));
  }
}

// Factory function for easy usage
export function createAdminCreationService(supabaseClient: SupabaseClient) {
  return new AdminCreationService(supabaseClient);
}
