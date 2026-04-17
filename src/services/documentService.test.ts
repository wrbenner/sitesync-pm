import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockGetSession = vi.fn()
const mockStorageFrom = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession() },
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  },
}))

vi.mock('../machines/documentMachine', () => ({
  getValidDocumentTransitions: vi.fn((status: string, role: string) => {
    const isPrivileged = ['owner', 'admin', 'project_manager'].includes(role)
    const isContributor =
      isPrivileged ||
      ['superintendent', 'gc_member', 'subcontractor', 'architect', 'designer'].includes(role)

    const map: Record<string, string[]> = {
      draft:     isContributor ? ['submitted'] : [],
      submitted: isPrivileged  ? ['approved', 'rejected'] : [],
      approved:  isPrivileged  ? ['archived'] : [],
      rejected:  isContributor ? ['submitted'] : [],
      archived:  isPrivileged  ? ['approved'] : [],
      void: [],
    }

    const result = [...(map[status] ?? [])]
    if (['owner', 'admin'].includes(role) && status !== 'void') result.push('void')
    return result
  }),
}))

import { documentService } from './documentService'

// ---------------------------------------------------------------------------
// Chain builder
// ---------------------------------------------------------------------------
function makeChain(
  listData: unknown[] | null = [],
  error: { message: string } | null = null,
  singleData?: unknown,
) {
  const singleResult = {
    data: singleData !== undefined ? singleData : (Array.isArray(listData) && listData.length > 0 ? listData[0] : null),
    error,
  }
  const listResult = { data: listData, error }
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq     = vi.fn().mockReturnValue(chain)
  chain.is     = vi.fn().mockReturnValue(chain)
  chain.order  = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.then   = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

function makeStorage({
  uploadError = null as { message: string } | null,
  publicUrl = 'https://storage.example.com/file.pdf',
  signedUrl = 'https://storage.example.com/signed/file.pdf',
  removeError = null as { message: string } | null,
} = {}) {
  return {
    upload:          vi.fn().mockResolvedValue({ error: uploadError }),
    getPublicUrl:    vi.fn().mockReturnValue({ data: { publicUrl } }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl }, error: null }),
    remove:          vi.fn().mockResolvedValue({ error: removeError }),
  }
}

function mockSession(userId = 'user-1') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

const DOC = {
  id: 'doc-1',
  project_id: 'proj-1',
  name: 'Plan A.pdf',
  file_url: 'https://storage.example.com/plan-a.pdf',
  document_status: 'draft',
  version: 1,
  folder: 'Drawings',
  description: null,
  discipline: null,
  trade: null,
  tags: null,
  created_by: 'user-1',
  uploaded_by: 'user-1',
  deleted_at: null,
}

// ---------------------------------------------------------------------------
// loadDocuments
// ---------------------------------------------------------------------------
describe('documentService.loadDocuments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active documents for project', async () => {
    mockFrom.mockReturnValueOnce(makeChain([DOC]))

    const result = await documentService.loadDocuments('proj-1')
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].name).toBe('Plan A.pdf')
  })

  it('returns empty array when no documents exist', async () => {
    mockFrom.mockReturnValueOnce(makeChain([]))

    const result = await documentService.loadDocuments('proj-1')
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns DatabaseError on query failure', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Query failed' }))

    const result = await documentService.loadDocuments('proj-1')
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// loadDocumentsByStatus
// ---------------------------------------------------------------------------
describe('documentService.loadDocumentsByStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns documents filtered by status', async () => {
    mockFrom.mockReturnValueOnce(makeChain([DOC]))

    const result = await documentService.loadDocumentsByStatus('proj-1', 'draft')
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
  })

  it('returns DatabaseError on query failure', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Query failed' }))

    const result = await documentService.loadDocumentsByStatus('proj-1', 'draft')
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// createDocument
// ---------------------------------------------------------------------------
describe('documentService.createDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates document with draft status and provenance', async () => {
    mockSession('user-1')
    const insertChain = makeChain(null, null, DOC)
    mockFrom.mockReturnValueOnce(insertChain)

    const result = await documentService.createDocument({
      project_id: 'proj-1',
      name: 'Plan A.pdf',
      file_url: 'https://storage.example.com/plan-a.pdf',
    })

    expect(result.error).toBeNull()
    expect(result.data?.document_status).toBe('draft')
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_status: 'draft',
        version: 1,
        created_by: 'user-1',
        uploaded_by: 'user-1',
      }),
    )
  })

  it('returns DatabaseError on insert failure', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Insert failed' }))

    const result = await documentService.createDocument({
      project_id: 'proj-1',
      name: 'Plan A.pdf',
      file_url: 'https://storage.example.com/plan-a.pdf',
    })
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------
describe('documentService.uploadDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uploads file and creates document record', async () => {
    mockSession('user-1')
    const storage = makeStorage()
    mockStorageFrom.mockReturnValue(storage)
    mockFrom.mockReturnValueOnce(makeChain(null, null, DOC))

    const file = new File(['content'], 'plan-a.pdf', { type: 'application/pdf' })
    const result = await documentService.uploadDocument(
      { project_id: 'proj-1', name: 'Plan A' },
      file,
    )

    expect(result.error).toBeNull()
    expect(storage.upload).toHaveBeenCalled()
  })

  it('returns DatabaseError on storage upload failure', async () => {
    mockSession()
    const storage = makeStorage({ uploadError: { message: 'Storage quota exceeded' } })
    mockStorageFrom.mockReturnValue(storage)

    const file = new File(['content'], 'plan-a.pdf', { type: 'application/pdf' })
    const result = await documentService.uploadDocument(
      { project_id: 'proj-1', name: 'Plan A' },
      file,
    )

    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.message).toContain('Storage upload failed')
  })

  it('removes orphan file and returns error when DB insert fails after upload', async () => {
    mockSession()
    const storage = makeStorage()
    mockStorageFrom.mockReturnValue(storage)
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'DB insert failed' }))

    const file = new File(['content'], 'plan-a.pdf', { type: 'application/pdf' })
    const result = await documentService.uploadDocument(
      { project_id: 'proj-1', name: 'Plan A' },
      file,
    )

    expect(result.error?.category).toBe('DatabaseError')
    expect(storage.remove).toHaveBeenCalled()
  })

  it('calls onProgress callback during upload', async () => {
    mockSession()
    const onProgress = vi.fn()

    const storage = {
      upload: vi.fn().mockImplementationOnce(
        (_path: string, _file: File, opts?: { onUploadProgress?: (evt: { loaded: number; total: number }) => void }) => {
          opts?.onUploadProgress?.({ loaded: 50, total: 100 })
          return Promise.resolve({ error: null })
        },
      ),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/file.pdf' } }),
    }
    mockStorageFrom.mockReturnValue(storage)
    mockFrom.mockReturnValueOnce(makeChain(null, null, DOC))

    const file = new File(['content'], 'plan-a.pdf', { type: 'application/pdf' })
    await documentService.uploadDocument({ project_id: 'proj-1', name: 'Plan A' }, file, onProgress)

    expect(onProgress).toHaveBeenCalledWith({ loaded: 50, total: 100, percent: 50 })
  })
})

