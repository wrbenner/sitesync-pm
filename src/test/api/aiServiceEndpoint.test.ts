import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/aiService', () => ({
  aiService: {
    isConfigured: vi.fn(),
    generateInsights: vi.fn(),
    draftRFIResponse: vi.fn(),
    summarizeDailyLog: vi.fn(),
  },
}))

// rfis endpoint is imported inside draftRFIResponse via the lib; mock to avoid Supabase
vi.mock('../../api/endpoints/rfis', () => ({
  getRfiById: vi.fn().mockResolvedValue(null),
}))

import { aiService } from '../../lib/aiService'
import {
  generateProjectInsights,
  draftRFIResponse,
  summarizeDailyLog,
} from '../../api/endpoints/aiService'
import type { AIContext } from '../../types/ai'

const mockContext: AIContext = { projectId: 'proj-1', currentPage: 'rfis' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateProjectInsights', () => {
  it('returns [] without calling the service when not configured', async () => {
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const result = await generateProjectInsights('proj-1')
    expect(result).toEqual([])
    expect(aiService.generateInsights).not.toHaveBeenCalled()
  })

  it('returns insights on success', async () => {
    const insights = [{ id: '1', title: 'Risk' }]
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockResolvedValue(insights)
    const result = await generateProjectInsights('proj-1')
    expect(result).toEqual(insights)
  })

  it('returns [] and does not throw when the service throws', async () => {
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(aiService.generateInsights as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'))
    await expect(generateProjectInsights('proj-1')).resolves.toEqual([])
  })
})

describe('draftRFIResponse', () => {
  it('returns empty string without calling the service when not configured', async () => {
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const result = await draftRFIResponse('rfi-1', mockContext)
    expect(result).toBe('')
    expect(aiService.draftRFIResponse).not.toHaveBeenCalled()
  })

  it('returns the draft string on success', async () => {
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(aiService.draftRFIResponse as ReturnType<typeof vi.fn>).mockResolvedValue('Draft response text')
    const result = await draftRFIResponse('rfi-1', mockContext)
    expect(result).toBe('Draft response text')
  })

  it('returns empty string and does not throw when the service throws', async () => {
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(aiService.draftRFIResponse as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('AI down'))
    await expect(draftRFIResponse('rfi-1', mockContext)).resolves.toBe('')
  })
})

describe('summarizeDailyLog', () => {
  it('returns null without calling the service when not configured', async () => {
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const result = await summarizeDailyLog({ date: '2026-04-01' })
    expect(result).toBeNull()
    expect(aiService.summarizeDailyLog).not.toHaveBeenCalled()
  })

  it('returns the summary string on success', async () => {
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(aiService.summarizeDailyLog as ReturnType<typeof vi.fn>).mockResolvedValue('Work progressed well today.')
    const result = await summarizeDailyLog({ date: '2026-04-01' })
    expect(result).toBe('Work progressed well today.')
  })

  it('returns null and does not throw when the service throws', async () => {
    ;(aiService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(aiService.summarizeDailyLog as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'))
    await expect(summarizeDailyLog({ date: '2026-04-01' })).resolves.toBeNull()
  })
})
