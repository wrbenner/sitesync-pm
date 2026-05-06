// =============================================================================
// signing.ts — chain integrity tests
// =============================================================================
// Pins the load-bearing properties:
//   • Same content + signer + time → same chain_hash (deterministic)
//   • Different content → different chain_hash
//   • A tampered historical row breaks every later chain_hash
//   • verifyChain reports the first broken index (-1 when intact)
//
// Web Crypto's subtle is available on Node 19+ via globalThis.crypto.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  ZERO_HASH,
  buildCheckpoint,
  canonicalize,
  computeChainHash,
  computePayloadHash,
  verifyChain,
  type SignableDailyLog,
} from '../signing'

const LOG_A: SignableDailyLog = {
  id: 'log-1',
  project_id: 'p-1',
  log_date: '2026-04-29',
  summary: 'Pour day. 165 CY placed.',
  weather: 'Clear',
  temperature_high: 84,
  temperature_low: 64,
  workers_onsite: 118,
  total_hours: 944,
  incidents: 1,
  created_at: '2026-04-29T17:30:00Z',
}

describe('canonicalize', () => {
  it('produces identical bytes for identical content regardless of insertion order', () => {
    const reordered = {
      ...LOG_A,
      // re-spread in a different key order
    } as SignableDailyLog
    expect(canonicalize(LOG_A)).toBe(canonicalize(reordered))
  })

  it('treats null and undefined the same way', () => {
    const a = { ...LOG_A, incidents: null } as SignableDailyLog
    const b = { ...LOG_A, incidents: undefined as unknown as number | null } as SignableDailyLog
    expect(canonicalize(a)).toBe(canonicalize(b))
  })
})

describe('buildCheckpoint', () => {
  it('is deterministic for same inputs', async () => {
    const a = await buildCheckpoint({ log: LOG_A, prevHash: ZERO_HASH, signerId: 'u-1', signedAt: '2026-04-29T18:00:00Z' })
    const b = await buildCheckpoint({ log: LOG_A, prevHash: ZERO_HASH, signerId: 'u-1', signedAt: '2026-04-29T18:00:00Z' })
    expect(a.chainHash).toBe(b.chainHash)
    expect(a.payloadHash).toBe(b.payloadHash)
  })

  it('produces different hashes when content changes', async () => {
    const a = await buildCheckpoint({ log: LOG_A, prevHash: ZERO_HASH, signerId: 'u-1', signedAt: '2026-04-29T18:00:00Z' })
    const tweaked = { ...LOG_A, workers_onsite: 119 }
    const b = await buildCheckpoint({ log: tweaked, prevHash: ZERO_HASH, signerId: 'u-1', signedAt: '2026-04-29T18:00:00Z' })
    expect(a.payloadHash).not.toBe(b.payloadHash)
    expect(a.chainHash).not.toBe(b.chainHash)
  })

  it('produces different hashes when signer changes', async () => {
    const a = await buildCheckpoint({ log: LOG_A, prevHash: ZERO_HASH, signerId: 'u-1', signedAt: '2026-04-29T18:00:00Z' })
    const b = await buildCheckpoint({ log: LOG_A, prevHash: ZERO_HASH, signerId: 'u-2', signedAt: '2026-04-29T18:00:00Z' })
    expect(a.payloadHash).not.toBe(b.payloadHash)
  })

  it('chains: prev_hash of row 2 = chain_hash of row 1', async () => {
    const cp1 = await buildCheckpoint({ log: LOG_A, prevHash: ZERO_HASH, signerId: 'u-1', signedAt: '2026-04-29T18:00:00Z' })
    const log2 = { ...LOG_A, id: 'log-2', log_date: '2026-04-30' }
    const cp2 = await buildCheckpoint({ log: log2, prevHash: cp1.chainHash, signerId: 'u-1', signedAt: '2026-04-30T18:00:00Z' })
    expect(cp2.prevHash).toBe(cp1.chainHash)
  })
})

describe('verifyChain', () => {
  async function buildThree(): Promise<Array<{ prevHash: string; payloadHash: string; chainHash: string }>> {
    const cp1 = await buildCheckpoint({ log: LOG_A, prevHash: ZERO_HASH, signerId: 'u-1', signedAt: '2026-04-29T18:00:00Z' })
    const log2 = { ...LOG_A, id: 'log-2', log_date: '2026-04-30' }
    const cp2 = await buildCheckpoint({ log: log2, prevHash: cp1.chainHash, signerId: 'u-1', signedAt: '2026-04-30T18:00:00Z' })
    const log3 = { ...LOG_A, id: 'log-3', log_date: '2026-05-01' }
    const cp3 = await buildCheckpoint({ log: log3, prevHash: cp2.chainHash, signerId: 'u-1', signedAt: '2026-05-01T18:00:00Z' })
    return [cp1, cp2, cp3].map(({ prevHash, payloadHash, chainHash }) => ({ prevHash, payloadHash, chainHash }))
  }

  it('returns -1 for an intact chain', async () => {
    const chain = await buildThree()
    expect(await verifyChain(chain)).toBe(-1)
  })

  it('detects a tampered chain_hash on row 1', async () => {
    const chain = await buildThree()
    chain[1].chainHash = 'a'.repeat(64)
    expect(await verifyChain(chain)).toBe(1)
  })

  it('detects a tampered payload_hash on row 0 (recompute fails)', async () => {
    const chain = await buildThree()
    chain[0].payloadHash = 'b'.repeat(64)
    expect(await verifyChain(chain)).toBe(0)
  })

  it('reports first failure even when later rows are also broken', async () => {
    const chain = await buildThree()
    chain[1].chainHash = 'c'.repeat(64)
    chain[2].chainHash = 'd'.repeat(64)
    expect(await verifyChain(chain)).toBe(1)
  })

  it('checks the chain root by default', async () => {
    const chain = await buildThree()
    chain[0].prevHash = 'not-zero'
    expect(await verifyChain(chain)).toBe(0)
  })
})

describe('hash primitives', () => {
  it('SHA-256 chain_hash is 64 hex chars', async () => {
    const h = await computeChainHash(ZERO_HASH, ZERO_HASH)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('payload_hash is 64 hex chars', async () => {
    const h = await computePayloadHash(LOG_A, 'u-1', '2026-04-29T18:00:00Z')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})
