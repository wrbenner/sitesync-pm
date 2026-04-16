import { supabase } from '../lib/supabase';
import { fetchWeatherForProject } from '../lib/weather';
import type { WeatherSnapshot } from '../lib/weather';
import type { DailyLog, DailyLogEntry } from '../types/entities';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
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
   * If a log already exists for today, returns it.
   * Otherwise, creates a new draft log with auto-fetched weather.
   */
  async loadTodayLog(projectId: string): Promise<DailyLogServiceResult<DailyLog>> {
    const today = new Date().toISOString().split('T')[0];

    // Check for existing log
    const { data: existing, error: fetchError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('project_id', projectId)
      .eq('log_date', today)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError.message };
    if (existing) return { data: existing as DailyLog, error: null };

    // Create new log with auto-fetched weather
    const userId = await getCurrentUserId();
    let weather: WeatherSnapshot | null = null;
    try {
      weather = await fetchWeatherForProject(projectId);
    } catch {
      // Weather fetch is non-critical — continue without it
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
        weather_source: weather?.weather_source ?? null,
      })
      .select()
      .single();

    if (createError) return { data: null, error: createError.message };
    return { data: created as DailyLog, error: null };
  },

  /**
   * Add a capture entry to a daily log.
   * Captures are timestamped entries: photos, voice notes, crew counts, safety notes, visitors.
   */
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

  /**
   * Compile all captures into a formatted daily log narrative.
   * Aggregates entries by type and generates a professional summary.
   */
  async compileLog(logId: string): Promise<DailyLogServiceResult<CompiledLog>> {
    // Fetch log and its entries
    const [logRes, entriesRes] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('id', logId).single(),
      supabase.from('daily_log_entries').select('*').eq('daily_log_id', logId).order('created_at'),
    ]);

    if (logRes.error) return { data: null, error: logRes.error.message };
    if (entriesRes.error) return { data: null, error: entriesRes.error.message };

    const log = logRes.data;
    const entries = (entriesRes.data ?? []) as DailyLogEntry[];

    // Group entries by type
    const crews = entries.filter((e) => e.type === 'crew');
    const safetyEntries = entries.filter((e) => e.type === 'safety');
    const visitors = entries.filter((e) => e.type === 'visitor');
    const photos = entries.filter((e) => e.type === 'photo');
    const voiceNotes = entries.filter((e) => e.type === 'voice');
    const notes = entries.filter((e) => e.type === 'note');

    // Weather section
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

    // Workforce section
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

    // Activities section
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

    // Visitors section
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

    // Safety section
    const safetyParts: string[] = [];
    for (const s of safetyEntries) {
      if (s.description) safetyParts.push(s.description);
    }
    const safetyText = safetyParts.length > 0
      ? safetyParts.join('. ') + '.'
      : 'No safety incidents or observations. Toolbox talk conducted.';

    // Photos section
    const photosText = photos.length > 0
      ? `${photos.length} photos captured throughout the day.`
      : 'No photos captured.';

    // Narrative
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
   * Approve a daily log — mark as approved with the current user's ID.
   */
  async approveLog(logId: string): Promise<DailyLogServiceResult> {
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('daily_logs')
      .update({
        status: 'approved',
        approved: true,
        approved_by: userId,
        approved_at: now,
        updated_at: now,
      })
      .eq('id', logId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update the weather data on a daily log (called by auto-refresh).
   */
  async refreshWeather(logId: string, projectId: string): Promise<DailyLogServiceResult<WeatherSnapshot>> {
    let weather: WeatherSnapshot;
    try {
      weather = await fetchWeatherForProject(projectId);
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
        weather_source: weather.weather_source,
        updated_at: new Date().toISOString(),
      })
      .eq('id', logId);

    if (error) return { data: null, error: error.message };
    return { data: weather, error: null };
  },

  /**
   * Load all entries for a specific daily log.
   */
  async loadEntries(logId: string): Promise<DailyLogServiceResult<DailyLogEntry[]>> {
    const { data, error } = await supabase
      .from('daily_log_entries')
      .select('*')
      .eq('daily_log_id', logId)
      .order('created_at');

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DailyLogEntry[], error: null };
  },

  /**
   * Update the AI summary / narrative on a daily log.
   */
  async updateSummary(logId: string, summary: string): Promise<DailyLogServiceResult> {
    const { error } = await supabase
      .from('daily_logs')
      .update({ ai_summary: summary, updated_at: new Date().toISOString() })
      .eq('id', logId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },
};

// ── Utilities ──────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}
