# SiteSync RFI Module — Bugatti-Grade Build Spec

**Date:** 2026-05-04
**Status:** Spec ready. Hand entire doc to Claude Code as the definitive build target. Phased delivery: P0 → P5 over ~12 weeks.
**Replaces:** the legacy `src/pages/RFIs.tsx` minimum-viable surface.
**Drives:** the build that beats Procore on every dimension that matters for mid-market commercial GCs.
**Companion docs:**
- `RFI_DEEP_DIVE_2026-05-04.md` — live audit findings (32/100 today; Walker's "30%" was right)
- `RFI_INDUSTRY_RESEARCH_2026-05-04.md` — 3,300-word benchmark (15-25 RFIs/$1M, 9.7-day median response, 4-9% CO conversion, $774K/yr labor cost)
- Walker's Procore parity spec (pasted 2026-05-04) — the enterprise blueprint
- `BUGATTI_LAUNCH_ROADMAP_2026-05-04.md` — Iris/free-sub-portal/embedded-payments wedge framing
- `IRIS_VOICE_GUIDE_SPEC_2026-05-04.md` — voice rules apply to every Iris-generated string in this module

---

## TL;DR — The Bet

**Procore's RFI module is the gold standard. We will beat it on 11 specific dimensions.** Procore's 2003-architecture rejects each. The wedge:

1. **Voice → RFI in 12 seconds on the slab** (mobile-first; AI structures it)
2. **Drawing pin precision** (Iris finds column line 7 from photo; sub-pixel accuracy)
3. **Iris drafts the answer before the architect responds** (ball-in-court > 5 days → predicted answer in inbox)
4. **Auto-classified cost + schedule impact** at filing time (with quantification, not Yes/No/TBD)
5. **Similar-past-RFI surfacing** ("on RFI-072 architect ruled spec governs")
6. **Hash-chain audit on every RFI action** (court-defensible — no incumbent has)
7. **Free public guest portal for unlicensed subs** (zero seat cost)
8. **Bilingual EN/ES** (Spanish field crews)
9. **Threaded discussion + @mentions + reactions** (Slack-grade collaboration)
10. **Real-time collaboration on the question + response** (Notion-grade live editing)
11. **Auto-creates Change Event when Cost Impact = Yes + value > threshold** (workflow chains)

**Net target score:** RFI module 94/100 vs Procore's ~80. **Time to ship:** Phase-1 (the Tier-1 demo blockers) in 2 weeks; Phase-5 (the full Procore-killer) in 12 weeks.

---

## Part 1 — The Surfaces (9, not 5)

The minimum surface count is 9. Each is a separate URL + dedicated UX. None can be a tab inside another.

| # | Surface | Path | Why separate |
|---|---|---|---|
| 1 | **RFI Log** (list + Kanban + Timeline + Map + Pin views) | `/rfis` | Primary entry; high-volume scan |
| 2 | **RFI Detail** (drawer + full-page; live-collaborative) | `/rfis/:id` | Per-record deep work |
| 3 | **Create / Quick-Capture** (web form + mobile voice + drawing-pin) | `/rfis/new` (+ inline drawer + mobile + drawing context) | Three entry modes; same data |
| 4 | **Settings & Workflow Builder** | `/rfis/settings` | Project-level config |
| 5 | **Reports & Dashboards** | `/rfis/reports` | Analytics surface |
| 6 | **Public Guest Portal** (sub-side, no SiteSync account needed) | `sub.sitesync.com/rfi/:token` | Network-effect wedge |
| 7 | **Mobile / PWA** (offline capture; voice-first) | iOS + Android (per ADR-010) | Field UX |
| 8 | **Email-in / Email-out** (per-project unique reply-to) | n/a (email infrastructure) | Architect replies via email; auto-imported |
| 9 | **Recycle Bin / Audit / Versioning** | `/rfis/recycle-bin`, `/rfis/:id/history`, `/rfis/:id/versions` | Forensics + recovery |

Procore's 5 surfaces (Log, Recycle Bin, Create, Detail, Settings) collapse to a strict subset of ours.

---

## Part 2 — Information Architecture

### Top-level navigation (in `/rfis` log)

```
RFIs                                        ⚙️    ↓Export   📊Reports   ✨AI Draft   + New RFI
1,247 active · 23 overdue · 4 awaiting your response

[Items] [Recycle Bin]                                    [Iris suggests...]

┌─────────────┐  ┌──────────────────────────────────────────────────────────────┐
│ SAVED VIEWS │  │  🔍 Search...        ⛔ All Filters    ⚙️ Configure         │
│             │  ├──────────────────────────────────────────────────────────────┤
│ All RFIs    │  │  [List] [Kanban] [Timeline] [Map] [Drawing Pins]              │
│             │  ├──────────────────────────────────────────────────────────────┤
│ ▸ Company   │  │  ☐  #     Status    Subject                  ...etc          │
│ ▸ Project   │  │                                                                │
│ ▸ My Views  │  │                                                                │
│ + Create    │  │                                                                │
└─────────────┘  └──────────────────────────────────────────────────────────────┘
```

### Saved Views model

- **My Views** (user-only) — saves filters + columns + sort + view-type
- **Project Views** (shared with project) — admin can promote a personal view
- **Company Views** (admin-published) — applied to all projects; locked to read for non-admins

### Filter panel (per Procore parity + extensions)

Procore filters: Status, Responsible Contractor, Received From, Assignees, RFI Manager, Ball In Court, Overdue, Location, Cost Code, RFI Stage, Created By, Created By (Company).

**SiteSync extensions:**
- Trade / Discipline (custom-tagged)
- Schedule Impact (Y/N/TBD/Unknown + days range)
- Cost Impact (Y/N/TBD/Unknown + dollar range)
- AI Risk Score (Schedule/Cost/Quality buckets)
- Drawing reference (with auto-complete from drawings tool)
- Spec section (with auto-complete from specifications tool)
- Has linked Submittal / Change Event / Schedule Task / Punch Item
- "Aging > N days in current state"
- "Has unread responses"
- "Ball-in-court is me"
- "Watching"

### Five view types

1. **List** (Procore-parity table)
2. **Kanban** (column = status; drag to transition; respects state-machine guards)
3. **Timeline** (Gantt-style; columns = dates; bars = ball-in-court duration)
4. **Map** (project locations; pin per RFI count; drill-down to Drawing-Pins)
5. **Drawing Pins** (drawing viewer with overlay of every RFI's pin; click pin → Detail drawer)

URL state: `?view=kanban&filter[status]=Open&sort=number_desc`. Shareable.

---

## Part 3 — Complete Data Model

### TypeScript shape (canonical)

```typescript
// src/types/rfi.ts

export type RfiStatus =
  | 'Draft'
  | 'Open'
  | 'PendingResponse'
  | 'PendingReview'      // architect responded; manager reviewing
  | 'Returned'           // returned-to-court for clarification
  | 'Closed'
  | 'Void'

export interface RfiNumber {
  prefix?: string              // configurable: "RFI-", "AR-", null
  sequence: number             // auto-incremented
  scheme: 'sequential' | 'byStage' | 'bySpecDivision' | 'byTrade'
  display: string              // computed: "RFI-001-MEP" or "AR-014"
}

export interface RfiAttachment {
  id: string
  fileId: string
  name: string
  mime: string
  size: number
  type: 'image' | 'pdf' | 'sheet' | 'video' | 'audio' | 'other'
  sheetRef?: { sheetId: string; rev: number }    // when type='sheet'
  pinCoords?: { x: number; y: number; sheetId: string; rev: number }
  markupId?: string            // links to drawing markup tool
  createdAt: string
  uploadedBy: string
}

export interface RfiQuestion {
  richText: string             // ProseMirror / Lexical / TipTap JSON
  plainText: string            // for search + AI
  voiceMemoUrl?: string        // S3 path
  voiceTranscript?: string     // Whisper output
  language: 'en' | 'es'        // for translation pipeline
}

export interface RfiResponse {
  id: string
  authorId: string
  authorCompanyId: string
  createdAt: string
  editedAt?: string
  richText: string
  plainText: string
  attachments: RfiAttachment[]
  mentions: string[]           // userIds @-mentioned
  parentResponseId?: string    // threaded
  reactions: { emoji: string; userIds: string[] }[]
  official: boolean
  eSignature?: {
    signedBy: string
    signedAt: string
    ip: string
    signatureImageUrl: string
    certHash: string           // hash-chain anchor
  }
}

export interface RfiAi {
  draftAnswer?: string
  draftAnswerConfidence?: number      // 0-1
  similarRfis: {
    rfiId: string
    projectId: string
    similarity: number
    answerSummary: string
    differentInWhatWay?: string       // Iris explains the diff
  }[]
  suggestedSpec?: { divisionId: string; sectionId: string; paragraph?: string }
  suggestedCostCode?: string
  suggestedLocation?: string
  suggestedResponsibleContractor?: string
  suggestedAssignees?: string[]
  suggestedDistribution?: string[]
  riskScore: {
    schedule: 'low' | 'medium' | 'high'
    cost: 'low' | 'medium' | 'high'
    quality: 'low' | 'medium' | 'high'
    overall: 'low' | 'medium' | 'high'
  }
  autoTags: string[]
  summary: string
  modelFingerprint: string             // for hash-chain
  promptHash: string                   // for hash-chain
}

export interface Rfi {
  id: string
  projectId: string
  orgId: string

  number: RfiNumber
  subject: string                       // required, max 200
  question: RfiQuestion
  attachments: RfiAttachment[]

  status: RfiStatus
  manager: string                       // userId, required
  receivedFrom?: string
  assignees: { userId: string; responseRequired: boolean; respondedAt?: string }[]
  distribution: string[]                // userIds
  ballInCourt: string[]                 // computed; userIds
  watchers: string[]

  createdBy: string
  createdAt: string
  dateInitiated?: string                // stamped on Open
  dateClosed?: string

  dueDate?: string                      // required when status > Draft
  slaPolicyId?: string
  workingDaysToAnswer: number           // default 3 (configurable)

  responsibleContractor?: string        // vendorId
  specSection?: { divisionId: string; sectionId: string; paragraph?: string }
  location?: string                     // hierarchical locationNodeId
  drawingRefs: { sheetId: string; rev: number; pin?: { x: number; y: number }; markupId?: string }[]
  costCode?: string
  rfiStage?: string
  reference?: string                    // external ref

  scheduleImpact: {
    type: 'yes' | 'no' | 'tbd' | 'unknown'
    days?: number
    tasks?: string[]                    // scheduleTaskIds
  }
  costImpact: {
    type: 'yes' | 'no' | 'tbd' | 'unknown'
    amountCents?: number                // INTEGER CENTS per money-cents migration
    currency?: string                   // default USD
    lineItems?: { description: string; amountCents: number }[]
  }

  private: boolean
  privateAcl?: string[]
  customFields: Record<string, unknown>

  ai: RfiAi
  responses: RfiResponse[]

  linkedItems: {
    drawings: string[]
    submittals: string[]
    changeEvents: string[]
    scheduleTasks: string[]
    punchItems: string[]
    meetings: string[]
    photos: string[]
    dailyLogs: string[]
    forms: string[]
    observations: string[]
    documents: string[]
    inspections: string[]
    otherRfis: string[]
  }

  versionChain: {
    rootId: string
    prevId?: string
    version: number
  }

  audit: {
    actor: string
    action: string
    at: string
    field?: string
    from?: unknown
    to?: unknown
    ip?: string
    device?: string
    chainRowId: string                  // hash-chain anchor
  }[]

  emails: {
    direction: 'in' | 'out'
    from: string
    to: string[]
    cc?: string[]
    subject: string
    body: string
    sentAt: string
    attachments: RfiAttachment[]
    threadId: string
  }[]

  notifications: {
    event: string
    channel: 'email' | 'slack' | 'sms' | 'teams' | 'push' | 'in_app'
    sentTo: string[]
    sentAt: string
    status: 'queued' | 'sent' | 'delivered' | 'opened' | 'failed'
  }[]

  tags: string[]
}
```

### SQL migration sketch

The current `rfis` table will need expansion. Migration in `supabase/migrations/<date>_rfis_bugatti_expansion.sql`:

```sql
-- Expand existing rfis table
ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS number_prefix TEXT,
  ADD COLUMN IF NOT EXISTS number_scheme TEXT NOT NULL DEFAULT 'sequential' CHECK (number_scheme IN ('sequential','byStage','bySpecDivision','byTrade')),
  ADD COLUMN IF NOT EXISTS question_rich_text JSONB,
  ADD COLUMN IF NOT EXISTS question_plain_text TEXT GENERATED ALWAYS AS (question_rich_text->>'text') STORED,
  ADD COLUMN IF NOT EXISTS voice_memo_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_transcript TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','es')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL CHECK (status IN ('Draft','Open','PendingResponse','PendingReview','Returned','Closed','Void')),
  ADD COLUMN IF NOT EXISTS manager_id UUID NOT NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS received_from UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS working_days_to_answer INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS responsible_contractor_id UUID,
  ADD COLUMN IF NOT EXISTS spec_section JSONB,
  ADD COLUMN IF NOT EXISTS location_id UUID,
  ADD COLUMN IF NOT EXISTS cost_code_id UUID,
  ADD COLUMN IF NOT EXISTS rfi_stage_id UUID,
  ADD COLUMN IF NOT EXISTS schedule_impact_type TEXT CHECK (schedule_impact_type IN ('yes','no','tbd','unknown')),
  ADD COLUMN IF NOT EXISTS schedule_impact_days INTEGER,
  ADD COLUMN IF NOT EXISTS cost_impact_type TEXT CHECK (cost_impact_type IN ('yes','no','tbd','unknown')),
  ADD COLUMN IF NOT EXISTS cost_impact_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS private_acl JSONB,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version_root_id UUID,
  ADD COLUMN IF NOT EXISTS version_prev_id UUID,
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;  -- soft delete for Recycle Bin

-- Sister tables
CREATE TABLE rfi_assignees (
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  response_required BOOLEAN NOT NULL DEFAULT FALSE,
  responded_at TIMESTAMPTZ,
  PRIMARY KEY (rfi_id, user_id)
);

CREATE TABLE rfi_distribution (
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (rfi_id, user_id)
);

CREATE TABLE rfi_watchers (
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (rfi_id, user_id)
);

CREATE TABLE rfi_drawing_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  sheet_id UUID NOT NULL,
  revision INTEGER NOT NULL,
  pin_x NUMERIC,                       -- 0..1 normalized
  pin_y NUMERIC,
  markup_id UUID
);

CREATE TABLE rfi_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_company_id UUID,
  parent_response_id UUID REFERENCES rfi_responses(id),
  rich_text JSONB NOT NULL,
  plain_text TEXT GENERATED ALWAYS AS (rich_text->>'text') STORED,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  e_signature JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE TABLE rfi_response_reactions (
  response_id UUID NOT NULL REFERENCES rfi_responses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  emoji TEXT NOT NULL,
  PRIMARY KEY (response_id, user_id, emoji)
);

CREATE TABLE rfi_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  from_address TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  thread_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL,
  message_id TEXT
);

CREATE TABLE rfi_linked_items (
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('drawing','submittal','change_event','schedule_task','punch_item','meeting','photo','daily_log','form','observation','document','inspection','other_rfi')),
  item_id UUID NOT NULL,
  PRIMARY KEY (rfi_id, item_type, item_id)
);

-- Indexes
CREATE INDEX idx_rfis_project_status ON rfis(project_id, status, due_date);
CREATE INDEX idx_rfis_ball_in_court ON rfis USING GIN((ai->'ballInCourt'));
CREATE INDEX idx_rfis_overdue ON rfis(project_id, due_date) WHERE status IN ('Open','PendingResponse');
CREATE INDEX idx_rfis_search ON rfis USING GIN(to_tsvector('english', subject || ' ' || question_plain_text));
CREATE INDEX idx_rfis_deleted ON rfis(project_id) WHERE deleted_at IS NULL;
```

---

## Part 4 — State Machine

```
              ┌───────┐
       ┌─────►│ Draft │
       │      └───┬───┘
       │          │ user clicks "Send" / "Open"
       │          ▼
       │      ┌──────┐
       │      │ Open │◄──── (default state on Send)
       │      └───┬──┘
       │          │ assignee responds
       │          ▼
       │   ┌──────────────────┐
       │   │ PendingReview    │ (manager reviewing response)
       │   └─────┬───┬────────┘
       │         │   │
       │     accept   reject
       │         │   │
       │         ▼   ▼
       │     ┌────┐ ┌──────────┐
       │     │Closed│Returned │ (back to ball-in-court)
       │     └─┬──┘ └────┬─────┘
       │       │         │
       │   reopen     respond
       │       │         │
       │       ▼         ▼
       └───────┘──────► Open
                       
                   ┌──────┐
                   │ Void │ (terminal, can't reopen)
                   └──────┘
```

### Transition guards (per Permissions matrix below)

| From | To | Who can | What happens |
|---|---|---|---|
| any | Draft | author | Draft mode (only manager + author see) |
| Draft | Open | manager+ | Stamps `dateInitiated`; locks number; triggers notifications |
| Open | PendingResponse | system | When ball-in-court accepts assignment |
| PendingResponse | PendingReview | assignee | Responds with content |
| PendingReview | Closed | manager | Marks response as Official; stamps `dateClosed` |
| PendingReview | Returned | manager | Returns with comment |
| Returned | Open | system | When new response added |
| Open | Void | manager+ | Reason required; terminal |
| Closed | Open | manager | "Reopen" — stamps reopened_at |

State machine implemented per ADR-009 (still descoped from `useMachine` runtime; helper validators OK).

---

## Part 5 — Permissions Matrix

Per `BUGATTI_LAUNCH_ROADMAP` ADR-008 + `PERMISSION_GATE_AUDIT`:

| Action | Owner | Admin | Manager | Standard | Read-Only | Distribution-only | Public Guest |
|---|---|---|---|---|---|---|---|
| View RFI list | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View specific RFI (non-private) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (if on dist) | ✅ (with token) |
| View private RFI | ✅ | ✅ | ✅ (mgr or asgn) | (asgn only) | (asgn only) | ❌ | ❌ |
| Create RFI | ✅ | ✅ | ✅ | ✅ (config) | ❌ | ❌ | ❌ |
| Edit RFI metadata | ✅ | ✅ | ✅ (own) | (own draft) | ❌ | ❌ | ❌ |
| Add response | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (token + assignee) |
| Mark official | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| e-Sign official | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Close | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Void | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reopen | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete (soft) | ✅ | ✅ | ✅ (own) | ❌ | ❌ | ❌ | ❌ |
| Restore from Recycle Bin | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hard-delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Modify Settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export PDF (single) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Export CSV (bulk) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

Every action above wraps in `<PermissionGate permission="rfi.<action>">`. CI fails any unguarded action — same lint rule as Lap 1's PermissionGate audit, extended.

---

## Part 6 — RFI Log (List View) — Full UX Spec

### Header

```
RFIs                             ⚙️    [↓ Export ▾]   [📊 Reports ▾]   [✨ AI Draft]   [+ New RFI]
1,247 active · 23 overdue · 4 awaiting your response          [Tabs: Items | Recycle Bin]
```

### Subhead alerts

If the user has open ball-in-court items: **prominent banner** "4 RFIs are awaiting your response. [Review →]"

If 5+ overdue this week: banner "23 RFIs overdue. [View all overdue →]"

### Saved Views (left rail)

- **Default:** "All RFIs"
- **Smart Views** (Iris-generated, refresh nightly):
  - "Awaiting your response"
  - "Stalled (ball-in-court > 7 days)"
  - "Critical-path blockers" (linked to schedule)
  - "Cost > $10K"
  - "Filed by me this week"
- **Company Views:** admin-published
- **Project Views:** project-shared
- **Personal Views:** + Create New

### Toolbar

- ← Views (collapse rail)
- 🔍 Search (full-text: subject + question + plain-text response + transcript)
- 🎚️ All Filters (opens panel — see Part 2)
- ⚙️ Configure columns
- View toggle: List | Kanban | Timeline | Map | Drawing Pins

### Columns (configurable)

Default visible: ☐ checkbox · # · Status · Subject · Ball In Court · Due · Priority · Cost Impact · Schedule Impact

Configurable: Spec, Drawing Ref, Location, Trade, RFI Manager, Responsible Contractor, Distribution count, Created By, Created At, Closed At, Tags, Risk Score, Last Activity At, Linked-items count.

**Bugatti requirements:**
- Every cell with a UUID resolves to a name (the bug-fix from `RFI_DEEP_DIVE_2026-05-04.md`)
- Overdue rows: Number rendered red; Due cell highlighted
- Unread responses: subtle blue dot left of #
- Status badges colored per status (Open=blue, PendingResponse=orange, PendingReview=yellow, Closed=green, Returned=purple, Void=gray, Draft=light-gray)
- Aging color treatment on Ball In Court: green ≤3d, yellow 4-7d, orange 8-14d, red >14d

### Bulk operations

Select rows → top toolbar appears with: Distribute / Forward / Set Priority / Set Stage / Set Due Date / Tag / Mark Read / Export selected / Delete (soft) / Reassign Manager.

### Pagination

URL-driven: `?page=N&per_page=50` (max 200).

### Kanban view

Columns = status. Cards = subject + due + ball-in-court avatars + AI risk dot. Drag-to-transition (state-machine-validated).

### Timeline view

Horizontal Gantt: bar starts at `created_at`, ends at `dateClosed` or now. Color = status. Hover = ball-in-court history. Click = Detail drawer.

### Map view

Project-level location pins with RFI counts. Drill into a location → list filtered to that location. Useful when project has multiple buildings.

### Drawing Pins view

The drawing viewer with every RFI's pin overlaid (with status color). Click a pin → Detail drawer slides in. **This is the single most-differentiated view** — no other PM tool has it.

---

## Part 7 — Create / Quick-Capture (3 Modes)

### Mode 1 — Web Full Form

Drawer-from-right (preserves list context) OR full-page. Both work.

**Sticky right-rail Iris assistant** (see Part 13) shows live as user types:
- Suggested Subject (if blank)
- Suggested Spec (auto-detect from drawing ref or photo)
- Suggested Cost Code
- Suggested Location
- Suggested Responsible Contractor
- Suggested Distribution List
- "3 similar RFIs found" with answers + confidence
- Predicted answer draft (one-click "Send for review")
- Risk score badges (Schedule 🟡 / Cost 🟢 / Quality 🟡)

**Section 1 — Request (always expanded):**

| Field | Type | Required | Notes |
|---|---|---|---|
| Subject | text input + Iris autosuggest | ✅ | Max 200 chars |
| Question | rich-text editor (TipTap) | ✅ | Bold/italic/lists/indent + drag-attach |
| Voice memo | record button | — | Mobile primary; web optional. AI transcribes + structures |
| Attachments | drag-drop zone | — | Multi-file; auto-detects sheet refs from PDFs |

**Section 2 — General Info (collapsible, 4-col):**

Same as Procore parity table, **plus**:
- Trade / Discipline (dropdown — MEP/Structural/Architectural/etc.)
- Drawing reference: **library lookup** (NOT freeform); pulls from `drawings` table; lets user drop a pin
- Spec section: **library lookup** (NOT freeform); pulls from `specifications` table
- RFI Type: dropdown (Design Clarification, Coordination, Field Condition, Owner Directive, Bulletin Response)
- Schedule Impact: select + days input + linked task picker
- Cost Impact: select + amount (in cents) + line items (multi-row)

**Section 3 — Iris Says (auto-collapse if no insights):**

Iris-generated insights, each with "Apply" button:
- "Looks like a duplicate of RFI-072 (filed 2026-04-15). Want to link?"
- "Spec section 09 30 00 covers this — auto-fill?"
- "Smith Group answered similar question on Project X in 4 days — predict same"
- "MEP coordinator should be CC'd — auto-add?"

**Footer (sticky):**

- `* required fields`
- Cancel button
- **Save as Draft** button (per Procore parity)
- **Open RFI** primary button (iris-gold)

### Mode 2 — Mobile Voice (the 12-second moment)

- Tap Iris FAB (or "+ RFI" in bottom nav)
- Big mic button: hold to record; release = stop
- Voice transcribed (Whisper or equivalent) in 1-2s
- Iris structures into RFI form: subject, question, suggested spec, suggested drawing
- PM reviews on screen; **single tap to confirm** sends as Open
- **Total time from raw thought to filed RFI: 12 seconds** (the demo moment)

### Mode 3 — Drawing-Pin Mode

- User in drawing viewer, sees a question on the slab
- Tap "Drop RFI Pin" → drops a pin at coords
- Drawer opens pre-populated: drawing_ref + sheet + rev + pin coords + spec auto-detected
- User types question; sends
- Pin permanently lives on drawing (per `IRIS_CITATIONS_SPEC` deep-link contract)

---

## Part 8 — RFI Detail View

### Layout

Two presentations:
1. **Drawer** (slides from right; stays in list context) — for quick reads
2. **Full page** at `/rfis/:id` — for deep work; bookmarkable

Both render same UX; user can promote drawer to full-page with ↗.

### Header

```
← Back to RFIs            RFI-092  Open  ·  1d open                  👁 Watching 1   Edit   ⋮ More
                                                                     [Distribute] [Close RFI]
Wall finish at column line 7 — drawing shows AC-1 acoustical
panel; spec calls for AT-2 textured plaster. Which controls?

  📍  Ball in court: Smith Group Architects (Sarah Chen)
  📅  Due: May 12, 2026 (in 6 days)        🏷 MEP        💰 $0    📅 0d
  📐  Drawing: A-201 (rev 2) · 📋 Spec: 09 30 00 · 📍 Loc: Bldg A / L4 / Open Office
```

**Bugatti fix from audit:** `Ball in court` resolves to a person + company. Never UUID.

### Tabs

- **General** (default) — Question, Responses, Sidebar of metadata
- **Related Items** — drag/drop linker; shows linked drawings/submittals/COs/schedule tasks/punch items
- **Activity** — full Change History (per Part 14)
- **Emails** — inbound/outbound thread
- **Versions** — version chain

### General Tab — main content

**Request panel:**
- Question (rich text rendered)
- Attachments (gallery; image previews; PDF document viewer inline)
- Voice memo (audio player with transcript)

**Responses panel:**
- Threaded; @mention linkified; emoji reactions; markdown render
- Each response card: avatar + name + company + timestamp + content + attachments + actions
- "OFFICIAL RESPONSE" green badge on chosen one
- e-Signature stamp if signed
- "Mark Official" / "Edit" / "Delete" / "Reply" / "React" actions per response
- Empty state: "No responses yet. Iris drafted one — review it: [Review draft →]" if Iris has produced a predicted answer
- "+ Add Response" rich-text input (with file drop)

**Iris suggests panel** (collapsed if empty):
- "Predicted answer draft (87% confidence): ..." with [Send to assignee for review] button
- "Similar past RFIs:" list with quick-link

### General Tab — Sidebar

Read-only mirror of all create-form fields, **but every field is inline-editable** for users with permission. Click any field → inline editor; tab/blur/enter saves. Optimistic update with conflict detection.

### Inline-edit rules

Per the audit, the lack of inline-edit was a Sev-1. Every metadata field gets:
- Click anywhere on the field → editor opens in place
- Save: tab / Enter / blur
- Cancel: Escape
- Optimistic UI; revert on server error
- Audit row written for every change (Change History tab)

### Action buttons (top right)

| Button | Behavior |
|---|---|
| 👁 Watching N | Toggle watch (pull notifications) |
| Edit | Opens edit drawer with full form (vs inline; for batch metadata changes) |
| **Distribute** | Opens distribution dialog: pick people/groups; sends notifications + email |
| **Close RFI** (or **Reopen** if closed) | Confirms; transitions state; stamps timestamps |
| ⋮ More |  Forward · Email · Print PDF · Archive · Delete · Duplicate · Create Linked Submittal · Create Change Event |

The dropdown is now 8+ actions, not just Close/Void.

### Bottom — Quick Response

Slack-style input at bottom of viewport: rich text + attach + @mention + send. Cmd+Enter to fire. Always available regardless of scroll position.

### Real-time collaboration

- Live cursor + selection of other users currently viewing
- Typing indicators ("Sarah is typing...")
- Conflict resolution: last-writer-wins on metadata fields with diff banner ("Sarah changed Spec to 09 30 13 — accept?")
- Powered by Liveblocks or equivalent (Trunk Tools precedent — RN already uses this in audit findings)

---

## Part 9 — Settings & Workflow Builder

### General Settings

- **RFI Manager assignment policy**:
  - Standard users select any Admin or "Act as RFI Manager" granular user (recommended)
  - Default RFI Manager applied automatically (assign default)
- **Number scheme**: sequential / byStage / bySpecDivision / byTrade / custom prefix
- **Working days per week**: 5 (M-F) / 6 / 7 (configurable per project)
- **Days to Answer (default)**: 3 (per Procore parity)

### Private RFIs

- Enable Private RFIs (checkbox)
- Default new RFIs to private (checkbox)
- Private ACL editor: who can see private RFIs by default

### Custom Fields

- Up to 20 custom fields (vs Procore's 2 web-only)
- Types: text / number / select / multi-select / date / user-picker / vendor-picker / link-to-other-record
- Per-field: required toggle, default value, conditional visibility
- Mobile + web parity (Procore gap: their custom fields are web-only)

### Distribution

- **Default Distribution List** (chip-input of users; auto-added to every new RFI)
- **Trade-based distribution lists** ("All MEP Subs", "Fire+Life Safety") — predefined groups
- **Reminder cadence**: configurable per state (default daily for overdue)
- **Notification matrix**: rows = events (Created, Open, BIC Shift, Response Added, Closed, Reassigned, Reopened, DueDate Changed, Voided, Returned), columns = channel (Email/Slack/SMS/Teams/Push/In-App), per role (Creator/Manager/Assignee/Distribution/Watcher)

### Workflow Builder (the killer)

Visual flow editor for status transitions per project:
- Add custom states (e.g., "Submitted to Owner")
- Add custom transitions with conditions (e.g., "When Cost Impact > $10K and Closed → auto-create Change Event")
- Add SLA per transition (escalate after N hours)
- Add approval chains (manager → senior PM → owner) with required signers
- Test mode: dry-run a workflow against a sample RFI

This is the workflow Procore explicitly doesn't have. **It's the moat for top-100 GCs with custom processes.**

### Revisions

- Enable Revisions (allows version chain)
- Enabled by default for new projects

### Audit Settings

- Per-org retention policy (12-month default; 24-month for paid customers per ADR-008)
- Hash-chain attestation: shows latest Trail of Bits attestation date (per `CHAIN_AUDIT_PREP_2026-05-04.md`)

---

## Part 10 — Reports & Dashboards

### Canned Reports

- RFI Summary (count by status, by week, by trade)
- Aging report (ball-in-court > N days)
- Response time benchmark (median by architect, by trade, by phase)
- Cost-impact rolled up
- Schedule-impact rolled up (linked to schedule)
- Conversion-to-CO rate
- Created by user
- Distribution effectiveness (open rates per email recipient)

### Charts

Live (refresh hourly via materialized view):
- RFI volume trend (created / closed per week)
- Average response time (by architect; by trade)
- Backlog distribution (Open count by ball-in-court bucket)
- Risk score distribution

### Custom Reports

Drag-drop report builder: pick fields, filters, group-by, sort, chart type. Save and share. Schedule to email.

### Dashboard widgets

Project dashboard surfaces:
- "RFIs awaiting your response: N" widget
- "Overdue RFIs: N (red)" widget
- "Average architect response time: X days" widget (vs 7-day SLA)
- "Predicted CO conversion: $X this quarter" widget (Iris-driven)

---

## Part 11 — Public Guest Portal (Sub-Side, No Account)

The wedge from `BUGATTI_LAUNCH_ROADMAP` Program 12. RFI-specific implementation:

### What the sub sees

URL: `sub.sitesync.com/rfi/<token>`

- Magic-link in email; one-click to landing page
- 3 tabs: My RFIs / My Pay Apps / My Documents
- For RFIs: list of RFIs where this sub is on distribution OR is responsible-contractor
- Click → Detail (read-only unless they're an assignee)

### What the sub can do

- View RFI question + attachments + responses
- Respond (if they're an assignee)
- Add reactions / @mention internal team
- Download PDF
- e-Sign their response (legally binding per Part 5)

### What the sub cannot do

- See other GCs' RFIs
- See private RFIs they're not on
- Modify metadata
- Close / Void / Reopen

### Why this is the wedge

- Procore charges subs $30K/year for sub-portal access
- We charge $0 — forever
- Network effect: after 2 projects, sub asks their next GC "can you put this on SiteSync?"
- The free public guest portal removes the "we have to license every sub" objection that kills mid-market deals

---

## Part 12 — Mobile / PWA

### iOS + Android (per ADR-010 — RN + Expo)

- Primary capture surface: **voice + photo + drawing pin**
- Bottom-tab nav: Home / Inbox / RFIs / Capture / Profile
- RFI list: List / Kanban / Drawing Pins (3 views; Map/Timeline desktop-only)
- RFI Detail: full-screen drawer; thumb-friendly action buttons (44px minimum tap)

### Voice → RFI Flow (the 12-second moment)

1. PM on slab opens app → taps Capture FAB
2. Taps mic → speaks ("Wall finish at column line 7 — drawing shows acoustical, spec says plaster, which controls")
3. Iris transcribes + structures: subject + question + suggested spec + suggested drawing
4. PM reviews → confirms → Send
5. **Total time: 12 seconds**

### Offline Capture

- All voice/photo capture works offline (per `OFFLINE_FIRST_REWRITE_SPEC`)
- Queues up to 50 actions in op-sqlite
- Sync on reconnect with conflict resolution
- "Filed" indicator shows even when offline

### Push Notifications (per `PUSH_NOTIFICATIONS_SPEC`)

- New RFI assigned to me
- Response added to RFI I'm watching
- RFI overdue (mine)
- Iris drafted a response (for review)
- Cancel-window for auto-execute (per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC`)

---

## Part 13 — Iris-Driven AI Features (the 11x list)

Each is a discrete capability with measurable acceptance.

### 13.1 — Voice → RFI in 12 seconds

- Whisper API or equivalent (multi-model fallback per `IRIS_COST_BUDGET_SPEC`)
- Real-time transcription (streaming)
- Iris structures to: subject (≤80 chars), question (verbatim cleanup), suggested spec, suggested drawing, suggested trade
- Confidence threshold: 0.7 minimum to auto-fill; below = leave blank for user
- **Acceptance:** 95% of voice memos < 30s produce a usable draft on first try

### 13.2 — Drawing-Pin Precision

- User drops pin OR provides a photo
- Iris vision identifies sheet ref + revision + grid coordinates
- Pin precision target: ±1% of sheet dimensions
- **Acceptance:** 90% of pin drops on first try are within 1% of intended location

### 13.3 — Predicted Answer Draft

- When ball-in-court > 5 days, Iris drafts the architect's expected response
- Based on: similar past RFIs at this project + project specs + drawing context
- Confidence score per draft (≥ 0.7 = surface in inbox; < 0.7 = silent)
- **Workflow:** Iris drafts → manager reviews → if good, "Send to assignee for review" turns it into a draft response (auto-attribution to Iris-with-manager-approved)
- **Acceptance:** Predicted drafts achieve ≥ 60% acceptance rate from managers (per `LAP_2_ACCEPTANCE_GATE_SPEC` Gate 2 calibration)

### 13.4 — Auto-Classified Cost + Schedule Impact

- At RFI filing, Iris reads question + attachments + project context
- Suggests: schedule impact (yes/no/tbd, days range), cost impact (yes/no/tbd, $ range)
- Confidence per suggestion
- User accepts or overrides; their override trains the model
- **Acceptance:** 70% of Iris-suggested impacts accepted without modification at calibration

### 13.5 — Similar-Past-RFI Surfacing

- Semantic search across all prior RFIs at this project (and similar past projects, with consent)
- Surfaces top 3 with similarity score + answer summary
- "Different in what way" explanation when similar RFIs differ
- **Acceptance:** 50% of new RFIs have a "similar" with ≥ 70% similarity surfaced; 30% of those are confirmed duplicates by user

### 13.6 — Hash-Chain Audit Per Action

- Every state change writes a chain row (per `CHAIN_AUDIT_PREP_2026-05-04.md` Check 5)
- Trail of Bits attests Q4 2026
- **Acceptance:** 100% of RFI state changes captured; verifier returns 0 broken rows on staging snapshot

### 13.7 — Scope-Aware Sub Auto-Notification

- When RFI tagged with trade (MEP, Structural, etc.), Iris auto-adds relevant subs to distribution
- Based on subcontract scope mapping (per project)
- User can dismiss any auto-add before sending
- **Acceptance:** 80% of MEP RFIs get all 4 MEP subs auto-distributed correctly

### 13.8 — Multi-RFI Consolidation

- When same question filed 3+ times (semantic match), Iris suggests consolidation
- Marks all as "duplicate-of" with master RFI
- Single response cascades to all
- **Acceptance:** Reduces duplicate-RFI rate by 40% in pilot

### 13.9 — Pre-emptive Follow-up Drafting

- Cron monitors ball-in-court duration
- After 5 days idle: Iris drafts follow-up email (per `SCHEDULED_INSIGHTS_SPEC`)
- Manager approves → auto-sends
- **Acceptance:** 90% of overdue RFIs get a follow-up drafted within 1 hour of crossing the threshold

### 13.10 — Risk Scoring

- Per RFI: Schedule risk + Cost risk + Quality risk + Overall (low/medium/high)
- Computed from: subject text + question + cost impact + schedule impact + ball-in-court + trade + similar past
- Visible as colored dots in list view
- Drives smart-view sorting
- **Acceptance:** Operator subjective rating ≥ 8/10 on risk-flag accuracy after 30 days

### 13.11 — Auto-Create Change Event When Cost Impact = Yes

- Workflow rule (per Workflow Builder)
- Triggers when Closed AND Cost Impact = Yes AND amount ≥ threshold
- Creates Change Event linked to RFI
- Pre-populates with RFI summary + amount + line items
- **Acceptance:** 100% of qualifying closed RFIs trigger Change Event creation; 0 false positives

---

## Part 14 — Activity Feed (Change History) — The "Code in Activity" Fix

The audit found the activity feed was either empty or showed code. **This part is the definitive fix.**

### Schema

Every state change writes a row to `audit_log` (existing hash-chain table). The Activity tab renders these rows **with full resolution** of every UUID:

```
[2026-05-06 12:44 PM CST]   Walker Benner    Created RFI       —
[2026-05-06 12:46 PM CST]   Walker Benner    Sent for review   —
[2026-05-06 1:15 PM CST]    System (Iris)    Drafted predicted answer   confidence: 0.84
[2026-05-07 9:02 AM CST]    Sarah Chen       Added response    "AT-2 textured plaster controls per spec 09 30 13 §3.4"
[2026-05-07 9:05 AM CST]    Walker Benner    Marked official   —
[2026-05-07 9:05 AM CST]    Walker Benner    Closed RFI        —
```

### Display rules

- **Every UUID resolves** via `<UserName user_id={...} />` component
- System actions tagged "System (Iris)" with the model fingerprint visible on hover
- Field-level diffs: "Changed Due Date from 5/13/2026 to 5/20/2026"
- Timestamps in user's local timezone with explicit TZ
- Reactions/comments inline with the action they reference
- Filterable by actor, action type, date range
- Exportable as CSV or PDF
- **Hash-chain row IDs** linkable for forensics (admin-only)

### Walker's "code in activity" complaint — verified fix

The audit found `Ball in court: 05f9aaf1-918f-4ca7-b41a-15fd1bb14eb5` rendering as raw UUID. The fix:

1. Build `<UserName user_id={id} fallback="—" />` component (~30 LOC)
2. Use everywhere a user_id appears in UI (search-replace across components)
3. CI lint: any `${user_id}` template literal in JSX requires the component
4. Tests: snapshot tests verify no UUID-pattern strings in rendered output

---

## Part 15 — Email-In / Email-Out

### Per-project unique reply-to address

- `rfi-{projectId}-{rfiId}@inbound.sitesync.com`
- Architect replies to that address from their email client
- Inbound webhook (Postmark / SendGrid) parses email
- Body becomes new response on the RFI
- Attachments uploaded
- Threading preserved (multi-reply emails handled)

### Outbound emails

When RFI sent: architect receives full HTML email with:
- RFI metadata header
- Question
- Attachments (links, not inline — too heavy)
- "Reply to this email to respond, or click here to view in SiteSync: [link]"
- Tracking pixel for opens (with consent)

### Email-thread merging

If multiple emails on same thread come in, all merge into single Email tab thread.

---

## Part 16 — Two-Way Sync (Year 2)

Per integration framework (per `PROCORE_IMPORTER_SPEC` ADR-016):

- **Procore → SiteSync** (at customer onboarding; per the importer spec)
- **Autodesk Build → SiteSync** (via API; year 2)
- **Bluebeam → SiteSync** (drawing markup sync; year 2)
- **Newforma → SiteSync** (email-driven A/E sync; year 2)

These extend the integration framework. Don't re-invent.

---

## Part 17 — Implementation Phases

### P0 — Demo Blocker Fix (Week 1; ~16 hours)

The 11 Tier-1 items from `RFI_DEEP_DIVE_2026-05-04.md`:

1. UUID-as-name fix everywhere (`<UserName />` component)
2. Author "Unknown" → skeleton
3. History feed actually logs all state changes
4. Status badge updates after action
5. Status pill consistency (Pending vs Open)
6. Lowercase "rfi" / "Rfis" → "RFI" / "RFIs"
7. Merge or rename "Assign for Review" + "Start Approval"
8. Inline-edit affordance for: subject, ball-in-court, due date, priority, drawing ref, spec section, description
9. Forward / Distribute button (basic)
10. PermissionGate wrap on Close, Void, Assign for Review (Sev-1 from Lap 1 PermissionGate audit)
11. Activity tab on Detail page (resolves UUIDs; logs every state change)

**Acceptance:** Brad Cameron's pilot demo runs flawlessly through the RFI flow. No code in UI. No empty History after action.

### P1 — Procore Parity Core (Weeks 2-3; ~30 hours)

12. Cost + schedule impact entry on Detail (with quantification)
13. Drawing-pin drop UI (uses existing IssueOverlay)
14. Single-RFI PDF export
15. Internal note (private vs response) toggle
16. Distribution list management (predefined groups)
17. RFI type field + dropdown
18. Discipline / trade field + filter
19. Save as draft + draft list view
20. Spec library lookup (vs freeform)
21. Drawing library lookup (vs freeform)
22. Reopen + Duplicate + Subscribe + Reaction
23. Reports & Dashboards canned reports

**Acceptance:** Side-by-side feature comparison vs Procore — match on every checkbox in Walker's Part A inventory (sections A2-A5).

### P2 — Iris Differentiators (Weeks 4-6; ~40 hours)

24. Voice → RFI capture (mobile-first)
25. Pre-emptive follow-up drafting (cron-driven)
26. Similar-past-RFI surfacing
27. Auto-classify cost + schedule impact at filing
28. Hash-chain audit row per RFI action (visible in Activity)
29. Scope-aware sub auto-notification
30. Predicted answer drafts (with manager approval)
31. Risk scoring + smart views

**Acceptance:** Demo Gate 3 — 4 consecutive flawless external runs (per `LAP_3_ACCEPTANCE_GATE_SPEC`).

### P3 — Public Guest Portal + Email-in/out (Weeks 7-8; ~30 hours)

32. Public Guest Portal (sub-side, no account, magic-link)
33. Email-in / Email-out (Postmark inbound parsing)
34. Threaded discussion + @mentions + reactions
35. e-Signature on official response
36. Bilingual EN/ES toggle

**Acceptance:** First sub uses guest portal end-to-end. Architect responds via email; auto-imports to thread. Spanish UI verified.

### P4 — Workflow Builder + Custom Fields (Weeks 9-10; ~25 hours)

37. Workflow Builder (visual editor for status transitions)
38. Up to 20 custom fields (vs Procore's 2)
39. SLA + Escalation engine
40. Auto-Create Change Event (Cost Impact = Yes workflow)
41. Real-time collaboration (Liveblocks)

**Acceptance:** Top-100 GC pilot can configure their unique workflow without code changes.

### P5 — Two-Way Sync + Advanced (Weeks 11-12; ~20 hours)

42. Bulk operations on list page
43. Saved views (My / Project / Company)
44. Map view + Timeline view
45. Recycle Bin + version chain UI
46. Two-way sync stub (Procore → SiteSync writeback for demo)

**Acceptance:** Full Procore parity + 11 differentiators measurably scored.

---

## Part 18 — Acceptance Gates (per phase)

Each phase has a specific gate to pass before moving on:

| Phase | Gate | Measure |
|---|---|---|
| P0 | Demo blocker fix | Walker runs full demo on RFI without code in UI; History logs visible; Brad's pilot can't break it |
| P1 | Procore parity | Side-by-side comparison (this doc Part A vs SiteSync); 100% checkbox match |
| P2 | Iris differentiation | Demo runs flawlessly 4× external; 60%+ Iris-draft acceptance rate; voice-to-RFI median 14s on iPhone |
| P3 | Sub portal | First non-licensed sub onboards in <2 min and submits a response |
| P4 | Workflow builder | Brad's actual workflow configures end-to-end without engineering work |
| P5 | Full Bugatti | Score: 94/100 on the rubric; ready for Series-A demo |

---

## Part 19 — What This Kills Procore On (the demo cheat sheet)

When Brad asks "why not Procore?" — point at these:

1. **Free public guest portal** — Procore charges subs $30K/yr for sub-portal access
2. **Voice → RFI in 12s** — Procore requires desktop / web form
3. **Drawing-pin precision via Iris vision** — Procore has freeform "drawing reference" text
4. **Predicted answer drafts** — Procore has zero AI on RFIs as of FY2026
5. **Hash-chain court-defensible audit** — Procore's audit log is policy-enforced; ours is mathematically tamper-evident
6. **Spanish UI** — Procore is English-only
7. **Workflow Builder** — Procore has fixed states; we let you configure
8. **Bilingual + multi-modal capture** (voice/photo/pin) — Procore is forms-only
9. **Real-time collaboration** — Procore is not collaborative
10. **Auto-create Change Event** — Procore requires manual handoff
11. **Up to 20 custom fields** — Procore has 2 (web-only)

---

## Part 20 — File-by-File Changelog

| Path | Change |
|---|---|
| `supabase/migrations/<date>_rfis_bugatti_expansion.sql` | NEW — schema expansion (Part 3) |
| `src/types/rfi.ts` | NEW — canonical TypeScript types |
| `src/services/rfi/state-machine.ts` | NEW — transitions + guards (Part 4) |
| `src/services/rfi/permissions.ts` | NEW — matrix (Part 5) |
| `src/components/UserName.tsx` | NEW — UUID-resolution component (Part 14 fix) |
| `src/pages/rfis/RfiList.tsx` | REWRITE — Part 6 |
| `src/pages/rfis/RfiDetail.tsx` | REWRITE — Part 8 |
| `src/pages/rfis/RfiCreate.tsx` | REWRITE — Part 7, 3 modes |
| `src/pages/rfis/RfiSettings.tsx` | NEW — Part 9 |
| `src/pages/rfis/RfiReports.tsx` | NEW — Part 10 |
| `src/pages/rfis/RfiActivityTab.tsx` | NEW — Part 14 |
| `src/pages/rfis/RfiEmailsTab.tsx` | NEW — Part 15 |
| `src/pages/rfis/RfiRelatedItemsTab.tsx` | NEW |
| `src/pages/rfis/RfiVersionsTab.tsx` | NEW |
| `src/pages/rfis/views/RfiKanbanView.tsx` | NEW |
| `src/pages/rfis/views/RfiTimelineView.tsx` | NEW |
| `src/pages/rfis/views/RfiMapView.tsx` | NEW |
| `src/pages/rfis/views/RfiDrawingPinsView.tsx` | NEW (the differentiator view) |
| `src/components/rfi/IrisAssistantPanel.tsx` | NEW — Part 13 |
| `src/components/rfi/PredictedAnswerCard.tsx` | NEW — Part 13.3 |
| `src/components/rfi/SimilarRfisPanel.tsx` | NEW — Part 13.5 |
| `src/components/rfi/RiskScoreBadges.tsx` | NEW — Part 13.10 |
| `src/components/rfi/InlineEditField.tsx` | NEW — universal inline-edit for sidebar |
| `mobile/src/screens/RfiVoiceCapture.tsx` | NEW — voice → RFI |
| `supabase/functions/rfi-email-inbound/index.ts` | NEW — Part 15 |
| `supabase/functions/rfi-followup-drafter/index.ts` | NEW — Part 13.9 (extends scheduled-insights) |
| `supabase/functions/rfi-similar-search/index.ts` | NEW — Part 13.5 |
| `supabase/functions/rfi-vision-pin-detect/index.ts` | NEW — Part 13.2 |
| `e2e/rfi/full-workflow.spec.ts` | NEW — full E2E |
| `docs/audits/INDEX.md` | EDIT — add this spec |

---

## Final Bugatti Verdict

**Today's RFI module:** 32/100 (per audit)

**This spec at P5:** 94/100 (Bugatti target)

**Procore at FY2026:** ~80/100

**Ship plan:** 12 weeks of focused build = enterprise-grade RFI module that out-competes Procore on every dimension that matters for mid-market commercial GCs.

**This entire doc, plus:**
- `RFI_INDUSTRY_RESEARCH_2026-05-04.md`
- `RFI_DEEP_DIVE_2026-05-04.md`
- Walker's Procore parity inventory
- The 36 prior specs in `docs/audits/`

**= the complete brief Claude Code needs to ship the Procore-killer RFI module.**

The plumbing is there. The data model is right. The bugatti standard is achievable. **Hand this entire doc to Claude Code; ship P0 in 16 hours; ship P5 in 12 weeks; demo Brad an RFI flow no incumbent can match.**
