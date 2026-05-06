// DO NOT EDIT IN PLACE — duplicated from src/lib/linkage/subResolver.ts
// Edge functions run under Deno and cannot import from src/. When the
// canonical lib changes, copy the file here and rerun the linker tests.

// =============================================================================
// Linkage Engine — sub-on-site resolver
// =============================================================================
// Find which crews were on site at the photo's timestamp, ordered by trade
// match against the photo's nearest spec section. The visualizer surfaces
// the top-1 as the suggested attribution; the user can override.
//
// Disputed checkins (rejected by the crew lead) are NEVER returned. The
// auto-linker also writes its match notes including which checkin was used,
// so a year-later audit can show provenance per link.
// =============================================================================

import type { Confidence, EntityLink, MediaInput } from './types.ts'

export interface CrewCheckinRow {
  id: string
  crew_id: string
  checked_in_at: string  // ISO
  checked_out_at: string | null
  disputed_at: string | null
}

export interface CrewRow {
  id: string
  trade: string | null
}

export interface SubResolveOptions {
  /** Pre-filtered to project + ordered by checked_in_at. */
  checkins: CrewCheckinRow[]
  crewsById: Map<string, CrewRow>
  /** Cap on returned candidates. Default 3 — UI shows the top-1 with a chevron. */
  maxLinks?: number
}

const STILL_ON_SITE = (now: number) => now

function tradeAffinity(crewTrade: string | null, specSection: string | null | undefined): number {
  // Returns a number in [0..1] expressing how well the crew's trade matches
  // the photo's spec section. Higher = better.
  // The mapping is intentionally fuzzy — CSI sections don't 1:1 to construction
  // trades, and the goal here is "tiebreaker", not authoritative.
  if (!crewTrade) return 0
  if (!specSection) return 0.1  // small floor so we still rank consistently

  const trade = crewTrade.toLowerCase()
  const div = specSection.trim().slice(0, 2)

  const map: Record<string, string[]> = {
    '03': ['concrete', 'rebar'],
    '04': ['masonry'],
    '05': ['steel', 'metal'],
    '06': ['framing', 'wood', 'carpentry'],
    '07': ['roofing', 'siding', 'sheet metal', 'flashing', 'thermal', 'waterproof'],
    '08': ['glazing', 'window', 'door'],
    '09': ['drywall', 'paint', 'finish', 'tile', 'flooring'],
    '21': ['fire protection', 'sprinkler'],
    '22': ['plumbing', 'mep'],
    '23': ['hvac', 'mechanical', 'mep'],
    '26': ['electrical', 'mep'],
    '32': ['landscape', 'paving', 'civil', 'site'],
    '33': ['utility', 'civil', 'site'],
  }

  const expectedTokens = map[div] ?? []
  const matches = expectedTokens.some(tok => trade.includes(tok))
  return matches ? 1 : 0.2
}

export function resolveSubLinks(
  media: MediaInput,
  opts: SubResolveOptions,
): EntityLink[] {
  const taken = new Date(media.takenAt).getTime()
  if (!Number.isFinite(taken)) return []

  // Crews whose checkin window contains the photo's timestamp.
  type Candidate = { crewId: string; checkinId: string; affinity: number }
  const candidates: Candidate[] = []

  for (const c of opts.checkins) {
    if (c.disputed_at) continue
    const inAt = new Date(c.checked_in_at).getTime()
    if (!Number.isFinite(inAt) || inAt > taken) continue
    const outAt = c.checked_out_at
      ? new Date(c.checked_out_at).getTime()
      : STILL_ON_SITE(Date.now())
    if (!Number.isFinite(outAt) || outAt < taken) continue

    const crew = opts.crewsById.get(c.crew_id)
    candidates.push({
      crewId: c.crew_id,
      checkinId: c.id,
      affinity: tradeAffinity(crew?.trade ?? null, media.specSection),
    })
  }

  // Dedupe by crew (a crew might have multiple checkins overlapping the photo)
  // and keep the highest affinity.
  const byCrew = new Map<string, Candidate>()
  for (const cand of candidates) {
    const existing = byCrew.get(cand.crewId)
    if (!existing || cand.affinity > existing.affinity) byCrew.set(cand.crewId, cand)
  }

  const ranked = [...byCrew.values()].sort((a, b) => b.affinity - a.affinity)

  const max = opts.maxLinks ?? 3
  const links: EntityLink[] = []
  for (const cand of ranked.slice(0, max)) {
    const crew = opts.crewsById.get(cand.crewId)
    const conf: Confidence = ranked.length === 1
      ? 'high'   // only one crew on site → unambiguous
      : cand.affinity >= 1
        ? 'high'   // trade-section match resolved the tie
        : 'medium' // multiple crews, no clear tie-break
    links.push({
      entityType: 'crew',
      entityId: cand.crewId,
      confidence: conf,
      source: 'auto',
      notes: `on-site checkin ${cand.checkinId}; trade=${crew?.trade ?? '?'}; ` +
             `spec=${media.specSection ?? '—'}; affinity=${cand.affinity.toFixed(2)}`,
    })
  }
  return links
}
