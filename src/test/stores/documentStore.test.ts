import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServiceError } from '../../services/errors';

vi.mock('../../services/documentService', () => ({
  documentService: {
    loadDocuments: vi.fn(),
    createDocument: vi.fn(),
    uploadDocument: vi.fn(),
    uploadVersion: vi.fn(),
    transitionStatus: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}));

import { useDocumentStore } from '../../stores/documentStore';
import { documentService } from '../../services/documentService';
import type { DocumentRecord } from '../../services/documentService';

const mockError: ServiceError = {
  category: 'DatabaseError',
  code: 'DB_ERROR',
  message: 'Connection failed',
  userMessage: 'Failed to perform operation',
};

const mockDoc: DocumentRecord = {
  id: 'doc-1',
  project_id: 'p-1',
  name: 'Blueprint.pdf',
  file_url: 'https://example.com/blueprint.pdf',
  file_size: 1024,
  content_type: 'application/pdf',
  folder: 'Blueprints',
  description: null,
  discipline: null,
  trade: null,
  tags: null,
  version: 1,
  previous_version_id: null,
  uploaded_by: 'u-1',
  created_by: 'u-1',
  updated_by: null,
  document_status: 'draft',
  updated_at: null,
  deleted_at: null,
  deleted_by: null,
  created_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  useDocumentStore.setState(
    {
      documents: [],
      loading: false,
      error: null,
      errorDetails: null,
      uploadProgress: {},
    },
    true,
  );
  vi.clearAllMocks();
});

// ── updateDocument ────────────────────────────────────────────────────────────

describe('documentStore.updateDocument', () => {
  it('applies optimistic update before service call resolves', async () => {
    useDocumentStore.setState({ documents: [mockDoc] });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(documentService.updateDocument).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof documentService.updateDocument>,
    );

    const pending = useDocumentStore.getState().updateDocument('doc-1', { name: 'NewName.pdf' });

    // Optimistic update visible immediately
    expect(useDocumentStore.getState().documents[0].name).toBe('NewName.pdf');

    resolveService({ data: null, error: null });
    const result = await pending;
    expect(result.error).toBeNull();
    expect(useDocumentStore.getState().documents[0].name).toBe('NewName.pdf');
  });

  it('rolls back optimistic update when service returns an error', async () => {
    useDocumentStore.setState({ documents: [mockDoc] });
    vi.mocked(documentService.updateDocument).mockResolvedValue({ data: null, error: mockError });

    const result = await useDocumentStore.getState().updateDocument('doc-1', { name: 'NewName.pdf' });

    expect(result.error).toBe(mockError.userMessage);
    expect(useDocumentStore.getState().documents[0].name).toBe('Blueprint.pdf');
    expect(useDocumentStore.getState().error).toBe(mockError.userMessage);
  });

  it('preserves other documents when updating one', async () => {
    const other = { ...mockDoc, id: 'doc-2', name: 'Other.pdf' };
    useDocumentStore.setState({ documents: [mockDoc, other] });
    vi.mocked(documentService.updateDocument).mockResolvedValue({ data: null, error: null });

    await useDocumentStore.getState().updateDocument('doc-1', { name: 'Updated.pdf' });

    expect(useDocumentStore.getState().documents).toHaveLength(2);
    expect(useDocumentStore.getState().documents[1].name).toBe('Other.pdf');
  });
});

// ── transitionStatus ──────────────────────────────────────────────────────────

describe('documentStore.transitionStatus', () => {
  it('applies status transition optimistically', async () => {
    useDocumentStore.setState({ documents: [mockDoc] });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(documentService.transitionStatus).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof documentService.transitionStatus>,
    );

    const pending = useDocumentStore.getState().transitionStatus('doc-1', 'submitted');

    // Optimistic: status updated immediately
    expect(useDocumentStore.getState().documents[0].document_status).toBe('submitted');

    resolveService({ data: null, error: null });
    const result = await pending;
    expect(result.error).toBeNull();
  });

  it('rolls back status transition on service error', async () => {
    useDocumentStore.setState({ documents: [mockDoc] });

    const permError: ServiceError = {
      category: 'ValidationError',
      code: 'INVALID_TRANSITION',
      message: 'Invalid transition',
      userMessage: 'Cannot transition to that status',
    };
    vi.mocked(documentService.transitionStatus).mockResolvedValue({ data: null, error: permError });

    const result = await useDocumentStore.getState().transitionStatus('doc-1', 'final');

    expect(result.error).toBe(permError.userMessage);
    expect(useDocumentStore.getState().documents[0].document_status).toBe('draft');
  });

  it('sets errorDetails on status transition failure', async () => {
    useDocumentStore.setState({ documents: [mockDoc] });
    vi.mocked(documentService.transitionStatus).mockResolvedValue({ data: null, error: mockError });

    await useDocumentStore.getState().transitionStatus('doc-1', 'submitted');

    expect(useDocumentStore.getState().errorDetails).toEqual(mockError);
  });
});

// ── deleteDocument ────────────────────────────────────────────────────────────

describe('documentStore.deleteDocument', () => {
  it('removes document optimistically', async () => {
    useDocumentStore.setState({ documents: [mockDoc] });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(documentService.deleteDocument).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof documentService.deleteDocument>,
    );

    const pending = useDocumentStore.getState().deleteDocument('doc-1');

    expect(useDocumentStore.getState().documents).toHaveLength(0);

    resolveService({ data: null, error: null });
    const result = await pending;
    expect(result.error).toBeNull();
  });

  it('restores document on service error', async () => {
    useDocumentStore.setState({ documents: [mockDoc] });
    vi.mocked(documentService.deleteDocument).mockResolvedValue({ data: null, error: mockError });

    await useDocumentStore.getState().deleteDocument('doc-1');

    expect(useDocumentStore.getState().documents).toHaveLength(1);
    expect(useDocumentStore.getState().documents[0].id).toBe('doc-1');
  });
});
