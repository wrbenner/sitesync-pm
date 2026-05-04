import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inspectionService } from './inspectionService';

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

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
});

describe('inspectionService.loadInspections', () => {
  it('returns inspections on success', async () => {
    const inspections = [{ id: 'insp-1', title: 'Fire', status: 'scheduled' }];
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: inspections, error: null }),
    });

    const result = await inspectionService.loadInspections('proj-1');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(inspections);
  });

  it('returns empty array when data is null', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await inspectionService.loadInspections('proj-1');
    expect(result.data).toEqual([]);
  });

  it('returns db error on failure', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } }),
    });

    const result = await inspectionService.loadInspections('proj-1');
    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
  });
});

describe('inspectionService.createInspection', () => {
  it('creates inspection with scheduled status and created_by', async () => {
    const created = { id: 'insp-new', status: 'scheduled', created_by: 'user-1' };
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await inspectionService.createInspection({
      project_id: 'proj-1',
      title: 'Framing',
      type: 'structural',
      priority: 'high',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual(created);
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.status).toBe('scheduled');
    expect(insertArg.created_by).toBe('user-1');
  });

  it('defaults nullable fields to null', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'i-1' }, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await inspectionService.createInspection({
      project_id: 'proj-1',
      title: 'Test',
      type: 'electrical',
      priority: 'medium',
    });

    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.description).toBeNull();
    expect(insertArg.scheduled_date).toBeNull();
    expect(insertArg.inspector_id).toBeNull();
  });
});

describe('inspectionService.transitionStatus', () => {
  function setupTransition(currentStatus: string, role: string, updateError: { message: string } | null = null) {
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'inspections' && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { status: currentStatus, project_id: 'proj-1', created_by: 'user-1', inspector_id: null },
            error: null,
          }),
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
    setupTransition('scheduled', 'superintendent');

    const result = await inspectionService.transitionStatus('insp-1', 'in_progress');
    expect(result.error).toBeNull();
  });

  it('blocks invalid transition', async () => {
    setupTransition('scheduled', 'superintendent');

    const result = await inspectionService.transitionStatus('insp-1', 'approved');
    expect(result.error?.category).toBe('ValidationError');
    expect(result.error?.message).toContain('Invalid transition');
  });

  it('blocks transition for viewer role', async () => {
    setupTransition('scheduled', 'viewer');

    const result = await inspectionService.transitionStatus('insp-1', 'in_progress');
    expect(result.error?.category).toBe('ValidationError');
  });

  it('allows approve for project_manager', async () => {
    setupTransition('completed', 'project_manager');

    const result = await inspectionService.transitionStatus('insp-1', 'approved');
    expect(result.error).toBeNull();
  });

  it('blocks approve for superintendent', async () => {
    setupTransition('completed', 'superintendent');

    const result = await inspectionService.transitionStatus('insp-1', 'approved');
    expect(result.error?.category).toBe('ValidationError');
  });

  it('returns not found error when inspection missing', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }));

    const result = await inspectionService.transitionStatus('insp-999', 'in_progress');
    expect(result.error?.category).toBe('NotFoundError');
  });

  it('returns permission error when user not in project', async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'inspections' && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { status: 'scheduled', project_id: 'proj-1', created_by: 'user-1', inspector_id: null },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const result = await inspectionService.transitionStatus('insp-1', 'in_progress');
    expect(result.error?.category).toBe('PermissionError');
  });

  it('sets completed_date when transitioning to completed', async () => {
    let callCount = 0;
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'inspections' && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { status: 'in_progress', project_id: 'proj-1', created_by: 'user-1', inspector_id: null },
            error: null,
          }),
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

    await inspectionService.transitionStatus('insp-1', 'completed');
    const updateArg = updateChain.update.mock.calls[0][0];
    expect(updateArg.completed_date).toBeDefined();
  });
});

describe('inspectionService.updateInspection', () => {
  it('strips status field from updates', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await inspectionService.updateInspection('insp-1', {
      title: 'Updated Title',
      status: 'approved' as never,
    });

    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.status).toBeUndefined();
    expect(updateArg.title).toBe('Updated Title');
    expect(updateArg.updated_by).toBe('user-1');
  });
});

describe('inspectionService.deleteInspection', () => {
  it('soft-deletes by setting deleted_at', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await inspectionService.deleteInspection('insp-1');
    expect(result.error).toBeNull();
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.deleted_at).toBeDefined();
    expect(updateArg.deleted_by).toBe('user-1');
  });
});

describe('inspectionService.loadFindings', () => {
  it('returns findings on success', async () => {
    const findings = [{ id: 'f-1', severity: 'major' }];
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: findings, error: null }),
    });

    const result = await inspectionService.loadFindings('insp-1');
    expect(result.data).toEqual(findings);
  });
});

describe('inspectionService.addFinding', () => {
  it('inserts finding with user_id and returns success', async () => {
    const chain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await inspectionService.addFinding('insp-1', 'Crack in wall', 'major');
    expect(result.error).toBeNull();
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.user_id).toBe('user-1');
    expect(insertArg.description).toBe('Crack in wall');
    expect(insertArg.severity).toBe('major');
  });

  it('returns db error on insert failure', async () => {
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'fk violation' } }),
    });

    const result = await inspectionService.addFinding('insp-1', 'desc', 'minor');
    expect(result.error?.category).toBe('DatabaseError');
    expect(result.error?.message).toContain('Failed to insert finding');
  });
});
