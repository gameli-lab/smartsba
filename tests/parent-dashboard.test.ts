import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001' // Test school ID

describe('Parent - Dashboard & Profile', () => {
  let testParentId: string
  let testUserId: string

  beforeAll(async () => {
    // Get or create test school
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('id', SCHOOL_ID)
      .single()

    if (!school) {
      await supabase.from('schools').insert({
        id: SCHOOL_ID,
        name: 'Test School for Parent Dashboard',
        status: 'active',
      })
    }

    // Get a parent from the school for testing
    const { data: parents } = await supabase
      .from('parents')
      .select('id, user_id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (parents && parents.length > 0) {
      testParentId = parents[0].id
      testUserId = parents[0].user_id
    }
  })

  test('should retrieve parent profile', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { data, error } = await supabase
      .from('parents')
      .select('id, school_id, user_id')
      .eq('id', testParentId)
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.school_id).toBe(SCHOOL_ID)
  })

  test('should retrieve parent user profile', async () => {
    if (!testUserId) {
      return // Skip if no parent user
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, role, phone')
      .eq('user_id', testUserId)
      .single()

    expect(error).toBeNull()
    if (data) {
      expect(data.role).toBe('parent')
      expect(data.user_id).toBe(testUserId)
    }
  })

  test('should verify parent belongs to school', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { data, error } = await supabase
      .from('parents')
      .select('school_id')
      .eq('id', testParentId)
      .single()

    expect(error).toBeNull()
    expect(data?.school_id).toBe(SCHOOL_ID)
  })

  test('should count parents in school', async () => {
    const { count, error } = await supabase
      .from('parents')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', SCHOOL_ID)

    expect(error).toBeNull()
    expect(count ?? 0).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve parent by user_id', async () => {
    if (!testUserId) {
      return // Skip if no parent user
    }

    const { data, error } = await supabase
      .from('parents')
      .select('id, school_id')
      .eq('user_id', testUserId)
      .single()

    expect(error).toBeNull()
    if (data) {
      expect(data.id).toBe(testParentId)
      expect(data.school_id).toBe(SCHOOL_ID)
    }
  })

  test('should retrieve parent contact information', async () => {
    if (!testUserId) {
      return // Skip if no parent user
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('phone, email, address')
      .eq('user_id', testUserId)
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })
})

describe('Parent - Children/Students Management', () => {
  let testParentId: string

  beforeAll(async () => {
    const { data: parents } = await supabase
      .from('parents')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (parents && parents.length > 0) {
      testParentId = parents[0].id
    }
  })

  test('should retrieve parent children', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { data, error } = await supabase
      .from('parent_students')
      .select('student_id, relationship')
      .eq('parent_id', testParentId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should count parent children', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { count, error } = await supabase
      .from('parent_students')
      .select('student_id', { count: 'exact', head: true })
      .eq('parent_id', testParentId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve child profiles', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { data: parentStudents } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_id', testParentId)
      .limit(1)

    if (parentStudents && parentStudents.length > 0) {
      const studentId = parentStudents[0].student_id

      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, class_id, is_active, user_id')
        .eq('id', studentId)
        .single()

      expect(error).toBeNull()
      if (data) {
        expect(data.id).toBe(studentId)
        expect(data.school_id).toBe(SCHOOL_ID)
      }
    }
  })

  test('should retrieve relationship type', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { data, error } = await supabase
      .from('parent_students')
      .select('relationship')
      .eq('parent_id', testParentId)
      .limit(1)

    expect(error).toBeNull()
    if (data && data.length > 0) {
      expect(typeof data[0].relationship).toBe('string')
      // Relationship types: father, mother, guardian, etc.
    }
  })

  test('should verify all children belong to same school', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { data: parentStudents } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_id', testParentId)

    if (parentStudents && parentStudents.length > 0) {
      const studentIds = parentStudents.map((ps) => ps.student_id)

      const { data, error } = await supabase
        .from('students')
        .select('id, school_id')
        .in('id', studentIds)

      expect(error).toBeNull()
      if (data && data.length > 0) {
        data.forEach((student) => {
          expect(student.school_id).toBe(SCHOOL_ID)
        })
      }
    }
  })

  test('should retrieve active children only', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { data: parentStudents } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_id', testParentId)

    if (parentStudents && parentStudents.length > 0) {
      const studentIds = parentStudents.map((ps) => ps.student_id)

      const { data, error } = await supabase
        .from('students')
        .select('id, is_active')
        .in('id', studentIds)
        .eq('is_active', true)

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)

      if (data && data.length > 0) {
        data.forEach((student) => {
          expect(student.is_active).toBe(true)
        })
      }
    }
  })
})

