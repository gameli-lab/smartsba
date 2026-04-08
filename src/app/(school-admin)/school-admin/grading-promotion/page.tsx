import { requireSchoolAdmin } from '@/lib/auth'
import { createServerComponentClient } from '@/lib/supabase'
import { GradingPromotionClient } from './grading-promotion-client'

/**
 * Grading & Promotion Page
 * Manage student promotion status and bulk advance classes
 */
export default async function GradingPromotionPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id!
  const supabase = await createServerComponentClient()

  // Fetch classes
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('level', { ascending: true })

  if (classesError) {
    return <div className="p-4 text-red-600">Failed to load classes: {classesError.message}</div>
  }

  // Fetch active sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('academic_sessions')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .order('created_at', { ascending: false })

  if (sessionsError) {
    return <div className="p-4 text-red-600">Failed to load sessions: {sessionsError.message}</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Grading & Promotion</h1>
        <p className="text-gray-600 mt-2">Manage student promotion status and bulk advance classes</p>
      </div>

      <GradingPromotionClient classes={classes || []} sessions={sessions || []} />
    </div>
  )
}
