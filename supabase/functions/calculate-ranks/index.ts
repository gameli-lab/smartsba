// Edge Function for calculating class rankings
// Note: This runs in Deno runtime, not Node.js
// The import errors in VS Code are expected and can be ignored

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RankRequest {
  class_id: string
  session_id: string
}

interface StudentScore {
  subject_id: string
  ca_score: number
  exam_score: number
  total_score: number
  subjects: {
    is_core: boolean
  }
}

interface StudentData {
  id: string
  admission_number: string
  user_profiles: {
    full_name: string
  }
  scores: StudentScore[]
}

interface StudentSummary {
  student_id: string
  admission_number: string
  full_name: string
  total_score: number
  average: number
  aggregate: number
  subject_count: number
  position?: number
}

interface GradeValues {
  A: number
  B: number
  C: number
  D: number
  E: number
  F: number
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { class_id, session_id }: RankRequest = await req.json()

    // Get all students in the class with their scores
    const { data: studentsData, error: studentsError } = await supabaseClient
      .from('students')
      .select(`
        id,
        admission_number,
        user_profiles!inner(full_name),
        scores!inner(
          subject_id,
          ca_score,
          exam_score,
          total_score,
          subjects!inner(is_core)
        )
      `)
      .eq('class_id', class_id)
      .eq('scores.session_id', session_id)

    if (studentsError) {
      return new Response('Error fetching students', { status: 500 })
    }

    // Calculate totals and averages for each student
    const studentSummaries: StudentSummary[] = studentsData?.map((student: StudentData) => {
      const scores = student.scores || []
      const totalScore = scores.reduce((sum: number, score: StudentScore) => sum + (score.total_score || 0), 0)
      const coreSubjects = scores.filter((score: StudentScore) => score.subjects.is_core)
      const average = scores.length ? totalScore / scores.length : 0
      
      // Calculate aggregate for core subjects
      const gradeValues: GradeValues = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 }
      const aggregate = coreSubjects.reduce((sum: number, score: StudentScore) => {
        const grade = calculateGrade(score.total_score || 0)
        return sum + (gradeValues[grade as keyof GradeValues] || 6)
      }, 0)

      return {
        student_id: student.id,
        admission_number: student.admission_number,
        full_name: student.user_profiles.full_name,
        total_score: totalScore,
        average: average,
        aggregate: aggregate,
        subject_count: scores.length
      }
    }) || []

    // Sort by average (descending) to determine positions
    studentSummaries.sort((a: StudentSummary, b: StudentSummary) => b.average - a.average)

    // Assign positions (handle ties)
    let currentPosition = 1
    for (let i = 0; i < studentSummaries.length; i++) {
      if (i > 0 && studentSummaries[i].average < studentSummaries[i - 1].average) {
        currentPosition = i + 1
      }
      studentSummaries[i].position = currentPosition
    }

    // Update positions in the database
    for (const summary of studentSummaries) {
      await supabaseClient
        .from('scores')
        .update({ position: summary.position })
        .eq('student_id', summary.student_id)
        .eq('session_id', session_id)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Ranks calculated successfully',
      data: studentSummaries
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error calculating ranks:', error)
    return new Response('Internal server error', { status: 500 })
  }
})

function calculateGrade(score: number): string {
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  if (score >= 40) return 'E'
  return 'F'
}
