import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001' // Test school ID

describe('Teacher - Dashboard & Profile', () => {
  let testTeacherId: string
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
        name: 'Test School for Teacher Dashboard',
        status: 'active',
      })
    }

    // Get a teacher from the school for testing
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, user_id')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)
      .limit(1)

    if (teachers && teachers.length > 0) {
      testTeacherId = teachers[0].id
      testUserId = teachers[0].user_id
    }
  })

  test('should retrieve teacher profile', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('teachers')
      .select('id, school_id, staff_id, is_active, user_id')
      .eq('id', testTeacherId)
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.school_id).toBe(SCHOOL_ID)
  })

  test('should retrieve teacher user profile', async () => {
    if (!testUserId) {
      return // Skip if no teacher user
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, role')
      .eq('user_id', testUserId)
      .single()

    expect(error).toBeNull()
    if (data) {
      expect(data.role).toBe('teacher')
      expect(data.user_id).toBe(testUserId)
    }
  })

  test('should verify teacher belongs to school', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('teachers')
      .select('school_id')
      .eq('id', testTeacherId)
      .single()

    expect(error).toBeNull()
    expect(data?.school_id).toBe(SCHOOL_ID)
  })

  test('should retrieve teacher status', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('teachers')
      .select('is_active')
      .eq('id', testTeacherId)
      .single()

    expect(error).toBeNull()
    expect(typeof data?.is_active).toBe('boolean')
  })

  test('should count active teachers in school', async () => {
    const { count, error } = await supabase
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve teacher by user_id', async () => {
    if (!testUserId) {
      return // Skip if no teacher user
    }

    const { data, error } = await supabase
      .from('teachers')
      .select('id, school_id, staff_id')
      .eq('user_id', testUserId)
      .single()

    expect(error).toBeNull()
    if (data) {
      expect(data.id).toBe(testTeacherId)
      expect(data.school_id).toBe(SCHOOL_ID)
    }
  })

  test('should retrieve teacher staff_id', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('teachers')
      .select('staff_id')
      .eq('id', testTeacherId)
      .single()

    expect(error).toBeNull()
    expect(data?.staff_id).toBeDefined()
  })
})

describe('Teacher - Subject Assignments', () => {
  let testTeacherId: string

  beforeAll(async () => {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)
      .limit(1)

    if (teachers && teachers.length > 0) {
      testTeacherId = teachers[0].id
    }
  })

  test('should retrieve teacher assignments', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('id, teacher_id, class_id, subject_id, academic_year')
      .eq('teacher_id', testTeacherId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    if (data && data.length > 0) {
      data.forEach((assignment) => {
        expect(assignment.teacher_id).toBe(testTeacherId)
      })
    }
  })

  test('should count teacher assignments', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { count, error } = await supabase
      .from('teacher_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', testTeacherId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve assignments with class and subject info', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('id, class_id, subject_id, academic_year')
      .eq('teacher_id', testTeacherId)
      .limit(5)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should retrieve assignments for current academic year', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const currentYear = new Date().getFullYear()

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('id, academic_year')
      .eq('teacher_id', testTeacherId)
      .eq('academic_year', currentYear)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    if (data && data.length > 0) {
      data.forEach((assignment) => {
        expect(assignment.academic_year).toBe(currentYear)
      })
    }
  })

  test('should retrieve distinct subjects taught by teacher', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('subject_id')
      .eq('teacher_id', testTeacherId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should retrieve distinct classes taught by teacher', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('class_id')
      .eq('teacher_id', testTeacherId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('Teacher - Class Management', () => {
  let testTeacherId: string

  beforeAll(async () => {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)
      .limit(1)

    if (teachers && teachers.length > 0) {
      testTeacherId = teachers[0].id
    }
  })

  test('should retrieve classes where teacher is class teacher', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { data, error } = await supabase
      .from('classes')
      .select('id, name, level, class_teacher_id')
      .eq('class_teacher_id', testTeacherId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    if (data && data.length > 0) {
      data.forEach((cls) => {
        expect(cls.class_teacher_id).toBe(testTeacherId)
      })
    }
  })

  test('should count classes assigned to teacher', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    const { count, error } = await supabase
      .from('teacher_assignments')
      .select('class_id', { count: 'exact', head: true })
      .eq('teacher_id', testTeacherId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
  })

  test('should retrieve students in teacher classes', async () => {
    if (!testTeacherId) {
      return // Skip if no teacher
    }

    // First get classes for this teacher
    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select('class_id')
      .eq('teacher_id', testTeacherId)
      .limit(1)

    if (!assignments || assignments.length === 0) {
      return // Skip if no assignments
    }

    const classId = assignments[0].class_id

    const { data, error } = await supabase
      .from('students')
      .select('id, class_id, is_active')
      .eq('class_id', classId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('Teacher - Announcements', () => {
  test('should retrieve announcements for teacher school', async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, school_id, target_audience')
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

  test('should filter announcements by target audience', async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, target_audience')
      .eq('school_id', SCHOOL_ID)
      .contains('target_audience', ['teacher'])

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})
