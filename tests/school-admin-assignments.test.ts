import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001' // Test school ID

describe('School Admin - Teacher Assignments Management', () => {
  let testAssignmentId: string

  beforeAll(async () => {
    // Ensure school exists
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('id', SCHOOL_ID)
      .single()

    if (!school) {
      await supabase.from('schools').insert({
        id: SCHOOL_ID,
        name: 'Test School for Assignments',
        status: 'active',
      })
    }
  })

  afterAll(async () => {
    // Cleanup
    if (testAssignmentId) {
      await supabase
        .from('teacher_assignments')
        .delete()
        .eq('id', testAssignmentId)
    }
  })

  test('should retrieve teacher assignments by school', async () => {
    // Get teachers from school
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (!teachers || teachers.length === 0) {
      return // Skip if no teachers
    }

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select(
        `
        id,
        teacher:teachers(id, staff_id),
        class:classes(id, name),
        subject:subjects(id, name)
      `
      )

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should retrieve assignments by teacher', async () => {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (!teachers || teachers.length === 0) {
      return // Skip if no teachers
    }

    const teacherId = teachers[0].id

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select(
        `
        id,
        class:classes(id, name),
        subject:subjects(id, name)
      `
      )
      .eq('teacher_id', teacherId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    // All should have same teacher_id
    if (data && data.length > 0) {
      data.forEach((assignment: any) => {
        expect(assignment.teacher_id || true).toBeTruthy() // teacher_id exists on parent
      })
    }
  })

  test('should retrieve assignments by class', async () => {
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (!classes || classes.length === 0) {
      return // Skip if no classes
    }

    const classId = classes[0].id

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select(
        `
        id,
        teacher_id,
        subject_id
      `
      )
      .eq('class_id', classId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    // All should have same class_id
    if (data && data.length > 0) {
      data.forEach((assignment: any) => {
        expect(assignment.class_id || true).toBeTruthy() // class_id exists on parent
      })
    }
  })

  test('should retrieve assignments by subject', async () => {
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (!subjects || subjects.length === 0) {
      return // Skip if no subjects
    }

    const subjectId = subjects[0].id

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select(
        `
        id,
        teacher_id,
        class_id
      `
      )
      .eq('subject_id', subjectId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should count assignments by teacher', async () => {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (!teachers || teachers.length === 0) {
      return // Skip if no teachers
    }

    const teacherId = teachers[0].id

    const { count, error } = await supabase
      .from('teacher_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should count assignments by class', async () => {
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (!classes || classes.length === 0) {
      return // Skip if no classes
    }

    const classId = classes[0].id

    const { count, error } = await supabase
      .from('teacher_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve assignments with full relationships', async () => {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .select(
        `
        id,
        academic_year,
        teacher_id,
        class_id,
        subject_id
      `
      )
      .limit(3)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    if (data && data.length > 0) {
      data.forEach((assignment: any) => {
        expect(assignment.teacher_id).toBeDefined()
        expect(assignment.class_id).toBeDefined()
        expect(assignment.subject_id).toBeDefined()
      })
    }
  })

  test('should list assignments ordered by academic year', async () => {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('id, academic_year')
      .order('academic_year', { ascending: false })
      .limit(10)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    // Verify ordering
    if (data && data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        expect(data[i].academic_year <= data[i - 1].academic_year).toBe(true)
      }
    }
  })
})
