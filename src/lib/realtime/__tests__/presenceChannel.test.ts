import { describe, it, expect } from 'vitest';
import {
  roomKeyFor,
  isMemberActive,
  dedupByUser,
  mergeHeartbeat,
  isMostRecentDeviceForUser,
  ACTIVE_WINDOW_MS,
  type PresenceMember,
} from '../presenceChannel';

const m = (overrides: Partial<PresenceMember> = {}): PresenceMember => ({
  user_id: 'u1', user_name: 'Mike', device_id: 'dev-a', last_seen_at: Date.now(),
  ...overrides,
});

describe('roomKeyFor', () => {
  it('builds entity rooms', () => {
    expect(roomKeyFor({ type: 'entity', entity_type: 'rfi', entity_id: 'r1' })).toBe('rfi:r1');
  });
  it('builds list rooms with filter hash', () => {
    expect(roomKeyFor({ type: 'list', entity_type: 'rfi', filter_hash: 'open' })).toBe('rfi:list:open');
  });
  it('falls back to "all" when no filter hash', () => {
    expect(roomKeyFor({ type: 'list', entity_type: 'submittal' })).toBe('submittal:list:all');
  });
  it('throws on entity room without id', () => {
    expect(() => roomKeyFor({ type: 'entity', entity_type: 'rfi' })).toThrow();
  });
});

describe('isMemberActive', () => {
  it('true within the window', () => {
    expect(isMemberActive(m({ last_seen_at: Date.now() - 10_000 }))).toBe(true);
  });
  it('false outside the window', () => {
    expect(isMemberActive(m({ last_seen_at: Date.now() - ACTIVE_WINDOW_MS - 1_000 }))).toBe(false);
  });
});

describe('dedupByUser', () => {
  it('keeps the most-recent device per user', () => {
    const t = Date.now();
    const out = dedupByUser([
      m({ user_id: 'u1', device_id: 'a', last_seen_at: t - 5000 }),
      m({ user_id: 'u1', device_id: 'b', last_seen_at: t - 100 }),
      m({ user_id: 'u2', device_id: 'c', last_seen_at: t - 200 }),
    ]);
    expect(out).toHaveLength(2);
    const u1 = out.find((x) => x.user_id === 'u1');
    expect(u1?.device_id).toBe('b');
  });
  it('sorts by last_seen_at desc', () => {
    const t = Date.now();
    const out = dedupByUser([
      m({ user_id: 'u1', last_seen_at: t - 5000 }),
      m({ user_id: 'u2', last_seen_at: t - 1000 }),
      m({ user_id: 'u3', last_seen_at: t - 50 }),
    ]);
    expect(out.map((x) => x.user_id)).toEqual(['u3', 'u2', 'u1']);
  });
});

describe('mergeHeartbeat', () => {
  it('replaces an existing entry for same (user, device)', () => {
    const t = Date.now();
    const out = mergeHeartbeat(
      [m({ user_id: 'u1', device_id: 'a', last_seen_at: t - 1000 })],
      m({ user_id: 'u1', device_id: 'a', last_seen_at: t }),
      t,
    );
    expect(out).toHaveLength(1);
    expect(out[0].last_seen_at).toBe(t);
  });
  it('drops stale members during merge', () => {
    const t = Date.now();
    const out = mergeHeartbeat(
      [m({ user_id: 'u1', device_id: 'a', last_seen_at: t - ACTIVE_WINDOW_MS - 5_000 })],
      m({ user_id: 'u2', device_id: 'b', last_seen_at: t }),
      t,
    );
    expect(out).toHaveLength(1);
    expect(out[0].user_id).toBe('u2');
  });
  it('appends a new (user, device) without affecting others', () => {
    const t = Date.now();
    const out = mergeHeartbeat(
      [m({ user_id: 'u1', device_id: 'a', last_seen_at: t - 100 })],
      m({ user_id: 'u1', device_id: 'b', last_seen_at: t }),
      t,
    );
    expect(out).toHaveLength(2);
  });
});

describe('isMostRecentDeviceForUser', () => {
  it('returns true for the most recent device', () => {
    const t = Date.now();
    const list = [
      m({ user_id: 'u1', device_id: 'a', last_seen_at: t - 5000 }),
      m({ user_id: 'u1', device_id: 'b', last_seen_at: t - 100 }),
    ];
    expect(isMostRecentDeviceForUser(list, 'u1', 'b')).toBe(true);
    expect(isMostRecentDeviceForUser(list, 'u1', 'a')).toBe(false);
  });
  it('returns false when the user has no devices in the list', () => {
    expect(isMostRecentDeviceForUser([], 'u1', 'a')).toBe(false);
  });
});
