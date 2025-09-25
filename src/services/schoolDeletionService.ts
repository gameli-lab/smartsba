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
      // First ask if they want to proceed with deletion at all
      const proceedWithDeletion = this.callbacks.showConfirm(
        `Are you sure you want to delete "${schoolName}"?`
      );
      
      if (!proceedWithDeletion) {
        return {
          success: false,
          action: "cancelled",
          message: "Deletion cancelled by user."
        };
      }
      
      // Then ask for deletion type
      const usePermanentDelete = this.callbacks.showConfirm(
        `Choose deletion type for "${schoolName}":\n\n` +
        `Click OK for PERMANENT DELETE (cannot be undone)\n` +
        `Click Cancel for SOFT DELETE (recommended - can be restored)`
      );
      
      if (usePermanentDelete) {
        // Hard delete - permanent
        return await this.performHardDelete(schoolId, schoolName);
      } else {
        // Soft delete - just deactivate
        return await this.performSoftDelete(schoolId, schoolName);
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
    const usersResult = await updateUserProfiles(schoolId, "inactive");
    
    // Log the full response for debugging and transparency
    console.log("User deactivation result:", {
      error: usersResult.error,
      data: usersResult.data,
      schoolId,
      timestamp: new Date().toISOString()
    });

    // Check for explicit success/failure based on the OperationResult interface
    if (usersResult.error !== null) {
      // Explicit error occurred during user deactivation
      console.error("Error deactivating users:", usersResult.error);
      
      const continueAnyway = this.callbacks.showConfirm(
        `Warning: Could not deactivate all user accounts.\n\n` +
        `Error: ${usersResult.error.message}\n\n` +
        `This could mean:\n` +
        `• Database permission issues\n` +
        `• Network connectivity problems\n` +
        `• Missing table columns or constraints\n\n` +
        `Do you want to continue with school deletion anyway?`
      );

      if (!continueAnyway) {
        return {
          success: false,
          action: "cancelled",
          message: "Deletion cancelled for safety due to user deactivation failure.",
          errors: [usersResult.error],
        };
      }

      console.log("User chose to continue deletion despite user deactivation error");
      errors.push(usersResult.error);
    } else {
      // Explicit success: error is null
      console.log("User deactivation completed successfully", {
        result: "success",
        schoolId,
        data: usersResult.data,
        message: usersResult.data === null ? "No users found to deactivate" : "Users successfully deactivated"
      });
    }

    // Then permanently delete the school
    const deleteResult = await deleteSchool(schoolId);
    
    // Log the full response for debugging and transparency
    console.log("School deletion result:", {
      error: deleteResult.error,
      data: deleteResult.data,
      schoolId,
      timestamp: new Date().toISOString()
    });

    if (deleteResult.error !== null) {
      console.error("Error deleting school:", deleteResult.error);
      errors.push(deleteResult.error);
      return {
        success: false,
        action: "hard-delete",
        message: `Failed to delete school "${schoolName}": ${deleteResult.error.message}`,
        errors,
      };
    }

    console.log("School deletion completed successfully", {
      result: "success",
      schoolId,
      schoolName,
      data: deleteResult.data
    });

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
