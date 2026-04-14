"use client";

import { useState, useEffect } from "react";
import { Plus, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateSchoolForm from "@/components/schools/create-school-form";
import { SchoolsTable } from "@/components/schools/SchoolsTable";
import { SchoolsFilters } from "@/components/schools/SchoolsFilters";
import { SchoolsStats } from "@/components/schools/SchoolsStats";
import { SchoolDetailsDialog } from "@/components/schools/SchoolDetailsDialog";
import { useSchools, SchoolWithStats } from "@/hooks/useSchools";
import { useSchoolFilters } from "@/hooks/useSchoolFilters";
import { supabase } from "@/lib/supabase";
import { BulkOperationDialog } from "@/components/super-admin/BulkOperationDialog";
import { bulkActivateSchools, bulkDeactivateSchools, bulkDeleteSchools } from "../bulk-operations/actions";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/super-admin/ExportButton";
import { exportSchoolsToCSV } from "../exports/actions";
import { exportSchoolsToPDF } from "@/lib/pdf-export";
import { updateSchoolStatusWithEmail, deleteSchool } from "./actions";

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
  
  // Bulk selection state
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<Set<string>>(new Set());
  const [bulkOperation, setBulkOperation] = useState<'activate' | 'deactivate' | 'delete' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Get user session
  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const profileResponse = (await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()) as { data: { role: string } | null };
        if (profileResponse.data) {
          setUserRole(profileResponse.data.role);
        }
      }
    }
    getUser();
  }, []);


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

      const { error } = await updateSchoolStatusWithEmail(schoolId, newStatus);

      if (error) {
        console.error("Error updating school status:", error);
        alert(`Failed to ${action} school. Please try again.`);
        return;
      }

      // Update local state immediately for better UX
      updateSchoolInList(schoolId, {
        status: newStatus as "active" | "inactive",
      });
      alert(`School ${action}d successfully! Email notification sent to school admin.`);
    } catch (error) {
      console.error("Error updating school status:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`Are you sure you want to delete "${schoolName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await deleteSchool(schoolId);
      
      if (result.success) {
        removeSchoolFromList(schoolId);
        alert(result.message || `School "${schoolName}" deleted successfully`);
      } else {
        alert(`Failed to delete school: ${result.error}`);
      }
    } catch (error) {
      console.error("Error deleting school:", error);
      alert("An error occurred while deleting the school.");
    }
  };

  // Bulk selection handlers
  const toggleSchoolSelection = (schoolId: string) => {
    const newSet = new Set(selectedSchoolIds);
    if (newSet.has(schoolId)) {
      newSet.delete(schoolId);
    } else {
      newSet.add(schoolId);
    }
    setSelectedSchoolIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedSchoolIds.size === filteredSchools.length) {
      setSelectedSchoolIds(new Set());
    } else {
      setSelectedSchoolIds(new Set(filteredSchools.map((s) => s.id)));
    }
  };

  const clearSelection = () => {
    setSelectedSchoolIds(new Set());
  };

  const handleBulkOperation = async () => {
    if (!bulkOperation || !userId || !userRole) return { success: false, message: 'Not authenticated', successCount: 0, failureCount: selectedSchoolIds.size };

    const ids = Array.from(selectedSchoolIds);

    let result;
    if (bulkOperation === 'activate') {
      result = await bulkActivateSchools(ids, userId, userRole);
    } else if (bulkOperation === 'deactivate') {
      result = await bulkDeactivateSchools(ids, userId, userRole);
    } else if (bulkOperation === 'delete') {
      result = await bulkDeleteSchools(ids, userId, userRole);
    } else {
      return { success: false, message: 'Invalid operation', successCount: 0, failureCount: 0 };
    }

    // Refresh schools list after bulk operation
    await refreshSchools();
    clearSelection();

    return result;
  };

  const getSelectedSchoolsInfo = () => {
    return filteredSchools
      .filter((s) => selectedSchoolIds.has(s.id))
      .map((s) => ({ id: s.id, name: s.name }));
  };

  const handleExportCSV = async () => {
    if (!userId || !userRole) {
      alert('Not authenticated');
      return;
    }

    const result = await exportSchoolsToCSV(userId, userRole, {
      status: filters.status,
      search: filters.search,
      dateRange: filters.dateRange,
    });

    if (result.success && result.data && result.filename) {
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', result.filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert(result.error || 'Export failed');
    }
  };

  const handleExportPDF = async () => {
    const result = await exportSchoolsToPDF(filteredSchools, {
      status: filters.status,
      search: filters.search,
    });

    if (!result.success) {
      alert(result.error || 'Export failed');
    }
  };

  return (
    <div className="space-y-6 overflow-x-clip">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Schools Management
          </h1>
          <p className="text-muted-foreground">
            Manage all schools in the system. Total: {schools.length} schools
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <ExportButton
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={loading}
          />
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New School
          </Button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedSchoolIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-4 bg-muted rounded-lg border">
          <Badge variant="secondary" className="text-sm">
            {selectedSchoolIds.size} selected
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkOperation('activate')}
          >
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkOperation('deactivate')}
          >
            Deactivate
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkOperation('delete')}
          >
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <SchoolsStats schools={schools} />

      {/* Filters */}
      <SchoolsFilters filters={filters} onChange={updateFilter} />

      {/* Select All Checkbox */}
      {filteredSchools.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className="gap-2"
          >
            {selectedSchoolIds.size === filteredSchools.length ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {selectedSchoolIds.size === filteredSchools.length ? 'Deselect All' : 'Select All'}
          </Button>
          {selectedSchoolIds.size > 0 && selectedSchoolIds.size < filteredSchools.length && (
            <span className="text-sm text-muted-foreground">
              {selectedSchoolIds.size} of {filteredSchools.length} selected
            </span>
          )}
        </div>
      )}

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
          selectedSchoolIds={selectedSchoolIds}
          onToggleSelection={toggleSchoolSelection}
        />
      )}

      {/* Create/Edit School Dialog */}
      <CreateSchoolForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        school={selectedSchool || undefined}
        onSchoolCreated={refreshSchools}
      />

      {/* School Details Dialog */}
      <SchoolDetailsDialog
        school={selectedSchool}
        open={showDetails}
        onOpenChange={setShowDetails}
      />

      {/* Bulk Operation Dialog */}
      {bulkOperation && (
        <BulkOperationDialog
          open={bulkOperation !== null}
          onOpenChange={(open) => !open && setBulkOperation(null)}
          operation={bulkOperation}
          entityType="school"
          selectedCount={selectedSchoolIds.size}
          selectedItems={getSelectedSchoolsInfo()}
          onConfirm={handleBulkOperation}
        />
      )}
    </div>
  );
}
