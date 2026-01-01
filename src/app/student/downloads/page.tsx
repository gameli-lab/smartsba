import { requireStudent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, FileText } from 'lucide-react'

export default async function StudentDownloadsPage() {
  const guard = await requireStudent()

  if (!guard.student) {
    return (
      <div className="rounded-lg border bg-amber-50 p-6 text-amber-800">
        <h1 className="text-lg font-semibold">Student profile not found</h1>
        <p className="mt-2 text-sm">Please contact your school administrator to complete your enrollment.</p>
      </div>
    )
  }

  const { student, profile } = guard

  // Fetch current session
  const { data: currentSessionData } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  const currentSession = currentSessionData as { id: string; academic_year: string; term: number } | null

  // Fetch all sessions where student has scores
  const { data: sessionsWithScores } = await supabase
    .from('scores')
    .select(`
      session_id,
      session:academic_sessions(id, academic_year, term)
    `)
    .eq('student_id', student.id)

  // Extract unique sessions and sort by year/term
  const uniqueSessions = new Map<string, { id: string; academic_year: string; term: number }>()
  
  if (sessionsWithScores) {
    for (const record of sessionsWithScores) {
      const sessionData = record as { session_id: string; session: { id: string; academic_year: string; term: number } | null }
      if (sessionData.session) {
        uniqueSessions.set(sessionData.session.id, sessionData.session)
      }
    }
  }

  const availableSessions = Array.from(uniqueSessions.values()).sort((a, b) => {
    if (a.academic_year !== b.academic_year) {
      return b.academic_year.localeCompare(a.academic_year)
    }
    return b.term - a.term
  })

  // TODO: Check publication status for each session
  // For now, we'll assume all sessions with scores are published
  // In production, check a publication_status field or similar

  const handleDownloadReport = (sessionId: string, academicYear: string, term: number) => {
    // Trigger download via API endpoint
    window.open(`/api/student/report?session_id=${sessionId}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Downloads</h1>
        <p className="text-sm text-gray-600">Download your term reports in PDF format.</p>
      </div>

      {currentSession && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Current Term Report
                </CardTitle>
                <CardDescription className="mt-1">
                  {currentSession.academic_year} • Term {currentSession.term}
                </CardDescription>
              </div>
              <Badge variant="default">Current</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleDownloadReport(currentSession.id, currentSession.academic_year, currentSession.term)}
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Past Term Reports</CardTitle>
          <CardDescription>Download reports from previous academic sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          {availableSessions.length === 0 ? (
            <p className="text-sm text-gray-500">No past reports available yet.</p>
          ) : (
            <div className="space-y-3">
              {availableSessions
                .filter((session) => session.id !== currentSession?.id)
                .map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {session.academic_year} • Term {session.term}
                        </p>
                        <p className="text-xs text-gray-500">Term Report Card</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadReport(session.id, session.academic_year, session.term)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Reports are only available for published results. If you cannot download a report,
            it may not have been published yet. Contact your school administrator for more information.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
