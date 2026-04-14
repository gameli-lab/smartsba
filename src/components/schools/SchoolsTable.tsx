import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreVertical, Edit, Eye, Power, PowerOff, Trash2 } from "lucide-react";
import { SchoolWithStats } from "@/hooks/useSchools";

interface SchoolsTableProps {
  schools: SchoolWithStats[];
  currentPage: number;
  itemsPerPage: number;
  onSelectSchool: (school: SchoolWithStats) => void;
  onEditSchool: (school: SchoolWithStats) => void;
  onViewDetails: (school: SchoolWithStats) => void;
  onToggleStatus: (schoolId: string, currentStatus: string) => void;
  onDeleteSchool: (schoolId: string, schoolName: string) => void;
  onPageChange: (page: number) => void;
  selectedSchoolIds?: Set<string>;
  onToggleSelection?: (schoolId: string) => void;
}

export function SchoolsTable({
  schools,
  currentPage,
  itemsPerPage,
  onSelectSchool,
  onEditSchool,
  onViewDetails,
  onToggleStatus,
  onDeleteSchool,
  onPageChange,
  selectedSchoolIds,
  onToggleSelection,
}: SchoolsTableProps) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSchools = schools.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(schools.length / itemsPerPage);

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
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            {onToggleSelection && <TableHead className="w-12"></TableHead>}
            <TableHead>School Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Students</TableHead>
            <TableHead>Teachers</TableHead>
            <TableHead>Classes</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSchools.map((school) => (
            <TableRow
              key={school.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectSchool(school)}
            >
              {onToggleSelection && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedSchoolIds?.has(school.id)}
                    onCheckedChange={() => onToggleSelection(school.id)}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium">{school.name}</TableCell>
              <TableCell>
                <Badge
                  variant={school.status === "active" ? "default" : "secondary"}
                >
                  {school.status}
                </Badge>
              </TableCell>
              <TableCell>{school.student_count}</TableCell>
              <TableCell>{school.teacher_count}</TableCell>
              <TableCell>{school.class_count}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {getLastActiveText(school.last_active)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(school.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDetails(school);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSchool(school);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit School
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStatus(school.id, school.status);
                      }}
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
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSchool(school.id, school.name);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to{" "}
            {Math.min(startIndex + itemsPerPage, schools.length)} of{" "}
            {schools.length} schools
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
