// Edge Function for generating PDF report cards
// Note: This runs in Deno runtime, not Node.js
// The import errors in VS Code are expected and can be ignored

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

interface ReportRequest {
  student_id: string
  session_id: string
  format?: 'pdf' | 'json'
}

interface ScoreData {
  id: string
  student_id: string
  subject_id: string
  session_id: string
  ca_score: number
  exam_score: number
  total_score: number
  grade: string
  position: number
  subject_remark: string
  subjects: {
    name: string
    is_core: boolean
  }
}

interface AttendanceData {
  present_days: number
  total_days: number
  percentage: number
}

interface RemarkData {
  remark: string
}

interface GradeValues {
  A: number
  B: number
  C: number
  D: number
  E: number
  F: number
}

interface Database {
  public: {
    Tables: {
      students: {
        Row: {
          id: string
          admission_number: string
          user_id: string
          class_id: string
          school_id: string
        }
      }
      schools: {
        Row: {
          id: string
          name: string
          motto: string
          address: string
          phone: string
          logo_url: string
        }
      }
      academic_sessions: {
        Row: {
          id: string
          academic_year: string
          term: number
          vacation_date: string
          reopening_date: string
        }
      }
      scores: {
        Row: {
          id: string
          student_id: string
          subject_id: string
          session_id: string
          ca_score: number
          exam_score: number
          total_score: number
          grade: string
          position: number
          subject_remark: string
        }
      }
    }
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { student_id, session_id, format = 'pdf' }: ReportRequest = await req.json()

    // Fetch student data with all related information
    const { data: studentData, error: studentError } = await supabaseClient
      .from('students')
      .select(`
        *,
        user_profiles!inner(full_name, gender, date_of_birth),
        schools!inner(name, motto, address, phone, logo_url),
        classes!inner(name, stream)
      `)
      .eq('id', student_id)
      .single()

    if (studentError || !studentData) {
      return new Response('Student not found', { status: 404 })
    }

    // Fetch session data
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from('academic_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError || !sessionData) {
      return new Response('Session not found', { status: 404 })
    }

    // Fetch scores with subjects
    const { data: scoresData, error: scoresError } = await supabaseClient
      .from('scores')
      .select(`
        *,
        subjects!inner(name, is_core)
      `)
      .eq('student_id', student_id)
      .eq('session_id', session_id)
      .order('subjects.name')

    if (scoresError) {
      return new Response('Error fetching scores', { status: 500 })
    }

    // Fetch attendance
    const { data: attendanceData }: { data: AttendanceData | null } = await supabaseClient
      .from('attendance')
      .select('*')
      .eq('student_id', student_id)
      .eq('session_id', session_id)
      .single()

    // Fetch class teacher remark
    const { data: remarkData }: { data: RemarkData | null } = await supabaseClient
      .from('class_teacher_remarks')
      .select('*')
      .eq('student_id', student_id)
      .eq('session_id', session_id)
      .single()

    // Calculate totals and aggregates
    const totalCA = scoresData?.reduce((sum: number, score: ScoreData) => sum + (score.ca_score || 0), 0) || 0
    const totalExam = scoresData?.reduce((sum: number, score: ScoreData) => sum + (score.exam_score || 0), 0) || 0
    const grandTotal = totalCA + totalExam
    const average = scoresData?.length ? grandTotal / scoresData.length : 0
    
    // Calculate aggregate (sum of grades for core subjects)
    const gradeValues: GradeValues = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 }
    const coreSubjects = scoresData?.filter((score: ScoreData) => score.subjects.is_core) || []
    const aggregate = coreSubjects.reduce((sum: number, score: ScoreData) => sum + (gradeValues[score.grade as keyof GradeValues] || 6), 0)

    const reportData = {
      student: studentData,
      session: sessionData,
      scores: scoresData || [],
      attendance: attendanceData,
      remark: remarkData,
      totals: {
        totalCA,
        totalExam,
        grandTotal,
        average,
        aggregate,
        position: scoresData?.[0]?.position || 0,
        outOf: 42 // This should be calculated from class size
      }
    }

