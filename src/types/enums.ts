// TypeScript enums for SiteSync AI database
// Maps to PostgreSQL enum types defined in the Supabase schema
import { colors } from '../styles/theme';

export enum UserRole {
  Admin = 'admin',
  ProjectManager = 'project_manager',
  Superintendent = 'superintendent',
  Foreman = 'foreman',
  Crew = 'crew',
  Architect = 'architect',
  Engineer = 'engineer',
  SubcontractorPM = 'subcontractor_pm',
  Client = 'client',
  Viewer = 'viewer',
}

export enum ProjectStatus {
  Bid = 'bid',
  Planning = 'planning',
  Active = 'active',
  OnHold = 'on_hold',
  Complete = 'complete',
  Archived = 'archived',
}

export enum RFIStatus {
  Open = 'open',
  UnderReview = 'under_review',
  Answered = 'answered',
  Resubmit = 'resubmit',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum RFIPriority {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum SubmittalStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  UnderReview = 'under_review',
  Approved = 'approved',
  ApprovedWithComments = 'approved_with_comments',
  Rejected = 'rejected',
  Resubmit = 'resubmit',
}

export enum ChangeOrderType {
  Addition = 'addition',
  Deletion = 'deletion',
  Modification = 'modification',
  Clarification = 'clarification',
}

export enum ChangeOrderStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Executed = 'executed',
}

export enum ChangeOrderReason {
  DesignChange = 'design_change',
  SiteCondition = 'site_condition',
  OwnerRequest = 'owner_request',
  MarketCondition = 'market_condition',
  ConstructabilityIssue = 'constructability_issue',
  DelayImpact = 'delay_impact',
  RFIResponse = 'rfi_response',
  Clarification = 'clarification',
}

export enum DailyLogStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Approved = 'approved',
  Archived = 'archived',
}

export enum DailyLogEntryType {
  LaborHours = 'labor_hours',
  Equipment = 'equipment',
  Material = 'material',
  Weather = 'weather',
  ProgressPhoto = 'progress_photo',
  VoiceNote = 'voice_note',
  Incident = 'incident',
  Delay = 'delay',
  Quality = 'quality',
  SafetyEvent = 'safety_event',
}

export enum PunchStatus {
  Open = 'open',
  InProgress = 'in_progress',
  OnHold = 'on_hold',
  ReadyForInspection = 'ready_for_inspection',
  Inspected = 'inspected',
  Closed = 'closed',
}

export enum PunchPriority {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum DrawingDiscipline {
  Architectural = 'architectural',
  Structural = 'structural',
  Mechanical = 'mechanical',
  Electrical = 'electrical',
  Plumbing = 'plumbing',
  Civil = 'civil',
  Landscape = 'landscape',
  Lighting = 'lighting',
  FireProtection = 'fire_protection',
  Technology = 'technology',
}

export enum ScheduleStatus {
  Draft = 'draft',
  Baseline = 'baseline',
  Current = 'current',
  Complete = 'complete',
  Archived = 'archived',
}

export enum LinkType {
  FinishToStart = 'finish_to_start',
  FinishToFinish = 'finish_to_finish',
  StartToStart = 'start_to_start',
  StartToFinish = 'start_to_finish',
}

export enum TransactionType {
  Credit = 'credit',
  Debit = 'debit',
  Adjustment = 'adjustment',
  Transfer = 'transfer',
}

export enum PayAppStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Paid = 'paid',
}

export enum WaiverType {
  Unconditional = 'unconditional',
  Conditional = 'conditional',
  FinalUnconditional = 'final_unconditional',
  FinalConditional = 'final_conditional',
}

export enum CrewStatus {
  Active = 'active',
  OnHold = 'on_hold',
  Complete = 'complete',
  Archived = 'archived',
}

export enum MeetingType {
  ProjectReview = 'project_review',
  SubcontractorMeeting = 'subcontractor_meeting',
  SafetyMeeting = 'safety_meeting',
  DesignReview = 'design_review',
  QualityInspection = 'quality_inspection',
  ProgressMeeting = 'progress_meeting',
  StaffMeeting = 'staff_meeting',
  JobWalk = 'job_walk',
  PreConstructionMeeting = 'pre_construction_meeting',
  Other = 'other',
}