// ---------------------------------------------------------------------------
// uploadVersion
// ---------------------------------------------------------------------------
describe('documentService.uploadVersion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns NotFoundError when parent document missing', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }, null))

    const file = new File(['v2'], 'plan-a-v2.pdf', { type: 'application/pdf' })
    const result = await documentService.uploadVersion('doc-1', file)
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('creates new version record linked to parent', async () => {
    mockSession('user-1')
    const storage = makeStorage()
    mockStorageFrom.mockReturnValue(storage)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, DOC)) // fetch parent
      .mockReturnValueOnce(makeChain(null, null, { ...DOC, id: 'doc-2', version: 2, previous_version_id: 'doc-1' }))

    const file = new File(['v2'], 'plan-a-v2.pdf', { type: 'application/pdf' })
    const result = await documentService.uploadVersion('doc-1', file)

    expect(result.error).toBeNull()
    expect(storage.upload).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------
describe('documentService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('successfully transitions draft → submitted', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, DOC))
      .mockReturnValueOnce(makeChain(null, null, { role: 'gc_member' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await documentService.transitionStatus('doc-1', 'submitted')
    expect(result.error).toBeNull()
  })

  it('returns NotFoundError when document missing', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }, null))
    mockSession()

    const result = await documentService.transitionStatus('doc-1', 'submitted')
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user has no project role', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, DOC))
      .mockReturnValueOnce(makeChain(null, null, null))
    mockSession()

    const result = await documentService.transitionStatus('doc-1', 'submitted')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ValidationError for invalid transition', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, DOC))
      .mockReturnValueOnce(makeChain(null, null, { role: 'viewer' }))
    mockSession()

    const result = await documentService.transitionStatus('doc-1', 'submitted')
    expect(result.error?.category).toBe('ValidationError')
  })
})

// ---------------------------------------------------------------------------
// updateDocument
// ---------------------------------------------------------------------------
describe('documentService.updateDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates metadata fields successfully', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain([], null))

    const result = await documentService.updateDocument('doc-1', { name: 'Revised Plan A.pdf' })
    expect(result.error).toBeNull()
  })

  it('returns DatabaseError on failure', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'DB error' }))

    const result = await documentService.updateDocument('doc-1', { name: 'Test' })
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// deleteDocument
// ---------------------------------------------------------------------------
describe('documentService.deleteDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes document by setting deleted_at and deleted_by', async () => {
    mockSession('user-1')
    const chain = makeChain([], null)
    mockFrom.mockReturnValueOnce(chain)

    const result = await documentService.deleteDocument('doc-1')

    expect(result.error).toBeNull()
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        deleted_by: 'user-1',
      }),
    )
  })

  it('returns DatabaseError on failure', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'DB error' }))

    const result = await documentService.deleteDocument('doc-1')
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// getDownloadUrl
// ---------------------------------------------------------------------------
describe('documentService.getDownloadUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns signed URL', async () => {
    const storage = makeStorage({ signedUrl: 'https://storage.example.com/signed/file.pdf' })
    mockStorageFrom.mockReturnValue(storage)

    const result = await documentService.getDownloadUrl('proj-1/Drawings/file.pdf')

    expect(result.error).toBeNull()
    expect(result.data).toBe('https://storage.example.com/signed/file.pdf')
  })

  it('returns DatabaseError when signed URL creation fails', async () => {
    mockStorageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: { message: 'Access denied' } }),
    })

    const result = await documentService.getDownloadUrl('proj-1/Drawings/file.pdf')
    expect(result.error?.category).toBe('DatabaseError')
  })
})