    if (format === 'json') {
      return new Response(JSON.stringify(reportData), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const { width, height } = page.getSize()
    let currentY = height - 50

    // Header
    page.drawText(studentData.schools.name.toUpperCase(), {
      x: 50,
      y: currentY,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0)
    })
    currentY -= 25

    if (studentData.schools.motto) {
      page.drawText(`Motto: ${studentData.schools.motto}`, {
        x: 50,
        y: currentY,
        size: 12,
        font: font,
        color: rgb(0.3, 0.3, 0.3)
      })
      currentY -= 20
    }

    // Student Information
    currentY -= 20
    page.drawText('STUDENT REPORT CARD', {
      x: width / 2 - 80,
      y: currentY,
      size: 16,
      font: boldFont
    })
    currentY -= 40

    const studentInfo = [
      `Name: ${studentData.user_profiles.full_name}`,
      `Admission No: ${studentData.admission_number}`,
      `Class: ${studentData.classes.name}${studentData.classes.stream ? studentData.classes.stream : ''}`,
      `Academic Year: ${sessionData.academic_year}`,
      `Term: ${sessionData.term}`,
    ]

    studentInfo.forEach(info => {
      page.drawText(info, {
        x: 50,
        y: currentY,
        size: 11,
        font: font
      })
      currentY -= 18
    })

    // Scores Table
    currentY -= 20
    page.drawText('SUBJECT PERFORMANCE', {
      x: 50,
      y: currentY,
      size: 14,
      font: boldFont
    })
    currentY -= 30

    // Table headers
    const headers = ['SUBJECT', 'CA(30)', 'EXAM(70)', 'TOTAL(100)', 'GRADE', 'POS', 'REMARK']
    const columnWidths = [140, 50, 70, 70, 50, 40, 120]
    let currentX = 50

    headers.forEach((header, index) => {
      page.drawText(header, {
        x: currentX,
        y: currentY,
        size: 9,
        font: boldFont
      })
      currentX += columnWidths[index]
    })
    currentY -= 20

    // Table rows
    scoresData?.forEach((score: ScoreData) => {
      currentX = 50
      const rowData = [
        score.subjects.name,
        (score.ca_score || 0).toString(),
        (score.exam_score || 0).toString(),
        (score.total_score || 0).toString(),
        score.grade || 'F',
        (score.position || 0).toString(),
        score.subject_remark || ''
      ]

      rowData.forEach((data, index) => {
        page.drawText(data, {
          x: currentX,
          y: currentY,
          size: 8,
          font: font
        })
        currentX += columnWidths[index]
      })
      currentY -= 15
    })

    // Summary
    currentY -= 20
    const summaryInfo = [
      `Total CA: ${totalCA}`,
      `Total Exam: ${totalExam}`,
      `Grand Total: ${grandTotal}`,
      `Average: ${average.toFixed(1)}%`,
      `Aggregate: ${aggregate}`,
      `Position: ${reportData.totals.position} out of ${reportData.totals.outOf}`,
    ]

    summaryInfo.forEach(info => {
      page.drawText(info, {
        x: 50,
        y: currentY,
        size: 11,
        font: font
      })
      currentY -= 18
    })

    // Attendance
    if (attendanceData) {
      currentY -= 10
      page.drawText(`Attendance: ${attendanceData.present_days}/${attendanceData.total_days} (${attendanceData.percentage.toFixed(1)}%)`, {
        x: 50,
        y: currentY,
        size: 11,
        font: font
      })
      currentY -= 25
    }

    // Class Teacher's Remark
    if (remarkData) {
      page.drawText('CLASS TEACHER\'S REMARK:', {
        x: 50,
        y: currentY,
        size: 11,
        font: boldFont
      })
      currentY -= 20

      page.drawText(remarkData.remark, {
        x: 50,
        y: currentY,
        size: 10,
        font: font,
        maxWidth: width - 100
      })
      currentY -= 40
    }

    // Vacation and Reopening dates
    if (sessionData.vacation_date && sessionData.reopening_date) {
      page.drawText(`Vacation Date: ${new Date(sessionData.vacation_date).toLocaleDateString()}`, {
        x: 50,
        y: currentY,
        size: 10,
        font: font
      })
      currentY -= 15

      page.drawText(`Reopening Date: ${new Date(sessionData.reopening_date).toLocaleDateString()}`, {
        x: 50,
        y: currentY,
        size: 10,
        font: font
      })
    }

    // Generate QR code data (simplified for now)
    const qrData = `${studentData.id}-${session_id}-${Date.now()}`
    page.drawText(`Verification Code: ${qrData.substring(0, 16)}...`, {
      x: width - 200,
      y: 50,
      size: 8,
      font: font
    })

    const pdfBytes = await pdfDoc.save()
    const base64Pdf = encode(pdfBytes)

    return new Response(JSON.stringify({ 
      pdf: base64Pdf,
      filename: `report_${studentData.admission_number}_${sessionData.academic_year}_term${sessionData.term}.pdf`
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error generating report:', error)
    return new Response('Internal server error', { status: 500 })
  }
})
