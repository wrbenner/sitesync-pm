import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../../api/errors'

vi.mock('../../lib/errorTracking', () => ({
  captureException: vi.fn(),
}))

vi.mock('../../lib/aiService', () => ({
  aiService: {
    isConfigured: vi.fn(),
    generateInsights: vi.fn(),
  },
}))

vi.mock('../../api/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('../../api/middleware/projectScope', () => ({
  validateProjectId: vi.fn(),
}))

import { captureException } from '../../lib/errorTracking'
import { aiService } from '../../lib/aiService'
import { supabase } from '../../api/client'
import { getAiInsights } from '../../api/endpoints/ai'

const projectId = 'proj-123'

function mockSupabaseChain(result: { data: unknown[] | null; error: unknown | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
  }
  ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  return chain
}

describe('getAiInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('aiService fallback path', () => {
    it('calls captureException when aiService throws', async () => {
      const aiError = new Error('AI service timeout')
      ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
      ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockRejectedValue(aiError)
      mockSupabaseChain({ data: [], error: null })

      await getAiInsights(projectId)

      expect(captureException).toHaveBeenCalledOnce()
      expect(captureException).toHaveBeenCalledWith(
        aiError,
        expect.objectContaining({ projectId, extra: { context: 'getAiInsights_aiService' } })
      )
    })

    it('returns Supabase data with lastFallbackAt when aiService fails', async () => {
      ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
      ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'))
      mockSupabaseChain({ data: [], error: null })

      const result = await getAiInsights(projectId)

      expect(result.insights).toEqual([])
      expect(result.lastFallbackAt).toBeDefined()
      expect(typeof result.lastFallbackAt).toBe('string')
    })

    it('wraps non-Error throws in an Error before calling captureException', async () => {
      ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
      ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockRejectedValue('string error')
      mockSupabaseChain({ data: [], error: null })

      await getAiInsights(projectId)

      const [capturedError] = (captureException as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(capturedError).toBeInstanceOf(Error)
      expect(capturedError.message).toBe('string error')
    })
  })

  describe('double-failure path', () => {
    it('throws 503 ApiError with AI_UNAVAILABLE code when both aiService and Supabase fail', async () => {
      ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
      ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('AI down'))
      mockSupabaseChain({ data: null, error: { message: 'DB error', code: '500' } })

      await expect(getAiInsights(projectId)).rejects.toMatchObject({
        status: 503,
        code: 'AI_UNAVAILABLE',
      })
    })

    it('throws ApiError (not raw error) so callers always receive typed errors', async () => {
      ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
      ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('AI down'))
      mockSupabaseChain({ data: null, error: { message: 'DB error', code: '500' } })

      await expect(getAiInsights(projectId)).rejects.toBeInstanceOf(ApiError)
    })

    it('still calls captureException for aiService error before throwing on Supabase failure', async () => {
      ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
      ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('AI down'))
      mockSupabaseChain({ data: null, error: { message: 'DB error', code: '500' } })

      await expect(getAiInsights(projectId)).rejects.toThrow()
      expect(captureException).toHaveBeenCalledOnce()
    })
  })

  describe('happy path (no fallback)', () => {
    it('returns insights without lastFallbackAt when aiService succeeds', async () => {
      const mockInsights = [{ id: '1', title: 'Risk detected' }]
      ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
      ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsights)

      const result = await getAiInsights(projectId)

      expect(result.insights).toEqual([{ id: '1', title: 'Risk detected', source: 'live' }])
      expect(result.lastFallbackAt).toBeUndefined()
      expect(captureException).not.toHaveBeenCalled()
    })

    it('returns Supabase data with lastFallbackAt when aiService is not configured', async () => {
      ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false)
      mockSupabaseChain({ data: [], error: null })

      const result = await getAiInsights(projectId)

      expect(result.insights).toEqual([])
      expect(result.lastFallbackAt).toBeDefined()
      expect(captureException).not.toHaveBeenCalled()
    })
  })
})
