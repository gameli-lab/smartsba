import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth'
import { createServerComponentClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateClassDialog } from './create-class-dialog'
import { ClassesList } from './classes-list'
import { ClassesFilters } from './classes-filters'
import { LEVEL_GROUPS } from '@/lib/constants/level-groups'
import type { Class } from '@/types'

interface TeacherOption {
  id: string
  full_name: string
  staff_id: string
  is_active: boolean
}

interface ClassWithExtras extends Class {
  class_teacher?: TeacherOption | null
  students_count: number
  subjects_count: number
}

type SearchParams = Record<string, string | string[] | undefined>

interface ClassRow {
  id: string
  name: string
  level: number
  stream: string | null
  description: string | null
  class_teacher_id: string | null
  created_at: string
  updated_at: string
}

interface TeacherRow {
  id: string
  staff_id: string
  is_active: boolean
  user_profile: { id: string; full_name: string }
}

export default async function ClassesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  noStore()

  const params = (await searchParams) || {}
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id
  const supabase = await createServerComponentClient()

  const search = typeof params.search === 'string' ? params.search : undefined
  const levelFilter = typeof params.level === 'string' ? params.level : undefined
  const streamFilter = typeof params.stream === 'string' ? params.stream : undefined
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined
  const hasFilters = Boolean(search || levelFilter || streamFilter)

  const limit = 10

  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()

  let classesQuery = supabase
    .from('classes')
    .select(
      `id, name, level, stream, description, class_teacher_id, created_at, updated_at`
    )
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (search) {
    classesQuery = classesQuery.or(`name.ilike.%${search}%,stream.ilike.%${search}%`)
  }

  if (streamFilter) {
    classesQuery = classesQuery.eq('stream', streamFilter)
  }

  if (levelFilter) {
    const levelKey = levelFilter.toUpperCase() as keyof typeof LEVEL_GROUPS
    const levels = LEVEL_GROUPS[levelKey]?.numericLevels
    if (levels && levels.length) {
      classesQuery = classesQuery.in('level', levels)
    }
  }

  if (cursor) {
    classesQuery = classesQuery.lt('created_at', cursor)
  }

  const [classesResult, teachersResult] = await Promise.all([
    classesQuery,
    supabase
      .from('teachers')
      .select(
        `id, staff_id, is_active, user_profile:user_profiles!inner(id, full_name)`
      )
      .eq('school_id', schoolId)
      .order('staff_id'),
  ])

  const classesData = (classesResult.data || []) as ClassRow[]
  const teachersData = (teachersResult.data || []) as TeacherRow[]

  const teachers: TeacherOption[] = teachersData.map((t) => ({
    id: t.id,
    full_name: t.user_profile?.full_name || 'Unknown',
    staff_id: t.staff_id,
    is_active: t.is_active,
  }))

  const hasNextPage = classesData.length > limit
  const visibleClasses: ClassRow[] = hasNextPage ? classesData.slice(0, limit) : classesData

  const classIds = visibleClasses.map((c) => c.id)

  // Student and subject counts per class (scoped)
  const [studentCounts, subjectCounts] = await Promise.all([
    Promise.all(
      classIds.map(async (classId) => {
        const { count } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('class_id', classId)
        return { classId, count: count || 0 }
      })
    ),
    Promise.all(
      classIds.map(async (classId) => {
        const { count } = await supabase
          .from('subjects')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('class_id', classId)
        return { classId, count: count || 0 }
      })
    ),
  ])

  const studentCountMap = new Map<string, number>(
    studentCounts.map(({ classId, count }) => [classId, count])
  )
  const subjectCountMap = new Map<string, number>(
    subjectCounts.map(({ classId, count }) => [classId, count])
  )

  const classesWithExtras: ClassWithExtras[] = visibleClasses.map((c) => ({
    ...c,
    class_teacher: c.class_teacher_id
      ? teachers.find((t) => t.id === c.class_teacher_id) || null
      : null,
    students_count: studentCountMap.get(c.id) ?? 0,
    subjects_count: subjectCountMap.get(c.id) ?? 0,
  }))

  const total = classesWithExtras.length
  const withTeachers = classesWithExtras.filter((c) => c.class_teacher).length
  const nextCursor = hasNextPage ? classesData[limit - 1].created_at : null

  const buildQueryString = (override: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (levelFilter) qs.set('level', levelFilter)
    if (streamFilter) qs.set('stream', streamFilter)
    if (override.cursor) qs.set('cursor', override.cursor)
    return qs.toString()
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Classes</h1>
            {currentSession && (
              <Badge variant="secondary">
                Term {currentSession.term} • {currentSession.academic_year}
              </Badge>
            )}
            {!currentSession && <Badge variant="outline">Session not set</Badge>}
          </div>
          <p className="text-gray-600">Manage classes and streams</p>
        </div>
        <div className="flex items-center gap-2">
          <CreateClassDialog teachers={teachers} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Classes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{total}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-blue-600">📚</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">With Teachers</p>
                <p className="text-3xl font-bold text-green-700 mt-2">{withTeachers}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-green-600">👨‍🏫</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Without Teachers</p>
                <p className="text-3xl font-bold text-gray-500 mt-2">{total - withTeachers}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="h-8 w-8 text-gray-600">⚠️</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>All Classes</CardTitle>
          <CardDescription>
            View and manage all classes{hasFilters ? ' (filtered)' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Link href="/school-admin/teacher-assignments" className="inline-flex">
              <Button variant="outline" size="sm">Assign Teachers</Button>
            </Link>
            <Link href="/school-admin/subjects" className="inline-flex">
              <Button variant="outline" size="sm">Manage Subjects</Button>
            </Link>
          </div>

          <ClassesFilters />
          {classesWithExtras.length ? (
            <ClassesList classes={classesWithExtras} teachers={teachers} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-700 mb-2 font-medium">No classes found</p>
              <p className="text-sm text-gray-500 mb-4">
                {hasFilters
                  ? 'Try changing your filters or clear them to see more classes.'
                  : 'Create your first class to start assigning teachers and enrolling students.'}
              </p>
              {hasFilters && (
                <Link href="/school-admin/classes" className="inline-flex mb-3">
                  <Button variant="ghost" size="sm">Clear Filters</Button>
                </Link>
              )}
              <CreateClassDialog teachers={teachers} />
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {classesWithExtras.length} classes
            </div>
            <div className="flex gap-2">
              {cursor && (
                <Link
                  href={`/school-admin/classes` + (buildQueryString() ? `?${buildQueryString()}` : '')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Back to first page
                </Link>
              )}
              {nextCursor && (
                <Link
                  href={`/school-admin/classes?${buildQueryString({ cursor: nextCursor })}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
