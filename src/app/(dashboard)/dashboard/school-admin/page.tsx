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
  Bell,
  TrendingUp,
} from "lucide-react";

export default function SchoolAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">School Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your school&apos;s academic activities and monitor performance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">847</div>
            <p className="text-xs text-muted-foreground">+12 from last term</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Teachers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">2 new this term</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">Across 8 levels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Performance
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78.5%</div>
            <p className="text-xs text-muted-foreground">
              +2.3% from last term
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Session Info */}
      <Card>
        <CardHeader>
          <CardTitle>Current Academic Session</CardTitle>
          <CardDescription>2024/2025 Academic Year - Term 1</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Term Started</p>
              <p className="text-2xl font-bold">Sep 10, 2024</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Term Ends</p>
              <p className="text-2xl font-bold">Dec 15, 2024</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Progress</p>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full w-1/3"></div>
                </div>
                <span className="text-sm">33%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities & Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest school updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Math scores entered</p>
                <p className="text-xs text-muted-foreground">
                  JHS 2 - Mr. Asante
                </p>
              </div>
              <Badge variant="secondary">1h ago</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">New student enrolled</p>
                <p className="text-xs text-muted-foreground">Primary 3B</p>
              </div>
              <Badge variant="secondary">3h ago</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Report cards generated</p>
                <p className="text-xs text-muted-foreground">Primary 6A & 6B</p>
              </div>
              <Badge variant="secondary">5h ago</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start">
              <Users className="mr-2 h-4 w-4" />
              Add New Student
            </Button>
            <Button variant="outline" className="justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Generate Reports
            </Button>
            <Button variant="outline" className="justify-start">
              <Bell className="mr-2 h-4 w-4" />
              Send Announcement
            </Button>
            <Button variant="outline" className="justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              Manage Sessions
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Class Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Class Performance Overview</CardTitle>
          <CardDescription>
            Average scores by class for current term
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { class: "Primary 1", average: 85.2, students: 42 },
              { class: "Primary 2", average: 82.7, students: 38 },
              { class: "JHS 1", average: 78.4, students: 45 },
              { class: "JHS 3", average: 79.1, students: 41 },
            ].map((classData) => (
              <div key={classData.class} className="p-4 border rounded-lg">
                <h3 className="font-semibold">{classData.class}</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {classData.average}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {classData.students} students
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
