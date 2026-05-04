// ─────────────────────────────────────────────────────────────────────────────
// Homepage Redesign — Stream Contract (LOCKED)
// ─────────────────────────────────────────────────────────────────────────────
// This file is the single source of truth for the homepage redesign types.
// It is committed BEFORE parallel work begins. The four parallel sessions
// (data, UI, navigation, Iris) all import from here.
//
// DO NOT change shape mid-flight — coordinate any update through CONTRACT.md.
// ─────────────────────────────────────────────────────────────────────────────

import type { Permission } from '../hooks/usePermissions'

// ProjectRole is the canonical 15-value role from the membership table.
// Defined inline here to keep the locked contract self-sufficient regardless
// of the upstream re-export in src/types/database.ts.
export type ProjectRole =
  | 'owner'
  | 'project_executive'
  | 'admin'
  | 'project_manager'
  | 'superintendent'
  | 'foreman'
  | 'project_engineer'
  | 'field_engineer'
  | 'safety_manager'
  | 'subcontractor'
  | 'architect'
  | 'owner_rep'
  | 'member'
  | 'field_user'
  | 'viewer'

// ── Stream personas (UI lens, NOT auth) ─────────────────────────────────────
// Six personas drive the role-based homepage. They are derived from the
// canonical 15-value ProjectRole; they are not a new auth role.

export type StreamRole =
  | 'pm'
  | 'superintendent'
  | 'owner'
  | 'subcontractor'
  | 'architect'
  | 'executive'

export function toStreamRole(role: ProjectRole | null | undefined): StreamRole {
  switch (role) {
    case 'project_manager':
    case 'admin':
      return 'pm'
    case 'superintendent':
    case 'foreman':
    case 'field_engineer':
    case 'field_user':
      return 'superintendent'
    case 'owner':
    case 'owner_rep':
      return 'owner'
    case 'subcontractor':
      return 'subcontractor'
    case 'architect':
    case 'project_engineer':
    case 'safety_manager':
      return 'architect'
    case 'project_executive':
      return 'executive'
    case 'viewer':
    case 'member':
    default:
      return 'pm'
  }
}

// ── Item taxonomy ───────────────────────────────────────────────────────────

export type StreamItemType =
  | 'rfi'
  | 'submittal'
  | 'punch'
  | 'change_order'
  | 'task'
  | 'daily_log'
  | 'incident'
  | 'schedule'
  | 'commitment'

export type Urgency = 'critical' | 'high' | 'medium' | 'low'

export type CardType =
  | 'action'
  | 'risk'
  | 'decision'
  | 'commitment'
  | 'draft'
  | 'source'

// Narrow handler identifiers — UI dispatches on these.
export type ActionHandler =
  | 'respond'
  | 'approve'
  | 'reject'
  | 'review'
  | 'reassign'
  | 'assign'
  | 'complete'
  | 'create_log'
  | 'view_schedule'
  | 'view_drawing'
  | 'view_source'
  | 'add_to_report'
  | 'send_reminder'
  | 'mark_received'
  | 'escalate'
  | 'send_draft'
  | 'edit_draft'
  | 'dismiss_draft'
  | 'snooze'
  | 'dismiss'
  | 'open'
  | 'share'

// ── Source trail — every AI claim must point back here ──────────────────────

export interface SourceReference {
  type:
    | 'drawing'
    | 'spec'
    | 'rfi'
    | 'submittal'
    | 'schedule_activity'
    | 'budget_line'
    | 'photo'
    | 'meeting_note'
    | 'email'
    | 'daily_log'
    | 'inspection'
    | 'change_order'
  id: string
  title: string
  url: string
  relevance?: string
}

// ── Card actions — every card has a next action ─────────────────────────────

export interface StreamAction {
  label: string
  type: 'primary' | 'secondary' | 'dismiss'
  handler: ActionHandler
  icon?: string                  // Lucide icon name
  permissionKey?: Permission     // PermissionGate wraps the button when set
}

// ── Iris enhancement metadata (NOT the draft itself) ────────────────────────

export type IrisDraftType =
  | 'follow_up_email'
  | 'daily_log'
  | 'rfi_response'
  | 'submittal_review'
  | 'schedule_suggestion'
  | 'owner_update'

export interface IrisEnhancement {
  draftAvailable: boolean
  draftType: IrisDraftType
  confidence: number             // 0..1
  summary: string                // one-line teaser
  draftContent?: string          // populated lazily by drafts service
  sources?: string[]             // human-readable source descriptors
}

// ── Commitment subtype ──────────────────────────────────────────────────────

export interface Commitment {
  id: string
  party: string                  // "Martinez Engineering"
  commitment: string             // "RFI 042 response"
  source: CommitmentSource
  dueDate: string
  status: 'on_track' | 'at_risk' | 'overdue' | 'received'
  relatedItems: string[]
}

export interface CommitmentSource {
  type: 'rfi' | 'submittal' | 'meeting' | 'email' | 'daily_log' | 'task' | 'comment'
  id: string
  title: string
  date: string
}

// ── The unified stream item ─────────────────────────────────────────────────

export interface StreamItem {
  id: string                     // prefixed: "rfi-123", "punch-456"
  type: StreamItemType
  cardType: CardType
  title: string
  reason: string                 // "3 days overdue", "Due tomorrow"
  urgency: Urgency
  dueDate: string | null
  assignedTo: string | null
  waitingOnYou: boolean
  overdue: boolean
  createdAt: string
  sourceData: unknown            // raw record from underlying hook
  sourceTrail: SourceReference[]
  actions: StreamAction[]
  irisEnhancement?: IrisEnhancement
  // Commitment-card payload
  party?: string
  commitment?: string
  commitmentSource?: CommitmentSource
  // Risk-card payload (optional — UI degrades gracefully when absent)
  impactChain?: string[]
  scheduleImpactDays?: number
  costImpact?: number
}

// ── Persistence model ───────────────────────────────────────────────────────
// Snooze: localStorage, per-user, item-id → ISO datetime to resurface.
// Dismiss: in-memory (Zustand session), cleared on reload.
// Mark Resolved / Mark Complete: mutates the source record via existing
//   mutation hooks; React Query invalidation re-pulls the stream.
//
// Snooze options exposed to UI: snooze for 1 hour | tomorrow | next week.

export type SnoozeDuration = '1h' | 'tomorrow' | 'next_week'

// ── Hook result shape ───────────────────────────────────────────────────────

export interface ActionStreamResult {
  items: StreamItem[]
  counts: {
    total: number
    critical: number
    overdue: number
    waitingOnYou: number
  }
  isLoading: boolean
  error: Error | null
  refetch: () => void
  dismiss: (id: string) => void
  snooze: (id: string, duration: SnoozeDuration) => void
}

// ── Magic-link sub identity (audit attribution) ─────────────────────────────
// Subs may either log in (full ProjectRole = 'subcontractor') OR enter via a
// magic link to /sub/[token]. Both render the same stream UI, scoped to
// items assigned to their company. The hash-chain audit captures actor_kind.

export type ActorKind = 'user' | 'magic_link'

export interface ActorContext {
  kind: ActorKind
  userId?: string
  magicLinkTokenId?: string
  companyId?: string             // only for magic_link sub access
}
