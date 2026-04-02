// TypeScript enums for SiteSync AI database
// Maps to PostgreSQL enum types defined in the Supabase schema

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

// Status color mappings for UI
export const statusColorMap: Record<string, { fg: string; bg: string }> = {
  // RFI statuses
  [RFIStatus.Open]: { fg: '#06B6D4', bg: '#ECFDFD' },
  [RFIStatus.UnderReview]: { fg: '#FB923C', bg: '#FFFBEB' },
  [RFIStatus.Answered]: { fg: '#4EC896', bg: '#ECFDF5' },
  [RFIStatus.Resubmit]: { fg: '#FB923C', bg: '#FFFBEB' },
  [RFIStatus.Resolved]: { fg: '#4EC896', bg: '#ECFDF5' },
  [RFIStatus.Closed]: { fg: '#8B8680', bg: '#F7F8FA' },

  // Submittal statuses
  [SubmittalStatus.Draft]: { fg: '#8B8680', bg: '#F7F8FA' },
  [SubmittalStatus.Submitted]: { fg: '#06B6D4', bg: '#ECFDFD' },
  [SubmittalStatus.UnderReview]: { fg: '#FB923C', bg: '#FFFBEB' },
  [SubmittalStatus.Approved]: { fg: '#4EC896', bg: '#ECFDF5' },
  [SubmittalStatus.ApprovedWithComments]: { fg: '#06B6D4', bg: '#ECFDFD' },
  [SubmittalStatus.Rejected]: { fg: '#E05252', bg: '#FDF2F2' },
  [SubmittalStatus.Resubmit]: { fg: '#FB923C', bg: '#FFFBEB' },

  // Change order statuses
  [ChangeOrderStatus.Draft]: { fg: '#8B8680', bg: '#F7F8FA' },
  [ChangeOrderStatus.Submitted]: { fg: '#06B6D4', bg: '#ECFDFD' },
  [ChangeOrderStatus.Pending]: { fg: '#FB923C', bg: '#FFFBEB' },
  [ChangeOrderStatus.Approved]: { fg: '#4EC896', bg: '#ECFDF5' },
  [ChangeOrderStatus.Rejected]: { fg: '#E05252', bg: '#FDF2F2' },
  [ChangeOrderStatus.Executed]: { fg: '#4EC896', bg: '#ECFDF5' },

  // Punch statuses
  [PunchStatus.Open]: { fg: '#06B6D4', bg: '#ECFDFD' },
  [PunchStatus.InProgress]: { fg: '#FB923C', bg: '#FFFBEB' },
  [PunchStatus.OnHold]: { fg: '#FB923C', bg: '#FFFBEB' },
  [PunchStatus.ReadyForInspection]: { fg: '#06B6D4', bg: '#ECFDFD' },
  [PunchStatus.Inspected]: { fg: '#06B6D4', bg: '#ECFDFD' },
  [PunchStatus.Closed]: { fg: '#4EC896', bg: '#ECFDF5' },

  // Project statuses
  [ProjectStatus.Bid]: { fg: '#06B6D4', bg: '#ECFDFD' },
  [ProjectStatus.Planning]: { fg: '#FB923C', bg: '#FFFBEB' },
  [ProjectStatus.Active]: { fg: '#4EC896', bg: '#ECFDF5' },
  [ProjectStatus.OnHold]: { fg: '#FB923C', bg: '#FFFBEB' },
  [ProjectStatus.Complete]: { fg: '#4EC896', bg: '#ECFDF5' },
  [ProjectStatus.Archived]: { fg: '#8B8680', bg: '#F7F8FA' },
}

// Priority color mappings
export const priorityColorMap: Record<string, { fg: string; bg: string }> = {
  [RFIPriority.Critical]: { fg: '#E05252', bg: '#FDF2F2' },
  [RFIPriority.High]: { fg: '#F47820', bg: '#FDDCB8' },
  [RFIPriority.Medium]: { fg: '#FB923C', bg: '#FFFBEB' },
  [RFIPriority.Low]: { fg: '#06B6D4', bg: '#ECFDFD' },
}
