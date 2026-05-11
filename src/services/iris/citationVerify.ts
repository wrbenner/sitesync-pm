/**
 * Citation snippet verification — fake-snippet auto-reject backbone.
 *
 * `verifyCitationSnippet` returns true iff the citation's `snippet`
 * substring-matches the source text the citation claims to come from.
 * The substring match is normalized (lowercase, collapsed whitespace,
 * stripped edge punctuation) and tolerant of long-quote drift via a
 * head-and-tail bookend match for snippets > 80 chars.
 *
 * Reference: docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md § Phase 4
 *
 * Pure functions live in this file; the data fetcher
 * (`fetchSourceText`) hits Supabase from `draftAction.ts`.
 */

import type { DraftedActionCitation } from '../../types/draftedActions'

/**
 * Normalize text for substring matching:
 *   * lowercase
 *   * collapse all whitespace runs to single space
 *   * strip leading/trailing non-word characters
 *
 * Pure; safe to test against fixtures.
 */
export function normalizeForVerify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\w]+|[^\w]+$/g, '')
}

/**
 * Verify a snippet appears in `sourceText`. Returns true when:
 *   * the citation has no snippet (label-only citations always pass)
 *   * the snippet is shorter than 8 chars (too short to verify meaningfully)
 *   * the normalized snippet is a substring of the normalized source
 *   * for snippets > 80 chars: head-and-tail bookend match (model
 *     paraphrase in the middle is tolerated, bookends are not)
 *
 * Returns false otherwise.
 */
export function verifySnippetAgainstSource(
  snippet: string | undefined | null,
  sourceText: string | null,
): boolean {
  if (!snippet) return true
  if (sourceText === null) return false

  const haystack = normalizeForVerify(sourceText)
  const needle = normalizeForVerify(snippet)

  if (needle.length < 8) return true
  if (haystack.includes(needle)) return true

  if (needle.length > 80) {
    const head = needle.slice(0, 60)
    const tail = needle.slice(-20)
    if (haystack.includes(head) && haystack.includes(tail)) return true
  }

  return false
}

/**
 * Per-citation-kind hint for what source text the verifier should
 * fetch when verifying. Used by the data-loader in draftAction.ts.
 *
 * Kinds without meaningful source text (pure structural references —
 * budget_line, schedule_phase, drawing_coordinate, photo_observation)
 * return null; verification of those passes by default.
 */
export function sourceFetchKindFor(citation: DraftedActionCitation): SourceFetchKind | null {
  switch (citation.kind) {
    case 'rfi_reference':
      return 'rfi_text'
    case 'daily_log_excerpt':
      return 'daily_log_notes'
    case 'change_order':
      return 'change_order_text'
    case 'spec_reference':
      return 'spec_section_text'
    case 'budget_line':
    case 'schedule_phase':
    case 'drawing_coordinate':
    case 'photo_observation':
      return null
    // Phase 3d citation kinds — structural references that don't carry
    // verifiable snippet text on the citation itself (the verifier would
    // need to fetch the cited chunk from iris_kb_chunks). For now they
    // pass verification by default.
    case 'spreadsheet_cell':
    case 'contract_clause':
    case 'punch_item':
      return null
  }
}

export type SourceFetchKind =
  | 'rfi_text'
  | 'daily_log_notes'
  | 'change_order_text'
  | 'spec_section_text'

export interface VerificationFailure {
  index: number
  kind: DraftedActionCitation['kind']
  ref?: string
  reason: 'snippet_mismatch' | 'source_not_found'
}

export interface VerificationResult {
  ok: boolean
  failures: VerificationFailure[]
}

/**
 * Verify a list of citations against their source texts. The fetcher
 * is dependency-injected so this function stays pure for testing.
 *
 * Behavior:
 *   * Citations with no snippet → pass.
 *   * Citations whose `sourceFetchKindFor` returns null → pass.
 *   * Citations whose `ref` is missing → pass (label-only,
 *     non-resolvable; the no-citations check is a separate gate).
 *   * Citations whose source text is null (entity not found) → fail
 *     with `source_not_found`.
 *   * Citations whose snippet doesn't substring-match → fail with
 *     `snippet_mismatch`.
 */
export async function verifyAllCitationSnippets(
  citations: DraftedActionCitation[],
  fetchSource: (
    kind: SourceFetchKind,
    ref: string,
  ) => Promise<string | null>,
): Promise<VerificationResult> {
  const failures: VerificationFailure[] = []
  for (let i = 0; i < citations.length; i++) {
    const c = citations[i]
    if (!c.snippet) continue
    const fetchKind = sourceFetchKindFor(c)
    if (fetchKind === null) continue
    if (!c.ref) continue

    const source = await fetchSource(fetchKind, c.ref)
    if (source === null) {
      failures.push({ index: i, kind: c.kind, ref: c.ref, reason: 'source_not_found' })
      continue
    }
    if (!verifySnippetAgainstSource(c.snippet, source)) {
      failures.push({ index: i, kind: c.kind, ref: c.ref, reason: 'snippet_mismatch' })
    }
  }
  return { ok: failures.length === 0, failures }
}
