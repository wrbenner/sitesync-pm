import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleService } from './scheduleService';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

import { supabase } from '../lib/supabase';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  auth: { getSession: ReturnType<typeof vi.fn> };
};

function makeChain(resolved: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(resolved),
    single: vi.fn().mockResolvedValue(resolved),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
});

describe('scheduleService.loadPhases', () => {
  it('returns active phases on success', async () => {
    const phases = [{ id: 'ph-1', status: 'planned', deleted_at: null }];
    mockSupabase.from.mockReturnValue(makeChain({ data: phases, error: null }));

    const result = await scheduleService.loadPhases('proj-1');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(phases);
  });

  it('returns empty array when no phases', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: null, error: null }));

    const result = await scheduleService.loadPhases('proj-1');
    expect(result.data).toEqual([]);
  });

  it('returns error string on db failure', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: null, error: { message: 'timeout' } }));

    const result = await scheduleService.loadPhases('proj-1');
    expect(result.data).toBeNull();
    expect(result.error).toBe('timeout');
  });
});

describe('scheduleService.loadMilestones', () => {
  it('filters only is_milestone phases in memory', async () => {
    const phases = [
      { id: 'ph-1', is_milestone: true },
      { id: 'ph-2', is_milestone: false },
      { id: 'ph-3', is_milestone: true },
    ];
    mockSupabase.from.mockReturnValue(makeChain({ data: phases, error: null }));

    const result = await scheduleService.loadMilestones('proj-1');
    expect(result.data).toHaveLength(2);
    expect((result.data as { id: string }[]).map((p) => p.id)).toEqual(['ph-1', 'ph-3']);
  });

  it('returns empty array when no milestones', async () => {
    const phases = [{ id: 'ph-1', is_milestone: false }];
    mockSupabase.from.mockReturnValue(makeChain({ data: phases, error: null }));

    const result = await scheduleService.loadMilestones('proj-1');
    expect(result.data).toEqual([]);
  });
});

describe('scheduleService.createPhase', () => {
  it('creates phase with planned status and provenance', async () => {
    const created = { id: 'ph-new', status: 'planned', created_by: 'user-1' };
    const chain = makeChain({ data: created, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const result = await scheduleService.createPhase({
      project_id: 'proj-1',
      name: 'Foundation',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual(created);
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.status).toBe('planned');
    expect(insertArg.created_by).toBe('user-1');
  });

  it('defaults percent_complete to 0', async () => {
    const chain = makeChain({ data: { id: 'ph-new' }, error: null });
    mockSupabase.from.mockReturnValue(chain);

    await scheduleService.createPhase({ project_id: 'proj-1', name: 'Phase' });
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.percent_complete).toBe(0);
  });

  it('returns error on db failure', async () => {
    const chain = makeChain({ data: null, error: { message: 'constraint violation' } });
    mockSupabase.from.mockReturnValue(chain);

    const result = await scheduleService.createPhase({ project_id: 'proj-1', name: 'Phase' });
    expect(result.data).toBeNull();
    expect(result.error).toBe('constraint violation');
  });
});

describe('scheduleService.transitionStatus', () => {
  function setupTransition(
    currentStatus: string,
    role: string,
    updateError: { message: string } | null = null,
  ) {
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'schedule_phases' && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: { status: currentStatus, project_id: 'proj-1' }, error: null }),
        };
      }
      if (table === 'project_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role }, error: null }),
        };
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: updateError }),
      };
    });
  }

  it('allows valid transition for superintendent', async () => {
    setupTransition('planned', 'superintendent');

    const result = await scheduleService.transitionStatus('ph-1', 'in_progress');
    expect(result.error).toBeNull();
  });

  it('blocks invalid transition', async () => {
    setupTransition('planned', 'superintendent');

    const result = await scheduleService.transitionStatus('ph-1', 'completed');
    expect(result.error).toContain('Invalid transition');
  });

  it('blocks transition for viewer role', async () => {
    setupTransition('planned', 'viewer');

    const result = await scheduleService.transitionStatus('ph-1', 'in_progress');
    expect(result.error).toContain('Invalid transition');
  });

  it('blocks reopen for superintendent (only PM+ can reopen)', async () => {
    setupTransition('completed', 'superintendent');

    const result = await scheduleService.transitionStatus('ph-1', 'in_progress');
    expect(result.error).toContain('Invalid transition');
  });

  it('allows reopen for project_manager', async () => {
    setupTransition('completed', 'project_manager');

    const result = await scheduleService.transitionStatus('ph-1', 'in_progress');
    expect(result.error).toBeNull();
  });

  it('returns error when phase not found', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }));

    const result = await scheduleService.transitionStatus('ph-999', 'in_progress');
    expect(result.error).toBe('not found');
  });

  it('returns error when user has no project membership', async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'schedule_phases' && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: { status: 'planned', project_id: 'proj-1' }, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const result = await scheduleService.transitionStatus('ph-1', 'in_progress');
    expect(result.error).toContain('not a member');
  });

  it('sets percent_complete to 100 when completing', async () => {
    let callCount = 0;
    const updateChain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'schedule_phases' && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: { status: 'in_progress', project_id: 'proj-1' }, error: null }),
        };
      }
      if (table === 'project_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role: 'superintendent' }, error: null }),
        };
      }
      return updateChain;
    });

    await scheduleService.transitionStatus('ph-1', 'completed');
    const updateArg = updateChain.update.mock.calls[0][0];
    expect(updateArg.percent_complete).toBe(100);
  });
});

describe('scheduleService.updatePhase', () => {
  it('updates fields and sets updated_by', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await scheduleService.updatePhase('ph-1', { name: 'New Name' });
    expect(result.error).toBeNull();
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.updated_by).toBe('user-1');
  });
});

describe('scheduleService.deletePhase', () => {
  it('soft-deletes by setting deleted_at and deleted_by', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await scheduleService.deletePhase('ph-1');
    expect(result.error).toBeNull();
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.deleted_at).toBeDefined();
    expect(updateArg.deleted_by).toBe('user-1');
  });
});

describe('scheduleService.updateDependencies', () => {
  it('sets depends_on to first predecessor', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await scheduleService.updateDependencies('ph-1', ['ph-a', 'ph-b']);
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.depends_on).toBe('ph-a');
    expect(updateArg.dependencies).toEqual(['ph-a', 'ph-b']);
  });

  it('sets depends_on to null for empty predecessors', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await scheduleService.updateDependencies('ph-1', []);
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.depends_on).toBeNull();
  });
});
