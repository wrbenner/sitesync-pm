# PRODUCTION ROADMAP — Ship to GCs Managing $50M+ Projects

> **PURPOSE**: This file tells the engine what to BUILD, not just what to polish.
> It is organized by priority. P0 items are dealbreakers — a GC will not sign without them.
> P1 items win deals. P2 items differentiate.
>
> **ENGINE RULES**:
> - In SURGEON mode (cycles 1–3): Fix bugs and polish only. Skip this file.
> - In ARCHITECT mode (cycles 4–10): Build P0 items. Each cycle, pick the highest-priority unfinished item and implement it end-to-end (frontend + edge function + migration if needed).
> - In VISIONARY mode (cycles 11+): Build P1 and P2 items. Invent features no competitor has.
> - Every item below includes the files to create/modify, the acceptance test, and the definition of done.
> - If an item requires a new npm package, INSTALL IT. If it requires a new edge function, CREATE IT. If it requires a new migration, WRITE IT.

---

## P0: DEALBREAKERS (No GC signs without these)

### P0-1: Sage Intacct Accounting Integration

**Why**: 70%+ of mid-market GCs ($20M–$200M revenue) use Sage. If cost data doesn't flow to their accounting system automatically, they won't switch from Procore. QuickBooks is for small contractors. Sage is for real GCs.

**Technical Spec**:

#### Authentication
- OAuth 2.0 via Sage App Registry
- Base URL: `https://api.intacct.com/ia/xml/xmlgw.phtml` (XML API) or REST endpoints
- Node.js SDK available: `@anthropic-ai/sage-intacct-sdk` or use `intacct-sdk` npm package
- Store tokens in `sage_intacct_oauth` table (similar pattern to existing `quickbooks_oauth`)

#### Database Schema
```sql
create table sage_intacct_oauth (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  company_id text not null,
  location_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sage_cost_code_mapping (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sitesync_cost_code text not null,
  sage_account_id text not null,
  sage_account_name text,
  sync_direction text default 'bidirectional' check (sync_direction in ('to_sage', 'from_sage', 'bidirectional')),
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

create table sage_sync_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  entity_type text not null,
  entity_id uuid not null,
  direction text not null check (direction in ('push', 'pull')),
  status text not null check (status in ('pending', 'success', 'failed', 'conflict')),
  sage_doc_id text,
  error_message text,
  payload jsonb,
  created_at timestamptz default now()
);
```

#### Edge Functions to Create
1. `sage-oauth` — OAuth flow (connect/disconnect/refresh)
2. `sage-sync-costs` — Push change orders and pay app line items to Sage as AP invoices
3. `sage-pull-job-costs` — Pull committed costs, actual costs, job-to-date from Sage
4. `sage-sync-vendors` — Bidirectional vendor/subcontractor sync
5. `sage-webhook` — Receive Smart Events from Sage for real-time cost updates

#### Frontend
- File: `src/pages/Integrations.tsx` — Add Sage Intacct card with Connect/Disconnect OAuth flow
- File: `src/services/integrations/sage-intacct.ts` — API client (mirror pattern from `procore.ts`)
- Settings page: cost code mapping UI (drag-drop SiteSync codes to Sage accounts)
- Budget page: "Last synced with Sage: 2 min ago" indicator + manual sync button

#### Rate Limits
- 100 requests/minute, 2 concurrent connections per tenant
- Implement request queue with exponential backoff

#### Acceptance Test
- [ ] User can OAuth connect to Sage Intacct from Integrations page
- [ ] Cost codes from Sage appear in mapping UI
- [ ] Creating a change order in SiteSync pushes an AP invoice to Sage within 60 seconds
- [ ] Pulling job costs from Sage updates Budget page committed cost column
- [ ] Disconnecting removes tokens and stops sync
- [ ] Sync log shows history with success/failure status

---

### P0-2: Schedule Import (Primavera P6 + MS Project)

**Why**: The schedule is the heartbeat of every project. Superintendents check it daily. If they can't see their P6 schedule in SiteSync, they keep P6 open in a separate tab and never adopt SiteSync.

**Technical Spec**:

#### Option A: File Upload (MVP — implement this first)
- Accept .xer (P6), .xml (P6 XML), and .mpp (MS Project) uploads
- Parse server-side using Python edge function with `xerparser` library for XER
- For .mpp: Use `mpxj` (Java library with Node.js bindings via `mpxj-npm`) or convert via edge function
- Map parsed data to existing `schedule_phases` and `schedule_activities` tables

