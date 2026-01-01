'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SchoolPerformance } from './actions'

interface SchoolPerformanceReportProps {
  data: SchoolPerformance[]
}

export default function SchoolPerformanceReport({ data }: SchoolPerformanceReportProps) {
  const sortedData = [...data].sort((a, b) => b.total_students - a.total_students)

  const totals = data.reduce(
    (acc, school) => ({
      students: acc.students + school.total_students,
      teachers: acc.teachers + school.total_teachers,
      classes: acc.classes + school.total_classes,
      activeUsers: acc.activeUsers + school.active_users,
      assessments: acc.assessments + school.assessment_count,
      announcements: acc.announcements + school.announcement_count,
    }),
    { students: 0, teachers: 0, classes: 0, activeUsers: 0, assessments: 0, announcements: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.students.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Teachers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.teachers.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.classes.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.activeUsers.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.assessments.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.announcements.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* School Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>School Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No schools found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School Name</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Teachers</TableHead>
                    <TableHead className="text-right">Classes</TableHead>
                    <TableHead className="text-right">Active Users</TableHead>
                    <TableHead className="text-right">Assessments</TableHead>
                    <TableHead className="text-right">Announcements</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((school) => (
                    <TableRow key={school.school_id}>
                      <TableCell className="font-medium">{school.school_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={school.status === 'active' ? 'default' : 'secondary'}
                          className={
                            school.status === 'active'
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : ''
                          }
                        >
                          {school.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{school.total_students}</TableCell>
                      <TableCell className="text-right">{school.total_teachers}</TableCell>
                      <TableCell className="text-right">{school.total_classes}</TableCell>
                      <TableCell className="text-right">{school.active_users}</TableCell>
                      <TableCell className="text-right">{school.assessment_count}</TableCell>
                      <TableCell className="text-right">{school.announcement_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
