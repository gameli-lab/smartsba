import { createAdminSupabaseClient } from './supabase'

export interface ResultsCompletion {
  studentCount: number
  completedCount: number
  percent: number
}

export async function getResultsCompletion(schoolId: string, term: string, classId?: string): Promise<ResultsCompletion> {
  const admin = createAdminSupabaseClient()

  // Fetch student list for the scope
  let studentQuery = admin.from('students').select('id')
  studentQuery = studentQuery.eq('school_id', schoolId)
  if (classId) studentQuery = studentQuery.eq('class_id', classId)

  const { data: studentRows, error: studentError } = await studentQuery
  if (studentError) throw studentError
  const studentIds = (studentRows || []).map((r: any) => r.id)
  const studentCount = studentIds.length

  if (studentCount === 0) {
    return { studentCount: 0, completedCount: 0, percent: 0 }
  }

  // Count required assessments for the class/term
  let assessmentQuery = admin.from('assessments').select('id', { count: 'exact', head: true })
  if (classId) assessmentQuery = assessmentQuery.eq('class_id', classId)
  assessmentQuery = assessmentQuery.eq('term', term)

  const { count: requiredCount } = await assessmentQuery

  const required = Number(requiredCount || 0)
  if (required === 0) {
    return { studentCount, completedCount: 0, percent: 0 }
  }

  // Fetch scores for students in scope and count distinct assessments per student
  const scoresQuery = admin
    .from('scores')
    .select('student_id,assessment_id')
    .eq('term', term)

  if (classId) scoresQuery.eq('class_id', classId)
  else scoresQuery.eq('school_id', schoolId)

  const { data: scoreRows, error: scoreError } = await scoresQuery
  if (scoreError) throw scoreError

  const perStudent = new Map<string, Set<string>>()
  ;(scoreRows || []).forEach((r: any) => {
    if (!r || !r.student_id || !r.assessment_id) return
    if (!perStudent.has(r.student_id)) perStudent.set(r.student_id, new Set())
    perStudent.get(r.student_id)!.add(r.assessment_id)
  })

  let completedCount = 0
  for (const sid of studentIds) {
    const set = perStudent.get(sid)
    if (set && set.size >= required) completedCount += 1
  }

  const percent = studentCount === 0 ? 0 : Math.round((completedCount / studentCount) * 100)
  return { studentCount, completedCount, percent }
}

export async function getPendingPromotionsCount(schoolId: string, term: string): Promise<number> {
  const admin = createAdminSupabaseClient()
  const { count } = await admin
    .from('grading_promotions')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('term', term)
    .eq('status', 'pending')

  return Number(count || 0)
}
