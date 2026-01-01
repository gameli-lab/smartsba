'use server'

import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { ReportCardData, ClassReportData, Score, Subject, Student, UserProfile, AcademicSession } from '@/types'

export type ReportMetadata = {
  class: any
  students: Array<{ id: string; admission_number: string; user_profile: { id: string; full_name: string } }>
  classTeacher: { id: string; user_profile: { id: string; full_name: string } } | null
}

interface StudentScoreRow {
  id: string
  student_id: string
  subject_id: string
  ca_score: number | null
  exam_score: number | null
  total_score: number | null
  grade: string | null
  subject_remark: string | null
  created_at: string
  updated_at: string
}

interface StudentRow {
  id: string
  school_id: string
  user_id: string
  admission_number: string
  roll_number: string | null
  class_id: string
  date_of_birth: string
  gender: 'male' | 'female'
  guardian_name: string | null
  guardian_phone: string | null
  guardian_email: string | null
  address: string | null
  admission_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SubjectRow {
  id: string
  school_id: string
  class_id: string
  name: string
  code: string | null
  description: string | null
  is_core: boolean
  created_at: string
  updated_at: string
}

interface ClassTeacherRemarkRow {
  id: string
  student_id: string
  session_id: string
  remark: string
  promotion_status: string | null
  next_class_id: string | null
  entered_by: string
  created_at: string
  updated_at: string
}

export async function generateStudentReportCard(
  studentId: string,
  sessionId: string
): Promise<{ success: boolean; data?: ReportCardData; error?: string }> {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    // Fetch student with profile
    const { data: studentRow } = await supabase
      .from('students')
      .select(
        `
        id, school_id, user_id, admission_number, roll_number, class_id,
        date_of_birth, gender, guardian_name, guardian_phone, guardian_email,
        address, admission_date, is_active
      `
      )
      .eq('id', studentId)
      .single()

    const student = studentRow as StudentRow | null
    if (!student || student.school_id !== schoolId) {
      return { success: false, error: 'Student not found' }
    }

    // Fetch user profile
    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, phone, address, gender, date_of_birth')
      .eq('user_id', student.user_id)
      .single()

    // Fetch session
    const { data: sessionRow } = await supabase
      .from('academic_sessions')
      .select('id, school_id, academic_year, term, start_date, end_date')
      .eq('id', sessionId)
      .single()

    const session = sessionRow as AcademicSession | null
    if (!session || session.school_id !== schoolId) {
      return { success: false, error: 'Session not found' }
    }

    // Fetch class
    const { data: classRow } = await supabase
      .from('classes')
      .select('id, name, level, stream')
      .eq('id', student.class_id)
      .single()

    // Fetch school
    const { data: schoolRow } = await supabase
      .from('schools')
      .select('id, name, logo_url, stamp_url, head_signature_url')
      .eq('id', schoolId)
      .single()

    // Fetch scores
    const { data: scoresData } = await supabase
      .from('scores')
      .select(`
        id, ca_score, exam_score, total_score, grade, subject_remark,
        subjects!inner(id, name, code, description, is_core)
      `)
      .eq('student_id', studentId)
      .eq('session_id', sessionId)

    const scores = (scoresData || []).map((s: any) => ({
      id: s.id,
      ca_score: s.ca_score,
      exam_score: s.exam_score,
      total_score: s.total_score,
      grade: s.grade,
      subject_remark: s.subject_remark,
      subject: s.subjects as SubjectRow,
    })) as Array<Score & { subject: SubjectRow }>

    // Fetch class teacher remark
    const { data: remarkRow } = await supabase
      .from('class_teacher_remarks')
      .select('id, remark, promotion_status, next_class_id')
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .maybeSingle()

    // Calculate totals
    const totalCa = scores.reduce((sum, s) => sum + (s.ca_score || 0), 0)
    const totalExam = scores.reduce((sum, s) => sum + (s.exam_score || 0), 0)
    const grandTotal = totalCa + totalExam
    const average = scores.length > 0 ? grandTotal / scores.length : 0
    const aggregate = scores.reduce((sum, s) => sum + (s.total_score || 0), 0)

    return {
      success: true,
      data: {
        school: schoolRow as any,
        session,
        student: { ...student, user_profile: profileRow as any },
        class: classRow as any,
        scores,
        attendance: {} as any, // TODO: Fetch attendance if available
        class_teacher_remark: remarkRow as any,
        totals: {
          total_ca: totalCa,
          total_exam: totalExam,
          grand_total: grandTotal,
          average,
          aggregate,
          position: 0, // TODO: Calculate position
          out_of: 0, // TODO: Get total students in class
        },
      } as ReportCardData,
    }
  } catch (error) {
    console.error('Error generating student report card:', error)
    return { success: false, error: 'Failed to generate report card' }
  }
}

