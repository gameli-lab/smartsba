import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AggregateData {
  student_id: string
  session_id: string
  class_id: string
  aggregate_score: number
  total_subjects: number
  core_subjects_count: number
  elective_subjects_count: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { session_id, class_id } = await req.json()

    // Get all students in the session/class
    let query = supabase
      .from('students')
      .select('id, class_id')
    
    if (session_id && class_id) {
      query = query.eq('class_id', class_id)
    } else if (session_id) {
      // Get all students in the session across all classes
      const { data: sessions } = await supabase
        .from('academic_sessions')
        .select('school_id')
        .eq('id', session_id)
        .single()
      
      if (sessions) {
        query = query.eq('school_id', sessions.school_id)
      }
    }

    const { data: students, error: studentsError } = await query

    if (studentsError) {
      throw new Error(`Failed to fetch students: ${studentsError.message}`)
    }

    const aggregateResults: AggregateData[] = []

    // Calculate aggregate for each student
    for (const student of students) {
      const { error: aggregateError } = await supabase
        .rpc('calculate_student_aggregate', {
          p_student_id: student.id,
          p_session_id: session_id
        })

      if (aggregateError) {
        console.error(`Error calculating aggregate for student ${student.id}:`, aggregateError)
        continue
      }

      // Get detailed aggregate data
      const { data: aggregateData, error: detailError } = await supabase
        .from('student_aggregates')
        .select('*')
        .eq('student_id', student.id)
        .eq('session_id', session_id)
        .single()

      if (!detailError && aggregateData) {
        aggregateResults.push(aggregateData)
      }
    }

    // Calculate class positions
    if (class_id) {
      const classAggregates = aggregateResults
        .filter(a => a.class_id === class_id && a.aggregate_score > 0)
        .sort((a, b) => a.aggregate_score - b.aggregate_score) // Lower aggregate is better

      for (let i = 0; i < classAggregates.length; i++) {
        const aggregate = classAggregates[i]
        const position = i + 1

        await supabase
          .from('student_aggregates')
          .update({ class_position: position })
          .eq('student_id', aggregate.student_id)
          .eq('session_id', session_id)
      }
    }

    // Calculate overall positions (across all classes in session)
    const overallAggregates = aggregateResults
      .filter(a => a.aggregate_score > 0)
      .sort((a, b) => a.aggregate_score - b.aggregate_score)

    for (let i = 0; i < overallAggregates.length; i++) {
      const aggregate = overallAggregates[i]
      const position = i + 1

      await supabase
        .from('student_aggregates')
        .update({ overall_position: position })
        .eq('student_id', aggregate.student_id)
        .eq('session_id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Calculated aggregates for ${aggregateResults.length} students`,
        aggregates: aggregateResults.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error calculating aggregates:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
