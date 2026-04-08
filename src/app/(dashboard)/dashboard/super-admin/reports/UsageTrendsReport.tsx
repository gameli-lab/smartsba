'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TrendingUp, TrendingDown, Users, School, UserPlus, LogIn } from 'lucide-react'
import type { UsageTrend } from './actions'

interface UsageTrendsReportProps {
  data: UsageTrend[]
}

export default function UsageTrendsReport({ data }: UsageTrendsReportProps) {
  const latestData = data[data.length - 1]
  const previousData = data[data.length - 2]

  const calculateChange = (current: number, previous: number) => {
    if (!previous) return 0
    return ((current - previous) / previous) * 100
  }

  const totals = data.reduce(
    (acc, day) => ({
      activeUsers: acc.activeUsers + day.active_users,
      newSchools: acc.newSchools + day.new_schools,
      newUsers: acc.newUsers + day.new_users,
      totalLogins: acc.totalLogins + day.total_logins,
    }),
    { activeUsers: 0, newSchools: 0, newUsers: 0, totalLogins: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users Today</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestData?.active_users || 0}
            </div>
            {previousData && (
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {latestData.active_users > previousData.active_users ? (
                  <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                )}
                <span
                  className={
                    latestData.active_users > previousData.active_users
                      ? 'text-green-600'
                      : 'text-red-600'
                  }
                >
                  {Math.abs(calculateChange(latestData.active_users, previousData.active_users)).toFixed(1)}%
                </span>
                <span className="ml-1">from yesterday</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Schools</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.newSchools}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Users</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.newUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalLogins.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {Math.round(totals.totalLogins / (data.length || 1))} per day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trends Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Usage Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No usage data available
            </div>
          ) : (
            <div className="rounded-md border max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Active Users</TableHead>
                    <TableHead className="text-right">New Schools</TableHead>
                    <TableHead className="text-right">New Users</TableHead>
                    <TableHead className="text-right">Logins</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data].reverse().map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">
                        {new Date(day.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">{day.active_users}</TableCell>
                      <TableCell className="text-right">
                        {day.new_schools > 0 ? (
                          <span className="text-green-600 font-semibold">+{day.new_schools}</span>
                        ) : (
                          day.new_schools
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {day.new_users > 0 ? (
                          <span className="text-green-600 font-semibold">+{day.new_users}</span>
                        ) : (
                          day.new_users
                        )}
                      </TableCell>
                      <TableCell className="text-right">{day.total_logins}</TableCell>
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
