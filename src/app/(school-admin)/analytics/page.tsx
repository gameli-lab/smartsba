import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn, calculateGrade } from '@/lib/utils'
import { AcademicSession, Class } from '@/types'

interface AnalyticsFilters {
  sessionId?: string
  classId?: string
  subjectId?: string
}

interface ScoreRow {
  total_score: number | null
  grade?: string | null
  subject_id: string
  entered_by: string
  student: {
    id: string
    class_id: string | null
  }
}

interface SubjectOption {
  id: string
  name: string
  class_id?: string | null
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  // Fetch base data in parallel
  const [{ data: sessions }, { data: classes }, { data: subjects }, { data: teachers }] = await Promise.all([
    supabase
      .from('academic_sessions')
      .select('id, academic_year, term, is_current')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
    supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name, class_id')
      .eq('school_id', schoolId)
      .order('name'),
    supabase
      .from('user_profiles')
      .select('user_id')
      .eq('school_id', schoolId)
      .eq('role', 'teacher'),
  ])

  const sessionList = (sessions as AcademicSession[] | null) || []
  const classList = (classes as Pick<Class, 'id' | 'name'>[] | null) || []
  const subjectList = (subjects as SubjectOption[] | null) || []
  const totalTeachers = (teachers as { user_id: string }[] | null)?.length || 0

  // Resolve filters with sensible defaults
  const currentSessionId = sessionList.find((s) => s.is_current)?.id
  const selectedSessionId = (typeof searchParams.sessionId === 'string' && searchParams.sessionId) || currentSessionId || sessionList[0]?.id
  const selectedClassId = typeof searchParams.classId === 'string' ? searchParams.classId : undefined
  const selectedSubjectId = typeof searchParams.subjectId === 'string' ? searchParams.subjectId : undefined

  const filters: AnalyticsFilters = {
    sessionId: selectedSessionId,
    classId: selectedClassId,
    subjectId: selectedSubjectId,
  }

  // Fetch scores with necessary joins for aggregation
  let scores: ScoreRow[] = []
  if (filters.sessionId) {
    const { data: scoreRows } = await supabase
      .from('scores')
      .select('total_score, grade, subject_id, entered_by, student:students!inner(id, class_id)')
      .eq('session_id', filters.sessionId)

    const typedScores = (scoreRows as ScoreRow[] | null) || []
    scores = typedScores
      .filter((s) => (filters.classId ? s.student?.class_id === filters.classId : true))
      .filter((s) => (filters.subjectId ? s.subject_id === filters.subjectId : true))
  }

  // Build maps
  const classMap = new Map(classList.map((c) => [c.id, c.name]))
  const subjectMap = new Map(subjectList.map((s) => [s.id, s.name]))

  // Aggregations
  const classAgg: Record<string, { total: number; count: number }> = {}
  const subjectAgg: Record<string, { total: number; count: number }> = {}
  const gradeBuckets: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
  const submitters = new Set<string>()

  for (const row of scores) {
    const total = typeof row.total_score === 'number' ? row.total_score : 0
    const classId = row.student?.class_id
    const subjectId = row.subject_id
    const gradeValue = row.grade || calculateGrade(total)

    if (classId) {
      classAgg[classId] = classAgg[classId] || { total: 0, count: 0 }
      classAgg[classId].total += total
      classAgg[classId].count += 1
    }

    if (subjectId) {
      subjectAgg[subjectId] = subjectAgg[subjectId] || { total: 0, count: 0 }
      subjectAgg[subjectId].total += total
      subjectAgg[subjectId].count += 1
    }

    const bucketKey = gradeBuckets[gradeValue as keyof typeof gradeBuckets] !== undefined ? gradeValue : 'F'
    gradeBuckets[bucketKey] += 1

    if (row.entered_by) {
      submitters.add(row.entered_by)
    }
  }

  const classAverages = Object.entries(classAgg).map(([classId, { total, count }]) => ({
    classId,
    className: classMap.get(classId) || 'Unknown',
    average: count ? Number((total / count).toFixed(1)) : 0,
  })).sort((a, b) => b.average - a.average)

  const subjectAverages = Object.entries(subjectAgg).map(([subjectId, { total, count }]) => ({
    subjectId,
    subjectName: subjectMap.get(subjectId) || 'Unknown',
    average: count ? Number((total / count).toFixed(1)) : 0,
  })).sort((a, b) => b.average - a.average)

