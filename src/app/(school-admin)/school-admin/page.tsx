import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, GraduationCap, BookOpen, Shapes, TrendingUp, Clock } from 'lucide-react'

/**
 * School Admin Dashboard Overview Page
 * Displays summary statistics and recent activity for the school
 */
export default async function SchoolAdminPage() {
  // Get the authenticated school admin
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  // Fetch summary statistics
  const [
    studentsCount,
    teachersCount,
    classesCount,
    subjectsCount,
    currentSession,
    recentActivity,
  ] = await Promise.all([
    // Total Students
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),
    
    // Total Teachers
    supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .eq('status', 'active'),
    
    // Total Classes
    supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),
    
    // Total Subjects (unique across all classes)
    supabase
      .from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),
    
    // Current Academic Session
    supabase
      .from('academic_sessions')
      .select('id, academic_year, term, start_date, end_date')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single(),
    
    // Recent Activity (last 5 actions from audit logs)
    supabase
      .from('audit_logs')
      .select('id, action, entity_type, created_at, user_profiles(full_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // TODO: Fetch term progress data (marks entry statistics)
  // This will require additional queries to scores/assessments tables
  // For now, we'll show placeholder values
  const termProgress = {
    subjectsWithMarks: 0,
    totalSubjects: subjectsCount.count || 0,
    teachersPending: 0,
  }

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Overview of your school's key metrics
          {currentSession.data && (
            <span className="ml-2 text-sm">
              • {currentSession.data.academic_year} - Term {currentSession.data.term}
            </span>
          )}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Students"
          value={studentsCount.count || 0}
          icon={<GraduationCap className="h-8 w-8 text-blue-600" />}
          bgColor="bg-blue-50"
        />
        <SummaryCard
          title="Total Teachers"
          value={teachersCount.count || 0}
          icon={<Users className="h-8 w-8 text-green-600" />}
          bgColor="bg-green-50"
        />
        <SummaryCard
          title="Total Classes"
          value={classesCount.count || 0}
          icon={<BookOpen className="h-8 w-8 text-purple-600" />}
          bgColor="bg-purple-50"
        />
        <SummaryCard
          title="Total Subjects"
          value={subjectsCount.count || 0}
          icon={<Shapes className="h-8 w-8 text-orange-600" />}
          bgColor="bg-orange-50"
        />
      </div>

      {/* Term Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Term Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Subjects with Marks Entered
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {termProgress.subjectsWithMarks} / {termProgress.totalSubjects}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: termProgress.totalSubjects > 0
                      ? `${(termProgress.subjectsWithMarks / termProgress.totalSubjects) * 100}%`
                      : '0%',
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {termProgress.totalSubjects > 0
                  ? `${Math.round((termProgress.subjectsWithMarks / termProgress.totalSubjects) * 100)}% complete`
                  : 'No subjects configured'}
              </p>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  Teachers Pending Submissions
                </span>
                <span className={`text-lg font-bold ${
                  termProgress.teachersPending > 0 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {termProgress.teachersPending}
                </span>
              </div>
              {termProgress.teachersPending === 0 && (
                <p className="text-xs text-green-600 mt-1">
                  All teachers have submitted marks
                </p>
              )}
            </div>

            {/* TODO: This will be populated with real data from scores/assessments in later stages */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600">
                <strong>Note:</strong> Term progress tracking will be activated once assessments are configured.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.data && recentActivity.data.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.data.map((activity: any) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action}
                      </p>
                      <p className="text-xs text-gray-600">
                        {activity.entity_type}
                        {activity.user_profiles?.full_name && (
                          <> • by {activity.user_profiles.full_name}</>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">
                  Activity will appear here as actions are performed
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface SummaryCardProps {
  title: string
  value: number
  icon: React.ReactNode
  bgColor: string
}

function SummaryCard({ title, value, icon, bgColor }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value.toLocaleString()}</p>
          </div>
          <div className={`${bgColor} p-3 rounded-lg`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
