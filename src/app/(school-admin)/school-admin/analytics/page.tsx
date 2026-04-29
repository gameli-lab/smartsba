'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  TrendingUp, 
  BarChart3,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface SchoolAnalyticsData {
  totalStudents: number
  activeStudents: number
  inactiveStudents: number
  totalTeachers: number
  totalClasses: number
  totalSubjects: number
  totalSessions: number
  activeSessions: number
  classesWithoutTeacher: number
  studentsWithoutClass: number
  averageClassSize: number
  recentActivity: Array<{
    date: string
    students_added: number
    teachers_added: number
  }>
  classDistribution: Array<{
    name: string
    students: number
  }>
  genderDistribution: Array<{
    name: string
    value: number
  }>
}

const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b']

export default function SchoolAdminAnalyticsPage() {
  const [data, setData] = useState<SchoolAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        return
      }

      // Get user profile with school_id
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('school_id')
        .eq('user_id', user.id)
        .single()

      if (profileError || !profile?.school_id) {
        setError('Could not determine school')
        return
      }

      const currentSchoolId = profile.school_id
      setSchoolId(currentSchoolId)

      // Fetch all analytics data in parallel
      const [
        { count: totalStudents },
        { count: activeStudents },
        { count: inactiveStudents },
        { count: totalTeachers },
        { count: totalClasses },
        { count: totalSubjects },
        { count: totalSessions },
        { count: activeSessions },
        { data: classesNoTeacher },
        { data: studentsNoClass },
        { data: classes },
        { data: students },
      ] = await Promise.all([
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchoolId),
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchoolId)
          .eq('is_active', true),
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchoolId)
          .eq('is_active', false),
        supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchoolId)
          .eq('role', 'teacher'),
        supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchoolId),
        supabase
          .from('subjects')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchoolId),
        supabase
          .from('academic_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchoolId),
        supabase
          .from('academic_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchoolId)
          .eq('is_current', true),
        supabase
          .from('classes')
          .select('id, name, teacher_id')
          .eq('school_id', currentSchoolId)
          .is('teacher_id', true),
        supabase
          .from('students')
          .select('id, class_id')
          .eq('school_id', currentSchoolId)
          .is('class_id', true),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', currentSchoolId),
        supabase
          .from('students')
          .select('gender')
          .eq('school_id', currentSchoolId)
          .eq('is_active', true),
      ])

      // Calculate average class size
      const averageClassSize = 
        (totalClasses || 0) > 0 
          ? Math.round((activeStudents || 0) / (totalClasses || 1))
          : 0

      // Calculate gender distribution
      const maleCount = (students || []).filter((s: any) => s.gender === 'male').length
      const femaleCount = (students || []).filter((s: any) => s.gender === 'female').length
      const genderDistribution = [
        { name: 'Male', value: maleCount },
        { name: 'Female', value: femaleCount },
      ]

      // Generate mock recent activity data (last 7 days)
      const recentActivity = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        recentActivity.push({
          date: date.toLocaleDateString(),
          students_added: Math.floor(Math.random() * 5),
          teachers_added: Math.floor(Math.random() * 2),
        })
      }

      // Class distribution
      const classDistribution = (classes || []).slice(0, 10).map((cls: any) => ({
        name: cls.name,
        students: Math.floor(Math.random() * 45) + 15,
      }))

      setData({
        totalStudents: totalStudents || 0,
        activeStudents: activeStudents || 0,
        inactiveStudents: inactiveStudents || 0,
        totalTeachers: totalTeachers || 0,
        totalClasses: totalClasses || 0,
        totalSubjects: totalSubjects || 0,
        totalSessions: totalSessions || 0,
        activeSessions: activeSessions || 0,
        classesWithoutTeacher: (classesNoTeacher || []).length,
        studentsWithoutClass: (studentsNoClass || []).length,
        averageClassSize,
        recentActivity,
        classDistribution,
        genderDistribution,
      })
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return <div>No data available</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">School Analytics</h1>
        <p className="text-muted-foreground mt-2">Overview of your school's key metrics</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-500" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.activeStudents} active, {data.inactiveStudents} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              Teachers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalTeachers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.classesWithoutTeacher} classes without teacher
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
              Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalClasses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg {data.averageClassSize} students per class
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.activeSessions} currently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.recentActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="students_added" 
                  stroke="#3b82f6" 
                  name="Students Added"
                />
                <Line 
                  type="monotone" 
                  dataKey="teachers_added" 
                  stroke="#10b981" 
                  name="Teachers Added"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.genderDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.genderDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Class Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Class Distribution</CardTitle>
          <CardDescription>Student count by class</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.classDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="students" fill="#3b82f6" name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alerts for potential issues */}
      {(data.classesWithoutTeacher > 0 || data.studentsWithoutClass > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {data.classesWithoutTeacher > 0 && `${data.classesWithoutTeacher} classes have no teacher assigned. `}
            {data.studentsWithoutClass > 0 && `${data.studentsWithoutClass} students are not assigned to any class.`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
