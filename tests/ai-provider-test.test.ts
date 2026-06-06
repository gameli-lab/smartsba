import Anthropic from '@anthropic-ai/sdk'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { clearAIConfigCache, testConfiguredAIProviders } from '@/services/aiLLMService'

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }))
})

describe('testConfiguredAIProviders', () => {
  beforeEach(() => {
    clearAIConfigCache()
    ;(createAdminSupabaseClient as jest.Mock).mockReset()
    ;(Anthropic as unknown as jest.Mock).mockClear()
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.GOOGLE_AI_API_KEY
    delete process.env.GEMINI_API_KEY
  })

  test('returns a success result for configured anthropic provider', async () => {
    const anthropicCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'OK' }],
    })
    ;(Anthropic as unknown as jest.Mock).mockImplementation(() => ({
      messages: { create: anthropicCreate },
    }))

    const mockAdmin = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({
            data: [
              { setting_key: 'ai.default_provider', setting_value: 'anthropic' },
              { setting_key: 'ai.anthropic_api_key', setting_value: 'anth-key' },
              { setting_key: 'ai.anthropic_model', setting_value: 'claude-3-5-sonnet-20241022' },
            ],
            error: null,
          }),
        }),
      }),
    }

    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdmin)

    const results = await testConfiguredAIProviders(['anthropic'])

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      provider: 'anthropic',
      enabled: true,
      success: true,
      response: 'OK',
    })
    expect(anthropicCreate).toHaveBeenCalled()
  })

  test('returns not configured when provider key is missing', async () => {
    const mockAdmin = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({
            data: [
              { setting_key: 'ai.default_provider', setting_value: 'openai' },
            ],
            error: null,
          }),
        }),
      }),
    }

    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdmin)

    const results = await testConfiguredAIProviders(['openai'])

    expect(results[0]).toMatchObject({
      provider: 'openai',
      enabled: false,
      success: false,
      error: 'Provider is not configured',
    })
  })
})
