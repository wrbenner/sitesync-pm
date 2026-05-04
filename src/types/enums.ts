// TypeScript enum-like constants for SiteSync PM database.
// Maps to PostgreSQL enum types defined in the Supabase schema.
//
// Bugatti note: these were `enum X { ... }` declarations until 2026-05-03.
// The project's tsconfig has `verbatimModuleSyntax: true`, which forbids
// the runtime-emitting enum form (TS1294) because it can't be erased
// cleanly during transpile. We use `const X = { ... } as const` instead —
// the literal type is identical at use sites, but the runtime value is a
// plain object with no extra emit shape.
import { colors } from '../styles/theme';

export const UserRole = {
  Admin: 'admin',
  ProjectManager: 'project_manager',
  Superintendent: 'superintendent',
  Foreman: 'foreman',
  Crew: 'crew',
  Architect: 'architect',
  Engineer: 'engineer',
  SubcontractorPM: 'subcontractor_pm',
  Client: 'client',
  Viewer: 'viewer',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const ProjectStatus = {
  Bid: 'bid',
  Planning: 'planning',
  Active: 'active',
  OnHold: 'on_hold',
  Complete: 'complete',
  Archived: 'archived',
} as const;
export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

export const RFIStatus = {
  Open: 'open',
  UnderReview: 'under_review',
  Answered: 'answered',
  Resubmit: 'resubmit',
  Resolved: 'resolved',
  Closed: 'closed',
} as const;
export type RFIStatus = typeof RFIStatus[keyof typeof RFIStatus];

export const RFIPriority = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;
export type RFIPriority = typeof RFIPriority[keyof typeof RFIPriority];

export const SubmittalStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  UnderReview: 'under_review',
  Approved: 'approved',
  ApprovedWithComments: 'approved_with_comments',
  Rejected: 'rejected',
  Resubmit: 'resubmit',
} as const;
export type SubmittalStatus = typeof SubmittalStatus[keyof typeof SubmittalStatus];

export const ChangeOrderType = {
  Addition: 'addition',
  Deletion: 'deletion',
  Modification: 'modification',
  Clarification: 'clarification',
} as const;
export type ChangeOrderType = typeof ChangeOrderType[keyof typeof ChangeOrderType];

export const ChangeOrderStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Executed: 'executed',
} as const;
export type ChangeOrderStatus = typeof ChangeOrderStatus[keyof typeof ChangeOrderStatus];

export const ChangeOrderReason = {
  DesignChange: 'design_change',
  SiteCondition: 'site_condition',
  OwnerRequest: 'owner_request',
  MarketCondition: 'market_condition',
  ConstructabilityIssue: 'constructability_issue',
  DelayImpact: 'delay_impact',
  RFIResponse: 'rfi_response',
  Clarification: 'clarification',
} as const;
export type ChangeOrderReason = typeof ChangeOrderReason[keyof typeof ChangeOrderReason];

export const DailyLogStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  Approved: 'approved',
  Archived: 'archived',
} as const;
export type DailyLogStatus = typeof DailyLogStatus[keyof typeof DailyLogStatus];

export const DailyLogEntryType = {
  LaborHours: 'labor_hours',
  Equipment: 'equipment',
  Material: 'material',
  Weather: 'weather',
  ProgressPhoto: 'progress_photo',
  VoiceNote: 'voice_note',
  Incident: 'incident',
  Delay: 'delay',
  Quality: 'quality',
  SafetyEvent: 'safety_event',
} as const;
export type DailyLogEntryType = typeof DailyLogEntryType[keyof typeof DailyLogEntryType];

export const PunchStatus = {
  Open: 'open',
  InProgress: 'in_progress',
  OnHold: 'on_hold',
  ReadyForInspection: 'ready_for_inspection',
  Inspected: 'inspected',
  Closed: 'closed',
} as const;
export type PunchStatus = typeof PunchStatus[keyof typeof PunchStatus];

export const PunchPriority = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;
export type PunchPriority = typeof PunchPriority[keyof typeof PunchPriority];

export const DrawingDiscipline = {
  Architectural: 'architectural',
  Structural: 'structural',
  Mechanical: 'mechanical',
  Electrical: 'electrical',
  Plumbing: 'plumbing',
  Civil: 'civil',
  Landscape: 'landscape',
  Lighting: 'lighting',
  FireProtection: 'fire_protection',
  Technology: 'technology',
} as const;
export type DrawingDiscipline = typeof DrawingDiscipline[keyof typeof DrawingDiscipline];

export const ScheduleStatus = {
  Draft: 'draft',
  Baseline: 'baseline',
  Current: 'current',
  Complete: 'complete',
  Archived: 'archived',
} as const;
export type ScheduleStatus = typeof ScheduleStatus[keyof typeof ScheduleStatus];

export const LinkType = {
  FinishToStart: 'finish_to_start',
  FinishToFinish: 'finish_to_finish',
  StartToStart: 'start_to_start',
  StartToFinish: 'start_to_finish',
} as const;
export type LinkType = typeof LinkType[keyof typeof LinkType];

