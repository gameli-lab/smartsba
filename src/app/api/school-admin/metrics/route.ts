import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getResultsCompletion, getPendingPromotionsCount } from '@/lib/school-metrics'

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = await createServerComponentClient()
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Resolve profile to determine school scope
    const { data: profileRow, error: profileError } = await serverSupabase
      .from('user_profiles')
      .select('role, school_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profileRow) return NextResponse.json({ error: 'Unable to resolve profile' }, { status: 500 })

    const role = (profileRow as any).role as string | undefined
    const schoolId = (profileRow as any).school_id as string | null
    if (!schoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 })

    const url = new URL(req.url)
    const term = url.searchParams.get('term') || 'term1'
    const classId = url.searchParams.get('classId') || undefined

    // Only allow school_admin or teacher for now
    if (!['school_admin', 'teacher', 'super_admin'].includes(role || '')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const metrics = await getResultsCompletion(schoolId, term, classId)
    const pendingCount = await getPendingPromotionsCount(schoolId, term)

    return NextResponse.json({ success: true, metrics, pendingPromotions: pendingCount })
  } catch (err) {
    console.error('Metrics API error:', err)
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}
