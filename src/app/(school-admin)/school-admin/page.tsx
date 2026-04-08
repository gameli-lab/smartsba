import { requireSchoolAdmin } from '@/lib/auth'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Users, GraduationCap, BookOpen, Shapes, CheckCircle2, ArrowUpCircle, AlertCircle, AlertTriangle, Clock, UserCheck, ChevronRight, Layers, Settings, BarChart3, Lock, Unlock, FileText, Eye, EyeOff, Megaphone, TrendingUp, TrendingDown, UserMinus, UserPlus, Calendar, Award, Scale, Shield, History } from 'lucide-react'
import { Suspense } from 'react'

/**
 * School Command Center - School Admin Dashboard
 * Central operational console for school administrators
 */
export default async function SchoolAdminPage() {
  // Get the authenticated school admin
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = await createServerComponentClient()

  // Fetch school details and current session
  const [schoolData, currentSession] = await Promise.all([
    supabase
      .from('schools')
      .select('name, status')
      .eq('id', schoolId)
      .single(),
    
    supabase
      .from('academic_sessions')
      .select('academic_year, term')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single(),
  ])

  const schoolName = schoolData.data?.name || 'School'
  const schoolStatus = schoolData.data?.status || 'active'
  const currentTerm = currentSession.data?.term || 1

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Command Center Header */}
      <div className="bg-white dark:bg-gray-950 border-b dark:border-gray-800">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">School Command Center</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">{schoolName}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {currentSession.data && (
                <Badge variant="outline" className="px-4 py-2 text-sm">
                  {currentSession.data.academic_year} – Term {currentSession.data.term}
                </Badge>
              )}
              <Badge 
                variant={schoolStatus === 'active' ? 'default' : 'secondary'}
                className="px-4 py-2 text-sm"
              >
                {schoolStatus === 'active' ? 'Active School' : schoolStatus}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="space-y-8">
          {/* STAGE 2: Operational KPIs */}
          <Suspense fallback={<KPISkeleton />}>
            <OperationalKPIs schoolId={schoolId} currentTerm={currentTerm} />
          </Suspense>
          
          {/* STAGE 3: Action Priority Panel */}
          <Suspense fallback={<ActionPrioritySkeleton />}>
            <ActionPriorityPanel schoolId={schoolId} currentTerm={currentTerm} />
          </Suspense>
          
          {/* STAGE 4: Academic Operations Hub */}
          <Suspense fallback={<OperationsHubSkeleton />}>
            <AcademicOperationsHub schoolId={schoolId} />
          </Suspense>
          
          {/* STAGE 5: Reports & Results Control */}
          <Suspense fallback={<ResultsControlSkeleton />}>
            <ResultsControlPanel schoolId={schoolId} />
          </Suspense>
          
          {/* STAGE 6: Communication Center */}
          <Suspense fallback={<CommunicationCenterSkeleton />}>
            <CommunicationCenter schoolId={schoolId} />
          </Suspense>
          
          {/* STAGE 7: Staff & Student Oversight */}
          <Suspense fallback={<OversightSkeleton />}>
            <StaffStudentOversight schoolId={schoolId} />
          </Suspense>
          
          {/* STAGE 8: Settings & Configuration */}
          <Suspense fallback={<SettingsConfigSkeleton />}>
            <SettingsConfiguration schoolId={schoolId} />
          </Suspense>
          
          {/* STAGE 9: Activity Log */}
          <Suspense fallback={<ActivityLogSkeleton />}>
            <ActivityLog schoolId={schoolId} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/**
 * Operational KPIs Component - Server Component
 * Displays key metrics for immediate situational awareness
 */
