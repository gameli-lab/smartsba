import { requireSchoolAdmin } from '@/lib/auth'
import { createServerComponentClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateSubjectDialog } from './create-subject-dialog'
import { SubjectsList } from './subjects-list'
import { SubjectsFilters } from './subjects-filters'
// TODO: Import LEVEL_GROUPS for level-aware subject availability filtering
// import { LEVEL_GROUPS } from '@/lib/constants/level-groups'
import type { Subject, Class } from '@/types'

export default async function SubjectsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = await createServerComponentClient()

  // Build subjects query with filters
  let subjectsQuery = supabase.from('subjects').select('*').eq('school_id', schoolId)

  // Apply search filter (name or code)
  const search = searchParams.search as string | undefined
  if (search) {
    subjectsQuery = subjectsQuery.or(
      `name.ilike.%${search}%,code.ilike.%${search}%`
    )
  }

  // Apply type filter (core/elective)
  const type = searchParams.type as string | undefined
  if (type === 'core') {
    subjectsQuery = subjectsQuery.eq('is_core', true)
  } else if (type === 'elective') {
    subjectsQuery = subjectsQuery.eq('is_core', false)
  }

  // Apply status filter
  // Treat null as active for legacy rows created before is_active default existed
  const status = searchParams.status as string | undefined
  if (status === 'active') {
    subjectsQuery = subjectsQuery.or('is_active.eq.true,is_active.is.null')
  } else if (status === 'inactive') {
    subjectsQuery = subjectsQuery.eq('is_active', false)
  }

  const [{ data: subjectsData }, { data: classesData }, { data: allSubjectsData }] = await Promise.all([
    subjectsQuery.order('name'),
    supabase
      .from('classes')
      .select('id, name, level, stream')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
    supabase.from('subjects').select('id, is_core, is_active').eq('school_id', schoolId),
  ])

  const subjects = (subjectsData || []) as Subject[]
  const classes = (classesData || []) as Class[]
  const allSubjects = (allSubjectsData || []) as Array<Pick<Subject, 'id' | 'is_core' | 'is_active'>>

  const classIds = classes.map((c) => c.id)
  const { data: assignmentRows } = classIds.length
    ? await supabase
        .from('teacher_assignments')
        .select('subject_id, class_id')
        .in('class_id', classIds)
    : { data: [] }

  const assignedSubjectIds = new Set((assignmentRows || []).map((a) => a.subject_id))

  const total = allSubjects.length
  const core = allSubjects.filter((s) => s.is_core).length
  const elective = total - core
  const active = allSubjects.filter((s) => s.is_active !== false).length
  const inactive = total - active
  const assigned = assignedSubjectIds.size

  const hasFilters = Boolean(search || type || status)

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Subjects</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage subjects across all classes</p>
        </div>
        <CreateSubjectDialog classes={classes} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Subjects</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{total}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">📖</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Core Subjects</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-400 mt-2">{core}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">⭐</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Elective Subjects</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-400 mt-2">{elective}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg">
                <div className="h-8 w-8 text-purple-600">✨</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Subjects</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-2">{active}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                <div className="h-8 w-8 text-green-600">✅</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Inactive Subjects</p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-400 mt-2">{inactive}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                <div className="h-8 w-8 text-amber-600">🗃️</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Assigned to Classes</p>
                <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-400 mt-2">{assigned}</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-lg">
                <div className="h-8 w-8 text-indigo-600">🧩</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subjects</CardTitle>
          <CardDescription>
            View and manage subjects across classes{hasFilters ? ' (filtered)' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubjectsFilters />
          {subjects.length ? (
            <SubjectsList subjects={subjects} classes={classes} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-700 dark:text-gray-300 mb-2 font-medium">No subjects found</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {hasFilters
                  ? 'Try changing your filters or clear them to see more subjects.'
                  : 'Create your first subject to start assigning teachers and generating reports.'}
              </p>
              <CreateSubjectDialog classes={classes} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
