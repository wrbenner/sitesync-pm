// =============================================================================
// promptBuilder — RFI Q&A → model prompt
// =============================================================================
// Builds the messages we send to the model. Two important properties:
//
// 1. The model never produces money. It returns line items
//    (description + quantity + unit + optional CSI). Cost lookups happen
//    in our code against cost_database. This makes hallucinated dollars
//    structurally impossible.
//
// 2. Few-shot examples come from `PATTERNS` so the prompt and the
//    classification anchors stay in lockstep. Adding a new pattern in
//    scopeChangePatterns.ts automatically improves the prompt — no
//    duplicate examples to maintain.
// =============================================================================

import { PATTERNS } from '../shared/coAutoDraft/scopeChangePatterns.ts'
import type { ScopeChangeKind } from '../shared/coAutoDraft/types.ts'

export interface PromptInputs {
  rfiTitle: string
  rfiDescription: string
  rfiDrawingReference: string | null
  /** Most recent first. The prompt anchors on the LAST reply for the
   *  scope-change verdict — long threads where the change happens late
   *  shouldn't be missed. */
  thread: Array<{ author: string; content: string; createdAt: string }>
}

export interface PromptOutput {
  system: string
  user: string
}

const SYSTEM = `You are an experienced construction project manager evaluating
whether an architect's RFI response constitutes a scope change. Your job is
to draft a Change Order *only* when the answer materially changes scope, and
to refuse to draft one when the answer simply confirms the existing design.

Hard rules:

1. NEVER return a dollar amount. You return quantities and units; cost
   lookups are computed elsewhere.

2. The "scope_change" verdict must be supported by an explicit signal in the
   architect's response — a substituted material, a quantity change, a new
   element added to scope, a relocation that adds labor, or a detail swap
   with materially different cost. If the answer says "proceed as drawn" or
   confirms the existing detail, return scope_change=false.

3. Anchor your verdict on the MOST RECENT message in the thread. Long RFI
   threads often resolve in the last reply.

4. Confidence must be "high" only when both the change and the line items
   are explicitly stated. Otherwise "medium". If the change is hinted but
   not specified, "low".

Return JSON only. No prose.`

const SCHEMA = `{
  "scope_change": boolean,
  "kind": "material_substitution" | "quantity_change" | "new_scope_element" | "sequence_change" | "detail_change" | "no_change",
  "reasoning": string,                // 1-2 sentences, plain language
  "confidence": "high" | "medium" | "low",
  "title": string,                    // CO title, e.g. "Upgrade exterior insulation to 1-inch rigid"
  "narrative": string,                // 2-3 sentences explaining what changed and why
  "schedule_impact_likely": boolean,
  "line_items": [
    {
      "description": string,          // e.g. "1-inch rigid insulation"
      "quantity": number | null,      // numeric only — null if not stated
      "unit": string | null,          // "sf", "lf", "ea", "hr"
      "csi_code": string | null       // optional CSI section, e.g. "07 21 13"
    }
  ]
}

If scope_change=false, set line_items=[], title="", narrative="" and confidence="high".`

function fewShotBlock(): string {
  return PATTERNS.map((p, i) => `Example ${i + 1} — ${p.label}
Q: ${p.fewShot.question}
A: ${p.fewShot.answer}
→ ${JSON.stringify({
    scope_change: p.fewShot.output.scope_change,
    kind: p.fewShot.output.kind,
    reasoning: p.fewShot.output.reasoning,
  })}`).join('\n\n')
}

export function buildPrompt(inputs: PromptInputs): PromptOutput {
  const sortedNewestLast = [...inputs.thread].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const threadText = sortedNewestLast
    .map(m => `[${m.createdAt}] ${m.author}:\n${m.content}`)
    .join('\n\n---\n\n')

  const user = `RFI: ${inputs.rfiTitle}

Original question:
${inputs.rfiDescription}

${inputs.rfiDrawingReference ? `Drawing reference: ${inputs.rfiDrawingReference}\n\n` : ''}Thread (oldest first; the last entry is the architect's most recent answer):

${threadText}

---

Reference patterns (few-shot):

${fewShotBlock()}

---

Return JSON matching this schema:

${SCHEMA}`

  return { system: SYSTEM, user }
}

export function isAllowedKind(kind: unknown): kind is ScopeChangeKind {
  return typeof kind === 'string' && [
    'material_substitution', 'quantity_change', 'new_scope_element',
    'sequence_change', 'detail_change', 'no_change',
  ].includes(kind)
}
