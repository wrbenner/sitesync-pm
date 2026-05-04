// ── Section assembly ──────────────────────────────────────────────────────
// Pure function: takes a fully-resolved DayContext, returns a
// DraftedDailyLog. NO Supabase, NO fetch, NO React. Easy to test.
//
// The five sections always produce SOMETHING — even on a zero-data day
// the draft renders with honest "(none recorded)" markers. That's the
// design: the super reads a sparse-but-coherent draft instead of staring
// at a blank form, and edits the gaps the system couldn't fill.

import type {
  DayContext,
  DraftedDailyLog,
  DraftedDailyLogBullet,
  DraftedDailyLogCrewRow,
  DraftedDailyLogSectionId,
  DraftedDailyLogWeather,
} from '../../types/dailyLogDraft';
import { inferCostCode } from './costCodeInferer';

const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
/** Likely full-name pattern — Title Case First [Middle] Last. We're
 *  conservative: only redact obvious cases to avoid mangling real text. */
const FULL_NAME_RE = /\b[A-Z][a-z]{2,}\s+(?:[A-Z][a-z]{1,}\s+)?[A-Z][a-z]{2,}\b/g;

/** Strip phone, email, and obvious full-name PII from any user-generated
 *  text we're about to surface in a permanent legal document. Returns
 *  the original string when nothing matched. */
export function stripPii(text: string): string {
  return text
    .replace(EMAIL_RE, '[email redacted]')
    .replace(PHONE_RE, '[phone redacted]')
    .replace(FULL_NAME_RE, '[name redacted]');
}

/** Build a Bullet from a single source row. */
function bulletFrom(
  text: string,
  source: DraftedDailyLogBullet['sources'][number],
  pinnedZone?: string,
): DraftedDailyLogBullet {
  const safe = stripPii(text).trim();
  const inference = inferCostCode(safe, pinnedZone);
  const bullet: DraftedDailyLogBullet = {
    text: safe,
    sources: [source],
  };
  if (inference.cost_code && inference.confidence >= 0.6) {
    bullet.cost_code = inference.cost_code;
    bullet.cost_code_confidence = Number(inference.confidence.toFixed(2));
  }
  return bullet;
}

// ── Section 1: Weather ────────────────────────────────────────────────
function buildWeatherSummary(w: DraftedDailyLogWeather | null): {
  weather: DraftedDailyLogWeather;
  summary: string;
  reason?: string;
} {
  if (!w) {
    return {
      weather: { condition: 'unknown', weather_source: 'unknown' },
      summary: 'Weather data unavailable.',
      reason: 'No weather record for the day.',
    };
  }
  const parts: string[] = [w.condition];
  if (w.high_temp_f != null && w.low_temp_f != null) {
    parts.push(`${w.high_temp_f}°F / ${w.low_temp_f}°F`);
  } else if (w.high_temp_f != null) {
    parts.push(`${w.high_temp_f}°F high`);
  }
  if (w.precipitation_in != null && w.precipitation_in > 0) {
    parts.push(`${w.precipitation_in.toFixed(2)}″ precipitation`);
  }
  if (w.wind_mph != null && w.wind_mph >= 15) {
    parts.push(`wind ${Math.round(w.wind_mph)} mph`);
  }
  if (w.weather_source === 'forecast') {
    parts.push('(forecast — observation pending)');
  }
  return {
    weather: w,
    summary: parts.join(', '),
  };
}

// ── Section 2: Manpower ───────────────────────────────────────────────
function buildManpower(crews: ReadonlyArray<DraftedDailyLogCrewRow>): {
  crews: ReadonlyArray<DraftedDailyLogCrewRow>;
  total: number;
  reason?: string;
} {
  if (crews.length === 0) {
    return { crews: [], total: 0, reason: 'No manpower recorded for the day.' };
  }
  // Roll up duplicates: same trade × same sub_company adds counts.
  const map = new Map<string, DraftedDailyLogCrewRow>();
  for (const row of crews) {
    const key = `${row.trade.toLowerCase()}|${(row.sub_company ?? '').toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        count: existing.count + row.count,
        hours: (existing.hours ?? 0) + (row.hours ?? 0),
        // If any contributing row was 'crew_check_in', prefer that label.
        source: existing.source === 'crew_check_in' ? existing.source : row.source,
      });
    } else {
      map.set(key, { ...row });
    }
  }
  const rolled = Array.from(map.values()).sort((a, b) => b.count - a.count);
  const total = rolled.reduce((acc, r) => acc + r.count, 0);
  return { crews: rolled, total };
}

// ── Section 3: Work Performed ─────────────────────────────────────────
function buildWorkPerformed(ctx: DayContext): {
  bullets: ReadonlyArray<DraftedDailyLogBullet>;
  reason?: string;
} {
  const bullets: DraftedDailyLogBullet[] = [];

  for (const photo of ctx.photos) {
    if (!photo.caption) continue;
    bullets.push(
      bulletFrom(photo.caption, { kind: 'photo_caption', ref: photo.id }, photo.pinned_zone),
    );
  }

  for (const cap of ctx.captures) {
    bullets.push(
      bulletFrom(cap.text, {
        kind: cap.kind === 'voice' ? 'voice_capture' : 'manual',
        ref: cap.id,
      }),
    );
  }

  for (const ev of ctx.schedule_events) {
    const fragment =
      ev.delta_percent != null
        ? `${ev.title}: progressed +${ev.delta_percent}%`
        : `${ev.title}: ${ev.new_status ?? 'updated'}`;
    bullets.push(bulletFrom(fragment, { kind: 'schedule_progress', ref: ev.id }));
  }

  for (const d of ctx.deliveries) {
    const text = d.quantity != null
      ? `Material delivery: ${d.quantity} × ${d.item}` + (d.sub ? ` (${d.sub})` : '')
      : `Material delivery: ${d.item}` + (d.sub ? ` (${d.sub})` : '');
    bullets.push(bulletFrom(text, { kind: 'material_delivery', ref: d.id }));
  }

  if (bullets.length === 0) {
    return {
      bullets: [],
      reason:
        ctx.photos.length === 0 && ctx.captures.length === 0
          ? 'No photos captured today — generated from schedule activity only.'
          : 'No qualifying activity to summarize.',
    };
  }

  // Cap the bullet count to keep the section readable. Sort so photos +
  // schedule events come before bare delivery rows.
  return { bullets: bullets.slice(0, 8) };
}

// ── Section 4: Issues / Delays ────────────────────────────────────────
function buildIssues(ctx: DayContext): {
  bullets: ReadonlyArray<DraftedDailyLogBullet>;
  reason?: string;
} {
  const bullets: DraftedDailyLogBullet[] = [];

  for (const r of ctx.rfis_today) {
    const fragment =
      r.event === 'filed'
        ? `RFI #${r.number} filed: ${r.title}`
        : r.event === 'answered'
          ? `RFI #${r.number} answered: ${r.title}`
          : `RFI #${r.number} ${r.event}: ${r.title}`;
    bullets.push(bulletFrom(fragment, { kind: 'rfi_event', ref: r.id }));
  }

  for (const m of ctx.meeting_action_items) {
    bullets.push(
      bulletFrom(
        m.meeting_title ? `${m.meeting_title}: ${m.description}` : m.description,
        { kind: 'meeting_action_item', ref: m.id },
      ),
    );
  }

  if (bullets.length === 0) {
    return { bullets: [], reason: 'No issues or delays recorded.' };
  }
  return { bullets };
}

