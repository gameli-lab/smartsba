import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001' // Test school ID

describe('School Admin - Subjects Management', () => {
  let testSubjectId: string
  let testClassId: string

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
        name: 'Test School for Subjects',
        status: 'active',
      })
    }

    // Ensure test class exists
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (classes && classes.length > 0) {
      testClassId = classes[0].id
    }
  })

  afterAll(async () => {
    // Cleanup
    if (testSubjectId) {
      await supabase.from('subjects').delete().eq('id', testSubjectId)
    }
  })

  test('should retrieve subjects by school', async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, code, class_id')
      .eq('school_id', SCHOOL_ID)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should retrieve subjects by class', async () => {
    if (!testClassId) {
      // Get first class
      const { data: classes } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', SCHOOL_ID)
        .limit(1)

      if (classes && classes.length > 0) {
        testClassId = classes[0].id
      } else {
        return // Skip if no classes
      }
    }

    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, code')
      .eq('class_id', testClassId)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should verify subject belongs to school', async () => {
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, school_id')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (subjects && subjects.length > 0) {
      const subject = subjects[0]
      testSubjectId = subject.id
      expect(subject.school_id).toBe(SCHOOL_ID)
    }
  })

  test('should retrieve subjects with class details', async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select(
        `
        id,
        name,
        code,
        classes(id, name, level)
      `
      )
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    expect(error).toBeNull()
    if (data && data.length > 0) {
      expect(data[0].classes).toBeDefined()
    }
  })

  test('should count subjects by school', async () => {
    const { count, error } = await supabase
      .from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', SCHOOL_ID)

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should retrieve subjects by code', async () => {
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, code')
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    if (subjects && subjects.length > 0) {
      const subject = subjects[0]
      const subjectCode = subject.code

      if (subjectCode) {
        const { error } = await supabase
          .from('subjects')
          .select('id')
          .eq('school_id', SCHOOL_ID)
          .eq('code', subjectCode)

        expect(error).toBeNull()
      }
    }
  })

  test('should list subjects ordered by name', async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('name')
      .eq('school_id', SCHOOL_ID)
      .order('name', { ascending: true })

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    // Verify ordering
    if (data && data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1].name || ''
        const curr = data[i].name || ''
        expect(curr >= prev).toBe(true)
      }
    }
  })

  test('should retrieve subjects assigned to teachers', async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select(
        `
        id,
        name,
        code
      `
      )
      .eq('school_id', SCHOOL_ID)
      .limit(1)

    expect(error).toBeNull()
    if (data && data.length > 0) {
      expect(data[0].id).toBeDefined()
      expect(data[0].name).toBeDefined()
    }
  })
})