export const TransactionType = {
  Credit: 'credit',
  Debit: 'debit',
  Adjustment: 'adjustment',
  Transfer: 'transfer',
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

export const PayAppStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Paid: 'paid',
} as const;
export type PayAppStatus = typeof PayAppStatus[keyof typeof PayAppStatus];

export const WaiverType = {
  Unconditional: 'unconditional',
  Conditional: 'conditional',
  FinalUnconditional: 'final_unconditional',
  FinalConditional: 'final_conditional',
} as const;
export type WaiverType = typeof WaiverType[keyof typeof WaiverType];

export const CrewStatus = {
  Active: 'active',
  OnHold: 'on_hold',
  Complete: 'complete',
  Archived: 'archived',
} as const;
export type CrewStatus = typeof CrewStatus[keyof typeof CrewStatus];

export const MeetingType = {
  ProjectReview: 'project_review',
  SubcontractorMeeting: 'subcontractor_meeting',
  SafetyMeeting: 'safety_meeting',
  DesignReview: 'design_review',
  QualityInspection: 'quality_inspection',
  ProgressMeeting: 'progress_meeting',
  StaffMeeting: 'staff_meeting',
  JobWalk: 'job_walk',
  PreConstructionMeeting: 'pre_construction_meeting',
  Other: 'other',
} as const;
export type MeetingType = typeof MeetingType[keyof typeof MeetingType];

export const AttendeeStatus = {
  Invited: 'invited',
  Accepted: 'accepted',
  Declined: 'declined',
  Tentative: 'tentative',
  NoResponse: 'no_response',
} as const;
export type AttendeeStatus = typeof AttendeeStatus[keyof typeof AttendeeStatus];

export const ActionItemStatus = {
  Open: 'open',
  InProgress: 'in_progress',
  Complete: 'complete',
  Closed: 'closed',
  Overdue: 'overdue',
} as const;
export type ActionItemStatus = typeof ActionItemStatus[keyof typeof ActionItemStatus];

export const ActivityAction = {
  Created: 'created',
  Updated: 'updated',
  Deleted: 'deleted',
  Assigned: 'assigned',
  Commented: 'commented',
  StatusChanged: 'status_changed',
  Approved: 'approved',
  Rejected: 'rejected',
  Shared: 'shared',
} as const;
export type ActivityAction = typeof ActivityAction[keyof typeof ActivityAction];

export const NotificationType = {
  RFIResponse: 'rfi_response',
  SubmittalApproval: 'submittal_approval',
  ChangeOrderUpdate: 'change_order_update',
  MeetingInvite: 'meeting_invite',
  ActionItemAssigned: 'action_item_assigned',
  CommentMention: 'comment_mention',
  DailyLogApproval: 'daily_log_approval',
  PunchItemUpdate: 'punch_item_update',
  ScheduleUpdate: 'schedule_update',
  BudgetAlert: 'budget_alert',
} as const;
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

export const AIRole = {
  User: 'user',
  Assistant: 'assistant',
  System: 'system',
} as const;
export type AIRole = typeof AIRole[keyof typeof AIRole];

// Helper function to get display label for status
export function getStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

// Status color mappings for UI (using theme badge tokens).
//
// Multiple entities share status values (e.g. RFIStatus.UnderReview === SubmittalStatus.UnderReview === 'under_review').
// The previous flat statusColorMap silently overwrote those keys (TS1117). The map is unioned with one entry per unique status string;
// per-entity overrides are not currently needed because all duplicate-key
// statuses happened to map to the same color anyway.
const cyanBadge = { fg: colors.badgeCyan, bg: colors.badgeCyanBg };
const amberBadge = { fg: colors.badgeAmber, bg: colors.badgeAmberBg };
const tealBadge = { fg: colors.badgeTeal, bg: colors.badgeTealBg };
const redBadge = { fg: colors.badgeRed, bg: colors.badgeRedBg };
const grayBadge = { fg: colors.badgeGray, bg: colors.badgeGrayBg };

export const statusColorMap: Record<string, { fg: string; bg: string }> = {
  // shared / RFI / Submittal / ChangeOrder / DailyLog / Project / Punch
  // (deduplicated — see note above)
  draft: grayBadge,
  open: cyanBadge,
  submitted: cyanBadge,
  pending: amberBadge,
  under_review: amberBadge,
  resubmit: amberBadge,
  in_progress: amberBadge,
  on_hold: amberBadge,
  ready_for_inspection: cyanBadge,
  inspected: cyanBadge,
  answered: tealBadge,
  resolved: tealBadge,
  approved: tealBadge,
  approved_with_comments: cyanBadge,
  executed: tealBadge,
  active: tealBadge,
  complete: tealBadge,
  rejected: redBadge,
  closed: grayBadge,
  archived: grayBadge,
  // Project-only
  bid: cyanBadge,
  planning: amberBadge,
};

// Priority color mappings
export const priorityColorMap: Record<string, { fg: string; bg: string }> = {
  [RFIPriority.Critical]: redBadge,
  [RFIPriority.High]: { fg: colors.badgeOrange, bg: colors.badgeOrangeBg },
  [RFIPriority.Medium]: amberBadge,
  [RFIPriority.Low]: cyanBadge,
};