async function OperationalKPIs({ schoolId, currentTerm }: { schoolId: string; currentTerm: number }) {
  const adminSupabase = createAdminSupabaseClient()
  const supabase = await createServerComponentClient()

  // Fetch all KPI data in parallel
  const [
    studentsCount,
    teachersCount,
    classesCount,
    subjectsCount,
    // TODO: Calculate results completion percentage from scores/assessments table
    // TODO: Calculate pending promotions from grading_promotion table
  ] = await Promise.all([
    // Total Students (active only)
    adminSupabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),
    
    // Total Teachers (active only)
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
    
    // Total Subjects Offered
    supabase
      .from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),
  ])

  // TODO: Implement results completion calculation
  const resultsCompletion = 0

  // TODO: Implement pending promotions calculation (Term 3 only)
  const pendingPromotions = 0

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Operational Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Students */}
        <KPICard
          title="Total Students"
          value={studentsCount.count || 0}
          icon={<GraduationCap className="h-6 w-6" />}
          href="/school-admin/students"
          color="blue"
        />

        {/* Total Teachers */}
        <KPICard
          title="Total Teachers"
          value={teachersCount.count || 0}
          icon={<Users className="h-6 w-6" />}
          href="/school-admin/teachers"
          color="green"
        />

        {/* Total Classes */}
        <KPICard
          title="Total Classes"
          value={classesCount.count || 0}
          icon={<BookOpen className="h-6 w-6" />}
          href="/school-admin/classes"
          color="purple"
        />

        {/* Subjects Offered */}
        <KPICard
          title="Subjects Offered"
          value={subjectsCount.count || 0}
          icon={<Shapes className="h-6 w-6" />}
          href="/school-admin/subjects"
          color="orange"
        />

        {/* Results Completion % */}
        <KPICard
          title="Results Completion"
          value={`${resultsCompletion}%`}
          icon={<CheckCircle2 className="h-6 w-6" />}
          href="/school-admin/reports"
          color="indigo"
          subtitle="TODO: Calculate from scores"
        />

        {/* Pending Promotions (Term 3 only) */}
        {currentTerm === 3 && (
          <KPICard
            title="Pending Promotions"
            value={pendingPromotions}
            icon={<ArrowUpCircle className="h-6 w-6" />}
            href="/school-admin/grading-promotion"
            color="rose"
            subtitle="Term 3 only"
          />
        )}
      </div>
    </div>
  )
}

/**
 * KPI Card Component
 * Clickable card displaying a single metric
 */
function KPICard({
  title,
  value,
  icon,
  href,
  color = 'blue',
  subtitle,
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  href: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'rose'
  subtitle?: string
}) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60',
    green: 'text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-950/60',
    purple: 'text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-950/60',
    orange: 'text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-950/60',
    indigo: 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60',
    rose: 'text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60',
  }

  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
            <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
              {icon}
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * KPI Skeleton Loader
 * Shown while KPI data is loading
 */
