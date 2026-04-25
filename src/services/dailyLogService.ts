import { supabase } from '../lib/supabase';
import { fetchWeatherForProject } from '../lib/weather';
import type { WeatherSnapshot } from '../lib/weather';
import type { DailyLog, DailyLogEntry } from '../types/entities';
import type { DailyLogState } from '../machines/dailyLogMachine';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function resolveProjectRole(
  projectId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();
  return data?.role ?? null;
}

/**
 * Role-gated daily log transitions derived from dailyLogMachine.
 *
 *   draft        → submitted                (non-viewer)
 *   submitted    → approved / rejected      (gc/owner/admin — approvers)
 *   rejected     → draft / submitted        (non-viewer — edit or resubmit)
 *   approved     → terminal
 */
function getValidDailyLogTransitions(
  status: DailyLogState,
  role: string,
): DailyLogState[] {
  const canApprove = ['project_manager', 'superintendent', 'admin', 'owner'].includes(role);
  const nonViewer = role !== 'viewer';

  switch (status) {
    case 'draft':
      return nonViewer ? ['submitted'] : [];
    case 'submitted':
      return canApprove ? ['approved', 'rejected'] : [];
    case 'rejected':
      return nonViewer ? ['draft', 'submitted'] : [];
    case 'approved':
    case 'amending':
      return [];
    default:
      return [];
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type DailyLogServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

export type CaptureType = 'photo' | 'voice' | 'crew' | 'safety' | 'visitor' | 'note';

export interface CaptureEntry {
  id: string;
  type: CaptureType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface CompiledSection {
  title: string;
  content: string;
  entries: CaptureEntry[];
}

export interface CompiledLog {
  weather: string;
  workforce: string;
  activities: string;
  visitors: string;
  safety: string;
  photos: string;
  narrative: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const dailyLogService = {
  /**
   * Load or create today's daily log for a project.
   */
  async loadTodayLog(projectId: string): Promise<DailyLogServiceResult<DailyLog>> {
    const today = new Date().toISOString().split('T')[0];

    const { data: existingLog, error: fetchError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('project_id', projectId)
      .eq('log_date', today)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError.message };
    if (existingLog) return { data: existingLog as DailyLog, error: null };

    const userId = await getCurrentUserId();
    let weather: WeatherSnapshot | null = null;
    try {
      weather = await fetchWeatherForProject(projectId);
    } catch {
      // Weather fetch is non-critical
    }

    const { data: created, error: createError } = await supabase
      .from('daily_logs')
      .insert({
        project_id: projectId,
        log_date: today,
        created_by: userId,
        status: 'draft',
        weather: weather ? `${weather.conditions}` : null,
        temperature_high: weather?.temperature_high ?? null,
        temperature_low: weather?.temperature_low ?? null,
        wind_speed: weather ? `${weather.wind_speed} mph` : null,
        precipitation: weather ? `${weather.precipitation_probability}%` : null,
      })
      .select()
      .single();

    if (createError) return { data: null, error: createError.message };
    return { data: created as DailyLog, error: null };
  },

  async addCapture(
    logId: string,
    type: CaptureType,
    data: Record<string, unknown>,
  ): Promise<DailyLogServiceResult<DailyLogEntry>> {
    const entryData = {
      daily_log_id: logId,
      type,
      description: (data.description as string) ?? null,
      trade: (data.trade as string) ?? null,
      company: (data.company as string) ?? null,
      headcount: (data.headcount as number) ?? null,
      hours: (data.hours as number) ?? null,
      photos: data.photoUrl ? [data.photoUrl] : null,
      location: (data.location as string) ?? null,
      time_in: (data.time_in as string) ?? null,
      time_out: (data.time_out as string) ?? null,
      inspector_name: (data.inspector_name as string) ?? null,
      inspection_result: (data.inspection_result as string) ?? null,
      condition: (data.condition as string) ?? null,
    };

    const { data: entry, error } = await supabase
      .from('daily_log_entries')
      .insert(entryData)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: entry as DailyLogEntry, error: null };
  },

  async compileLog(logId: string): Promise<DailyLogServiceResult<CompiledLog>> {
    const [logRes, entriesRes] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('id', logId).single(),
      supabase.from('daily_log_entries').select('*').eq('daily_log_id', logId).order('created_at'),
    ]);

    if (logRes.error) return { data: null, error: logRes.error.message };
    if (entriesRes.error) return { data: null, error: entriesRes.error.message };

    const log = logRes.data;
    const entries = (entriesRes.data ?? []) as DailyLogEntry[];

    const crews = entries.filter((e) => e.type === 'crew');
    const safetyEntries = entries.filter((e) => e.type === 'safety');
    const visitors = entries.filter((e) => e.type === 'visitor');
    const photos = entries.filter((e) => e.type === 'photo');
    const voiceNotes = entries.filter((e) => e.type === 'voice');
    const notes = entries.filter((e) => e.type === 'note');

    const weatherParts: string[] = [];
    if (log.temperature_high || log.temperature_low) {
      weatherParts.push(`Temperature: ${log.temperature_low ?? '—'}°F – ${log.temperature_high ?? '—'}°F`);
    }
    if (log.weather) weatherParts.push(`Conditions: ${log.weather}`);
    if (log.wind_speed) weatherParts.push(`Wind: ${log.wind_speed}`);
    if (log.precipitation) weatherParts.push(`Precipitation probability: ${log.precipitation}`);
    const weatherText = weatherParts.length > 0
      ? weatherParts.join('. ') + '.'
      : 'Weather data not available.';

    const totalWorkers = crews.reduce((sum, c) => sum + (c.headcount ?? 0), 0);
    const crewLines = crews.map((c) => {
      const parts = [c.company ?? c.trade ?? 'Unknown'];
      if (c.headcount) parts.push(`${c.headcount} workers`);
      if (c.hours) parts.push(`${c.hours} hours`);
      return parts.join(', ');
    });
    const workforceText = crews.length > 0
      ? `${totalWorkers} workers on site. ${crewLines.join('. ')}.`
      : 'No workforce entries recorded.';

    const activityParts: string[] = [];
    for (const note of voiceNotes) {
      if (note.description) activityParts.push(note.description);
    }
    for (const note of notes) {
      if (note.description) activityParts.push(note.description);
    }
    const activitiesText = activityParts.length > 0
      ? activityParts.join('. ') + '.'
      : 'No activity entries recorded.';

    const visitorLines = visitors.map((v) => {
      const parts = [v.company ?? 'Visitor'];
      if (v.inspector_name) parts[0] = v.inspector_name;
      if (v.time_in) parts.push(`arrived ${formatTime(v.time_in)}`);
      if (v.time_out) parts.push(`departed ${formatTime(v.time_out)}`);
      if (v.description) parts.push(v.description);
      return parts.join(', ');
    });
    const visitorsText = visitors.length > 0
      ? visitorLines.join('. ') + '.'
      : 'No visitors recorded.';

    const safetyParts: string[] = [];
    for (const s of safetyEntries) {
      if (s.description) safetyParts.push(s.description);
    }
    const safetyText = safetyParts.length > 0
      ? safetyParts.join('. ') + '.'
      : 'No safety incidents or observations. Toolbox talk conducted.';

    const photosText = photos.length > 0
      ? `${photos.length} photos captured throughout the day.`
      : 'No photos captured.';

    const dateFmt = new Date(log.log_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const narrative = [
      `Daily Construction Log — ${dateFmt}`,
      '',
      `WEATHER: ${weatherText}`,
      '',
      `WORKFORCE: ${workforceText}`,
      '',
      `WORK PERFORMED: ${activitiesText}`,
      '',
      `VISITORS & INSPECTIONS: ${visitorsText}`,
      '',
      `SAFETY: ${safetyText}`,
      '',
      `PHOTOS: ${photosText}`,
    ].join('\n');

    return {
      data: {
        weather: weatherText,
        workforce: workforceText,
        activities: activitiesText,
        visitors: visitorsText,
        safety: safetyText,
        photos: photosText,
        narrative,
      },
      error: null,
    };
  },

  /**
   * Approve a daily log. Routes through transitionStatus for lifecycle enforcement.
   */
  async approveLog(logId: string): Promise<DailyLogServiceResult> {
    const result = await dailyLogService.transitionStatus(logId, 'approved');
    if (result.error) return { data: null, error: result.error.message };
    return { data: null, error: null };
  },

  async refreshWeather(logId: string, projectId: string, lat?: number, lon?: number): Promise<DailyLogServiceResult<WeatherSnapshot>> {
    let weather: WeatherSnapshot;
    try {
      weather = await fetchWeatherForProject(projectId, lat, lon);
    } catch {
      return { data: null, error: 'Failed to fetch weather' };
    }

    const { error } = await supabase
      .from('daily_logs')
      .update({
        weather: weather.conditions,
        temperature_high: weather.temperature_high,
        temperature_low: weather.temperature_low,
        wind_speed: `${weather.wind_speed} mph`,
        precipitation: `${weather.precipitation_probability}%`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', logId);

    if (error) return { data: null, error: error.message };
    return { data: weather, error: null };
  },

  async loadEntries(logId: string): Promise<DailyLogServiceResult<DailyLogEntry[]>> {
    const { data, error } = await supabase
      .from('daily_log_entries')
      .select('*')
      .eq('daily_log_id', logId)
      .order('created_at');

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DailyLogEntry[], error: null };
  },

  async listLogs(projectId: string): Promise<DailyLogServiceResult<DailyLog[]>> {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('log_date', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DailyLog[], error: null };
  },

  /**
   * Update a daily log's status. Routes through the lifecycle machine so callers
   * cannot bypass role or transition checks.
   */
  async updateStatus(logId: string, status: string): Promise<DailyLogServiceResult> {
    const result = await dailyLogService.transitionStatus(logId, status as DailyLogState);
    if (result.error) return { data: null, error: result.error.message };
    return { data: null, error: null };
  },

  /**
   * Transition daily log status with lifecycle enforcement.
   * Resolves user role from project_members. Does NOT trust caller-supplied roles.
   */
  async transitionStatus(
    logId: string,
    newStatus: DailyLogState,
  ): Promise<{ data: null; error: { message: string } | null }> {
    const { data: log, error: fetchError } = await supabase
      .from('daily_logs')
      .select('status, project_id')
      .eq('id', logId)
      .single();

    if (fetchError || !log) {
      return { data: null, error: { message: `Daily log not found (id: ${logId})` } };
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(log.project_id, userId);
    if (!role) {
      return { data: null, error: { message: 'User is not a member of this project' } };
    }

    const currentStatus = (log.status ?? 'draft') as DailyLogState;
    const valid = getValidDailyLogTransitions(currentStatus, role);
    if (!valid.includes(newStatus)) {
      return {
        data: null,
        error: {
          message: `Invalid daily log transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${valid.join(', ') || '(none)'}`,
        },
      };
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    // Note: is_submitted and submitted_at are NOT real DB columns on daily_logs.
    // Status alone tracks submission state.
    if (newStatus === 'approved') {
      updates.approved = true;
      updates.approved_at = new Date().toISOString();
      updates.approved_by = userId;
    }

    const { error } = await supabase
      .from('daily_logs')
      .update(updates)
      .eq('id', logId);

    if (error) return { data: null, error: { message: error.message } };
    return { data: null, error: null };
  },

  async updateSummary(logId: string, summary: string): Promise<DailyLogServiceResult> {
    const { error } = await supabase
      .from('daily_logs')
      .update({ ai_summary: summary, updated_at: new Date().toISOString() })
      .eq('id', logId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },
};

export { getValidDailyLogTransitions };

// ── Utilities ──────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}
