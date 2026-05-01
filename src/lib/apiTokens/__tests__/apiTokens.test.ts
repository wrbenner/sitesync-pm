import { describe, it, expect } from 'vitest';
import {
  mintToken,
  verifyToken,
  hasScope,
  hasProjectAccess,
  maskToken,
  envFromToken,
  constantTimeEqual,
} from '../index';

describe('mintToken', () => {
  it('produces a token of expected shape', async () => {
    const m = await mintToken();
    expect(m.token).toMatch(/^ss_live_[A-Z0-9]{20,}$/);
    expect(m.prefix).toMatch(/^ss_live_[A-Z0-9]{6}$/);
    expect(m.hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('respects env=test', async () => {
    const m = await mintToken({ env: 'test' });
    expect(m.token).toMatch(/^ss_test_/);
    expect(m.prefix).toMatch(/^ss_test_/);
  });
  it('two mints produce different tokens', async () => {
    const a = await mintToken();
    const b = await mintToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
  it('hash is deterministic for the same token', async () => {
    const a = await mintToken();
    const computed = await (await import('../index')).sha256Hex(a.token);
    expect(computed).toBe(a.hash);
  });
});

describe('verifyToken', () => {
  it('returns true on match', async () => {
    const m = await mintToken();
    expect(await verifyToken(m.token, m.hash)).toBe(true);
  });
  it('returns false on mismatch', async () => {
    const m = await mintToken();
    expect(await verifyToken('ss_live_NOPE000000000000000000', m.hash)).toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it('returns true for equal strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
  });
  it('returns false for different lengths', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
  it('returns false for different content of same length', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
  });
});

describe('hasScope', () => {
  it('"*" grants every scope', () => {
    expect(hasScope(['*'], 'rfis.create')).toBe(true);
  });
  it('exact match', () => {
    expect(hasScope(['rfis.create'], 'rfis.create')).toBe(true);
  });
  it('wildcard match', () => {
    expect(hasScope(['rfis.*'], 'rfis.create')).toBe(true);
    expect(hasScope(['rfis.*'], 'submittals.create')).toBe(false);
  });
  it('empty granted list = no scope', () => {
    expect(hasScope([], 'anything')).toBe(false);
  });
});

describe('hasProjectAccess', () => {
  it('null tokenProjectIds = all projects', () => {
    expect(hasProjectAccess(null, 'p1')).toBe(true);
    expect(hasProjectAccess(undefined, 'p1')).toBe(true);
    expect(hasProjectAccess([], 'p1')).toBe(true);
  });
  it('exact id match', () => {
    expect(hasProjectAccess(['p1', 'p2'], 'p1')).toBe(true);
    expect(hasProjectAccess(['p1', 'p2'], 'p3')).toBe(false);
  });
});

describe('maskToken', () => {
  it('masks the secret portion', () => {
    expect(maskToken('ss_live_AB12CDXXXXXXXXXXXXXXX')).toBe('ss_live_AB12CD…');
    expect(maskToken('ss_test_XYZ789')).toBe('ss_test_XYZ789…');
    expect(maskToken('garbage')).toBe('****');
  });
});

describe('envFromToken', () => {
  it('classifies live and test tokens', () => {
    expect(envFromToken('ss_live_xxx')).toBe('live');
    expect(envFromToken('ss_test_xxx')).toBe('test');
    expect(envFromToken('ss_other_xxx')).toBeNull();
  });
});
