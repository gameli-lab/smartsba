'use server'

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Score } from '@/types'

interface ScoreInput {
  student_id: string
  subject_id: string
  session_id: string
  ca_score?: number
  exam_score?: number
  subject_remark?: string
}

interface UpdateScoreInput extends Partial<ScoreInput> {
  id: string
}

interface ImportRow {
  student_admission: string
  subject_name: string
  ca_score?: number
  exam_score?: number
  subject_remark?: string
}

interface ImportFailure {
  row: number
  reason: string
}

interface ImportResult {
  imported: number
  failed: ImportFailure[]
}

function normalizeScore(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  const num = Number(value)
  if (Number.isNaN(num) || num < 0 || num > 100) return undefined
  return Math.min(100, Math.max(0, num))
}

function normalizeString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text.length ? text : undefined
}

function calculateGrade(total: number): string {
  if (total >= 90) return 'A'
  if (total >= 80) return 'B'
  if (total >= 70) return 'C'
  if (total >= 60) return 'D'
  if (total >= 50) return 'E'
  return 'F'
}

async function buildTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Scores')

  sheet.columns = [
    { header: 'Student Admission*', key: 'student_admission', width: 20 },
    { header: 'Subject Name*', key: 'subject_name', width: 25 },
    { header: 'CA Score (0-40)', key: 'ca_score', width: 15 },
    { header: 'Exam Score (0-60)', key: 'exam_score', width: 15 },
    { header: 'Remark', key: 'subject_remark', width: 30 },
  ]

  sheet.addRow({
    student_admission: 'ADM-001',
    subject_name: 'Mathematics',
    ca_score: 35,
    exam_score: 55,
    subject_remark: 'Excellent performance',
  })

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

  return workbook
}

export async function getScoresTemplate() {
  const workbook = await buildTemplateWorkbook()
  const buffer = await workbook.xlsx.writeBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { success: true, filename: 'scores_template.xlsx', base64 }
}

