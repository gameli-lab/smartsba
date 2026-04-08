import { NextRequest, NextResponse } from 'next/server'
import { requireParent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { wards } = await requireParent()

    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('session_id')
    const wardId = searchParams.get('ward_id')

    if (!sessionId || !wardId) {
      return NextResponse.json(
        { error: 'session_id and ward_id are required' },
        { status: 400 }
      )
    }

    // Verify this ward belongs to the parent
    const isOwnWard = wards.some(w => w.student.id === wardId)
    if (!isOwnWard) {
      return NextResponse.json(
        { error: 'Unauthorized: This ward is not linked to your account' },
        { status: 403 }
      )
    }

    // Fetch session details
    const { data: sessionData } = await supabase
      .from('academic_sessions')
      .select('academic_year, term, school_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const session = sessionData as { academic_year: string; term: number; school_id: string }

    // Fetch student details
    const ward = wards.find(w => w.student.id === wardId)
    if (!ward) {
      return NextResponse.json(
        { error: 'Ward not found' },
        { status: 404 }
      )
    }

    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', ward.student.user_id)
      .maybeSingle()

    const studentName = (profileData as { full_name: string } | null)?.full_name || 'Student'

    // Fetch class name
    const { data: classData } = await supabase
      .from('classes')
      .select('name')
      .eq('id', ward.student.class_id)
      .maybeSingle()

    const className = (classData as { name: string } | null)?.name || 'N/A'

    // Fetch aggregate data
    const { data: aggregateData } = await supabase
      .from('student_aggregates')
      .select('aggregate_score, total_subjects, class_position')
      .eq('student_id', wardId)
      .eq('session_id', sessionId)
      .maybeSingle()

    const aggregate = aggregateData as { aggregate_score: number | null; total_subjects: number | null; class_position: number | null } | null

    // Fetch scores
    const { data: scoresData } = await supabase
      .from('student_scores')
      .select(`
        ca_score,
        exam_score,
        total_score,
        grade,
        remark,
        subjects (name)
      `)
      .eq('student_id', wardId)
      .eq('session_id', sessionId)
      .order('subjects(name)')

    const scores = (scoresData || []) as Array<{
      ca_score: number | null
      exam_score: number | null
      total_score: number | null
      grade: string | null
      remark: string | null
      subjects: { name: string } | null
    }>

    // TODO: Generate actual PDF using jsPDF or similar library
    // For now, return a simple JSON response as placeholder
    const reportData = {
      student_name: studentName,
      admission_number: ward.student.admission_number,
      class: className,
      academic_year: session.academic_year,
      term: session.term,
      aggregate_score: aggregate?.aggregate_score,
      class_position: aggregate?.class_position,
      total_subjects: aggregate?.total_subjects,
      scores: scores.map(s => ({
        subject: s.subjects?.name || 'Unknown',
        ca: s.ca_score,
        exam: s.exam_score,
        total: s.total_score,
        grade: s.grade,
        remark: s.remark,
      })),
    }

    // Return JSON for now (placeholder for PDF generation)
    return NextResponse.json({
      message: 'PDF generation not yet implemented',
      data: reportData,
    })
  } catch (error) {
    console.error('Error generating parent report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
