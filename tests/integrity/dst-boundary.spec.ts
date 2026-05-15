/**
 * FMEA H.TIME.1 (wave 3) — DST boundary inclusion/exclusion consistency.
 *
 * Hazard: A row created at the DST transition instant (e.g. 2026-03-08
 *         02:30 America/New_York, which doesn't exist because 02:00 →
 *         03:00 jumps) or 2026-11-01 01:30 (which exists twice) is
 *         either:
 *           - excluded from a daily/weekly report because the comparison
 *             window slid the wrong way, OR
 *           - included twice because the fold hour wraps, OR
 *           - placed in the "wrong" day depending on whether the report
 *             builder used UTC, project local, or user local.
 *
 *         The worst-case business outcome: an RFI submitted "Sunday 1:30
 *         AM" appears on Saturday's report AND Sunday's report, or
 *         neither. Audit trails diverge from user perception.
 *
 * Test approach (vitest, pure unit):
 *   1. For each DST boundary in 2026 (US spring forward, US fall back),
 *      construct an entity (RFI) with created_at at the transition.
 *   2. Run a deterministic windowing function with a fixed range
 *      [start_local, end_local].
 *   3. Assert: the entity is included in EXACTLY one window when the
 *      window slides forward by 24h (no double-counting, no skipping).
 *
 *   The functions under contract are written as pure helpers inline
 *   here — they're the spec for the windowing behavior the reporting
 *   layer SHOULD use. If a real helper exists in
 *   src/lib/timezone or src/lib/reports, this spec serves as the
 *   contract test that the helper must satisfy.
 */
import { describe, it, expect } from 'vitest'

// 2026 US DST boundaries (Sunday):
//   Spring forward: 2026-03-08 02:00 EST → 03:00 EDT (no 02:30 EST exists)
//   Fall back:      2026-11-01 02:00 EDT → 01:00 EST (01:30 happens twice)
const SPRING_FORWARD_ISO = '2026-03-08T07:30:00Z' // ~02:30 EST / ~03:30 EDT
const FALL_BACK_FIRST_ISO = '2026-11-01T05:30:00Z' // first 01:30 EDT
const FALL_BACK_SECOND_ISO = '2026-11-01T06:30:00Z' // second 01:30 EST

/**
 * Returns the UTC day boundaries for a "report day" in the given
 * America/New_York timezone, expressed as ISO strings.
 *
 * The contract this test enforces:
 *   - inclusion is half-open: [startUTC, endUTC)
 *   - every day spans exactly 23, 24, or 25 hours (the DST anomaly)
 *   - an entity created at any UTC instant belongs to EXACTLY one
 *     report day
 */
function reportDayUTCBounds(
  reportLocalDate: string, // e.g. '2026-03-08'
  tz: 'America/New_York' = 'America/New_York',
): { startUTC: Date; endUTC: Date } {
  const [y, m, d] = reportLocalDate.split('-').map(Number)
  // Build the local midnight by formatting; relies on Intl to do tz math.
  // For determinism, hard-code the UTC offsets for 2026 NY:
  //   Standard time (EST): UTC-5
  //   Daylight time (EDT): UTC-4
  // Spring forward 2026-03-08 02:00 (EST→EDT). Fall back 2026-11-01 02:00.
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  const offset = isEDT(dt, tz) ? -4 : -5
  const startUTC = new Date(Date.UTC(y, m - 1, d, -offset, 0, 0))
  const next = new Date(startUTC)
  next.setUTCDate(next.getUTCDate() + 1)
  // The next day's offset may differ across a DST boundary; pick its
  // local-midnight UTC instant.
  const offsetNext = isEDT(next, tz) ? -4 : -5
  const endUTC = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), -offsetNext, 0, 0),
  )
  return { startUTC, endUTC }
}

function isEDT(d: Date, _tz: 'America/New_York'): boolean {
  // 2026 EDT window: 2026-03-08 06:00 UTC (02:00 local jumps to 03:00) — UTC −4
  //                  through 2026-11-01 06:00 UTC (02:00 local → 01:00) — UTC −5
  const SPRING = Date.UTC(2026, 2, 8, 7, 0, 0) // 07:00 UTC = 03:00 EDT (first valid EDT instant)
  const FALL = Date.UTC(2026, 10, 1, 6, 0, 0) // 06:00 UTC = 02:00 EDT, last EDT moment
  const t = d.getTime()
  return t >= SPRING && t < FALL
}

function isIncludedInReportDay(eventUTCIso: string, reportLocalDate: string): boolean {
  const t = new Date(eventUTCIso).getTime()
  const { startUTC, endUTC } = reportDayUTCBounds(reportLocalDate)
  return t >= startUTC.getTime() && t < endUTC.getTime()
}

describe('FMEA H.TIME.1 — DST boundary inclusion consistency', () => {
  it('spring-forward instant lands in exactly one report day', () => {
    // 2026-03-08 07:30Z = ~03:30 EDT (just after spring-forward).
    const included = ['2026-03-07', '2026-03-08', '2026-03-09'].filter((d) =>
      isIncludedInReportDay(SPRING_FORWARD_ISO, d),
    )
    expect(included.length).toBe(1)
    expect(included[0]).toBe('2026-03-08')
  })

  it('fall-back first 01:30 (EDT) lands in the right day', () => {
    const included = ['2026-10-31', '2026-11-01', '2026-11-02'].filter((d) =>
      isIncludedInReportDay(FALL_BACK_FIRST_ISO, d),
    )
    expect(included.length).toBe(1)
    expect(included[0]).toBe('2026-11-01')
  })

  it('fall-back second 01:30 (EST) lands in the same day, not duplicated', () => {
    const included = ['2026-10-31', '2026-11-01', '2026-11-02'].filter((d) =>
      isIncludedInReportDay(FALL_BACK_SECOND_ISO, d),
    )
    expect(included.length).toBe(1)
    expect(included[0]).toBe('2026-11-01')
  })

  it('spring-forward report day is exactly 23 hours long', () => {
    const { startUTC, endUTC } = reportDayUTCBounds('2026-03-08')
    const hours = (endUTC.getTime() - startUTC.getTime()) / 3_600_000
    expect(hours).toBe(23)
  })

  it('fall-back report day is exactly 25 hours long', () => {
    const { startUTC, endUTC } = reportDayUTCBounds('2026-11-01')
    const hours = (endUTC.getTime() - startUTC.getTime()) / 3_600_000
    expect(hours).toBe(25)
  })

  it('non-DST report days are exactly 24 hours long', () => {
    const { startUTC, endUTC } = reportDayUTCBounds('2026-06-15')
    const hours = (endUTC.getTime() - startUTC.getTime()) / 3_600_000
    expect(hours).toBe(24)
  })

  it('a sweep of instants near DST never double-counts', () => {
    // Sweep instants every 5 minutes across the fall-back window and
    // ensure each appears in exactly one report day.
    const start = new Date('2026-10-31T00:00:00Z').getTime()
    const end = new Date('2026-11-02T00:00:00Z').getTime()
    const days = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']
    for (let t = start; t < end; t += 5 * 60 * 1000) {
      const iso = new Date(t).toISOString()
      const hits = days.filter((d) => isIncludedInReportDay(iso, d))
      expect(hits.length, `instant ${iso} matched ${hits.length} report days`).toBe(1)
    }
  })
})
