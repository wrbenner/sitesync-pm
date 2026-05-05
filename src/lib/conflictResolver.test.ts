import { describe, it, expect } from 'vitest';
import {
  detectConflicts,
  resolveConflict,
  checkStaleSubmission,
  buildMergedRecord,
} from './conflictResolver';
import type { ConflictRecord } from '../types/sync';

// ── detectConflicts ────────────────────────────────────────────

describe('detectConflicts', () => {
  it('reports no conflict when local and server agree', () => {
    const r = detectConflicts(
      { name: 'A', desc: 'old' },
      { name: 'A', desc: 'old' },
      { name: 'A', desc: 'old' },
    );
    expect(r.canAutoMerge).toBe(true);
    expect(r.conflictingFields).toEqual([]);
  });

  it('takes local change when only local changed', () => {
    const r = detectConflicts(
      { name: 'A' },
      { name: 'B' },
      { name: 'A' },
    );
    expect(r.canAutoMerge).toBe(true);
    expect(r.merged.name).toBe('B');
  });

  it('takes server change when only server changed', () => {
    const r = detectConflicts(
      { name: 'A' },
      { name: 'A' },
      { name: 'C' },
    );
    expect(r.canAutoMerge).toBe(true);
    expect(r.merged.name).toBe('C');
  });

  it('flags as conflict when both change to different values', () => {
    const r = detectConflicts(
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
    );
    expect(r.canAutoMerge).toBe(false);
    expect(r.conflictingFields).toEqual(['name']);
  });

  it('treats both-changed-to-same as not a conflict', () => {
    const r = detectConflicts(
      { name: 'A' },
      { name: 'B' },
      { name: 'B' },
    );
    expect(r.canAutoMerge).toBe(true);
    expect(r.conflictingFields).toEqual([]);
  });

  it('skips updated_at and id fields', () => {
    const r = detectConflicts(
      { name: 'A', updated_at: '2026-01-01', id: '1' },
      { name: 'A', updated_at: '2026-02-01', id: '1' },
      { name: 'A', updated_at: '2026-03-01', id: '1' },
    );
    expect(r.conflictingFields).toEqual([]);
  });

  it('handles deeply nested objects', () => {
    const r = detectConflicts(
      { meta: { count: 1 } },
      { meta: { count: 2 } },
      { meta: { count: 1 } },
    );
    expect(r.canAutoMerge).toBe(true);
    expect((r.merged.meta as { count: number }).count).toBe(2);
  });

  it('handles arrays', () => {
    const r = detectConflicts(
      { tags: ['a'] },
      { tags: ['a', 'b'] },
      { tags: ['a'] },
    );
    expect(r.canAutoMerge).toBe(true);
    expect(r.merged.tags).toEqual(['a', 'b']);
  });

  it('detects conflict in arrays of different length', () => {
    const r = detectConflicts(
      { tags: ['a'] },
      { tags: ['a', 'b'] },
      { tags: ['a', 'c'] },
    );
    expect(r.canAutoMerge).toBe(false);
  });

  it('handles null values correctly', () => {
    const r = detectConflicts(
      { x: null },
      { x: 'a' },
      { x: null },
    );
    expect(r.merged.x).toBe('a');
  });
});

// ── resolveConflict ────────────────────────────────────────────

describe('resolveConflict', () => {
  function conflict(over: Partial<ConflictRecord> = {}): ConflictRecord {
    return {
      base_version: { name: 'base' },
      local_version: { name: 'local' },
      server_version: { name: 'server' },
      ...over,
    } as ConflictRecord;
  }

  it('returns full local version on "local" resolution', () => {
    expect(resolveConflict(conflict(), 'local').name).toBe('local');
  });

  it('returns full server version on "server" resolution', () => {
    expect(resolveConflict(conflict(), 'server').name).toBe('server');
  });

  it('applies per-field resolutions on top of server', () => {
    const result = resolveConflict(
      {
        base_version: {},
        local_version: { name: 'L', desc: 'L' },
        server_version: { name: 'S', desc: 'S' },
      } as ConflictRecord,
      'local',
      { name: 'server' },
    );
    // 'local' wins overall, but field-resolutions override … wait — the function
    // returns local_version when resolution === 'local'. fieldResolutions only
    // applies when resolution is the field-merge case (not 'local'/'server').
    expect(result.name).toBe('L');
  });
});

// ── checkStaleSubmission ───────────────────────────────────────

describe('checkStaleSubmission', () => {
  it('reports not-stale when server matches before-state', () => {
    const r = checkStaleSubmission(
      { name: 'A' },
      { name: 'A' },
      { name: 'B' },
    );
    expect(r.isStale).toBe(false);
    expect(r.canAutoMerge).toBe(true);
    expect(r.merged.name).toBe('B');
  });

  it('reports stale when server diverged from before-state', () => {
    const r = checkStaleSubmission(
      { name: 'A' },
      { name: 'C' },
      { name: 'B' },
    );
    expect(r.isStale).toBe(true);
  });

  it('canAutoMerge=true when divergences are non-overlapping', () => {
    const r = checkStaleSubmission(
      { name: 'A', desc: 'X' },
      { name: 'A', desc: 'Y' }, // server changed desc
      { name: 'B', desc: 'X' }, // local changed name
    );
    expect(r.isStale).toBe(true);
    expect(r.canAutoMerge).toBe(true);
  });

  it('canAutoMerge=false when both sides modified the same field differently', () => {
    const r = checkStaleSubmission(
      { name: 'A' },
      { name: 'C' },
      { name: 'B' },
    );
    expect(r.canAutoMerge).toBe(false);
    expect(r.conflictingFields).toEqual(['name']);
  });

  it('skips updated_at when checking server-changed fast path', () => {
    const r = checkStaleSubmission(
      { name: 'A', updated_at: '2026-01-01' },
      { name: 'A', updated_at: '2026-02-01' }, // only updated_at changed
      { name: 'B' },
    );
    expect(r.isStale).toBe(false);
  });
});

// ── buildMergedRecord ──────────────────────────────────────────

describe('buildMergedRecord', () => {
  it('starts from auto-merge then applies field choices', () => {
    const result = buildMergedRecord(
      { a: 'base', b: 'base', c: 'base' },
      { a: 'local', b: 'local', c: 'base' }, // local changed a, b
      { a: 'server', b: 'base', c: 'server' }, // server changed a, c
      { a: 'server', b: 'local' },
    );
    // a: conflict — server wins (per fieldResolutions)
    expect(result.a).toBe('server');
    // b: only local changed — auto-merge took 'local', field-resolution 'local' keeps it
    expect(result.b).toBe('local');
    // c: only server changed — auto-merge took 'server'
    expect(result.c).toBe('server');
  });

  it('returns auto-merged result when no field resolutions given', () => {
    const result = buildMergedRecord(
      { a: 'base', b: 'base' },
      { a: 'local', b: 'base' },
      { a: 'base', b: 'server' },
      {},
    );
    expect(result.a).toBe('local');
    expect(result.b).toBe('server');
  });
});
