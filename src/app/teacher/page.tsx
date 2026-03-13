import Link from 'next/link'
import { headers } from 'next/headers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TeacherDashboardBackendData } from '@/types/teacher-dashboard'

function classLabel(klass: { name: string; stream: string | null; level: number | null }): string {
  return `${klass.name}${klass.stream ? ` • ${klass.stream}` : ''}${klass.level ? ` • Level ${klass.level}` : ''}`
}

export default async function TeacherPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  const proto = headerStore.get('x-forwarded-proto') || 'http'

  if (!host) {
    throw new Error('Unable to determine request host for teacher dashboard API call')
  }

  const params = new URLSearchParams()
  const classId = typeof searchParams.classId === 'string' ? searchParams.classId : undefined
  const subjectId = typeof searchParams.subjectId === 'string' ? searchParams.subjectId : undefined
  const sessionId = typeof searchParams.sessionId === 'string' ? searchParams.sessionId : undefined
  if (classId) params.set('classId', classId)
  if (subjectId) params.set('subjectId', subjectId)
  if (sessionId) params.set('sessionId', sessionId)

  const apiUrl = `${proto}://${host}/api/teacher/dashboard${params.toString() ? `?${params.toString()}` : ''}`
  const response = await fetch(apiUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      cookie: headerStore.get('cookie') || '',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch teacher dashboard data: ${response.status}`)
  }

  const payload = (await response.json()) as { success?: boolean; data?: TeacherDashboardBackendData; error?: string }
  if (!payload.success || !payload.data) {
    throw new Error(payload.error || 'Teacher dashboard API returned invalid payload')
  }

  const data = payload.data
  const effectiveRole = data.roleSpecific.role
  const classIds = data.workload.assignedClasses.map((klass) => klass.id)
  const assignmentPairsCount =
    data.assessmentPipeline.submittedIncomplete +
    data.assessmentPipeline.readyForModeration +
    data.assessmentPipeline.published

  const currentSession = data.workload.currentSession
    ? { academic_year: data.workload.currentSession.academicYear, term: data.workload.currentSession.term }
    : null

  const sessions = data.workload.availableSessions.map((session) => ({
    id: session.id,
    academic_year: session.academicYear,
    term: session.term,
    is_current: session.isCurrent,
  }))

  const selectedSessionId = data.workload.selectedSessionId || ''
  const selectedClassId = data.workload.selectedClassId || ''
  const selectedSubjectId = data.workload.selectedSubjectId || ''

  const assignedClasses = data.workload.assignedClasses
  const subjectsForSelectedClass = assignedClasses.find((klass) => klass.id === selectedClassId)?.subjects || []

  const classStudentCount = new Map<string, number>()
  assignedClasses.forEach((klass) => classStudentCount.set(klass.id, klass.studentCount))

  const classSubjectMap = new Map<string, Array<{ id: string; name: string }>>()
  assignedClasses.forEach((klass) => classSubjectMap.set(klass.id, klass.subjects))

  const announcements = data.notifications.adminAnnouncements.map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    created_at: announcement.createdAt,
    is_urgent: announcement.isUrgent,
  }))

  const pendingScoreEntries = data.summary.pendingScoresToSubmit
  const attendancePendingClasses = data.summary.attendanceNotMarked
  const atRiskCombined = data.summary.atRiskStudents
  const isClassTeacher = data.roleSpecific.role === 'class_teacher'
  const canPublishScores = data.guardrails.canPublishOrLock
  const incompleteByPair = data.assessmentPipeline.submittedIncomplete
  const outlierEntries = data.guardrails.outlierScoreAlerts
  const lowAttendanceStudents = { size: data.attendanceBehavior.repeatedAbsenceCount }

  const quickActions = data.quickActions
    .filter((action) => action.key !== 'publish_lock')
    .map((action) => ({ href: action.href, label: action.label }))

  const summaryCards = [
    { label: 'Today’s Classes', value: String(data.summary.todaysClasses), hint: 'Timetable integration pending' },
    { label: 'Pending Scores to Submit', value: String(data.summary.pendingScoresToSubmit), hint: 'Missing score rows' },
    { label: 'Attendance Not Marked', value: String(data.summary.attendanceNotMarked), hint: 'By class' },
    { label: 'Reports Due This Week', value: String(data.summary.reportsDueThisWeek), hint: isClassTeacher ? 'Class-teacher workload estimate' : 'Class-teacher only' },
    { label: 'At-risk Students', value: String(data.summary.atRiskStudents), hint: 'Low score or low attendance' },
  ]

  const performanceRows = data.performance.classAverages.map((row) => ({
    classId: row.classId,
    className: row.className,
    avg: row.average,
    sampleSize: row.entries,
    passRate: row.passRate,
  }))

  const bestAverage = performanceRows.reduce((max, row) => {
    if (row.avg === null) return max
    return Math.max(max, row.avg)
  }, 0)

  const selectedMean = data.performance.meanScore
  const selectedPassRate = data.performance.passRate
  const gradeBands = data.performance.gradeDistribution
  const topPerformers = data.performance.topPerformers.map((row) => ({ ...row, total: row.aggregate }))
  const bottomPerformers = data.performance.bottomPerformers.map((row) => ({ ...row, total: row.aggregate }))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Teacher Dashboard</h1>
          <p className="text-sm text-gray-600">Daily teaching overview, pending actions, and class insights.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
            {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
          </Badge>
          {currentSession && (
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              {currentSession.academic_year} • Term {currentSession.term}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
              <p className="mt-1 text-xs text-gray-500">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Primary teaching CTAs</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {quickActions.map((action) => (
              <Button key={action.href} asChild variant="outline" className="justify-start">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
            <Button disabled={!canPublishScores} variant={canPublishScores ? 'default' : 'outline'} className="justify-start">
              Publish/Lock Term Scores {canPublishScores ? '' : '(Blocked)'}
            </Button>
            {!canPublishScores && (
              <p className="text-xs text-gray-500">
                {isClassTeacher
                  ? 'Complete all required score entries before publishing.'
                  : 'Publish/Lock is class-teacher only.'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Teaching Workload Panel</CardTitle>
            <CardDescription>Current term, assignment load, and dashboard filters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form method="get" className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Class</label>
                <select name="classId" defaultValue={selectedClassId || ''} className="w-full rounded-md border px-3 py-2 text-sm">
                  {assignedClasses.map((klass) => (
                    <option key={klass.id} value={klass.id}>{classLabel(klass)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Subject</label>
                <select name="subjectId" defaultValue={selectedSubjectId || ''} className="w-full rounded-md border px-3 py-2 text-sm">
                  {subjectsForSelectedClass.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Session</label>
                <select name="sessionId" defaultValue={selectedSessionId || ''} className="w-full rounded-md border px-3 py-2 text-sm">
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.academic_year} • Term {session.term}{session.is_current ? ' (Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <Button type="submit" variant="outline">Apply Filters</Button>
              </div>
            </form>

            <div className="rounded-lg border bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">Next upcoming lesson/class</p>
              <p className="text-gray-600">Timetable module not configured yet. Connect timetable to show live next class.</p>
            </div>

            {assignedClasses.length === 0 ? (
              <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                No class assigned yet.
                <div className="mt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/teacher/profile">Update Profile / Contact Admin</Link>
                  </Button>
                </div>
              </div>
            ) : (
              assignedClasses.map((klass) => (
                <div key={klass.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{classLabel(klass)}</p>
                      <p className="text-xs text-gray-500">Students: {classStudentCount.get(klass.id) || 0}</p>
                    </div>
                    <Badge variant="secondary">
                      {(classSubjectMap.get(klass.id) || []).length} subject(s)
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(classSubjectMap.get(klass.id) || []).length === 0 ? (
                      <span className="text-xs text-gray-500">No subjects found for this class.</span>
                    ) : (
                      (classSubjectMap.get(klass.id) || []).map((subject) => (
                        <Badge key={subject.id} variant="outline" className="text-xs">
                          {subject.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Assessment Pipeline</CardTitle>
            <CardDescription>Draft → incomplete → moderation → published</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border bg-gray-50 p-3 text-gray-800">
              Draft assessments: <span className="font-semibold">0</span>
            </div>
            <div className="rounded-lg border bg-amber-50 p-3 text-amber-900">
              Submitted but incomplete: <span className="font-semibold">{incompleteByPair}</span>
            </div>
            <div className="rounded-lg border bg-blue-50 p-3 text-blue-900">
              Ready for moderation: <span className="font-semibold">{Math.max(0, assignmentPairsCount - incompleteByPair)}</span>
            </div>
            <div className="rounded-lg border bg-green-50 p-3 text-green-900">
              Published: <span className="font-semibold">0</span>
            </div>
            <div className="rounded-lg border bg-rose-50 p-3 text-rose-900">
              Missing entries by student: <span className="font-semibold">{pendingScoreEntries}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class Performance Insights</CardTitle>
            <CardDescription>Mean score, pass rate, performers, and grade distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border bg-gray-50 p-2">
                <p className="text-xs text-gray-600">Mean score</p>
                <p className="font-semibold text-gray-900">{selectedMean === null ? 'N/A' : `${selectedMean.toFixed(1)}%`}</p>
              </div>
              <div className="rounded border bg-gray-50 p-2">
                <p className="text-xs text-gray-600">Pass rate</p>
                <p className="font-semibold text-gray-900">{selectedPassRate === null ? 'N/A' : `${selectedPassRate.toFixed(1)}%`}</p>
              </div>
            </div>

            {performanceRows.length === 0 ? (
              <p className="text-sm text-gray-500">No class data yet.</p>
            ) : (
              performanceRows.map((row) => {
                const width = row.avg === null ? 0 : Math.max(4, Math.round((row.avg / 100) * 100))
                return (
                  <div key={row.classId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span className="truncate pr-2">{row.className}</span>
                      <span className="font-medium text-gray-800">
                        {row.avg === null ? 'N/A' : `${row.avg.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-gray-100">
                      <div
                        className="h-2 rounded bg-green-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">Entries: {row.sampleSize}</p>
                  </div>
                )
              })
            )}
            {bestAverage > 0 && (
              <p className="text-xs text-gray-500 pt-1">
                Highest class average: {bestAverage.toFixed(1)}%
              </p>
            )}

            <div className="pt-2 space-y-1">
              <p className="text-xs font-medium text-gray-700">Top performers</p>
              {topPerformers.length === 0 ? (
                <p className="text-xs text-gray-500">No scored entries yet.</p>
              ) : (
                topPerformers.map((row) => (
                  <p key={`top-${row.studentId}`} className="text-xs text-gray-700">{row.name}: {row.total}</p>
                ))
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700">Bottom performers</p>
              {bottomPerformers.length === 0 ? (
                <p className="text-xs text-gray-500">No scored entries yet.</p>
              ) : (
                bottomPerformers.map((row) => (
                  <p key={`bottom-${row.studentId}`} className="text-xs text-gray-700">{row.name}: {row.total}</p>
                ))
              )}
            </div>

            <div className="space-y-1 pt-1">
              <p className="text-xs font-medium text-gray-700">Grade distribution</p>
              <div className="grid grid-cols-6 gap-1 text-center text-xs">
                {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((g) => (
                  <div key={g} className="rounded border bg-gray-50 p-1">
                    <p className="font-semibold text-gray-800">{g}</p>
                    <p className="text-gray-600">{gradeBands[g]}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications / Inbox</CardTitle>
            <CardDescription>Announcements, parent messages, and action-required alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-500">No announcements yet.</p>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{ann.title}</p>
                    {ann.is_urgent ? <Badge variant="destructive">Urgent</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{new Date(ann.created_at).toLocaleString()}</p>
                  {ann.content ? <p className="mt-2 text-sm text-gray-700 line-clamp-2">{ann.content}</p> : null}
                </div>
              ))
            )}

            <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
              Parent messages: Messaging module coming soon.
            </div>

            <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-900">
              Action required: {pendingScoreEntries > 0 ? `${pendingScoreEntries} score entries missing.` : 'No urgent score actions.'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Attendance + Behavior</CardTitle>
            <CardDescription>Attendance trend and repeated-absence indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded border bg-gray-50 p-2">
              Daily/weekly trend: Not available yet (requires dated attendance logs).
            </div>
            <div className="rounded border bg-orange-50 p-2 text-orange-900">
              Repeated low attendance (&lt;75%): <span className="font-semibold">{lowAttendanceStudents.size}</span>
            </div>
            <div className="rounded border bg-gray-50 p-2 text-gray-600">
              Behavior notes: Feature not enabled.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isClassTeacher ? 'Class Teacher Focus' : 'Subject Teacher Focus'}</CardTitle>
            <CardDescription>Role-specific execution blocks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isClassTeacher ? (
              <>
                <div className="rounded border bg-blue-50 p-2 text-blue-900">Homeroom attendance completion: {classIds.length > 0 ? `${classIds.length - attendancePendingClasses}/${classIds.length}` : 'N/A'}</div>
                <div className="rounded border bg-gray-50 p-2 text-gray-700">Class progression summary: pending report lock workflow.</div>
                <div className="rounded border bg-gray-50 p-2 text-gray-700">Conduct/remarks readiness: integrate class teacher remarks module.</div>
              </>
            ) : (
              <>
                <div className="rounded border bg-green-50 p-2 text-green-900">Subject score completion by class: {assignmentPairsCount > 0 ? `${assignmentPairsCount - incompleteByPair}/${assignmentPairsCount}` : 'N/A'}</div>
                <div className="rounded border bg-gray-50 p-2 text-gray-700">Missing practical/continuous assessment entries: {pendingScoreEntries}</div>
                <div className="rounded border bg-gray-50 p-2 text-gray-700">Moderation queue: awaiting moderation module.</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guardrails & Quality Checks</CardTitle>
            <CardDescription>Publish blockers, outlier checks, and overwrite safety</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className={`rounded border p-2 ${pendingScoreEntries > 0 ? 'bg-red-50 text-red-900' : 'bg-green-50 text-green-900'}`}>
              Publish gate: {pendingScoreEntries > 0 ? 'Blocked (missing required scores)' : 'Ready'}
            </div>
            <div className={`rounded border p-2 ${outlierEntries > 0 ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-700'}`}>
              Outlier score alerts: {outlierEntries}
            </div>
            <div className="rounded border bg-gray-50 p-2 text-gray-700">
              Confirm before overwrite: enforced in score/attendance save workflow.
            </div>
            <div className="rounded border bg-gray-50 p-2 text-gray-700">
              Autosave drafts: not enabled yet.
            </div>
          </CardContent>
        </Card>
      </div>

      {!currentSession && (
        <Card>
          <CardContent className="py-6 text-sm text-gray-700">
            No active term. Configure current academic session to unlock session-based analytics.
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/teacher/profile">Contact Admin</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {assignmentPairsCount === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-gray-700">
            No assessments created yet for your assignments.
            <div className="mt-3">
              <Button asChild size="sm">
                <Link href="/teacher/assessments?mode=create">Create First Assessment</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
