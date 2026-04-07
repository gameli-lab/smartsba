import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001' // Test school ID

describe('School Admin - Students Management', () => {
  let testStudentId: string

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
        name: 'Test School for Students',
        status: 'active',
      })
    }
  })

  afterAll(async () => {
    // Cleanup
    if (testStudentId) {
      await supabase.from('students').delete().eq('id', testStudentId)
    }
  })

  test('should retrieve students by school', async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, school_id, class_id, is_active')
      .eq('school_id', SCHOOL_ID)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should verify student belongs to school', async () => {
    const { data: students } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (students && students.length > 0) {
      const student = students[0]
      testStudentId = student.id
      expect(student.school_id).toBe(SCHOOL_ID)
    }
  })

  test('should toggle student status', async () => {
    const { data: students } = await supabase
      .from('students')
      .select('id, is_active')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (students && students.length > 0) {
      const student = students[0]
      const newStatus = !student.is_active

      const { data, error } = await supabase
        .from('students')
        .update({ is_active: newStatus })
        .eq('id', student.id)
        .select('is_active')
        .single()

      expect(error).toBeNull()
      expect(data?.is_active).toBe(newStatus)

      // Restore
      await supabase
        .from('students')
        .update({ is_active: student.is_active })
        .eq('id', student.id)
    }
  })

  test('should retrieve students with profiles and classes', async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, user_id, class_id, is_active')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    expect(error).toBeNull()
    if (data && data.length > 0) {
      expect(data[0].user_id).toBeDefined()
    }
  })

  test('should filter active students', async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, is_active')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    if (data && data.length > 0) {
      data.forEach((student) => {
        expect(student.is_active).toBe(true)
      })
    }
  })

  test('should filter inactive students', async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, is_active')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', false)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    if (data && data.length > 0) {
      data.forEach((student) => {
        expect(student.is_active).toBe(false)
      })
    }
  })

  test('should retrieve students by class', async () => {
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (classes && classes.length > 0) {
      const classId = classes[0].id
      const { data, error } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('class_id', classId)

      expect(error).toBeNull()
      if (data && data.length > 0) {
        data.forEach((student) => {
          expect(student.class_id).toBe(classId)
        })
      }
    }
  })

  test('should count students by school', async () => {
    const { count, error } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', SCHOOL_ID)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve students by admission number', async () => {
    const { data: students } = await supabase
      .from('students')
      .select('id, user_profile:user_profiles(admission_number)')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (students && students.length > 0) {
      const student = students[0]
      const admissionNumber = (student.user_profile as { admission_number?: string } | null)?.admission_number

      if (admissionNumber) {
        const { error } = await supabase
          .from('students')
          .select('id')
          .eq('school_id', SCHOOL_ID)
          .eq('user_profile.admission_number', admissionNumber)
          .limit(1)

        expect(error).toBeNull()
      }
    }
  })

  test('should sort students by creation date', async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, created_at')
      .eq('school_id', SCHOOL_ID)
      .order('created_at', { ascending: false })

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