// ── Section 5: Visitors / Inspections ─────────────────────────────────
function buildVisitors(ctx: DayContext): {
  bullets: ReadonlyArray<DraftedDailyLogBullet>;
  reason?: string;
} {
  if (ctx.inspections.length === 0) {
    return { bullets: [], reason: '(none recorded)' };
  }
  const bullets = ctx.inspections.map((i) => {
    const result = i.result ? ` — ${i.result.toUpperCase()}` : '';
    const inspector = i.inspector ? ` (${i.inspector})` : '';
    const notes = i.notes ? `: ${i.notes}` : '';
    const text = `${i.type}${result}${inspector}${notes}`;
    return bulletFrom(text, { kind: 'inspection_record', ref: i.id });
  });
  return { bullets };
}

// ── Provenance roll-up ────────────────────────────────────────────────
function rollUpProvenance(draft: {
  work_performed: ReadonlyArray<DraftedDailyLogBullet>;
  issues: ReadonlyArray<DraftedDailyLogBullet>;
  visitors: ReadonlyArray<DraftedDailyLogBullet>;
}): DraftedDailyLog['provenance'] {
  const counts = new Map<string, { count: number; refs: string[] }>();
  const all = [...draft.work_performed, ...draft.issues, ...draft.visitors];
  for (const b of all) {
    for (const s of b.sources) {
      const e = counts.get(s.kind) ?? { count: 0, refs: [] };
      e.count += 1;
      if (s.ref && e.refs.length < 5) e.refs.push(s.ref);
      counts.set(s.kind, e);
    }
  }
  return Array.from(counts.entries()).map(([kind, v]) => ({
    kind: kind as DraftedDailyLog['provenance'][number]['kind'],
    count: v.count,
    sample_refs: v.refs.length ? v.refs.join(',') : undefined,
  }));
}

// ── Public assembler ─────────────────────────────────────────────────
export interface AssembleOptions {
  /** Identifier of the model that produced the draft, e.g. 'claude-sonnet-4-6'. */
  generated_by?: string;
}

export function assembleDailyLogDraft(
  ctx: DayContext,
  opts: AssembleOptions = {},
): DraftedDailyLog {
  const w = buildWeatherSummary(ctx.weather);
  const mp = buildManpower(ctx.crews);
  const wp = buildWorkPerformed(ctx);
  const iss = buildIssues(ctx);
  const vis = buildVisitors(ctx);

  const partial_reasons: Partial<Record<DraftedDailyLogSectionId, string>> = {};
  if (w.reason) partial_reasons.weather = w.reason;
  if (mp.reason) partial_reasons.manpower = mp.reason;
  if (wp.reason) partial_reasons.work_performed = wp.reason;
  if (iss.reason) partial_reasons.issues = iss.reason;
  if (vis.reason) partial_reasons.visitors = vis.reason;

  const draft: DraftedDailyLog = {
    date: ctx.date,
    timezone: ctx.timezone,
    weather: w.weather,
    weather_summary: w.summary,
    manpower: mp.crews,
    manpower_total: mp.total,
    work_performed: wp.bullets,
    issues: iss.bullets,
    visitors: vis.bullets,
    partial: Object.keys(partial_reasons).length > 0,
    partial_reasons,
    provenance: [],
    generated_by: opts.generated_by ?? 'claude-sonnet-4-6',
  };

  // Compute provenance after the bullets are finalized (immutable copy).
  return {
    ...draft,
    provenance: rollUpProvenance({
      work_performed: draft.work_performed,
      issues: draft.issues,
      visitors: draft.visitors,
    }),
  };
}
