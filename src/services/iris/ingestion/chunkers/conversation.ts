// ────────────────────────────────────────────────────────────────────────────
// Conversation chunker — Phase 3c
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Forwarded email threads + meeting transcripts. One chunk per message
// (sliding-window batched if messages are short). PII scrubber strips email
// signatures + phone numbers BEFORE the chunker runs; the chunker assumes
// its input is already scrubbed.

import {
  approxTokens,
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'
import { splitByTokenBudget } from './drawing'

export interface ConversationMessage {
  /** Index within the thread. */
  message_idx: number
  /** Display name only — emails already scrubbed by upstream scrubber. */
  author: string
  /** ISO timestamp. */
  sent_at: string
  text: string
}

export interface ConversationChunkerInput extends ChunkerCommonInput {
  thread_id: string
  subject?: string
  messages: readonly ConversationMessage[]
}

const BATCH_TARGET_TOKENS = 400

export function chunkConversation(input: ConversationChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0

  // Subject line as its own chunk if substantial (e.g. "RFI #142 follow-up").
  if (input.subject && input.subject.trim().length > 0) {
    const subjTokens = approxTokens(input.subject)
    if (subjTokens >= CHUNK_TOKEN_FLOOR) {
      out.push({
        ordinal: ordinal++,
        text: `Subject: ${input.subject.trim()}`,
        source_anchor: { kind: 'conversation', thread_id: input.thread_id },
        metadata: { thread_id: input.thread_id, kind: 'subject' },
        estimated_token_count: subjTokens,
      })
    }
  }

  // Pack short adjacent messages into batches so we don't index 50 one-line
  // chunks. Long messages stand alone (split if over ceiling).
  let batchText = ''
  let batchTokens = 0
  let batchStartIdx = -1
  let batchAuthors: string[] = []

  const flushBatch = () => {
    if (!batchText || batchTokens < CHUNK_TOKEN_FLOOR) return
    out.push({
      ordinal: ordinal++,
      text: batchText.trim(),
      source_anchor: {
        kind: 'conversation',
        thread_id: input.thread_id,
        message_idx: batchStartIdx,
      },
      metadata: {
        thread_id: input.thread_id,
        kind: 'message_batch',
        authors: Array.from(new Set(batchAuthors)),
      },
      estimated_token_count: batchTokens,
    })
    batchText = ''
    batchTokens = 0
    batchStartIdx = -1
    batchAuthors = []
  }

  for (const msg of input.messages) {
    const text = (msg.text ?? '').trim()
    if (!text) continue
    const tokens = approxTokens(text)
    const header = `[${msg.author} @ ${msg.sent_at}]\n`

    if (tokens >= BATCH_TARGET_TOKENS) {
      // Standalone — flush any pending batch first.
      flushBatch()
      const segments = splitByTokenBudget(text, CHUNK_TOKEN_CEILING)
      for (const seg of segments) {
        if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
        out.push({
          ordinal: ordinal++,
          text: header + seg.text,
          source_anchor: {
            kind: 'conversation',
            thread_id: input.thread_id,
            message_idx: msg.message_idx,
          },
          metadata: {
            thread_id: input.thread_id,
            kind: 'message',
            author: msg.author,
            sent_at: msg.sent_at,
          },
          estimated_token_count: seg.tokens + approxTokens(header),
        })
      }
    } else {
      if (batchStartIdx === -1) batchStartIdx = msg.message_idx
      const append = header + text + '\n\n'
      batchText += append
      batchTokens += approxTokens(append)
      batchAuthors.push(msg.author)
      if (batchTokens >= BATCH_TARGET_TOKENS) flushBatch()
    }
  }
  flushBatch()

  return out
}
