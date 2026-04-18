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

// ── uploadDrawing ─────────────────────────────────────────────────────────────

describe('drawingService.uploadDrawing', () => {
  const mockFile = new File(['pdf-content'], 'A-100.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    // Mock supabase.storage
    (mockSupabase as unknown as Record<string, unknown>).storage = {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://cdn.example.com/drawings/proj-1/A-100.pdf' },
        }),
      }),
    };
  });

  it('uploads file and creates drawing record in draft status', async () => {
    const created = { id: 'd-upload', status: 'draft', file_url: 'https://cdn.example.com/drawings/proj-1/A-100.pdf' };
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.uploadDrawing('proj-1', mockFile, { title: 'A-100 Floor Plan', sheet_number: 'A-100' });
    expect(result.error).toBeNull();
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.status).toBe('draft');
    expect(insertArg.project_id).toBe('proj-1');
    expect(insertArg.sheet_number).toBe('A-100');
    expect(insertArg.uploaded_by).toBe('user-1');
  });

  it('returns error when storage upload fails', async () => {
    (mockSupabase as unknown as Record<string, unknown>).storage = {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: { message: 'bucket not found' } }),
        getPublicUrl: vi.fn(),
      }),
    };

    const result = await drawingService.uploadDrawing('proj-1', mockFile);
    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
    expect(result.error?.message).toContain('File upload failed');
  });

  it('uses filename as title when no title provided in meta', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'd-1' }, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await drawingService.uploadDrawing('proj-1', mockFile);
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.title).toBe('A-100.pdf');
  });
});

// ── addAnnotation ─────────────────────────────────────────────────────────────

describe('drawingService.addAnnotation', () => {
  it('inserts annotation with created_by and extended fields', async () => {
    const created = { id: 'ann-1', created_by: 'user-1', type: 'rectangle' };
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.addAnnotation({
      drawing_id: 'd-1',
      project_id: 'proj-1',
      annotation_type: 'rectangle',
      coordinates: { x: 10, y: 20, width: 100, height: 50 },
      color: '#FF0000',
      page_number: 2,
      note: 'Check dimension',
    });

    expect(result.error).toBeNull();
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.created_by).toBe('user-1');
    expect(insertArg.type).toBe('rectangle');
    expect(insertArg.note).toBe('Check dimension');
    expect(insertArg.color).toBe('#FF0000');
    expect(insertArg.page_number).toBe(2);
  });

  it('defaults color to brand orange when not provided', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'ann-1' }, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await drawingService.addAnnotation({
      drawing_id: 'd-1',
      project_id: 'proj-1',
      coordinates: { x: 0, y: 0 },
    });

    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.color).toBe('#F47820');
  });

  it('returns db error on insert failure', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'rls violation' } }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.addAnnotation({
      drawing_id: 'd-1',
      project_id: 'proj-1',
      coordinates: {},
    });
    expect(result.data).toBeNull();
    expect(result.error?.category).toBe('DatabaseError');
  });
});

// ── updateAnnotation ──────────────────────────────────────────────────────────

describe('drawingService.updateAnnotation', () => {
  it('updates note and layer', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.updateAnnotation('ann-1', {
      note: 'Revised note',
      layer: 'structural',
    });
    expect(result.error).toBeNull();
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.note).toBe('Revised note');
    expect(updateArg.layer).toBe('structural');
    expect(updateArg.updated_at).toBeDefined();
  });

  it('syncs annotation_type to both type and annotation_type columns', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await drawingService.updateAnnotation('ann-1', { annotation_type: 'pin' });

    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.type).toBe('pin');
    expect(updateArg.annotation_type).toBe('pin');
  });

  it('returns db error on failure', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'write failed' } }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.updateAnnotation('ann-1', { note: 'x' });
    expect(result.error?.category).toBe('DatabaseError');
  });
});

// ── deleteAnnotation ──────────────────────────────────────────────────────────

describe('drawingService.deleteAnnotation', () => {
  it('hard-deletes the annotation', async () => {
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.deleteAnnotation('ann-1');
    expect(result.error).toBeNull();
    expect(chain.delete).toHaveBeenCalled();
  });

  it('returns db error when delete fails', async () => {
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'constraint violation' } }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await drawingService.deleteAnnotation('ann-1');
    expect(result.error?.category).toBe('DatabaseError');
  });
});

// ── getDrawingVersions ────────────────────────────────────────────────────────

describe('drawingService.getDrawingVersions', () => {
  it('returns all revisions with same sheet_number ordered by _versionIndex', async () => {
    const versions = [
      { id: 'd-1', sheet_number: 'A-100', project_id: 'proj-1', revision: 'A', created_at: '2026-01-01' },
      { id: 'd-2', sheet_number: 'A-100', project_id: 'proj-1', revision: 'B', created_at: '2026-02-01' },
    ];
    let firstFetch = true;
    mockSupabase.from.mockImplementation(() => {
      if (firstFetch) {
        firstFetch = false;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { project_id: 'proj-1', sheet_number: 'A-100' },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: versions, error: null }),
      };
    });

    const result = await drawingService.getDrawingVersions('d-2');
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data![0]._versionIndex).toBe(1);
    expect(result.data![1]._versionIndex).toBe(2);
  });

  it('returns not found error when drawing does not exist', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
    });

    const result = await drawingService.getDrawingVersions('d-999');
    expect(result.error?.category).toBe('NotFoundError');
  });

  it('falls back to previous_revision_id chain when sheet_number is null', async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        // Initial fetch: no sheet_number
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { project_id: 'proj-1', sheet_number: null },
            error: null,
          }),
        };
      }
      if (callCount === 2) {
        // Chain: current drawing with a previous_revision_id
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'd-2', previous_revision_id: 'd-1', title: 'Rev B' },
            error: null,
          }),
        };
      }
      // Chain: root drawing with no previous
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'd-1', previous_revision_id: null, title: 'Rev A' },
          error: null,
        }),
      };
    });

    const result = await drawingService.getDrawingVersions('d-2');
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data![0]._versionIndex).toBe(1);
    expect(result.data![1]._versionIndex).toBe(2);
  });
});
