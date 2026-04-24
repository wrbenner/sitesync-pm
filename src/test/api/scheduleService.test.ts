import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock — full chainable builder
// ---------------------------------------------------------------------------
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();

const chain = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  is: mockIs,
  order: mockOrder,
  single: mockSingle,
};

// Each method returns the chain so calls can be chained.
// Terminal calls (single, order when no further chain) return promises.
function resetChain(resolvedValue: unknown) {
  mockSingle.mockResolvedValue(resolvedValue);
  mockOrder.mockResolvedValue(resolvedValue);
  // For non-terminal order (when .is().order() is used), return chain
  mockIs.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockSelect.mockReturnValue(chain);
  mockInsert.mockReturnValue(chain);
  mockUpdate.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-99' } } },
      }),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Import AFTER mocks are registered
async function importService() {
  return import('../../services/scheduleService');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadPhases', () => {
    it('queries schedule_phases filtered by project and active only', async () => {
      const mockPhases = [
        { id: 'ph-1', name: 'Foundation', project_id: 'proj-1', status: 'active' },
        { id: 'ph-2', name: 'Structure', project_id: 'proj-1', status: 'upcoming' },
      ];
      resetChain({ data: mockPhases, error: null });

      const { scheduleService } = await importService();
      const result = await scheduleService.loadPhases('proj-1');

      expect(mockFrom).toHaveBeenCalledWith('schedule_phases');
      expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
      expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-1');
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockPhases);
    });

    it('returns error string on Supabase failure', async () => {
      resetChain({ data: null, error: { message: 'connection timeout' } });
      // Order is terminal here and returns the error
      mockOrder.mockResolvedValue({ data: null, error: { message: 'connection timeout' } });

      const { scheduleService } = await importService();
      const result = await scheduleService.loadPhases('proj-bad');

      expect(result.data).toBeNull();
      expect(result.error).toBe('connection timeout');
    });

    it('returns empty array when project has no phases', async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockIs.mockReturnValue(chain);
      mockEq.mockReturnValue(chain);
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      const result = await scheduleService.loadPhases('proj-empty');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    });
  });

  describe('createPhase', () => {
    it('inserts with upcoming status and created_by from session', async () => {
      const newPhase = { id: 'ph-new', name: 'Excavation', status: 'upcoming', project_id: 'proj-1' };
      mockSingle.mockResolvedValue({ data: newPhase, error: null });
      mockSelect.mockReturnValue(chain);
      mockInsert.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      const result = await scheduleService.createPhase({
        project_id: 'proj-1',
        name: 'Excavation',
        start_date: '2026-05-01',
        end_date: '2026-06-01',
      });

      expect(mockFrom).toHaveBeenCalledWith('schedule_phases');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-1',
          name: 'Excavation',
          status: 'upcoming',
          created_by: 'user-99',
        }),
      );
      expect(result.error).toBeNull();
      expect(result.data).toEqual(newPhase);
    });

    it('defaults percent_complete to 0 and is_critical_path to false', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'ph-x' }, error: null });
      mockSelect.mockReturnValue(chain);
      mockInsert.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      await scheduleService.createPhase({ project_id: 'p1', name: 'Test' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          percent_complete: 0,
          is_critical_path: false,
        }),
      );
    });

    it('returns error on Supabase insert failure', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'unique constraint' } });
      mockSelect.mockReturnValue(chain);
      mockInsert.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      const result = await scheduleService.createPhase({ project_id: 'p1', name: 'Dupe' });

      expect(result.data).toBeNull();
      expect(result.error).toBe('unique constraint');
    });
  });

  describe('transitionStatus', () => {
    it('rejects transition for viewer role', async () => {
      let phaseCall = 0;
      let memberCall = 0;
      mockSingle
        .mockImplementationOnce(() => {
          phaseCall++;
          return Promise.resolve({ data: { status: 'upcoming', project_id: 'p1' }, error: null });
        })
        .mockImplementationOnce(() => {
          memberCall++;
          return Promise.resolve({ data: { role: 'viewer' }, error: null });
        });
      mockEq.mockReturnValue(chain);
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      const result = await scheduleService.transitionStatus('ph-1', 'active');

      expect(result.error).toContain('Invalid transition');
      expect(phaseCall).toBe(1);
      expect(memberCall).toBe(1);
    });

    it('returns error when phase is not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'row not found' } });
      mockEq.mockReturnValue(chain);
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      const result = await scheduleService.transitionStatus('ph-ghost', 'active');

      expect(result.data).toBeNull();
      expect(result.error).toBe('row not found');
    });

    it('returns error when user has no project membership', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { status: 'upcoming', project_id: 'p1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null }); // no membership row
      mockEq.mockReturnValue(chain);
      mockSelect.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      const result = await scheduleService.transitionStatus('ph-1', 'active');

      expect(result.error).toBe('User is not a member of this project');
    });
  });

  describe('deletePhase', () => {
    it('soft-deletes by setting deleted_at and deleted_by', async () => {
      const updateResult = { data: null, error: null };
      mockEq.mockResolvedValue(updateResult);
      mockUpdate.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      const result = await scheduleService.deletePhase('ph-to-delete');

      expect(mockFrom).toHaveBeenCalledWith('schedule_phases');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_by: 'user-99',
        }),
      );
      // deleted_at should be an ISO timestamp
      const updatePayload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
      expect(typeof updatePayload['deleted_at']).toBe('string');
      expect(result.error).toBeNull();
    });
  });

  describe('updateDependencies', () => {
    it('sets depends_on to first predecessor and dependencies to full array', async () => {
      mockEq.mockResolvedValue({ data: null, error: null });
      mockUpdate.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      await scheduleService.updateDependencies('ph-1', ['ph-A', 'ph-B']);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencies: ['ph-A', 'ph-B'],
          depends_on: 'ph-A',
          updated_by: 'user-99',
        }),
      );
    });

    it('clears depends_on when no predecessors', async () => {
      mockEq.mockResolvedValue({ data: null, error: null });
      mockUpdate.mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      const { scheduleService } = await importService();
      await scheduleService.updateDependencies('ph-1', []);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencies: [],
          depends_on: null,
        }),
      );
    });
  });
});
