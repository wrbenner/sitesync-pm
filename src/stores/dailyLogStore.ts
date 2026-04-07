import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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

export const useDailyLogStore = create<DailyLogState>()((set, get) => ({
  logs: [],
  currentLog: null,
  entries: [],
  loading: false,
  error: null,

  loadLogs: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false });

      if (error) throw error;
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
    const { error } = await supabase.from('daily_logs').insert({
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
    const { error } = await supabase.from('daily_logs').update({ status, updated_at: new Date().toISOString() }).eq('id', logId);
    if (!error) {
      set((s) => ({
        logs: s.logs.map((l) => (l.id === logId ? { ...l, status } : l)),
      }));
    }
    return { error: error?.message ?? null };
  },

  addEntry: async (logId, entryType, data) => {
    const { error } = await supabase.from('daily_log_entries').insert({
      daily_log_id: logId,
      entry_type: entryType,
      data,
    });

    return { error: error?.message ?? null };
  },

  signAndSubmit: async (logId, signatureUrl) => {
    const { error } = await supabase.from('daily_logs').update({
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
