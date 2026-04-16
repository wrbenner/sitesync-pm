import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawingService } from './drawingService';

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

describe('drawingService.loadDrawings', () => {
  it('returns non-archived drawings on success', async () => {
    const drawings = [{ id: 'd-1', status: 'draft', title: 'A-100' }];
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: drawings, error: null }),
    });

    const result = await drawingService.loadDrawings('proj-1');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(drawings);
  });

  it('returns empty array when data is null', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await drawingService.loadDrawings('proj-1');
    expect(result.data).toEqual([]);
  });

  it('returns db error on failure', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'conn refused' } }),
    });

    const result = await drawingService.loadDrawings('proj-1');
    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
  });
});

describe('drawingService.createDrawing', () => {
  it('creates drawing in draft status with uploaded_by', async () => {
    const created = { id: 'd-new', status: 'draft', uploaded_by: 'user-1' };
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.createDrawing({
      project_id: 'proj-1',
      title: 'A-100 Floor Plan',
    });
    expect(result.error).toBeNull();
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.status).toBe('draft');
    expect(insertArg.uploaded_by).toBe('user-1');
  });

  it('defaults optional fields to null', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'd-1' }, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await drawingService.createDrawing({ project_id: 'proj-1', title: 'Plan' });
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.discipline).toBeNull();
    expect(insertArg.file_url).toBeNull();
    expect(insertArg.revision).toBeNull();
  });
});

describe('drawingService.transitionStatus', () => {
  function setupTransition(currentStatus: string, role: string, updateError: { message: string } | null = null) {
    let drawingFetched = false;
    let memberFetched = false;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'drawings' && !drawingFetched) {
        drawingFetched = true;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { status: currentStatus, project_id: 'proj-1', uploaded_by: 'user-1' },
            error: null,
          }),
        };
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
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

  it('allows Submit for Review from draft for any role', async () => {
    setupTransition('draft', 'owner');

    const result = await drawingService.transitionStatus('d-1', 'Submit for Review');
    expect(result.error).toBeNull();
  });

  it('allows Approve from under_review for reviewer', async () => {
    setupTransition('under_review', 'reviewer');

    const result = await drawingService.transitionStatus('d-1', 'Approve');
    expect(result.error).toBeNull();
  });

  it('blocks Approve from under_review for non-reviewer', async () => {
    setupTransition('under_review', 'subcontractor');

    const result = await drawingService.transitionStatus('d-1', 'Approve');
    expect(result.error?.category).toBe('ValidationError');
    expect(result.error?.message).toContain('Invalid action');
  });

  it('allows Publish from approved for admin', async () => {
    setupTransition('approved', 'admin');

    const result = await drawingService.transitionStatus('d-1', 'Publish');
    expect(result.error).toBeNull();
  });

  it('blocks Publish for project_manager (not admin/owner)', async () => {
    setupTransition('approved', 'project_manager');

    const result = await drawingService.transitionStatus('d-1', 'Publish');
    expect(result.error?.category).toBe('ValidationError');
  });

  it('allows Archive from any non-archived status for admin', async () => {
    setupTransition('published', 'admin');

    const result = await drawingService.transitionStatus('d-1', 'Archive');
    expect(result.error).toBeNull();
  });

  it('blocks Archive for subcontractor', async () => {
    setupTransition('draft', 'subcontractor');

    const result = await drawingService.transitionStatus('d-1', 'Archive');
    expect(result.error?.category).toBe('ValidationError');
  });

  it('returns not found error when drawing missing', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
    }));

    const result = await drawingService.transitionStatus('d-999', 'Approve');
    expect(result.error?.category).toBe('NotFoundError');
  });

  it('returns permission error when user not in project', async () => {
    let drawingFetched = false;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'drawings' && !drawingFetched) {
        drawingFetched = true;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { status: 'draft', project_id: 'proj-1', uploaded_by: 'user-1' },
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

    const result = await drawingService.transitionStatus('d-1', 'Submit for Review');
    expect(result.error?.category).toBe('PermissionError');
  });
});

describe('drawingService.updateDrawing', () => {
  it('strips status and uploaded_by from updates', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await drawingService.updateDrawing('d-1', {
      title: 'Updated',
      status: 'archived' as never,
      uploaded_by: 'attacker',
    } as never);

    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.status).toBeUndefined();
    expect(updateArg.uploaded_by).toBeUndefined();
    expect(updateArg.title).toBe('Updated');
  });

  it('returns db error on failure', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'write failed' } }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.updateDrawing('d-1', { title: 'X' });
    expect(result.error?.category).toBe('DatabaseError');
  });
});

describe('drawingService.deleteDrawing', () => {
  function setupDelete(role: string | null) {
    let drawingFetched = false;
    let memberFetched = false;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'drawings' && !drawingFetched) {
        drawingFetched = true;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { project_id: 'proj-1' }, error: null }),
        };
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null }),
        };
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
    });
  }

  it('allows admin to delete', async () => {
    setupDelete('admin');

    const result = await drawingService.deleteDrawing('d-1');
    expect(result.error).toBeNull();
  });

  it('allows owner to delete', async () => {
    setupDelete('owner');

    const result = await drawingService.deleteDrawing('d-1');
    expect(result.error).toBeNull();
  });

  it('blocks project_manager from deleting', async () => {
    setupDelete('project_manager');

    const result = await drawingService.deleteDrawing('d-1');
    expect(result.error?.category).toBe('PermissionError');
  });

  it('blocks unauthenticated user (no role)', async () => {
    setupDelete(null);

    const result = await drawingService.deleteDrawing('d-1');
    expect(result.error?.category).toBe('PermissionError');
  });
});

describe('drawingService markup methods', () => {
  it('loadMarkups returns markups on success', async () => {
    const markups = [{ id: 'm-1', type: 'annotation' }];
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: markups, error: null }),
    });

    const result = await drawingService.loadMarkups('d-1');
    expect(result.data).toEqual(markups);
  });

  it('createMarkup inserts with created_by', async () => {
    const created = { id: 'm-new', created_by: 'user-1' };
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.createMarkup({
      drawing_id: 'd-1',
      project_id: 'proj-1',
      data: { x: 0, y: 0 },
    });
    expect(result.error).toBeNull();
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.created_by).toBe('user-1');
  });

  it('linkMarkupToRfi sets linked_rfi_id', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.linkMarkupToRfi('m-1', 'rfi-1');
    expect(result.error).toBeNull();
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.linked_rfi_id).toBe('rfi-1');
  });

  it('unlinkMarkup clears both link fields', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.unlinkMarkup('m-1');
    expect(result.error).toBeNull();
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.linked_rfi_id).toBeNull();
    expect(updateArg.linked_punch_item_id).toBeNull();
  });

  it('deleteMarkup calls delete on drawing_markups', async () => {
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.deleteMarkup('m-1');
    expect(result.error).toBeNull();
    expect(chain.delete).toHaveBeenCalled();
  });
});