#### Option B: P6 REST API (Phase 2)
- Base URL: `https://<server>/p6ws/restapi/v2/`
- OAuth 2.0 authentication
- Endpoints: `/activities`, `/wbs`, `/activityrelationships`, `/resources`, `/calendars`
- Requires P6 EPPM Cloud license for API access

#### Data Model Mapping
```
P6 Activity → schedule_activities
  - activity_id → external_id
  - activity_name → name
  - start_date → planned_start
  - finish_date → planned_finish
  - actual_start → actual_start
  - actual_finish → actual_finish
  - total_float → float_days
  - percent_complete → progress_pct
  - status → status (map: TK_NotStarted→not_started, TK_Active→in_progress, TK_Complete→complete)

P6 WBS → schedule_phases
  - wbs_id → external_id
  - wbs_name → name
  - parent_wbs_id → parent_id (recursive)

P6 Relationship → schedule_dependencies
  - predecessor_id → predecessor_activity_id
  - successor_id → successor_activity_id
  - relationship_type → type (FS, FF, SS, SF)
  - lag → lag_days
```

#### Critical Path Calculation
- After import, calculate critical path using forward/backward pass algorithm
- Store `is_critical` boolean on each activity
- Highlight critical path in red on Gantt chart
- Recalculate when any activity date changes

#### Edge Functions to Create
1. `schedule-import` — Accepts file upload, detects format, parses, returns normalized JSON
2. `schedule-sync-p6` — OAuth + REST API sync for P6 Cloud (Phase 2)

#### Frontend Changes
- File: `src/pages/Schedule.tsx` — Add "Import Schedule" button (accepts .xer, .xml, .mpp)
- File: `src/components/schedule/GanttChart.tsx` — Render critical path, float, dependencies
- Upload flow: drag-drop or file picker → progress bar → preview mapping → confirm import
- After import: show diff if re-importing (what changed since last import)

#### Acceptance Test
- [ ] User can upload a .xer file and see activities appear on Gantt chart within 10 seconds
- [ ] WBS hierarchy renders as collapsible tree in schedule view
- [ ] Critical path activities are highlighted
- [ ] Dependencies show as arrows between bars
- [ ] Re-importing same file shows "no changes" / importing updated file shows diff
- [ ] Float values display on hover

---

### P0-3: Drawing Viewer with Markup

**Why**: "Can I mark up drawings on my iPad?" is the first question every superintendent asks in a demo. If the answer is no, the demo is over.

**Technical Spec**:

#### Rendering Engine
- Use `react-pdf` (already in package.json as `@react-pdf-viewer/core`) for PDF rendering
- Add `fabric.js` (npm: `fabric`) for annotation layer on top of PDF
- Alternative: `pdfjs-dist` + custom canvas overlay

#### Markup Tools (implement all)
1. Pen (freehand draw) — adjustable color and width
2. Highlighter (semi-transparent stroke)
3. Text annotation — click to place, type to add
4. Rectangle, circle, arrow, cloud shapes
5. Dimension tool (two-point measurement with scale calibration)
6. Color picker (8 preset colors + custom)
7. Undo/redo stack (min 20 levels)

#### Annotation Storage
```sql
create table drawing_annotations (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references drawings(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  page_number integer not null default 1,
  annotation_data jsonb not null, -- fabric.js serialized objects
  is_shared boolean default false, -- personal vs shared markup
  linked_entity_type text, -- 'rfi', 'punch_item', 'submittal'
  linked_entity_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: users see own annotations + shared annotations for their project
```

#### Mobile Behavior
- Pinch-to-zoom on drawing (standard gesture, do not intercept)
- Markup toolbar: collapsible bottom bar (like iOS markup)
- Touch = draw when tool selected, pan when no tool
- Double-tap to zoom to fit
- Quick action: "Create RFI from markup" — captures screenshot of marked area + opens RFI create modal with drawing reference pre-filled

#### Offline
- Cache last 5 viewed drawings in IndexedDB (PDF blob + annotations JSON)
- Queue annotation saves for background sync
- Show "Offline — markups will sync when connected" indicator

#### Frontend Changes
- File: `src/pages/Drawings.tsx` — Replace current view with full drawing viewer
- File: `src/components/drawings/DrawingViewer.tsx` — New component: PDF render + fabric.js overlay
- File: `src/components/drawings/MarkupToolbar.tsx` — Tool selection bar
- File: `src/components/drawings/AnnotationLayer.tsx` — Manages annotation CRUD

#### Acceptance Test
- [ ] User can open any uploaded PDF drawing at full resolution
- [ ] All 7 markup tools work (pen, highlighter, text, rect, circle, arrow, cloud)
- [ ] Annotations save and persist on page reload
- [ ] Shared annotations visible to all project members
- [ ] Personal annotations visible only to creator
- [ ] "Create RFI from markup" pre-fills RFI with drawing reference and cropped image
- [ ] Mobile: pinch-to-zoom works, markup toolbar collapses
- [ ] Offline: cached drawings load without network, annotations queue for sync

