import { createServerComponentClient } from '@/lib/supabase'
import { TeacherAssignment, UserProfile } from '@/types'
import {
  TeacherDashboardBackendData,
  TeacherDashboardFilters,
  TeacherDashboardQuickAction,
} from '@/types/teacher-dashboard'

interface BuildTeacherDashboardInput {
  profile: UserProfile
  assignments: TeacherAssignment[]
  effectiveRole: 'class_teacher' | 'subject_teacher'
  filters?: TeacherDashboardFilters
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  if (score >= 50) return 'E'
  return 'F'
}

export async function buildTeacherDashboardData(
  input: BuildTeacherDashboardInput
): Promise<TeacherDashboardBackendData> {
  const { profile, assignments, effectiveRole, filters } = input
  const supabase = await createServerComponentClient()

  const classIds = Array.from(new Set(assignments.map((a) => a.class_id).filter(Boolean))) as string[]
  const subjectIds = Array.from(new Set(assignments.map((a) => a.subject_id).filter(Boolean))) as string[]
  const assignmentPairs = Array.from(
    new Set(assignments.filter((a) => a.class_id && a.subject_id).map((a) => `${a.class_id}__${a.subject_id}`))
  )

  const [{ data: classesData }, { data: subjectsData }, { data: sessionsData }, { data: announcementsData }, { data: studentsData }] = await Promise.all([
    classIds.length
      ? supabase.from('classes').select('id, name, level, stream').in('id', classIds)
      : Promise.resolve({ data: [], error: null } as const),
    classIds.length
      ? supabase.from('subjects').select('id, name, class_id').in('class_id', classIds)
      : Promise.resolve({ data: [], error: null } as const),
    supabase
      .from('academic_sessions')
      .select('id, academic_year, term, is_current')
      .eq('school_id', profile.school_id)
      .order('start_date', { ascending: false }),
    supabase
      .from('announcements')
      .select('id, title, content, created_at, is_urgent')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
      .limit(8),
    classIds.length
      ? supabase
          .from('students')
          .select('id, class_id, admission_number, user_profile:user_profiles!inner(full_name)')
          .in('class_id', classIds)
      : Promise.resolve({ data: [], error: null } as const),
  ])

  const classes = (classesData || []) as Array<{ id: string; name: string; level: number | null; stream: string | null }>
  const subjects = (subjectsData || []) as Array<{ id: string; name: string; class_id: string }>
  const sessions = (sessionsData || []) as Array<{ id: string; academic_year: string; term: number; is_current: boolean }>
  const announcements = (announcementsData || []) as Array<{
    id: string
    title: string
    content?: string | null
    created_at: string
    is_urgent?: boolean | null
  }>
  const students = (studentsData || []) as Array<{
    id: string
    class_id: string
    admission_number: string
    user_profile: { full_name: string }
  }>

  const currentSession = sessions.find((s) => s.is_current) || sessions[0] || null
  const selectedSessionId = filters?.sessionId || currentSession?.id
  const selectedClassId = filters?.classId || classIds[0]
  const selectedSubjectId = filters?.subjectId || subjects.find((s) => s.class_id === selectedClassId)?.id

  const studentIds = students.map((s) => s.id)

  const [{ data: scoresData }, { data: attendanceData }] = await Promise.all([
    selectedSessionId && classIds.length && subjectIds.length
      ? supabase
          .from('scores')
          .select('class_id, subject_id, student_id, total_score, grade')
          .eq('session_id', selectedSessionId)
          .in('class_id', classIds)
          .in('subject_id', subjectIds)
      : Promise.resolve({ data: [], error: null } as const),
    selectedSessionId && studentIds.length
      ? supabase
          .from('attendance')
          .select('student_id, present_days, total_days, percentage')
          .eq('session_id', selectedSessionId)
          .in('student_id', studentIds)
      : Promise.resolve({ data: [], error: null } as const),
  ])

  const scores = (scoresData || []) as Array<{
    class_id: string
    subject_id: string
    student_id: string
    total_score: number | null
    grade?: string | null
  }>

  const attendance = (attendanceData || []) as Array<{
    student_id: string
    present_days: number
    total_days: number
    percentage: number
  }>

  const classStudentCount = new Map<string, number>()
  students.forEach((s) => classStudentCount.set(s.class_id, (classStudentCount.get(s.class_id) || 0) + 1))

  const studentClassMap = new Map<string, string>()
  students.forEach((s) => studentClassMap.set(s.id, s.class_id))

  const attendanceCoveredClasses = new Set<string>()
  attendance.forEach((row) => {
    const classId = studentClassMap.get(row.student_id)
    if (classId) attendanceCoveredClasses.add(classId)
  })

  const attendanceNotMarked = classIds.filter((id) => !attendanceCoveredClasses.has(id)).length

  const scoreCoverageMap = new Map<string, Set<string>>()
  scores.forEach((row) => {
    const key = `${row.class_id}__${row.subject_id}`
    const set = scoreCoverageMap.get(key) || new Set<string>()
    set.add(row.student_id)
    scoreCoverageMap.set(key, set)
  })

  let pendingScoresToSubmit = 0
  assignmentPairs.forEach((pairKey) => {
    const classId = pairKey.split('__')[0]
    const expected = classStudentCount.get(classId) || 0
    const actual = scoreCoverageMap.get(pairKey)?.size || 0
    pendingScoresToSubmit += Math.max(0, expected - actual)
  })

  const lowScoreStudents = new Set(scores.filter((r) => r.total_score !== null && r.total_score < 50).map((r) => r.student_id))
  const lowAttendanceStudents = new Set(attendance.filter((r) => r.percentage < 75).map((r) => r.student_id))
  const atRiskStudents = new Set<string>([...Array.from(lowScoreStudents), ...Array.from(lowAttendanceStudents)]).size

  const selectedScores = scores.filter((row) => {
    if (selectedClassId && row.class_id !== selectedClassId) return false
    if (selectedSubjectId && row.subject_id !== selectedSubjectId) return false
    return true
  })

  const meanScore = selectedScores.length
    ? selectedScores.reduce((sum, row) => sum + (row.total_score || 0), 0) / selectedScores.length
    : null

  const passRate = selectedScores.length
    ? (selectedScores.filter((r) => (r.total_score || 0) >= 50).length / selectedScores.length) * 100
    : null

  const gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
  }

  selectedScores.forEach((row) => {
    if (row.total_score === null) return
    const derived = row.grade || gradeFromScore(row.total_score)
    const grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' =
      derived === 'A' || derived === 'B' || derived === 'C' || derived === 'D' || derived === 'E' || derived === 'F'
        ? derived
        : gradeFromScore(row.total_score)
    gradeDistribution[grade] += 1
  })

  const studentNameMap = new Map<string, string>()
  students.forEach((s) => studentNameMap.set(s.id, s.user_profile.full_name))

  const aggregateByStudent = new Map<string, number>()
  selectedScores.forEach((row) => {
    if (row.total_score === null) return
    aggregateByStudent.set(row.student_id, (aggregateByStudent.get(row.student_id) || 0) + row.total_score)
  })

  const ranked = [...aggregateByStudent.entries()]
    .map(([studentId, aggregate]) => ({ studentId, name: studentNameMap.get(studentId) || 'Student', aggregate }))
    .sort((a, b) => b.aggregate - a.aggregate)

  const classAverages = classes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((klass) => {
      const classScores = scores.filter((s) => s.class_id === klass.id && s.total_score !== null)
      const average = classScores.length
        ? classScores.reduce((sum, row) => sum + (row.total_score || 0), 0) / classScores.length
        : null
      const classPassRate = classScores.length
        ? (classScores.filter((row) => (row.total_score || 0) >= 50).length / classScores.length) * 100
        : null

      return {
        classId: klass.id,
        className: `${klass.name}${klass.stream ? ` • ${klass.stream}` : ''}${klass.level ? ` • Level ${klass.level}` : ''}`,
        average,
        passRate: classPassRate,
        entries: classScores.length,
      }
    })

  const classSubjectMap = new Map<string, Array<{ id: string; name: string }>>()
  subjects.forEach((subject) => {
    const arr = classSubjectMap.get(subject.class_id) || []
    arr.push({ id: subject.id, name: subject.name })
    classSubjectMap.set(subject.class_id, arr)
  })

  const assignedClasses = classes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((klass) => ({
      id: klass.id,
      name: klass.name,
      level: klass.level,
      stream: klass.stream,
      studentCount: classStudentCount.get(klass.id) || 0,
      subjects: classSubjectMap.get(klass.id) || [],
    }))

  const submittedIncomplete = assignmentPairs.filter((pairKey) => {
    const classId = pairKey.split('__')[0]
    const expected = classStudentCount.get(classId) || 0
    const actual = scoreCoverageMap.get(pairKey)?.size || 0
    return actual < expected
  }).length

  const outlierScoreAlerts = scores.filter(
    (row) => row.total_score !== null && ((row.total_score || 0) < 20 || (row.total_score || 0) > 98)
  ).length

  const canPublishOrLock = effectiveRole === 'class_teacher' && pendingScoresToSubmit === 0 && !!selectedSessionId

  const quickActions: TeacherDashboardQuickAction[] = [
    { key: 'attendance', label: 'Mark Attendance', href: '/teacher/attendance', enabled: true },
    { key: 'scores', label: 'Enter Scores', href: '/teacher/assessments', enabled: true },
    { key: 'register', label: 'View Class Register', href: '/teacher/classes', enabled: true },
    { key: 'create_assessment', label: 'Create Assignment/Test', href: '/teacher/assessments?mode=create', enabled: true },
    {
      key: 'publish_lock',
      label: 'Publish/Lock Term Scores',
      href: '/teacher/reports',
      enabled: canPublishOrLock,
      reason: canPublishOrLock
        ? undefined
        : effectiveRole !== 'class_teacher'
          ? 'Class-teacher only.'
          : 'Complete all required score entries first.',
    },
  ]

  return {
    summary: {
      todaysClasses: classIds.length,
      pendingScoresToSubmit,
      attendanceNotMarked,
      reportsDueThisWeek: effectiveRole === 'class_teacher' ? attendanceNotMarked : 0,
      atRiskStudents,
    },
    quickActions,
    workload: {
      currentSession: currentSession
        ? {
            id: currentSession.id,
            academicYear: currentSession.academic_year,
            term: currentSession.term,
          }
        : null,
      availableSessions: sessions.map((session) => ({
        id: session.id,
        academicYear: session.academic_year,
        term: session.term,
        isCurrent: !!session.is_current,
      })),
      assignedClasses,
      selectedClassId,
      selectedSubjectId,
      selectedSessionId,
      nextUpcomingLesson: {
        available: false,
        message: 'Timetable integration pending.',
      },
    },
    assessmentPipeline: {
      draftAssessments: 0,
      submittedIncomplete,
      readyForModeration: Math.max(0, assignmentPairs.length - submittedIncomplete),
      published: 0,
      missingEntriesByStudent: pendingScoresToSubmit,
    },
    performance: {
      meanScore,
      passRate,
      topPerformers: ranked.slice(0, 3),
      bottomPerformers: ranked.slice(-3).reverse(),
      gradeDistribution,
      classAverages,
    },
    attendanceBehavior: {
      repeatedAbsenceCount: lowAttendanceStudents.size,
      trendAvailable: false,
      trendMessage: 'Daily/weekly trend requires dated attendance logs.',
      behaviorNotesEnabled: false,
    },
    notifications: {
      adminAnnouncements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        createdAt: a.created_at,
        isUrgent: !!a.is_urgent,
      })),
      parentMessages: {
        available: false,
        message: 'Parent messaging module pending.',
      },
      actionRequiredAlerts: [
        {
          id: 'missing-scores',
          label:
            pendingScoresToSubmit > 0
              ? `${pendingScoresToSubmit} score entries missing.`
              : 'No urgent score actions.',
          href: '/teacher/assessments',
        },
      ],
    },
    roleSpecific: {
      role: effectiveRole,
      blocks:
        effectiveRole === 'class_teacher'
          ? [
              {
                id: 'homeroom-attendance',
                label: 'Homeroom attendance completion',
                value: `${classIds.length - attendanceNotMarked}/${classIds.length}`,
              },
              {
                id: 'progression-summary',
                label: 'Class progression summary',
                value: 'Pending report lock workflow',
              },
              {
                id: 'conduct-readiness',
                label: 'Conduct/remarks readiness',
                value: 'Integrate class teacher remarks module',
              },
            ]
          : [
              {
                id: 'subject-completion',
                label: 'Subject score completion by class',
                value: `${assignmentPairs.length - submittedIncomplete}/${assignmentPairs.length}`,
              },
              {
                id: 'missing-practical',
                label: 'Missing practical/continuous assessment entries',
                value: `${pendingScoresToSubmit}`,
              },
              {
                id: 'moderation-queue',
                label: 'Moderation queue',
                value: 'Awaiting moderation module',
              },
            ],
    },
    guardrails: {
      canPublishOrLock,
      publishBlockReason: canPublishOrLock
        ? undefined
        : effectiveRole !== 'class_teacher'
          ? 'Class-teacher only.'
          : 'Missing required score entries.',
      outlierScoreAlerts,
      autosaveEnabled: false,
      overwriteConfirmationRequired: true,
    },
  }
}
