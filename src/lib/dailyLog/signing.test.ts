import { describe, it, expect } from 'vitest'
import {
  ZERO_HASH,
  canonicalize,
  computePayloadHash,
  computeChainHash,
  buildCheckpoint,
  verifyChain,
  type SignableDailyLog,
} from './signing'

const log = (over: Partial<SignableDailyLog> = {}): SignableDailyLog => ({
  id: '00000000-0000-0000-0000-000000000001',
  project_id: 'p-1',
  log_date: '2026-05-04',
  summary: 'Concrete pour at C/4',
  weather: 'sunny',
  temperature_high: 78,
  temperature_low: 55,
  workers_onsite: 12,
  total_hours: 96,
  incidents: 0,
  created_at: '2026-05-04T18:30:00.000Z',
  ...over,
})

describe('ZERO_HASH', () => {
  it('is 64 zero hex chars', () => {
    expect(ZERO_HASH).toBe('0'.repeat(64))
  })
})

describe('canonicalize', () => {
  it('produces stable JSON with sorted keys', () => {
    const json = canonicalize(log())
    const parsed = JSON.parse(json)
    const keys = Object.keys(parsed)
    expect(keys).toEqual([...keys].sort())
  })

  it('coerces null summary/weather to empty string', () => {
    const json = canonicalize(log({ summary: null, weather: null }))
    expect(JSON.parse(json).summary).toBe('')
    expect(JSON.parse(json).weather).toBe('')
  })

  it('preserves null numeric fields as null', () => {
    const json = canonicalize(
      log({ workers_onsite: null, total_hours: null, incidents: null }),
    )
    const obj = JSON.parse(json)
    expect(obj.workers_onsite).toBeNull()
    expect(obj.total_hours).toBeNull()
    expect(obj.incidents).toBeNull()
  })

  it('returns the same string for the same content', () => {
    expect(canonicalize(log())).toBe(canonicalize(log()))
  })

  it('produces different output when a value changes', () => {
    expect(canonicalize(log())).not.toBe(
      canonicalize(log({ summary: 'different' })),
    )
  })
})

describe('computePayloadHash', () => {
  it('returns a 64-char hex hash', async () => {
    const h = await computePayloadHash(log(), 'signer-1', '2026-05-04T19:00:00Z')
    expect(h).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic given the same inputs', async () => {
    const a = await computePayloadHash(log(), 'signer-1', '2026-05-04T19:00:00Z')
    const b = await computePayloadHash(log(), 'signer-1', '2026-05-04T19:00:00Z')
    expect(a).toBe(b)
  })

  it('changes when signerId changes', async () => {
    const a = await computePayloadHash(log(), 's1', '2026-05-04T19:00:00Z')
    const b = await computePayloadHash(log(), 's2', '2026-05-04T19:00:00Z')
    expect(a).not.toBe(b)
  })

  it('changes when signedAt changes', async () => {
    const a = await computePayloadHash(log(), 's1', '2026-05-04T19:00:00Z')
    const b = await computePayloadHash(log(), 's1', '2026-05-04T19:00:01Z')
    expect(a).not.toBe(b)
  })

  it('changes when log content changes', async () => {
    const a = await computePayloadHash(log(), 's1', 't')
    const b = await computePayloadHash(log({ summary: 'different' }), 's1', 't')
    expect(a).not.toBe(b)
  })
})

describe('computeChainHash', () => {
  it('returns a 64-char hex hash', async () => {
    const h = await computeChainHash(ZERO_HASH, 'a'.repeat(64))
    expect(h).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await computeChainHash('p', 'q')
    const b = await computeChainHash('p', 'q')
    expect(a).toBe(b)
  })

  it('changes with prevHash', async () => {
    const a = await computeChainHash('p1', 'h')
    const b = await computeChainHash('p2', 'h')
    expect(a).not.toBe(b)
  })

  it('changes with payloadHash', async () => {
    const a = await computeChainHash('p', 'h1')
    const b = await computeChainHash('p', 'h2')
    expect(a).not.toBe(b)
  })
})

describe('buildCheckpoint', () => {
  it('emits a fully populated checkpoint', async () => {
    const cp = await buildCheckpoint({
      log: log(),
      prevHash: ZERO_HASH,
      signerId: 's1',
      signedAt: '2026-05-04T19:00:00Z',
    })
    expect(cp.entityType).toBe('daily_log')
    expect(cp.entityId).toBe(log().id)
    expect(cp.signerId).toBe('s1')
    expect(cp.prevHash).toBe(ZERO_HASH)
    expect(cp.payloadHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cp.chainHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cp.canonicalPayload).toBe(canonicalize(log()))
  })

  it('chains forward — second checkpoint references first chainHash', async () => {
    const first = await buildCheckpoint({
      log: log(),
      prevHash: ZERO_HASH,
      signerId: 's1',
      signedAt: '2026-05-04T19:00:00Z',
    })
    const second = await buildCheckpoint({
      log: log({ id: 'log-2', log_date: '2026-05-05' }),
      prevHash: first.chainHash,
      signerId: 's1',
      signedAt: '2026-05-05T19:00:00Z',
    })
    expect(second.prevHash).toBe(first.chainHash)
    // Second's chain hash recomputes from prev + payload
    const expected = await computeChainHash(first.chainHash, second.payloadHash)
    expect(second.chainHash).toBe(expected)
  })
})

async function makeChain(n: number): Promise<
  Array<{ prevHash: string; payloadHash: string; chainHash: string }>
> {
  const out: Array<{ prevHash: string; payloadHash: string; chainHash: string }> =
    []
  let prev = ZERO_HASH
  for (let i = 0; i < n; i++) {
    const cp = await buildCheckpoint({
      log: log({ id: `log-${i}`, log_date: `2026-05-${i + 1}` }),
      prevHash: prev,
      signerId: 's1',
      signedAt: `2026-05-${i + 1}T19:00:00Z`,
    })
    out.push({ prevHash: cp.prevHash, payloadHash: cp.payloadHash, chainHash: cp.chainHash })
    prev = cp.chainHash
  }
  return out
}

describe('verifyChain', () => {
  it('returns -1 for a clean chain', async () => {
    const chain = await makeChain(3)
    expect(await verifyChain(chain)).toBe(-1)
  })

  it('flags index 0 when first prevHash is not ZERO_HASH', async () => {
    const chain = await makeChain(2)
    chain[0].prevHash = 'a'.repeat(64)
    expect(await verifyChain(chain)).toBe(0)
  })

  it('skips the root check when startsAtRoot=false', async () => {
    const chain = await makeChain(2)
    // Recompute chainHash to keep self-consistency, but use non-zero prevHash
    chain[0].prevHash = 'b'.repeat(64)
    chain[0].chainHash = await computeChainHash(chain[0].prevHash, chain[0].payloadHash)
    chain[1].prevHash = chain[0].chainHash
    chain[1].chainHash = await computeChainHash(chain[1].prevHash, chain[1].payloadHash)
    expect(await verifyChain(chain, false)).toBe(-1)
  })

  it('flags the row whose prevHash does not match prior chainHash', async () => {
    const chain = await makeChain(3)
    chain[2].prevHash = 'c'.repeat(64)
    expect(await verifyChain(chain)).toBe(2)
  })

  it('flags the row whose chainHash is tampered', async () => {
    const chain = await makeChain(3)
    chain[1].chainHash = 'd'.repeat(64)
    expect(await verifyChain(chain)).toBe(1)
  })

  it('returns -1 for an empty chain', async () => {
    expect(await verifyChain([])).toBe(-1)
  })
})
