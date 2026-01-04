import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { AcademicSession } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SessionsList } from '@/app/(school-admin)/school-admin/academic-sessions/sessions-list'
import { CreateSessionDialog } from '@/app/(school-admin)/school-admin/academic-sessions/create-session-dialog'
import { SessionsFilters } from './sessions-filters'

/**
 * Academic Sessions & Terms Management Page
 */
export default async function AcademicSessionsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  // Build sessions query with filters
  let sessionsQuery = supabase
    .from('academic_sessions')
    .select('*')
    .eq('school_id', schoolId)

  // Apply search filter (academic_year or term)
  const search = searchParams.search as string | undefined
  if (search) {
    // Check if search is a number (term) or string (academic year)
    const isNumeric = /^\d+$/.test(search)
    if (isNumeric) {
      sessionsQuery = sessionsQuery.eq('term', parseInt(search))
    } else {
      sessionsQuery = sessionsQuery.ilike('academic_year', `%${search}%`)
    }
  }

  // Apply status filter (current/past)
  const status = searchParams.status as string | undefined
  if (status === 'current') {
    sessionsQuery = sessionsQuery.eq('is_current', true)
  } else if (status === 'past') {
    sessionsQuery = sessionsQuery.eq('is_current', false)
  }

  // Fetch all academic sessions for the school
  const { data: sessions } = await sessionsQuery
    .order('academic_year', { ascending: false })
    .order('term', { ascending: false })

  const typedSessions = (sessions || []) as AcademicSession[]

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Academic Sessions & Terms</h1>
          <p className="text-gray-600 mt-1">
            Manage academic years, terms, and important dates
          </p>
        </div>
        <CreateSessionDialog />
      </div>

      {/* Current Session Indicator */}
      {typedSessions.find(s => s.is_current) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
              <p className="text-sm font-medium text-blue-900">
                Current Session: {typedSessions.find(s => s.is_current)?.academic_year} - Term {typedSessions.find(s => s.is_current)?.term}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Academic Sessions</CardTitle>
          <CardDescription>
            View and manage all academic sessions. Only one session can be active at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsFilters />
          {typedSessions.length > 0 ? (
            <SessionsList sessions={typedSessions} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No academic sessions found</p>
              <CreateSessionDialog />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information */}
      <Card className="border-gray-200 bg-gray-50">
        <CardHeader>
          <CardTitle className="text-base">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>• Each academic year can have up to 3 terms</p>
          <p>• Only one session can be marked as &ldquo;current&rdquo; at any time</p>
          <p>• The current session determines which term&apos;s data is displayed by default</p>
          <p>• Previous sessions become read-only once a new session is set as current</p>
          <p>• Vacation and reopening dates are optional but recommended for planning</p>
        </CardContent>
      </Card>
    </div>
  )
}
