import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockSingle, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
}));

import { sovService } from './sovService';

function makeChain(): Record<string, ReturnType<typeof vi.fn>> {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
  };
  for (const key of ['select', 'eq', 'insert', 'update', 'delete', 'order']) {
    chain[key].mockReturnValue(chain);
  }
  return chain;
}

function session(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } });
}

// ── loadItems ────────────────────────────────────────────────────────────────

describe('sovService.loadItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns items ordered by sort_order', async () => {
    const items = [
      { id: 'i-1', contract_id: 'c-1', description: 'Foundations', scheduled_value: 50000 },
      { id: 'i-2', contract_id: 'c-1', description: 'Framing', scheduled_value: 30000 },
    ];
    const chain = makeChain();
    chain.order.mockResolvedValue({ data: items, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await sovService.loadItems('c-1');

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(chain.eq).toHaveBeenCalledWith('contract_id', 'c-1');
    expect(chain.order).toHaveBeenCalledWith('sort_order', expect.objectContaining({ ascending: true }));
  });

  it('returns empty array when no items exist', async () => {
    const chain = makeChain();
    chain.order.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await sovService.loadItems('c-empty');

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it('returns DatabaseError on fetch failure', async () => {
    const chain = makeChain();
    chain.order.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    mockFrom.mockReturnValue(chain);

    const result = await sovService.loadItems('c-1');

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
    expect(result.error?.message).toContain('connection refused');
  });
});

// ── createItem ───────────────────────────────────────────────────────────────

describe('sovService.createItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates item for project_manager role', async () => {
    session('u-pm');

    const created = { id: 'i-new', contract_id: 'c-1', description: 'Concrete', scheduled_value: 20000 };
    let contractFetched = false;
    let memberFetched = false;
    let inserted = false;

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null });
        return chain;
      }
      if (table === 'schedule_of_values' && !inserted) {
        inserted = true;
        mockSingle.mockResolvedValueOnce({ data: created, error: null });
        return chain;
      }
      return chain;
    });

    const result = await sovService.createItem({
      contract_id: 'c-1',
      description: 'Concrete',
      scheduled_value: 20000,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('i-new');
  });

  it('rejects creation for viewer role', async () => {
    session('u-viewer');

    let contractFetched = false;
    let memberFetched = false;
    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'viewer' }, error: null });
        return chain;
      }
      return chain;
    });

    const result = await sovService.createItem({
      contract_id: 'c-1',
      description: 'Windows',
      scheduled_value: 5000,
    });

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('PermissionError');
  });

  it('returns PermissionError when user is not a project member', async () => {
    session('u-stranger');

    let contractFetched = false;
    let memberFetched = false;
    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: null, error: null });
        return chain;
      }
      return chain;
    });

    const result = await sovService.createItem({
      contract_id: 'c-1',
      description: 'Roofing',
      scheduled_value: 10000,
    });

    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('PermissionError');
  });
});

// ── updateItem ───────────────────────────────────────────────────────────────

describe('sovService.updateItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates item fields for admin role', async () => {
    session('u-admin');

    let itemFetched = false;
    let contractFetched = false;
    let memberFetched = false;
    const updateChain = makeChain();
    updateChain.eq.mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'schedule_of_values' && !itemFetched) {
        itemFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { contract_id: 'c-1' }, error: null });
        return chain;
      }
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });
        return chain;
      }
      return updateChain;
    });

    const result = await sovService.updateItem('i-1', { description: 'Updated Concrete', scheduled_value: 25000 });

    expect(result.error).toBeNull();
  });

  it('rejects update for subcontractor role', async () => {
    session('u-sub');

    let itemFetched = false;
    let contractFetched = false;
    let memberFetched = false;

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'schedule_of_values' && !itemFetched) {
        itemFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { contract_id: 'c-1' }, error: null });
        return chain;
      }
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'subcontractor' }, error: null });
        return chain;
      }
      return chain;
    });

    const result = await sovService.updateItem('i-1', { scheduled_value: 99999 });

    expect(result.error?.category).toBe('PermissionError');
  });

  it('returns NotFoundError when item does not exist', async () => {
    session('u-admin');

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'schedule_of_values') {
        mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
        return chain;
      }
      return chain;
    });

    const result = await sovService.updateItem('i-missing', { description: 'X' });

    expect(result.error?.category).toBe('NotFoundError');
  });
});

// ── deleteItem ───────────────────────────────────────────────────────────────

describe('sovService.deleteItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows admin to delete an item', async () => {
    session('u-admin');

    let itemFetched = false;
    let contractFetched = false;
    let memberFetched = false;
    const deleteChain = makeChain();
    deleteChain.eq.mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'schedule_of_values' && !itemFetched) {
        itemFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { contract_id: 'c-1' }, error: null });
        return chain;
      }
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });
        return chain;
      }
      return deleteChain;
    });

    const result = await sovService.deleteItem('i-1');
    expect(result.error).toBeNull();
  });

  it('blocks project_manager from deleting', async () => {
    session('u-pm');

    let itemFetched = false;
    let contractFetched = false;
    let memberFetched = false;

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'schedule_of_values' && !itemFetched) {
        itemFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { contract_id: 'c-1' }, error: null });
        return chain;
      }
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null });
        return chain;
      }
      return chain;
    });

    const result = await sovService.deleteItem('i-1');
    expect(result.error?.category).toBe('PermissionError');
  });
});

// ── bulkReplace ──────────────────────────────────────────────────────────────

describe('sovService.bulkReplace', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes existing items and inserts new set for owner', async () => {
    session('u-owner');

    let contractFetched = false;
    let memberFetched = false;
    const deleteChain = makeChain();
    deleteChain.eq.mockResolvedValue({ error: null });
    const insertChain = makeChain();
    insertChain.select.mockResolvedValue({
      data: [
        { id: 'i-new-1', contract_id: 'c-1', description: 'Foundations', scheduled_value: 50000 },
      ],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'owner' }, error: null });
        return chain;
      }
      if (table === 'schedule_of_values') {
        // First call: delete, second call: insert
        if (deleteChain.delete.mock.calls.length === 0) return deleteChain;
        return insertChain;
      }
      return chain;
    });

    const result = await sovService.bulkReplace('c-1', [
      {
        description: 'Foundations',
        scheduled_value: 50000,
        item_number: null,
        cost_code: null,
        sort_order: 0,
        previous_completed: null,
        this_period_completed: null,
        materials_stored: null,
        total_completed: null,
        retainage: null,
        balance_to_finish: null,
        percent_complete: null,
      },
    ]);

    expect(result.error).toBeNull();
  });

  it('returns empty array when items list is empty', async () => {
    session('u-owner');

    let contractFetched = false;
    let memberFetched = false;
    const deleteChain = makeChain();
    deleteChain.eq.mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'owner' }, error: null });
        return chain;
      }
      return deleteChain;
    });

    const result = await sovService.bulkReplace('c-1', []);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it('rejects bulk replace for viewer role', async () => {
    session('u-viewer');

    let contractFetched = false;
    let memberFetched = false;

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain();
      if (table === 'contracts' && !contractFetched) {
        contractFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { project_id: 'proj-1' }, error: null });
        return chain;
      }
      if (table === 'project_members' && !memberFetched) {
        memberFetched = true;
        mockSingle.mockResolvedValueOnce({ data: { role: 'viewer' }, error: null });
        return chain;
      }
      return chain;
    });

    const result = await sovService.bulkReplace('c-1', []);
    expect(result.error?.category).toBe('PermissionError');
  });
});
