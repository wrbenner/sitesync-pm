/**
 * evals/iris/providers/iris-call.ts
 *
 * Promptfoo custom provider that calls the deployed `iris-call` edge
 * function and returns the same shape `IrisCallDone` exposes — plus
 * citations parsed from the response (when the action_type emits them
 * in JSON). This lets the eval grade the same code path the production
 * UI uses, including server-side voice linting and audit logging.
 *
 * Promptfoo loads this via:
 *
 *   providers:
 *     - id: file://evals/iris/providers/iris-call.ts
 *
 * Required env (CI workflow injects these):
 *   STAGING_SUPABASE_URL          edge function endpoint host
 *   STAGING_SUPABASE_SERVICE_ROLE_KEY  service-role JWT
 *                                 (eval bypasses end-user RLS)
 *
 * Optional env:
 *   IRIS_EVAL_TASK                default 'reasoning' (one of
 *                                 reasoning|classification|code_lookup|summarization)
 *   IRIS_EVAL_MAX_TOKENS          default 600
 *   IRIS_EVAL_TEMPERATURE         default 0.3
 *
 * Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md § Provider
 */

import type { DraftedActionCitation } from '../../../src/types/draftedActions'
import type { EvalCorpusRow, IrisProviderOutput } from '../types'

interface PromptfooContext {
  vars?: Record<string, unknown>
  test?: { vars?: Record<string, unknown> }
}

interface PromptfooProviderResponse {
  output?: string | object
  error?: string
  metadata?: Record<string, unknown>
  /**
   * Promptfoo allows providers to attach arbitrary fields. The asserts
   * read `irisOutput` to access the structured IrisProviderOutput.
   */
  irisOutput?: IrisProviderOutput
}

const TASK = (process.env.IRIS_EVAL_TASK ?? 'reasoning') as
  | 'reasoning'
  | 'classification'
  | 'code_lookup'
  | 'summarization'
const MAX_TOKENS = Number(process.env.IRIS_EVAL_MAX_TOKENS ?? '600')
const TEMPERATURE = Number(process.env.IRIS_EVAL_TEMPERATURE ?? '0.3')

class IrisCallProvider {
  id(): string {
    return 'iris-call'
  }

  async callApi(
    prompt: string,
    context: PromptfooContext = {},
  ): Promise<PromptfooProviderResponse> {
    const supabaseUrl = process.env.STAGING_SUPABASE_URL ?? process.env.SUPABASE_URL
    const serviceKey =
      process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return {
        error:
          'iris-call provider needs STAGING_SUPABASE_URL + STAGING_SUPABASE_SERVICE_ROLE_KEY env vars',
      }
    }

    // The corpus row's metadata is forwarded via promptfoo `vars`. The
    // eval YAML wires `vars: { row: <corpus row JSON> }` on every test.
    const row = (context.test?.vars?.row ?? context.vars?.row) as EvalCorpusRow | undefined
    const actionType = row?.actionType
    const idempotencyKey = `iris-eval__${row?.id ?? 'unknown'}__${Date.now()}`

    const url = `${supabaseUrl}/functions/v1/iris-call`
    const requestBody: Record<string, unknown> = {
      task: TASK,
      prompt,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      idempotency_key: idempotencyKey,
    }
    if (row?.system) requestBody.system = row.system
    if (row?.projectId) requestBody.project_id = row.projectId
    if (row?.entityType) requestBody.entity_type = row.entityType
    if (row?.entityId) requestBody.entity_id = row.entityId
    if (actionType) requestBody.action_type = actionType

    const started = Date.now()
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
      })
    } catch (err) {
      return { error: `iris-call network error: ${(err as Error).message}` }
    }

    if (!response.ok || !response.body) {
      let detail = `iris-call returned ${response.status}`
      try {
        const json = await response.json()
        detail = (json as { error?: { message?: string } }).error?.message ?? detail
      } catch {
        // body wasn't JSON
      }
      return { error: detail }
    }

    let content = ''
    let provider = ''
    let model = ''
    let inputTokens = 0
    let outputTokens = 0
    let auditId = ''
    let latencyMs = 0
    let terminalError: string | null = null

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent: string | null = null
    let currentData = ''

    const consume = (event: string | null, data: string): void => {
      if (!data) return
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(data) as Record<string, unknown>
      } catch {
        return
      }
      switch (event) {
        case 'delta': {
          const text = parsed.text as string | undefined
          if (text) content += text
          return
        }
        case 'done': {
          content = (parsed.content as string) ?? content
          const usage = parsed.usage as { input_tokens?: number; output_tokens?: number } | undefined
          inputTokens = usage?.input_tokens ?? 0
          outputTokens = usage?.output_tokens ?? 0
          provider = (parsed.provider as string) ?? ''
          model = (parsed.model as string) ?? ''
          auditId = (parsed.audit_id as string) ?? ''
          latencyMs = (parsed.latency_ms as number) ?? Date.now() - started
          return
        }
        case 'error': {
          terminalError = (parsed.message as string) ?? 'iris-call error event'
          return
        }
      }
    }

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          if (currentData.length > 0) consume(currentEvent, currentData)
          break
        }
        buffer += decoder.decode(value, { stream: true })
        let newlineIdx: number
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const rawLine = buffer.slice(0, newlineIdx)
          buffer = buffer.slice(newlineIdx + 1)
          const line = rawLine.replace(/\r$/, '')
          if (line === '') {
            if (currentData.length > 0) consume(currentEvent, currentData)
            currentEvent = null
            currentData = ''
          } else if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const chunk = line.slice(5).trimStart()
            currentData = currentData.length > 0 ? `${currentData}\n${chunk}` : chunk
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (terminalError) return { error: terminalError }

    const citations = extractCitations(content)
    const irisOutput: IrisProviderOutput = {
      output: content,
      citations,
      meta: {
        inputTokens,
        outputTokens,
        latencyMs,
        provider,
        model,
        auditId,
      },
    }

    return {
      output: content,
      metadata: {
        provider,
        model,
        latencyMs,
        inputTokens,
        outputTokens,
        auditId,
        citationCount: citations.length,
      },
      irisOutput,
    }
  }
}

/**
 * Extract citations from the response content. The free-text drafts
 * embed citations as JSON-fenced markers like:
 *   ```citation
 *   {"kind":"rfi_reference","label":"RFI #4172","ref":"<uuid>"}
 *   ```
 * When no fenced citations are present, returns []. Hand-edit corpus
 * rows can populate citations directly via groundTruthOutput.
 */
function extractCitations(text: string): DraftedActionCitation[] {
  const out: DraftedActionCitation[] = []
  const fence = /```citation\s*\n([\s\S]*?)\n```/g
  let match: RegExpExecArray | null
  while ((match = fence.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as DraftedActionCitation
      if (parsed && typeof parsed.kind === 'string') out.push(parsed)
    } catch {
      // Ignore unparseable fences
    }
  }
  return out
}

// Promptfoo loads the default export.
export default IrisCallProvider
