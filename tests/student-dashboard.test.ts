import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001' // Test school ID

describe('Student - Dashboard & Profile', () => {
  let testStudentId: string
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
        name: 'Test School for Student Dashboard',
        status: 'active',
      })
    }

    // Get a student from the school for testing
    const { data: students } = await supabase
      .from('students')
      .select('id, user_id, class_id')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)
      .limit(1)

    if (students && students.length > 0) {
      testStudentId = students[0].id
      testUserId = students[0].user_id
      testClassId = students[0].class_id
    }
  })

  test('should retrieve student profile', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data, error } = await supabase
      .from('students')
      .select('id, school_id, class_id, is_active, user_id')
      .eq('id', testStudentId)
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.school_id).toBe(SCHOOL_ID)
  })

  test('should retrieve student user profile', async () => {
    if (!testUserId) {
      return // Skip if no student user
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, role, admission_number')
      .eq('user_id', testUserId)
      .single()

    expect(error).toBeNull()
    if (data) {
      expect(data.role).toBe('student')
      expect(data.user_id).toBe(testUserId)
    }
  })

  test('should verify student belongs to school', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data, error } = await supabase
      .from('students')
      .select('school_id')
      .eq('id', testStudentId)
      .single()

    expect(error).toBeNull()
    expect(data?.school_id).toBe(SCHOOL_ID)
  })

  test('should retrieve student status', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data, error } = await supabase
      .from('students')
      .select('is_active')
      .eq('id', testStudentId)
      .single()

    expect(error).toBeNull()
    expect(typeof data?.is_active).toBe('boolean')
  })

  test('should count active students in school', async () => {
    const { count, error } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve student by user_id', async () => {
    if (!testUserId) {
      return // Skip if no student user
    }

    const { data, error } = await supabase
      .from('students')
      .select('id, school_id, class_id')
      .eq('user_id', testUserId)
      .single()

    expect(error).toBeNull()
    if (data) {
      expect(data.id).toBe(testStudentId)
      expect(data.school_id).toBe(SCHOOL_ID)
    }
  })

  test('should retrieve student admission number', async () => {
    if (!testUserId) {
      return // Skip if no student user
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('admission_number')
      .eq('user_id', testUserId)
      .single()

    expect(error).toBeNull()
    // Admission number may or may not exist
    expect(data).toBeDefined()
  })

  test('should retrieve student class information', async () => {
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
})

describe('Student - Class & Subjects', () => {
  let testClassId: string

  beforeAll(async () => {
    const { data: students } = await supabase
      .from('students')
      .select('id, class_id')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)
      .limit(1)

    if (students && students.length > 0) {
      testClassId = students[0].class_id
    }
  })

  test('should retrieve student class', async () => {
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

  test('should retrieve subjects for student class', async () => {
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

  test('should count subjects in student class', async () => {
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

  test('should retrieve classmates', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { data, error } = await supabase
      .from('students')
      .select('id, user_id, is_active, class_id')
      .eq('class_id', testClassId)
      .eq('is_active', true)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    if (data && data.length > 0) {
      data.forEach((student) => {
        expect(student.class_id).toBe(testClassId)
      })
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
    expect(count).toBeGreaterThanOrEqual(1) // At least the test student
  })

  test('should retrieve class teacher', async () => {
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
})

describe('Student - Assessments & Results', () => {
  let testStudentId: string
  let testClassId: string

  beforeAll(async () => {
    const { data: students } = await supabase
      .from('students')
      .select('id, class_id')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)
      .limit(1)

    if (students && students.length > 0) {
      testStudentId = students[0].id
      testClassId = students[0].class_id
    }
  })

  test('should retrieve assessments for student class', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { data, error } = await supabase
      .from('assessments')
      .select('id, title, assessment_type, class_id, subject_id')
      .eq('class_id', testClassId)
      .order('created_at', { ascending: false })

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should count assessments for student class', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const { count, error } = await supabase
      .from('assessments')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', testClassId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve student scores', async () => {
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

  test('should count student scores', async () => {
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

  test('should calculate student average score', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data, error } = await supabase
      .from('scores')
      .select('score, max_score')
      .eq('student_id', testStudentId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

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

  test('should filter assessments by type', async () => {
    if (!testClassId) {
      return // Skip if no class
    }

    const assessmentTypes = ['assignment', 'quiz', 'exam', 'project']
    const testType = assessmentTypes[0]

    const { data, error } = await supabase
      .from('assessments')
      .select('id, assessment_type')
      .eq('class_id', testClassId)
      .eq('assessment_type', testType)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    if (data && data.length > 0) {
      data.forEach((assessment) => {
        expect(assessment.assessment_type).toBe(testType)
      })
    }
  })
})

describe('Student - Announcements', () => {
  test('should retrieve announcements for student school', async () => {
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

  test('should filter announcements for students', async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, target_audience')
      .eq('school_id', SCHOOL_ID)
      .contains('target_audience', ['student'])

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
})

describe('Student - Performance Analytics', () => {
  let testStudentId: string

  beforeAll(async () => {
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)
      .limit(1)

    if (students && students.length > 0) {
      testStudentId = students[0].id
    }
  })

  test('should retrieve student performance aggregates', async () => {
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

  test('should retrieve scores by subject', async () => {
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

  test('should calculate total assessments taken', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { count, error } = await supabase
      .from('scores')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', testStudentId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
  })

  test('should identify highest score', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data, error } = await supabase
      .from('scores')
      .select('score, max_score')
      .eq('student_id', testStudentId)

    expect(error).toBeNull()

    if (data && data.length > 0) {
      const percentages = data.map((s) => (s.max_score > 0 ? (s.score / s.max_score) * 100 : 0))
      const highest = Math.max(...percentages)
      expect(typeof highest).toBe('number')
      expect(highest).toBeGreaterThanOrEqual(0)
      expect(highest).toBeLessThanOrEqual(100)
    }
  })

  test('should identify lowest score', async () => {
    if (!testStudentId) {
      return // Skip if no student
    }

    const { data, error } = await supabase
      .from('scores')
      .select('score, max_score')
      .eq('student_id', testStudentId)

    expect(error).toBeNull()

    if (data && data.length > 0) {
      const percentages = data.map((s) => (s.max_score > 0 ? (s.score / s.max_score) * 100 : 0))
      const lowest = Math.min(...percentages)
      expect(typeof lowest).toBe('number')
      expect(lowest).toBeGreaterThanOrEqual(0)
      expect(lowest).toBeLessThanOrEqual(100)
    }
  })
})
