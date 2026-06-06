import { createAdminSupabaseClient } from '@/lib/supabase'
import { getResultsCompletion, getPendingPromotionsCount } from '@/lib/school-metrics'

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

function makeQueryResult(result: any) {
  const obj: any = {
    eq: () => obj,
    maybeSingle: () => Promise.resolve(result),
  }
  obj.then = (onFulfilled: any, onRejected: any) => Promise.resolve(result).then(onFulfilled, onRejected)
  return obj
}

describe('school-metrics helpers', () => {
  beforeEach(() => {
    ;(createAdminSupabaseClient as jest.Mock).mockReset()
  })

  test('getResultsCompletion returns zeros when no students', async () => {
    const mockAdmin = {
      from: (table: string) => ({
        select: () => {
          if (table === 'students') return makeQueryResult({ data: [], error: null })
          if (table === 'assessments') return makeQueryResult({ count: 0 })
          return makeQueryResult({ data: [], error: null })
        },
      }),
    }

    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdmin)

    const res = await getResultsCompletion('school1', 'term1')
    expect(res).toEqual({ studentCount: 0, completedCount: 0, percent: 0 })
  })

  test('getResultsCompletion computes percent correctly', async () => {
    const mockAdmin = {
      from: (table: string) => ({
        select: () => {
          if (table === 'students') return makeQueryResult({ data: [{ id: 's1' }, { id: 's2' }], error: null })
          if (table === 'assessments') return makeQueryResult({ count: 2 })
          if (table === 'scores') return makeQueryResult({ data: [
            { student_id: 's1', assessment_id: 'a1' },
            { student_id: 's1', assessment_id: 'a2' },
            { student_id: 's2', assessment_id: 'a1' },
          ], error: null })
          return makeQueryResult({ data: [], error: null })
        },
      }),
    }

    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdmin)

    const res = await getResultsCompletion('school1', 'term1')
    expect(res.studentCount).toBe(2)
    expect(res.completedCount).toBe(1)
    expect(res.percent).toBe(50)
  })

  test('getPendingPromotionsCount returns numeric count', async () => {
    const mockAdmin = {
      from: (table: string) => ({
        select: () => {
          if (table === 'grading_promotions') return makeQueryResult({ count: 5 })
          return makeQueryResult({ data: [], error: null })
        },
      }),
    }

    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdmin)

    const count = await getPendingPromotionsCount('school1', 'term3')
    expect(count).toBe(5)
  })
})
