import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated and is a student
    const currentUser = await AuthService.getCurrentUser()
    if (!currentUser || currentUser.profile.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    // Get student record
    const { data: studentData } = await supabase
      .from('students')
      .select('id, school_id, admission_number')
      .eq('user_id', currentUser.user.id)
      .maybeSingle()

    if (!studentData) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    const student = studentData as { id: string; school_id: string; admission_number: string }

    // Verify session exists and belongs to student's school
    const { data: sessionData } = await supabase
      .from('academic_sessions')
      .select('id, school_id, academic_year, term')
      .eq('id', sessionId)
      .eq('school_id', student.school_id)
      .maybeSingle()

    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 })
    }

    const session = sessionData as { id: string; school_id: string; academic_year: string; term: number }

    // TODO: Check publication status
    // const { data: publicationStatus } = await supabase
    //   .from('result_publications')
    //   .select('is_published')
    //   .eq('session_id', sessionId)
    //   .eq('student_id', student.id)
    //   .maybeSingle()
    //
    // if (!publicationStatus?.is_published) {
    //   return NextResponse.json({ error: 'Report not yet published' }, { status: 403 })
    // }

    // Fetch all required data for report generation
    const [
      { data: schoolData },
      { data: classData },
      { data: scoresData },
      { data: aggregateData },
      { data: attendanceData },
      { data: remarkData },
    ] = await Promise.all([
      supabase.from('schools').select('*').eq('id', student.school_id).single(),
      supabase
        .from('classes')
        .select('*')
        .eq('id', (studentData as { class_id?: string }).class_id || '')
        .maybeSingle(),
      supabase
        .from('scores')
        .select('*, subject:subjects(*)')
        .eq('student_id', student.id)
        .eq('session_id', sessionId),
      supabase
        .from('student_aggregates')
        .select('*')
        .eq('student_id', student.id)
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('class_teacher_remarks')
        .select('*')
        .eq('student_id', student.id)
        .eq('session_id', sessionId)
        .maybeSingle(),
    ])

    // TODO: Generate PDF using jsPDF or similar library
    // For now, return JSON data that could be used for PDF generation
    // In production, you would:
    // 1. Import jsPDF
    // 2. Create PDF document with school letterhead
    // 3. Add student info, scores table, aggregates, remarks
    // 4. Return PDF as blob/buffer

    const reportData = {
      school: schoolData,
      session,
      student: {
        ...currentUser.profile,
        admission_number: student.admission_number,
      },
      class: classData,
      scores: scoresData,
      aggregate: aggregateData,
      attendance: attendanceData,
      remark: remarkData,
    }

    // Placeholder: Return instructions
    return NextResponse.json({
      message: 'PDF generation not yet implemented',
      instructions: 'TODO: Generate PDF report using jsPDF library',
      data: reportData,
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
