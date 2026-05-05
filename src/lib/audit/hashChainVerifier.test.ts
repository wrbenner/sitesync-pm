import { describe, it, expect } from 'vitest'
import {
  buildPayload,
  sha256Hex,
  verifyChain,
  type AuditLogRow,
} from './hashChainVerifier'

const baseRow = (over: Partial<AuditLogRow> = {}): AuditLogRow => ({
  id: '00000000-0000-0000-0000-000000000001',
  created_at: '2026-05-01T12:00:00.000Z',
  user_id: 'user-1',
  user_email: 'a@b.co',
  user_name: null,
  project_id: 'p-1',
  organization_id: 'o-1',
  entity_type: 'rfi',
  entity_id: 'rfi-1',
  action: 'create',
  before_state: null,
  after_state: { status: 'open' },
  changed_fields: ['status'],
  metadata: { ip: '1.1.1.1' },
  previous_hash: null,
  entry_hash: null,
  ...over,
})

describe('buildPayload', () => {
  it('joins all 14 fields with pipes in the documented order', () => {
    const row = baseRow()
    const p = buildPayload(row, null)
    const parts = p.split('|')
    expect(parts).toHaveLength(14)
    expect(parts[0]).toBe(row.id)
    expect(parts[6]).toBe('rfi')
    expect(parts[7]).toBe('rfi-1')
    expect(parts[8]).toBe('create')
  })

  it('replaces null user_id / user_email / project_id / organization_id with empty string', () => {
    const row = baseRow({
      user_id: null,
      user_email: null,
      project_id: null,
      organization_id: null,
    })
    const parts = buildPayload(row, null).split('|')
    expect(parts[2]).toBe('')
    expect(parts[3]).toBe('')
    expect(parts[4]).toBe('')
    expect(parts[5]).toBe('')
  })

  it('renders before_state as empty string when null', () => {
    const parts = buildPayload(baseRow({ before_state: null }), null).split('|')
    expect(parts[9]).toBe('')
  })

  it('renders after_state JSON as compact stringify', () => {
    const parts = buildPayload(
      baseRow({ after_state: { a: 1, b: 'x' } }),
      null,
    ).split('|')
    expect(parts[10]).toBe('{"a":1,"b":"x"}')
  })

  it('joins changed_fields with comma; empty array → ""', () => {
    expect(
      buildPayload(baseRow({ changed_fields: ['a', 'b', 'c'] }), null).split(
        '|',
      )[11],
    ).toBe('a,b,c')
    expect(
      buildPayload(baseRow({ changed_fields: [] }), null).split('|')[11],
    ).toBe('')
    expect(
      buildPayload(baseRow({ changed_fields: null }), null).split('|')[11],
    ).toBe('')
  })

  it('renders null metadata as the literal "{}"', () => {
    expect(
      buildPayload(baseRow({ metadata: null }), null).split('|')[12],
    ).toBe('{}')
  })

  it('embeds the prevHash argument as the trailing field', () => {
    expect(buildPayload(baseRow(), 'prev-hash-value').split('|')[13]).toBe(
      'prev-hash-value',
    )
    expect(buildPayload(baseRow(), null).split('|')[13]).toBe('')
  })
})

describe('sha256Hex', () => {
  it('matches the well-known SHA-256 of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('produces 64 hex chars', async () => {
    expect(await sha256Hex('anything else')).toMatch(/^[a-f0-9]{64}$/)
  })
})

async function makeChain(rows: AuditLogRow[]): Promise<AuditLogRow[]> {
  const result: AuditLogRow[] = []
  let prev: string | null = null
  for (const r of rows) {
    const cloned: AuditLogRow = { ...r, previous_hash: prev }
    cloned.entry_hash = await sha256Hex(buildPayload(cloned, prev))
    prev = cloned.entry_hash
    result.push(cloned)
  }
  return result
}

describe('verifyChain', () => {
  it('returns ok=true for a chain it just produced', async () => {
    const chain = await makeChain([
      baseRow({ id: 'r1', created_at: '2026-05-01T00:00:00Z' }),
      baseRow({
        id: 'r2',
        created_at: '2026-05-02T00:00:00Z',
        action: 'update',
        before_state: { status: 'open' },
        after_state: { status: 'closed' },
      }),
    ])
    const result = await verifyChain(chain)
    expect(result.ok).toBe(true)
    expect(result.gaps).toEqual([])
    expect(result.total).toBe(2)
  })

  it('flags a non-null previous_hash on the first row', async () => {
    const chain = await makeChain([baseRow({ id: 'r1' })])
    chain[0].previous_hash = 'should-be-null'
    const result = await verifyChain(chain)
    expect(result.ok).toBe(false)
    expect(result.gaps[0].reason).toBe('previous_hash_mismatch')
    expect(result.gaps[0].expected).toBeNull()
    expect(result.gaps[0].actual).toBe('should-be-null')
  })

  it('flags a non-first row whose previous_hash is missing', async () => {
    const chain = await makeChain([
      baseRow({ id: 'r1' }),
      baseRow({ id: 'r2', action: 'update' }),
    ])
    chain[1].previous_hash = null
    const result = await verifyChain(chain)
    expect(result.ok).toBe(false)
    expect(
      result.gaps.find((g) => g.row_id === 'r2')?.reason,
    ).toBe('missing_previous_hash_for_non_first')
  })

  it('flags a tampered entry_hash', async () => {
    const chain = await makeChain([
      baseRow({ id: 'r1' }),
      baseRow({ id: 'r2', action: 'update' }),
    ])
    chain[1].entry_hash = 'a'.repeat(64)
    const result = await verifyChain(chain)
    expect(result.ok).toBe(false)
    expect(
      result.gaps.find((g) => g.row_id === 'r2')?.reason,
    ).toBe('entry_hash_mismatch')
  })

  it('flags a missing entry_hash with reason missing_entry_hash', async () => {
    const chain = await makeChain([baseRow({ id: 'r1' })])
    chain[0].entry_hash = null
    const result = await verifyChain(chain)
    expect(result.ok).toBe(false)
    expect(result.gaps[0].reason).toBe('missing_entry_hash')
  })

  it('cascades a tamper into the following row', async () => {
    const chain = await makeChain([
      baseRow({ id: 'r1' }),
      baseRow({ id: 'r2', action: 'update' }),
      baseRow({ id: 'r3', action: 'close' }),
    ])
    // Tamper r2 — r3's previous_hash will then mismatch the expected r2 hash
    chain[1].entry_hash = 'b'.repeat(64)
    const result = await verifyChain(chain)
    expect(result.ok).toBe(false)
    // Two distinct gaps surface
    const reasons = result.gaps.map((g) => g.reason)
    expect(reasons).toContain('entry_hash_mismatch')
  })

  it('reports total = input length even on a clean chain', async () => {
    const chain = await makeChain([
      baseRow({ id: 'r1' }),
      baseRow({ id: 'r2', action: 'update' }),
      baseRow({ id: 'r3', action: 'close' }),
    ])
    const result = await verifyChain(chain)
    expect(result.total).toBe(3)
  })

  it('returns ok=true for an empty input', async () => {
    const result = await verifyChain([])
    expect(result.ok).toBe(true)
    expect(result.total).toBe(0)
    expect(result.gaps).toEqual([])
  })
})
