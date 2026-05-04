import { describe, it, expect } from 'vitest';
import {
  mapRfi,
  mapSubmittal,
  mapChangeOrder,
  mapDailyLog,
  mapDrawing,
  mapPhoto,
  mapContact,
  normalizeStatus,
} from '../entityMappers';

describe('Procore entity mappers', () => {
  it('maps RFI and tags procore_id', () => {
    const out = mapRfi({
      id: 7,
      number: 'RFI-007',
      subject: 'Door swing',
      status: 'In Review',
      created_at: '2026-01-01',
      question: 'Q?',
    });
    expect(out.number).toBe('RFI-007');
    expect(out.status).toBe('in_review');
    expect(out.external_ids.procore_id).toBe(7);
    expect(out.answer).toBeNull();
  });

  it('maps submittal with spec_section', () => {
    const out = mapSubmittal({
      id: 11,
      number: 1,
      title: 'Curtain wall shop drawings',
      status: 'open',
      spec_section: '08 44 13',
      due_date: '2026-02-01',
    });
    expect(out.spec_section).toBe('08 44 13');
    expect(out.external_ids.procore_id).toBe(11);
  });

  it('maps change order with string amount', () => {
    const out = mapChangeOrder({
      id: 3,
      number: 'CO-3',
      title: 'Add curb cut',
      status: 'approved',
      amount: '12500.50',
    });
    expect(out.amount).toBe(12500.5);
  });

  it('maps daily log', () => {
    const out = mapDailyLog({ id: 1, date: '2026-04-29', notes: 'rain' });
    expect(out.date).toBe('2026-04-29');
    expect(out.weather).toBeNull();
  });

  it('maps drawing with revision', () => {
    const out = mapDrawing({
      id: 5,
      number: 'A-101',
      title: 'Floor plan',
      revision: 'B',
      url: 'https://procore/blob.pdf',
    });
    expect(out.revision).toBe('B');
    expect(out.source_url).toContain('procore');
  });

  it('maps photo and contact', () => {
    expect(mapPhoto({ id: 1, url: 'u', caption: 'c' }).caption).toBe('c');
    const c = mapContact({
      id: 2,
      first_name: 'A',
      last_name: 'B',
      email: 'a@b.com',
      company: { id: 1, name: 'Acme' },
    });
    expect(c.company_name).toBe('Acme');
  });

  it('normalizes status and falls back to unknown', () => {
    expect(normalizeStatus('Pending Review')).toBe('pending_review');
    expect(normalizeStatus(undefined)).toBe('unknown');
  });
});
