// Phase 4 — submittalPackagesService tests.
//
// Mocks supabase + the typed table helper (fromTable). Validates the four
// mutation paths (create, update, setMembers, remove) plus the list reader.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc, mockFromTable } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFromTable: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
  isSupabaseConfigured: true,
}))

vi.mock('../../lib/db/queries', () => ({
  fromTable: mockFromTable,
}))

import { submittalPackagesService } from '../../services/submittalPackages'

const buildSelectChain = (result: { data: unknown; error: unknown }): Record<string, unknown> => {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  // Chain awaits — return the result via thenable.
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('submittalPackagesService.list', () => {
  it('returns rows from submittal_packages ordered by number ascending', async () => {
    const rows = [
      { id: 'p1', project_id: 'proj', number: 1, title: 'A' },
      { id: 'p2', project_id: 'proj', number: 2, title: 'B' },
    ]
    const chain = buildSelectChain({ data: rows, error: null })
    mockFromTable.mockReturnValue(chain)

    const result = await submittalPackagesService.list('proj')

    expect(mockFromTable).toHaveBeenCalledWith('submittal_packages')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'proj')
    expect(chain.order).toHaveBeenCalledWith('number', { ascending: true })
    expect(result.error).toBeNull()
    expect(result.data).toEqual(rows)
  })

  it('surfaces a DatabaseError when the query fails', async () => {
    const chain = buildSelectChain({ data: null, error: { message: 'boom' } })
    mockFromTable.mockReturnValue(chain)

    const result = await submittalPackagesService.list('proj')
    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

describe('submittalPackagesService.create', () => {
  it('calls submittal_create_package with sanitised args and returns the new id', async () => {
    mockRpc.mockResolvedValue({ data: 'new-pkg-id', error: null })

    const result = await submittalPackagesService.create({
      projectId: 'proj',
      title: 'Beacon Concrete',
      description: 'Concrete pour package',
      responsibleSubId: 'sub-1',
      csiSection: '03 30 00',
      submittalIds: ['s1', 's2'],
    })

    expect(mockRpc).toHaveBeenCalledWith('submittal_create_package', {
      p_project_id: 'proj',
      p_title: 'Beacon Concrete',
      p_description: 'Concrete pour package',
      p_responsible_sub_id: 'sub-1',
      p_csi_section: '03 30 00',
      p_submittal_ids: ['s1', 's2'],
    })
    expect(result.error).toBeNull()
    expect(result.data).toBe('new-pkg-id')
  })

  it('defaults optional fields to null and submittalIds to []', async () => {
    mockRpc.mockResolvedValue({ data: 'pkg', error: null })

    await submittalPackagesService.create({ projectId: 'p', title: 't' })

    const args = mockRpc.mock.calls[0][1] as Record<string, unknown>
    expect(args.p_description).toBeNull()
    expect(args.p_responsible_sub_id).toBeNull()
    expect(args.p_csi_section).toBeNull()
    expect(args.p_submittal_ids).toEqual([])
  })

  it('returns DatabaseError on RPC failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rls denied' } })
    const result = await submittalPackagesService.create({ projectId: 'p', title: 't' })
    expect(result.error?.category).toBe('DatabaseError')
  })
})

describe('submittalPackagesService.update', () => {
  it('calls submittal_update_package with the given id and fields', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const r = await submittalPackagesService.update({
      id: 'pkg-1',
      title: 'Renamed',
      description: null,
      responsibleSubId: 'sub-7',
      csiSection: '08 41 13',
    })

    expect(mockRpc).toHaveBeenCalledWith('submittal_update_package', {
      p_id: 'pkg-1',
      p_title: 'Renamed',
      p_description: null,
      p_responsible_sub_id: 'sub-7',
      p_csi_section: '08 41 13',
    })
    expect(r.error).toBeNull()
  })
})

describe('submittalPackagesService.setMembers', () => {
  it('passes the package id and member array verbatim', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await submittalPackagesService.setMembers('pkg-1', ['s1', 's2', 's3'])

    expect(mockRpc).toHaveBeenCalledWith('submittal_set_package_members', {
      p_package_id: 'pkg-1',
      p_submittal_ids: ['s1', 's2', 's3'],
    })
  })
})

describe('submittalPackagesService.remove', () => {
  it('calls submittal_delete_package with the id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await submittalPackagesService.remove('pkg-1')

    expect(mockRpc).toHaveBeenCalledWith('submittal_delete_package', {
      p_id: 'pkg-1',
    })
  })

  it('returns DatabaseError when delete fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fk violation' } })
    const r = await submittalPackagesService.remove('pkg-1')
    expect(r.error?.category).toBe('DatabaseError')
  })
})
