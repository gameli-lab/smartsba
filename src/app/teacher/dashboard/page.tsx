import { requireTeacher } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function formatClassName(klass: { name: string; level?: number | null; stream?: string | null }) {
  const parts = [klass.name]
  if (klass.level !== undefined && klass.level !== null) parts.push(`Level ${klass.level}`)
  if (klass.stream) parts.push(klass.stream)
  return parts.join(' • ')
}

export default async function TeacherDashboardPage() {
  const { profile, assignments, effectiveRole } = await requireTeacher()

  const classIds = Array.from(new Set(assignments.map((a) => a.class_id).filter(Boolean)))
  const subjectIds = Array.from(new Set(assignments.map((a) => a.subject_id).filter(Boolean)))

  const [{ data: classesData }, { count: studentsCount }, { data: announcementsData }] = await Promise.all([
    classIds.length
      ? supabase
          .from('classes')
          .select('id, name, level, stream')
          .in('id', classIds)
      : Promise.resolve({ data: [], error: null } as const),
    classIds.length
      ? supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .in('class_id', classIds)
      : Promise.resolve({ data: null, error: null, count: 0 } as const),
    supabase
      .from('announcements')
      .select('id, title, created_at, target_type')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const classes = (classesData || []) as Array<{ id: string; name: string; level?: number | null; stream?: string | null }>
  const announcements = (announcementsData || []) as Array<{ id: string; title: string; created_at: string; target_type?: string | null }>

  const cards = [
    { title: 'Assigned Classes', value: classIds.length },
    { title: 'Assigned Subjects', value: subjectIds.length },
    { title: 'Students Under Responsibility', value: studentsCount ?? 0 },
    { title: 'Pending Mark Submissions', value: 0, note: 'TODO: wire to score submission status' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Teacher Dashboard</h1>
          <p className="text-sm text-gray-600">Read-only overview of your assignments and announcements</p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{card.value}</div>
              {card.note && <p className="text-xs text-gray-500 mt-1">{card.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Classes with Pending Scores</CardTitle>
            <CardDescription>Awaiting score submissions for assigned classes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {classes.length === 0 ? (
              <p className="text-sm text-gray-500">No classes assigned.</p>
            ) : (
              <ul className="space-y-3">
                {classes.map((klass) => (
                  <li key={klass.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-gray-900">{klass.name}</p>
                      <p className="text-sm text-gray-600">{formatClassName(klass)}</p>
                      <p className="text-xs text-amber-600 mt-1">TODO: Pending score status</p>
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
            <CardDescription>Latest updates relevant to your school</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-500">No announcements yet.</p>
            ) : (
              <ul className="space-y-3">
                {announcements.map((ann) => (
                  <li key={ann.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{ann.title}</p>
                      <Badge variant="secondary" className="text-xs">
                        {ann.target_type || 'General'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{new Date(ann.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