export enum AttendeeStatus {
  Invited = 'invited',
  Accepted = 'accepted',
  Declined = 'declined',
  Tentative = 'tentative',
  NoResponse = 'no_response',
}

export enum ActionItemStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Complete = 'complete',
  Closed = 'closed',
  Overdue = 'overdue',
}

export enum ActivityAction {
  Created = 'created',
  Updated = 'updated',
  Deleted = 'deleted',
  Assigned = 'assigned',
  Commented = 'commented',
  StatusChanged = 'status_changed',
  Approved = 'approved',
  Rejected = 'rejected',
  Shared = 'shared',
}

export enum NotificationType {
  RFIResponse = 'rfi_response',
  SubmittalApproval = 'submittal_approval',
  ChangeOrderUpdate = 'change_order_update',
  MeetingInvite = 'meeting_invite',
  ActionItemAssigned = 'action_item_assigned',
  CommentMention = 'comment_mention',
  DailyLogApproval = 'daily_log_approval',
  PunchItemUpdate = 'punch_item_update',
  ScheduleUpdate = 'schedule_update',
  BudgetAlert = 'budget_alert',
}

export enum AIRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

// Helper function to get display label for status
export function getStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

// Status color mappings for UI (using theme badge tokens)
const cyanBadge = { fg: colors.badgeCyan, bg: colors.badgeCyanBg };
const amberBadge = { fg: colors.badgeAmber, bg: colors.badgeAmberBg };
const tealBadge = { fg: colors.badgeTeal, bg: colors.badgeTealBg };
const redBadge = { fg: colors.badgeRed, bg: colors.badgeRedBg };
const grayBadge = { fg: colors.badgeGray, bg: colors.badgeGrayBg };

export const statusColorMap: Record<string, { fg: string; bg: string }> = {
  // RFI statuses
  [RFIStatus.Open]: cyanBadge,
  [RFIStatus.UnderReview]: amberBadge,
  [RFIStatus.Answered]: tealBadge,
  [RFIStatus.Resubmit]: amberBadge,
  [RFIStatus.Resolved]: tealBadge,
  [RFIStatus.Closed]: grayBadge,

  // Submittal statuses
  [SubmittalStatus.Draft]: grayBadge,
  [SubmittalStatus.Submitted]: cyanBadge,
  [SubmittalStatus.UnderReview]: amberBadge,
  [SubmittalStatus.Approved]: tealBadge,
  [SubmittalStatus.ApprovedWithComments]: cyanBadge,
  [SubmittalStatus.Rejected]: redBadge,
  [SubmittalStatus.Resubmit]: amberBadge,

  // Change order statuses
  [ChangeOrderStatus.Draft]: grayBadge,
  [ChangeOrderStatus.Submitted]: cyanBadge,
  [ChangeOrderStatus.Pending]: amberBadge,
  [ChangeOrderStatus.Approved]: tealBadge,
  [ChangeOrderStatus.Rejected]: redBadge,
  [ChangeOrderStatus.Executed]: tealBadge,

  // Punch statuses
  [PunchStatus.Open]: cyanBadge,
  [PunchStatus.InProgress]: amberBadge,
  [PunchStatus.OnHold]: amberBadge,
  [PunchStatus.ReadyForInspection]: cyanBadge,
  [PunchStatus.Inspected]: cyanBadge,
  [PunchStatus.Closed]: tealBadge,

  // Project statuses
  [ProjectStatus.Bid]: cyanBadge,
  [ProjectStatus.Planning]: amberBadge,
  [ProjectStatus.Active]: tealBadge,
  [ProjectStatus.OnHold]: amberBadge,
  [ProjectStatus.Complete]: tealBadge,
  [ProjectStatus.Archived]: grayBadge,
};

// Priority color mappings
export const priorityColorMap: Record<string, { fg: string; bg: string }> = {
  [RFIPriority.Critical]: redBadge,
  [RFIPriority.High]: { fg: colors.badgeOrange, bg: colors.badgeOrangeBg },
  [RFIPriority.Medium]: amberBadge,
  [RFIPriority.Low]: cyanBadge,
};
