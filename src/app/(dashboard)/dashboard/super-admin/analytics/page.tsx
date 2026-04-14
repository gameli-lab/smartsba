"use client"

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, School, Users, UserCheck, GraduationCap, AlertTriangle, Calendar } from 'lucide-react'
import { ExportButton } from '@/components/super-admin/ExportButton'
import { exportAnalyticsToCSV } from '../exports/actions'
import { exportAnalyticsToPDF } from '@/lib/pdf-export'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AnalyticsData {
  totalSchools: number
  activeSchools: number
  inactiveSchools: number
  usersByRole: {
    school_admin: number
    teacher: number
    student: number
    parent: number
  }
  recentSchools: Array<{
    id: string
    name: string
    created_at: string
    status: string
  }>
  inactiveSchoolsList: Array<{
    id: string
    name: string
    status: string
  }>
  growthTrends: {
    schoolsThisMonth: number
    schoolsLastMonth: number
    usersThisMonth: number
    usersLastMonth: number
  }
}

interface TimeSeriesPoint {
  date: string
  schools: number
  users: number
  activity: number
}

interface RoleDistribution {
  role: string
  count: number
}

interface ActivityPattern {
  time: string
  count: number
}

interface CreatedAtRow {
  created_at: string
}

interface RoleRow {
  role: string | null
}

