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
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = mockSingle;
  Object.assign(chain, overrides);
  return chain;
}

function sessionFor(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } });
}

// ---------------------------------------------------------------------------
// loadSubmittals
// ---------------------------------------------------------------------------

describe('submittalService.loadSubmittals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns submittals with soft-delete filter (deleted_at IS NULL)', async () => {
    const mockSubmittals = [
      { id: 's-1', title: 'Concrete Mix Design', status: 'draft', project_id: 'proj-1' },
      { id: 's-2', title: 'Rebar Shop Drawings', status: 'submitted', project_id: 'proj-1' },
    ];
    const chain = makeChain();
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockSubmittals, error: null });
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.loadSubmittals('proj-1');

    expect(mockFrom).toHaveBeenCalledWith('submittals');
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockSubmittals);
  });

  it('wraps DB errors as DatabaseError with safe user message', async () => {
    const chain = makeChain();
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table submittals' },
    });
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.loadSubmittals('proj-restricted');

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
    expect(result.error?.userMessage).toBe('A database error occurred. Please try again.');
  });

  it('returns empty array when project has no submittals', async () => {
    const chain = makeChain();
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.loadSubmittals('proj-new');

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createSubmittal
// ---------------------------------------------------------------------------

describe('submittalService.createSubmittal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forces draft status and sets created_by provenance from session', async () => {
    sessionFor('user-pm');
    const created = {
      id: 's-new',
      title: 'Steel Connections',
      status: 'draft',
      revision_number: 1,
      created_by: 'user-pm',
      project_id: 'proj-1',
    };
    mockSingle.mockResolvedValue({ data: created, error: null });

    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.createSubmittal({
      project_id: 'proj-1',
      title: 'Steel Connections',
    });

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe('draft');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        created_by: 'user-pm',
        revision_number: 1,
      }),
    );
  });

  it('sets revision_number to null for revision submittals (has parent)', async () => {
    sessionFor('user-pm');
    mockSingle.mockResolvedValue({
      data: { id: 's-rev', status: 'draft', parent_submittal_id: 's-parent', revision_number: null },
      error: null,
    });

    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    await submittalService.createSubmittal({
      project_id: 'proj-1',
      title: 'Steel Rev 2',
      parent_submittal_id: 's-parent',
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ revision_number: null }),
    );
  });

  it('returns DatabaseError when insert fails', async () => {
    sessionFor('user-pm');
    mockSingle.mockResolvedValue({ data: null, error: { message: 'unique constraint violation' } });

    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.createSubmittal({ project_id: 'proj-1', title: 'Dup' });

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
  });
});

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------

