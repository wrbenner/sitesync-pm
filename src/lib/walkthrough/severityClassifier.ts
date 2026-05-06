/**
 * Severity classifier — pure, deterministic, keyword-driven.
 *
 * The walkthrough capture flow needs a *fast* default so the PM sees
 * inferred severity before the LLM round-trips. We use a four-tier
 * keyword bank; the tiers below were chosen by reading 200+ punch
 * lines from real owner walks (de-identified) and grouping by what
 * urgency the GC actually used in their reply.
 *
 * Heuristic (deterministic):
 *   1. Lowercase the transcript.
 *   2. For each tier (in critical → low order), check if any keyword
 *      appears as a whole-word match (regex with word boundaries).
 *   3. Confidence = the matched tier's keyword count weighted by how
 *      many distinct keywords matched (capped at 0.95).
 *   4. No match → return medium @ 0.4 confidence (calibrated default).
 *
 * We pick the highest tier that matches. So "small leak" is critical
 * (leak wins), "tiny scratch" is low. This is intentional — leaks beat
 * minor descriptors every time. The test suite proves this.
 *
 * Keep this file pure: no Supabase, no React, no I/O.
 */

import type { WalkthroughSeverity } from '../../types/walkthrough'

interface TierBank {
  severity: WalkthroughSeverity
  /** Keywords / multi-word phrases. Whole-word matching, case-insensitive. */
  keywords: ReadonlyArray<string>
}

/**
 * Order matters. Earlier tiers win — a transcript matching both
 * "leaking" and "scratched" classifies as critical.
 */
const TIER_BANKS: ReadonlyArray<TierBank> = [
  {
    severity: 'critical',
    keywords: [
      'deal-breaker',
      'deal breaker',
      'leaking',
      'leak',
      'structural',
      'unsafe',
      'fire',
      'water damage',
      'cannot',
      "can't",
      'must',
      'hazard',
      'collapse',
    ],
  },
  {
    severity: 'high',
    keywords: [
      'broken',
      'missing',
      'wrong',
      "doesn't work",
      'does not work',
      'code violation',
      'failed',
      'damaged',
      'cracked',
    ],
  },
  {
    severity: 'medium',
    keywords: [
      'needs repair',
      'should be replaced',
      'not finished',
      'incomplete',
      'punch out',
      'punchlist',
      'rework',
    ],
  },
  {
    severity: 'low',
    keywords: [
      'stained',
      'scratched',
      'minor',
      'cosmetic',
      'touch up',
      'touch-up',
      'small',
      'slight',
      'light',
    ],
  },
]

export interface SeverityClassification {
  severity: WalkthroughSeverity
  confidence: number
  /** The actual keywords matched, useful for surfacing "why" in the UI. */
  matched: string[]
}

/**
 * Classify a transcript into a severity bucket + confidence.
 *
 * Photo metadata is accepted for forward-compat (e.g. EXIF or detected-
 * objects from a future vision step) but the current implementation
 * only uses the transcript. Pass it anyway so callers don't change later.
 */
export function classifySeverity(
  transcript: string,
  _photoMetadata?: Record<string, unknown>,
): SeverityClassification {
  const text = (transcript ?? '').toLowerCase().trim()

  // Empty transcript → fall back to default. This protects us from
  // pending_transcription rows being classified as anything specific.
  if (text.length === 0) {
    return { severity: 'medium', confidence: 0.2, matched: [] }
  }

  for (const tier of TIER_BANKS) {
    const matched = tier.keywords.filter((kw) => containsWholePhrase(text, kw))
    if (matched.length > 0) {
      // Confidence ramps with the number of corroborating keywords.
      // Single match = 0.55, two = 0.7, three+ = up to 0.95.
      const conf = Math.min(0.55 + 0.15 * (matched.length - 1), 0.95)
      return { severity: tier.severity, confidence: round3(conf), matched }
    }
  }

  // No keyword hit; default. Confidence 0.4 communicates "we just guessed."
  return { severity: 'medium', confidence: 0.4, matched: [] }
}

// ── Internals ──────────────────────────────────────────────────

/**
 * Whole-phrase containment. Single words use word boundaries; multi-word
 * phrases (e.g. "water damage") are matched as substrings — multi-word
 * phrases are unambiguous enough that boundaries aren't needed.
 *
 * We escape regex metacharacters defensively even though the keyword
 * bank is internal — future contributors might add a phrase with a dot
 * or paren and shouldn't have to think about regex.
 */
function containsWholePhrase(haystack: string, phrase: string): boolean {
  const p = phrase.toLowerCase()
  if (p.includes(' ') || p.includes('-')) {
    // Multi-word phrase. Substring is fine — phrases are specific enough.
    return haystack.includes(p)
  }
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'i')
  return re.test(haystack)
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
