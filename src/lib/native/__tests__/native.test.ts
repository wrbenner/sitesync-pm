import { describe, it, expect } from 'vitest';
import { parseDeepLink, deepLinkForEntity, deepLinkForShare } from '../deepLink';
import { APP_SHORTCUTS, shortcutForEntity } from '../appShortcuts';

describe('parseDeepLink', () => {
  it('returns null for empty / malformed input', () => {
    expect(parseDeepLink('')).toBeNull();
    expect(parseDeepLink('not a url')).toBeNull();
    expect(parseDeepLink('https://example.com')).toBeNull();
  });

  it('parses RFI entity link', () => {
    const r = parseDeepLink('sitesync://entity/rfi/abc-123');
    expect(r?.kind).toBe('entity');
    expect(r?.spaPath).toBe('rfis/abc-123');
    expect(r?.requires_auth).toBe(true);
  });

  it('parses change_order with hyphenation', () => {
    const r = parseDeepLink('sitesync://entity/change_order/co-1');
    expect(r?.spaPath).toBe('change-orders/co-1');
  });

  it('parses punch_item to punch-list', () => {
    expect(parseDeepLink('sitesync://entity/punch_item/p1')?.spaPath).toBe('punch-list/p1');
    expect(parseDeepLink('sitesync://entity/punch/p2')?.spaPath).toBe('punch-list/p2');
  });

  it('captures action query', () => {
    const r = parseDeepLink('sitesync://entity/rfi/r1?action=respond');
    expect(r?.query).toEqual({ action: 'respond' });
    expect(r?.entity?.action).toBe('respond');
  });

  it('rejects unknown entity types', () => {
    expect(parseDeepLink('sitesync://entity/unknown/x')).toBeNull();
  });

  it('parses daily-log with date', () => {
    const r = parseDeepLink('sitesync://daily-log?date=2026-05-03');
    expect(r?.kind).toBe('daily-log');
    expect(r?.spaPath).toBe('daily-log');
    expect(r?.query?.date).toBe('2026-05-03');
  });

  it('parses capture intent', () => {
    expect(parseDeepLink('sitesync://capture')?.kind).toBe('capture');
  });

  it('parses share link with token (no auth required)', () => {
    const r = parseDeepLink('sitesync://share/rfi/r1?t=abc');
    expect(r?.kind).toBe('share');
    expect(r?.requires_auth).toBe(false);
    expect(r?.share?.token).toBe('abc');
    expect(r?.spaPath).toBe('share/rfi/r1');
  });

  it('rejects share without token', () => {
    expect(parseDeepLink('sitesync://share/rfi/r1')).toBeNull();
  });

  it('classifies unknown heads gracefully', () => {
    const r = parseDeepLink('sitesync://something');
    expect(r?.kind).toBe('unknown');
  });
});

describe('deepLinkForEntity / deepLinkForShare', () => {
  it('builds entity link', () => {
    expect(deepLinkForEntity({ type: 'rfi', id: 'r1' })).toBe('sitesync://entity/rfi/r1');
  });
  it('appends action when present', () => {
    expect(deepLinkForEntity({ type: 'rfi', id: 'r1', action: 'respond' }))
      .toBe('sitesync://entity/rfi/r1?action=respond');
  });
  it('encodes share token', () => {
    expect(deepLinkForShare('rfi', 'r1', 'abc 123')).toBe('sitesync://share/rfi/r1?t=abc%20123');
  });
  it('roundtrips through parseDeepLink', () => {
    const link = deepLinkForEntity({ type: 'submittal', id: 's1', action: 'view' });
    const parsed = parseDeepLink(link);
    expect(parsed?.kind).toBe('entity');
    expect(parsed?.entity).toEqual({ type: 'submittal', id: 's1', action: 'view' });
  });
});

describe('APP_SHORTCUTS', () => {
  it('exposes 3 entries', () => {
    expect(APP_SHORTCUTS).toHaveLength(3);
  });
  it('every entry has a sitesync:// url', () => {
    for (const s of APP_SHORTCUTS) {
      expect(s.url.startsWith('sitesync://')).toBe(true);
    }
  });
  it('today\'s daily log uses today\'s date', () => {
    const todays = APP_SHORTCUTS.find((s) => s.id === 'todays_log')!;
    const today = new Date().toISOString().slice(0, 10);
    expect(todays.url).toContain(today);
  });
});

describe('shortcutForEntity', () => {
  it('includes the entity id in the url', () => {
    const s = shortcutForEntity({ type: 'rfi', id: 'r99', title: 'RFI #99' });
    expect(s.url).toBe('sitesync://entity/rfi/r99');
    expect(s.id).toBe('entity:rfi:r99');
  });
});
