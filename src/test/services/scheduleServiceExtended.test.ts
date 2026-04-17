import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();
const mockGetSession = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession() },
  },
}));

import { scheduleService, wouldCreateCycle } from '../../services/scheduleService';

// ---------------------------------------------------------------------------
// Chain builder
// ---------------------------------------------------------------------------
function makeChain(
  listData: unknown[] | null = [],
  error: { message: string } | null = null,
  singleData?: unknown,
) {
  const singleResult = {
    data: singleData ?? (Array.isArray(listData) && listData.length > 0 ? listData[0] : null),
    error,
  };
  const listResult = { data: listData, error };

  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(singleResult);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject);
  return chain;
}

function mockSession(userId = 'user-1') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } });
}

// ---------------------------------------------------------------------------
// wouldCreateCycle — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('wouldCreateCycle', () => {
  it('returns false for empty predecessor list', () => {
    const phases = [{ id: 'a', depends_on: null }, { id: 'b', depends_on: null }];
    expect(wouldCreateCycle('a', [], phases)).toBe(false);
  });

  it('returns false for a simple linear chain (a → b, adding a → c)', () => {
    // b depends on a: b → a
    // we're adding a → c (a has c as predecessor)
    const phases = [
      { id: 'a', depends_on: null },
      { id: 'b', depends_on: 'a' },
      { id: 'c', depends_on: null },
    ];
    expect(wouldCreateCycle('a', ['c'], phases)).toBe(false);
  });

  it('detects direct cycle: a depends on b, then trying to make b depend on a', () => {
    // existing: a depends on b (a → b)
    const phases = [
      { id: 'a', depends_on: 'b' },
      { id: 'b', depends_on: null },
    ];
    // now trying to make b depend on a (b → a) would create a → b → a cycle
    expect(wouldCreateCycle('b', ['a'], phases)).toBe(true);
  });

  it('detects transitive cycle: a→b→c, trying to add c→a', () => {
    const phases = [
      { id: 'a', depends_on: 'b' },
      { id: 'b', depends_on: 'c' },
      { id: 'c', depends_on: null },
    ];
    // adding c → a: a is already reachable from c through a→b→c chain
    expect(wouldCreateCycle('c', ['a'], phases)).toBe(true);
  });

  it('returns false for new independent node', () => {
    const phases = [
      { id: 'a', depends_on: 'b' },
      { id: 'b', depends_on: 'c' },
      { id: 'c', depends_on: null },
      { id: 'd', depends_on: null },
    ];
    // adding d → c is fine
    expect(wouldCreateCycle('d', ['c'], phases)).toBe(false);
  });

  it('uses dependencies array when present', () => {
    // b has both depends_on and dependencies; a is in neither
    const phases = [
      { id: 'a', depends_on: null, dependencies: ['b', 'c'] },
      { id: 'b', depends_on: null, dependencies: null },
      { id: 'c', depends_on: null, dependencies: null },
    ];
    // trying to add b → a: a already depends on b via dependencies[]
    expect(wouldCreateCycle('b', ['a'], phases)).toBe(true);
  });

  it('self-cycle: phase depending on itself', () => {
    const phases = [{ id: 'a', depends_on: null }];
    expect(wouldCreateCycle('a', ['a'], phases)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scheduleService.detectResourceConflicts
// ---------------------------------------------------------------------------

describe('scheduleService.detectResourceConflicts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns conflicting phases with same crew and overlapping dates', async () => {
    const conflictPhase = {
      id: 'ph-conflict',
      name: 'Framing',
      start_date: '2026-05-10',
      end_date: '2026-05-20',
      assigned_crew_id: 'crew-1',
    };
    const chain = makeChain([conflictPhase]);
    mockFrom.mockReturnValue(chain);

    const result = await scheduleService.detectResourceConflicts(
      'proj-1', 'crew-1', '2026-05-15', '2026-05-25',
    );

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect((result.data![0] as Record<string, unknown>)['id']).toBe('ph-conflict');
  });

  it('excludes phase matching excludePhaseId', async () => {
    const phase = { id: 'ph-self', name: 'Self', start_date: '2026-05-10', end_date: '2026-05-20' };
    const chain = makeChain([phase]);
    mockFrom.mockReturnValue(chain);

    const result = await scheduleService.detectResourceConflicts(
      'proj-1', 'crew-1', '2026-05-15', '2026-05-25', 'ph-self',
    );

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it('returns empty array when no conflicts', async () => {
    const chain = makeChain([]);
    mockFrom.mockReturnValue(chain);

    const result = await scheduleService.detectResourceConflicts(
      'proj-1', 'crew-1', '2026-05-15', '2026-05-25',
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it('returns error on Supabase failure', async () => {
    const chain = makeChain(null, { message: 'db error' });
    mockFrom.mockReturnValue(chain);

    const result = await scheduleService.detectResourceConflicts(
      'proj-1', 'crew-1', '2026-05-15', '2026-05-25',
    );

    expect(result.data).toBeNull();
    expect(result.error).toBe('db error');
  });
});

// ---------------------------------------------------------------------------
// scheduleService.getGanttData
// ---------------------------------------------------------------------------

describe('scheduleService.getGanttData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns GanttTask array with required fields', async () => {
    const dbPhase = {
      id: 'ph-1',
      name: 'Foundation',
      start_date: '2026-05-01',
      end_date: '2026-06-01',
      percent_complete: 50,
      dependencies: ['ph-0'],
      is_critical_path: true,
      is_milestone: false,
      status: 'in_progress',
      assigned_crew_id: 'crew-1',
      float_days: 2,
      task_status: null,
    };
    const chain = makeChain([dbPhase]);
    mockFrom.mockReturnValue(chain);

    const result = await scheduleService.getGanttData('proj-1');

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);

    const task = result.data![0];
    expect(task.id).toBe('ph-1');
    expect(task.name).toBe('Foundation');
    expect(task.start).toBe('2026-05-01');
    expect(task.end).toBe('2026-06-01');
    expect(task.progress).toBe(50);
    expect(task.dependencies).toEqual(['ph-0']);
    expect(task.isCritical).toBe(true);
    expect(task.isMilestone).toBe(false);
    expect(task.status).toBe('in_progress');
    expect(task.assignedCrewId).toBe('crew-1');
    expect(task.floatDays).toBe(2);
  });

  it('defaults to empty arrays/nulls for missing optional fields', async () => {
    const dbPhase = {
      id: 'ph-2',
      name: 'Electrical',
      start_date: null,
      end_date: null,
      percent_complete: null,
      dependencies: null,
      is_critical_path: null,
      is_milestone: null,
      status: null,
      assigned_crew_id: null,
      float_days: null,
      task_status: null,
    };
    const chain = makeChain([dbPhase]);
    mockFrom.mockReturnValue(chain);

    const result = await scheduleService.getGanttData('proj-1');

    const task = result.data![0];
    expect(task.start).toBe('');
    expect(task.end).toBe('');
    expect(task.progress).toBe(0);
    expect(task.dependencies).toEqual([]);
    expect(task.isCritical).toBe(false);
    expect(task.floatDays).toBe(0);
    expect(task.status).toBe('planned');
  });

  it('returns error on Supabase failure', async () => {
    const chain = makeChain(null, { message: 'connection lost' });
    mockFrom.mockReturnValue(chain);

    const result = await scheduleService.getGanttData('proj-1');

    expect(result.data).toBeNull();
    expect(result.error).toBe('connection lost');
  });
});

// ---------------------------------------------------------------------------
// scheduleService.reorderPhases
// ---------------------------------------------------------------------------

describe('scheduleService.reorderPhases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates sort_order for each phase in order', async () => {
    mockSession('user-1');
    const chains: ReturnType<typeof makeChain>[] = [];

    mockFrom.mockImplementation(() => {
      const chain = makeChain([], null, null);
      chains.push(chain);
      return chain;
    });

    const result = await scheduleService.reorderPhases('proj-1', ['ph-a', 'ph-b', 'ph-c']);

    expect(result.error).toBeNull();
    // One call per phase
    expect(chains).toHaveLength(3);

    // Verify sort_order 0, 1, 2 were set
    for (let i = 0; i < 3; i++) {
      const updateFn = chains[i].update as ReturnType<typeof vi.fn>;
      const payload = updateFn.mock.calls[0][0] as Record<string, unknown>;
      expect(payload['sort_order']).toBe(i);
      expect(payload['updated_by']).toBe('user-1');
    }
  });

  it('returns error immediately on first failure', async () => {
    mockSession('user-1');

    mockFrom.mockReturnValue(makeChain(null, { message: 'write denied' }));

    const result = await scheduleService.reorderPhases('proj-1', ['ph-a', 'ph-b']);

    expect(result.error).toBe('write denied');
  });
});

// ---------------------------------------------------------------------------
// scheduleService.approvePhase / transitionTaskStatus
// ---------------------------------------------------------------------------

describe('scheduleService.approvePhase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves a completed phase for project_manager', async () => {
    mockSession('pm-1');

    const fetchChain = makeChain([], null, { task_status: 'completed', project_id: 'proj-1' });
    const roleChain = makeChain([], null, { role: 'project_manager' });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq });

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn });

    const result = await scheduleService.approvePhase('ph-1');

    expect(result.error).toBeNull();
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ task_status: 'approved', updated_by: 'pm-1' }),
    );
  });

  it('blocks approval from superintendent role', async () => {
    mockSession('super-1');

    const fetchChain = makeChain([], null, { task_status: 'completed', project_id: 'proj-1' });
    const roleChain = makeChain([], null, { role: 'superintendent' });

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain);

    const result = await scheduleService.approvePhase('ph-1');

    expect(result.error).toContain('Invalid task transition');
  });

  it('blocks approval from viewer role', async () => {
    mockSession('viewer-1');

    const fetchChain = makeChain([], null, { task_status: 'completed', project_id: 'proj-1' });
    const roleChain = makeChain([], null, { role: 'viewer' });

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain);

    const result = await scheduleService.approvePhase('ph-1');

    expect(result.error).toContain('Invalid task transition');
  });

  it('returns error when user is not a project member', async () => {
    mockSession('outsider');

    const fetchChain = makeChain([], null, { task_status: 'completed', project_id: 'proj-1' });
    const roleChain = makeChain([], null, null);

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain);

    const result = await scheduleService.approvePhase('ph-1');

    expect(result.error).toBe('User is not a member of this project');
  });
});
