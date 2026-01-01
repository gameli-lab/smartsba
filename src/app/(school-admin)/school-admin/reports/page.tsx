import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportsClient } from './reports-client'
import type { AcademicSession, Class } from '@/types'

export default async function ReportsPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  const [{ data: sessionsData }, { data: classesData }] = await Promise.all([
    supabase
      .from('academic_sessions')
      .select('*')
      .eq('school_id', schoolId)
      .order('academic_year', { ascending: false })
      .order('term', { ascending: false }),
    supabase
      .from('classes')
      .select('id, name, level, stream')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
  ])

  const sessions = (sessionsData || []) as AcademicSession[]
  const classes = (classesData || []) as Class[]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">Generate and view student and class reports</p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Create an academic session to generate reports.</p>
          </CardContent>
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Create classes to generate reports.</p>
          </CardContent>
        </Card>
      ) : (
        <ReportsClient sessions={sessions} classes={classes} />
      )}
    </div>
  )
}
