// =============================================================================
// Scope-change pattern classifier
// =============================================================================
// Pure, deterministic. The model classifies the Q&A in the edge function;
// these patterns are *anchors* the prompt teaches via few-shot, AND they are
// the safety net the edge function uses to filter the model's output before
// drafting. If the model says "scope_change=true" but no pattern matches, we
// downgrade confidence and skip the auto-draft (PM still gets an inbox card,
// but no CO row). Conservative-by-default: a wrong CO is worse than no CO.
//
// The patterns are intentionally simple regex/keyword anchors — they exist
// to validate the model's call, not to do classification on their own. If
// you find yourself stacking edge cases here, the right move is to feed them
// into the prompt as new few-shot examples instead.
// =============================================================================

import type { ScopeChangeKind } from '../../types/coAutoDraft'

export interface ClassificationAnchor {
  kind: ScopeChangeKind
  /** Short label used in the few-shot examples and in the audit log. */
  label: string
  /** Regex that, if matched against the answer text, signals this kind. */
  signals: RegExp[]
  /** A few-shot example pair surfaced to the model as part of the prompt. */
  fewShot: { question: string; answer: string; output: { scope_change: boolean; kind: ScopeChangeKind; reasoning: string } }
}

export const PATTERNS: ClassificationAnchor[] = [
  {
    kind: 'material_substitution',
    label: 'Material substitution',
    signals: [
      // "install 1" rigid instead of the 1/2"" — dimension + "instead of" / "in lieu of"
      // No trailing \b after a quote/unit because \b after non-word→non-word doesn't match.
      /\b(?:use|install)\s+\d+(?:[./]\d+)?\s*(?:"|in(?:ch)?|mm|cm)?\s*\w*\s*(?:instead of|in lieu of|rather than)\b/i,
      // "upgrade from X to Y" / "upgrade to" — only when paired with a dimension/material
      // keyword so "change from 12 LF to 28 LF" stays a quantity change.
      /\bupgrade\s+(?:from|to)\b/i,
      /\bsubstitut(?:e|ion|ed)\b/i,
    ],
    fewShot: {
      question: 'Drawings show 1/2" rigid insulation on the north wall. Confirm thickness.',
      answer: 'Per attached sketch, install 1" rigid insulation on the north exterior wall instead of the 1/2" shown — confirmed.',
      output: {
        scope_change: true,
        kind: 'material_substitution',
        reasoning: 'Insulation thickness upgraded from 1/2" to 1" — added material cost across wall area.',
      },
    },
  },
  {
    kind: 'quantity_change',
    label: 'Quantity change',
    signals: [
      /\b(?:add|increase|extend)\s+(?:by\s+)?\d/i,
      /\b\d+\s*(?:lf|sf|ea|cy)\b.{0,40}\b(?:total|now|revised)\b/i,
      /\bchange\s+(?:from|to)\s+\d/i,
    ],
    fewShot: {
      question: 'Drawing shows 12 LF of pipe support angle. Confirm.',
      answer: 'Quantity revised — install 28 LF total to extend through the new mechanical chase.',
      output: {
        scope_change: true,
        kind: 'quantity_change',
        reasoning: '12 LF → 28 LF; +16 LF of pipe support angle and labor.',
      },
    },
  },
  {
    kind: 'new_scope_element',
    label: 'New scope element',
    signals: [
      /\b(?:add|install|provide)\s+(?:additional|new)?\b/i,
      /\bnot shown on (?:the )?(?:plans?|drawings?)\b/i,
      /\bin addition to\b/i,
    ],
    fewShot: {
      question: 'Per spec, we have standard outlets every 6 LF. Confirm GFCI placement.',
      answer: 'In addition to standard outlets, provide GFCI receptacles at all kitchen counter locations — 12 total. Not shown on the original drawings.',
      output: {
        scope_change: true,
        kind: 'new_scope_element',
        reasoning: '12 GFCI receptacles added — new scope element not in original spec.',
      },
    },
  },
  {
    kind: 'sequence_change',
    label: 'Sequence / relocation',
    signals: [
      /\brelocate\b/i,
      /\bmove\s+to\b/i,
      /\b(?:re-?route|reroute)\b/i,
      /\bshift\s+(?:by|to)\b/i,
    ],
    fewShot: {
      question: 'Junction box JB-12 is shown at grid C7. Conflict with framer.',
      answer: 'Relocate JB-12 to grid D7. Includes re-running 8 LF of conduit and re-pulling existing branch circuits.',
      output: {
        scope_change: true,
        kind: 'sequence_change',
        reasoning: 'Junction box relocation requires re-pulling circuits — labor implication beyond original install.',
      },
    },
  },
  {
    kind: 'detail_change',
    label: 'Detail change (cost-neutral check required)',
    signals: [
      /\buse detail\s+\w/i,
      /\bper detail\s+\w/i,
      /\brevised detail\b/i,
    ],
    fewShot: {
      question: 'For corner condition at column C5, which detail governs?',
      answer: 'Use detail B on sheet A8.04 instead of detail A.',
      output: {
        scope_change: false,
        kind: 'detail_change',
        reasoning: 'Detail swap with no quantity or material change — cost-neutral. No CO required.',
      },
    },
  },
  {
    kind: 'no_change',
    label: 'No scope change',
    signals: [
      /\bproceed as drawn\b/i,
      /\bno change\b/i,
      /\bconfirm(?:ed)? as (?:shown|drawn|specified)\b/i,
    ],
    fewShot: {
      question: 'Are we proceeding with the 1/2" insulation as shown?',
      answer: 'Yes, proceed as drawn. No change.',
      output: {
        scope_change: false,
        kind: 'no_change',
        reasoning: 'Architect explicitly confirmed the original scope. No CO action.',
      },
    },
  },
]

/**
 * Returns true when the answer contains at least one signal for any
 * scope-change kind (anything except 'no_change'). Used by the edge function
 * to validate the model's `scope_change=true` call before drafting a CO.
 *
 * Conservative: if no anchor matches but the model still claimed a scope
 * change, the edge function downgrades confidence to 'low' and skips the
 * CO draft. The PM still sees an Iris inbox card.
 */
export function answerHasScopeSignal(answerText: string): boolean {
  for (const p of PATTERNS) {
    if (p.kind === 'no_change' || p.kind === 'detail_change') continue
    for (const sig of p.signals) {
      if (sig.test(answerText)) return true
    }
  }
  return false
}

/**
 * Returns true when the answer contains an explicit "no change" signal.
 * Used to short-circuit AI calls when the architect plainly confirmed the
 * existing scope — no point burning tokens on those.
 */
export function answerIsExplicitNoChange(answerText: string): boolean {
  for (const sig of PATTERNS.find(p => p.kind === 'no_change')!.signals) {
    if (sig.test(answerText)) return true
  }
  return false
}

/**
 * Best-guess kind from regex anchors only. Returns null when no signal
 * matches. The edge function uses this as a sanity check on the model's
 * declared kind.
 */
export function inferKindFromSignals(answerText: string): ScopeChangeKind | null {
  for (const p of PATTERNS) {
    for (const sig of p.signals) {
      if (sig.test(answerText)) return p.kind
    }
  }
  return null
}
