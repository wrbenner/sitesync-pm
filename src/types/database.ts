// Supabase Database Types
// These types mirror the database schema and are used by the Supabase client for type safety.

export type UserRole = 'company_admin' | 'project_manager' | 'superintendent' | 'engineer' | 'subcontractor' | 'viewer';
export type ProjectRole = 'project_manager' | 'superintendent' | 'engineer' | 'subcontractor' | 'viewer';
export type RfiStatus = 'draft' | 'submitted' | 'under_review' | 'responded' | 'closed';
export type SubmittalStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revise_resubmit';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type DailyLogStatus = 'draft' | 'submitted' | 'approved';
export type PunchItemStatus = 'open' | 'in_progress' | 'complete' | 'verified';
export type ChangeOrderStatus = 'pending' | 'approved' | 'rejected';
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  company_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  project_type: string | null;
  total_value: number | null;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  completion_percentage: number;
  start_date: string | null;
  scheduled_end_date: string | null;
  actual_end_date: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_at: string;
  accepted_at: string | null;
  profile?: Profile;
}

export interface Invitation {
  id: string;
  company_id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface RFI {
  id: string;
  project_id: string;
  rfi_number: number;
  title: string;
  description: string | null;
  status: RfiStatus;
  priority: Priority;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  ball_in_court_id: string | null;
  linked_drawing_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RFIResponse {
  id: string;
  rfi_id: string;
  user_id: string;
  response_text: string;
  attachments: string[] | null;
  created_at: string;
}

export interface Submittal {
  id: string;
  project_id: string;
  submittal_number: number;
  title: string;
  description: string | null;
  spec_section: string | null;
  status: SubmittalStatus;
  priority: Priority;
  created_by: string;
  due_date: string | null;
  revision_number: number;
  created_at: string;
  updated_at: string;
}

export interface SubmittalReviewer {
  id: string;
  submittal_id: string;
  user_id: string;
  review_order: number;
  status: 'pending' | 'approved' | 'rejected' | 'revise';
  reviewed_at: string | null;
  comments: string | null;
}

export interface BudgetDivision {
  id: string;
  project_id: string;
  name: string;
  code: string;
  budgeted_amount: number;
  spent: number;
  committed: number;
  created_at: string;
}

export interface BudgetLineItem {
  id: string;
  division_id: string;
  description: string;
  cost_code: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total: number;
}

export interface ChangeOrder {
  id: string;
  project_id: string;
  co_number: number;
  title: string;
  description: string | null;
  amount: number;
  status: ChangeOrderStatus;
  submitted_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyLog {
  id: string;
  project_id: string;
  log_date: string;
  weather_condition: string | null;
  temperature: number | null;
  wind: string | null;
  created_by: string;
  status: DailyLogStatus;
  signature_url: string | null;
  ai_narrative: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyLogEntry {
  id: string;
  daily_log_id: string;
  entry_type: 'manpower' | 'equipment' | 'incident' | 'note' | 'photo';
  data: Record<string, unknown>;
  created_at: string;
}

export interface Drawing {
  id: string;
  project_id: string;
  set_number: string;
  title: string;
  discipline: string;
  current_revision: string;
  created_at: string;
  updated_at: string;
}

export interface DrawingSheet {
  id: string;
  drawing_id: string;
  sheet_number: string;
  title: string;
  file_id: string | null;
  revision: string;
  uploaded_at: string;
}

export interface DrawingMarkup {
  id: string;
  sheet_id: string;
  user_id: string;
  markup_data: Record<string, unknown>;
  created_at: string;
}

export interface PunchListItem {
  id: string;
  project_id: string;
  item_number: number;
  description: string;
  area: string;
  assigned_to: string | null;
  priority: Priority;
  status: PunchItemStatus;
  due_date: string | null;
  photos: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface FileRecord {
  id: string;
  project_id: string;
  name: string;
  file_type: string;
  size: number;
  storage_path: string;
  uploaded_by: string;
  folder_path: string;
  created_at: string;
}

export interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  project_id: string;
  meeting_type: 'oac' | 'safety' | 'coordination' | 'general';
  title: string;
  meeting_date: string;
  meeting_time: string;
  location: string | null;
  created_by: string;
  created_at: string;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  user_id: string;
  status: 'invited' | 'accepted' | 'declined';
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  description: string;
  assigned_to: string | null;
  due_date: string | null;
  status: 'open' | 'in_progress' | 'completed';
}

export interface Crew {
  id: string;
  project_id: string;
  name: string;
  foreman_id: string | null;
  trade: string;
  size: number;
  status: 'active' | 'standby' | 'off_site';
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
}

// Helper: make specific fields optional for inserts (auto-generated by DB)
type InsertRow<T, K extends keyof T = never> = Omit<T, K> & Partial<Pick<T, K>>;

// Supabase Database type definition
export interface Database {
  public: {
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Views: Record<string, never>;
    Tables: {
      companies: {
        Row: Company;
        Insert: InsertRow<Company, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Company>;
      };
      profiles: {
        Row: Profile;
        Insert: InsertRow<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Profile>;
      };
      projects: {
        Row: Project;
        Insert: InsertRow<Project, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Project>;
      };
      project_members: {
        Row: ProjectMember;
        Insert: InsertRow<ProjectMember, 'id' | 'invited_at'>;
        Update: Partial<ProjectMember>;
      };
      invitations: {
        Row: Invitation;
        Insert: InsertRow<Invitation, 'id' | 'created_at'>;
        Update: Partial<Invitation>;
      };
      rfis: {
        Row: RFI;
        Insert: InsertRow<RFI, 'id' | 'rfi_number' | 'created_at' | 'updated_at'>;
        Update: Partial<RFI>;
      };
      rfi_responses: {
        Row: RFIResponse;
        Insert: InsertRow<RFIResponse, 'id' | 'created_at'>;
        Update: Partial<RFIResponse>;
      };
      submittals: {
        Row: Submittal;
        Insert: InsertRow<Submittal, 'id' | 'submittal_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Submittal>;
      };
      submittal_reviewers: {
        Row: SubmittalReviewer;
        Insert: InsertRow<SubmittalReviewer, 'id'>;
        Update: Partial<SubmittalReviewer>;
      };
      budget_divisions: {
        Row: BudgetDivision;
        Insert: InsertRow<BudgetDivision, 'id' | 'created_at'>;
        Update: Partial<BudgetDivision>;
      };
      budget_line_items: {
        Row: BudgetLineItem;
        Insert: InsertRow<BudgetLineItem, 'id'>;
        Update: Partial<BudgetLineItem>;
      };
      change_orders: {
        Row: ChangeOrder;
        Insert: InsertRow<ChangeOrder, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<ChangeOrder>;
      };
      daily_logs: {
        Row: DailyLog;
        Insert: InsertRow<DailyLog, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<DailyLog>;
      };
      daily_log_entries: {
        Row: DailyLogEntry;
        Insert: InsertRow<DailyLogEntry, 'id' | 'created_at'>;
        Update: Partial<DailyLogEntry>;
      };
      drawings: {
        Row: Drawing;
        Insert: InsertRow<Drawing, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Drawing>;
      };
      drawing_sheets: {
        Row: DrawingSheet;
        Insert: InsertRow<DrawingSheet, 'id'>;
        Update: Partial<DrawingSheet>;
      };
      drawing_markups: {
        Row: DrawingMarkup;
        Insert: InsertRow<DrawingMarkup, 'id' | 'created_at'>;
        Update: Partial<DrawingMarkup>;
      };
      punch_list_items: {
        Row: PunchListItem;
        Insert: InsertRow<PunchListItem, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<PunchListItem>;
      };
      files: {
        Row: FileRecord;
        Insert: InsertRow<FileRecord, 'id' | 'created_at'>;
        Update: Partial<FileRecord>;
      };
      file_versions: {
        Row: FileVersion;
        Insert: InsertRow<FileVersion, 'id' | 'created_at'>;
        Update: Partial<FileVersion>;
      };
      meetings: {
        Row: Meeting;
        Insert: InsertRow<Meeting, 'id' | 'created_at'>;
        Update: Partial<Meeting>;
      };
      meeting_attendees: {
        Row: MeetingAttendee;
        Insert: InsertRow<MeetingAttendee, 'id'>;
        Update: Partial<MeetingAttendee>;
      };
      action_items: {
        Row: ActionItem;
        Insert: InsertRow<ActionItem, 'id'>;
        Update: Partial<ActionItem>;
      };
      crews: {
        Row: Crew;
        Insert: InsertRow<Crew, 'id' | 'created_at'>;
        Update: Partial<Crew>;
      };
      activity_log: {
        Row: ActivityLogEntry;
        Insert: InsertRow<ActivityLogEntry, 'id' | 'created_at'>;
        Update: Partial<ActivityLogEntry>;
      };
      notifications: {
        Row: Notification;
        Insert: InsertRow<Notification, 'id' | 'created_at'>;
        Update: Partial<Notification>;
      };
    };
  };
}
