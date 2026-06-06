import { POST } from '@/app/api/super-admin/ai/test/route'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { testConfiguredAIProviders } from '@/services/aiLLMService'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@/services/aiLLMService', () => ({
  testConfiguredAIProviders: jest.fn(),
}))

describe('super-admin ai test route', () => {
  beforeEach(() => {
    ;(createClient as jest.Mock).mockReset()
    ;(createAdminSupabaseClient as jest.Mock).mockReset()
    ;(testConfiguredAIProviders as jest.Mock).mockReset()
  })

  test('returns test results for super admin', async () => {
    ;(createClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
    })

    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { role: 'super_admin' }, error: null }),
          }),
        }),
      }),
    })

    ;(testConfiguredAIProviders as jest.Mock).mockResolvedValue([
      { provider: 'anthropic', model: 'claude', enabled: true, success: true, response: 'OK' },
    ])

    const req: any = {
      headers: new Map([['authorization', 'Bearer token']]),
      json: () => Promise.resolve({ providers: ['anthropic'] }),
    }
    req.headers.get = req.headers.get.bind(req.headers)

    const res: any = await POST(req)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.results).toHaveLength(1)
    expect(testConfiguredAIProviders).toHaveBeenCalledWith(['anthropic'])
  })
})