export default function SuperAdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([])
  const [roleDistribution, setRoleDistribution] = useState<RoleDistribution[]>([])
  const [activityPattern, setActivityPattern] = useState<ActivityPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'custom'>('30')
  const [startDate] = useState<string>('')
  const [endDate] = useState<string>('')

  const getDateRange = useCallback(() => {
    const end = new Date()
    const start = new Date()

    switch (dateRange) {
      case '7':
        start.setDate(end.getDate() - 7)
        break
      case '30':
        start.setDate(end.getDate() - 30)
        break
      case '90':
        start.setDate(end.getDate() - 90)
        break
      case 'custom':
        return {
          start: new Date(startDate),
          end: new Date(endDate),
        }
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  }, [dateRange, endDate, startDate])

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch total schools
      const { count: totalSchools } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true })

      const { count: activeSchools } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      const { count: inactiveSchools } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'inactive')

      // Fetch users by role
      const { count: schoolAdmins } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'school_admin')

      const { count: teachers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher')

      const { count: students } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')

      const { count: parents } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'parent')

      // Fetch recently created schools (last 10)
      const { data: recentSchools } = await supabase
        .from('schools')
        .select('id, name, created_at, status')
        .order('created_at', { ascending: false })
        .limit(10)

      // Fetch inactive schools
      const { data: inactiveSchoolsList } = await supabase
        .from('schools')
        .select('id, name, status')
        .eq('status', 'inactive')
        .limit(10)

      // Calculate growth trends (schools this month vs last month)
      const now = new Date()
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

      const { count: schoolsThisMonth } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfThisMonth.toISOString())

      const { count: schoolsLastMonth } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfLastMonth.toISOString())
        .lt('created_at', firstOfThisMonth.toISOString())

      const { count: usersThisMonth } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfThisMonth.toISOString())

      const { count: usersLastMonth } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfLastMonth.toISOString())
        .lt('created_at', firstOfThisMonth.toISOString())

      setData({
        totalSchools: totalSchools || 0,
        activeSchools: activeSchools || 0,
        inactiveSchools: inactiveSchools || 0,
        usersByRole: {
          school_admin: schoolAdmins || 0,
          teacher: teachers || 0,
          student: students || 0,
          parent: parents || 0,
        },
        recentSchools: (recentSchools || []) as Array<{
          id: string
          name: string
          created_at: string
          status: string
        }>,
        inactiveSchoolsList: (inactiveSchoolsList || []) as Array<{
          id: string
          name: string
          status: string
        }>,
        growthTrends: {
          schoolsThisMonth: schoolsThisMonth || 0,
          schoolsLastMonth: schoolsLastMonth || 0,
          usersThisMonth: usersThisMonth || 0,
          usersLastMonth: usersLastMonth || 0,
        },
      })
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTimeSeriesData = useCallback(async () => {
    setChartsLoading(true)
    try {
      const range = getDateRange()
      const startStr = typeof range.start === 'string' ? range.start : range.start.toISOString().split('T')[0]
      const endStr = typeof range.end === 'string' ? range.end : range.end.toISOString().split('T')[0]

      // Generate date array for the range
      const dates: string[] = []
      const schoolsByDate: { [key: string]: number } = {}
      const usersByDate: { [key: string]: number } = {}
      const activityByDate: { [key: string]: number } = {}

      const start = new Date(startStr)
      const end = new Date(endStr)

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        dates.push(dateStr)
        schoolsByDate[dateStr] = 0
        usersByDate[dateStr] = 0
        activityByDate[dateStr] = 0
      }

      // Fetch schools created in range
      const { data: schools } = await supabase
        .from('schools')
        .select('id, created_at')
        .gte('created_at', startStr + 'T00:00:00')
        .lte('created_at', endStr + 'T23:59:59')

      if (schools) {
        schools.forEach((school) => {
          const createdAt = (school as CreatedAtRow).created_at
          if (!createdAt) return
          const dateStr = createdAt.split('T')[0]
          if (schoolsByDate[dateStr] !== undefined) {
            schoolsByDate[dateStr]++
          }
        })
      }

      // Fetch users created in range
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, created_at')
        .gte('created_at', startStr + 'T00:00:00')
        .lte('created_at', endStr + 'T23:59:59')

      if (users) {
        users.forEach((user) => {
          const createdAt = (user as CreatedAtRow).created_at
          if (!createdAt) return
          const dateStr = createdAt.split('T')[0]
          if (usersByDate[dateStr] !== undefined) {
            usersByDate[dateStr]++
          }
        })
      }

      // Fetch activity logs for the range
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('id, created_at')
        .gte('created_at', startStr + 'T00:00:00')
        .lte('created_at', endStr + 'T23:59:59')

      if (logs) {
        logs.forEach((log) => {
          const createdAt = (log as CreatedAtRow).created_at
          if (!createdAt) return
          const dateStr = createdAt.split('T')[0]
          if (activityByDate[dateStr] !== undefined) {
            activityByDate[dateStr]++
          }
        })
      }

      // Build time series
      const series: TimeSeriesPoint[] = dates.map((date) => ({
        date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        schools: schoolsByDate[date],
        users: usersByDate[date],
        activity: activityByDate[date],
      }))

      setTimeSeriesData(series)
    } catch (error) {
      console.error('Error fetching time series data:', error)
    } finally {
      setChartsLoading(false)
    }
  }, [getDateRange])

  const fetchRoleDistribution = useCallback(async () => {
    try {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('role')

      if (profiles) {
        const distribution: { [key: string]: number } = {
          super_admin: 0,
          school_admin: 0,
          teacher: 0,
          student: 0,
          parent: 0,
        }

        profiles.forEach((profile) => {
          const role = (profile as RoleRow).role
          if (role && distribution[role] !== undefined) {
            distribution[role]++
          }
        })

        const distArray: RoleDistribution[] = Object.entries(distribution)
          .map(([role, count]) => ({
            role: role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            count,
          }))
          .filter((d) => d.count > 0)

        setRoleDistribution(distArray)
      }
    } catch (error) {
      console.error('Error fetching role distribution:', error)
    }
  }, [])

  const fetchActivityPattern = useCallback(async () => {
    try {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('id, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (logs) {
        const activityByHour: { [key: string]: number } = {}

        logs.forEach((log) => {
          const createdAt = (log as CreatedAtRow).created_at
          if (!createdAt) return
          const hour = new Date(createdAt).getHours()
          const timeStr = `${hour}:00`
          activityByHour[timeStr] = (activityByHour[timeStr] || 0) + 1
        })

        const pattern: ActivityPattern[] = Array.from({ length: 24 }, (_, i) => ({
          time: `${i}:00`,
          count: activityByHour[`${i}:00`] || 0,
        }))

        setActivityPattern(pattern)
      }
    } catch (error) {
      console.error('Error fetching activity pattern:', error)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        const profileResponse = (await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()) as { data: { role: string } | null }
        if (profileResponse.data) {
          setUserRole(profileResponse.data.role)
        }
      }
      fetchAnalytics()
    }
    init()
  }, [fetchAnalytics])

  useEffect(() => {
    fetchTimeSeriesData()
    fetchRoleDistribution()
    fetchActivityPattern()
  }, [fetchActivityPattern, fetchRoleDistribution, fetchTimeSeriesData])

  const handleExportCSV = async () => {
    if (!userId || !userRole) {
      alert('Not authenticated')
      return
    }

    const result = await exportAnalyticsToCSV(userId, userRole)

    if (result.success && result.data && result.filename) {
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', result.filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      alert(result.error || 'Export failed')
    }
  }

  const handleExportPDF = async () => {
    if (!data) return

    const result = await exportAnalyticsToPDF({
      totalSchools: data.totalSchools,
      activeSchools: data.activeSchools,
      inactiveSchools: data.inactiveSchools,
      usersByRole: data.usersByRole,
      recentSchools: data.recentSchools,
    })

    if (!result.success) {
      alert(result.error || 'Export failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-red-50 p-6 text-red-800">
        <h2 className="text-lg font-semibold">Error</h2>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    )
  }

  if (!data) {
    return <div>No data available</div>
  }

  const schoolGrowthPercent =
    data.growthTrends.schoolsLastMonth > 0
      ? ((data.growthTrends.schoolsThisMonth - data.growthTrends.schoolsLastMonth) /
          data.growthTrends.schoolsLastMonth) *
        100
      : 0

  const userGrowthPercent =
    data.growthTrends.usersLastMonth > 0
      ? ((data.growthTrends.usersThisMonth - data.growthTrends.usersLastMonth) /
          data.growthTrends.usersLastMonth) *
        100
      : 0

  return (
    <div className="space-y-6 p-4 text-gray-900 dark:text-gray-100 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 sm:text-3xl">Platform Analytics</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">System-wide metrics across all schools</p>
        </div>
        <ExportButton
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          disabled={loading}
        />
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <CardTitle>Date Range Selection</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                variant={dateRange === '7' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('7')}
              >
                Last 7 days
              </Button>
              <Button
                variant={dateRange === '30' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('30')}
              >
                Last 30 days
              </Button>
              <Button
                variant={dateRange === '90' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('90')}
              >
                Last 90 days
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Time Series Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Schools, users, and activity over time</CardDescription>
        </CardHeader>
        <CardContent>
          {chartsLoading ? (
            <div className="h-80 bg-gray-100 rounded animate-pulse" />
          ) : timeSeriesData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No data available for selected range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="schools"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Schools"
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  name="Users"
                />
                <Line
                  type="monotone"
                  dataKey="activity"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Activity Events"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Role Distribution & Activity Pattern */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>User Distribution by Role</CardTitle>
            <CardDescription>Current platform composition</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <div className="h-80 bg-gray-100 rounded animate-pulse" />
            ) : roleDistribution.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-gray-500">
                No user data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roleDistribution} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="role"
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" name="User Count" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Activity Pattern by Hour */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Pattern (Last 7 Days)</CardTitle>
            <CardDescription>Platform activity by hour</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <div className="h-80 rounded bg-gray-100 animate-pulse dark:bg-gray-800" />
            ) : activityPattern.length === 0 ? (
                <div className="flex h-80 items-center justify-center text-gray-500 dark:text-gray-400">
                No activity data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityPattern} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="time"
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#f59e0b" name="Events" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Schools</CardTitle>
            <School className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSchools}</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
                {data.activeSchools} Active
              </Badge>
              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                {data.inactiveSchools} Inactive
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Schools Created</CardTitle>
            <School className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.growthTrends.schoolsThisMonth || 0}</div>
            <p className="mt-1 text-xs text-gray-500">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.usersByRole.teacher || 0}</div>
            <p className="mt-1 text-xs text-gray-500">Teaching staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Students</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.usersByRole.student || 0}</div>
            <p className="mt-1 text-xs text-gray-500">
              + {data?.usersByRole.parent || 0} Parents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overview Cards (Old) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" style={{ display: 'none' }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Schools</CardTitle>
            <School className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSchools}</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {data.activeSchools} Active
              </Badge>
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                {data.inactiveSchools} Inactive
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">School Admins</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.school_admin}</div>
            <p className="mt-1 text-xs text-gray-500">System administrators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.teacher}</div>
            <p className="mt-1 text-xs text-gray-500">Teaching staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Students</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.student}</div>
            <p className="mt-1 text-xs text-gray-500">
              + {data.usersByRole.parent} Parents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" style={{ display: 'none' }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Schools</CardTitle>
            <School className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSchools}</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {data.activeSchools} Active
              </Badge>
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                {data.inactiveSchools} Inactive
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">School Admins</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.school_admin}</div>
            <p className="mt-1 text-xs text-gray-500">System administrators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.teacher}</div>
            <p className="mt-1 text-xs text-gray-500">Teaching staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Students</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.student}</div>
            <p className="mt-1 text-xs text-gray-500">
              + {data.usersByRole.parent} Parents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Schools</CardTitle>
            <School className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSchools}</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {data.activeSchools} Active
              </Badge>
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                {data.inactiveSchools} Inactive
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">School Admins</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.school_admin}</div>
            <p className="mt-1 text-xs text-gray-500">System administrators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.teacher}</div>
            <p className="mt-1 text-xs text-gray-500">Teaching staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Students</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersByRole.student}</div>
            <p className="mt-1 text-xs text-gray-500">
              + {data.usersByRole.parent} Parents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Trends */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>School Growth</CardTitle>
            <CardDescription>Monthly comparison</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">This Month</span>
              <span className="text-lg font-semibold">{data.growthTrends.schoolsThisMonth}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Month</span>
              <span className="text-lg font-semibold">{data.growthTrends.schoolsLastMonth}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              {schoolGrowthPercent >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  schoolGrowthPercent >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {schoolGrowthPercent >= 0 ? '+' : ''}
                {schoolGrowthPercent.toFixed(1)}% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>Monthly comparison</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">This Month</span>
              <span className="text-lg font-semibold">{data.growthTrends.usersThisMonth}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Month</span>
              <span className="text-lg font-semibold">{data.growthTrends.usersLastMonth}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              {userGrowthPercent >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  userGrowthPercent >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {userGrowthPercent >= 0 ? '+' : ''}
                {userGrowthPercent.toFixed(1)}% from last month
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recently Active Schools */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Created Schools</CardTitle>
          <CardDescription>Latest 10 schools added to the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentSchools.length === 0 ? (
            <p className="text-sm text-gray-500">No schools created yet</p>
          ) : (
            <div className="space-y-2">
              {data.recentSchools.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{school.name}</p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(school.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={school.status === 'active' ? 'default' : 'secondary'}
                    className={
                      school.status === 'active'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                    }
                  >
                    {school.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Schools (Flagged) */}
      {data.inactiveSchoolsList.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle>Inactive Schools</CardTitle>
            </div>
            <CardDescription>Schools that have been deactivated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.inactiveSchoolsList.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <p className="font-medium text-gray-900">{school.name}</p>
                  <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">
                    Inactive
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
