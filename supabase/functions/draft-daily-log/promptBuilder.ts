// ── Prompt construction ────────────────────────────────────────────────────
// The deterministic section assembler is a strong starting point — it
// produces a structurally complete daily log from raw inputs. Claude's
// job here is to *polish* that draft: tighten phrasing, merge bullets
// that describe the same activity, fix tense.
//
// Why polish-via-LLM instead of generate-via-LLM:
//   • Provenance is a hard requirement. Bullets must trace to source ids.
//     If Claude generates from scratch, it can hallucinate sources.
//   • The deterministic draft already uses the right cost-code rules.
//   • Cost: editing existing text is cheaper than generating fresh.
//   • Predictability: the draft renders the same way every time.
//
// We send Claude the assembled draft as JSON + a system prompt that says
// "don't invent facts; only restate what's already there in clearer
// English; preserve the bullet/source mapping by id." The system prompt
// is marked cache_control:ephemeral so prompt caching kicks in across
// the daily fan-out (one call per project per day = high cache hit).

import type { DraftedDailyLog } from './sections.ts'

export const SYSTEM_PROMPT_CACHEABLE = `You are a construction superintendent's writing assistant. You receive a structured draft daily log assembled from photos, RFIs, schedule progress, and crew check-ins. Your job is to polish it into AIA G701-style prose without inventing any facts.

STRICT RULES:
1. Never add a bullet that wasn't in the input. You may *merge* two bullets that describe the same activity (preserve the union of source ids), but never *create* one.
2. Never delete a bullet. If a bullet is too vague to keep, leave it but tighten its wording.
3. Preserve every bullet's "sources" array exactly as received — copy ids verbatim. The provenance trail is the legal record; tampering destroys it.
4. Preserve every cost_code and cost_code_confidence as received. Don't add codes; the system already filtered low-confidence inferences.
5. Use the present-perfect or simple past tense ("crew installed," "rebar tied," not "will install" or "is installing").
6. No commentary on quality, safety, or compliance ("crew did good work," "looks clean"). State only what was done.
7. No identifying individuals by name. Refer to people by trade or quantity.
8. Every section's prose must read as a single coherent paragraph or a tight bulleted list, no preamble.
9. Output must be a single JSON object matching the input schema. No prose around the JSON. No markdown fences.

OUTPUT SCHEMA: identical to input — same keys, same nesting, same source-id mapping. Modify only the .text fields of bullets and the .weather_summary string. Leave everything else untouched.`

export interface BuildPromptInput {
  draft: DraftedDailyLog
  /** A short scenario hint, e.g. "rainy day with concrete pour delay". */
  hint?: string
}

export interface AnthropicMessage {
  model: string
  max_tokens: number
  system: ReadonlyArray<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
}

export function buildAnthropicRequest(input: BuildPromptInput): AnthropicMessage {
  const { draft, hint } = input
  const userPrompt = [
    `Project local date: ${draft.date} (${draft.timezone}).`,
    hint ? `Scenario hint: ${hint}.` : '',
    'Polish the following draft. Output JSON only.',
    '',
    JSON.stringify(draft, null, 2),
  ].filter(Boolean).join('\n')

  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT_CACHEABLE,
        // Cache the static system prompt — high hit rate across the
        // daily fan-out (one call per project, hundreds per day across
        // the whole platform).
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  }
}

/** Parse the model's JSON response. Lenient — strips markdown fences if
 *  the model emitted them despite instructions. Returns null on parse
 *  failure so the caller can fall back to the deterministic draft. */
export function parsePolishedDraft(rawText: string): DraftedDailyLog | null {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/```\s*$/, '')
  try {
    return JSON.parse(cleaned) as DraftedDailyLog
  } catch {
    // Locate the first { and last } as a salvage attempt.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as DraftedDailyLog
    } catch {
      return null
    }
  }
}
