import { describe, it, expect } from 'vitest';
import { assembleDailyLogDraft, stripPii } from '../sections';
import { inferCostCode } from '../costCodeInferer';
import type { DayContext } from '../../../types/dailyLogDraft';

const baseCtx: DayContext = {
  project_id: 'proj-1',
  date: '2026-04-30',
  timezone: 'America/New_York',
  weather: null,
  crews: [],
  photos: [],
  captures: [],
  rfis_today: [],
  meeting_action_items: [],
  schedule_events: [],
  inspections: [],
  deliveries: [],
};

describe('assembleDailyLogDraft', () => {
  it('produces a coherent draft for an empty day', () => {
    const draft = assembleDailyLogDraft(baseCtx);
    expect(draft.date).toBe('2026-04-30');
    expect(draft.partial).toBe(true);
    expect(draft.partial_reasons.weather).toMatch(/no weather/i);
    expect(draft.partial_reasons.manpower).toContain('No manpower');
    expect(draft.partial_reasons.work_performed).toContain('No photos');
    expect(draft.partial_reasons.issues).toBe('No issues or delays recorded.');
    expect(draft.partial_reasons.visitors).toBe('(none recorded)');
    expect(draft.work_performed).toEqual([]);
    expect(draft.manpower_total).toBe(0);
  });

  it('uses observed weather and produces a one-line summary', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      weather: {
        condition: 'Partly cloudy',
        high_temp_f: 78,
        low_temp_f: 62,
        precipitation_in: 0.0,
        wind_mph: 8,
        weather_source: 'observed',
      },
    });
    expect(draft.weather.weather_source).toBe('observed');
    expect(draft.weather_summary).toContain('Partly cloudy');
    expect(draft.weather_summary).toContain('78°F / 62°F');
    expect(draft.weather_summary).not.toContain('forecast');
  });

  it('marks forecast weather explicitly in the summary', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      weather: { condition: 'Sunny', high_temp_f: 90, weather_source: 'forecast' },
    });
    expect(draft.weather_summary).toContain('forecast');
  });

  it('rolls up duplicate manpower rows by trade × sub_company', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      crews: [
        { trade: 'electrical', sub_company: 'ABC', count: 4, hours: 32, source: 'crew_check_in' },
        { trade: 'Electrical', sub_company: 'abc', count: 2, hours: 16, source: 'crew_check_in' },
        { trade: 'plumbing', sub_company: 'XYZ', count: 3, source: 'roster_scheduled' },
      ],
    });
    expect(draft.manpower).toHaveLength(2);
    const elec = draft.manpower.find((c) => c.trade.toLowerCase() === 'electrical');
    expect(elec?.count).toBe(6);
    expect(elec?.hours).toBe(48);
    expect(draft.manpower_total).toBe(9);
    // Sorted by count desc — electrical (6) before plumbing (3).
    expect(draft.manpower[0].count).toBeGreaterThanOrEqual(draft.manpower[1].count);
  });

  it('falls back to "scheduled — attendance unconfirmed" when no check-ins exist', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      crews: [
        { trade: 'concrete', sub_company: 'PourPro', count: 5, source: 'roster_scheduled' },
      ],
    });
    expect(draft.manpower[0].source).toBe('roster_scheduled');
  });

  it('builds Work Performed bullets from photos with cost codes', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      photos: [
        { id: 'p1', caption: 'Rebar mat installed in pier 7 footing' },
        { id: 'p2', caption: 'Drywall taping started on level 3 west' },
      ],
    });
    expect(draft.work_performed).toHaveLength(2);
    expect(draft.work_performed[0].cost_code).toBe('03 30 00');
    expect(draft.work_performed[0].cost_code_confidence).toBeGreaterThanOrEqual(0.7);
    expect(draft.work_performed[1].cost_code).toBe('09 21 16');
    expect(draft.work_performed[0].sources[0].kind).toBe('photo_caption');
    expect(draft.work_performed[0].sources[0].ref).toBe('p1');
  });

  it('drops cost codes when confidence is below 0.6', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      captures: [
        // Only one weak match ('paint') would otherwise yield 0.45 confidence.
        { id: 'c1', text: 'Crew finished some general work today.', kind: 'text' },
      ],
    });
    expect(draft.work_performed[0].cost_code).toBeUndefined();
  });

  it('derives Issues bullets from RFIs filed today', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      rfis_today: [
        { id: 'r1', number: 47, title: 'Slab elevation conflict', event: 'filed' },
        { id: 'r2', number: 32, title: 'Door hardware spec', event: 'answered' },
      ],
    });
    expect(draft.issues).toHaveLength(2);
    expect(draft.issues[0].text).toContain('RFI #47');
    expect(draft.issues[0].text).toContain('filed');
    expect(draft.issues[1].text).toContain('answered');
  });

  it('renders inspection visitors with pass/fail status', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      inspections: [
        { id: 'i1', type: 'Building inspection', inspector: 'City of Austin', result: 'pass' },
        { id: 'i2', type: 'Fire alarm rough-in', result: 'fail', notes: 'missing smokes in 204' },
      ],
    });
    expect(draft.visitors).toHaveLength(2);
    expect(draft.visitors[0].text).toContain('PASS');
    expect(draft.visitors[1].text).toContain('FAIL');
    expect(draft.visitors[1].text).toContain('missing smokes');
  });

  it('marks the draft partial when any section is empty', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      crews: [
        { trade: 'electrical', count: 4, source: 'crew_check_in' },
      ],
    });
    expect(draft.partial).toBe(true);
    expect(draft.partial_reasons.manpower).toBeUndefined();
    expect(draft.partial_reasons.weather).toBeDefined();
  });

  it('strips PII from captures before storing', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      captures: [
        {
          id: 'c1',
          text: 'Spoke with John Smith at 555-867-5309 about the concrete pour.',
          kind: 'text',
        },
      ],
    });
    expect(draft.work_performed[0].text).not.toContain('555-867-5309');
    expect(draft.work_performed[0].text).not.toContain('John Smith');
    expect(draft.work_performed[0].text).toContain('[name redacted]');
    expect(draft.work_performed[0].text).toContain('[phone redacted]');
  });

  it('produces a provenance roll-up with counts per source kind', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      photos: [
        { id: 'p1', caption: 'Concrete pour in progress at column line 7' },
        { id: 'p2', caption: 'Rebar tied for slab on grade' },
      ],
      rfis_today: [{ id: 'r1', number: 1, title: 't', event: 'filed' }],
    });
    const photoProv = draft.provenance.find((p) => p.kind === 'photo_caption');
    expect(photoProv?.count).toBe(2);
    expect(photoProv?.sample_refs).toContain('p1');
    expect(photoProv?.sample_refs).toContain('p2');
  });

  it('stamps the generator id', () => {
    const draft = assembleDailyLogDraft(baseCtx, { generated_by: 'test-fixture' });
    expect(draft.generated_by).toBe('test-fixture');
  });

  it('caps Work Performed at 8 bullets', () => {
    const photos = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      caption: `Crew ${i} continued framing and drywall on level ${i}`,
    }));
    const draft = assembleDailyLogDraft({ ...baseCtx, photos });
    expect(draft.work_performed.length).toBe(8);
  });

  it('emits a "no photos captured today" reason when only schedule events drove the section', () => {
    const draft = assembleDailyLogDraft({
      ...baseCtx,
      schedule_events: [
        { id: 's1', title: 'Slab pour', delta_percent: 25 },
      ],
    });
    expect(draft.work_performed).toHaveLength(1);
    expect(draft.partial_reasons.work_performed).toBeUndefined();
  });
});

