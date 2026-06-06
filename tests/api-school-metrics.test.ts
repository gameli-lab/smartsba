import { GET } from '@/app/api/school-admin/metrics/route'
import { createServerComponentClient } from '@/lib/supabase'
import { getResultsCompletion, getPendingPromotionsCount } from '@/lib/school-metrics'

jest.mock('@/lib/school-metrics', () => ({
  getResultsCompletion: jest.fn(),
  getPendingPromotionsCount: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  createServerComponentClient: jest.fn(),
}))

describe('metrics API route', () => {
  beforeEach(() => {
    ;(createServerComponentClient as jest.Mock).mockReset()
    ;(getResultsCompletion as jest.Mock).mockReset()
    ;(getPendingPromotionsCount as jest.Mock).mockReset()
  })

  test('GET returns metrics for authenticated school admin', async () => {
    const serverMock: any = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { role: 'school_admin', school_id: 's1' }, error: null }),
          }),
        }),
      }),
    }

    ;(createServerComponentClient as jest.Mock).mockResolvedValue(serverMock)
    ;(getResultsCompletion as jest.Mock).mockResolvedValue({ studentCount: 10, completedCount: 8, percent: 80 })
    ;(getPendingPromotionsCount as jest.Mock).mockResolvedValue(3)

    const req: any = { url: 'http://localhost/api/school-admin/metrics?term=term3' }
    const res: any = await GET(req)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.metrics.percent).toBe(80)
    expect(json.pendingPromotions).toBe(3)
  })
})
