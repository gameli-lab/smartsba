"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, School, Users, UserCheck, GraduationCap, AlertTriangle } from 'lucide-react'
import { ExportButton } from '@/components/super-admin/ExportButton'
import { exportAnalyticsToCSV } from '../exports/actions'
import { exportAnalyticsToPDF } from '@/lib/pdf-export'

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

export default function SuperAdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

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
  }, [])

  const fetchAnalytics = async () => {
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
  }

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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Platform Analytics</h1>
          <p className="mt-2 text-sm text-gray-600">System-wide metrics across all schools</p>
        </div>
        <ExportButton
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          disabled={loading}
        />
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