describe('stripPii', () => {
  it('redacts emails', () => {
    expect(stripPii('Email me at john@example.com please')).toContain('[email redacted]');
  });
  it('redacts phone numbers in common separator formats', () => {
    expect(stripPii('Call 5558675309')).toContain('[phone redacted]');
    expect(stripPii('Call 555-867-5309')).toContain('[phone redacted]');
    expect(stripPii('Call 555.867.5309')).toContain('[phone redacted]');
    expect(stripPii('Call 555 867 5309')).toContain('[phone redacted]');
  });
  it('preserves common construction text without false positives on full names', () => {
    expect(stripPii('Concrete poured per spec section 03 30 00')).toBe(
      'Concrete poured per spec section 03 30 00',
    );
  });
});

describe('inferCostCode', () => {
  it('returns null + 0 confidence on short text', () => {
    expect(inferCostCode('a')).toEqual({ cost_code: null, confidence: 0, matched_terms: [] });
  });
  it('matches single-keyword bullets at 0.45', () => {
    const r = inferCostCode('paint applied');
    expect(r.cost_code).toBe('09 91 00');
    expect(r.confidence).toBeCloseTo(0.45);
  });
  it('matches multi-keyword bullets at 0.7+', () => {
    const r = inferCostCode('rebar tied for concrete pour');
    expect(r.cost_code).toBe('03 30 00');
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
  });
  it('uses regex triggers (EMT/RMC for electrical)', () => {
    const r = inferCostCode('Pulled EMT to panel A');
    expect(r.cost_code).toBe('26 05 00');
  });
  it('does not blow up on punctuation-only input', () => {
    expect(() => inferCostCode('!!! ?')).not.toThrow();
  });
});
