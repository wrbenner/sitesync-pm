// TODO: Migrate to entityStore — see src/stores/entityStore.ts
import { create } from 'zustand';
import { dailyLogService } from '../services/dailyLogService';
import type { DailyLog, DailyLogEntry } from '../types/entities';
import type { DailyLogStatus } from '../types/database';
import type { CaptureType } from '../services/dailyLogService';

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
  loadTodayLog: (projectId: string) => Promise<{ error: string | null }>;
  addCapture: (logId: string, type: CaptureType, data: Record<string, unknown>) => Promise<{ error: string | null }>;
  approveLog: (logId: string) => Promise<{ error: string | null }>;
  updateLogStatus: (logId: string, status: DailyLogStatus) => Promise<{ error: string | null }>;
  refreshWeather: (logId: string, projectId: string) => Promise<{ error: string | null }>;
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
    const { data, error } = await dailyLogService.listLogs(projectId);
    if (error) {
      set({ error, loading: false });
      return;
    }
    const logs: DailyLogSummary[] = (data ?? []).map((d) => ({
      id: d.id,
      date: d.log_date,
      workers: 0,
      manHours: 0,
      incidents: 0,
      weather: d.weather ?? 'N/A',
      summary: d.ai_summary ?? '',
      status: d.status as DailyLogStatus,
    }));
    set({ logs, loading: false });
  },

  loadTodayLog: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await dailyLogService.loadTodayLog(projectId);
    if (error) {
      set({ error, loading: false });
      return { error };
    }
    set({ currentLog: data, loading: false });

    if (data) {
      const { data: entryList } = await dailyLogService.loadEntries(data.id);
      set({ entries: entryList ?? [] });
    }

    return { error: null };
  },

  addCapture: async (logId, type, data) => {
    const { data: entry, error } = await dailyLogService.addCapture(logId, type, data);
    if (error) return { error };
    if (entry) {
      set((s) => ({ entries: [...s.entries, entry] }));
    }
    return { error: null };
  },

  approveLog: async (logId) => {
    const { error } = await dailyLogService.approveLog(logId);
    if (error) return { error };
    set((s) => ({
      currentLog: s.currentLog?.id === logId ? { ...s.currentLog, status: 'approved' as DailyLogStatus } : s.currentLog,
      logs: s.logs.map((l) => (l.id === logId ? { ...l, status: 'approved' as DailyLogStatus } : l)),
    }));
    return { error: null };
  },

  updateLogStatus: async (logId, status) => {
    if (status === 'approved') {
      return get().approveLog(logId);
    }
    const { error } = await dailyLogService.updateStatus(logId, status);
    if (error) return { error };
    set((s) => ({
      currentLog: s.currentLog?.id === logId ? { ...s.currentLog, status } : s.currentLog,
      logs: s.logs.map((l) => (l.id === logId ? { ...l, status } : l)),
    }));
    return { error: null };
  },

  refreshWeather: async (logId, projectId) => {
    const { error } = await dailyLogService.refreshWeather(logId, projectId);
    return { error };
  },

  getLogByDate: (date) => {
    return get().logs.find((l) => l.date === date);
  },
}));
