import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  BookOpen,
  FileText,
  Calendar,
  CheckSquare,
  PlusCircle,
} from "lucide-react";

export default function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your classes, enter scores, and track student progress
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">Across 3 classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              Mathematics & Sciences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Scores Entered
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89%</div>
            <p className="text-xs text-muted-foreground">This term</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Attendance Rate
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.5%</div>
            <p className="text-xs text-muted-foreground">Class average</p>
          </CardContent>
        </Card>
      </div>

      {/* My Classes */}
      <Card>
        <CardHeader>
          <CardTitle>My Classes</CardTitle>
          <CardDescription>Classes and subjects you teach</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">JHS 2A</h3>
                <Badge variant="secondary">Class Teacher</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">42 students</p>
              <div className="space-y-1">
                <p className="text-sm">Mathematics</p>
                <p className="text-sm">Integrated Science</p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">JHS 1B</h3>
                <Badge variant="outline">Subject Teacher</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">38 students</p>
              <div className="space-y-1">
                <p className="text-sm">Mathematics</p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">JHS 3A</h3>
                <Badge variant="outline">Subject Teacher</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">47 students</p>
              <div className="space-y-1">
                <p className="text-sm">Mathematics</p>
                <p className="text-sm">Physics</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common teaching tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start">
              <PlusCircle className="mr-2 h-4 w-4" />
              Enter Scores
            </Button>
            <Button variant="outline" className="justify-start">
              <CheckSquare className="mr-2 h-4 w-4" />
              Mark Attendance
            </Button>
            <Button variant="outline" className="justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Generate Class Report
            </Button>
            <Button variant="outline" className="justify-start">
              <Users className="mr-2 h-4 w-4" />
              View Student Progress
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
            <CardDescription>Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">
                  CA Scores - JHS 2A Mathematics
                </p>
                <p className="text-xs text-muted-foreground">
                  Due: Nov 15, 2024
                </p>
              </div>
              <Badge variant="secondary">Pending</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Attendance - Week 8</p>
                <p className="text-xs text-muted-foreground">Due: Today</p>
              </div>
              <Badge variant="default">Due</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Class Remarks - JHS 2A</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <Badge variant="secondary">Done</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Class Performance Summary</CardTitle>
          <CardDescription>Latest assessment results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">JHS 2A - Mathematics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Class Average</span>
                  <span className="font-medium">78.5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Highest Score</span>
                  <span className="font-medium">95%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Pass Rate</span>
                  <span className="font-medium">89%</span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">JHS 1B - Mathematics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Class Average</span>
                  <span className="font-medium">82.1%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Highest Score</span>
                  <span className="font-medium">98%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Pass Rate</span>
                  <span className="font-medium">92%</span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">JHS 3A - Physics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Class Average</span>
                  <span className="font-medium">75.3%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Highest Score</span>
                  <span className="font-medium">91%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Pass Rate</span>
                  <span className="font-medium">85%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
