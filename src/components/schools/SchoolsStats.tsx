import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { School as SchoolIcon, Users, GraduationCap } from "lucide-react";
import { SchoolWithStats } from "@/hooks/useSchools";

interface SchoolsStatsProps {
  schools: SchoolWithStats[];
}

export function SchoolsStats({ schools }: SchoolsStatsProps) {
  const totalSchools = schools.length;
  const activeSchools = schools.filter(
    (school) => school.status === "active"
  ).length;
  const totalStudents = schools.reduce(
    (sum, school) => sum + school.student_count,
    0
  );
  const totalTeachers = schools.reduce(
    (sum, school) => sum + school.teacher_count,
    0
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
          <SchoolIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSchools}</div>
          <p className="text-xs text-muted-foreground">
            {activeSchools} active, {totalSchools - activeSchools} inactive
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Schools</CardTitle>
          <SchoolIcon className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeSchools}</div>
          <p className="text-xs text-muted-foreground">
            {totalSchools > 0
              ? Math.round((activeSchools / totalSchools) * 100)
              : 0}
            % of total
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Students</CardTitle>
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalStudents}</div>
          <p className="text-xs text-muted-foreground">
            Avg{" "}
            {totalSchools > 0 ? Math.round(totalStudents / totalSchools) : 0}{" "}
            per school
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalTeachers}</div>
          <p className="text-xs text-muted-foreground">
            Avg{" "}
            {totalSchools > 0 ? Math.round(totalTeachers / totalSchools) : 0}{" "}
            per school
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
