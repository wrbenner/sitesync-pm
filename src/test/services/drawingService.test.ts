import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock — hoisted so vi.mock factory can reference them
// ---------------------------------------------------------------------------
const { mockGetSession, mockSingle, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
  isSupabaseConfigured: true,
}));

// ---------------------------------------------------------------------------
// Chain builder helpers
// ---------------------------------------------------------------------------

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.single = mockSingle;
  Object.assign(chain, overrides);
  return chain;
}

function sessionFor(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } });
}

// ---------------------------------------------------------------------------
// drawingService.loadDrawings
// ---------------------------------------------------------------------------

describe('drawingService.loadDrawings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns drawings ordered by title, excluding archived', async () => {
    const mockDrawings = [
      { id: 'd-1', title: 'A-101', status: 'draft', project_id: 'proj-1' },
      { id: 'd-2', title: 'S-201', status: 'published', project_id: 'proj-1' },
    ];

    const chain = makeChain();
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockDrawings,
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.loadDrawings('proj-1');

    expect(mockFrom).toHaveBeenCalledWith('drawings');
    expect(chain.neq).toHaveBeenCalledWith('status', 'archived');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockDrawings);
  });

  it('returns empty array when project has no drawings', async () => {
    const chain = makeChain();
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.loadDrawings('proj-empty');

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('propagates Supabase errors as DatabaseError', async () => {
    const chain = makeChain();
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });
    mockFrom.mockReturnValue(chain);

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.loadDrawings('proj-403');

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
    expect(result.error?.message).toBe('permission denied');
  });
});

// ---------------------------------------------------------------------------
// drawingService.createDrawing
// ---------------------------------------------------------------------------

describe('drawingService.createDrawing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates drawing with status draft and uploaded_by set to current user', async () => {
    sessionFor('user-42');
    const created = {
      id: 'd-new',
      title: 'A-101 Floor Plan',
      status: 'draft',
      uploaded_by: 'user-42',
      project_id: 'proj-1',
    };
    mockSingle.mockResolvedValue({ data: created, error: null });
    const chain = makeChain();
    (chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.createDrawing({
      project_id: 'proj-1',
      title: 'A-101 Floor Plan',
      discipline: 'architectural',
      sheet_number: 'A-101',
    });

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ id: 'd-new', status: 'draft', uploaded_by: 'user-42' });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', uploaded_by: 'user-42' }),
    );
  });

  it('always forces status to draft regardless of input', async () => {
    sessionFor('user-1');
    mockSingle.mockResolvedValue({ data: { id: 'd-x', status: 'draft' }, error: null });
    const chain = makeChain();
    (chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);

    const { drawingService } = await import('../../services/drawingService');
    await drawingService.createDrawing({ project_id: 'proj-1', title: 'Test' });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' }),
    );
  });

  it('returns DatabaseError when insert fails', async () => {
    sessionFor('user-1');
    mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } });
    const chain = makeChain();
    (chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.createDrawing({ project_id: 'proj-1', title: 'Bad' });

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
  });
});

// ---------------------------------------------------------------------------
// drawingService.transitionStatus
// ---------------------------------------------------------------------------

