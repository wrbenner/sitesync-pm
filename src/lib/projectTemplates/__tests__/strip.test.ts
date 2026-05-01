import { describe, it, expect } from 'vitest';
import { strip } from '../strip';
import type { ProjectShape } from '../../../types/portfolio';

const sample: ProjectShape = {
  name: 'Avery Oaks',
  sov_line_items: [{ code: '01-100', description: 'Mob', scheduled_value: 25000 }],
  rfi_categories: ['Architectural', 'Structural', 'Architectural'],
  submittal_log_defaults: [{ spec_section: '08 44 13', title: 'Curtain wall' }],
  punch_templates: [{ title: 'Touch-up paint', trade: 'Painting' }],
  closeout_deliverables: [{ name: 'O&M Manuals', required: true }],
  role_assignments: [
    { role: 'project_manager', label: 'PM', user_id: 'user-123' },
    { role: 'superintendent', label: 'Super', user_id: 'user-456' },
  ],
  open_rfis: [{ id: 'rfi-1', subject: 'leak' }],
  change_orders: [{ id: 'co-1', amount: 1000 }],
  daily_logs: [{ id: 'dl-1', date: '2026-04-01' }],
  photos: [{ id: 'ph-1', url: 'x' }],
};

describe('strip', () => {
  it('strips transactional fields', () => {
    const t = strip(sample);
    const payload = t.structural_payload;
    expect((payload as unknown as { open_rfis?: unknown[] }).open_rfis).toBeUndefined();
    expect((payload as unknown as { change_orders?: unknown[] }).change_orders).toBeUndefined();
    expect(payload.sov_line_items?.length).toBe(1);
  });

  it('drops user_id from role_assignments, keeps role label', () => {
    const t = strip(sample);
    const roles = t.structural_payload.role_assignments!;
    expect(roles.length).toBe(2);
    expect((roles[0] as unknown as { user_id?: string }).user_id).toBeUndefined();
    expect(roles[0].role).toBe('project_manager');
  });

  it('deduplicates rfi_categories', () => {
    const t = strip(sample);
    expect(t.structural_payload.rfi_categories).toEqual(['Architectural', 'Structural']);
  });

  it('default name suffixes "(template)"', () => {
    expect(strip(sample).name).toBe('Avery Oaks (template)');
    expect(strip(sample, 'Hospital Standard').name).toBe('Hospital Standard');
  });

  it('preserves nested submittal data', () => {
    const t = strip(sample);
    expect(t.structural_payload.submittal_log_defaults?.[0].spec_section).toBe('08 44 13');
  });

  it('captures unknown extras', () => {
    const withExtras: ProjectShape = {
      ...sample,
      custom_workflow_state: 'in_progress',
      default_specs: { div08: 'Doors' },
    };
    const t = strip(withExtras);
    expect(t.structural_payload.extra?.custom_workflow_state).toBe('in_progress');
  });
});
