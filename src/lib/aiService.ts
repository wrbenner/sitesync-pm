import type { AIMessage, AIContext, AIInsight } from '../types/ai'

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

  async chat(
    messages: AIMessage[],
    context: AIContext,
    options: { stream?: boolean; tools?: string[] } = {}
  ): Promise<AIMessage | ReadableStream<string>> {
    const response = await fetch(`${this.endpoint}/chat`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        messages,
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
    const response = await fetch(`${this.endpoint}/draft/rfi-response`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ rfiId, context }),
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

  isConfigured(): boolean {
    return Boolean(import.meta.env.VITE_AI_ENDPOINT || import.meta.env.VITE_AI_API_KEY)
  }
}

export const aiService = new AIService()
