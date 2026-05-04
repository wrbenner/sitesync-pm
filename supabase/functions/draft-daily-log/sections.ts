// ── Server-side section assembler ──────────────────────────────────────────
// Mirror of src/lib/dailyLogDrafting/sections.ts. Edge functions can't
// import from the SPA (different runtime, different tsconfig), so we
// duplicate the deterministic assembler here. Keep the two files in sync
// by hand — both are pure and short, and the SPA tests cover the logic.
//
// If the two ever drift in non-trivial ways, generate the server file
// from the SPA file via codegen at build time.

export type DraftSource =
  | 'weather_observed'
  | 'crew_check_in'
  | 'roster_scheduled'
  | 'photo_caption'
  | 'voice_capture'
  | 'rfi_event'
  | 'meeting_action_item'
  | 'schedule_progress'
  | 'inspection_record'
  | 'material_delivery'
  | 'manual'
  | 'fallback'

export interface DraftedDailyLogBullet {
  text: string
  sources: ReadonlyArray<{ kind: DraftSource; ref?: string; snippet?: string }>
  cost_code?: string
  cost_code_confidence?: number
}

export interface DraftedDailyLogCrewRow {
  trade: string
  sub_company?: string
  count: number
  hours?: number
  source: 'crew_check_in' | 'roster_scheduled'
}

export interface DraftedDailyLogWeather {
  condition: string
  high_temp_f?: number
  low_temp_f?: number
  precipitation_in?: number
  wind_mph?: number
  weather_source: 'observed' | 'forecast' | 'manual' | 'unknown'
}

export type DraftedDailyLogSectionId =
  | 'weather' | 'manpower' | 'work_performed' | 'issues' | 'visitors'

export interface DraftedDailyLog {
  date: string
  timezone: string
  weather: DraftedDailyLogWeather
  weather_summary: string
  manpower: ReadonlyArray<DraftedDailyLogCrewRow>
  manpower_total: number
  work_performed: ReadonlyArray<DraftedDailyLogBullet>
  issues: ReadonlyArray<DraftedDailyLogBullet>
  visitors: ReadonlyArray<DraftedDailyLogBullet>
  partial: boolean
  partial_reasons: Partial<Record<DraftedDailyLogSectionId, string>>
  provenance: ReadonlyArray<{ kind: DraftSource; count: number; sample_refs?: string }>
  generated_by: string
}

export interface DayContext {
  project_id: string
  date: string
  timezone: string
  weather: DraftedDailyLogWeather | null
  crews: ReadonlyArray<DraftedDailyLogCrewRow>
  photos: ReadonlyArray<{ id: string; caption: string; drawing_id?: string; pinned_zone?: string }>
  captures: ReadonlyArray<{ id: string; text: string; kind: 'voice' | 'text' | 'observation' }>
  rfis_today: ReadonlyArray<{ id: string; number: number; title: string; event: string }>
  meeting_action_items: ReadonlyArray<{ id: string; description: string; meeting_title?: string }>
  schedule_events: ReadonlyArray<{ id: string; title: string; delta_percent?: number; new_status?: string }>
  inspections: ReadonlyArray<{ id: string; inspector?: string; type: string; result?: 'pass' | 'fail' | 'pending'; notes?: string }>
  deliveries: ReadonlyArray<{ id: string; item: string; quantity?: number; sub?: string }>
}

const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g
const FULL_NAME_RE = /\b[A-Z][a-z]{2,}\s+(?:[A-Z][a-z]{1,}\s+)?[A-Z][a-z]{2,}\b/g

export function stripPii(text: string): string {
  return text
    .replace(EMAIL_RE, '[email redacted]')
    .replace(PHONE_RE, '[phone redacted]')
    .replace(FULL_NAME_RE, '[name redacted]')
}

