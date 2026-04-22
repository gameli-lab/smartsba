import { requireParent } from '@/lib/auth-guards'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, FileText } from 'lucide-react'
import Link from 'next/link'
import { selectWard } from '../_lib/ward-selection'
import { renderNoLinkedWardsState, renderWardNotFoundState } from '../_lib/parent-states'

interface PageProps {
  searchParams: Promise<{ ward?: string }>
}

interface AggregateSessionRow {
  session_id: string
  academic_sessions: {
    academic_year: string
    term: number
  } | null
}

export default async function ParentDownloadsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { wards } = await requireParent()

  if (wards.length === 0) {
    return renderNoLinkedWardsState()
  }

  // Get selected ward or default to primary/first
  const { selectedWard } = selectWard(wards, params.ward)

  if (!selectedWard) {
    return renderWardNotFoundState()
  }

  const student = selectedWard.student

  // Get student name
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', student.user_id)
    .maybeSingle()

  const studentName = (profileData as { full_name: string } | null)?.full_name || 'Ward'

  // Fetch current session
  const { data: currentSessionData } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', student.school_id)
    .eq('is_current', true)
    .maybeSingle()

  const currentSession = currentSessionData as { id: string; academic_year: string; term: number } | null

  // Fetch all past sessions with data for this ward
  const { data: allSessionsWithData } = await supabase
    .from('student_aggregates')
    .select(`
      session_id,
      academic_sessions (
        academic_year,
        term
      )
    `)
    .eq('student_id', student.id)
    .order('academic_sessions(academic_year)', { ascending: false })
    .order('academic_sessions(term)', { ascending: false })

  const normalizedSessions = ((allSessionsWithData || []) as AggregateSessionRow[]).map((record) => ({
    session_id: record.session_id,
    academic_year: record.academic_sessions?.academic_year || '',
    term: record.academic_sessions?.term || 0,
  }))

  const uniqueSessions = Array.from(
    new Map(normalizedSessions.map((session) => [session.session_id, session])).values()
  )

  const currentReportReady = currentSession
    ? uniqueSessions.some((session) => session.session_id === currentSession.id)
    : false

  const pastSessions = uniqueSessions.filter((session) => session.session_id !== currentSession?.id)

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Downloads</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">Download term reports for {studentName}.</p>
      </div>

      {/* Current Term Report */}
      {currentSession && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="dark:text-gray-100">Current Term Report</CardTitle>
                <CardDescription className="dark:text-gray-300">
                  {currentSession.academic_year} • Term {currentSession.term}
                </CardDescription>
              </div>
                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-300">
                Current
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {studentName} - {currentSession.academic_year} Term {currentSession.term}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {currentReportReady ? 'Term Report Card is ready' : 'Report not generated yet for this term'}
                  </p>
                </div>
              </div>
              {currentReportReady ? (
                <Link
                  href={`/api/parent/report?session_id=${currentSession.id}&ward_id=${student.id}`}
                  target="_blank"
                >
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <Download className="mr-2 h-4 w-4" />
                  Not available
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Past Reports</CardTitle>
          <CardDescription>Download reports from previous terms.</CardDescription>
        </CardHeader>
        <CardContent>
          {pastSessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No past reports available.</p>
          ) : (
            <div className="space-y-3">
              {pastSessions.map((session) => (
                <div key={session.session_id} className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {studentName} - {session.academic_year} Term {session.term}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Term Report Card</p>
                    </div>
                  </div>
                  <Link
                    href={`/api/parent/report?session_id=${session.session_id}&ward_id=${student.id}`}
                    target="_blank"
                  >
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-purple-600 mt-0.5 dark:text-purple-300" />
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-300">
              <p className="font-medium text-gray-900 mb-1 dark:text-gray-100">About Reports</p>
              <p>
                Reports are generated as PDF documents containing the ward&apos;s performance summary, subject scores,
                attendance, and teacher remarks for each term. Click &quot;Download PDF&quot; to view or save the report.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
