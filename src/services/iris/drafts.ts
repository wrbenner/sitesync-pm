// ─────────────────────────────────────────────────────────────────────────────
// Iris draft generation
// ─────────────────────────────────────────────────────────────────────────────
// Generates the actual draft text for a stream item by calling the canonical
// `iris-call` edge function (src/lib/ai/callIris.ts). The edge function holds
// the Anthropic key server-side, hash-chains the call into audit_log, and
// streams the response back over SSE.
//
// Why no @ai-sdk/anthropic import: the prior Wave-1 implementation called the
// Anthropic SDK directly from the browser with a VITE_ANTHROPIC_API_KEY. That
// pattern exposed the key in the browser bundle and bypassed the audit chain
// — both incompatible with the deposition-grade architecture. All AI now
// flows through one server entry point.
// ─────────────────────────────────────────────────────────────────────────────

import { callIris } from '../../lib/ai/callIris'
import type { StreamItem } from '../../types/stream'
import { DRAFT_TEMPLATES } from './templates'
import type { IrisDraft, ProjectContextSnapshot } from './types'

// Allow tests to inject a stub callIris without importing the real SSE stack.
// Default is the real client.
type CallIrisFn = typeof callIris

export interface GenerateDraftOptions {
  /** Override the iris-call client (used in tests). */
  callIris?: CallIrisFn
  /** Streaming callback — fires for every text delta from the provider. */
  onDelta?: (text: string) => void
  /** AbortSignal to cancel an in-flight draft. */
  signal?: AbortSignal
}

// Map a StreamItem id like "rfi-uuid" to the entity_type / entity_id pair
// that audit_log expects. The prefix is the type, the rest is the id.
// Falls back to ('iris_draft', item.id) when the id is opaque.
function entityRefFromItemId(itemId: string): { entityType: string; entityId: string } {
  const dashIdx = itemId.indexOf('-')
  if (dashIdx <= 0) return { entityType: 'iris_draft', entityId: itemId }
  const prefix = itemId.slice(0, dashIdx)
  const rest = itemId.slice(dashIdx + 1)
  // Sanity check: only treat as an entity ref if the suffix looks UUID-ish.
  // Otherwise the audit_log column (which is uuid) would reject it.
  const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rest)
  if (!looksUuid) return { entityType: 'iris_draft', entityId: itemId }
  return { entityType: prefix, entityId: rest }
}

export async function generateIrisDraft(
  item: StreamItem,
  projectContext: ProjectContextSnapshot,
  options: GenerateDraftOptions = {},
): Promise<IrisDraft> {
  const draftType = item.irisEnhancement?.draftType
  if (!draftType) {
    throw new Error(`StreamItem ${item.id} has no irisEnhancement.draftType — cannot generate a draft.`)
  }

  const template = DRAFT_TEMPLATES[draftType]
  if (!template) {
    throw new Error(`No template registered for draft type: ${draftType}`)
  }

  const prompt = template.buildPrompt(item, projectContext)
  const sources = template.getSources(item, projectContext)
  const callFn = options.callIris ?? callIris

  // Use the StreamItem id as the idempotency key so the same item generates
  // exactly one server-side call within the cache window — even if React
  // re-renders the drawer or the user toggles it open/close.
  const idempotencyKey = `iris-draft:${item.id}`

  const { entityType, entityId } = entityRefFromItemId(item.id)

  const result = await callFn(
    {
      task: 'reasoning',
      prompt,
      // The drafts task carries no separate system prompt today — the
      // role/preamble is baked into template.buildPrompt(). Kept here as a
      // single place to add per-draft guardrails (e.g. "do not invent
      // monetary figures") if they become needed.
      projectId: projectContext.projectId ?? undefined,
      entityType,
      entityId,
      maxTokens: 500,
      temperature: 0.3,
      idempotencyKey,
      signal: options.signal,
    },
    {
      onDelta: options.onDelta,
    },
  )

  return {
    id: item.id,
    type: draftType,
    content: result.content.trim(),
    sources,
    status: 'pending',
    generatedAt: new Date().toISOString(),
    confidence: template.confidence,
  }
}
