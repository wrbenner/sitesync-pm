import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock all external dependencies before importing AIService
vi.mock('../../hooks/useProjectCache', () => ({
  getCachedProjectContext: vi.fn().mockResolvedValue('mock project context'),
}))

vi.mock('../../api/endpoints/rfis', () => ({
  getRfiById: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../api/endpoints/schedule', () => ({
  getSchedulePhases: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../lib/weather', () => ({
  getWeatherForecast: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../lib/predictions', () => ({
  predictScheduleDelays: vi.fn().mockReturnValue([]),
}))

import { AIService } from '../../lib/aiService'
import type { ProjectFinancials, DivisionFinancials } from '../../types/financial'
import type { AIMessage, AIContext } from '../../types/ai'

// Minimal stub for ProjectFinancials
function makeProjectFinancials(overrides?: Partial<ProjectFinancials>): ProjectFinancials {
  return {
    isEmpty: false,
    originalContractValue: 42_800_000,
    approvedChangeOrders: 0,
    approvedCOValue: 0,
    revisedContractValue: 42_800_000,
    pendingChangeOrders: 0,
    pendingCOValue: 0,
    pendingExposure: 0,
    totalPotentialContract: 42_800_000,
    committedCost: 18_200_000,
    invoicedToDate: 18_200_000,
    costToComplete: 0,
    projectedFinalCost: 41_900_000,
    variance: 900_000,
    variancePercent: 2.1,
    percentComplete: 42,
    retainageHeld: 0,
    retainageReceivable: 0,
    overUnder: 900_000,
    ...overrides,
  }
}

function makeDivisionFinancials(overrides?: Partial<DivisionFinancials>): DivisionFinancials {
  return {
    divisionCode: '03',
    divisionName: 'Concrete',
    originalBudget: 8_500_000,
    approvedChanges: 0,
    revisedBudget: 8_500_000,
    committedCost: 7_980_000,
    invoicedToDate: 7_980_000,
    costToComplete: 0,
    projectedFinalCost: 8_500_000,
    variance: 0,
    variancePercent: 0,
    percentComplete: 94,
    ...overrides,
  }
}

function makeAIMessage(overrides?: Partial<AIMessage>): AIMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'What is the project status?',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function makeContext(overrides?: Partial<AIContext>): AIContext {
  return {
    projectId: 'proj-test-123',
    currentPage: 'dashboard',
    ...overrides,
  }
}

