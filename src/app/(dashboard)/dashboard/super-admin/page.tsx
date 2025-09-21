import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { School, Users, BarChart3, Shield } from "lucide-react";

export default function SuperAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Super Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of all schools and system-wide statistics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">+3 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15,247</div>
            <p className="text-xs text-muted-foreground">
              +180 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Teachers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">892</div>
            <p className="text-xs text-muted-foreground">+12 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent School Activities</CardTitle>
            <CardDescription>Latest updates from schools</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Accra High School</p>
                <p className="text-xs text-muted-foreground">
                  Added 25 new students
                </p>
              </div>
              <Badge variant="secondary">2h ago</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Tema International School</p>
                <p className="text-xs text-muted-foreground">
                  Published term results
                </p>
              </div>
              <Badge variant="secondary">4h ago</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Kumasi Academy</p>
                <p className="text-xs text-muted-foreground">
                  System backup completed
                </p>
              </div>
              <Badge variant="secondary">6h ago</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
            <CardDescription>Performance and usage statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">API Response Time</span>
              <Badge variant="outline">120ms avg</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Database Queries/sec</span>
              <Badge variant="outline">45.2</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Active Sessions</span>
              <Badge variant="outline">1,247</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Storage Used</span>
              <Badge variant="outline">234 GB</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <button className="p-4 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <School className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">Add New School</p>
          </button>
          <button className="p-4 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">Manage Users</p>
          </button>
          <button className="p-4 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">View Analytics</p>
          </button>
          <button className="p-4 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Shield className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">System Settings</p>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
