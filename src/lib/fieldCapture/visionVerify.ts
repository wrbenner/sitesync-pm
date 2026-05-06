// =============================================================================
// Vision verification — sanity check a photo's auto-link
// =============================================================================
// After Tab B's auto-linker proposes a (photo → drawing area, photo → sub
// trade) pair, this verifier asks a vision model: "Does the image plausibly
// show <trade> work near <area>?"
//
// Returns a confidence score and a verdict. Verdicts are advisory — the
// linker's row stays linked either way; the visualizer uses the verdict
// to render the badge ("verified" / "inferred only" / "doesn't look right").
//
// IMPORTANT: this NEVER changes link rows. Misclassification by the vision
// model can't break the linkage chain. Only PMs with the right permission
// can manually unlink (and that's already audited).
// =============================================================================

export type VerificationVerdict =
  | 'verified'         // confidence >= 0.85 and the trade matches what the photo shows
  | 'inferred_only'    // confidence < 0.7 — model couldn't confidently confirm, link kept as-is
  | 'mismatch'         // confidence >= 0.7 AND the model is confident the trade is wrong

export interface VerificationInputs {
  photoUrl: string
  inferredTrade: string | null
  inferredAreaDescription: string | null
  /** Drawing sheet number/title for context. */
  drawingContext: string | null
}

export interface VerificationOutput {
  verdict: VerificationVerdict
  /** [0..1]. */
  confidence: number
  /** Free-text explanation surfaced in the visualizer hover. */
  reasoning: string
  /** Provider + model used (for the audit trail). */
  provider: string
  model: string
}

/**
 * Build the prompt + system message used by the edge function. Pure — testable
 * without a network call.
 */
export function buildVerificationPrompt(inputs: VerificationInputs): { system: string; user: string } {
  const system = `You are a senior construction superintendent reviewing whether
a captured photo plausibly shows the work it was auto-tagged with.

Output one of three verdicts:
  • "verified" — the photo clearly shows work consistent with the inferred trade.
  • "inferred_only" — you cannot confirm or deny; the photo is too ambiguous.
  • "mismatch" — the photo clearly shows different trade work than was inferred.

Always include a confidence number in [0..1] and a one-sentence reasoning.

Return JSON only. Schema:
{ "verdict": "verified"|"inferred_only"|"mismatch", "confidence": number, "reasoning": string }`

  const user = `Photo: ${inputs.photoUrl}
Inferred trade: ${inputs.inferredTrade ?? '(unknown)'}
Inferred area: ${inputs.inferredAreaDescription ?? '(unknown)'}
Drawing context: ${inputs.drawingContext ?? '(none)'}

Does the photo plausibly show this trade's work?`

  return { system, user }
}

/**
 * Bucket a raw confidence score into the three-verdict policy. Pure.
 */
export function classifyConfidence(rawVerdict: string, rawConfidence: number): VerificationVerdict {
  const c = Math.max(0, Math.min(1, rawConfidence))
  const v = rawVerdict.toLowerCase().trim()
  if (v === 'mismatch' && c >= 0.7) return 'mismatch'
  if (v === 'verified' && c >= 0.85) return 'verified'
  return 'inferred_only'
}
