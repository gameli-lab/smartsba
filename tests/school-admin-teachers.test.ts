import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001' // Test school ID

describe('School Admin - Teachers Management', () => {
  let testTeacherId: string
  let testUserId: string

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
        name: 'Test School for Teachers',
        status: 'active',
      })
    }
  })

  afterAll(async () => {
    // Cleanup
    if (testTeacherId) {
      await supabase.from('teachers').delete().eq('id', testTeacherId)
    }
    if (testUserId) {
      // Note: Can't delete auth.users via service role without special function
      await supabase.from('user_profiles').delete().eq('user_id', testUserId)
    }
  })

  test('should retrieve teachers by school', async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, school_id, staff_id, is_active')
      .eq('school_id', SCHOOL_ID)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should verify teacher belongs to school', async () => {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, school_id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (teachers && teachers.length > 0) {
      const teacher = teachers[0]
      testTeacherId = teacher.id
      expect(teacher.school_id).toBe(SCHOOL_ID)
    }
  })

  test('should toggle teacher status', async () => {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, is_active')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (teachers && teachers.length > 0) {
      const teacher = teachers[0]
      const newStatus = !teacher.is_active

      const { data, error } = await supabase
        .from('teachers')
        .update({ is_active: newStatus })
        .eq('id', teacher.id)
        .select('is_active')
        .single()

      expect(error).toBeNull()
      expect(data?.is_active).toBe(newStatus)

      // Restore original status
      await supabase
        .from('teachers')
        .update({ is_active: teacher.is_active })
        .eq('id', teacher.id)
    }
  })

  test('should retrieve teachers with profiles', async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select(
        `
        id,
        staff_id,
        user_id
      `
      )
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    expect(error).toBeNull()
    if (data && data.length > 0) {
      expect(data[0].user_id).toBeDefined()
    }
  })

  test('should filter active teachers', async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, is_active')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    // All returned should be active
    if (data && data.length > 0) {
      data.forEach((teacher) => {
        expect(teacher.is_active).toBe(true)
      })
    }
  })

  test('should filter inactive teachers', async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, is_active')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', false)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    // All returned should be inactive
    if (data && data.length > 0) {
      data.forEach((teacher) => {
        expect(teacher.is_active).toBe(false)
      })
    }
  })

  test('should retrieve teacher by staff ID', async () => {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, staff_id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)
      .single()

    if (teacher) {
      const { data: foundTeacher, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('school_id', SCHOOL_ID)
        .eq('staff_id', teacher.staff_id)
        .single()

      expect(error).toBeNull()
      expect(foundTeacher?.id).toBe(teacher.id)
    }
  })

  test('should count teachers by school', async () => {
    const { data, count, error } = await supabase
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', SCHOOL_ID)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should sort teachers by staff ID', async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('staff_id')
      .eq('school_id', SCHOOL_ID)
      .order('staff_id', { ascending: true })

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    // Verify sorting
    if (data && data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1].staff_id || ''
        const curr = data[i].staff_id || ''
        expect(curr >= prev).toBe(true)
      }
    }
  })
})
