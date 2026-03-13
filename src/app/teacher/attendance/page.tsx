import { requireTeacher } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveAttendance } from './actions'

const saveAttendanceAction = async (formData: FormData) => {
  'use server'
  await saveAttendance(formData)
}

interface ClassRow {
  id: string
  name: string
  level: number | null
  stream: string | null
}

interface SessionRow {
  id: string
  academic_year: string
  term: number
  is_current: boolean
}

interface StudentRow {
  id: string
  admission_number: string
  user_profile: {
    full_name: string
  }
}

interface AttendanceRow {
  student_id: string
  present_days: number
  total_days: number
  percentage: number
}

function classLabel(klass: ClassRow) {
  return `${klass.name}${klass.level ? ` • Level ${klass.level}` : ''}${klass.stream ? ` • ${klass.stream}` : ''}`
}

export default async function TeacherAttendancePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { assignments, effectiveRole, profile } = await requireTeacher()

  const classIds = Array.from(new Set(assignments.map((a) => a.class_id).filter(Boolean))) as string[]

  if (classIds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-600">You have no assigned classes yet.</p>
          </div>
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
            {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
          </Badge>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-gray-500">No class assignments yet.</CardContent>
        </Card>
      </div>
    )
  }

  const [{ data: classesData }, { data: sessionRows }] = await Promise.all([
    supabase.from('classes').select('id, name, level, stream').in('id', classIds),
    supabase
      .from('academic_sessions')
      .select('id, academic_year, term, is_current')
      .eq('school_id', profile.school_id)
      .order('start_date', { ascending: false }),
  ])

  const classes = (classesData || []) as ClassRow[]
  const sessions = (sessionRows || []) as SessionRow[]

  const selectedClassId = (typeof searchParams.classId === 'string' && searchParams.classId) || classIds[0]
  const selectedSessionId = (typeof searchParams.sessionId === 'string' && searchParams.sessionId) || sessions[0]?.id

  if (!selectedSessionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>No academic session found.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const [{ data: studentRows }, { data: attendanceRows }] = await Promise.all([
    supabase
      .from('students')
      .select('id, admission_number, user_profile:user_profiles!inner(full_name)')
      .eq('class_id', selectedClassId)
      .eq('school_id', profile.school_id),
    supabase
      .from('attendance')
      .select('student_id, present_days, total_days, percentage')
      .eq('session_id', selectedSessionId),
  ])

  const students = (studentRows || []) as StudentRow[]
  const attendanceMap = new Map<string, AttendanceRow>()
  ;(attendanceRows || []).forEach((row: any) => {
    attendanceMap.set(row.student_id, row as AttendanceRow)
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-600">Capture attendance totals per student for report generation.</p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select class and session</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Class</label>
              <select name="classId" defaultValue={selectedClassId} className="w-full rounded-md border px-3 py-2 text-sm">
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {classLabel(klass)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Session / Term</label>
              <select name="sessionId" defaultValue={selectedSessionId} className="w-full rounded-md border px-3 py-2 text-sm">
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.academic_year} • Term {session.term}{session.is_current ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="outline" className="w-full">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student Attendance Entries</CardTitle>
          <CardDescription>
            Enter cumulative values for the selected term. Percentage is calculated automatically on save.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-gray-500">No students found for this class.</p>
          ) : (
            <form action={saveAttendanceAction} className="space-y-4">
              <input type="hidden" name="classId" value={selectedClassId} />
              <input type="hidden" name="sessionId" value={selectedSessionId} />
              <div className="grid grid-cols-1 gap-3">
                {students.map((student) => {
                  const existing = attendanceMap.get(student.id)
                  return (
                    <div key={student.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{student.user_profile.full_name}</p>
                          <p className="text-xs text-gray-500">{student.admission_number}</p>
                        </div>
                        <div className="text-xs text-gray-500">
                          Saved: {existing ? `${existing.percentage}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                        <div>
                          <label className="text-xs text-gray-600">Present Days</label>
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            name={`present_${student.id}`}
                            defaultValue={existing?.present_days ?? ''}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Total Days</label>
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            name={`total_${student.id}`}
                            defaultValue={existing?.total_days ?? ''}
                          />
                        </div>
                        <div className="md:col-span-2 text-xs text-gray-500">
                          If present days exceed total days, values are auto-adjusted on save.
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="pt-2">
                <Button type="submit">Save Attendance</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