---

### P0-4: Daily Log Speed Optimization

**Why**: If a superintendent can't submit a daily log in under 90 seconds from the field, they'll use paper and hand it to the project admin. The log must be faster than paper.

**Technical Spec**:

#### Auto-Population
- Weather: already have weather API — auto-populate temperature, conditions, wind from project location on page load
- Crew: pre-fill from yesterday's log (same crew unless changed). One-tap "Same as yesterday" button.
- Date: auto-set to today
- Project: auto-set from current project context

#### One-Tap Sections
- Safety incidents: toggle "No incidents today" (default ON) — expands form only if toggled OFF
- Visitors: toggle "No visitors today" — expands only if needed
- Equipment: show yesterday's equipment list, tap to confirm or modify
- Work completed: voice-to-text input (tap microphone, speak, auto-transcribe)

#### Photo Batch Upload
- "Add Photos" button opens camera or gallery with MULTI-SELECT
- Upload all photos in parallel with progress indicator
- Auto-tag photos with timestamp and GPS coordinates
- Thumbnail grid shows all attached photos

#### Submission Flow
- Single "Submit Log" button at bottom (sticky, always visible)
- Validation: must have weather + at least one work activity entry
- After submit: confetti animation (small, tasteful) + "Log submitted for [date]" toast
- Navigate to next day or back to dashboard

#### Speed Target
- Measure time from page load to submit tap
- Target: < 90 seconds for a typical day (weather + 3 crew + 2 work items + 2 photos)
- Log the actual submission time in analytics for tracking

#### Frontend Changes
- File: `src/pages/DailyLog.tsx` — Restructure form for speed
- Add `src/components/dailylog/QuickLog.tsx` — Streamlined mobile-first log entry
- Add "Same as yesterday" clone functionality
- Add voice-to-text for work description fields

#### Acceptance Test
- [ ] Weather auto-populates on page load (no manual entry needed)
- [ ] "Same as yesterday" pre-fills crew, equipment from prior log
- [ ] Voice-to-text captures work description hands-free
- [ ] Photo multi-select uploads in parallel
- [ ] Full daily log submittable in < 90 seconds (measured)
- [ ] "No incidents" and "No visitors" are one-tap defaults

---

### P0-5: Email Notifications

**Why**: If nobody gets notified when an RFI is assigned to them, it sits there for 3 weeks. Email is how construction teams communicate. Period.

**Technical Spec**:

