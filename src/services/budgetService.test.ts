import { describe, it, expect, vi, beforeEach } from 'vitest';
import { budgetService } from './budgetService';

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

function mockFrom(returnValue: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(returnValue),
    single: vi.fn().mockResolvedValue(returnValue),
  };
  mockSupabase.from.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
});

describe('budgetService.loadBudgetItems', () => {
  it('returns items on success', async () => {
    const items = [{ id: 'bi-1', division: '03' }];
    mockFrom({ data: items, error: null });

    const result = await budgetService.loadBudgetItems('proj-1');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(items);
  });

  it('returns empty array when data is null', async () => {
    mockFrom({ data: null, error: null });

    const result = await budgetService.loadBudgetItems('proj-1');
    expect(result.data).toEqual([]);
  });

  it('returns error on db failure', async () => {
    mockFrom({ data: null, error: { message: 'conn refused' } });

    const result = await budgetService.loadBudgetItems('proj-1');
    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
    expect(result.error?.message).toBe('conn refused');
  });
});

describe('budgetService.addItem', () => {
  it('returns new item on success', async () => {
    const newItem = { id: 'bi-2', division: '05', project_id: 'proj-1' };
    const chain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: newItem, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await budgetService.addItem({ project_id: 'proj-1', division: '05' });
    expect(result.error).toBeNull();
    expect(result.data).toEqual(newItem);
  });

  it('wraps db error', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unique violation' } }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await budgetService.addItem({ project_id: 'proj-1', division: '05' });
    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
  });
});

describe('budgetService.updateItem', () => {
  it('returns success result', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await budgetService.updateItem('bi-1', { description: 'Steel' });
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it('returns error on db failure', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'not found' } }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await budgetService.updateItem('bi-1', { description: 'Steel' });
    expect(result.error?.category).toBe('DatabaseError');
  });
});

describe('budgetService.importItems', () => {
  it('inserts all rows with project_id override', async () => {
    const inserted = [{ id: 'bi-3' }, { id: 'bi-4' }];
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: inserted, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await budgetService.importItems('proj-2', [
      { project_id: 'proj-2', division: '03' },
      { project_id: 'proj-2', division: '05' },
    ]);
    expect(result.data).toHaveLength(2);
    expect(result.error).toBeNull();
  });

  it('handles empty items array', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await budgetService.importItems('proj-2', []);
    expect(result.data).toEqual([]);
  });
});

describe('budgetService.loadChangeOrders', () => {
  it('returns change orders ordered by number', async () => {
    const cos = [{ id: 'co-1', number: 1 }];
    mockFrom({ data: cos, error: null });

    const result = await budgetService.loadChangeOrders('proj-1');
    expect(result.data).toEqual(cos);
  });
});

describe('budgetService.addChangeOrder', () => {
  it('attaches current user id as requested_by', async () => {
    const co = { id: 'co-2', requested_by: 'user-1' };
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: co, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await budgetService.addChangeOrder({
      project_id: 'proj-1',
      description: 'Extra concrete',
    });
    expect(result.data).toEqual(co);
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.requested_by).toBe('user-1');
  });
});

describe('budgetService.updateChangeOrderStatus', () => {
  it('sets approved_date when approvedBy provided', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await budgetService.updateChangeOrderStatus('co-1', 'approved', 'user-2');
    expect(result.error).toBeNull();
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.approved_date).toBeDefined();
  });

  it('does not set approved_date without approvedBy', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await budgetService.updateChangeOrderStatus('co-1', 'pending');
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.approved_date).toBeUndefined();
  });
});
