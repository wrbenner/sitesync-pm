import { describe, it, expect } from 'vitest';
import { materialize } from '../materialize';
import { strip } from '../strip';
import type { ProjectTemplate, ProjectShape } from '../../../types/portfolio';

const TEMPLATE: ProjectTemplate = {
  name: 'Healthcare standard',
  structural_payload: {
    sov_line_items: [
      { code: '01-100', description: 'Mob', scheduled_value: 25000 },
      { code: '03-300', description: 'Concrete', scheduled_value: 500000 },
    ],
    rfi_categories: ['Architectural', 'MEP'],
    role_assignments: [{ role: 'project_manager', label: 'PM' }],
    extra: { custom_state: 'opt-in' },
  },
};

describe('materialize', () => {
  it('applies template + override', () => {
    const project = materialize(TEMPLATE, {
      name: 'New Hospital',
      start_date: '2026-06-01',
      contract_value: 25_000_000,
    });
    expect(project.name).toBe('New Hospital');
    expect(project.start_date).toBe('2026-06-01');
    expect(project.sov_line_items?.length).toBe(2);
    expect(project.rfi_categories).toEqual(['Architectural', 'MEP']);
  });

  it('role_assignments carry role labels but no user_id', () => {
    const project = materialize(TEMPLATE, { name: 'Project X' });
    const role = project.role_assignments![0];
    expect(role.role).toBe('project_manager');
    expect(role.user_id).toBeUndefined();
  });

  it('strip(materialize(t)) ≈ t', () => {
    const project = materialize(TEMPLATE, { name: 'Loop' });
    const round = strip(project, TEMPLATE.name);
    expect(round.structural_payload.sov_line_items).toEqual(TEMPLATE.structural_payload.sov_line_items);
    expect(round.structural_payload.rfi_categories).toEqual(TEMPLATE.structural_payload.rfi_categories);
  });

  it('overrides take precedence over template extras', () => {
    const project = materialize(TEMPLATE, { name: 'X', custom_state: 'opt-out' });
    expect(project.custom_state).toBe('opt-out');
  });

  it('handles empty template safely', () => {
    const empty: ProjectTemplate = { name: 'Empty', structural_payload: {} };
    const p = materialize(empty, { name: 'Skeleton' });
    expect(p.name).toBe('Skeleton');
  });

  it('clones nested arrays so mutating result does not mutate template', () => {
    const project: ProjectShape = materialize(TEMPLATE, { name: 'Mutation test' });
    project.sov_line_items?.push({ code: 'extra', description: 'x' });
    expect(TEMPLATE.structural_payload.sov_line_items?.length).toBe(2);
  });
});
