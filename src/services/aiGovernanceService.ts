import type { UserRole } from '@/types'

export type AITaskType = 'switch_role' | 'feature_audit' | 'security_audit' | 'test_plan'

export interface FeatureItem {
  title: string
  route: string
  check: string
}

export interface SecurityFinding {
  severity: 'low' | 'medium' | 'high'
  area: string
  finding: string
  suggested_fix: string
}

export interface TestCaseItem {
  id: string
  title: string
  role: UserRole
  route: string
  objective: string
  preconditions: string[]
  steps: string[]
  expected_result: string
  priority: 'high' | 'medium' | 'low'
}

export interface AICommandInput {
  actorRole: UserRole
  task: AITaskType
  targetRole?: UserRole
  focus?: string
}

export interface AICommandOutput {
  actor_role: UserRole
  task: AITaskType
  accessible_roles: UserRole[]
  role_switch?: {
    target_role: UserRole
    allowed: boolean
    route: string | null
    note: string
  }
  feature_checklist?: FeatureItem[]
  security_findings?: SecurityFinding[]
  test_cases?: TestCaseItem[]
  next_steps: string[]
}

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: '/dashboard/super-admin',
  school_admin: '/school-admin',
  teacher: '/teacher',
  student: '/student',
  parent: '/parent',
}

function getAccessibleRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === 'super_admin') return ['super_admin', 'school_admin', 'teacher', 'student', 'parent']
  if (actorRole === 'school_admin') return ['school_admin', 'teacher', 'student', 'parent']
  return [actorRole]
}

function getFeatureChecklist(targetRole: UserRole): FeatureItem[] {
  const roleFeatures: Record<UserRole, FeatureItem[]> = {
    super_admin: [
      { title: 'Schools management', route: '/dashboard/super-admin/schools', check: 'Create, edit, disable school works end-to-end' },
      { title: 'System users', route: '/dashboard/super-admin/users', check: 'User listing and role filters return correct records' },
      { title: 'Audit logs', route: '/dashboard/super-admin/audit-logs', check: 'Critical actions appear with actor and timestamp' },
      { title: 'Platform analytics', route: '/dashboard/super-admin/analytics', check: 'Metrics cards and charts load with valid totals' },
    ],
    school_admin: [
      { title: 'Teacher management', route: '/school-admin/teachers', check: 'Create/import/edit/delete teacher and status transitions' },
      { title: 'Student management', route: '/school-admin/students', check: 'Create/import/edit/delete student and class linkage' },
      { title: 'Class management', route: '/school-admin/classes', check: 'Create/edit classes with class-teacher assignment' },
      { title: 'Teacher assignments', route: '/school-admin/teacher-assignments', check: 'Subject assignment and class teacher mapping are visible' },
      { title: 'Academic sessions', route: '/school-admin/academic-sessions', check: 'Current session switch and term/year integrity works' },
      { title: 'Reports', route: '/school-admin/reports', check: 'Student/class report generation and preview renders correctly' },
    ],
    teacher: [
      { title: 'Teacher dashboard', route: '/teacher/dashboard', check: 'Assigned classes/subjects and metrics are accurate' },
      { title: 'Assessments', route: '/teacher/assessments', check: 'Score entry and updates persist correctly' },
      { title: 'Attendance', route: '/teacher/attendance', check: 'Attendance CRUD and percentage calculations are correct' },
      { title: 'Class views', route: '/teacher/classes', check: 'Class rosters and subject scope respect assignments' },
    ],
    student: [
      { title: 'Student dashboard', route: '/student', check: 'Profile, class and key metrics are loaded without null state regressions' },
      { title: 'Results', route: '/student/results', check: 'Scores and grades are visible for current/past sessions' },
      { title: 'Performance', route: '/student/performance', check: 'Trend charts and aggregate performance render correctly' },
      { title: 'Announcements', route: '/student/announcements', check: 'Announcements target the student role correctly' },
    ],
    parent: [
      { title: 'Parent dashboard', route: '/parent', check: 'Ward selector and summary cards resolve correctly' },
      { title: 'Ward results', route: '/parent/results', check: 'Ward score views only show linked children' },
      { title: 'Ward performance', route: '/parent/performance', check: 'Trends and class context match selected ward' },
      { title: 'Announcements', route: '/parent/announcements', check: 'Role/ward announcements are scoped properly' },
    ],
  }

  return roleFeatures[targetRole]
}

