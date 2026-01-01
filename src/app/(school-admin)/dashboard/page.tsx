import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface CountResult {
  count: number
  error?: string | null
}

async function getCount(table: string, schoolId: string): Promise<CountResult> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId)

  if (error) return { count: 0, error: error.message }
  return { count: count || 0 }
}

export default async function DashboardPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  // Fetch counts
  const [studentsCount, teachersCount, classesCount, subjectsCount] = await Promise.all([
    getCount('students', schoolId),
    getCount('teachers', schoolId),
    getCount('classes', schoolId),
    getCount('subjects', schoolId),
  ])

  // Current academic session
  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  const currentSession = (session as { id: string; academic_year: string; term: number } | null) || null

  // Term progress (placeholder implementation until subject-level submission tracking is available)
  const totalSubjects = subjectsCount.count
  const subjectsWithMarks = 0 // TODO: replace with distinct subject count that has scores for the current session
  const subjectProgress = totalSubjects > 0 ? Math.round((subjectsWithMarks / totalSubjects) * 100) : 0

  const totalTeachers = teachersCount.count
  const teachersWithSubmissions = 0 // TODO: replace with count of teachers who submitted scores in current session
  const teachersPending = Math.max(totalTeachers - teachersWithSubmissions, 0)

  // Recent activity (fallback to actor-level audit logs; add school-scoped logs when available)
  const { data: recentActivity } = await supabase
    .from('audit_logs')
    .select('id, action, target_type, created_at, metadata')
    .eq('actor_user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(5)

  const activity = (recentActivity as {
    id: string
    action: string
    target_type?: string | null
    created_at: string
    metadata?: Record<string, unknown> | null
  }[] | null) || []

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your school for the current term.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Students" value={studentsCount.count} error={studentsCount.error} />
        <StatCard title="Total Teachers" value={teachersCount.count} error={teachersCount.error} />
        <StatCard title="Total Classes" value={classesCount.count} error={classesCount.error} />
        <StatCard title="Total Subjects" value={subjectsCount.count} error={subjectsCount.error} />
      </div>

      {/* Term progress */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Term Progress</CardTitle>
            <CardDescription>
              {currentSession ? `${currentSession.academic_year} • Term ${currentSession.term}` : 'No current session set'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressRow
              label="Subjects with marks entered"
              value={subjectProgress}
              helper={totalSubjects > 0 ? `${subjectsWithMarks} of ${totalSubjects} subjects` : 'No subjects yet'}
            />
            <div className="border-t" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Teachers pending submissions</p>
                <p className="text-sm text-gray-500">Awaiting score entries</p>
              </div>
              <div className="text-2xl font-semibold text-gray-900">{teachersPending}</div>
            </div>
            {totalTeachers === 0 && (
              <p className="text-xs text-gray-500">Add teachers to start tracking submissions.</p>
            )}
            <p className="text-xs text-gray-400">
              TODO: Replace placeholders with actual submission tracking once subject-level submission data is available.
            </p>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your last 5 actions</CardDescription>
          </CardHeader>
          <CardContent>
            {activity && activity.length > 0 ? (
              <ul className="space-y-3">
                {activity.map((item) => (
                  <li key={item.id} className="rounded-lg border bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">{item.action}</span>
                      <span className="text-xs text-gray-500">{formatDate(item.created_at)}</span>
                    </div>
                    {item.target_type && (
                      <p className="text-xs text-gray-500 mt-1">Target: {item.target_type}</p>
                    )}
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{JSON.stringify(item.metadata)}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No recent activity yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ title, value, error }: { title: string; value: number; error?: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  )
}

function ProgressRow({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-700">{value}%</p>
      </div>
      <div className="h-2 rounded-full bg-gray-200">
        <div
          className={cn(
            'h-2 rounded-full transition-all',
            value >= 75 ? 'bg-green-600' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">{helper}</p>
    </div>
  )
}
