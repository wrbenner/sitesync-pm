import { describe, it, expect } from 'vitest';
import {
  matchSubscription,
  signPayload,
  nextRetryDelaySeconds,
  shouldDeadLetter,
  eventFromTrigger,
  type WebhookSubscription,
  type WebhookEvent,
} from '../index';

const baseSub: WebhookSubscription = {
  id: 's1',
  url: 'https://example.com/hook',
  secret_hint: 'hash',
  event_types: ['rfi.*'],
  project_ids: null,
  status_filter: {},
  paused: false,
  active: true,
};

const baseEvent: WebhookEvent = {
  type: 'rfi.status_changed',
  entity_type: 'rfi',
  entity_id: 'r1',
  project_id: 'p1',
  status_from: 'open',
  status_to: 'answered',
  payload: { id: 'r1' },
  event_id: 'e1',
  created_at: '2026-05-02T10:00:00.000Z',
};

describe('matchSubscription', () => {
  it('matches by exact event type', () => {
    expect(matchSubscription({ ...baseSub, event_types: ['rfi.status_changed'] }, baseEvent)).toBe(true);
  });
  it('matches by wildcard', () => {
    expect(matchSubscription(baseSub, baseEvent)).toBe(true);
  });
  it('matches by "*"', () => {
    expect(matchSubscription({ ...baseSub, event_types: ['*'] }, baseEvent)).toBe(true);
  });
  it('rejects wrong event type', () => {
    expect(matchSubscription({ ...baseSub, event_types: ['submittal.*'] }, baseEvent)).toBe(false);
  });
  it('respects project filter', () => {
    expect(matchSubscription({ ...baseSub, project_ids: ['p2'] }, baseEvent)).toBe(false);
    expect(matchSubscription({ ...baseSub, project_ids: ['p1'] }, baseEvent)).toBe(true);
  });
  it('respects status_from filter', () => {
    expect(matchSubscription({ ...baseSub, status_filter: { from: ['draft'] } }, baseEvent)).toBe(false);
    expect(matchSubscription({ ...baseSub, status_filter: { from: ['open'] } }, baseEvent)).toBe(true);
  });
  it('respects status_to filter', () => {
    expect(matchSubscription({ ...baseSub, status_filter: { to: ['closed'] } }, baseEvent)).toBe(false);
    expect(matchSubscription({ ...baseSub, status_filter: { to: ['answered'] } }, baseEvent)).toBe(true);
  });
  it('skips paused or inactive subs', () => {
    expect(matchSubscription({ ...baseSub, paused: true }, baseEvent)).toBe(false);
    expect(matchSubscription({ ...baseSub, active: false }, baseEvent)).toBe(false);
  });
});

describe('signPayload', () => {
  it('produces a stable signature for the same input', async () => {
    const a = await signPayload('s3cret', { a: 1 });
    const b = await signPayload('s3cret', { a: 1 });
    expect(a.signature).toBe(b.signature);
    expect(a.signature).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
  it('changes signature when secret changes', async () => {
    const a = await signPayload('s1', { a: 1 });
    const b = await signPayload('s2', { a: 1 });
    expect(a.signature).not.toBe(b.signature);
  });
});

describe('nextRetryDelaySeconds', () => {
  it('starts at 30s', () => {
    expect(nextRetryDelaySeconds(0)).toBe(30);
  });
  it('escalates over the ladder', () => {
    expect(nextRetryDelaySeconds(1)).toBe(300);
    expect(nextRetryDelaySeconds(2)).toBe(1800);
    expect(nextRetryDelaySeconds(3)).toBe(7200);
  });
  it('caps at 72h', () => {
    expect(nextRetryDelaySeconds(20)).toBe(259200);
  });
});

describe('shouldDeadLetter', () => {
  it('false within 7 days', () => {
    const start = new Date('2026-05-02T10:00:00Z').toISOString();
    const now = new Date('2026-05-08T09:00:00Z'); // 5d23h
    expect(shouldDeadLetter(start, now)).toBe(false);
  });
  it('true after 7 days', () => {
    const start = new Date('2026-05-02T10:00:00Z').toISOString();
    const now = new Date('2026-05-09T11:00:00Z'); // 7d1h
    expect(shouldDeadLetter(start, now)).toBe(true);
  });
});

describe('eventFromTrigger', () => {
  it('classifies a status change', () => {
    const ev = eventFromTrigger({
      entity_type: 'rfi',
      entity_id: 'r1',
      project_id: 'p1',
      action: 'update',
      before: { status: 'open' },
      after: { status: 'answered' },
    });
    expect(ev.type).toBe('rfi.status_changed');
    expect(ev.status_from).toBe('open');
    expect(ev.status_to).toBe('answered');
  });
  it('classifies a create', () => {
    const ev = eventFromTrigger({
      entity_type: 'rfi',
      entity_id: 'r1',
      project_id: 'p1',
      action: 'create',
      after: { status: 'open' },
    });
    expect(ev.type).toBe('rfi.created');
  });
  it('classifies a generic update without status change', () => {
    const ev = eventFromTrigger({
      entity_type: 'rfi',
      entity_id: 'r1',
      project_id: 'p1',
      action: 'update',
      before: { status: 'open' },
      after: { status: 'open', title: 'new title' },
    });
    expect(ev.type).toBe('rfi.update');
  });
});
