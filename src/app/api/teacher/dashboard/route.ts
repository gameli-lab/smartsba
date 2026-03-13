import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { buildTeacherDashboardData } from '@/services/teacherDashboardService'
import { TeacherAssignment, UserProfile } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profileRow, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profileRow) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const profile = profileRow as UserProfile

    if (profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: teacherRow, error: teacherError } = await supabase
      .from('teachers')
      .select('id, school_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (teacherError || !teacherRow) {
      return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 })
    }

    const teacher = teacherRow as { id: string; school_id: string }
    if (teacher.school_id !== profile.school_id) {
      return NextResponse.json({ error: 'School mismatch' }, { status: 403 })
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('teacher_assignments')
      .select('*')
      .eq('teacher_id', teacher.id)

    if (assignmentError) {
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    const assignments = (assignmentRows || []) as TeacherAssignment[]
    const effectiveRole: 'class_teacher' | 'subject_teacher' = assignments.some((a) => a.is_class_teacher)
      ? 'class_teacher'
      : 'subject_teacher'

    const classId = request.nextUrl.searchParams.get('classId') || undefined
    const subjectId = request.nextUrl.searchParams.get('subjectId') || undefined
    const sessionId = request.nextUrl.searchParams.get('sessionId') || undefined

    const data = await buildTeacherDashboardData({
      profile,
      assignments,
      effectiveRole,
      filters: { classId, subjectId, sessionId },
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Teacher dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