export async function createScore(input: ScoreInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.student_id || !input.subject_id || !input.session_id) {
      return { success: false, error: 'Student, subject, and session are required' }
    }

    // Verify student belongs to school
    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('id', input.student_id)
      .single()

    const student = studentRow as { id: string; school_id: string } | null
    if (!student || student.school_id !== schoolId) {
      return { success: false, error: 'Student not found' }
    }

    // Verify subject belongs to school
    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('id, school_id')
      .eq('id', input.subject_id)
      .single()

    const subject = subjectRow as { id: string; school_id: string } | null
    if (!subject || subject.school_id !== schoolId) {
      return { success: false, error: 'Subject not found' }
    }

    // Verify session belongs to school
    const { data: sessionRow } = await supabase
      .from('academic_sessions')
      .select('id, school_id')
      .eq('id', input.session_id)
      .single()

    const session = sessionRow as { id: string; school_id: string } | null
    if (!session || session.school_id !== schoolId) {
      return { success: false, error: 'Session not found' }
    }

    // Check for duplicate score (student, subject, session)
    const { data: existing } = await supabase
      .from('scores')
      .select('id')
      .eq('student_id', input.student_id)
      .eq('subject_id', input.subject_id)
      .eq('session_id', input.session_id)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'Score already exists for this student/subject/session combination' }
    }

    const totalScore = (input.ca_score || 0) + (input.exam_score || 0)
    const grade = totalScore > 0 ? calculateGrade(totalScore) : undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('scores')
      .insert({
        student_id: input.student_id,
        subject_id: input.subject_id,
        session_id: input.session_id,
        ca_score: input.ca_score || null,
        exam_score: input.exam_score || null,
        total_score: totalScore || null,
        grade: grade || null,
        subject_remark: input.subject_remark || null,
        entered_by: profile.user_id,
      })

    if (error) {
      console.error('Error creating score:', error)
      return { success: false, error: 'Failed to create score' }
    }

    revalidatePath('/school-admin/scores-assessments')
    return { success: true }
  } catch (error) {
    console.error('Error in createScore:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateScore(input: UpdateScoreInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!input.id) return { success: false, error: 'Score ID is required' }

    const { data: scoreRow } = await supabase
      .from('scores')
      .select('id, student_id, session_id')
      .eq('id', input.id)
      .single()

    const score = scoreRow as { id: string; student_id: string; session_id: string } | null
    if (!score) return { success: false, error: 'Score not found' }

    // Verify student ownership
    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('id', score.student_id)
      .single()

    const student = studentRow as { id: string; school_id: string } | null
    if (!student || student.school_id !== schoolId) {
      return { success: false, error: 'Student not found' }
    }

    const nextCa = input.ca_score !== undefined ? input.ca_score : null
    const nextExam = input.exam_score !== undefined ? input.exam_score : null
    const totalScore =
      (nextCa !== null ? nextCa : 0) + (nextExam !== null ? nextExam : 0)
    const grade = totalScore > 0 ? calculateGrade(totalScore) : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('scores')
      .update({
        ...(input.ca_score !== undefined && { ca_score: input.ca_score || null }),
        ...(input.exam_score !== undefined && { exam_score: input.exam_score || null }),
        total_score: totalScore || null,
        grade: grade,
        ...(input.subject_remark !== undefined && { subject_remark: input.subject_remark || null }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)

    if (error) {
      console.error('Error updating score:', error)
      return { success: false, error: 'Failed to update score' }
    }

    revalidatePath('/school-admin/scores-assessments')
    return { success: true }
  } catch (error) {
    console.error('Error in updateScore:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function deleteScore(id: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    if (!id) return { success: false, error: 'Score ID is required' }

    const { data: scoreRow } = await supabase
      .from('scores')
      .select('id, student_id')
      .eq('id', id)
      .single()

    const score = scoreRow as { id: string; student_id: string } | null
    if (!score) return { success: false, error: 'Score not found' }

    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('id', score.student_id)
      .single()

    const student = studentRow as { id: string; school_id: string } | null
    if (!student || student.school_id !== schoolId) {
      return { success: false, error: 'Student not found' }
    }

    const { error } = await supabase.from('scores').delete().eq('id', id)

    if (error) {
      console.error('Error deleting score:', error)
      return { success: false, error: 'Failed to delete score' }
    }

    revalidatePath('/school-admin/scores-assessments')
    return { success: true }
  } catch (error) {
    console.error('Error in deleteScore:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function importScores(formData: FormData, sessionId: string): Promise<{ success: boolean; result?: ImportResult; error?: string }> {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'Please select an Excel file to import' }
    if (file.size > 5 * 1024 * 1024) return { success: false, error: 'File size exceeds 5MB limit' }

    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    if (!allowedTypes.includes(file.type)) return { success: false, error: 'Only Excel .xlsx files are supported' }

    // Verify session belongs to school
    const { data: sessionRow } = await supabase
      .from('academic_sessions')
      .select('id, school_id')
      .eq('id', sessionId)
      .single()

    const session = sessionRow as { id: string; school_id: string } | null
    if (!session || session.school_id !== schoolId) {
      return { success: false, error: 'Session not found' }
    }

    const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)
    const sheet = workbook.worksheets[0]
    if (!sheet) return { success: false, error: 'Excel file is empty or invalid' }

    // Fetch students and subjects for lookup
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, admission_number, school_id')
      .eq('school_id', schoolId)

    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('id, name, school_id')
      .eq('school_id', schoolId)

    const studentMap = new Map<string, string>()
    ;(studentsData || []).forEach((s: { id: string; admission_number: string }) => {
      studentMap.set(s.admission_number.trim().toLowerCase(), s.id)
    })

    const subjectMap = new Map<string, string>()
    ;(subjectsData || []).forEach((s: { id: string; name: string }) => {
      subjectMap.set(s.name.trim().toLowerCase(), s.id)
    })

    const failures: ImportFailure[] = []
    let successCount = 0

    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex)
      const studentAdmission = normalizeString(row.getCell(1).value)
      const subjectName = normalizeString(row.getCell(2).value)
      const caScore = normalizeScore(row.getCell(3).value)
      const examScore = normalizeScore(row.getCell(4).value)
      const remark = normalizeString(row.getCell(5).value)

      if (!studentAdmission && !subjectName) continue

      if (!studentAdmission || !subjectName) {
        failures.push({ row: rowIndex, reason: 'Missing student admission or subject name' })
        continue
      }

      const studentId = studentMap.get(studentAdmission.trim().toLowerCase())
      if (!studentId) {
        failures.push({ row: rowIndex, reason: `Student not found: ${studentAdmission}` })
        continue
      }

      const subjectId = subjectMap.get(subjectName.trim().toLowerCase())
      if (!subjectId) {
        failures.push({ row: rowIndex, reason: `Subject not found: ${subjectName}` })
        continue
      }

      // Check for existing score
      const { data: existing } = await supabase
        .from('scores')
        .select('id')
        .eq('student_id', studentId)
        .eq('subject_id', subjectId)
        .eq('session_id', sessionId)
        .maybeSingle()

      if (existing) {
        failures.push({ row: rowIndex, reason: `Score already exists for this student/subject/session` })
        continue
      }

      const totalScore = (caScore || 0) + (examScore || 0)
      const grade = totalScore > 0 ? calculateGrade(totalScore) : undefined

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('scores')
        .insert({
          student_id: studentId,
          subject_id: subjectId,
          session_id: sessionId,
          ca_score: caScore || null,
          exam_score: examScore || null,
          total_score: totalScore || null,
          grade: grade || null,
          subject_remark: remark || null,
          entered_by: profile.user_id,
        })

      if (error) {
        failures.push({ row: rowIndex, reason: error.message })
        continue
      }

      successCount += 1
    }

    if (successCount > 0) {
      revalidatePath('/school-admin/scores-assessments')
    }

    return { success: true, result: { imported: successCount, failed: failures } }
  } catch (error) {
    console.error('Error in importScores:', error)
    return { success: false, error: 'Failed to import scores' }
  }
}
