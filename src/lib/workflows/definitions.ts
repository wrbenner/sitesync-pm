/**
 * Default workflow definitions — used as the seed for new projects.
 *
 * These are immutable templates. Projects clone them on first use; from
 * that point on, edits create new versions of the project's clone.
 */

import type { WorkflowDefinition, WorkflowEntityType } from '../../types/workflows'

export function defaultRfiWorkflow(project_id: string): WorkflowDefinition {
  return {
    id: `default-rfi-${project_id}`,
    project_id,
    entity_type: 'rfi',
    version: 1,
    name: 'Default RFI workflow',
    start_step: 'draft',
    steps: [
      {
        id: 'draft',
        name: 'Draft',
        required_role: ['pm', 'admin'],
        transitions: [{ on_event: ['submit'], to: 'pending_response' }],
      },
      {
        id: 'pending_response',
        name: 'Pending response',
        required_role: ['architect', 'admin'],
        notify_severity: 'normal',
        transitions: [
          { on_event: ['approve'], to: 'answered' },
          { on_event: ['reject'], to: 'closed_no_action' },
        ],
      },
      { id: 'answered', name: 'Answered', terminal: true, transitions: [] },
      { id: 'closed_no_action', name: 'Closed — no action', terminal: true, transitions: [] },
    ],
  }
}

export function defaultChangeOrderWorkflow(project_id: string): WorkflowDefinition {
  return {
    id: `default-co-${project_id}`,
    project_id,
    entity_type: 'change_order',
    version: 1,
    name: 'Default change order workflow',
    start_step: 'draft',
    steps: [
      {
        id: 'draft',
        name: 'Draft',
        required_role: ['pm', 'admin'],
        transitions: [{ on_event: ['submit'], to: 'route' }],
      },
      {
        id: 'route',
        name: 'Routing',
        transitions: [
          { when: 'cost_impact > 50000', to: 'owner_approval' },
          { to: 'pm_approval' },
        ],
      },
      {
        id: 'pm_approval',
        name: 'PM approval',
        required_role: ['pm', 'admin'],
        transitions: [
          { on_event: ['approve'], to: 'approved' },
          { on_event: ['reject'], to: 'rejected' },
        ],
      },
      {
        id: 'owner_approval',
        name: 'Owner approval',
        required_role: ['owner', 'admin'],
        notify_severity: 'critical',
        transitions: [
          { on_event: ['approve'], to: 'approved' },
          { on_event: ['reject'], to: 'rejected' },
        ],
      },
      { id: 'approved', name: 'Approved', terminal: true, transitions: [] },
      { id: 'rejected', name: 'Rejected', terminal: true, transitions: [] },
    ],
  }
}

export function defaultSubmittalWorkflow(project_id: string): WorkflowDefinition {
  return {
    id: `default-submittal-${project_id}`,
    project_id,
    entity_type: 'submittal',
    version: 1,
    name: 'Default submittal workflow',
    start_step: 'draft',
    steps: [
      { id: 'draft', name: 'Draft', required_role: ['pm', 'admin'], transitions: [{ on_event: ['submit'], to: 'pending_review' }] },
      {
        id: 'pending_review',
        name: 'Pending review',
        required_role: ['architect', 'admin'],
        transitions: [
          { on_event: ['approve'], to: 'approved' },
          { on_event: ['reject'], to: 'revise_resubmit' },
        ],
      },
      {
        id: 'revise_resubmit',
        name: 'Revise & resubmit',
        required_role: ['pm', 'admin'],
        transitions: [{ on_event: ['submit'], to: 'pending_review' }],
      },
      { id: 'approved', name: 'Approved', terminal: true, transitions: [] },
    ],
  }
}

export const DEFAULT_BUILDERS: Record<WorkflowEntityType, ((project_id: string) => WorkflowDefinition) | undefined> = {
  rfi: defaultRfiWorkflow,
  change_order: defaultChangeOrderWorkflow,
  submittal: defaultSubmittalWorkflow,
  punch_item: undefined,
  pay_app: undefined,
  inspection: undefined,
  daily_log: undefined,
}

export function buildDefaultWorkflow(
  entity_type: WorkflowEntityType,
  project_id: string,
): WorkflowDefinition | null {
  const builder = DEFAULT_BUILDERS[entity_type]
  return builder ? builder(project_id) : null
}