function KPISkeleton() {
  return (
    <div>
      <div className="h-6 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
              </div>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Action Priority Panel Component - Server Component
 * Highlights items requiring immediate attention
 */
async function ActionPriorityPanel({ schoolId, currentTerm }: { schoolId: string; currentTerm: number }) {
  void schoolId
  void currentTerm

  // Fetch critical items in parallel
  // TODO: Implement data fetching queries
  // For now, showing structure with placeholder data
  
  const criticalItems = [
    // {
    //   id: '1',
    //   type: 'unsubmitted_marks',
    //   severity: 'high' | 'medium' | 'low',
    //   title: string,
    //   description: string,
    //   href: string,
    // }
  ]

  // TODO: Query for:
  // 1. Unsubmitted marks (from teacher_assignments where marks_submitted = false?)
  // 2. Teachers with overdue submissions (audit logs or submission timestamps)
  // 3. Classes missing class teachers (classes where class_teacher_id IS NULL)
  // 4. Pending student approvals (students where status = 'pending'?)
  // 5. Promotion approvals (grading_promotion where status = 'pending' - Term 3 only)

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Action Required</h2>
      
      {criticalItems.length > 0 ? (
        <div className="space-y-3">
          {criticalItems.map((item) => (
            <PriorityAlert key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900">All clear!</p>
                <p className="text-sm text-green-700">No critical items require immediate attention.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Priority Alert Component
 * Displays a single critical item with severity highlight
 */
function PriorityAlert({ item }: { item: PriorityAlertItem }) {
  const severityConfig = {
    high: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: AlertTriangle,
      textColor: 'text-red-900',
      badgeBg: 'bg-red-100 text-red-800',
    },
    medium: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: AlertCircle,
      textColor: 'text-yellow-900',
      badgeBg: 'bg-yellow-100 text-yellow-800',
    },
    low: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: Clock,
      textColor: 'text-blue-900',
      badgeBg: 'bg-blue-100 text-blue-800',
    },
  }

  const config = severityConfig[item.severity as keyof typeof severityConfig] || severityConfig.low
  const Icon = config.icon

  return (
    <Link href={item.href}>
      <Card className={`${config.bg} border ${config.border} hover:shadow-md transition-shadow cursor-pointer`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.textColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className={`font-medium ${config.textColor}`}>{item.title}</p>
                <Badge className={`text-xs ${config.badgeBg}`}>
                  {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                </Badge>
              </div>
              <p className={`text-sm ${config.textColor} opacity-75`}>{item.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 mt-0.5 opacity-50" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * Action Priority Skeleton Loader
 */
function ActionPrioritySkeleton() {
  return (
    <div>
      <div className="h-6 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 bg-gray-200 rounded animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-3 w-96 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Academic Operations Hub Component - Server Component
 * Central access to school workflows and management pages
 */
async function AcademicOperationsHub({ schoolId }: { schoolId: string }) {
  // Fetch counts for each operation area
  const supabase = await createServerComponentClient()

  const [
    classesCount,
    subjectsCount,
    teachersCount,
    studentsCount,
  ] = await Promise.all([
    supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),
    
    supabase
      .from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),
    
    supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .eq('status', 'active'),
    
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),
  ])

  const operations = [
    {
      title: 'Classes & Streams',
      description: 'Manage class structures, streams, and class assignments',
      href: '/school-admin/classes',
      icon: <BookOpen className="h-6 w-6" />,
      count: classesCount.count || 0,
      color: 'purple',
    },
    {
      title: 'Subjects Management',
      description: 'Configure subjects, levels, and subject allocations',
      href: '/school-admin/subjects',
      icon: <Shapes className="h-6 w-6" />,
      count: subjectsCount.count || 0,
      color: 'orange',
    },
    {
      title: 'Teacher Management',
      description: 'Add, edit, and manage teacher profiles and details',
      href: '/school-admin/teachers',
      icon: <Users className="h-6 w-6" />,
      count: teachersCount.count || 0,
      color: 'green',
    },
    {
      title: 'Student Management',
      description: 'Enroll students, manage admissions, and view student records',
      href: '/school-admin/students',
      icon: <GraduationCap className="h-6 w-6" />,
      count: studentsCount.count || 0,
      color: 'blue',
    },
    {
      title: 'Class Teacher Assignments',
      description: 'Assign and manage class teachers for each class',
      href: '/school-admin/teacher-assignments',
      icon: <UserCheck className="h-6 w-6" />,
      count: null,
      color: 'cyan',
    },
    {
      title: 'Subject Teacher Assignments',
      description: 'Assign teachers to subjects within classes',
      href: '/school-admin/teacher-assignments',
      icon: <Layers className="h-6 w-6" />,
      count: null,
      color: 'teal',
    },
    // TODO: Add SBA/Assessment Setup once module is available
    // {
    //   title: 'Assessment Setup (SBA)',
    //   description: 'Configure school-based assessments and grading scales',
    //   href: '/school-admin/assessment-setup',
    //   icon: <BarChart3 className="h-6 w-6" />,
    //   count: null,
    //   color: 'indigo',
    // },
  ]

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Academic Operations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {operations.map((op) => (
          <OperationCard key={op.title} operation={op} />
        ))}
      </div>
    </div>
  )
}

/**
 * Operation Card Component
 * Displays a single operation with link and count
 */
function OperationCard({
  operation,
}: {
  operation: {
    title: string
    description: string
    href: string
    icon: React.ReactNode
    count: number | null
    color: string
  }
}) {
  const colorClasses = {
    blue: 'border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-300',
    green: 'border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-950/30 text-green-600 dark:text-green-300',
    purple: 'border-purple-200 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-600 dark:text-purple-300',
    orange: 'border-orange-200 dark:border-orange-900 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-600 dark:text-orange-300',
    cyan: 'border-cyan-200 dark:border-cyan-900 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 text-cyan-600 dark:text-cyan-300',
    teal: 'border-teal-200 dark:border-teal-900 hover:bg-teal-50 dark:hover:bg-teal-950/30 text-teal-600 dark:text-teal-300',
    indigo: 'border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300',
  }

  const color = colorClasses[operation.color as keyof typeof colorClasses] || colorClasses.blue

  return (
    <Link href={operation.href}>
      <Card className={`border-2 transition-colors cursor-pointer ${color}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded-lg opacity-20 ${color.split(' ')[2]}`}>
              {operation.icon}
            </div>
            {operation.count !== null && (
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{operation.count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
              </div>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{operation.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">{operation.description}</p>
          <div className="mt-3 flex items-center text-sm opacity-50 hover:opacity-100 transition-opacity">
            <span>Go to {operation.title.split(' ')[0].toLowerCase()}</span>
            <ChevronRight className="h-4 w-4 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * Operations Hub Skeleton Loader
 */
function OperationsHubSkeleton() {
  return (
    <div>
      <div className="h-6 w-64 bg-gray-200 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Results Control Panel Component - Server Component
 * Controls results lifecycle (lock/unlock, publish/unpublish)
 */
async function ResultsControlPanel({ schoolId }: { schoolId: string }) {
  void schoolId

  // TODO: Fetch results status by class from results or scores table
  // For now, showing structure with placeholder data
  const resultsByClass = [
    // {
    //   classId: string,
    //   className: string,
    //   status: 'draft' | 'locked' | 'published',
    //   completionPercentage: number,
    //   lastUpdated: string,
    //   canPublish: boolean,
    //   canGenerate: boolean,
    // }
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Results & Reports Control</h2>
        <Link href="/school-admin/reports" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View Full Reports
        </Link>
      </div>

      {resultsByClass.length > 0 ? (
        <div className="space-y-3">
          {resultsByClass.map((item) => (
            <ResultsStatusCard key={item.classId} item={item} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">No results data available</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Results will appear here once marks are entered and submitted by teachers
              </p>
              <Link 
                href="/school-admin/reports"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Go to Reports
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Results Status Card Component
 * Displays results status for a single class with action buttons
 */
function ResultsStatusCard({
  item,
}: {
  item: {
    classId: string
    className: string
    status: 'draft' | 'locked' | 'published'
    completionPercentage: number
    lastUpdated: string
    canPublish: boolean
    canGenerate: boolean
  }
}) {
  const statusConfig = {
    draft: {
      label: 'Draft',
      color: 'bg-amber-100 text-amber-800 border-amber-300',
      description: 'Results entered but not locked',
    },
    locked: {
      label: 'Locked',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      description: 'Results locked from further changes',
    },
    published: {
      label: 'Published',
      color: 'bg-green-100 text-green-800 border-green-300',
      description: 'Results published to students/parents',
    },
  }

  const config = statusConfig[item.status]

  return (
    <Card className="border border-gray-200 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{item.className}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{config.description}</p>
          </div>
          <Badge className={`border ${config.color}`}>{config.label}</Badge>
        </div>

        {/* Completion Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Entry Completion</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${item.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Last Updated & Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date(item.lastUpdated).toLocaleDateString()}
          </p>
          <div className="flex gap-2">
            {/* TODO: Implement lock/unlock action */}
            <ResultsActionButton
              icon={item.status === 'locked' ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              label={item.status === 'locked' ? 'Unlock' : 'Lock'}
              title={item.status === 'locked' ? 'Unlock results for editing' : 'Lock results from further changes'}
              variant={item.status === 'locked' ? 'secondary' : 'outline'}
              disabled={item.status === 'published'}
            />

            {/* TODO: Implement publish/unpublish action */}
            <ResultsActionButton
              icon={item.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              label={item.status === 'published' ? 'Unpublish' : 'Publish'}
              title={item.status === 'published' ? 'Unpublish results from students' : 'Publish results to students'}
              variant={item.status === 'published' ? 'secondary' : 'outline'}
              disabled={item.status === 'draft' || !item.canPublish}
            />

            {/* TODO: Implement generate reports action */}
            <ResultsActionButton
              icon={<FileText className="h-4 w-4" />}
              label="Generate"
              title="Generate reports for this class"
              variant="outline"
              disabled={!item.canGenerate || item.completionPercentage < 100}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Results Action Button Component
 * Small button for quick actions in results cards
 */
function ResultsActionButton({
  icon,
  label,
  title,
  variant = 'outline',
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  title: string
  variant?: 'outline' | 'secondary'
  disabled?: boolean
}) {
  const variantClasses = {
    outline: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
    secondary: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700',
  }

  return (
    <button
      title={title}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
        variantClasses[variant]
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/**
 * Results Control Skeleton Loader
 */
function ResultsControlSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                  <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse mb-4" />
              <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Communication Center Component - Server Component
 * School-wide announcements and messaging
 */
async function CommunicationCenter({ schoolId }: { schoolId: string }) {
  void schoolId

  // TODO: Fetch announcements from announcements table
  // Filter by school_id, order by created_at DESC, limit 5 most recent
  const announcements = [
    // {
    //   id: string,
    //   title: string,
    //   content: string,
    //   targetType: 'all' | 'class' | 'role',
    //   targetValue?: string,  // e.g., "JSS1A" for class, "teacher" for role
    //   status: 'draft' | 'sent' | 'scheduled',
    //   sentAt?: string,
    //   createdAt: string,
    //   createdBy: string,
    // }
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Communication Center</h2>
        <Link href="/school-admin/announcements" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Manage Announcements
        </Link>
      </div>

      {announcements.length > 0 ? (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Megaphone className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">No announcements yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Send announcements to keep your school community informed
              </p>
              <Link 
                href="/school-admin/announcements"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Create Announcement
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Announcement Card Component
 * Displays a single announcement with targeting and delivery info
 */
function AnnouncementCard({
  announcement,
}: {
  announcement: {
    id: string
    title: string
    content: string
    targetType: 'all' | 'class' | 'role'
    targetValue?: string
    status: 'draft' | 'sent' | 'scheduled'
    sentAt?: string
    createdAt: string
    createdBy: string
  }
}) {
  const statusConfig = {
    draft: {
      label: 'Draft',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      description: 'Not yet sent',
    },
    sent: {
      label: 'Sent',
      color: 'bg-green-100 text-green-800 border-green-300',
      description: 'Delivered to recipients',
    },
    scheduled: {
      label: 'Scheduled',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      description: 'Scheduled for later delivery',
    },
  }

  const statusInfo = statusConfig[announcement.status]

  const targetLabel = {
    all: 'All Staff & Students',
    class: `Class: ${announcement.targetValue}`,
    role: `${announcement.targetValue?.charAt(0).toUpperCase()}${announcement.targetValue?.slice(1)}s`,
  }

  return (
    <Link href="/school-admin/announcements">
      <Card className="border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{announcement.title}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{announcement.content}</p>
            </div>
            <Badge className={`border ${statusInfo.color} flex-shrink-0`}>{statusInfo.label}</Badge>
          </div>

          {/* Target & Delivery Info */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-3">
              <span>{targetLabel[announcement.targetType as keyof typeof targetLabel]}</span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span>
                {announcement.sentAt
                  ? `Sent ${new Date(announcement.sentAt).toLocaleDateString()}`
                  : `Created ${new Date(announcement.createdAt).toLocaleDateString()}`}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 opacity-50" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * Communication Center Skeleton Loader
 */
function CommunicationCenterSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse flex-shrink-0" />
              </div>
              <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Staff & Student Oversight Component - Server Component
 * Administrative oversight summaries
 */
async function StaffStudentOversight({ schoolId }: { schoolId: string }) {
  const supabase = await createServerComponentClient()

  // Fetch oversight data
  const [
    staffData,
    studentData,
    classPopulations,
  ] = await Promise.all([
    // Staff summary
    supabase
      .from('user_profiles')
      .select('id, role, status')
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .eq('status', 'active'),
    
    // Student summary with gender distribution
    supabase
      .from('students')
      .select('id, gender, status, is_active')
      .eq('school_id', schoolId),
    
    // Class populations for warnings
    supabase
      .from('classes')
      .select('id, name, capacity, students(id)')
      .eq('school_id', schoolId),
  ])

  // TODO: Enrollment trends - new admissions, transfers, withdrawals
  // This would require additional queries or a separate table

  // Calculate statistics
  const totalStaff = staffData.count || 0
  const totalStudents = studentData.data?.filter(s => s.is_active).length || 0
  
  const genderDistribution = {
    male: studentData.data?.filter(s => s.is_active && s.gender === 'male').length || 0,
    female: studentData.data?.filter(s => s.is_active && s.gender === 'female').length || 0,
  }

  // TODO: Calculate transfer/withdrawal stats
  const transfersWithdrawals = {
    transfers: 0,
    withdrawals: 0,
  }

  // Check for overcrowded classes
  const overcrowdedClasses = (classPopulations.data ?? []).filter(
    (cls: ClassPopulationRow) => cls.students && cls.capacity && cls.students.length > cls.capacity
  )

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Staff & Student Oversight</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Staff Overview */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Staff Overview</h3>
              <Link href="/school-admin/teachers" className="text-xs text-blue-600 hover:text-blue-700">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">Active Teachers</span>
                </div>
                <span className="text-xl font-bold text-gray-900">{totalStaff}</span>
              </div>
              <div className="text-xs text-gray-500 pt-2 border-t">
                Teaching staff with active assignments
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Enrollment */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Student Enrollment</h3>
              <Link href="/school-admin/students" className="text-xs text-blue-600 hover:text-blue-700">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Total Students</span>
                </div>
                <span className="text-xl font-bold text-gray-900">{totalStudents}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t text-xs">
                <span className="text-gray-600">Male: {genderDistribution.male}</span>
                <span className="text-gray-600">Female: {genderDistribution.female}</span>
                <span className="text-gray-500">
                  {totalStudents > 0 
                    ? `${Math.round((genderDistribution.male / totalStudents) * 100)}% / ${Math.round((genderDistribution.female / totalStudents) * 100)}%`
                    : '0% / 0%'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transfer/Withdrawal Status */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Transfer & Withdrawal Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Transfers (This Term)</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">{transfersWithdrawals.transfers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  <span className="text-sm text-gray-600">Withdrawals (This Term)</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">{transfersWithdrawals.withdrawals}</span>
              </div>
              <div className="text-xs text-gray-500 pt-2 border-t">
                TODO: Track from student status changes
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class Population Warnings */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Class Population</h3>
            {overcrowdedClasses.length > 0 ? (
              <div className="space-y-2">
                {overcrowdedClasses.slice(0, 3).map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-900">{cls.name}</span>
                    </div>
                    <span className="text-xs text-amber-700">
                      {cls.students.length}/{cls.capacity} students
                    </span>
                  </div>
                ))}
                {overcrowdedClasses.length > 3 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    +{overcrowdedClasses.length - 3} more overcrowded classes
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">All classes within capacity</p>
                <p className="text-xs text-gray-500 mt-1">No overcrowding detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Staff & Student Oversight Skeleton Loader
 */
function OversightSkeleton() {
  return (
    <div>
      <div className="h-6 w-64 bg-gray-200 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Settings & Configuration Component - Server Component
 * School-level configuration controls
 */
async function SettingsConfiguration({ schoolId }: { schoolId: string }) {
  void schoolId

  // TODO: Fetch school settings from database
  // These would come from a school_settings table or similar
  const settings = {
    gradingScale: 'Default (A-F)', // TODO: Fetch from grading_scales table
    academicCalendar: 'Not configured', // TODO: Fetch from academic_sessions
    promotionRules: 'Standard', // TODO: Fetch from promotion_rules table
    subjectWeighting: 'Equal', // TODO: Fetch from subject_weights table
    resultVisibility: 'Parent Access Enabled', // TODO: Fetch from school settings
  }

  const configItems = [
    {
      title: 'Grading Scale',
      description: 'Configure grading scales, passing marks, and grade boundaries',
      value: settings.gradingScale,
      href: '/school-admin/grading-promotion',
      icon: <Award className="h-5 w-5" />,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      title: 'Academic Calendar',
      description: 'Manage terms, holidays, and important academic dates',
      value: settings.academicCalendar,
      href: '/school-admin/academic-sessions',
      icon: <Calendar className="h-5 w-5" />,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Promotion Rules',
      description: 'Set promotion criteria, minimum scores, and advancement requirements',
      value: settings.promotionRules,
      href: '/school-admin/grading-promotion',
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-green-600 bg-green-50',
    },
    {
      title: 'Subject Weighting',
      description: 'Configure subject weights and calculate overall performance',
      value: settings.subjectWeighting,
      href: '/school-admin/subjects',
      icon: <Scale className="h-5 w-5" />,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      title: 'Result Visibility',
      description: 'Control who can view results and when they are published',
      value: settings.resultVisibility,
      href: '/school-admin/settings',
      icon: <Shield className="h-5 w-5" />,
      color: 'text-indigo-600 bg-indigo-50',
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">School Configuration</h2>
        <Link href="/school-admin/settings" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Advanced Settings
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {configItems.map((item) => (
          <ConfigCard key={item.title} item={item} />
        ))}
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Configuration Notice</p>
            <p className="text-xs text-amber-700 mt-1">
              Changes to school settings are audited and may override global defaults. Ensure changes are reviewed before applying.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Config Card Component
 * Displays a single configuration setting with quick access
 */
function ConfigCard({
  item,
}: {
  item: {
    title: string
    description: string
    value: string
    href: string
    icon: React.ReactNode
    color: string
  }
}) {
  return (
    <Link href={item.href}>
      <Card className="border border-gray-200 hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className={`p-2 rounded-lg ${item.color}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.title}</h3>
              <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
            </div>
          </div>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Current:</span>
              <span className="text-xs font-medium text-gray-900">{item.value}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * Settings Configuration Skeleton Loader
 */
function SettingsConfigSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 bg-gray-200 rounded-lg animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 h-20 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  )
}

/**
 * Activity Log Component - Server Component
 * Accountability and audit trail interface
 */
async function ActivityLog({ schoolId }: { schoolId: string }) {
  const supabase = await createServerComponentClient()

  // Fetch recent activity from audit_logs table
  const { data: activities } = await supabase
    .from('audit_logs')
    .select(`
      id,
      action,
      entity_type,
      entity_id,
      changes,
      created_at,
      actor_id,
      user_profiles!audit_logs_actor_id_fkey(full_name, role)
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Last 10 actions</span>
          {/* TODO: Add filter controls for date, action type, and actor */}
        </div>
      </div>

      {activities && activities.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {activities.map((activity) => (
                <ActivityLogItem key={activity.id} activity={activity} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No activity logged yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Activity will appear here as actions are performed in the system
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Audit Trail</p>
            <p className="text-xs text-blue-700 mt-1">
              All administrative actions are logged for accountability. Logs are read-only and cannot be modified or deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Activity Log Item Component
 * Displays a single audit log entry
 */
function ActivityLogItem({ activity }: { activity: ActivityLogRow }) {
  const actionTypeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    create: { icon: <UserPlus className="h-4 w-4" />, color: 'text-green-600 bg-green-50' },
    update: { icon: <Settings className="h-4 w-4" />, color: 'text-blue-600 bg-blue-50' },
    delete: { icon: <UserMinus className="h-4 w-4" />, color: 'text-red-600 bg-red-50' },
    import: { icon: <FileText className="h-4 w-4" />, color: 'text-purple-600 bg-purple-50' },
    override: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-amber-600 bg-amber-50' },
    publish: { icon: <Eye className="h-4 w-4" />, color: 'text-indigo-600 bg-indigo-50' },
    lock: { icon: <Lock className="h-4 w-4" />, color: 'text-gray-600 bg-gray-50' },
    unlock: { icon: <Unlock className="h-4 w-4" />, color: 'text-gray-600 bg-gray-50' },
  }

  const actionType = activity.action?.toLowerCase().split(' ')[0] || 'update'
  const config = actionTypeConfig[actionType] || actionTypeConfig.update

  const actorName = activity.user_profiles?.full_name || 'System'
  const actorRole = activity.user_profiles?.role || 'system'

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900">{activity.action}</p>
            <time className="text-xs text-gray-500 flex-shrink-0">
              {new Date(activity.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
          <p className="text-xs text-gray-600 mb-2">
            {activity.entity_type} • by {actorName} ({actorRole})
          </p>
          {activity.changes && Object.keys(activity.changes).length > 0 && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 font-mono">
              {/* TODO: Format changes object for better readability */}
              <span className="text-gray-500">Changes recorded</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Activity Log Skeleton Loader
 */
function ActivityLogSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-3 w-64 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="mt-3 h-16 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  )
}

// Helper function types
interface PriorityAlertItem {
  id: string
  type: 'unsubmitted_marks' | 'overdue_submissions' | 'missing_class_teacher' | 'pending_approvals' | 'pending_promotions'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  href: string
}

interface ClassPopulationRow {
  id: string
  name: string
  capacity: number | null
  students: Array<{ id: string }> | null
}

interface ActivityActor {
  full_name?: string | null
  role?: string | null
}

interface ActivityLogRow {
  id: string
  action: string | null
  entity_type: string | null
  changes: Record<string, unknown> | null
  created_at: string
  user_profiles?: ActivityActor | ActivityActor[] | null
}
