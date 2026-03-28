import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DailyLog, DailyLogEntry, DailyLogStatus } from '../types/database';

export interface DailyLogSummary {
  id: string;
  date: string;
  workers: number;
  manHours: number;
  incidents: number;
  weather: string;
  summary: string;
  status: DailyLogStatus;
}

interface DailyLogState {
  logs: DailyLogSummary[];
  currentLog: DailyLog | null;
  entries: DailyLogEntry[];
  loading: boolean;
  error: string | null;

  loadLogs: (projectId: string) => Promise<void>;
  createLog: (projectId: string, date: string, weather: string, createdBy: string) => Promise<{ error: string | null }>;
  updateLogStatus: (logId: string, status: DailyLogStatus) => Promise<{ error: string | null }>;
  addEntry: (logId: string, entryType: DailyLogEntry['entry_type'], data: Record<string, unknown>) => Promise<{ error: string | null }>;
  signAndSubmit: (logId: string, signatureUrl: string) => Promise<{ error: string | null }>;
  getLogByDate: (date: string) => DailyLogSummary | undefined;
}

const MOCK_LOGS: DailyLogSummary[] = [
  { id: 'dl-1', date: '2026-03-27', workers: 187, manHours: 1496, incidents: 0, weather: '78F Clear', summary: 'Steel erection on floors 6 and 7. MEP rough in progressing on floors 3 through 5. Good weather today.', status: 'draft' },
  { id: 'dl-2', date: '2026-03-26', workers: 192, manHours: 1536, incidents: 1, weather: '72F Cloudy', summary: 'Minor incident during rebar placement. Crew training completed. All safety protocols followed.', status: 'approved' },
  { id: 'dl-3', date: '2026-03-25', workers: 185, manHours: 1480, incidents: 0, weather: '75F Clear', summary: 'Continued structural work. Electrical rough in started on floors 1 and 2.', status: 'approved' },
  { id: 'dl-4', date: '2026-03-24', workers: 188, manHours: 1504, incidents: 0, weather: '68F Rainy', summary: 'Indoor work continued. Steel delivery delay assessed. Recovery plan developed.', status: 'approved' },
  { id: 'dl-5', date: '2026-03-23', workers: 190, manHours: 1520, incidents: 0, weather: '70F Partly Cloudy', summary: 'Exterior work on south facade. Curtain wall installation 55% complete.', status: 'approved' },
];

const MOCK_ENTRIES: DailyLogEntry[] = [
  { id: 'dle-1', daily_log_id: 'dl-1', entry_type: 'manpower', data: { trade: 'Concrete', count: 42, hours: 336 }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-2', daily_log_id: 'dl-1', entry_type: 'manpower', data: { trade: 'Electrical', count: 35, hours: 280 }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-3', daily_log_id: 'dl-1', entry_type: 'manpower', data: { trade: 'Mechanical', count: 28, hours: 224 }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-4', daily_log_id: 'dl-1', entry_type: 'manpower', data: { trade: 'Steel', count: 24, hours: 192 }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-5', daily_log_id: 'dl-1', entry_type: 'manpower', data: { trade: 'Plumbing', count: 18, hours: 144 }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-6', daily_log_id: 'dl-1', entry_type: 'manpower', data: { trade: 'Carpentry', count: 16, hours: 128 }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-7', daily_log_id: 'dl-1', entry_type: 'manpower', data: { trade: 'General Labor', count: 24, hours: 192 }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-8', daily_log_id: 'dl-1', entry_type: 'equipment', data: { name: 'Tower Crane', qty: 1, location: 'Roof', status: 'Operating' }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-9', daily_log_id: 'dl-1', entry_type: 'equipment', data: { name: 'Concrete Pump', qty: 2, location: 'Floor 9', status: 'Active' }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-10', daily_log_id: 'dl-1', entry_type: 'equipment', data: { name: 'Scissor Lifts', qty: 4, location: 'Floors 3 to 5', status: 'Active' }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-11', daily_log_id: 'dl-1', entry_type: 'equipment', data: { name: 'Generator', qty: 1, location: 'Basement', status: 'Standby' }, created_at: '2026-03-27T08:00:00Z' },
  { id: 'dle-12', daily_log_id: 'dl-2', entry_type: 'incident', data: { description: 'Slip/trip incident at Floor 6 stairwell. Worker treated on site. No lost time. Reported by Safety Coordinator. Corrective action: installed additional anti slip tape on all stairwell landings.', severity: 'minor', location: 'Floor 6 Stairwell' }, created_at: '2026-03-26T14:30:00Z' },
];

export const useDailyLogStore = create<DailyLogState>()((set, get) => ({
  logs: [],
  currentLog: null,
  entries: [],
  loading: false,
  error: null,

  loadLogs: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ logs: MOCK_LOGS, entries: MOCK_ENTRIES, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logs: DailyLogSummary[] = (data ?? []).map((d: any) => ({
        id: d.id,
        date: d.log_date,
        workers: 0,
        manHours: 0,
        incidents: 0,
        weather: d.weather_condition || 'N/A',
        summary: d.ai_narrative || '',
        status: d.status,
      }));
      set({ logs, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createLog: async (projectId, date, weather, createdBy) => {
    if (!isSupabaseConfigured) {
      const newLog: DailyLogSummary = {
        id: `dl-${Date.now()}`,
        date,
        workers: 0,
        manHours: 0,
        incidents: 0,
        weather,
        summary: '',
        status: 'draft',
      };
      set((s) => ({ logs: [newLog, ...s.logs] }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('daily_logs') as any).insert({
      project_id: projectId,
      log_date: date,
      weather_condition: weather,
      created_by: createdBy,
      status: 'draft',
    });

    if (error) return { error: error.message };
    await get().loadLogs(projectId);
    return { error: null };
  },

  updateLogStatus: async (logId, status) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        logs: s.logs.map((l) => (l.id === logId ? { ...l, status } : l)),
      }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('daily_logs') as any).update({ status, updated_at: new Date().toISOString() }).eq('id', logId);
    if (!error) {
      set((s) => ({
        logs: s.logs.map((l) => (l.id === logId ? { ...l, status } : l)),
      }));
    }
    return { error: error?.message ?? null };
  },

  addEntry: async (logId, entryType, data) => {
    if (!isSupabaseConfigured) {
      const newEntry: DailyLogEntry = {
        id: `dle-${Date.now()}`,
        daily_log_id: logId,
        entry_type: entryType,
        data,
        created_at: new Date().toISOString(),
      };
      set((s) => ({ entries: [...s.entries, newEntry] }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('daily_log_entries') as any).insert({
      daily_log_id: logId,
      entry_type: entryType,
      data,
    });

    return { error: error?.message ?? null };
  },

  signAndSubmit: async (logId, signatureUrl) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        logs: s.logs.map((l) => (l.id === logId ? { ...l, status: 'submitted' as DailyLogStatus } : l)),
      }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('daily_logs') as any).update({
      status: 'submitted',
      signature_url: signatureUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', logId);

    if (!error) {
      set((s) => ({
        logs: s.logs.map((l) => (l.id === logId ? { ...l, status: 'submitted' as DailyLogStatus } : l)),
      }));
    }
    return { error: error?.message ?? null };
  },

  getLogByDate: (date) => {
    return get().logs.find((l) => l.date === date);
  },
}));
