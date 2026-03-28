import { describe, it, expect, beforeEach } from 'vitest';
import { useRfiStore } from '../rfiStore';

describe('RFI Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useRfiStore.setState({
      rfis: [],
      responses: {},
      loading: false,
      error: null,
    });
  });

  it('loads mock RFIs for a project', async () => {
    await useRfiStore.getState().loadRfis('project-1');
    const { rfis } = useRfiStore.getState();
    expect(rfis.length).toBeGreaterThan(0);
    expect(rfis[0].project_id).toBe('project-1');
  });

  it('creates a new RFI', async () => {
    await useRfiStore.getState().loadRfis('project-1');
    const initialCount = useRfiStore.getState().rfis.length;

    const { error, rfi } = await useRfiStore.getState().createRfi({
      project_id: 'project-1',
      title: 'Test RFI from unit test',
      priority: 'high',
      created_by: 'user-1',
    });

    expect(error).toBeNull();
    expect(rfi).not.toBeNull();
    expect(rfi!.title).toBe('Test RFI from unit test');
    expect(rfi!.status).toBe('draft');
    expect(useRfiStore.getState().rfis.length).toBe(initialCount + 1);
  });

  it('updates RFI status', async () => {
    await useRfiStore.getState().loadRfis('project-1');
    const firstRfi = useRfiStore.getState().rfis[0];

    const { error } = await useRfiStore.getState().updateRfiStatus(firstRfi.id, 'under_review');
    expect(error).toBeNull();

    const updated = useRfiStore.getState().rfis.find((r) => r.id === firstRfi.id);
    expect(updated!.status).toBe('under_review');
  });

  it('updates RFI fields', async () => {
    await useRfiStore.getState().loadRfis('project-1');
    const firstRfi = useRfiStore.getState().rfis[0];

    const { error } = await useRfiStore.getState().updateRfi(firstRfi.id, {
      title: 'Updated Title',
      priority: 'critical',
    });
    expect(error).toBeNull();

    const updated = useRfiStore.getState().rfis.find((r) => r.id === firstRfi.id);
    expect(updated!.title).toBe('Updated Title');
    expect(updated!.priority).toBe('critical');
  });

  it('deletes an RFI', async () => {
    await useRfiStore.getState().loadRfis('project-1');
    const initialCount = useRfiStore.getState().rfis.length;
    const firstRfi = useRfiStore.getState().rfis[0];

    const { error } = await useRfiStore.getState().deleteRfi(firstRfi.id);
    expect(error).toBeNull();
    expect(useRfiStore.getState().rfis.length).toBe(initialCount - 1);
    expect(useRfiStore.getState().rfis.find((r) => r.id === firstRfi.id)).toBeUndefined();
  });

  it('loads responses for an RFI', async () => {
    await useRfiStore.getState().loadResponses('rfi-2');
    const responses = useRfiStore.getState().responses['rfi-2'];
    expect(responses).toBeDefined();
    expect(responses.length).toBeGreaterThan(0);
    expect(responses[0].rfi_id).toBe('rfi-2');
  });

  it('adds a response and auto-updates status to responded', async () => {
    await useRfiStore.getState().loadRfis('project-1');

    const { error } = await useRfiStore.getState().addResponse(
      'rfi-1',
      'user-2',
      'Response text from test'
    );
    expect(error).toBeNull();

    const responses = useRfiStore.getState().responses['rfi-1'];
    expect(responses).toBeDefined();
    expect(responses.length).toBe(1);
    expect(responses[0].response_text).toBe('Response text from test');

    // Status should be auto-updated to responded
    const rfi = useRfiStore.getState().rfis.find((r) => r.id === 'rfi-1');
    expect(rfi!.status).toBe('responded');
  });

  it('returns empty responses for RFI with no responses', async () => {
    await useRfiStore.getState().loadResponses('rfi-1');
    const responses = useRfiStore.getState().responses['rfi-1'];
    expect(responses).toBeDefined();
    expect(responses.length).toBe(0);
  });
});
