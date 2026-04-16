import type { AIMessage, AIContext, AIInsight, DrawingAnalysis } from '../types/ai'
import type { ProjectFinancials, DivisionFinancials } from '../types/financial'
import type { BudgetAnomaly } from './financialEngine'
import { buildBudgetInsightPrompt, buildProjectContext, CONSTRUCTION_SYSTEM_PROMPT } from './aiPrompts'
import { getCachedProjectContext } from '../hooks/useProjectCache'
import { getRfiById } from '../api/endpoints/rfis'
import { getSchedulePhases } from '../api/endpoints/schedule'
import { getWeatherForecast } from './weather'
import { predictScheduleDelays, type WeatherDay as PredictionWeatherDay } from './predictions'

const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || '/api/ai'
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY || ''

export class AIService {
  private endpoint: string
  private apiKey: string

  constructor(endpoint = AI_ENDPOINT, apiKey = AI_API_KEY) {
    this.endpoint = endpoint
    this.apiKey = apiKey
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`
    return h
  }

  private makeSystemMessage(content: string): AIMessage {
    return {
      id: `sys-${Date.now()}`,
      role: 'system',
      content,
      timestamp: new Date().toISOString(),
    }
  }

  private makeContextMessage(content: string): AIMessage {
    return {
      id: `ctx-${Date.now()}`,
      role: 'user',
      content: `PROJECT CONTEXT (use these numbers in your responses):\n${content}`,
      timestamp: new Date().toISOString(),
    }
  }

  private async buildEnrichedMessages(messages: AIMessage[], context: AIContext): Promise<AIMessage[]> {
    const systemMessage = this.makeSystemMessage(CONSTRUCTION_SYSTEM_PROMPT)

    // Prefer pre-fetched hook data; fall back to cached async fetch
    let contextText: string
    if (context.projectData) {
      contextText = buildProjectContext(context.projectData)
    } else {
      contextText = await getCachedProjectContext(context.projectId)
    }

    if (contextText) {
      const APPROX_CHARS_PER_TOKEN = 4
      const TOTAL_TOKEN_LIMIT = 4000
      const systemTokens = Math.ceil(CONSTRUCTION_SYSTEM_PROMPT.length / APPROX_CHARS_PER_TOKEN)
      const contextTokens = Math.ceil(contextText.length / APPROX_CHARS_PER_TOKEN)
      if (systemTokens + contextTokens > TOTAL_TOKEN_LIMIT) {
        if (import.meta.env.DEV) console.warn(`[aiService] Context budget exceeded: system ~${systemTokens} + context ~${contextTokens} tokens > ${TOTAL_TOKEN_LIMIT} limit`)
      }
      return [systemMessage, this.makeContextMessage(contextText), ...messages]
    }

    return [systemMessage, ...messages]
  }

  async chat(
    messages: AIMessage[],
    context: AIContext,
    options: { stream?: boolean; tools?: string[] } = {}
  ): Promise<AIMessage | ReadableStream<string>> {
    const enrichedMessages = await this.buildEnrichedMessages(messages, context)

    const response = await fetch(`${this.endpoint}/chat`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        messages: enrichedMessages,
        context,
        tools: options.tools || ['project_search', 'rfi_lookup', 'schedule_analysis', 'budget_query', 'weather_forecast'],
        stream: options.stream || false,
      }),
    })

    if (!response.ok) {
      const status = response.status
      if (status === 429) throw new Error('Daily AI usage limit reached. Please try again tomorrow.')
      if (status === 401) throw new Error('AI service authentication failed. Check your API key.')
      throw new Error(`AI service error: ${status}`)
    }

    if (options.stream && response.body) {
      return response.body.pipeThrough(new TextDecoderStream()) as unknown as ReadableStream<string>
    }

    const data = await response.json()
    if (data.error) throw new Error(data.error)
    return data as AIMessage
  }

  // Stream chat and invoke onChunk for each text chunk; resolves to the complete AIMessage
  async streamChat(
    messages: AIMessage[],
    context: AIContext,
    onChunk: (chunk: string) => void,
    options: { tools?: string[] } = {}
  ): Promise<AIMessage> {
    const stream = await this.chat(messages, context, { ...options, stream: true })

    if (!(stream instanceof ReadableStream)) {
      // Non-streaming fallback
      onChunk((stream as AIMessage).content)
      return stream as AIMessage
    }

    const reader = (stream as ReadableStream<string>).getReader()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // SSE format: lines beginning with "data: "
        const lines = value.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') continue
            try {
              const parsed = JSON.parse(payload)
              const chunk = parsed.delta?.content || parsed.content || ''
              if (chunk) {
                fullContent += chunk
                onChunk(chunk)
              }
            } catch {
              // Raw text chunk (non-JSON stream)
              fullContent += payload
              onChunk(payload)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: fullContent,
      timestamp: new Date().toISOString(),
    }
  }

  async generateInsights(projectId: string): Promise<AIInsight[]> {
    const response = await fetch(`${this.endpoint}/insights`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ projectId }),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate insights: ${response.status}`)
    }

    const data = await response.json()
    return data.insights as AIInsight[]
  }

  async draftRFIResponse(rfiId: string, context: AIContext): Promise<string> {
    const rfiDetails = context.projectId
      ? await getRfiById(context.projectId, rfiId).catch(() => null)
      : null

    const rfiContext = rfiDetails
      ? [
          rfiDetails.rfiNumber ? `RFI Number: ${rfiDetails.rfiNumber}` : null,
          rfiDetails.title ? `Title: ${rfiDetails.title}` : null,
          rfiDetails.drawing_reference ? `Drawing Reference: ${rfiDetails.drawing_reference}` : null,
          rfiDetails.spec_section ? `Specification Section: ${rfiDetails.spec_section}` : null,
          rfiDetails.description ? `Question: ${rfiDetails.description}` : null,
        ].filter(Boolean).join(' | ')
      : ''

    const response = await fetch(`${this.endpoint}/draft/rfi-response`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ rfiId, context, rfiContext, systemPrompt: CONSTRUCTION_SYSTEM_PROMPT }),
    })

    if (!response.ok) {
      throw new Error(`Failed to draft RFI response: ${response.status}`)
    }

    const data = await response.json()
    return data.draft
  }

  async summarizeDailyLog(logData: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${this.endpoint}/draft/daily-log-summary`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ logData }),
    })

    if (!response.ok) {
      throw new Error(`Failed to summarize daily log: ${response.status}`)
    }

    const data = await response.json()
    return data.summary
  }

  async generateBudgetInsights(
    projectId: string,
    summary: ProjectFinancials,
    divisions: DivisionFinancials[],
    projectName = 'Unknown Project'
  ): Promise<AIInsight[]> {
    if (summary.isEmpty) return []

    const fmtUsd = (n: number): string =>
      n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1_000).toLocaleString()}K`

    // Produce anomalies for variance < -5% (warning) or < -15% (critical)
    const flagged: BudgetAnomaly[] = divisions
      .filter(d => d.variancePercent < -5)
      .sort((a, b) => a.variancePercent - b.variancePercent)
      .map(d => {
        const severity: 'critical' | 'warning' = d.variancePercent < -15 ? 'critical' : 'warning'
        const overageAmt = d.projectedFinalCost - d.revisedBudget
        const csiCode = d.divisionCode || 'N/A'
        return {
          divisionName: d.divisionName,
          severity,
          message: `${d.divisionName} (CSI ${csiCode}) is projected to exceed budget by ${fmtUsd(overageAmt)} (${Math.abs(d.variancePercent).toFixed(1)}% over). Review scope and identify cost reduction options.`,
          variancePct: d.variancePercent,
        }
      })

    if (flagged.length === 0) return []

    const enrichedDescriptions = new Map<string, string>()

    if (this.isConfigured()) {
      try {
        const prompt = buildBudgetInsightPrompt(flagged, projectName)
        const enrichedMessages = await this.buildEnrichedMessages(
          [{ id: `budget-${Date.now()}`, role: 'user', content: prompt, timestamp: new Date().toISOString() }],
          { projectId, currentPage: 'budget' }
        )
        const response = await fetch(`${this.endpoint}/chat`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            messages: enrichedMessages,
            context: { projectId, currentPage: 'budget' },
            tools: [],
            stream: false,
          }),
        })
        if (response.ok) {
          const data = await response.json() as { content?: string }
          const lines = (data.content || '').split('\n').filter(l => l.trim())
          flagged.forEach((a, i) => {
            if (lines[i]) enrichedDescriptions.set(a.divisionName, lines[i].trim())
          })
        }
      } catch {
        // Fall through to deterministic insights
      }
    }

    return flagged.map((a, i): AIInsight => ({
      id: `budget-insight-${projectId}-${i}`,
      type: 'budget_risk',
      severity: a.severity,
      title: `${a.severity === 'critical' ? 'Cost Overrun Risk' : 'Budget Alert'}: ${a.divisionName}`,
      description: enrichedDescriptions.get(a.divisionName) || a.message,
      affectedEntities: [{ type: 'division', id: a.divisionName, name: a.divisionName }],
      suggestedAction:
        a.severity === 'critical'
          ? 'Review cost-to-complete estimate and identify value engineering opportunities.'
          : 'Monitor remaining work scope and flag any additions to the owner immediately.',
      confidence: 1,
      source: 'budget-anomaly-detector',
      createdAt: new Date().toISOString(),
      dismissed: false,
    }))
  }

  async analyzePhoto(base64Image: string): Promise<{ caption: string; tags: string[]; hazards: string[]; confidence: number }> {
    if (!this.isConfigured()) {
      return { caption: '', tags: [], hazards: [], confidence: 0 }
    }

    const response = await fetch(`${this.endpoint}/analyze-photo`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ image: base64Image }),
    })

    if (!response.ok) {
      if (response.status === 429) throw new Error('AI rate limit reached.')
      throw new Error(`Photo analysis failed: ${response.status}`)
    }

    const data = await response.json()
    return {
      caption: data.caption || '',
      tags: data.tags || [],
      hazards: data.hazards || [],
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    }
  }

  async analyzeDrawingSheet(drawingId: string, fileUrl: string): Promise<DrawingAnalysis> {
    if (!this.isConfigured()) {
      // Deterministic mock based on drawingId for prototype consistency
      const seed = parseInt(drawingId, 10) || drawingId.charCodeAt(0)
      const types = ['architectural', 'structural', 'mep', 'civil', 'other'] as const
      const sheetType = types[seed % types.length]
      const conflictLocations = ['Grid Line C4', 'Level 2 ceiling plenum', 'Mechanical room west wall', 'Stairwell 3 soffit', 'Roof drain area B7']
      const disciplinePairs: [string, string][] = [
        ['Structural', 'Mechanical'],
        ['Architectural', 'Plumbing'],
        ['Structural', 'Electrical'],
        ['Mechanical', 'Fire Protection'],
      ]
      const conflictCount = seed % 3
      return {
        sheetType,
        drawingNumber: `${sheetType[0].toUpperCase()}-${100 + (seed % 200)}`,
        revision: `Rev ${seed % 5}`,
        conflicts: Array.from({ length: conflictCount }, (_, i) => ({
          description: `${disciplinePairs[(seed + i) % disciplinePairs.length][0]} element intersects ${disciplinePairs[(seed + i) % disciplinePairs.length][1]} run`,
          location: conflictLocations[(seed + i) % conflictLocations.length],
          disciplines: disciplinePairs[(seed + i) % disciplinePairs.length],
          confidence: 0.7 + ((seed + i) % 3) * 0.1,
        })),
      }
    }

    const response = await fetch(`${this.endpoint}/analyze-drawing`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        drawingId,
        fileUrl,
        prompt: 'Identify: sheet type (architectural/structural/mep/civil/other), drawing number, revision, and coordination conflicts (overlapping elements between disciplines) with location references.',
      }),
    })

    if (!response.ok) {
      if (response.status === 429) throw new Error('AI rate limit reached.')
      throw new Error(`Drawing analysis failed: ${response.status}`)
    }

    return response.json() as Promise<DrawingAnalysis>
  }

  async tagDocumentOnUpload(fileId: string, fileName: string, fileUrl: string): Promise<string[]> {
    if (!this.isConfigured()) {
      // Derive tags from filename heuristics for prototype
      const lower = fileName.toLowerCase()
      const tags: string[] = []
      if (/\b(arch|architectural|floor|elevation|section|a-\d)/i.test(lower)) tags.push('Architectural')
      if (/\b(struct|structural|s-\d|beam|column|footing)/i.test(lower)) tags.push('Structural')
      if (/\b(mech|mechanical|hvac|duct|m-\d)/i.test(lower)) tags.push('Mechanical')
      if (/\b(elec|electrical|e-\d|panel|circuit)/i.test(lower)) tags.push('Electrical')
      if (/\b(plumb|plumbing|p-\d|drain|pipe)/i.test(lower)) tags.push('Plumbing')
      if (/\b(fire|sprinkler|fp-\d)/i.test(lower)) tags.push('Fire Protection')
      if (/\b(civil|site|grading|c-\d)/i.test(lower)) tags.push('Civil')
      if (/\b(rev\s*\d|revision)/i.test(lower)) tags.push('Revised')
      if (/\b(rfi|request.for.info)/i.test(lower)) tags.push('RFI')
      if (/\b(submittal|shop.draw)/i.test(lower)) tags.push('Shop Drawing')
      if (/\.(pdf)$/i.test(lower)) tags.push('PDF')
      if (/\.(dwg|dxf)$/i.test(lower)) tags.push('CAD')
      if (tags.length === 0) tags.push('Unclassified')
      return tags.slice(0, 5)
    }

    try {
      const response = await fetch(`${this.endpoint}/tag-document`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ fileId, fileName, fileUrl }),
      })
      if (!response.ok) return []
      const data = await response.json() as { tags?: string[] }
      return data.tags || []
    } catch {
      return []
    }
  }

  async generateScheduleDelayInsights(projectId: string): Promise<AIInsight[]> {
    const [phases, weatherDays] = await Promise.all([
      getSchedulePhases(projectId).catch(() => []),
      getWeatherForecast(projectId, 3).catch(() => [] as Awaited<ReturnType<typeof getWeatherForecast>>),
    ])

    // Map WeatherDay from weather.ts to the predictions.ts WeatherDay shape
    const forecast: PredictionWeatherDay[] = weatherDays.map(w => ({
      date: w.date,
      conditions: w.conditions,
      precipitationChance: w.precip_probability,
      tempHigh: w.temp_high,
      tempLow: w.temp_low,
    }))

    // Map ScheduleActivity to the predictions.ts ScheduleActivity shape
    const activities = phases.map(p => ({
      id: p.id,
      name: p.name,
      percent_complete: p.percent_complete,
      planned_percent_complete: p.planned_percent_complete,
      work_type: p.outdoor_activity ? ('outdoor' as const) : null,
      float_days: p.float_days,
      status: p.status,
      start_date: p.start_date,
      end_date: p.finish_date,
    }))

    const delays = predictScheduleDelays(projectId, activities, forecast)

    return delays.map((d, i): AIInsight => {
      const severity: AIInsight['severity'] = d.riskScore >= 0.7 ? 'critical' : d.riskScore >= 0.4 ? 'warning' : 'info'
      return {
        id: `schedule-delay-${projectId}-${i}`,
        type: 'schedule_risk',
        severity,
        title: `Schedule Risk: ${d.activityName}`,
        description: d.reasons.join('. '),
        affectedEntities: [{ type: 'schedule_phase', id: d.activityId, name: d.activityName }],
        suggestedAction: d.suggestedAction,
        confidence: d.riskScore,
        source: 'live',
        createdAt: new Date().toISOString(),
        dismissed: false,
      }
    })
  }

  isConfigured(): boolean {
    return Boolean(import.meta.env.VITE_AI_ENDPOINT || import.meta.env.VITE_AI_API_KEY)
  }
}

export const aiService = new AIService()
