// ── DraftedDailyLog types ──────────────────────────────────────────────────
// Tab A: structured shape of an AI-drafted daily log. Stored as the
// payload of a drafted_actions row with action_type='daily_log.draft'.
//
// Five sections that map 1:1 to the AIA G701 daily report format:
//   1. Weather & Conditions
//   2. Manpower
//   3. Work Performed
//   4. Issues / Delays
//   5. Visitors / Inspections
//
// Every bullet carries provenance — which capture / schedule row / RFI it
// came from — so an owner contesting a daily log six months later can
// audit-trace the source.
//
// Re-running the draft on the same day is idempotent: the edge function
// looks up the existing pending draft (UNIQUE partial index in migration
// 20260430130000) and updates the payload in place.

/** Tag identifying which side of the data pipeline produced a piece of
 *  text. Used for provenance + the "(none recorded)" fallback strings. */
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
  | 'fallback';

/** A single bullet inside Work Performed / Issues / Visitors. */
export interface DraftedDailyLogBullet {
  text: string;
  /** Source data point(s) this bullet was derived from. */
  sources: ReadonlyArray<{
    kind: DraftSource;
    /** Stable id of the source resource (photo id, RFI id, etc.). */
    ref?: string;
    /** Direct quote / extracted snippet, when applicable. */
    snippet?: string;
  }>;
  /** Optional CSI cost code (six-digit format with spaces, e.g. '03 30 00'). */
  cost_code?: string;
  /** 0..1 confidence in the cost-code inference; below 0.6 we drop the code. */
  cost_code_confidence?: number;
}

/** Manpower table row, one per (trade, sub) pair. */
export interface DraftedDailyLogCrewRow {
  trade: string;
  sub_company?: string;
  count: number;
  /** Total hours across the crew for the day (count × hours each). */
  hours?: number;
  /** Soft signal: 'observed' = check-ins recorded; 'scheduled' = roster
   *  fallback when no check-ins arrived (subs didn't use the app). */
  source: 'crew_check_in' | 'roster_scheduled';
}

/** Weather snapshot. weather_source 'observed' = pulled from the
 *  historical weather record; 'forecast' is allowed only when the day
 *  is still in progress and we explicitly say so in the bullet. */
export interface DraftedDailyLogWeather {
  condition: string;
  high_temp_f?: number;
  low_temp_f?: number;
  precipitation_in?: number;
  wind_mph?: number;
  weather_source: 'observed' | 'forecast' | 'manual' | 'unknown';
}

/** The full draft. */
export interface DraftedDailyLog {
  /** ISO YYYY-MM-DD in the project's timezone. */
  date: string;
  /** Set to 'project_local' when the timestamp interpretation matters. */
  timezone: string;

  weather: DraftedDailyLogWeather;
  weather_summary: string;

  manpower: ReadonlyArray<DraftedDailyLogCrewRow>;
  manpower_total: number;

  work_performed: ReadonlyArray<DraftedDailyLogBullet>;
  issues: ReadonlyArray<DraftedDailyLogBullet>;
  visitors: ReadonlyArray<DraftedDailyLogBullet>;

  /** True when the draft was assembled with at least one missing input
   *  category (no photos, no inspector record, etc.). The UI uses this
   *  to render a "partial draft — please review" badge. */
  partial: boolean;

  /** Per-section reasons we couldn't fully populate, e.g.
   *  { work_performed: 'No photos captured today.' } */
  partial_reasons: Partial<Record<DraftedDailyLogSectionId, string>>;

  /** Provenance footnote — surfaced in the audit export. */
  provenance: ReadonlyArray<{
    kind: DraftSource;
    count: number;
    /** Comma-joined ids; truncated for readability. */
    sample_refs?: string;
  }>;

  /** Model identifier that produced this draft, for the audit trail. */
  generated_by: string;
}

export type DraftedDailyLogSectionId =
  | 'weather'
  | 'manpower'
  | 'work_performed'
  | 'issues'
  | 'visitors';

/** Aggregate input the section builder consumes. The edge function and
 *  any future Iris-driven path both produce a DayContext from raw
 *  Supabase queries before invoking the section builder. */
export interface DayContext {
  project_id: string;
  date: string;
  timezone: string;

  weather: DraftedDailyLogWeather | null;

  /** Already-resolved crew rows; either from check-ins or roster fallback. */
  crews: ReadonlyArray<DraftedDailyLogCrewRow>;

  /** Photo captions (already vision-captioned) with optional drawing pin
   *  references for cost-code inference. */
  photos: ReadonlyArray<{
    id: string;
    caption: string;
    drawing_id?: string;
    pinned_zone?: string;
  }>;

  /** Free-form voice / text captures from the field. */
  captures: ReadonlyArray<{
    id: string;
    text: string;
    kind: 'voice' | 'text' | 'observation';
  }>;

  /** RFIs that were filed today or had a status transition. */
  rfis_today: ReadonlyArray<{
    id: string;
    number: number;
    title: string;
    /** 'filed' | 'answered' | 'reopened' | 'closed'. */
    event: string;
  }>;

  /** Action items raised at meetings held today. */
  meeting_action_items: ReadonlyArray<{
    id: string;
    description: string;
    meeting_title?: string;
  }>;

  /** Schedule rows that moved today (% complete delta or status change). */
  schedule_events: ReadonlyArray<{
    id: string;
    title: string;
    delta_percent?: number;
    new_status?: string;
  }>;

  /** Inspection records logged today. */
  inspections: ReadonlyArray<{
    id: string;
    inspector?: string;
    type: string;
    result?: 'pass' | 'fail' | 'pending';
    notes?: string;
  }>;

  /** Material deliveries (omit when the table doesn't exist). */
  deliveries: ReadonlyArray<{
    id: string;
    item: string;
    quantity?: number;
    sub?: string;
  }>;
}