function getSecurityFindings(actorRole: UserRole, focus?: string): SecurityFinding[] {
  const base: SecurityFinding[] = [
    {
      severity: 'high',
      area: 'Authorization',
      finding: 'Role switching can become privilege escalation if role is trusted from client input.',
      suggested_fix: 'Always derive actor role from server-side profile and enforce an allow-list per role.',
    },
    {
      severity: 'high',
      area: 'Data isolation',
      finding: 'Cross-school data leakage risk in service-role queries without school scoping.',
      suggested_fix: 'Require school_id filters and ownership checks before every read/write path.',
    },
    {
      severity: 'medium',
      area: 'Prompt injection',
      finding: 'AI assistants can be manipulated by malicious content in user-generated data.',
      suggested_fix: 'Apply retrieval allow-lists, strip unsafe instructions, and block tool execution by default.',
    },
    {
      severity: 'medium',
      area: 'Secrets handling',
      finding: 'Exposed tokens in local files or logs can compromise infrastructure.',
      suggested_fix: 'Rotate exposed tokens, avoid rendering secret-like strings, and add pre-commit secret scanning.',
    },
    {
      severity: 'low',
      area: 'Auditability',
      finding: 'Insufficient logging of AI actions can hinder incident response.',
      suggested_fix: 'Log actor, task, target scope, and outcome for each AI command.',
    },
  ]

  if (!focus) return base
  const q = focus.toLowerCase()
  return base.filter((f) => f.area.toLowerCase().includes(q) || f.finding.toLowerCase().includes(q))
}

function buildTestCases(targetRole: UserRole): TestCaseItem[] {
  const checks = getFeatureChecklist(targetRole)

  return checks.map((item, index) => ({
    id: `${targetRole}-${index + 1}`,
    title: `${item.title} validation`,
    role: targetRole,
    route: item.route,
    objective: item.check,
    preconditions: [
      `User is authenticated as ${targetRole.replace('_', ' ')}`,
      `User can access ${item.route}`,
    ],
    steps: [
      `Navigate to ${item.route}`,
      'Perform the feature flow with valid data',
      'Repeat with invalid/edge input and observe validation behavior',
      'Refresh and verify persisted state remains correct',
    ],
    expected_result: item.check,
    priority: index < 2 ? 'high' : 'medium',
  }))
}

export function runAICommand(input: AICommandInput): AICommandOutput {
  const accessibleRoles = getAccessibleRoles(input.actorRole)

  if (input.task === 'switch_role') {
    const targetRole = input.targetRole || input.actorRole
    const allowed = accessibleRoles.includes(targetRole)
    return {
      actor_role: input.actorRole,
      task: input.task,
      accessible_roles: accessibleRoles,
      role_switch: {
        target_role: targetRole,
        allowed,
        route: allowed ? ROLE_HOME[targetRole] : null,
        note: allowed
          ? 'Role context switch granted for guided testing/documentation. Authorization still enforced by route guards.'
          : 'Role context switch denied. Your current role cannot switch to that target role.',
      },
      next_steps: allowed
        ? [`Open ${ROLE_HOME[targetRole]} and execute checklist for ${targetRole}.`, 'Record outcomes in audit logs and test notes.']
        : ['Choose one of your accessible roles.', 'Escalate to super admin for broader cross-role audits.'],
    }
  }

  if (input.task === 'feature_audit') {
    const role = input.targetRole && accessibleRoles.includes(input.targetRole) ? input.targetRole : input.actorRole
    const checklist = getFeatureChecklist(role)
    return {
      actor_role: input.actorRole,
      task: input.task,
      accessible_roles: accessibleRoles,
      feature_checklist: checklist,
      next_steps: [
        'Run each checklist item manually and capture pass/fail evidence.',
        'Convert failed checks into regression tests under tests/.',
      ],
    }
  }

  if (input.task === 'test_plan') {
    const role = input.targetRole && accessibleRoles.includes(input.targetRole) ? input.targetRole : input.actorRole
    const testCases = buildTestCases(role)

    return {
      actor_role: input.actorRole,
      task: input.task,
      accessible_roles: accessibleRoles,
      test_cases: testCases,
      next_steps: [
        'Execute high-priority tests first and capture screenshots/logs.',
        'Convert failing tests into automated regression tests under tests/.',
      ],
    }
  }

  const findings = getSecurityFindings(input.actorRole, input.focus)
  return {
    actor_role: input.actorRole,
    task: input.task,
    accessible_roles: accessibleRoles,
    security_findings: findings,
    next_steps: [
      'Prioritize high severity findings first.',
      'Implement fixes with audit trail and add security test cases.',
    ],
  }
}
