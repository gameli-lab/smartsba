export interface TeacherDashboardFilters {
  classId?: string
  subjectId?: string
  sessionId?: string
}

export interface TeacherDashboardSummary {
  todaysClasses: number
  pendingScoresToSubmit: number
  attendanceNotMarked: number
  reportsDueThisWeek: number
  atRiskStudents: number
}

export interface TeacherDashboardQuickAction {
  key: string
  label: string
  href: string
  enabled: boolean
  reason?: string
}

export interface TeacherWorkloadPanel {
  currentSession: {
    id: string
    academicYear: string
    term: number
  } | null
  availableSessions: Array<{
    id: string
    academicYear: string
    term: number
    isCurrent: boolean
  }>
  assignedClasses: Array<{
    id: string
    name: string
    level: number | null
    stream: string | null
    studentCount: number
    subjects: Array<{ id: string; name: string }>
  }>
  selectedClassId?: string
  selectedSubjectId?: string
  selectedSessionId?: string
  nextUpcomingLesson: {
    available: boolean
    message: string
  }
}

export interface TeacherAssessmentPipeline {
  draftAssessments: number
  submittedIncomplete: number
  readyForModeration: number
  published: number
  missingEntriesByStudent: number
}

export interface TeacherPerformanceInsights {
  meanScore: number | null
  passRate: number | null
  topPerformers: Array<{ studentId: string; name: string; aggregate: number }>
  bottomPerformers: Array<{ studentId: string; name: string; aggregate: number }>
  gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number>
  classAverages: Array<{ classId: string; className: string; average: number | null; passRate: number | null; entries: number }>
}

export interface TeacherAttendanceBehavior {
  repeatedAbsenceCount: number
  trendAvailable: boolean
  trendMessage: string
  behaviorNotesEnabled: boolean
}

export interface TeacherNotificationsInbox {
  adminAnnouncements: Array<{
    id: string
    title: string
    content?: string | null
    createdAt: string
    isUrgent: boolean
  }>
  parentMessages: {
    available: boolean
    message: string
  }
  actionRequiredAlerts: Array<{ id: string; label: string; href: string }>
}

export interface TeacherRoleSpecific {
  role: 'class_teacher' | 'subject_teacher'
  blocks: Array<{ id: string; label: string; value: string }>
}

export interface TeacherGuardrails {
  canPublishOrLock: boolean
  publishBlockReason?: string
  outlierScoreAlerts: number
  autosaveEnabled: boolean
  overwriteConfirmationRequired: boolean
}

export interface TeacherDashboardBackendData {
  summary: TeacherDashboardSummary
  quickActions: TeacherDashboardQuickAction[]
  workload: TeacherWorkloadPanel
  assessmentPipeline: TeacherAssessmentPipeline
  performance: TeacherPerformanceInsights
  attendanceBehavior: TeacherAttendanceBehavior
  notifications: TeacherNotificationsInbox
  roleSpecific: TeacherRoleSpecific
  guardrails: TeacherGuardrails
}