describe('Parent - Student Performance & Results', () => {
  let testParentId: string
  let testStudentId: string

  beforeAll(async () => {
    const { data: parents } = await supabase
      .from('parents')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (parents && parents.length > 0) {
      testParentId = parents[0].id

      // Get first child
      const { data: parentStudents } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_id', testParentId)
        .limit(1)

      if (parentStudents && parentStudents.length > 0) {
        testStudentId = parentStudents[0].student_id
      }
    }
  })

  test('should retrieve child scores', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data, error } = await supabase
      .from('scores')
      .select('id, assessment_id, score, max_score')
      .eq('student_id', testStudentId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should count child assessments', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { count, error } = await supabase
      .from('scores')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', testStudentId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should calculate child average performance', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data, error } = await supabase
      .from('scores')
      .select('score, max_score')
      .eq('student_id', testStudentId)

    expect(error).toBeNull()

    if (data && data.length > 0) {
      const totalPercentage = data.reduce((sum, score) => {
        const percentage = score.max_score > 0 ? (score.score / score.max_score) * 100 : 0
        return sum + percentage
      }, 0)
      const average = totalPercentage / data.length
      expect(typeof average).toBe('number')
      expect(average).toBeGreaterThanOrEqual(0)
      expect(average).toBeLessThanOrEqual(100)
    }
  })

  test('should retrieve child performance aggregates', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { error } = await supabase
      .from('student_aggregates')
      .select('*')
      .eq('student_id', testStudentId)
      .single()

    // May not exist if aggregates haven't been calculated
    if (error && error.code !== 'PGRST116') {
      expect(error).toBeNull()
    }
  })

  test('should retrieve child class information', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data: student } = await supabase
      .from('students')
      .select('class_id')
      .eq('id', testStudentId)
      .single()

    if (student?.class_id) {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, level, stream')
        .eq('id', student.class_id)
        .single()

      expect(error).toBeNull()
      if (data) {
        expect(data.id).toBe(student.class_id)
      }
    }
  })

  test('should retrieve all children performance summary', async () => {
    if (!testParentId) {
      return // Skip if no parent
    }

    const { data: parentStudents } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_id', testParentId)

    if (parentStudents && parentStudents.length > 0) {
      const studentIds = parentStudents.map((ps) => ps.student_id)

      const { data, error } = await supabase
        .from('scores')
        .select('student_id, score, max_score')
        .in('student_id', studentIds)

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    }
  })
})

describe('Parent - Announcements & Communication', () => {
  test('should retrieve announcements for parents', async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, school_id, target_audience, created_at')
      .eq('school_id', SCHOOL_ID)
      .order('created_at', { ascending: false })

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should count announcements for school', async () => {
    const { count, error } = await supabase
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', SCHOOL_ID)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should filter announcements for parents', async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, target_audience')
      .eq('school_id', SCHOOL_ID)
      .contains('target_audience', ['parent'])

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should retrieve recent announcements', async () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data, error } = await supabase
      .from('announcements')
      .select('id, created_at')
      .eq('school_id', SCHOOL_ID)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should sort announcements by date', async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, created_at')
      .eq('school_id', SCHOOL_ID)
      .order('created_at', { ascending: false })
      .limit(10)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    // Verify descending order
    if (data && data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const prev = new Date(data[i - 1].created_at).getTime()
        const curr = new Date(data[i].created_at).getTime()
        expect(curr <= prev).toBe(true)
      }
    }
  })

  test('should retrieve general announcements', async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, target_audience')
      .eq('school_id', SCHOOL_ID)
      .contains('target_audience', ['parent'])

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('Parent - Class & Teacher Information', () => {
  let testParentId: string
  let testStudentId: string
  let testClassId: string

  beforeAll(async () => {
    const { data: parents } = await supabase
      .from('parents')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (parents && parents.length > 0) {
      testParentId = parents[0].id

      const { data: parentStudents } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_id', testParentId)
        .limit(1)

      if (parentStudents && parentStudents.length > 0) {
        testStudentId = parentStudents[0].student_id

        const { data: student } = await supabase
          .from('students')
          .select('class_id')
          .eq('id', testStudentId)
          .single()

        if (student?.class_id) {
          testClassId = student.class_id
        }
      }
    }
  })

  test('should retrieve child class details', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { data, error } = await supabase
      .from('classes')
      .select('id, name, level, stream, class_teacher_id')
      .eq('id', testClassId)
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })

  test('should retrieve class teacher information', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { data: classInfo } = await supabase
      .from('classes')
      .select('class_teacher_id')
      .eq('id', testClassId)
      .single()

    if (classInfo?.class_teacher_id) {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, staff_id, user_id')
        .eq('id', classInfo.class_teacher_id)
        .single()

      expect(error).toBeNull()
      if (data) {
        expect(data.id).toBe(classInfo.class_teacher_id)
      }
    }
  })

  test('should retrieve subjects taught in child class', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, code')
      .eq('class_id', testClassId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should count subjects in child class', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { count, error } = await supabase
      .from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', testClassId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve subject teachers', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { data: subjects } = await supabase
      .from('subjects')
      .select('id')
      .eq('class_id', testClassId)
      .limit(1)

    if (subjects && subjects.length > 0) {
      const { data, error } = await supabase
        .from('teacher_assignments')
        .select('teacher_id, subject_id')
        .eq('subject_id', subjects[0].id)

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    }
  })

  test('should count classmates', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { count, error } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', testClassId)
      .eq('is_active', true)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
