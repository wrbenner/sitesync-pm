/**
 * Strip a project down to a re-usable template.
 *
 * The rule: KEEP structural data (SOV line items, RFI categories,
 * submittal log defaults, punch templates, closeout deliverables,
 * role labels) and DISCARD transactional data (open RFIs, change
 * orders, daily logs, photos, user-id-bound assignments).
 *
 * `strip(materialize(t, …))` should be ≈ `t` — see the idempotency
 * test in __tests__/strip.test.ts.
 */

import type {
  ProjectShape,
  ProjectTemplate,
  TemplatePayload,
} from '../../types/portfolio';

const TRANSACTIONAL_FIELDS = new Set([
  'open_rfis',
  'change_orders',
  'daily_logs',
  'photos',
  'rfis',
  'submittals',
  'punch_items',
  'tasks',
]);

export function strip(project: ProjectShape, name?: string): ProjectTemplate {
  const payload: TemplatePayload = {
    sov_line_items: cloneSov(project.sov_line_items),
    rfi_categories: project.rfi_categories
      ? [...new Set(project.rfi_categories)]
      : undefined,
    submittal_log_defaults: project.submittal_log_defaults
      ? project.submittal_log_defaults.map((s) => ({ ...s }))
      : undefined,
    punch_templates: project.punch_templates
      ? project.punch_templates.map((p) => ({ ...p }))
      : undefined,
    closeout_deliverables: project.closeout_deliverables
      ? project.closeout_deliverables.map((c) => ({ ...c }))
      : undefined,
    role_assignments: project.role_assignments
      ? project.role_assignments
          .map((r) => ({ role: r.role, label: r.label }))
          // Drop entries with no role label.
          .filter((r) => Boolean(r.role))
      : undefined,
  };

  // Carry through any non-transactional, non-known extras so admins
  // can encode site-specific config in templates without changing
  // the type. (e.g., custom_workflow_states, default_specs, etc.)
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(project)) {
    if (TRANSACTIONAL_FIELDS.has(k)) continue;
    if (
      [
        'sov_line_items',
        'rfi_categories',
        'submittal_log_defaults',
        'punch_templates',
        'closeout_deliverables',
        'role_assignments',
        'name',
        'id',
        'start_date',
        'end_date',
        'contract_value',
      ].includes(k)
    ) {
      continue;
    }
    extra[k] = v;
  }
  if (Object.keys(extra).length > 0) {
    payload.extra = extra;
  }

  return {
    name: name ?? project.name + ' (template)',
    structural_payload: payload,
  };
}

function cloneSov(
  items: TemplatePayload['sov_line_items'],
): TemplatePayload['sov_line_items'] | undefined {
  if (!items) return undefined;
  return items.map((i) => ({ ...i }));
}
