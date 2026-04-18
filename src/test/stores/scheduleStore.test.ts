import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../services/scheduleService', () => ({
  scheduleService: {
    loadPhases: vi.fn(),
    createPhase: vi.fn(),
    updatePhase: vi.fn(),
    transitionStatus: vi.fn(),
    deletePhase: vi.fn(),
    updateDependencies: vi.fn(),
    loadMilestones: vi.fn(),
  },
}));

import { useScheduleStore, type SchedulePhase } from '../../stores/scheduleStore';
import { scheduleService } from '../../services/scheduleService';

const PROJECT_ID = 'proj-test';

const QUERY_KEY = ['schedule_phases_mapped', PROJECT_ID];

const mockPhase: SchedulePhase = {
  id: 'ph-1',
  name: 'Foundation',
  project_id: PROJECT_ID,
  start_date: '2026-03-01',
  end_date: '2026-04-01',
  percent_complete: 50,
  status: 'in_progress',
  is_critical_path: false,
  float_days: 0,
  baseline_start: null,
  baseline_end: null,
  earned_value: null,
  assigned_crew_id: null,
  dependencies: null,
  depends_on: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
  baseline_start_date: null,
  baseline_end_date: null,
  baseline_percent_complete: null,
  is_milestone: null,
  predecessor_ids: null,
  work_type: null,
  location: null,
  assigned_trade: null,
  planned_labor_hours: null,
  actual_labor_hours: null,
  baseline_finish: null,
  baseline_duration_days: null,
  slippage_days: 0,
  is_critical: false,
  startDate: '2026-03-01',
  endDate: '2026-04-01',
  progress: 50,
  critical: false,
  completed: false,
  baselineStartDate: null,
  baselineEndDate: null,
  baselineProgress: 0,
  slippageDays: 0,
  earnedValue: 0,
  isOnCriticalPath: false,
  floatDays: 0,
  scheduleVarianceDays: 0,
  isMilestone: false,
  predecessorIds: [],
  plannedLaborHours: 0,
  actualLaborHours: 0,
};

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(scheduleService.loadPhases).mockResolvedValue({ data: [], error: null });
});

// ── updatePhase ────────────────────────────────────────────────────────────────

describe('useScheduleStore.updatePhase', () => {
  it('applies optimistic cache update before service resolves', async () => {
    const qc = makeClient();
    qc.setQueryData(QUERY_KEY, [mockPhase]);

    const { result } = renderHook(() => useScheduleStore(), { wrapper: makeWrapper(qc) });

    // Prime the active project
    await act(async () => { await result.current.loadSchedule(PROJECT_ID); });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(scheduleService.updatePhase).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof scheduleService.updatePhase>,
    );

    act(() => {
      void result.current.updatePhase('ph-1', { name: 'Updated Foundation' });
    });

    const cached = qc.getQueryData<SchedulePhase[]>(QUERY_KEY);
    expect(cached?.[0].name).toBe('Updated Foundation');

    resolveService({ data: null, error: null });
  });

  it('restores cache snapshot when updatePhase service returns error', async () => {
    const qc = makeClient();
    qc.setQueryData(QUERY_KEY, [mockPhase]);

    const { result } = renderHook(() => useScheduleStore(), { wrapper: makeWrapper(qc) });
    await act(async () => { await result.current.loadSchedule(PROJECT_ID); });

    vi.mocked(scheduleService.updatePhase).mockResolvedValue({ data: null, error: 'Service error' });

    await act(async () => {
      await result.current.updatePhase('ph-1', { name: 'Updated Foundation' });
    });

    const cached = qc.getQueryData<SchedulePhase[]>(QUERY_KEY);
    expect(cached?.[0].name).toBe('Foundation');
  });
});

// ── deletePhase ────────────────────────────────────────────────────────────────

describe('useScheduleStore.deletePhase', () => {
  it('removes phase from cache optimistically', async () => {
    const qc = makeClient();
    qc.setQueryData(QUERY_KEY, [mockPhase]);

    const { result } = renderHook(() => useScheduleStore(), { wrapper: makeWrapper(qc) });
    await act(async () => { await result.current.loadSchedule(PROJECT_ID); });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(scheduleService.deletePhase).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof scheduleService.deletePhase>,
    );

    act(() => {
      void result.current.deletePhase('ph-1');
    });

    const cached = qc.getQueryData<SchedulePhase[]>(QUERY_KEY);
    expect(cached).toHaveLength(0);

    resolveService({ data: null, error: null });
  });

  it('restores phase in cache when deletePhase service returns error', async () => {
    const qc = makeClient();
    qc.setQueryData(QUERY_KEY, [mockPhase]);

    const { result } = renderHook(() => useScheduleStore(), { wrapper: makeWrapper(qc) });
    await act(async () => { await result.current.loadSchedule(PROJECT_ID); });

    vi.mocked(scheduleService.deletePhase).mockResolvedValue({ data: null, error: 'Delete failed' });

    await act(async () => {
      await result.current.deletePhase('ph-1');
    });

    const cached = qc.getQueryData<SchedulePhase[]>(QUERY_KEY);
    expect(cached).toHaveLength(1);
    expect(cached?.[0].id).toBe('ph-1');
  });
});

// ── transitionStatus ───────────────────────────────────────────────────────────

describe('useScheduleStore.transitionStatus', () => {
  it('applies optimistic status transition in cache', async () => {
    const qc = makeClient();
    qc.setQueryData(QUERY_KEY, [mockPhase]);

    const { result } = renderHook(() => useScheduleStore(), { wrapper: makeWrapper(qc) });
    await act(async () => { await result.current.loadSchedule(PROJECT_ID); });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(scheduleService.transitionStatus).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof scheduleService.transitionStatus>,
    );

    act(() => {
      void result.current.transitionStatus('ph-1', 'completed');
    });

    const cached = qc.getQueryData<SchedulePhase[]>(QUERY_KEY);
    expect(cached?.[0].status).toBe('completed');

    resolveService({ data: null, error: null });
  });

  it('rolls back status when transitionStatus service returns error', async () => {
    const qc = makeClient();
    qc.setQueryData(QUERY_KEY, [mockPhase]);

    const { result } = renderHook(() => useScheduleStore(), { wrapper: makeWrapper(qc) });
    await act(async () => { await result.current.loadSchedule(PROJECT_ID); });

    vi.mocked(scheduleService.transitionStatus).mockResolvedValue({ data: null, error: 'Invalid transition' });

    await act(async () => {
      await result.current.transitionStatus('ph-1', 'completed');
    });

    const cached = qc.getQueryData<SchedulePhase[]>(QUERY_KEY);
    expect(cached?.[0].status).toBe('in_progress');
  });
});

// ── updateDependencies ─────────────────────────────────────────────────────────

describe('useScheduleStore.updateDependencies', () => {
  it('applies dependency update optimistically', async () => {
    const qc = makeClient();
    qc.setQueryData(QUERY_KEY, [mockPhase]);

    const { result } = renderHook(() => useScheduleStore(), { wrapper: makeWrapper(qc) });
    await act(async () => { await result.current.loadSchedule(PROJECT_ID); });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(scheduleService.updateDependencies).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof scheduleService.updateDependencies>,
    );

    act(() => {
      void result.current.updateDependencies('ph-1', ['ph-0']);
    });

    const cached = qc.getQueryData<SchedulePhase[]>(QUERY_KEY);
    expect(cached?.[0].predecessorIds).toEqual(['ph-0']);
    expect(cached?.[0].depends_on).toBe('ph-0');

    resolveService({ data: null, error: null });
  });
});
