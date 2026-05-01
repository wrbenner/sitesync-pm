// ─────────────────────────────────────────────────────────────────────────────
// useIrisInsights — Phase 4 hook (proactive risk detection).
// ─────────────────────────────────────────────────────────────────────────────
// Pulls structured inputs from existing project queries, feeds them to the
// pure detector pipeline in src/services/iris/insights.ts, and caches the
// resulting IrisInsight[] for 5 minutes (these aggregates are expensive and
// the project state doesn't change minute-to-minute).
//
// No AI provider calls; the detectors are deterministic. Iris brand wraps
// the OUTPUT (headlines + impact chains) — see insightTemplates.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useRFIs } from './queries/rfis';
import { useSubmittals } from './queries/submittals';
import { useScheduleActivities } from './useScheduleActivities';
import { useWorkforceMembers, useTimeEntries } from './queries/workforce';
import { useBudgetData } from './useBudgetData';
import {
  runInsights,
  type IrisInsight,
  type InsightsInput,
  type RfiRow,
  type SubmittalRow,
  type ScheduleRow,
  type WorkforceCheckIn,
  type WeatherDayForecast,
  type BudgetWeekSnapshot,
} from '../services/iris/insights';

const FIVE_MINUTES = 5 * 60 * 1000;

interface BudgetItemShape {
  committed_amount?: number | null;
  actual_amount?: number | null;
  original_amount?: number | null;
  budget_amount?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
}

function mondayOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Synthesize five week-end snapshots from the live budget total. We don't
// have historical budget snapshots in the schema today, so the variance
// detector falls back to "trend approximated from updated_at distribution".
// When real snapshots land, this is the seam to swap.
function approximateBudgetWeekly(budgetItems: BudgetItemShape[], now: Date): BudgetWeekSnapshot[] {
  if (budgetItems.length === 0) return [];
  const approvedTotal = budgetItems.reduce(
    (a, b) => a + Number(b.original_amount ?? b.budget_amount ?? 0),
    0,
  );
  if (approvedTotal <= 0) return [];

  const totalCommitted = budgetItems.reduce(
    (a, b) => a + Number(b.committed_amount ?? b.actual_amount ?? 0),
    0,
  );

  // Bucket items by the Monday of their last update; running cumulative
  // total at end of each bucket = the week's "committed" snapshot.
  const buckets = new Map<string, number>();
  for (const it of budgetItems) {
    const ts = it.updated_at ?? it.created_at;
    if (!ts) continue;
    const monday = mondayOf(ts);
    const v = Number(it.committed_amount ?? it.actual_amount ?? 0);
    buckets.set(monday, (buckets.get(monday) ?? 0) + v);
  }

  // Walk weeks chronologically, summing buckets up to that point.
  const weeks = Array.from(buckets.keys()).sort();
  if (weeks.length < 2) return [];

  // Trim to the last 8 weeks of activity that lead into "now".
  const nowMonday = mondayOf(now.toISOString());
  const recent = weeks.filter((w) => w <= nowMonday).slice(-8);

  let running = 0;
  const seen = new Set<string>();
  const out: BudgetWeekSnapshot[] = [];
  for (const w of recent) {
    running += buckets.get(w) ?? 0;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push({ weekStart: w, committed: running, approvedTotal });
  }
  // Force the last bucket to match the live total so the "this week" delta
  // tracks reality even when timestamps drift.
  if (out.length > 0) {
    out[out.length - 1] = { ...out[out.length - 1], committed: totalCommitted };
  }
  return out;
}