  const overallAverage = scores.length ? Number((scores.reduce((sum, s) => sum + (s.total_score || 0), 0) / scores.length).toFixed(1)) : 0
  const teachersSubmitted = submitters.size
  const teachersPending = Math.max(totalTeachers - teachersSubmitted, 0)

  const gradeDistribution = Object.entries(gradeBuckets).map(([grade, count]) => ({ grade, count }))
  const maxGradeCount = Math.max(...gradeDistribution.map((g) => g.count), 1)

  // Subject options filtered by class when a class is selected
  const filteredSubjects = filters.classId
    ? subjectList.filter((s) => s.class_id === filters.classId)
    : subjectList

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600">Read-only performance insights for your school.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select scope for analytics. Charts are read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-3" method="get">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Academic Session</label>
              <Select name="sessionId" defaultValue={filters.sessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessionList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.academic_year} • Term {s.term}{s.is_current ? ' (Current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Class</label>
              <Select name="classId" defaultValue={filters.classId}>
                <SelectTrigger>
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Subject</label>
              <Select name="subjectId" defaultValue={filters.subjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {filteredSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Overall Average" value={`${overallAverage || 0}%`} helper="Across filtered scores" />
        <StatCard title="Top Class Average" value={classAverages[0] ? `${classAverages[0].average}%` : '—'} helper={classAverages[0]?.className || 'No data'} />
        <StatCard title="Teacher Submissions" value={`${teachersSubmitted}/${totalTeachers}`} helper={`${teachersPending} pending`} />
        <StatCard title="Highest Subject Avg" value={subjectAverages[0] ? `${subjectAverages[0].average}%` : '—'} helper={subjectAverages[0]?.subjectName || 'No data'} />
      </div>

      {/* Class averages */}
      <Card>
        <CardHeader>
          <CardTitle>Class Averages</CardTitle>
          <CardDescription>Average total scores by class (filtered).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {classAverages.length === 0 ? (
            <p className="text-sm text-gray-500">No data.</p>
          ) : (
            classAverages.map((c) => (
              <div key={c.classId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">{c.className}</span>
                  <span className="text-gray-700">{c.average}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.min(c.average, 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Subject performance */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Performance</CardTitle>
          <CardDescription>Average total scores by subject.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {subjectAverages.length === 0 ? (
            <p className="text-sm text-gray-500">No data.</p>
          ) : (
            subjectAverages.map((s) => (
              <div key={s.subjectId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">{s.subjectName}</span>
                  <span className="text-gray-700">{s.average}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-green-600"
                    style={{ width: `${Math.min(s.average, 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Teacher submission performance */}
      <Card>
        <CardHeader>
          <CardTitle>Teacher Submission Performance</CardTitle>
          <CardDescription>Based on distinct score entries in the selected session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">Submitted</span>
            <span className="text-gray-700">{teachersSubmitted}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-indigo-600"
              style={{ width: `${totalTeachers ? Math.min((teachersSubmitted / totalTeachers) * 100, 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">Pending: {teachersPending} of {totalTeachers}</p>
        </CardContent>
      </Card>

      {/* Ranking distribution (grade buckets) */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking Distribution (Grades)</CardTitle>
          <CardDescription>Count of grades across filtered scores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gradeDistribution.length === 0 ? (
            <p className="text-sm text-gray-500">No data.</p>
          ) : (
            gradeDistribution.map((g) => (
              <div key={g.grade} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">Grade {g.grade}</span>
                  <span className="text-gray-700">{g.count}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className={cn('h-2 rounded-full', gradeColor(g.grade))}
                    style={{ width: `${maxGradeCount ? Math.round((g.count / maxGradeCount) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, helper }: { title: string; value: string; helper?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-gray-500">{title}</CardTitle>
        {helper && <CardDescription>{helper}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  )
}

function gradeColor(grade: string) {
  switch (grade) {
    case 'A':
      return 'bg-green-600'
    case 'B':
      return 'bg-emerald-500'
    case 'C':
      return 'bg-blue-500'
    case 'D':
      return 'bg-amber-500'
    case 'E':
      return 'bg-orange-500'
    default:
      return 'bg-red-600'
  }
}