// Cost-code rules (subset of the SPA list — keep in sync).
interface Rule { code: string; triggers: ReadonlyArray<string | RegExp> }
const RULES: ReadonlyArray<Rule> = [
  { code: '03 30 00', triggers: ['concrete', 'rebar', 'pour', 'slab', 'formwork', 'foundation', 'footing', 'mat slab'] },
  { code: '04 22 00', triggers: ['cmu', 'masonry', 'block wall', 'mortar'] },
  { code: '05 12 00', triggers: ['steel beam', 'steel column', 'erection', 'i-beam', 'w-beam', 'structural steel'] },
  { code: '06 10 00', triggers: ['framing', 'stud wall', 'rough carpentry', 'joist', 'rafter', 'plywood sheathing'] },
  { code: '07 21 00', triggers: ['insulation', 'fiberglass batts', 'spray foam', 'rigid insulation'] },
  { code: '07 50 00', triggers: ['roofing', 'roof membrane', 'tpo', 'epdm', 'built-up roof'] },
  { code: '08 11 13', triggers: ['door frame', 'hollow metal door', 'hm door'] },
  { code: '08 71 00', triggers: ['door hardware', 'hinges', 'closers', 'panic device', 'lockset'] },
  { code: '09 21 16', triggers: ['drywall', 'gypsum', 'gyp board', 'sheetrock', 'taping', 'mudding'] },
  { code: '09 65 00', triggers: ['vct', 'vinyl tile', 'resilient flooring', 'lvt'] },
  { code: '09 91 00', triggers: ['paint', 'painting', 'primer', 'topcoat', 'spray paint'] },
  { code: '21 10 00', triggers: ['sprinkler head', 'fire main', 'fire-suppression', 'fp piping'] },
  { code: '22 10 00', triggers: ['plumbing', 'water line', 'sanitary', 'waste line', 'pex', 'copper line'] },
  { code: '23 31 00', triggers: ['ductwork', 'duct install', 'sheet metal duct', 'vav', 'spiral duct'] },
  { code: '26 05 00', triggers: ['conduit', 'wire pull', 'electrical rough', 'panel install', 'gear', 'feeder', /\b(emt|rmc)\b/] },
  { code: '27 10 00', triggers: ['low voltage', 'data cabling', 'cat6', 'cat-6', 'fiber pull'] },
  { code: '31 23 00', triggers: ['excavation', 'trenching', 'backfill', 'site dig', 'compaction'] },
]

export function inferCostCode(bulletText: string): { cost_code: string | null; confidence: number } {
  const text = bulletText.toLowerCase().replace(/\s+/g, ' ').trim()
  if (text.length < 4) return { cost_code: null, confidence: 0 }
  let best = { cost_code: null as string | null, confidence: 0 }
  for (const rule of RULES) {
    const matches: string[] = []
    for (const t of rule.triggers) {
      if (typeof t === 'string') {
        if (text.includes(t)) matches.push(t)
      } else if (t.test(text)) {
        matches.push(t.source)
      }
    }
    if (matches.length === 0) continue
    const conf = matches.length === 1 ? 0.45 : matches.length === 2 ? 0.7 : 0.85
    if (conf > best.confidence) best = { cost_code: rule.code, confidence: conf }
  }
  return best
}

function bulletFrom(
  text: string,
  source: DraftedDailyLogBullet['sources'][number],
): DraftedDailyLogBullet {
  const safe = stripPii(text).trim()
  const inf = inferCostCode(safe)
  const b: DraftedDailyLogBullet = { text: safe, sources: [source] }
  if (inf.cost_code && inf.confidence >= 0.6) {
    b.cost_code = inf.cost_code
    b.cost_code_confidence = Number(inf.confidence.toFixed(2))
  }
  return b
}

