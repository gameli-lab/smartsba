"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Eye,
  MoreVertical,
  School as SchoolIcon,
  Users,
  GraduationCap,
  Phone,
  Mail,
  X,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import {
  updateSchoolStatus,
  updateUserProfiles,
  deleteSchool,
} from "@/lib/school-operations";
import { School } from "@/types";
import CreateSchoolForm from "@/components/schools/create-school-form";

interface SchoolWithStats extends School {
  student_count: number;
  teacher_count: number;
  class_count: number;
  last_active: string | null;
}

interface SchoolFilters {
  status: "all" | "active" | "inactive";
  search: string;
  dateRange: "all" | "last-week" | "last-month" | "last-year";
}

export default function SchoolsManagementPage() {
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SchoolFilters>({
    status: "all",
    search: "",
    dateRange: "all",
  });
  const [selectedSchool, setSelectedSchool] = useState<SchoolWithStats | null>(
    null
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch schools with statistics
  const fetchSchools = async () => {
    setLoading(true);
    try {
      const { data: schoolsData, error } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!schoolsData) return;

      // Calculate statistics for each school
      const schoolsWithStats = await Promise.all(
        schoolsData.map(async (school: School) => {
          // Get user counts for each role
          const { data: profiles, error: profilesError } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("school_id", school.id);

          if (profilesError) {
            console.error(
              "Error fetching profiles for school:",
              school.id,
              profilesError
            );
          }

          const studentCount =
            profiles?.filter((p: { role: string }) => p.role === "student")
              .length || 0;
          const teacherCount =
            profiles?.filter((p: { role: string }) => p.role === "teacher")
              .length || 0;

          // Get class count and last activity
          const [classResult, activityResult] = await Promise.all([
            supabase.from("classes").select("id").eq("school_id", school.id),
            supabase
              .from("user_profiles")
              .select("updated_at")
              .eq("school_id", school.id)
              .order("updated_at", { ascending: false })
              .limit(1),
          ]);

          const lastActiveRecord = activityResult.data?.[0] as
            | { updated_at?: string }
            | undefined;

          return {
            ...school,
            student_count: studentCount,
            teacher_count: teacherCount,
            class_count: classResult.data?.length || 0,
            last_active: lastActiveRecord?.updated_at || null,
          } as SchoolWithStats;
        })
      );

      setSchools(schoolsWithStats);
    } catch (error) {
      console.error("Error fetching schools:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
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

  // Pagination
  const totalPages = Math.ceil(filteredSchools.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSchools = filteredSchools.slice(
    startIndex,
    startIndex + itemsPerPage
  );

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

      console.log(
        `${action} school:`,
        schoolId,
        currentStatus,
        "->",
        newStatus
      );

      const { error } = await updateSchoolStatus(schoolId, newStatus);

      if (error) {
        console.error("Error updating school status:", error);
        alert(`Failed to ${action} school. Please try again.`);
        return;
      }

      // Update local state immediately for better UX
      setSchools((prev) =>
        prev.map((school) =>
          school.id === schoolId ? { ...school, status: newStatus } : school
        )
      );

      alert(`School ${action}d successfully!`);
    } catch (error) {
      console.error("Error updating school status:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    try {
      const choice = confirm(
        `What would you like to do with "${schoolName}"?\n\n` +
          `Click OK for SOFT DELETE (recommended - can be restored)\n` +
          `Click Cancel for PERMANENT DELETE (cannot be undone)`
      );

      if (choice) {
        // Soft delete - just deactivate
        console.log("Soft deleting school:", schoolId, schoolName);

        const { error } = await updateSchoolStatus(schoolId, "inactive");

        if (error) {
          console.error("Error soft deleting school:", error);
          alert("Failed to delete school. Please try again.");
          return;
        }

        // Update local state
        setSchools((prev) =>
          prev.map((school) =>
            school.id === schoolId
              ? { ...school, status: "inactive" as "active" | "inactive" }
              : school
          )
        );

        alert(
          `School "${schoolName}" has been deactivated (soft delete). You can reactivate it anytime.`
        );
      } else {
        // Hard delete - permanent
        const confirmation = prompt(
          `⚠️  PERMANENT DELETION WARNING!\n\n` +
            `This will permanently delete "${schoolName}" and:\n` +
            `• All school data\n` +
            `• Associated user accounts\n` +
            `• All academic records\n\n` +
            `This action CANNOT be undone!\n\n` +
            `Type "PERMANENTLY DELETE" to confirm:`
        );

        if (confirmation !== "PERMANENTLY DELETE") {
          alert("Deletion cancelled - confirmation text did not match.");
          return;
        }

        console.log("Permanently deleting school:", schoolId, schoolName);

        // First, try to deactivate related user accounts
        const { error: usersError } = await updateUserProfiles(
          schoolId,
          "inactive"
        );

        if (usersError) {
          console.error("Error deactivating users:", usersError);
          
          // Empty error object usually means no users found or operation completed
          const errorIsEmpty = Object.keys(usersError).length === 0;
          
          if (errorIsEmpty) {
            console.log("Empty error object - likely no users to deactivate, continuing...");
          } else {
            // Check if it's a critical error
            const continueAnyway = confirm(
              `Warning: Could not deactivate all user accounts.\n\n` +
              `Error: ${JSON.stringify(usersError)}\n\n` +
              `This could mean:\n` +
              `• No users are associated with this school\n` +
              `• Database permission issues\n` +
              `• Missing table columns\n\n` +
              `Do you want to continue with school deletion anyway?`
            );
            
            if (!continueAnyway) {
              alert("Deletion cancelled for safety.");
              return;
            }
            
            console.log("User chose to continue deletion despite user deactivation error");
          }
        } else {
          console.log("Successfully deactivated associated user accounts");
        }

        // Then permanently delete the school
        const { error: deleteError } = await deleteSchool(schoolId);

        if (deleteError) {
          console.error("Error deleting school:", deleteError);
          alert("Failed to delete school. Please try again.");
          return;
        }

        // Update local state
        setSchools((prev) => prev.filter((school) => school.id !== schoolId));

        alert(`School "${schoolName}" has been permanently deleted.`);
      }
    } catch (error) {
      console.error("Error deleting school:", error);
      alert("An error occurred while deleting the school.");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getLastActiveText = (lastActive: string | null) => {
    if (!lastActive) return "Never";

    const now = new Date();
    const activeDate = new Date(lastActive);
    const diffTime = now.getTime() - activeDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <SchoolIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schools.length}</div>
            <p className="text-xs text-muted-foreground">
              +
              {
                schools.filter((s) => {
                  const diffTime =
                    new Date().getTime() - new Date(s.created_at).getTime();
                  return diffTime < 30 * 24 * 60 * 60 * 1000;
                }).length
              }{" "}
              this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Schools
            </CardTitle>
            <SchoolIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {schools.filter((s) => s.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {(
                (schools.filter((s) => s.status === "active").length /
                  schools.length) *
                100
              ).toFixed(1)}
              % active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {schools.reduce((sum, school) => sum + school.student_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all schools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Teachers
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {schools.reduce((sum, school) => sum + school.teacher_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all schools</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search schools..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value: "all" | "active" | "inactive") =>
                  setFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Onboarded</label>
              <Select
                value={filters.dateRange}
                onValueChange={(
                  value: "all" | "last-week" | "last-month" | "last-year"
                ) => setFilters((prev) => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({ status: "all", search: "", dateRange: "all" })
                }
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>

          {(filters.search ||
            filters.status !== "all" ||
            filters.dateRange !== "all") && (
            <div className="text-sm text-muted-foreground">
              Showing {filteredSchools.length} of {schools.length} schools
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schools Table */}
      <Card>
        <CardHeader>
          <CardTitle>Schools List</CardTitle>
          <CardDescription>Manage all schools in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading schools...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Onboarded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSchools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{school.name}</div>
                          {school.motto && (
                            <div className="text-sm text-muted-foreground italic">
                              &quot;{school.motto}&quot;
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          {school.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {school.phone}
                            </div>
                          )}
                          {school.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {school.email}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            school.status === "active" ? "default" : "secondary"
                          }
                          className={
                            school.status === "active"
                              ? "bg-green-500 hover:bg-green-600"
                              : ""
                          }
                        >
                          {school.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <GraduationCap className="h-3 w-3" />
                            {school.student_count} students
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="h-3 w-3" />
                            {school.teacher_count} teachers
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {getLastActiveText(school.last_active)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {formatDate(school.created_at)}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSchool(school);
                                setShowDetails(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSchool(school);
                                setShowCreateForm(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit School
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusToggle(school.id, school.status)
                              }
                              className={
                                school.status === "active"
                                  ? "text-orange-600"
                                  : "text-green-600"
                              }
                            >
                              {school.status === "active" ? (
                                <>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Power className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                handleDeleteSchool(school.id, school.name)
                              }
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete School
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to{" "}
                    {Math.min(
                      startIndex + itemsPerPage,
                      filteredSchools.length
                    )}{" "}
                    of {filteredSchools.length} schools
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit School Dialog */}
      <CreateSchoolForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        school={selectedSchool || undefined}
        onSchoolCreated={fetchSchools}
      />

      {/* School Details Dialog - Will be implemented in next component */}
      {showDetails && selectedSchool && (
        <div>School Details Component Goes Here</div>
      )}
    </div>
  );
}
