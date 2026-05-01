import { describe, it, expect } from 'vitest';
import { rankMentions, detectMentionQuery, type MentionContact } from '../autocomplete';

const c = (name: string, extra: Partial<MentionContact> = {}): MentionContact => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
  ...extra,
});

const directory: ReadonlyArray<MentionContact> = [
  c('Walker Benner', { role: 'PM', company: 'GC Co' }),
  c('Wallace Tran',  { role: 'Architect', company: 'StudioA' }),
  c('Sarah Walker',  { role: 'Owner Rep', company: 'OwnerCo' }),
  c('John Smith',    { role: 'Foreman', company: 'PourPro', trade: 'concrete' }),
  c('Maria Lopez',   { role: 'Inspector', company: 'City of Austin' }),
  c('Old Friend',    { role: 'PM', company: 'Past Co', former_member: true }),
];

describe('rankMentions', () => {
  it('returns nothing when no contact matches', () => {
    expect(rankMentions('zzz', directory)).toEqual([]);
  });

  it('prefix match on full name beats prefix match on last name', () => {
    const r = rankMentions('walker', directory);
    expect(r[0].contact.name).toBe('Walker Benner');
    // Sarah Walker matches on last-name prefix.
    expect(r.find((x) => x.contact.name === 'Sarah Walker')).toBeDefined();
    const wb = r.findIndex((x) => x.contact.name === 'Walker Benner');
    const sw = r.findIndex((x) => x.contact.name === 'Sarah Walker');
    expect(wb).toBeLessThan(sw);
  });

  it('matches on aux fields (role, company, trade) with lower score', () => {
    const r = rankMentions('austin', directory);
    expect(r[0].contact.name).toBe('Maria Lopez');
    expect(r[0].score).toBeLessThan(80); // aux match is 40
  });

  it('demotes former members but still includes them', () => {
    const r = rankMentions('PM', directory);
    const walker = r.find((x) => x.contact.name === 'Walker Benner');
    const old = r.find((x) => x.contact.name === 'Old Friend');
    expect(walker).toBeDefined();
    expect(old).toBeDefined();
    expect(walker!.score).toBeGreaterThan(old!.score);
    expect(old!.label).toContain('(former member)');
  });

  it('caps results at the limit', () => {
    const r = rankMentions('o', directory, { limit: 3 });
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it('returns alphabetical contacts for an empty query', () => {
    const r = rankMentions('', directory, { limit: 6 });
    expect(r.length).toBeGreaterThan(0);
    // First letter ordered ascending → 'J', 'M', 'O', 'S', 'W'…
    expect(r.map((x) => x.contact.name[0]).join('')).toMatch(/^[A-Z]/);
  });

  it('includes role + company in detail label', () => {
    const r = rankMentions('walker benner', directory);
    expect(r[0].detail).toContain('PM');
    expect(r[0].detail).toContain('GC Co');
  });

  it('case-insensitive matching', () => {
    const lower = rankMentions('walker', directory);
    const upper = rankMentions('WALKER', directory);
    expect(lower.map((x) => x.contact.id)).toEqual(upper.map((x) => x.contact.id));
  });
});

describe('detectMentionQuery', () => {
  it('returns null when caret is not preceded by @', () => {
    expect(detectMentionQuery('hello world', 11)).toBeNull();
  });

  it('detects an @-mention at the start of input', () => {
    const r = detectMentionQuery('@walker', 7);
    expect(r).toEqual({ query: 'walker', start: 0, end: 7 });
  });

  it('detects an @-mention after whitespace', () => {
    const r = detectMentionQuery('hi @walker', 10);
    expect(r?.query).toBe('walker');
    expect(r?.start).toBe(3);
  });

  it('does not trigger on email addresses (@ has no preceding space)', () => {
    expect(detectMentionQuery('email me at john@example', 24)).toBeNull();
  });

  it('detects an empty mention right after @', () => {
    const r = detectMentionQuery('hello @', 7);
    expect(r?.query).toBe('');
    expect(r?.start).toBe(6);
  });

  it('aborts when the mention contains a newline', () => {
    expect(detectMentionQuery('@walker\nbad', 11)).toBeNull();
  });

  it('only considers text before the caret', () => {
    // Caret is at position 4 ("hi @|walker"); should detect '@' + ''.
    const r = detectMentionQuery('hi @walker', 4);
    expect(r?.query).toBe('');
  });

  it('caps at 40 chars to avoid runaway matches', () => {
    const long = '@' + 'a'.repeat(60);
    const r = detectMentionQuery(long, long.length);
    expect(r).toBeNull();
  });
});
