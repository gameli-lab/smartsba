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
  let subjectsQuery = supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId)
    // Treat null as active to avoid hiding legacy rows created before the status column/default
    .or('is_active.eq.true,is_active.is.null')

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

  const [{ data: subjectsData }, { data: classesData }] = await Promise.all([
    subjectsQuery.order('name'),
    supabase
      .from('classes')
      .select('id, name, level, stream')
      .eq('school_id', schoolId)
      .order('level', { ascending: true }),
  ])

  const subjects = (subjectsData || []) as Subject[]
  const classes = (classesData || []) as Class[]

  const total = subjects.length
  const core = subjects.filter((s) => s.is_core).length
  const elective = total - core

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subjects</h1>
          <p className="text-gray-600 mt-1">Manage subjects across all classes</p>
        </div>
        <CreateSubjectDialog classes={classes} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Subjects</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{total}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">📖</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Core Subjects</p>
                <p className="text-3xl font-bold text-blue-700 mt-2">{core}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">⭐</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Elective Subjects</p>
                <p className="text-3xl font-bold text-purple-700 mt-2">{elective}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-purple-600">✨</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subjects</CardTitle>
          <CardDescription>View and manage all subjects</CardDescription>
        </CardHeader>
        <CardContent>
          <SubjectsFilters />
          {subjects.length ? (
            <SubjectsList subjects={subjects} classes={classes} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No subjects found</p>
              <CreateSubjectDialog classes={classes} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