#### Email Provider
- Use Resend (https://resend.com) — simpler API than SendGrid, generous free tier (100 emails/day free, 3000/month)
- npm: `resend`
- Alternative: stick with SendGrid if already configured (check INTEGRATIONS.md)

#### Notification Triggers
| Event | Recipient | Template |
|-------|-----------|----------|
| RFI assigned | Ball-in-court party | "You have a new RFI to review" |
| RFI response received | RFI creator | "Your RFI received a response" |
| RFI overdue (3 days past due) | BIC + PM | "RFI #X is overdue" |
| Submittal returned for revision | Submitter | "Submittal needs revision" |
| Submittal approved | Submitter + PM | "Submittal approved" |
| Change order pending approval | Approver | "Change order awaiting your approval" |
| Daily log not submitted by 6 PM | Superintendent | "Daily log reminder" |
| Payment app ready for review | GC PM / Owner | "Pay app ready for signature" |
| Punch item assigned | Subcontractor | "New punch item assigned" |
| Meeting scheduled | All invitees | "Meeting: [title] on [date]" |

#### Database
- Reuse existing `email_notifications` and `notification_preferences` tables from INTEGRATIONS.md
- Add `notification_queue` table for async processing:
```sql
create table notification_queue (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  recipient_user_id uuid not null references auth.users(id),
  recipient_email text not null,
  template_name text not null,
  template_data jsonb not null,
  status text default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);
```

#### Edge Functions
1. `notification-dispatch` — Processes queue, renders templates, sends via Resend API
2. `notification-preferences` — User can mute specific notification types or set digest mode
3. `daily-digest` — 7 PM daily email: summary of all activity on user's projects

#### Frontend
- Settings page: notification preferences (per-event toggle: instant/digest/off)
- Bell icon in TopBar: show in-app notifications (already exists) — email is the external channel

#### Acceptance Test
- [ ] Assigning an RFI sends email to assignee within 60 seconds
- [ ] Overdue RFI triggers reminder email at configured time
- [ ] User can mute specific notification types in settings
- [ ] Daily digest email contains all project activity from the day
- [ ] Unsubscribe link in every email works
- [ ] Email renders correctly on mobile (responsive HTML template)

---

## P1: DEAL WINNERS (Differentiators that close deals)

### P1-1: AIA G702/G703 Payment Application PDF Generation

**Why**: Every GC in America submits payment applications on AIA G702/G703 forms. If SiteSync generates these automatically from the schedule of values, it saves the PM 4+ hours per billing cycle.

**Technical Spec**:
- Use `pdf-lib` (npm) to generate pixel-perfect AIA G702 and G703 PDFs
- G702: one-page summary (contract sum, net change by COs, total completed, retainage, current payment due)
- G703: multi-page continuation sheet (SOV line items with work completed by period)
- All calculations must be correct to the penny (use integer cents internally, never floating point for money)
- Signature blocks: digital signature capture or "Pending signature" placeholder
- Export: separate G702 PDF, separate G703 PDF, combined PDF option
- File: `src/services/pdf/paymentAppPdf.ts`
- Edge function: `generate-pay-app-pdf`

### P1-2: Sub-Company Scoping Within Projects

**Why**: On a $50M job, 30+ subcontractors each need access but should only see their own scope.

**Technical Spec**:
- Add `company_id` column to relevant tables (rfis, submittals, daily_logs, punch_items)
- RLS policies: subcontractor role users can only see records where `company_id` matches their `project_members.company_id`
- PM and superintendent see everything
- Directory page: show company-grouped view with member counts and access levels

### P1-3: Reports / One-Click Owner Report

**Why**: PMs spend hours building PowerPoint updates for owners. A one-click PDF report wins deals.

**Technical Spec**:
- Template: Executive summary PDF with project photo, budget summary (% complete, variance), schedule summary (days ahead/behind, critical path status), open RFIs count and aging, safety record, weather delays
- File: `src/services/pdf/ownerReport.ts`
- Edge function: `generate-owner-report`
- Trigger: "Generate Owner Report" button on Dashboard

---

## P2: DIFFERENTIATION (What Procore can't do)

### P2-1: AI Conflict Detection on Drawings
- When new drawings uploaded, AI scans for conflicts with existing markups, RFIs, and change orders
- "This new structural revision may affect 3 open RFIs in this area"

### P2-2: Predictive Schedule Delay Alerts
- ML model trained on historical daily logs, weather, and crew data
- "Based on current pace and weather forecast, Phase 3 concrete is likely to slip 4 days"

### P2-3: Voice-First Field Interface
- "Hey SiteSync, log that we poured 200 yards of concrete on grid lines A through F today"
- Voice command → parsed → daily log entry created

### P2-4: Cash Flow Forecasting
- Forward-looking cash flow chart based on schedule, pay app history, and committed costs
- "At current billing pace, you'll have a $340K cash gap in month 8"

---

## TECHNICAL CONTROLS FOR SOC 2 (Engine can implement these)

The SOC 2 audit itself is a business process (hire Vanta/Drata, takes 3–6 months). But the engine CAN implement the technical controls the auditor will check:

1. **MFA enforcement** — Add TOTP/SMS MFA option to auth flow (Supabase supports this)
2. **Session timeout** — Auto-logout after 30 minutes of inactivity
3. **Audit trail completeness** — Every create/update/delete writes to `audit_log` table with user_id, timestamp, old_value, new_value
4. **Data encryption at rest** — Supabase handles this, but verify and document
5. **API rate limiting** — Enforce per-user rate limits on all edge functions
6. **Input sanitization** — XSS and SQL injection prevention on all user inputs
7. **Password policy** — Minimum 12 characters, complexity requirements
8. **Failed login lockout** — Lock account after 5 failed attempts for 15 minutes
9. **Data export** — User can export all their data (GDPR/CCPA compliance)
10. **Vulnerability scanning** — Add `npm audit` to CI/CD pipeline (already present, ensure it blocks on critical)

### Engine Implementation
- For each control above, check if it exists. If not, implement it.
- File: `src/lib/security.ts` — centralized security utilities
- File: `supabase/migrations/XXXXX_soc2_controls.sql` — audit trail triggers, lockout policies
- Edge function: `security-audit` — endpoint that returns current security posture

---

## WHAT THE ENGINE SHOULD NOT BUILD

- Native iOS/Android apps (not possible from this codebase)
- BIM/3D model viewer (too complex for single-prompt fixes)
- Video conferencing (use Zoom/Teams integration instead)
- Full ERP system (SiteSync is PM, not accounting)
- Custom email server (use Resend/SendGrid SaaS)