describe('submittalService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('executes valid transition and writes updated_by provenance', async () => {
    sessionFor('user-pm');

    const fetchChain = makeChain();
    const memberChain = makeChain();
    const updateChain = makeChain();

    mockSingle
      .mockResolvedValueOnce({
        data: { status: 'draft', created_by: 'user-pm', assigned_to: null, project_id: 'proj-1' },
        error: null,
      })
      .mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null });

    (updateChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(updateChain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.transitionStatus('s-1', 'submitted');

    expect(result.error).toBeNull();
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted', updated_by: 'user-pm' }),
    );
  });

  it('rejects transitions that are not valid for the resolved role', async () => {
    sessionFor('user-sub');

    const fetchChain = makeChain();
    const memberChain = makeChain();

    mockSingle
      .mockResolvedValueOnce({ data: { status: 'submitted', project_id: 'proj-1' }, error: null })
      .mockResolvedValueOnce({ data: { role: 'superintendent' }, error: null });

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(memberChain);

    const { submittalService } = await import('../../services/submittalService');
    // superintendent cannot jump directly to approved from submitted
    const result = await submittalService.transitionStatus('s-1', 'approved');

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('ValidationError');
    expect(result.error?.message).toContain('submitted');
    expect(result.error?.message).toContain('approved');
  });

  it('returns PermissionError when user has no project role', async () => {
    sessionFor('user-outsider');

    const fetchChain = makeChain();
    const memberChain = makeChain();

    mockSingle
      .mockResolvedValueOnce({ data: { status: 'draft', project_id: 'proj-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(memberChain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.transitionStatus('s-1', 'submitted');

    expect(result.error?.category).toBe('PermissionError');
    expect(result.error?.userMessage).toBe('You do not have permission to perform this action.');
  });

  it('returns NotFoundError when submittal does not exist or is deleted', async () => {
    sessionFor('user-1');

    const fetchChain = makeChain();
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'no rows found' } });
    mockFrom.mockReturnValueOnce(fetchChain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.transitionStatus('nonexistent', 'submitted');

    expect(result.error?.category).toBe('NotFoundError');
  });

  it('writes submitted_date lifecycle timestamp when transitioning to submitted', async () => {
    sessionFor('user-pm');

    const fetchChain = makeChain();
    const memberChain = makeChain();
    const updateChain = makeChain();

    mockSingle
      .mockResolvedValueOnce({
        data: { status: 'draft', project_id: 'proj-1', created_by: 'user-pm', assigned_to: null },
        error: null,
      })
      .mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null });

    (updateChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(updateChain);

    const { submittalService } = await import('../../services/submittalService');
    await submittalService.transitionStatus('s-1', 'submitted');

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ submitted_date: expect.any(String) }),
    );
  });

  it('writes approved_date lifecycle timestamp when transitioning to approved', async () => {
    sessionFor('user-arch');

    const fetchChain = makeChain();
    const memberChain = makeChain();
    const updateChain = makeChain();

    mockSingle
      .mockResolvedValueOnce({
        data: { status: 'architect_review', project_id: 'proj-1', created_by: 'user-gc', assigned_to: null },
        error: null,
      })
      .mockResolvedValueOnce({ data: { role: 'architect' }, error: null });

    (updateChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(updateChain);

    const { submittalService } = await import('../../services/submittalService');
    await submittalService.transitionStatus('s-1', 'approved');

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ approved_date: expect.any(String) }),
    );
  });
});

// ---------------------------------------------------------------------------
// deleteSubmittal
// ---------------------------------------------------------------------------

describe('submittalService.deleteSubmittal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soft-deletes by setting deleted_at and deleted_by rather than destroying the row', async () => {
    sessionFor('user-pm');

    const chain = makeChain();
    (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.deleteSubmittal('s-del');

    expect(result.error).toBeNull();
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        deleted_by: 'user-pm',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// createRevision
// ---------------------------------------------------------------------------

describe('submittalService.createRevision', () => {
  beforeEach(() => vi.clearAllMocks());

  it('increments revision_number and links parent_submittal_id on new draft', async () => {
    sessionFor('user-pm');

    const parent = {
      id: 's-parent',
      project_id: 'proj-1',
      title: 'Concrete Mix Design',
      revision_number: 2,
      spec_section: '03 00 00',
      status: 'rejected',
      assigned_to: null,
      subcontractor: 'ABC Concrete',
      due_date: null,
      submit_by_date: null,
      required_onsite_date: null,
      lead_time_weeks: 4,
    };

    const revision = {
      ...parent,
      id: 's-rev-new',
      revision_number: 3,
      status: 'draft',
      parent_submittal_id: 's-parent',
      created_by: 'user-pm',
    };

    mockSingle
      .mockResolvedValueOnce({ data: parent, error: null })
      .mockResolvedValueOnce({ data: revision, error: null });

    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.createRevision('s-parent');

    expect(result.error).toBeNull();
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_submittal_id: 's-parent',
        revision_number: 3,
        status: 'draft',
        created_by: 'user-pm',
      }),
    );
  });

  it('returns NotFoundError when parent submittal does not exist', async () => {
    sessionFor('user-pm');

    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'no rows found' } });

    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    const { submittalService } = await import('../../services/submittalService');
    const result = await submittalService.createRevision('nonexistent-parent');

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('NotFoundError');
  });
});