interface RfiRowApi {
  id: string;
  number?: string | number | null;
  subject?: string | null;
  title?: string | null;
  due_date?: string | null;
  status?: string | null;
  schedule_impact_days?: number | null;
  linked_activity_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

function adaptRfis(rows: unknown[]): RfiRow[] {
  return rows.map((r) => {
    const row = r as RfiRowApi;
    const meta = row.metadata ?? {};
    const linked =
      row.linked_activity_id
      ?? (meta as Record<string, unknown>).linked_activity_id as string | undefined
      ?? null;
    const slip =
      row.schedule_impact_days
      ?? ((meta as Record<string, unknown>).schedule_impact_days as number | undefined)
      ?? null;
    return {
      id: row.id,
      number: row.number ?? null,
      title: row.subject ?? row.title ?? null,
      due_date: row.due_date ?? null,
      status: row.status ?? null,
      schedule_impact_days: slip,
      linked_activity_id: linked,
    };
  });
}

interface SubmittalRowApi {
  id: string;
  number?: string | number | null;
  title?: string | null;
  status?: string | null;
  linked_activity_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

function adaptSubmittals(rows: unknown[]): SubmittalRow[] {
  return rows.map((r) => {
    const row = r as SubmittalRowApi;
    const meta = row.metadata ?? {};
    const linked =
      row.linked_activity_id
      ?? ((meta as Record<string, unknown>).linked_activity_id as string | undefined)
      ?? null;
    return {
      id: row.id,
      number: row.number ?? null,
      title: row.title ?? null,
      status: row.status ?? null,
      linked_activity_id: linked,
      linked_activity_name: null,
    };
  });
}

interface ScheduleApi {
  id: string;
  name: string;
  baseline_end?: string | null;
  end_date?: string | null;
  start_date?: string | null;
  is_critical_path?: boolean | null;
  float_days?: number | null;
  outdoor_activity?: boolean | null;
}

function adaptSchedule(rows: unknown[]): ScheduleRow[] {
  return rows.map((r) => {
    const row = r as ScheduleApi;
    return {
      id: row.id,
      name: row.name,
      baseline_end: row.baseline_end ?? null,
      end_date: row.end_date ?? null,
      start_date: row.start_date ?? null,
      is_critical_path: row.is_critical_path ?? null,
      float_days: row.float_days ?? null,
      outdoor_activity: row.outdoor_activity ?? null,
      // The schedule_phases row doesn't carry trade or per-day required-hour
      // breakdowns in the schema today. The detector treats missing values
      // as "no signal" and skips silently.
      trade: null,
      required_hours_today: null,
    };
  });
}

interface WorkforceMemberApi {
  trade?: string | null;
}

interface TimeEntryApi {
  workforce_member_id?: string | null;
  date?: string | null;
  regular_hours?: number | null;
  overtime_hours?: number | null;
  double_time_hours?: number | null;
}

function adaptWorkforce(
  members: unknown[],
  entries: unknown[],
  now: Date,
): WorkforceCheckIn[] {
  const todayIso = now.toISOString().slice(0, 10);
  const memberTradeById = new Map<string, string>();
  for (const m of members as Array<WorkforceMemberApi & { id?: string }>) {
    if (m.id) memberTradeById.set(m.id, m.trade ?? 'Unassigned');
  }
  const tradeHours = new Map<string, number>();
  for (const e of entries as TimeEntryApi[]) {
    if (e.date !== todayIso) continue;
    const trade = e.workforce_member_id
      ? memberTradeById.get(e.workforce_member_id)
      : undefined;
    if (!trade) continue;
    const hours =
      Number(e.regular_hours ?? 0)
      + Number(e.overtime_hours ?? 0)
      + Number(e.double_time_hours ?? 0);
    tradeHours.set(trade, (tradeHours.get(trade) ?? 0) + hours);
  }
  return Array.from(tradeHours, ([trade, hoursAvailable]) => ({ trade, hoursAvailable }));
}

interface WeatherRecordApi {
  date?: string | null;
  conditions?: string | null;
}

// ── Main hook ────────────────────────────────────────────────────────────────

export interface UseIrisInsightsResult {
  insights: IrisInsight[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useIrisInsights(projectId: string | undefined): UseIrisInsightsResult {
  const rfisQ = useRFIs(projectId);
  const submittalsQ = useSubmittals(projectId);
  const scheduleQ = useScheduleActivities(projectId ?? '');
  const membersQ = useWorkforceMembers(projectId);
  const timeEntriesQ = useTimeEntries(projectId);
  const { budgetItems } = useBudgetData();

  // Weather forecast: fetch the next 14 days on a 5-minute cadence so the
  // detector has fresh data. RLS narrows by project_id at the DB layer.
  const weatherQ = useQuery({
    queryKey: ['iris_insights_weather', projectId],
    enabled: !!projectId,
    staleTime: FIVE_MINUTES,
    queryFn: async (): Promise<WeatherDayForecast[]> => {
      if (!projectId) return [];
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('weather_records')
        .select('date, conditions')
        .eq('project_id', projectId)
        .gte('date', today)
        .lte('date', horizon);
      if (error) return [];
      return ((data ?? []) as WeatherRecordApi[])
        .filter((r): r is { date: string; conditions: string } => !!r.date && typeof r.conditions === 'string')
        .map((r) => ({ date: r.date, conditions: r.conditions }));
    },
  });

  const isLoading =
    rfisQ.isLoading
    || submittalsQ.isLoading
    || scheduleQ.isLoading
    || membersQ.isLoading
    || timeEntriesQ.isLoading
    || weatherQ.isLoading;

  const firstError =
    (rfisQ.error as Error | null)
    ?? (submittalsQ.error as Error | null)
    ?? (scheduleQ.error as Error | null)
    ?? (membersQ.error as Error | null)
    ?? (timeEntriesQ.error as Error | null)
    ?? (weatherQ.error as Error | null)
    ?? null;

  const insights = useMemo<IrisInsight[]>(() => {
    if (!projectId) return [];
    if (isLoading) return [];
    const now = new Date();
    const input: InsightsInput = {
      projectId,
      now,
      rfis: adaptRfis((rfisQ.data?.data ?? []) as unknown[]),
      submittals: adaptSubmittals((submittalsQ.data?.data ?? []) as unknown[]),
      schedule: adaptSchedule((scheduleQ.data ?? []) as unknown[]),
      workforce: adaptWorkforce(
        (membersQ.data ?? []) as unknown[],
        (timeEntriesQ.data ?? []) as unknown[],
        now,
      ),
      weatherForecast: weatherQ.data ?? [],
      budgetWeekly: approximateBudgetWeekly(budgetItems as BudgetItemShape[], now),
    };
    return runInsights(input);
  }, [
    projectId,
    isLoading,
    rfisQ.data,
    submittalsQ.data,
    scheduleQ.data,
    membersQ.data,
    timeEntriesQ.data,
    weatherQ.data,
    budgetItems,
  ]);

  const refetch = () => {
    rfisQ.refetch();
    submittalsQ.refetch();
    scheduleQ.refetch();
    membersQ.refetch();
    timeEntriesQ.refetch();
    weatherQ.refetch();
  };

  return { insights, isLoading, error: firstError, refetch };
}
