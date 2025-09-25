"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateSchoolStatus } from "@/lib/school-operations";
import CreateSchoolForm from "@/components/schools/create-school-form";
import { SchoolsTable } from "@/components/schools/SchoolsTable";
import { SchoolsFilters } from "@/components/schools/SchoolsFilters";
import { SchoolsStats } from "@/components/schools/SchoolsStats";
import { useSchools, SchoolWithStats } from "@/hooks/useSchools";
import { useSchoolFilters } from "@/hooks/useSchoolFilters";
import { createSchoolDeletionService } from "@/services/schoolDeletionService";

export default function SchoolsManagementPage() {
  // Custom hooks for state management
  const {
    schools,
    loading,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    refreshSchools,
    updateSchoolInList,
    removeSchoolFromList,
  } = useSchools();

  const { filters, updateFilter } = useSchoolFilters();

  // Local UI state
  const [selectedSchool, setSelectedSchool] = useState<SchoolWithStats | null>(
    null
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Create school deletion service with callbacks
  const deletionService = createSchoolDeletionService({
    showConfirm: (message: string) => confirm(message),
    showPrompt: (message: string) => prompt(message),
    showAlert: (message: string) => alert(message),
  });

  // Filter schools based on current filters
  const filteredSchools = schools.filter((school) => {
    // Status filter
    if (filters.status !== "all") {
      const isActive = school.status === "active";
      if (filters.status === "active" && !isActive) return false;
      if (filters.status === "inactive" && isActive) return false;
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = school.name.toLowerCase().includes(searchLower);
      const matchesEmail = school.email?.toLowerCase().includes(searchLower);
      const matchesPhone = school.phone?.includes(filters.search);
      if (!matchesName && !matchesEmail && !matchesPhone) return false;
    }

    // Date range filter
    if (filters.dateRange !== "all") {
      const createdAt = new Date(school.created_at);
      const now = new Date();
      const diffTime = now.getTime() - createdAt.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      switch (filters.dateRange) {
        case "last-week":
          if (diffDays > 7) return false;
          break;
        case "last-month":
          if (diffDays > 30) return false;
          break;
        case "last-year":
          if (diffDays > 365) return false;
          break;
      }
    }

    return true;
  });

  // Action handlers
  const handleStatusToggle = async (
    schoolId: string,
    currentStatus: string
  ) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const action = newStatus === "active" ? "activate" : "deactivate";

      if (!confirm(`Are you sure you want to ${action} this school?`)) {
        return;
      }

      const { error } = await updateSchoolStatus(schoolId, newStatus);

      if (error) {
        console.error("Error updating school status:", error);
        alert(`Failed to ${action} school. Please try again.`);
        return;
      }

      // Update local state immediately for better UX
      updateSchoolInList(schoolId, {
        status: newStatus as "active" | "inactive",
      });
      alert(`School ${action}d successfully!`);
    } catch (error) {
      console.error("Error updating school status:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    const result = await deletionService.deleteSchool(schoolId, schoolName);

    if (result.success) {
      if (result.action === "soft-delete") {
        updateSchoolInList(schoolId, { status: "inactive" });
      } else if (result.action === "hard-delete") {
        removeSchoolFromList(schoolId);
      }
    }

    // Always show the result message
    alert(result.message);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Schools Management
          </h1>
          <p className="text-muted-foreground">
            Manage all schools in the system. Total: {schools.length} schools
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New School
        </Button>
      </div>

      {/* Stats Cards */}
      <SchoolsStats schools={schools} />

      {/* Filters */}
      <SchoolsFilters filters={filters} onChange={updateFilter} />

      {/* Schools Table */}
      {loading ? (
        <div className="text-center py-8">Loading schools...</div>
      ) : (
        <SchoolsTable
          schools={filteredSchools}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onSelectSchool={setSelectedSchool}
          onEditSchool={(school) => {
            setSelectedSchool(school);
            setShowCreateForm(true);
          }}
          onViewDetails={(school) => {
            setSelectedSchool(school);
            setShowDetails(true);
          }}
          onToggleStatus={handleStatusToggle}
          onDeleteSchool={handleDeleteSchool}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Create/Edit School Dialog */}
      <CreateSchoolForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        school={selectedSchool || undefined}
        onSchoolCreated={refreshSchools}
      />

      {/* School Details Dialog - Will be implemented in next component */}
      {showDetails && selectedSchool && (
        <div>School Details Component Goes Here</div>
      )}
    </div>
  );
}