export function assembleDailyLogDraft(ctx: DayContext, generated_by = 'claude-sonnet-4-6'): DraftedDailyLog {
  // Weather
  let weather: DraftedDailyLogWeather = ctx.weather ?? { condition: 'unknown', weather_source: 'unknown' }
  let weather_summary = 'Weather data unavailable.'
  let weather_reason: string | undefined = ctx.weather ? undefined : 'No weather record for the day.'
  if (ctx.weather) {
    const parts: string[] = [ctx.weather.condition]
    if (ctx.weather.high_temp_f != null && ctx.weather.low_temp_f != null) {
      parts.push(`${ctx.weather.high_temp_f}°F / ${ctx.weather.low_temp_f}°F`)
    }
    if (ctx.weather.precipitation_in != null && ctx.weather.precipitation_in > 0) {
      parts.push(`${ctx.weather.precipitation_in.toFixed(2)}″ precipitation`)
    }
    if (ctx.weather.wind_mph != null && ctx.weather.wind_mph >= 15) {
      parts.push(`wind ${Math.round(ctx.weather.wind_mph)} mph`)
    }
    if (ctx.weather.weather_source === 'forecast') parts.push('(forecast — observation pending)')
    weather_summary = parts.join(', ')
  }

  // Manpower roll-up
  const map = new Map<string, DraftedDailyLogCrewRow>()
  for (const row of ctx.crews) {
    const key = `${row.trade.toLowerCase()}|${(row.sub_company ?? '').toLowerCase()}`
    const existing = map.get(key)
    if (existing) {
      map.set(key, {
        ...existing,
        count: existing.count + row.count,
        hours: (existing.hours ?? 0) + (row.hours ?? 0),
        source: existing.source === 'crew_check_in' ? existing.source : row.source,
      })
    } else {
      map.set(key, { ...row })
    }
  }
  const manpower = Array.from(map.values()).sort((a, b) => b.count - a.count)
  const manpower_total = manpower.reduce((s, r) => s + r.count, 0)

  // Work Performed
  const workBullets: DraftedDailyLogBullet[] = []
  for (const photo of ctx.photos) {
    if (photo.caption) workBullets.push(bulletFrom(photo.caption, { kind: 'photo_caption', ref: photo.id }))
  }
  for (const cap of ctx.captures) {
    workBullets.push(bulletFrom(cap.text, {
      kind: cap.kind === 'voice' ? 'voice_capture' : 'manual', ref: cap.id,
    }))
  }
  for (const ev of ctx.schedule_events) {
    const text = ev.delta_percent != null
      ? `${ev.title}: progressed +${ev.delta_percent}%`
      : `${ev.title}: ${ev.new_status ?? 'updated'}`
    workBullets.push(bulletFrom(text, { kind: 'schedule_progress', ref: ev.id }))
  }
  for (const d of ctx.deliveries) {
    const text = d.quantity != null
      ? `Material delivery: ${d.quantity} × ${d.item}` + (d.sub ? ` (${d.sub})` : '')
      : `Material delivery: ${d.item}` + (d.sub ? ` (${d.sub})` : '')
    workBullets.push(bulletFrom(text, { kind: 'material_delivery', ref: d.id }))
  }
  const work_performed = workBullets.slice(0, 8)

  // Issues
  const issueBullets: DraftedDailyLogBullet[] = []
  for (const r of ctx.rfis_today) {
    const t = r.event === 'filed' ? `RFI #${r.number} filed: ${r.title}`
      : r.event === 'answered' ? `RFI #${r.number} answered: ${r.title}`
      : `RFI #${r.number} ${r.event}: ${r.title}`
    issueBullets.push(bulletFrom(t, { kind: 'rfi_event', ref: r.id }))
  }
  for (const m of ctx.meeting_action_items) {
    issueBullets.push(bulletFrom(
      m.meeting_title ? `${m.meeting_title}: ${m.description}` : m.description,
      { kind: 'meeting_action_item', ref: m.id },
    ))
  }

  // Visitors / Inspections
  const visitorBullets = ctx.inspections.map((i) => {
    const result = i.result ? ` — ${i.result.toUpperCase()}` : ''
    const inspector = i.inspector ? ` (${i.inspector})` : ''
    const notes = i.notes ? `: ${i.notes}` : ''
    return bulletFrom(`${i.type}${result}${inspector}${notes}`, { kind: 'inspection_record', ref: i.id })
  })

  // Partial reasons
  const partial_reasons: Partial<Record<DraftedDailyLogSectionId, string>> = {}
  if (weather_reason) partial_reasons.weather = weather_reason
  if (manpower.length === 0) partial_reasons.manpower = 'No manpower recorded for the day.'
  if (work_performed.length === 0) {
    partial_reasons.work_performed = ctx.photos.length === 0 && ctx.captures.length === 0
      ? 'No photos captured today — generated from schedule activity only.'
      : 'No qualifying activity to summarize.'
  }
  if (issueBullets.length === 0) partial_reasons.issues = 'No issues or delays recorded.'
  if (visitorBullets.length === 0) partial_reasons.visitors = '(none recorded)'

  // Provenance roll-up
  const counts = new Map<string, { count: number; refs: string[] }>()
  for (const b of [...work_performed, ...issueBullets, ...visitorBullets]) {
    for (const s of b.sources) {
      const e = counts.get(s.kind) ?? { count: 0, refs: [] }
      e.count += 1
      if (s.ref && e.refs.length < 5) e.refs.push(s.ref)
      counts.set(s.kind, e)
    }
  }
  const provenance = Array.from(counts.entries()).map(([kind, v]) => ({
    kind: kind as DraftSource,
    count: v.count,
    sample_refs: v.refs.length ? v.refs.join(',') : undefined,
  }))

  return {
    date: ctx.date,
    timezone: ctx.timezone,
    weather,
    weather_summary,
    manpower,
    manpower_total,
    work_performed,
    issues: issueBullets,
    visitors: visitorBullets,
    partial: Object.keys(partial_reasons).length > 0,
    partial_reasons,
    provenance,
    generated_by,
  }
}
