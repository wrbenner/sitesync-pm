/**
 * Materialize a project template into a new project shape.
 *
 * The override (NewProjectInput) provides the project name and any
 * fresh metadata (start date, contract value). The template's
 * structural_payload becomes the project's seed data.
 *
 * Role assignments carry the role label only — no user IDs leak.
 * The caller (UI / edge fn) wires user IDs in a follow-up step.
 */

import type {
  ProjectTemplate,
  ProjectShape,
  NewProjectInput,
} from '../../types/portfolio';

export function materialize(
  template: ProjectTemplate,
  override: NewProjectInput,
): ProjectShape {
  const payload = template.structural_payload;
  const project: ProjectShape = {
    name: override.name,
    sov_line_items: payload.sov_line_items
      ? payload.sov_line_items.map((i) => ({ ...i }))
      : undefined,
    rfi_categories: payload.rfi_categories
      ? [...payload.rfi_categories]
      : undefined,
    submittal_log_defaults: payload.submittal_log_defaults
      ? payload.submittal_log_defaults.map((s) => ({ ...s }))
      : undefined,
    punch_templates: payload.punch_templates
      ? payload.punch_templates.map((p) => ({ ...p }))
      : undefined,
    closeout_deliverables: payload.closeout_deliverables
      ? payload.closeout_deliverables.map((c) => ({ ...c }))
      : undefined,
    role_assignments: payload.role_assignments
      ? payload.role_assignments.map((r) => ({ role: r.role, label: r.label }))
      : undefined,
  };

  // Apply override fields (start_date, end_date, contract_value, etc.)
  for (const [k, v] of Object.entries(override)) {
    if (k === 'name') continue;
    project[k] = v;
  }

  // Spread template extras (non-clobbering — override wins).
  if (payload.extra) {
    for (const [k, v] of Object.entries(payload.extra)) {
      if (project[k] === undefined) project[k] = v;
    }
  }

  return project;
}
