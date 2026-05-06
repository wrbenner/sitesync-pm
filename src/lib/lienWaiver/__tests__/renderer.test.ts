/**
 * Lien waiver template renderer tests.
 *
 * Verify each template renders the mechanical fields correctly, that the
 * resolver picks the right template per jurisdiction with a sensible
 * fallback, and that missing required fields raise.
 */

import { describe, it, expect } from 'vitest';
import {
  renderWaiver,
  resolveWaiverTemplateId,
  listWaiverTemplates,
  getWaiverTemplate,
  fmtAmount,
} from '../templateRenderer';

const INPUT = {
  subcontractorName: 'Acme Concrete Inc.',
  projectName: 'Avery Oaks Tower',
  projectAddress: '123 Main St, Austin, TX 78701',
  payerName: 'BuildCo General Contractors',
  periodThrough: '2026-04-30',
  amount: 12_345.67,
  signerName: 'Jane Foreman',
  signerTitle: 'CFO',
  executionDate: null,
};

describe('renderWaiver — AIA conditional progress (default fallback)', () => {
  it('produces a body containing all mechanical fields', () => {
    const body = renderWaiver('aia-g706-conditional-progress-v1', INPUT);
    expect(body).toContain('Acme Concrete Inc.');
    expect(body).toContain('Avery Oaks Tower');
    expect(body).toContain('123 Main St');
    expect(body).toContain('BuildCo General Contractors');
    expect(body).toContain('2026-04-30');
    expect(body).toContain('$12,345.67');
    expect(body).toContain('Jane Foreman');
    expect(body).toContain('CFO');
    // Must not silently swallow the legal-review placeholder:
    expect(body).toContain('[TODO_LEGAL_REVIEW]');
  });
});

describe('renderWaiver — AIA unconditional progress', () => {
  it('renders all mechanical fields', () => {
    const body = renderWaiver('aia-g706-unconditional-progress-v1', INPUT);
    expect(body).toContain('UNCONDITIONAL');
    expect(body).toContain('Acme Concrete Inc.');
    expect(body).toContain('$12,345.67');
  });
});

describe('renderWaiver — California', () => {
  it('cites Civil Code § 8132 in the header', () => {
    const body = renderWaiver('ca-conditional-progress-v1', INPUT);
    expect(body).toContain('California Civil Code');
    expect(body).toContain('8132');
  });
});

describe('renderWaiver — Texas', () => {
  it('cites Property Code § 53.281', () => {
    const body = renderWaiver('tx-conditional-progress-v1', INPUT);
    expect(body).toContain('Texas Property Code');
    expect(body).toContain('53.281');
  });
});

describe('renderWaiver — Florida', () => {
  it('cites Statute § 713.20', () => {
    const body = renderWaiver('fl-conditional-progress-v1', INPUT);
    expect(body).toContain('713.20');
  });
});

describe('renderWaiver — error handling', () => {
  it('throws on unknown template id', () => {
    expect(() => renderWaiver('not-a-template', INPUT)).toThrow(/Unknown/);
  });

  it('throws on missing required field', () => {
    const bad = { ...INPUT, subcontractorName: '' };
    expect(() => renderWaiver('aia-g706-conditional-progress-v1', bad)).toThrow(
      /Missing required/,
    );
  });

  it('throws when amount is not finite', () => {
    const bad = { ...INPUT, amount: Number.NaN };
    expect(() => renderWaiver('aia-g706-conditional-progress-v1', bad)).toThrow();
  });
});

describe('resolveWaiverTemplateId', () => {
  it('returns CA template when jurisdiction = CA', () => {
    expect(resolveWaiverTemplateId('CA', 'conditional_progress')).toBe(
      'ca-conditional-progress-v1',
    );
  });

  it('returns TX template when jurisdiction = TX', () => {
    expect(resolveWaiverTemplateId('TX', 'conditional_progress')).toBe(
      'tx-conditional-progress-v1',
    );
  });

  it('falls back to AIA when jurisdiction is unknown', () => {
    expect(resolveWaiverTemplateId('XX', 'conditional_progress')).toBe(
      'aia-g706-conditional-progress-v1',
    );
  });

  it('falls back to AIA when jurisdiction is null', () => {
    expect(resolveWaiverTemplateId(null, 'conditional_progress')).toBe(
      'aia-g706-conditional-progress-v1',
    );
  });
});

describe('registry', () => {
  it('lists at least the five templates', () => {
    const ids = listWaiverTemplates().map(t => t.id).sort();
    expect(ids).toContain('aia-g706-conditional-progress-v1');
    expect(ids).toContain('aia-g706-unconditional-progress-v1');
    expect(ids).toContain('ca-conditional-progress-v1');
    expect(ids).toContain('tx-conditional-progress-v1');
    expect(ids).toContain('fl-conditional-progress-v1');
  });

  it('templates have a stable version + effective date', () => {
    const t = getWaiverTemplate('aia-g706-conditional-progress-v1')!;
    expect(t.version).toBeTypeOf('string');
    expect(t.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('fmtAmount helper', () => {
  it('formats integers', () => {
    expect(fmtAmount(0)).toBe('$0.00');
    expect(fmtAmount(1000)).toBe('$1,000.00');
  });

  it('formats decimals with banker-friendly rounding', () => {
    expect(fmtAmount(12.34)).toBe('$12.34');
  });

  it('formats negatives with a leading minus', () => {
    expect(fmtAmount(-50.25)).toBe('-$50.25');
  });
});
