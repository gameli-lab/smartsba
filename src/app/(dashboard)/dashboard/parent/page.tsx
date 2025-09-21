import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, TrendingUp, FileText, Calendar } from "lucide-react";

export default function ParentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parent Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your ward&apos;s academic progress and school activities
        </p>
      </div>

      {/* Ward Overview */}
      <Card>
        <CardHeader>
          <CardTitle>My Ward</CardTitle>
          <CardDescription>
            Student information and quick access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 p-4 border rounded-lg">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Kwame Asante</h3>
              <p className="text-sm text-muted-foreground">
                JHS 2A • Admission No: STU2024001
              </p>
              <p className="text-sm text-muted-foreground">
                Class Teacher: Mrs. Osei
              </p>
            </div>
            <div className="flex flex-col space-y-2">
              <Button size="sm" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                View Report
              </Button>
              <Badge variant="secondary">Current Student</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
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
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Conduct</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Excellent</div>
            <p className="text-xs text-muted-foreground">Well behaved</p>
          </CardContent>
        </Card>
      </div>

      {/* Latest Results */}
      <Card>
        <CardHeader>
          <CardTitle>Latest Term Results</CardTitle>
          <CardDescription>Term 1, 2024/2025 Academic Year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                subject: "Mathematics",
                total: 92,
                grade: "A",
                position: 2,
                remark: "Excellent work",
              },
              {
                subject: "English Language",
                total: 88,
                grade: "A",
                position: 1,
                remark: "Outstanding performance",
              },
              {
                subject: "Integrated Science",
                total: 83,
                grade: "A",
                position: 4,
                remark: "Very good",
              },
              {
                subject: "Social Studies",
                total: 80,
                grade: "A",
                position: 5,
                remark: "Good effort",
              },
              {
                subject: "Ghanaian Language",
                total: 77,
                grade: "B",
                position: 8,
                remark: "Satisfactory",
              },
            ].map((result) => (
              <div
                key={result.subject}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{result.subject}</h4>
                  <p className="text-sm text-muted-foreground">
                    {result.remark}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <p className="text-lg font-bold">{result.total}%</p>
                    <Badge
                      variant={result.grade === "A" ? "default" : "secondary"}
                    >
                      {result.grade}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Pos: {result.position}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Teacher's Remarks and Important Updates */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Class Teacher&apos;s Remark</CardTitle>
            <CardDescription>Feedback from Mrs. Osei</CardDescription>
          </CardHeader>
          <CardContent>
            <blockquote className="italic text-gray-700 border-l-4 border-blue-500 pl-4">
              &quot;Kwame has shown remarkable improvement this term. His
              dedication to his studies is commendable, and he participates
              actively in class discussions. He should continue to work hard and
              maintain his excellent attitude towards learning.&quot;
            </blockquote>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>
                <strong>Promotion Status:</strong>{" "}
                <Badge variant="outline" className="text-green-600">
                  Promoted to JHS 3
                </Badge>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
            <CardDescription>Important updates from school</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium">Parent-Teacher Meeting</p>
                <p className="text-xs text-muted-foreground">
                  November 30, 2024 at 2:00 PM
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium">End of Term Activities</p>
                <p className="text-xs text-muted-foreground">
                  Sports day and graduation ceremony
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium">School Fees Reminder</p>
                <p className="text-xs text-muted-foreground">
                  Next term fees due by January 5
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
