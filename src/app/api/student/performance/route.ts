import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
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
      .select('id')
      .eq('user_id', currentUser.user.id)
      .maybeSingle()

    if (!studentData) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    const studentId = (studentData as { id: string }).id

    // Fetch aggregate and remark for the session
    const [{ data: aggregateData }, { data: remarkData }] = await Promise.all([
      supabase
        .from('student_aggregates')
        .select('aggregate_score, class_position')
        .eq('student_id', studentId)
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('class_teacher_remarks')
        .select('remark, promotion_status')
        .eq('student_id', studentId)
        .eq('session_id', sessionId)
        .maybeSingle(),
    ])

    return NextResponse.json({
      aggregate: aggregateData || null,
      remark: remarkData || null,
    })
  } catch (error) {
    console.error('Error fetching performance data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
