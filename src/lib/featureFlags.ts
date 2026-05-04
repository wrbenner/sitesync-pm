/**
 * featureFlags.ts — compile-time + runtime feature flag module.
 *
 * All flags are OFF by default. Enable in .env.local:
 *
 *   VITE_FLAG_BIM_VIEWER=true
 *   VITE_FLAG_IRIS_INBOX=true
 *   ...
 *
 * The FLAGS object is the single source of truth referenced by both
 * <FeatureGate> and any imperative checks (e.g. sidebar link visibility).
 *
 * Never put secret values here — these flags are compiled into the bundle.
 *
 * Day 5 — Lap 1 Subtract: routes that render placeholder UI are hidden
 * behind flags so users cannot stumble into unfinished experiences in
 * production. Each flag maps to a Jira/Linear ticket for completion.
 */

function flag(envKey: string, defaultValue = false): boolean {
  const raw = import.meta.env[envKey]
  if (raw === undefined || raw === '') return defaultValue
  return raw === 'true' || raw === '1'
}

export const FLAGS = {
  /**
   * 3D BIM / IFC model viewer.
   * File-upload works; server-side model storage not yet wired.
   * VITE_FLAG_BIM_VIEWER
   */
  bimViewer: flag('VITE_FLAG_BIM_VIEWER'),

  /**
   * Iris inbox — AI drafted-action queue.
   * Real hooks exist; stabilization in progress.
   * VITE_FLAG_IRIS_INBOX
   */
  irisInbox: flag('VITE_FLAG_IRIS_INBOX'),

  /**
   * Approval workflow builder (/settings/workflows).
   * ApprovalWorkflowBuilder uses useApprovalTemplates; UI mostly done.
   * VITE_FLAG_APPROVAL_WORKFLOWS
   */
  approvalWorkflows: flag('VITE_FLAG_APPROVAL_WORKFLOWS'),

  /**
   * AI-generated owner / OAC report (/reports/owner).
   * VITE_FLAG_OWNER_REPORT
   */
  ownerReport: flag('VITE_FLAG_OWNER_REPORT'),

  /**
   * Specification PDF parser (/submittals/spec-parser).
   * VITE_FLAG_SPEC_PARSER
   */
  specParser: flag('VITE_FLAG_SPEC_PARSER'),

  /**
   * Procore project import (/admin/procore-import).
   * Requires VITE_PROCORE_CLIENT_ID to be set as well.
   * VITE_FLAG_PROCORE_IMPORT
   */
  procoreImport: flag('VITE_FLAG_PROCORE_IMPORT'),

  /**
   * Project template management (/admin/project-templates).
   * VITE_FLAG_PROJECT_TEMPLATES
   */
  projectTemplates: flag('VITE_FLAG_PROJECT_TEMPLATES'),

  /**
   * Bulk team invite (/admin/bulk-invite).
   * VITE_FLAG_BULK_INVITE
   */
  bulkInvite: flag('VITE_FLAG_BULK_INVITE'),

  /**
   * Site walk-through sessions (/walkthrough).
   * VITE_FLAG_WALKTHROUGH
   */
  walkthrough: flag('VITE_FLAG_WALKTHROUGH'),

  /**
   * Compliance cockpit — cert/COI/OSHA300 tracking (/admin/compliance).
   * VITE_FLAG_COMPLIANCE_COCKPIT
   */
  complianceCockpit: flag('VITE_FLAG_COMPLIANCE_COCKPIT'),
} as const

export type FlagKey = keyof typeof FLAGS
