import { describe, it, expect } from 'vitest';
import {
  buildPayload,
  sha256Hex,
  verifyChain,
  type AuditLogRow,
} from '../hashChainVerifier';

const baseRow = (overrides: Partial<AuditLogRow> = {}): AuditLogRow => ({
  id: 'r1',
  created_at: '2026-04-30T10:00:00.000Z',
  user_id: 'u1',
  user_email: 'a@example.com',
  project_id: 'p1',
  organization_id: 'o1',
  entity_type: 'rfi',
  entity_id: 'e1',
  action: 'create',
  before_state: null,
  after_state: { status: 'open' },
  changed_fields: ['status'],
  metadata: {},
  previous_hash: null,
  entry_hash: null,
  ...overrides,
});

/** Build a chronological chain by recomputing each row's hashes. */
async function buildValidChain(rows: ReadonlyArray<AuditLogRow>): Promise<AuditLogRow[]> {
  const out: AuditLogRow[] = [];
  let prev: string | null = null;
  for (const r of rows) {
    const payload = buildPayload(r, prev);
    const entry = await sha256Hex(payload);
    const filled = { ...r, previous_hash: prev, entry_hash: entry };
    out.push(filled);
    prev = entry;
  }
  return out;
}

describe('hashChainVerifier', () => {
  it('returns ok=true for an empty chain', async () => {
    const r = await verifyChain([]);
    expect(r).toEqual({ ok: true, total: 0, gaps: [] });
  });

  it('verifies a clean single-row chain', async () => {
    const chain = await buildValidChain([baseRow({ id: 'a' })]);
    const r = await verifyChain(chain);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(1);
    expect(r.gaps).toEqual([]);
  });

  it('verifies a clean multi-row chain', async () => {
    const chain = await buildValidChain([
      baseRow({ id: 'a', action: 'create' }),
      baseRow({ id: 'b', action: 'update', created_at: '2026-04-30T10:01:00.000Z' }),
      baseRow({ id: 'c', action: 'close',  created_at: '2026-04-30T10:02:00.000Z' }),
    ]);
    const r = await verifyChain(chain);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(3);
  });

  it('detects an entry_hash mismatch when a row was tampered with', async () => {
    const chain = await buildValidChain([
      baseRow({ id: 'a' }),
      baseRow({ id: 'b', created_at: '2026-04-30T10:01:00.000Z' }),
    ]);
    // Mutate row b's after_state without re-hashing.
    const tampered = chain.map((r) =>
      r.id === 'b' ? { ...r, after_state: { status: 'TAMPERED' } } : r,
    );
    const result = await verifyChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].row_id).toBe('b');
    expect(result.gaps[0].reason).toBe('entry_hash_mismatch');
  });

  it('detects a previous_hash mismatch when a row was inserted out of order', async () => {
    const chain = await buildValidChain([
      baseRow({ id: 'a' }),
      baseRow({ id: 'b', created_at: '2026-04-30T10:01:00.000Z' }),
    ]);
    // Forge a row 'c' whose previous_hash points at 'a' instead of 'b'.
    const forged: AuditLogRow = {
      ...baseRow({ id: 'c', created_at: '2026-04-30T10:02:00.000Z' }),
      previous_hash: chain[0].entry_hash, // wrong: should point at b
      entry_hash: 'deadbeef',
    };
    const result = await verifyChain([...chain, forged]);
    expect(result.ok).toBe(false);
    // Both "previous_hash points at wrong row" and "entry_hash doesn't
    // match the recomputed value" surface as gaps.
    expect(result.gaps.find((g) => g.reason === 'previous_hash_mismatch')).toBeDefined();
  });

  it('detects a missing entry_hash row', async () => {
    const chain = await buildValidChain([baseRow({ id: 'a' })]);
    const broken: AuditLogRow = { ...chain[0], entry_hash: null };
    const result = await verifyChain([broken]);
    expect(result.ok).toBe(false);
    expect(result.gaps[0].reason).toBe('missing_entry_hash');
  });

  it('flags a non-null previous_hash on the first row', async () => {
    const chain = await buildValidChain([baseRow({ id: 'a' })]);
    const broken: AuditLogRow = { ...chain[0], previous_hash: 'notnull' };
    const result = await verifyChain([broken]);
    expect(result.gaps.some((g) => g.reason === 'previous_hash_mismatch')).toBe(true);
  });

  it('flags a missing previous_hash on a non-first row', async () => {
    const chain = await buildValidChain([
      baseRow({ id: 'a' }),
      baseRow({ id: 'b', created_at: '2026-04-30T10:01:00.000Z' }),
    ]);
    const broken = chain.map((r) =>
      r.id === 'b' ? { ...r, previous_hash: null } : r,
    );
    const result = await verifyChain(broken);
    expect(result.gaps.some((g) => g.reason === 'missing_previous_hash_for_non_first')).toBe(true);
  });

  it('reports gaps in the order they are encountered', async () => {
    const chain = await buildValidChain([
      baseRow({ id: 'a' }),
      baseRow({ id: 'b', created_at: '2026-04-30T10:01:00.000Z' }),
      baseRow({ id: 'c', created_at: '2026-04-30T10:02:00.000Z' }),
    ]);
    const tampered = chain.map((r) =>
      r.id === 'b' ? { ...r, entry_hash: 'wrong' } : r,
    );
    const result = await verifyChain(tampered);
    // 'b' surfaces directly (entry_hash_mismatch).
    // 'c' likely surfaces too (its previous_hash points at the original
    // hash for 'b', which we replaced with 'wrong' — its previous_hash
    // no longer matches what verifyChain expects).
    expect(result.gaps.length).toBeGreaterThanOrEqual(1);
    expect(result.gaps[0].row_id).toBe('b');
  });
});

describe('buildPayload', () => {
  it('renders null fields as empty strings', () => {
    const payload = buildPayload(
      baseRow({ user_id: null, user_email: null, project_id: null, organization_id: null, before_state: null, after_state: null, changed_fields: null }),
      null,
    );
    // The pipe-separated parts include exactly 14 separators (15 segments).
    expect(payload.split('|')).toHaveLength(14);
  });

  it('serializes metadata as "{}" when null', () => {
    const payload = buildPayload(baseRow({ metadata: null }), null);
    expect(payload).toContain('|{}|');
  });

  it('joins changed_fields with commas, no spaces', () => {
    const payload = buildPayload(
      baseRow({ changed_fields: ['status', 'assigned_to'] }),
      null,
    );
    expect(payload).toContain('|status,assigned_to|');
  });

  it('renders before_state and after_state as JSON strings without whitespace', () => {
    const payload = buildPayload(
      baseRow({ before_state: { a: 1 }, after_state: { a: 2, b: 'x' } }),
      null,
    );
    expect(payload).toContain('{"a":1}');
    expect(payload).toContain('{"a":2,"b":"x"}');
    expect(payload).not.toContain(' ');  // no whitespace anywhere in serialized JSON
  });

  it('appends prevHash at the end', () => {
    const p1 = buildPayload(baseRow(), null);
    const p2 = buildPayload(baseRow(), 'abc123');
    expect(p2.endsWith('|abc123')).toBe(true);
    expect(p1.endsWith('|')).toBe(true);
  });
});

describe('sha256Hex', () => {
  it('produces stable hex digests', async () => {
    const h = await sha256Hex('hello');
    expect(h).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
  it('produces different digests for different inputs', async () => {
    const a = await sha256Hex('a');
    const b = await sha256Hex('b');
    expect(a).not.toBe(b);
  });
});
