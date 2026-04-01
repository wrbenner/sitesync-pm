import type { AIMessage, AIContext, AIInsight, DrawingAnalysis } from '../types/ai'
import type { ProjectFinancials, DivisionFinancials } from '../types/financial'
import { detectBudgetAnomalies } from './financialEngine'
import { buildBudgetInsightPrompt, CONSTRUCTION_SYSTEM_PROMPT } from './aiPrompts'
import { getCachedProjectContext } from '../hooks/useProjectCache'
import { getRfiById } from '../api/endpoints/rfis'

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

  private async buildSystemContent(projectId: string): Promise<string> {
    const projectContext = await getCachedProjectContext(projectId)
    if (projectContext) {
      return `${CONSTRUCTION_SYSTEM_PROMPT}\n\n${projectContext}`
    }
    return CONSTRUCTION_SYSTEM_PROMPT
  }

  private makeSystemMessage(content: string): AIMessage {
    return {
      id: `sys-${Date.now()}`,
      role: 'system',
      content,
      timestamp: new Date().toISOString(),
    }
  }

  async chat(
    messages: AIMessage[],
    context: AIContext,
    options: { stream?: boolean; tools?: string[] } = {}
  ): Promise<AIMessage | ReadableStream<string>> {
    const systemContent = await this.buildSystemContent(context.projectId)
    const enrichedMessages = [this.makeSystemMessage(systemContent), ...messages]

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
    const [systemContent, rfiDetails] = await Promise.all([
      this.buildSystemContent(context.projectId),
      context.projectId
        ? getRfiById(context.projectId, rfiId).catch(() => null)
        : Promise.resolve(null),
    ])

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
      body: JSON.stringify({ rfiId, context, rfiContext, systemPrompt: systemContent }),
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

    const anomalies = detectBudgetAnomalies(summary, divisions)
    if (anomalies.length === 0) return []

    const enrichedDescriptions = new Map<string, string>()

    if (this.isConfigured()) {
      try {
        const prompt = buildBudgetInsightPrompt(anomalies, projectName)
        const systemContent = await this.buildSystemContent(projectId)
        const response = await fetch(`${this.endpoint}/chat`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            messages: [this.makeSystemMessage(systemContent), { role: 'user', content: prompt }],
            context: { projectId, currentPage: 'budget' },
            tools: [],
            stream: false,
          }),
        })
        if (response.ok) {
          const data = await response.json() as { content?: string }
          const lines = (data.content || '').split('\n').filter(l => l.trim())
          anomalies.forEach((a, i) => {
            if (lines[i]) enrichedDescriptions.set(a.divisionName, lines[i].trim())
          })
        }
      } catch {
        // Fall through to deterministic insights
      }
    }

    return anomalies.map((a, i): AIInsight => ({
      id: `budget-anomaly-${projectId}-${i}`,
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

  isConfigured(): boolean {
    return Boolean(import.meta.env.VITE_AI_ENDPOINT || import.meta.env.VITE_AI_API_KEY)
  }
}

export const aiService = new AIService()
