import { updateSchoolStatus, updateUserProfiles, deleteSchool } from "@/lib/school-operations";

export interface SchoolDeletionResult {
  success: boolean;
  action: "soft-delete" | "hard-delete" | "cancelled";
  message: string;
  errors?: unknown[];
}

export interface SchoolDeletionCallbacks {
  showConfirm: (message: string) => boolean;
  showPrompt: (message: string) => string | null;
  showAlert: (message: string) => void;
}

export class SchoolDeletionService {
  constructor(private callbacks: SchoolDeletionCallbacks) {}

  async deleteSchool(schoolId: string, schoolName: string): Promise<SchoolDeletionResult> {
    try {
      // First confirmation: Soft vs Hard delete
      const choice = this.callbacks.showConfirm(
        `What would you like to do with "${schoolName}"?\n\n` +
        `Click OK for SOFT DELETE (recommended - can be restored)\n` +
        `Click Cancel for PERMANENT DELETE (cannot be undone)`
      );

      if (choice) {
        // Soft delete - just deactivate
        return await this.performSoftDelete(schoolId, schoolName);
      } else {
        // Hard delete - permanent
        return await this.performHardDelete(schoolId, schoolName);
      }
    } catch (error) {
      console.error("Error in school deletion service:", error);
      return {
        success: false,
        action: "cancelled",
        message: "An error occurred while deleting the school.",
        errors: [error],
      };
    }
  }

  private async performSoftDelete(schoolId: string, schoolName: string): Promise<SchoolDeletionResult> {
    console.log("Soft deleting school:", schoolId, schoolName);

    const { error } = await updateSchoolStatus(schoolId, "inactive");

    if (error) {
      console.error("Error soft deleting school:", error);
      return {
        success: false,
        action: "soft-delete",
        message: "Failed to delete school. Please try again.",
        errors: [error],
      };
    }

    return {
      success: true,
      action: "soft-delete",
      message: `School "${schoolName}" has been deactivated (soft delete). You can reactivate it anytime.`,
    };
  }

  private async performHardDelete(schoolId: string, schoolName: string): Promise<SchoolDeletionResult> {
    // Final confirmation for permanent deletion
    const confirmation = this.callbacks.showPrompt(
      `⚠️  PERMANENT DELETION WARNING!\n\n` +
      `This will permanently delete "${schoolName}" and:\n` +
      `• All school data\n` +
      `• Associated user accounts\n` +
      `• All academic records\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "PERMANENTLY DELETE" to confirm:`
    );

    if (confirmation !== "PERMANENTLY DELETE") {
      return {
        success: false,
        action: "cancelled",
        message: "Deletion cancelled - confirmation text did not match.",
      };
    }

    console.log("Permanently deleting school:", schoolId, schoolName);

    const errors: unknown[] = [];

    // First, try to deactivate related user accounts
    const { error: usersError } = await updateUserProfiles(schoolId, "inactive");

    if (usersError) {
      console.error("Error deactivating users:", usersError);

      // Empty error object usually means no users found or operation completed
      const errorIsEmpty = Object.keys(usersError).length === 0;

      if (errorIsEmpty) {
        console.log("Empty error object - likely no users to deactivate, continuing...");
      } else {
        // Check if it's a critical error
        const continueAnyway = this.callbacks.showConfirm(
          `Warning: Could not deactivate all user accounts.\n\n` +
          `Error: ${JSON.stringify(usersError)}\n\n` +
          `This could mean:\n` +
          `• No users are associated with this school\n` +
          `• Database permission issues\n` +
          `• Missing table columns\n\n` +
          `Do you want to continue with school deletion anyway?`
        );

        if (!continueAnyway) {
          return {
            success: false,
            action: "cancelled",
            message: "Deletion cancelled for safety.",
            errors: [usersError],
          };
        }

        console.log("User chose to continue deletion despite user deactivation error");
        errors.push(usersError);
      }
    } else {
      console.log("Successfully deactivated associated user accounts");
    }

    // Then permanently delete the school
    const { error: deleteError } = await deleteSchool(schoolId);

    if (deleteError) {
      console.error("Error deleting school:", deleteError);
      errors.push(deleteError);
      return {
        success: false,
        action: "hard-delete",
        message: "Failed to delete school. Please try again.",
        errors,
      };
    }

    return {
      success: true,
      action: "hard-delete",
      message: `School "${schoolName}" has been permanently deleted.`,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// Factory function for easy usage
export function createSchoolDeletionService(callbacks: SchoolDeletionCallbacks) {
  return new SchoolDeletionService(callbacks);
}