describe('drawingService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid action for current status', async () => {
    sessionFor('user-1');

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = makeChain();
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: { status: 'draft', project_id: 'proj-1', uploaded_by: 'user-1' },
          error: null,
        });
      } else {
        mockSingle.mockResolvedValueOnce({ data: { role: 'member' }, error: null });
      }
      return chain;
    });

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.transitionStatus('d-1', 'Approve');

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('ValidationError');
    expect(result.error?.message).toContain('"Approve"');
  });

  it('rejects when user is not a project member', async () => {
    sessionFor('user-outsider');

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = makeChain();
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: { status: 'draft', project_id: 'proj-1', uploaded_by: 'owner' },
          error: null,
        });
      } else {
        mockSingle.mockResolvedValueOnce({ data: null, error: null });
      }
      return chain;
    });

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.transitionStatus('d-1', 'Submit for Review');

    expect(result.error?.category).toBe('PermissionError');
  });

  it('transitions draft -> under_review via Submit for Review', async () => {
    sessionFor('user-1');

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const chain = makeChain();
        mockSingle.mockResolvedValueOnce({
          data: { status: 'draft', project_id: 'proj-1', uploaded_by: 'user-1' },
          error: null,
        });
        return chain;
      }
      if (callCount === 2) {
        const chain = makeChain();
        mockSingle.mockResolvedValueOnce({ data: { role: 'member' }, error: null });
        return chain;
      }
      return { update: mockUpdate };
    });

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.transitionStatus('d-1', 'Submit for Review');

    expect(result.error).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'under_review', updated_at: expect.any(String) }),
    );
  });

  it('returns NotFoundError when drawing does not exist', async () => {
    sessionFor('user-1');

    mockFrom.mockImplementation(() => {
      const chain = makeChain();
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      return chain;
    });

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.transitionStatus('d-missing', 'Submit for Review');

    expect(result.error?.category).toBe('NotFoundError');
  });

  it('admin can transition under_review -> approved', async () => {
    sessionFor('admin-1');

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const chain = makeChain();
        mockSingle.mockResolvedValueOnce({
          data: { status: 'under_review', project_id: 'proj-1', uploaded_by: 'drafter-1' },
          error: null,
        });
        return chain;
      }
      if (callCount === 2) {
        const chain = makeChain();
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });
        return chain;
      }
      return { update: mockUpdate };
    });

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.transitionStatus('d-1', 'Approve');

    expect(result.error).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' }),
    );
  });
});

// ---------------------------------------------------------------------------
// drawingService.updateDrawing
// ---------------------------------------------------------------------------

describe('drawingService.updateDrawing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('strips status field from updates', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const { drawingService } = await import('../../services/drawingService');
    await drawingService.updateDrawing('d-1', {
      title: 'Revised Title',
      status: 'published',
    } as Parameters<typeof drawingService.updateDrawing>[1]);

    const updateArg = (mockUpdate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateArg).toHaveProperty('title', 'Revised Title');
    expect(updateArg).not.toHaveProperty('status');
    expect(updateArg).toHaveProperty('updated_at');
  });
});

// ---------------------------------------------------------------------------
// drawingService.loadMarkups
// ---------------------------------------------------------------------------

describe('drawingService.loadMarkups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns markups ordered by created_at ascending', async () => {
    const mockMarkups = [
      { id: 'm-1', drawing_id: 'd-1', type: 'pin', created_at: '2024-01-01' },
      { id: 'm-2', drawing_id: 'd-1', type: 'text', created_at: '2024-01-02' },
    ];

    const chain = makeChain();
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockMarkups,
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.loadMarkups('d-1');

    expect(mockFrom).toHaveBeenCalledWith('drawing_markups');
    expect(chain.eq).toHaveBeenCalledWith('drawing_id', 'd-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result.data).toEqual(mockMarkups);
  });
});

// ---------------------------------------------------------------------------
// drawingService.createMarkup
// ---------------------------------------------------------------------------

describe('drawingService.createMarkup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates markup with created_by set to current user', async () => {
    sessionFor('user-7');
    const created = { id: 'm-new', drawing_id: 'd-1', created_by: 'user-7', type: 'pin' };
    mockSingle.mockResolvedValue({ data: created, error: null });
    const chain = makeChain();
    (chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.createMarkup({
      drawing_id: 'd-1',
      project_id: 'proj-1',
      type: 'pin',
      data: { x: 100, y: 200 },
    });

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ created_by: 'user-7' });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: 'user-7', drawing_id: 'd-1' }),
    );
  });
});

// ---------------------------------------------------------------------------
// drawingService.deleteMarkup
// ---------------------------------------------------------------------------

describe('drawingService.deleteMarkup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes markup by id', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ delete: mockDelete });

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.deleteMarkup('m-to-delete');

    expect(mockFrom).toHaveBeenCalledWith('drawing_markups');
    expect(mockEq).toHaveBeenCalledWith('id', 'm-to-delete');
    expect(result.error).toBeNull();
  });

  it('returns DatabaseError on delete failure', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'delete denied' } });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ delete: mockDelete });

    const { drawingService } = await import('../../services/drawingService');
    const result = await drawingService.deleteMarkup('m-protected');

    expect(result.error?.category).toBe('DatabaseError');
  });
});
