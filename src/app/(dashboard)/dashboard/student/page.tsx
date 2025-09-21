import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Target, Calendar } from "lucide-react";

export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-muted-foreground">
          View your academic progress and results
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overall Average
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">84.7%</div>
            <p className="text-xs text-muted-foreground">
              +2.1% from last term
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Class Position
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3rd</div>
            <p className="text-xs text-muted-foreground">Out of 42 students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">96%</div>
            <p className="text-xs text-muted-foreground">48/50 days present</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Subject</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Mathematics</div>
            <p className="text-xs text-muted-foreground">92% average</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle>Latest Results - Term 1, 2024/2025</CardTitle>
          <CardDescription>Your performance in all subjects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                subject: "Mathematics",
                ca: 28,
                exam: 64,
                total: 92,
                grade: "A",
                position: 2,
              },
              {
                subject: "English Language",
                ca: 26,
                exam: 62,
                total: 88,
                grade: "A",
                position: 1,
              },
              {
                subject: "Integrated Science",
                ca: 25,
                exam: 58,
                total: 83,
                grade: "A",
                position: 4,
              },
              {
                subject: "Social Studies",
                ca: 24,
                exam: 56,
                total: 80,
                grade: "A",
                position: 5,
              },
              {
                subject: "Ghanaian Language",
                ca: 23,
                exam: 54,
                total: 77,
                grade: "B",
                position: 8,
              },
              {
                subject: "Religious Studies",
                ca: 22,
                exam: 60,
                total: 82,
                grade: "A",
                position: 3,
              },
            ].map((result) => (
              <div
                key={result.subject}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <h3 className="font-medium">{result.subject}</h3>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                    <span>CA: {result.ca}/30</span>
                    <span>Exam: {result.exam}/70</span>
                    <span>Total: {result.total}/100</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge
                    variant={result.grade === "A" ? "default" : "secondary"}
                  >
                    Grade {result.grade}
                  </Badge>
                  <div className="text-sm">
                    <span className="font-medium">
                      Position: {result.position}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Trend */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Academic Summary</CardTitle>
            <CardDescription>Your overall performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Total Score</span>
              <span className="font-bold">502/600</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Average Score</span>
              <span className="font-bold">83.7%</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Aggregate</span>
              <span className="font-bold">12</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Class Position</span>
              <span className="font-bold">3rd / 42</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Important dates and deadlines</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">Mid-term Break</p>
                <p className="text-xs text-muted-foreground">Nov 20 - Nov 24</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">End of Term Exams</p>
                <p className="text-xs text-muted-foreground">Dec 1 - Dec 12</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">Term Ends</p>
                <p className="text-xs text-muted-foreground">Dec 15, 2024</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
