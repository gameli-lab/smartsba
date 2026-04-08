'use server'

import { requireSchoolAdmin } from '@/lib/auth'
import { supabase, createServerComponentClient } from '@/lib/supabase'
import { getSchoolAssetSignedUrl } from '@/lib/storage'
import type { ReportCardData, ClassReportData, Score, AcademicSession } from '@/types'

export type ReportMetadata = {
  class: ClassMetadataRow
  students: Array<{ id: string; admission_number: string; user_profile: { id: string; full_name: string } }>
  classTeacher: { id: string; user_profile: { id: string; full_name: string } } | null
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

interface ScoreWithSubjectRow {
  id: string
  student_id: string
  ca_score: number | null
  exam_score: number | null
  total_score: number | null
  grade: string | null
  subject_remark: string | null
  subjects: SubjectRow
}

interface StudentIdRow {
  id: string
}

interface StudentTotalScoreRow {
  student_id: string
  total_score: number | null
}

interface StudentWithProfileRow extends StudentRow {
  user_profile: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
  }
}

interface ClassRow {
  id: string
  name: string
  level: string | null
  stream: string | null
}

interface ClassWithSchoolRow extends ClassRow {
  school_id: string
}

interface ClassMetadataRow extends ClassWithSchoolRow {
  class_teacher_id: string | null
}

interface AttendanceRow {
  id: string
  student_id: string
  session_id: string
  present_days: number
  total_days: number
  percentage: number
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
      .select('id, school_id, academic_year, term, start_date, end_date, vacation_date, reopening_date, is_current')
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
      .select('id, name, address, phone, logo_url, stamp_url, head_signature_url')
      .eq('id', schoolId)
      .single()

    // Generate signed URLs for school assets
    const serverClient = await createServerComponentClient()
    const logoSignedUrl = schoolRow?.logo_url
      ? await getSchoolAssetSignedUrl(schoolRow.logo_url, 3600, serverClient)
      : null
    const stampSignedUrl = schoolRow?.stamp_url
      ? await getSchoolAssetSignedUrl(schoolRow.stamp_url, 3600, serverClient)
      : null
    const signatureSignedUrl = schoolRow?.head_signature_url
      ? await getSchoolAssetSignedUrl(schoolRow.head_signature_url, 3600, serverClient)
      : null

    // Fetch scores
    const { data: scoresData } = await supabase
      .from('scores')
      .select(`
        id, ca_score, exam_score, total_score, grade, subject_remark,
        subjects!inner(id, name, code, description, is_core)
      `)
      .eq('student_id', studentId)
      .eq('session_id', sessionId)

    const scoresRows = (scoresData || []) as ScoreWithSubjectRow[]
    const scores = scoresRows.map((s) => ({
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

    // Calculate class position
    const { data: classStudentsData } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', student.class_id)
      .eq('school_id', schoolId)

    const classStudentIds = ((classStudentsData || []) as StudentIdRow[]).map((s) => s.id)
    const outOf = classStudentIds.length
    let position = 0

    if (classStudentIds.length > 1) {
      const { data: allClassScores } = await supabase
        .from('scores')
        .select('student_id, total_score')
        .eq('session_id', sessionId)
        .in('student_id', classStudentIds)

      const studentTotals = new Map<string, number>()
      for (const row of ((allClassScores || []) as StudentTotalScoreRow[])) {
        const prev = studentTotals.get(row.student_id) || 0
        studentTotals.set(row.student_id, prev + (row.total_score || 0))
      }

      const thisTotal = studentTotals.get(studentId) ?? grandTotal
      const ahead = [...studentTotals.values()].filter((t) => t > thisTotal).length
      position = ahead + 1
    }

    // Fetch attendance
    const { data: attendanceRow } = await supabase
      .from('attendance')
      .select('id, student_id, session_id, present_days, total_days, percentage')
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .maybeSingle()

    return {
      success: true,
      data: {
        school: {
          ...schoolRow,
          logo_url: logoSignedUrl ?? schoolRow?.logo_url,
          stamp_url: stampSignedUrl ?? schoolRow?.stamp_url,
          head_signature_url: signatureSignedUrl ?? schoolRow?.head_signature_url,
        } as unknown as ReportCardData['school'],
        session,
        student: { ...student, user_profile: profileRow },
        class: classRow as unknown as ReportCardData['class'],
        scores,
        attendance: (attendanceRow ?? {}) as AttendanceRow,
        class_teacher_remark: remarkRow as unknown as ReportCardData['class_teacher_remark'],
        totals: {
          total_ca: totalCa,
          total_exam: totalExam,
          grand_total: grandTotal,
          average,
          aggregate,
          position,
          out_of: outOf,
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

    const resolvedClass = classRow as ClassWithSchoolRow | null
    if (!resolvedClass || resolvedClass.school_id !== schoolId) {
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
        .in('student_id', ((studentsData || []) as StudentIdRow[]).map((s) => s.id))

    const studentMap = new Map<string, Array<Score & { subject: SubjectRow }>>()
    ;((allScoresData || []) as ScoreWithSubjectRow[]).forEach((row) => {
      const list = studentMap.get(row.student_id) || []
      list.push({
        id: row.id,
        ca_score: row.ca_score,
        exam_score: row.exam_score,
        total_score: row.total_score,
        grade: row.grade,
        subject: row.subjects as SubjectRow,
      })
      studentMap.set(row.student_id, list)
    })

    const classStudents = ((studentsData || []) as StudentWithProfileRow[]).map((s) => {
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
        school: schoolRow as unknown as ClassReportData['school'],
        session,
        class: resolvedClass,
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

    const resolvedClass = classRow as ClassMetadataRow | null
    if (!resolvedClass || resolvedClass.school_id !== schoolId) {
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
    if (resolvedClass.class_teacher_id) {
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('id, user_profile:user_profiles!inner(id, full_name)')
        .eq('id', resolvedClass.class_teacher_id)
        .single()

      classTeacher = teacherRow
    }

    return {
      success: true,
      data: {
        class: resolvedClass,
        students: students || [],
        classTeacher,
      },
    }
  } catch (error) {
    console.error('Error getting report metadata:', error)
    return { success: false, error: 'Failed to fetch metadata' }
  }
}