export async function generateClassReport(
  classId: string,
  sessionId: string
): Promise<{ success: boolean; data?: ClassReportData; error?: string }> {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    // Fetch class
    const { data: classRow } = await supabase
      .from('classes')
      .select('id, school_id, name, level, stream')
      .eq('id', classId)
      .single()

    if (!classRow || (classRow as any).school_id !== schoolId) {
      return { success: false, error: 'Class not found' }
    }

    // Fetch session
    const { data: sessionRow } = await supabase
      .from('academic_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    const session = sessionRow as AcademicSession | null
    if (!session || session.school_id !== schoolId) {
      return { success: false, error: 'Session not found' }
    }

    // Fetch school
    const { data: schoolRow } = await supabase
      .from('schools')
      .select('id, name, logo_url, stamp_url')
      .eq('id', schoolId)
      .single()

    // Fetch all students in class
    const { data: studentsData } = await supabase
      .from('students')
      .select(`
        id, user_id, admission_number, roll_number, class_id,
        date_of_birth, gender, guardian_name, guardian_phone,
        address, admission_date, is_active,
        user_profile:user_profiles!inner(id, full_name, email, phone)
      `)
      .eq('class_id', classId)
      .eq('school_id', schoolId)

    // Fetch subjects for class
    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('*')
      .eq('class_id', classId)

    const subjects = (subjectsData || []) as SubjectRow[]

    // Fetch all scores for students in this class
    const { data: allScoresData } = await supabase
      .from('scores')
      .select(`
        id, student_id, subject_id, ca_score, exam_score, total_score, grade,
        subjects!inner(id, name, code)
      `)
      .eq('session_id', sessionId)
      .in('student_id', (studentsData || []).map((s: any) => s.id))

    const studentMap = new Map<string, Array<Score & { subject: SubjectRow }>>()
    ;(allScoresData || []).forEach((row: any) => {
      const list = studentMap.get(row.student_id) || []
      list.push({
        id: row.id,
        ca_score: row.ca_score,
        exam_score: row.exam_score,
        total_score: row.total_score,
        grade: row.grade,
        subject: row.subjects as SubjectRow,
      } as any)
      studentMap.set(row.student_id, list)
    })

    const classStudents = (studentsData || []).map((s: any) => {
      const scores = studentMap.get(s.id) || []
      const totalScore = scores.reduce((sum, sc) => sum + (sc.total_score || 0), 0)
      const avgScore = scores.length > 0 ? totalScore / scores.length : 0

      return {
        ...s,
        scores,
        totals: {
          total_score: totalScore,
          average: avgScore,
          position: 0, // TODO: Calculate actual position
          aggregate: totalScore,
        },
      }
    })

    return {
      success: true,
      data: {
        school: schoolRow as any,
        session,
        class: classRow as any,
        students: classStudents,
        subjects,
      } as ClassReportData,
    }
  } catch (error) {
    console.error('Error generating class report:', error)
    return { success: false, error: 'Failed to generate class report' }
  }
}

export async function getReportMetadata(
  classId: string
): Promise<{ success: true; data: ReportMetadata } | { success: false; error?: string }> {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    // Get class info
    const { data: classRow } = await supabase
      .from('classes')
      .select('id, name, level, stream, class_teacher_id')
      .eq('id', classId)
      .single()

    if (!classRow || (classRow as any).school_id !== schoolId) {
      return { success: false, error: 'Class not found' }
    }

    // Get students in class
    const { data: students } = await supabase
      .from('students')
      .select('id, admission_number, user_profile:user_profiles!inner(id, full_name)')
      .eq('class_id', classId)
      .eq('school_id', schoolId)

    // Get class teacher info if assigned
    let classTeacher = null
    if ((classRow as any).class_teacher_id) {
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('id, user_profile:user_profiles!inner(id, full_name)')
        .eq('id', (classRow as any).class_teacher_id)
        .single()

      classTeacher = teacherRow
    }

    return {
      success: true,
      data: {
        class: classRow,
        students: students || [],
        classTeacher,
      },
    }
  } catch (error) {
    console.error('Error getting report metadata:', error)
    return { success: false, error: 'Failed to fetch metadata' }
  }
}
