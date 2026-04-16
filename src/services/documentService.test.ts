import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockGetSession = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession() },
  },
}))

// Mock documentMachine to avoid theme/color dependencies in isolation
vi.mock('../machines/documentMachine', () => ({
  getValidTransitions: vi.fn((status: string, role: string) => {
    const isAdminOrOwner = role === 'admin' || role === 'owner'
    const canReview = isAdminOrOwner || role === 'manager' || role === 'project_manager'
    if (status === 'draft') return ['under_review']
    if (status === 'under_review' && canReview) return ['approved', 'draft']
    if (status === 'under_review') return []
    if (status === 'approved' && isAdminOrOwner) return ['archived']
    if (status === 'archived' && isAdminOrOwner) return ['draft']
    return []
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
    data: singleData ?? (Array.isArray(listData) && listData.length > 0 ? listData[0] : null),
    error,
  }
  const listResult = { data: listData, error }

  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.ilike = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const DOCUMENT = {
  id: 'doc-1',
  project_id: 'proj-1',
  title: 'Structural Steel Shop Drawings',
  description: null,
  status: 'draft',
  file_url: 'https://storage.example.com/drawings.pdf',
  file_size: 204800,
  content_type: 'application/pdf',
  folder: null,
  tags: null,
  discipline: 'Structural',
  trade: null,
  reviewer_id: null,
  created_by: 'user-1',
  updated_by: 'user-1',
  deleted_at: null,
  deleted_by: null,
  created_at: '2026-04-16T10:00:00Z',
  updated_at: '2026-04-16T10:00:00Z',
}

// ---------------------------------------------------------------------------
// loadDocuments
// ---------------------------------------------------------------------------
describe('documentService.loadDocuments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns document list filtered to deleted_at IS NULL', async () => {
    mockFrom.mockReturnValue(makeChain([DOCUMENT]))

    const result = await documentService.loadDocuments('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe('doc-1')
    // Verify soft-delete filter was applied
    const chain = mockFrom.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    expect((chain.is as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['deleted_at', null])
  })

  it('returns empty array when no documents exist', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await documentService.loadDocuments('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('propagates database error via ServiceError', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'relation "documents" does not exist' }))

    const result = await documentService.loadDocuments('proj-1')

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
    expect(result.error!.message).toContain('relation "documents" does not exist')
  })
})

// ---------------------------------------------------------------------------
// createDocument
// ---------------------------------------------------------------------------
describe('documentService.createDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets status to draft and stamps created_by / updated_by', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain([DOCUMENT], null, DOCUMENT)
    chain.insert = vi.fn().mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const result = await documentService.createDocument({
      project_id: 'proj-1',
      title: 'Structural Steel Shop Drawings',
      content_type: 'application/pdf',
    })

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()

    const insertPayload = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.status).toBe('draft')
    expect(insertPayload.created_by).toBe('user-1')
    expect(insertPayload.updated_by).toBe('user-1')
  })

  it('handles unauthenticated user by setting created_by to null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const chain = makeChain([DOCUMENT], null, DOCUMENT)
    chain.insert = vi.fn().mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    await documentService.createDocument({ project_id: 'proj-1', title: 'Test Doc' })

    const insertPayload = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.created_by).toBeNull()
  })

  it('returns DatabaseError when insert fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain(null, { message: 'insert failed' })
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })
    mockFrom.mockReturnValue(chain)

    const result = await documentService.createDocument({ project_id: 'proj-1', title: 'Bad Doc' })

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// transitionStatus (lifecycle state machine)
// ---------------------------------------------------------------------------
describe('documentService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('transitions draft to under_review for any project member', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const docChain = makeChain([DOCUMENT], null, DOCUMENT)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(docChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await documentService.transitionStatus('doc-1', 'under_review')
    expect(result.error).toBeNull()
  })

  it('rejects viewer transitioning under_review to approved', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const inReviewDoc = { ...DOCUMENT, status: 'under_review' }
    const docChain = makeChain([inReviewDoc], null, inReviewDoc)
    const roleChain = makeChain([{ role: 'viewer' }], null, { role: 'viewer' })

    mockFrom
      .mockReturnValueOnce(docChain)
      .mockReturnValueOnce(roleChain)

    const result = await documentService.transitionStatus('doc-1', 'approved')
    expect(result.error).not.toBeNull()
    expect(result.error!.category).toBe('ValidationError')
    expect(result.error!.message).toContain('Invalid transition')
  })

  it('rejects transition for user not in project', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-stranger' } } } })

    const docChain = makeChain([DOCUMENT], null, DOCUMENT)
    const roleChain = makeChain([], null, null)
    roleChain.single = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(docChain)
      .mockReturnValueOnce(roleChain)

    const result = await documentService.transitionStatus('doc-1', 'under_review')
    expect(result.error).not.toBeNull()
    expect(result.error!.category).toBe('PermissionError')
  })

  it('returns NotFoundError when document does not exist', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain(null, null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await documentService.transitionStatus('doc-missing', 'under_review')
    expect(result.error).not.toBeNull()
    expect(result.error!.category).toBe('NotFoundError')
  })

  it('allows admin to approve from under_review', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'admin-1' } } } })

    const inReviewDoc = { ...DOCUMENT, status: 'under_review' }
    const docChain = makeChain([inReviewDoc], null, inReviewDoc)
    const roleChain = makeChain([{ role: 'admin' }], null, { role: 'admin' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(docChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await documentService.transitionStatus('doc-1', 'approved')
    expect(result.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// deleteDocument (soft-delete)
// ---------------------------------------------------------------------------
describe('documentService.deleteDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by setting deleted_at and deleted_by (never hard deletes)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await documentService.deleteDocument('doc-1')

    expect(result.error).toBeNull()
    const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload).toHaveProperty('deleted_at')
    expect(payload).toHaveProperty('deleted_by', 'user-1')
    expect(payload.deleted_at).toBeTruthy()
  })

  it('returns DatabaseError when update fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: { message: 'update failed' } })
    mockFrom.mockReturnValue(chain)

    const result = await documentService.deleteDocument('doc-1')

    expect(result.error).not.toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// updateDocument
// ---------------------------------------------------------------------------
describe('documentService.updateDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status field to enforce state machine', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.is = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await documentService.updateDocument('doc-1', {
      title: 'Revised Drawings',
      // Casting to simulate a bad caller bypassing types
      ...(({ status: 'approved' }) as unknown as object),
    })

    const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload).not.toHaveProperty('status')
    expect(payload.title).toBe('Revised Drawings')
    expect(payload.updated_by).toBe('user-1')
  })
})

// ---------------------------------------------------------------------------
// searchDocuments
// ---------------------------------------------------------------------------
describe('documentService.searchDocuments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('searches by title with soft-delete filter', async () => {
    const hit = { id: 'doc-1', title: 'Structural Steel Shop Drawings', discipline: 'Structural' }
    mockFrom.mockReturnValue(makeChain([hit]))

    const result = await documentService.searchDocuments('proj-1', 'structural')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].title).toBe('Structural Steel Shop Drawings')

    const chain = mockFrom.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    const ilikeCalls = (chain.ilike as ReturnType<typeof vi.fn>).mock.calls
    expect(ilikeCalls[0]).toEqual(['title', '%structural%'])
  })

  it('returns empty array when no matches', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await documentService.searchDocuments('proj-1', 'nonexistent')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })
})