describe('AIService', () => {
  let service: AIService
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    service = new AIService('/api/ai-test', '')
    fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.clearAllMocks()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('isConfigured', () => {
    it('should return false when neither VITE_AI_ENDPOINT nor VITE_AI_API_KEY is set', () => {
      // In test environment, these env vars are not set
      expect(service.isConfigured()).toBe(false)
    })
  })

  describe('generateBudgetInsights', () => {
    it('should return empty array when summary.isEmpty is true', async () => {
      const emptySummary = makeProjectFinancials({ isEmpty: true })
      const result = await service.generateBudgetInsights('proj-1', emptySummary, [], 'Test')
      expect(result).toEqual([])
    })

    it('should return empty array when no divisions are over budget', async () => {
      const summary = makeProjectFinancials()
      const healthyDivision = makeDivisionFinancials({ variancePercent: 0 })
      const result = await service.generateBudgetInsights('proj-1', summary, [healthyDivision], 'Test')
      expect(result).toEqual([])
    })

    it('should return empty array when all variances are within 5%', async () => {
      const summary = makeProjectFinancials()
      const slightlyOver = makeDivisionFinancials({ variancePercent: -4.9 })
      const result = await service.generateBudgetInsights('proj-1', summary, [slightlyOver], 'Test')
      expect(result).toEqual([])
    })

    it('should return warning insight for division at -7% variance', async () => {
      const summary = makeProjectFinancials()
      const overDivision = makeDivisionFinancials({
        divisionName: 'Site Work',
        divisionCode: '02',
        variancePercent: -7,
        revisedBudget: 4_200_000,
        projectedFinalCost: 4_494_000,
      })
      const result = await service.generateBudgetInsights('proj-1', summary, [overDivision], 'Test')
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('warning')
      expect(result[0].type).toBe('budget_risk')
      expect(result[0].title).toContain('Site Work')
    })

    it('should return critical insight for division at -18% variance', async () => {
      const summary = makeProjectFinancials()
      const criticalDivision = makeDivisionFinancials({
        divisionName: 'Concrete',
        divisionCode: '03',
        variancePercent: -18,
        revisedBudget: 8_500_000,
        projectedFinalCost: 10_030_000,
      })
      const result = await service.generateBudgetInsights('proj-1', summary, [criticalDivision], 'Test')
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('critical')
      expect(result[0].title).toContain('Cost Overrun Risk')
    })

    it('should sort results by variance (most negative first)', async () => {
      const summary = makeProjectFinancials()
      const divA = makeDivisionFinancials({ divisionName: 'DivA', variancePercent: -7 })
      const divB = makeDivisionFinancials({ divisionName: 'DivB', variancePercent: -20 })
      const result = await service.generateBudgetInsights('proj-1', summary, [divA, divB], 'Test')
      expect(result).toHaveLength(2)
      expect(result[0].title).toContain('DivB') // most negative first
    })

    it('should include affected entity reference', async () => {
      const summary = makeProjectFinancials()
      const overDivision = makeDivisionFinancials({
        divisionName: 'Mechanical',
        divisionCode: '23',
        variancePercent: -10,
        revisedBudget: 3_000_000,
        projectedFinalCost: 3_300_000,
      })
      const result = await service.generateBudgetInsights('proj-1', summary, [overDivision], 'Test')
      expect(result[0].affectedEntities).toHaveLength(1)
      expect(result[0].affectedEntities[0].name).toBe('Mechanical')
    })

    it('should set confidence to 1 (deterministic)', async () => {
      const summary = makeProjectFinancials()
      const overDivision = makeDivisionFinancials({ variancePercent: -8 })
      const result = await service.generateBudgetInsights('proj-1', summary, [overDivision], 'Test')
      expect(result[0].confidence).toBe(1)
    })

    it('should set dismissed to false', async () => {
      const summary = makeProjectFinancials()
      const overDivision = makeDivisionFinancials({ variancePercent: -8 })
      const result = await service.generateBudgetInsights('proj-1', summary, [overDivision], 'Test')
      expect(result[0].dismissed).toBe(false)
    })

    it('should set source to budget-anomaly-detector', async () => {
      const summary = makeProjectFinancials()
      const overDivision = makeDivisionFinancials({ variancePercent: -8 })
      const result = await service.generateBudgetInsights('proj-1', summary, [overDivision], 'Test')
      expect(result[0].source).toBe('budget-anomaly-detector')
    })
  })

  describe('tagDocumentOnUpload (not configured fallback)', () => {
    it('should tag architectural files', async () => {
      const tags = await service.tagDocumentOnUpload('file-1', 'floor_plan_level1.pdf', '')
      expect(tags).toContain('Architectural')
      expect(tags).toContain('PDF')
    })

    it('should tag structural drawings', async () => {
      const tags = await service.tagDocumentOnUpload('file-2', 'structural_steel_s-101.pdf', '')
      expect(tags).toContain('Structural')
    })

    it('should tag mechanical files', async () => {
      const tags = await service.tagDocumentOnUpload('file-3', 'hvac_duct_layout_m-201.pdf', '')
      expect(tags).toContain('Mechanical')
    })

    it('should tag electrical files', async () => {
      const tags = await service.tagDocumentOnUpload('file-4', 'electrical_panel_e-101.pdf', '')
      expect(tags).toContain('Electrical')
    })

    it('should tag plumbing files', async () => {
      const tags = await service.tagDocumentOnUpload('file-5', 'plumbing_drain_p-101.pdf', '')
      expect(tags).toContain('Plumbing')
    })

    it('should tag fire protection files', async () => {
      const tags = await service.tagDocumentOnUpload('file-6', 'fire_sprinkler_fp-101.pdf', '')
      expect(tags).toContain('Fire Protection')
    })

    it('should tag civil site drawings', async () => {
      const tags = await service.tagDocumentOnUpload('file-7', 'civil_site_grading_c-101.pdf', '')
      expect(tags).toContain('Civil')
    })

    it('should tag revised documents', async () => {
      // Regex requires \b before "rev" — use a space or start-of-word boundary
      const tags = await service.tagDocumentOnUpload('file-8', 'arch rev2 drawings.pdf', '')
      expect(tags).toContain('Revised')
    })

    it('should tag RFI documents', async () => {
      const tags = await service.tagDocumentOnUpload('file-9', 'rfi_007_response.pdf', '')
      expect(tags).toContain('RFI')
    })

    it('should tag shop drawings', async () => {
      const tags = await service.tagDocumentOnUpload('file-10', 'submittal_shop_drawing_steel.pdf', '')
      expect(tags).toContain('Shop Drawing')
    })

    it('should tag CAD files', async () => {
      const tags = await service.tagDocumentOnUpload('file-11', 'floor_plan.dwg', '')
      expect(tags).toContain('CAD')
    })

    it('should tag unclassified files when no keywords match', async () => {
      // .txt extension and no construction keywords → Unclassified (no PDF tag either)
      const tags = await service.tagDocumentOnUpload('file-12', 'meeting_notes.txt', '')
      expect(tags).toContain('Unclassified')
    })

    it('should return at most 5 tags', async () => {
      // File with many keywords
      const tags = await service.tagDocumentOnUpload('file-13', 'arch_struct_mech_elec_plumb_fire.pdf', '')
      expect(tags.length).toBeLessThanOrEqual(5)
    })

    it('should not include both Unclassified and other tags', async () => {
      const tags = await service.tagDocumentOnUpload('file-14', 'architectural_drawings.pdf', '')
      expect(tags).not.toContain('Unclassified')
    })
  })

  describe('analyzeDrawingSheet (not configured fallback)', () => {
    it('should return a DrawingAnalysis object', async () => {
      const result = await service.analyzeDrawingSheet('1', '')
      expect(result).toBeDefined()
      expect(result.sheetType).toBeTruthy()
      expect(typeof result.drawingNumber).toBe('string')
      expect(typeof result.revision).toBe('string')
      expect(Array.isArray(result.conflicts)).toBe(true)
    })

    it('should return one of the valid sheet types', async () => {
      const validTypes = ['architectural', 'structural', 'mep', 'civil', 'other']
      const result = await service.analyzeDrawingSheet('42', '')
      expect(validTypes).toContain(result.sheetType)
    })

    it('should be deterministic for the same drawingId', async () => {
      const result1 = await service.analyzeDrawingSheet('99', '')
      const result2 = await service.analyzeDrawingSheet('99', '')
      expect(result1.sheetType).toBe(result2.sheetType)
      expect(result1.drawingNumber).toBe(result2.drawingNumber)
      expect(result1.revision).toBe(result2.revision)
      expect(result1.conflicts.length).toBe(result2.conflicts.length)
    })

    it('should vary results for different drawingIds', async () => {
      const results = await Promise.all(
        ['1', '2', '3', '4', '5'].map((id) => service.analyzeDrawingSheet(id, ''))
      )
      const sheetTypes = results.map((r) => r.sheetType)
      // Should not all be the same type with 5 different IDs
      const uniqueTypes = new Set(sheetTypes)
      expect(uniqueTypes.size).toBeGreaterThan(1)
    })

    it('should include conflict description and location for each conflict', async () => {
      // Try a few IDs until we find one with conflicts
      for (let i = 0; i < 10; i++) {
        const result = await service.analyzeDrawingSheet(String(i * 3 + 1), '')
        if (result.conflicts.length > 0) {
          const conflict = result.conflicts[0]
          expect(typeof conflict.description).toBe('string')
          expect(typeof conflict.location).toBe('string')
          expect(Array.isArray(conflict.disciplines)).toBe(true)
          expect(conflict.disciplines).toHaveLength(2)
          expect(conflict.confidence).toBeGreaterThan(0)
          break
        }
      }
    })
  })

  describe('chat error handling', () => {
    it('should throw rate limit error on 429 response', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Rate limited', { status: 429 }),
      )
      const messages: AIMessage[] = [makeAIMessage()]
      // Provide projectData so getCachedProjectContext is not called
      const context = makeContext({
        projectData: {
          projectName: 'Test', contractValue: 0, phase: null,
          openRfiCount: 0, overdueRfiCount: 0, budgetVarianceByDivision: [],
          scheduleVarianceDays: null, criticalPathActivities: [],
          recentDailyLogSummaries: [], activeBallInCourtSubmittals: [],
          pendingChangeOrderExposure: 0,
        },
      })
      await expect(service.chat(messages, context)).rejects.toThrow('Daily AI usage limit reached')
    })

    it('should throw auth error on 401 response', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Unauthorized', { status: 401 }),
      )
      const messages: AIMessage[] = [makeAIMessage()]
      const context = makeContext({
        projectData: {
          projectName: 'Test', contractValue: 0, phase: null,
          openRfiCount: 0, overdueRfiCount: 0, budgetVarianceByDivision: [],
          scheduleVarianceDays: null, criticalPathActivities: [],
          recentDailyLogSummaries: [], activeBallInCourtSubmittals: [],
          pendingChangeOrderExposure: 0,
        },
      })
      await expect(service.chat(messages, context)).rejects.toThrow('authentication failed')
    })

    it('should throw generic error on other non-ok status', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Server Error', { status: 503 }),
      )
      const messages: AIMessage[] = [makeAIMessage()]
      const context = makeContext({
        projectData: {
          projectName: 'Test', contractValue: 0, phase: null,
          openRfiCount: 0, overdueRfiCount: 0, budgetVarianceByDivision: [],
          scheduleVarianceDays: null, criticalPathActivities: [],
          recentDailyLogSummaries: [], activeBallInCourtSubmittals: [],
          pendingChangeOrderExposure: 0,
        },
      })
      await expect(service.chat(messages, context)).rejects.toThrow('503')
    })

    it('should return the parsed response on success', async () => {
      const mockResponse: AIMessage = {
        id: 'resp-1',
        role: 'assistant',
        content: 'Project is on track',
        timestamp: new Date().toISOString(),
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const messages: AIMessage[] = [makeAIMessage()]
      const context = makeContext({
        projectData: {
          projectName: 'Test', contractValue: 0, phase: null,
          openRfiCount: 0, overdueRfiCount: 0, budgetVarianceByDivision: [],
          scheduleVarianceDays: null, criticalPathActivities: [],
          recentDailyLogSummaries: [], activeBallInCourtSubmittals: [],
          pendingChangeOrderExposure: 0,
        },
      })
      const result = await service.chat(messages, context)
      expect((result as AIMessage).content).toBe('Project is on track')
    })

    it('should throw when response contains an error field', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Model overloaded' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const messages: AIMessage[] = [makeAIMessage()]
      const context = makeContext({
        projectData: {
          projectName: 'Test', contractValue: 0, phase: null,
          openRfiCount: 0, overdueRfiCount: 0, budgetVarianceByDivision: [],
          scheduleVarianceDays: null, criticalPathActivities: [],
          recentDailyLogSummaries: [], activeBallInCourtSubmittals: [],
          pendingChangeOrderExposure: 0,
        },
      })
      await expect(service.chat(messages, context)).rejects.toThrow('Model overloaded')
    })
  })

  describe('generateInsights', () => {
    it('should throw on non-ok response', async () => {
      fetchSpy.mockResolvedValue(new Response('Error', { status: 500 }))
      await expect(service.generateInsights('proj-1')).rejects.toThrow('Failed to generate insights: 500')
    })

    it('should return insights array on success', async () => {
      const mockInsights = [
        { id: '1', type: 'schedule_risk', severity: 'warning', title: 'Delay risk' },
      ]
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ insights: mockInsights }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const result = await service.generateInsights('proj-1')
      expect(result).toEqual(mockInsights)
    })
  })

  describe('streamChat SSE parsing', () => {
    it('should accumulate chunks into final message content', async () => {
      const sseChunks = [
        'data: {"delta":{"content":"Project "}}\n',
        'data: {"delta":{"content":"is on track"}}\n',
        'data: [DONE]\n',
      ]

      // Build a readable stream that emits SSE lines
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of sseChunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })

      fetchSpy.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )

      const messages: AIMessage[] = [makeAIMessage()]
      const context = makeContext({
        projectData: {
          projectName: 'Test', contractValue: 0, phase: null,
          openRfiCount: 0, overdueRfiCount: 0, budgetVarianceByDivision: [],
          scheduleVarianceDays: null, criticalPathActivities: [],
          recentDailyLogSummaries: [], activeBallInCourtSubmittals: [],
          pendingChangeOrderExposure: 0,
        },
      })
      const chunks: string[] = []
      const result = await service.streamChat(messages, context, (chunk) => chunks.push(chunk))
      expect(result.content).toBe('Project is on track')
      expect(result.role).toBe('assistant')
      expect(chunks).toEqual(['Project ', 'is on track'])
    })

    it('should handle content field in SSE payload (alternative format)', async () => {
      const sseChunks = ['data: {"content":"Budget is healthy"}\n', 'data: [DONE]\n']
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of sseChunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })

      fetchSpy.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )

      const messages: AIMessage[] = [makeAIMessage()]
      const context = makeContext({
        projectData: {
          projectName: 'Test', contractValue: 0, phase: null,
          openRfiCount: 0, overdueRfiCount: 0, budgetVarianceByDivision: [],
          scheduleVarianceDays: null, criticalPathActivities: [],
          recentDailyLogSummaries: [], activeBallInCourtSubmittals: [],
          pendingChangeOrderExposure: 0,
        },
      })
      const result = await service.streamChat(messages, context, () => {})
      expect(result.content).toBe('Budget is healthy')
    })

    it('should return a message with assistant role after streaming', async () => {
      const sseChunk = 'data: {"delta":{"content":"Done"}}\n'
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseChunk))
          controller.close()
        },
      })
      fetchSpy.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
      const messages: AIMessage[] = [makeAIMessage()]
      const context = makeContext({
        projectData: {
          projectName: 'Test', contractValue: 0, phase: null,
          openRfiCount: 0, overdueRfiCount: 0, budgetVarianceByDivision: [],
          scheduleVarianceDays: null, criticalPathActivities: [],
          recentDailyLogSummaries: [], activeBallInCourtSubmittals: [],
          pendingChangeOrderExposure: 0,
        },
      })
      const result = await service.streamChat(messages, context, () => {})
      expect(result.role).toBe('assistant')
      expect(typeof result.id).toBe('string')
      expect(typeof result.timestamp).toBe('string')
    })
  })
})
