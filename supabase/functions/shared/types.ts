// ── Shared Edge-Function Types ───────────────────────────────────────────
// Common Request/Response/Row shapes used by multiple edge functions.
// Tables that aren't yet in the generated `database.ts` types (or that vary
// across pre-prod schemas) are typed inline at the call site as `Row`
// interfaces and cast through `unknown` — never through `any`.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Lax SupabaseClient ───────────────────────────────────────────────────
// When `createClient(url, key)` is called without a `Database` generic, the
// returned client accepts any table name. We re-export that shape here so
// edge functions can declare `LaxClient` instead of `any`.
export type LaxClient = SupabaseClient

// ── Generic helpers ──────────────────────────────────────────────────────

/**
 * Cast a single Supabase result row through `unknown` to a known shape.
 * Use at the boundary between the untyped query response and typed code.
 */
export function asRow<T>(value: unknown): T | null {
  return (value as T | null) ?? null
}

/**
 * Cast a Supabase result array through `unknown`. Returns `[]` when the
 * input is null/undefined — matches the common `(rows ?? [])` idiom.
 */
export function asRows<T>(value: unknown): T[] {
  return (value as T[] | null | undefined) ?? []
}

/**
 * Narrow an unknown JSON-ish value to a record. Returns `null` for
 * non-objects (including arrays and primitives).
 */
export function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

// ── Common minimal row shapes ────────────────────────────────────────────

export interface ProjectRow {
  id: string
  name?: string | null
  timezone?: string | null
  organization_id?: string | null
}

export interface ProjectMemberRow {
  user_id: string
  project_id: string
  role: string
}

export interface DraftedActionRow {
  id: string
  status: string
  action_type?: string
  project_id?: string
  payload?: unknown
}

// ── Anthropic / Claude response shape (used by ai-chat, draft-* etc.) ────

export interface AnthropicMessageContentBlock {
  type: string
  text?: string
}

export interface AnthropicMessageResponse {
  id?: string
  type?: string
  role?: string
  model?: string
  content?: AnthropicMessageContentBlock[]
  stop_reason?: string | null
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

// ── JSON helpers ─────────────────────────────────────────────────────────

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }
