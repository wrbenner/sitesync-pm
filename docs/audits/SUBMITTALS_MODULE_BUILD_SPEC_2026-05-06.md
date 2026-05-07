# SiteSync Submittals Module — Bugatti-Grade Build Spec

**Date:** 2026-05-06
**Author:** Walker (driven), Claude (drafted)
**Status:** Spec ready. Hand entire doc to Claude Code as the definitive build target. Phased delivery: P0 → P5 over ~10 weeks (Lap 2 day 35 → Lap 3 day 30).
**Replaces:** the legacy `src/pages/submittals/` surface (3 routes; ~3,400 LOC across page-level files; one half-broken state machine).
**Drives:** the build that beats Procore, Autodesk Build (with AutoSpecs), Newforma, e-Builder, and Aconex on submittals specifically — the highest-revenue-impact workflow in commercial construction PM.
**Companion docs:**
- `RFI_MODULE_BUILD_SPEC_2026-05-04.md` — sister module; reuse 80% of the surfaces, IA, and primitives
- `IRIS_CITATIONS_SPEC_2026-05-04.md` — citation kinds 5 (spec section) and 8 (submittal package) live here
- `IRIS_VOICE_GUIDE_SPEC_2026-05-04.md` — voice rules apply to every Iris-generated transmittal, reject reason, and review summary
- `IRIS_TELEMETRY_SPEC_2026-05-04.md` — every action emits an event for the Day-60 acceptance gate
- `SUB_PORTAL_V0_SPEC_2026-05-04.md` — submittal upload flows through the same magic-link portal
- `COI_INGESTION_SPEC_2026-05-04.md` — pattern reused for product-data OCR
- `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` — overdue, predictive-bottleneck, and lead-time alerts plug in here
- `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md` — submittals is one of the modules that must pass the gate

---

## TL;DR — The Bet

**Submittals is a $483K-per-job problem hiding in plain sight.** A typical $50M commercial job has 1,000–2,000 submittals, ~30–40% reject on first review, each rejection costs ~$805 and adds 2–4 weeks of float burn. PEs lose 20+ hours a week to it. Procore tolerates the workflow; nobody owns the outcome. We're going to.

**SiteSync Submittals will beat Procore on these 14 dimensions, with Procore's 2003 architecture unable to reach any of them:**

1. **Spec-to-log auto-extraction in <10 min.** Drop the 3,000-page spec book → CSI-mapped log with required-on-site dates, sub auto-assigned, review chain pre-populated. (AutoSpecs is the only credible incumbent; lives behind Autodesk's bundle.)
2. **Required-on-site dates auto-walked back from the schedule.** Lead time + review duration + buffer + slack — never typed by hand. (Nobody ships this.)
3. **AI pre-flight rejects bad submittals before the architect sees them.** Iris reads the spec section, reads the package, surfaces "you forgot the AAMA test certificate" before submit. Target: 95% first-time approval rate vs. industry 60–70%. (BuildSync claims this; we'll prove it with our 8th citation kind.)
4. **Magic-link sub upload with zero seat cost forever.** Sub gets a text/email link, uploads in 60 seconds, doesn't need an account. (Procore needs a directory entry; Newforma Submittal Exchange charges the recipient.)
5. **Inline rev-diff for Rev 0 → Rev N.** Side-by-side highlighted diff so the architect re-reviews changes only, not the entire 80-page package. (No incumbent ships this. The "I don't want to go back" moment from Lap 2.)
6. **Native real-time PDF markup with persistent rev history.** Bluebeam-grade markup in-product, comments persist across revisions. (Procore loses Bluebeam if they try; Bluebeam isn't a submittal management system.)
7. **Voice-driven review codes in the field.** Super walks the mockup, says "approved as noted, see markup" → submittal advances. (Nobody.)
8. **Field push-on-approval to QR-pinned plans.** Approved revs land on the foreman's iPhone home screen, 2 taps from a QR scan. Offline cache. (Procore mobile fails 90% on cellular per their own help.)
9. **EJCDC 6-code disposition + AIA §4.2.7 disclaimer baked into every stamp.** Legally clean, design-intent-only language, license seal, reviewer/date — never ship a bare "Approved." (Most teams roll their own; we make it default.)
10. **Predictive ball-in-court bottleneck warning.** Iris flags "Architect X has 14 submittals in court; 3 already late on the schedule" before the slip happens. (Nobody.)
11. **Auto-route from spec language.** "Submit to structural engineer of record" → routes to the right reviewer. Iris reads spec section §1.04 and assigns. (Nobody.)
12. **One-click closeout binder generation, COBie-tagged.** Approved + stamped + indexed + hyperlinked at substantial completion. (Owners pay for this every time.)
13. **Federal/UFGS mode toggle.** USACE Approving Authority codeset, WH-347 weekly payroll integration, DBE/MBE recurring submittal templates. (Nobody serves federal mid-market.)
14. **Hash-chain audit trail per submittal action.** Court-defensible delay-claim evidence. (Hash-chain shipped Lap 1 for RFIs; reuse for submittals.)

**Net target score:** 95/100 vs. Procore's ~78. **Time to ship:** P0 (the demo blockers) in 3 weeks; P5 (the killer) in 10 weeks. Soft pilot at Nexus + Carleton uses this as the headline module.

---

## Part 0 — Where We Are (Audit, 2026-05-06)

| Area | What exists | Verdict |
|---|---|---|
| Routes | `/submittals`, `/submittals/:id`, `/submittals/spec-parser` (flagged off) | Keep paths; rebuild contents |
| Pages | `index.tsx` 675 LOC; `SubmittalDetailPage.tsx` 1,002 LOC; `SubmittalsTable.tsx` 540 LOC; `SubmittalsKanban.tsx` 158 LOC; `GroupedSubmittalsView.tsx` 685 LOC; `SubmittalKPIs.tsx` 294 LOC | Fragmented across `pages/submittals/` and `components/submittals/`, `components/forms/`, `components/panels/`. Consolidate to `components/submittals/` |
| State | `useEntityStore('submittals')` (correct per ADR-002); `submittalMachine.ts` with bug `// BUG #1 FIX` on `gc_review` transition | Fix the machine; do NOT revive `useSubmittalStore` |
| Types | `src/types/submittal.ts` 73 LOC. `Submittal`, `SubmittalApproval`, `SubmittalRevision` rows in generated `database.ts` | Expand: `SubmittalReviewCode`, `SubmittalKind`, `SubmittalDisposition`, `SubmittalPackage`, `SubmittalSpecMapping` |
| DB | 3 migrations: `00014_submittal_enhancements`, `00029_submittal_workflow`, `20260421000003_submittals_attachments` (the attachments column was missing for ~7 weeks — silent data loss before Apr 25) | Consolidate into one **canonical migration** for Lap 2; backfill telemetry columns; add MV |
| API | CRUD only via `src/api/endpoints/submittals.ts`. No bulk, no search, no export, no spec-import | Rebuild with bulk + filter + search + export + spec-import |
| Iris | `services/iris/executors/submittalTransmittal.ts` drafts transmittals; `citationVerify.ts` validates snippets | Add: spec-section extractor, review-code suggester, deviation-flag detector, rev-diff summarizer |
| Tests | Machine + service + API + smoke + e2e lifecycle | Rewrite e2e for new flows; keep machine + service tests as regression |
| Duplicates | `SubmittalDetail 2.tsx`, `SubmittalDetailPage 2.tsx`, `*.test 2.tsx`, `*.spec 2.ts`, `*.spec 3.ts` | Delete in P0 day-1 cleanup |

**No prior submittal-specific audit doc.** This is the first one.

---

## Part 1 — The Surfaces (10, not 3)

The minimum surface count is 10. Each is a separate URL + dedicated UX. None can be a tab inside another. Procore has 4. Autodesk Build has 5. We have 10.

| # | Surface | Path | Why separate |
|---|---|---|---|
| 1 | **Submittal Log** (List + Kanban + Timeline + Spec-Section + Schedule-Linked views) | `/submittals` | Primary entry; high-volume scan |
| 2 | **Submittal Detail** (drawer + full-page; live-collaborative; rev-diff side panel) | `/submittals/:id` | Per-record deep work |
| 3 | **Spec Importer** (drag spec book → AI-generated draft log → human review → commit) | `/submittals/import` | The killer feature; first thing a new project does |
| 4 | **Create / Quick-Capture** (web form + mobile + voice + spec-section deep-link) | `/submittals/new` (+ inline drawer + mobile + spec context) | Three entry modes; same data |
| 5 | **Settings & Workflow Builder** (review codes, ball-in-court rules, SLA, federal toggle) | `/submittals/settings` | Project-level config |
| 6 | **Reports & Dashboards** (overdue, predictive bottleneck, lead-time forecast, cycle time) | `/submittals/reports` | Analytics surface |
| 7 | **Sub Magic-Link Upload** (no SiteSync account needed) | `sub.sitesync.com/submittal/:token` | Network-effect wedge |
| 8 | **External Reviewer Portal** (architect/engineer; no Procore-style "create an account" wall) | `review.sitesync.com/submittal/:token` | Architect refusal kills deals; this is the answer |
| 9 | **Mobile / PWA** (offline; voice review; QR-pinned plan lookup) | iOS + Android (per ADR-010 + iOS/Android specs) | Field UX |
| 10 | **Closeout Binder** (one-click COBie-tagged owner deliverable) | `/submittals/closeout` | Owner moment of truth |

Procore's 4 (Log, Recycle Bin, Create, Detail) are a strict subset. Surfaces 3, 7, 8, 10 are net-new. Surface 9 is differentiated by the field push-on-approval flow.

---

## Part 2 — Information Architecture

### 2.1 Top-level navigation (the `/submittals` log)

```
SUBMITTALS                                 ⚙️    ↓Export    📊Reports    ✨Iris    📥Import Spec    + New Submittal
1,247 active · 23 overdue · 4 awaiting your response · 6 architect-late
                                                         ─────────────
                                                         [⚠ Iris: ETA risk on Div 08]

[ Items ] [ Spec Sections ] [ Recycle Bin ]                            [Iris suggests…]

┌─────────────────┐  ┌──────────────────────────────────────────────────────────┐
│  SAVED VIEWS    │  │ 🔍 Search by spec, sub, manufacturer, product…   ⛔ Filters  │
│  ▸ All Active   │  ├──────────────────────────────────────────────────────────┤
│  ▸ Mine         │  │ [List] [Kanban] [Timeline] [Spec-Section] [Schedule]      │
│  ▸ Overdue      │  ├──────────────────────────────────────────────────────────┤
│  ▸ Awaiting Me  │  │ ☐  #     Spec     Title           Status   BIC   Days   Rev │
│  ▸ Closeout     │  │ ☐ 0231-A 08 41 13 Storefront fra. Submit.. Arch  3 OT  R0  │
│  ▸ Federal      │  │ ☐ 0232-A 03 30 00 Concrete mix d. Approv.. —     —      R1  │
│  + Create View  │  │ …                                                          │
└─────────────────┘  └──────────────────────────────────────────────────────────┘
```

### 2.2 View types — match Procore, then exceed (7 total)

Procore ships 4 groupings (Items / Packages / Spec Sections / Ball In Court) — we match all 4 plus add 3 net-new. The view picker lives where the Procore one does, but our default is **List** (Items) and the data is the same across views; only grouping/render changes.

1. **Items (List)** — flat dense table; default for coordinators. Sticky header, server-side virtualization, 200ms p95 paint with 5,000 rows. **Procore parity: Items view.**
2. **Packages** — grouped under expandable package headers (`#1: Beacon Concrete` style). A Submittal Package is a first-class entity (see Part 3); created, edited, redistributed as a unit. **Procore parity: Packages view.**
3. **Spec Sections** — grouped by CSI MasterFormat division → section → submittal. The view that kills hand-built Excel logs. **Procore parity: Spec Sections view.**
4. **Ball In Court** — grouped by current responsible party. "What's on whose plate." **Procore parity: Ball In Court view.**
5. **Kanban** — by status (Draft / In Review / Approved / Resubmit / Rejected / Distribute / Closed). Drag to advance with PermissionGate. **Net new vs. Procore.**
6. **Timeline** — Gantt-style; required-on-site dates anchored against the master schedule. **Net new vs. Procore.**
7. **Schedule-Linked** — one row per schedule activity; submittals dock under the activity that needs them. Walk the schedule, see what's at risk. **Net new vs. Procore.**

Plus a separate sub-tab for the **Recycle Bin** (Procore parity) and a hash-chain-backed **Audit / Versioning** view (net new — already shipped Lap 1 for RFIs).

### 2.3 Saved views model

Identical to RFI module: My Views (user-only), Project Views (shared), Company Views (admin), Iris Views (auto-suggested). Each persists filters + columns + sort + view-type + grouping. Iris-suggested views: "Overdue at architect", "Long lead → schedule risk", "Resubmit count > 1", "Federal closeout package".

### 2.4 Submittal Detail page IA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back   #0231-A · Storefront frame system            [Status pill] [⋯]      │
│ Spec 08 41 13 §2.04  ·  Sub: ACME Glass  ·  BIC: Architect (3d overdue)      │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Overview] [Markup] [Revisions] [Citations] [History] [Distribute]          │
├──────────────────────────────────────────────┬──────────────────────────────┤
│  Title          Storefront frame system       │  ✨ IRIS                     │
│  Kind           Shop Drawing + Product Data   │  ⚠ Pre-flight: missing AAMA  │
│  Spec link      08 41 13 §2.04 → [open spec] │     test certificate per     │
│  Required on    2026-08-12 (auto, fab+ship)  │     §2.04.B.3                │
│  Submit by      2026-06-24                   │  → [Add to package]          │
│  Lead time      6 weeks (auto)               │                              │
│  Reviewer chain GC PE → Architect → Eng Rec │  💡 3 similar past:          │
│  Disposition    —                            │     0119, 0143, 0187 →       │
│  Stamp          —                            │     all rejected first round │
│  Deviation      ☐ Yes (A201 §3.12.8)         │                              │
├──────────────────────────────────────────────┤  📎 Citations (8)            │
│  PACKAGE (8 files)                           │     ▸ Spec §2.04 (2)         │
│  ▸ Cut sheets (4)                            │     ▸ A201 §4.2.7 (1)        │
│  ▸ Shop drawings (2)                         │     ▸ AAMA TIR-A14 (1)       │
│  ▸ Test reports (1)                          │     ▸ Past submittal (3)     │
│  ▸ Calculations (1)                          │                              │
├──────────────────────────────────────────────┤  🕓 ACTIVITY                 │
│  COMMENTS · 12                               │  • Sub uploaded R1 · 2h      │
│  @Walker — looks good, send to arch          │  • Iris ran preflight ✓      │
│                                              │  • GC PE forwarded · 1d      │
└──────────────────────────────────────────────┴──────────────────────────────┘
```

The right rail is the Iris citations side panel (per ADR-004). Open citation → preview in a docked panel, never a modal, never a full-page nav.

---

## Part 3 — Domain Model

### 3.1 Canonical types

Add to `src/types/submittal.ts` (and update `database.ts` after migration):

```ts
export type SubmittalKind =
  | 'shop_drawing'
  | 'product_data'
  | 'sample'
  | 'mockup'
  | 'test_report'
  | 'certification'
  | 'qualification'
  | 'closeout'
  | 'warranty'
  | 'leed_credit'
  | 'coordination_drawing'
  | 'maintenance'
  | 'other';

// EJCDC 6-code default. AIA-style codes are an alternative codeset, not
// the default. UFGS / federal codeset is a third. Per project setting.
export type SubmittalDispositionEjcdc =
  | 'A_no_exceptions_taken'
  | 'B_make_corrections_noted'
  | 'C_revise_and_resubmit'
  | 'D_rejected'
  | 'E_for_reference_only'
  | 'F_submit_specified_item';

export type SubmittalDispositionAia =
  | 'approved'
  | 'approved_as_noted'
  | 'revise_and_resubmit'
  | 'rejected'
  | 'for_record_only';

export type SubmittalDispositionUfgs =
  | 'approval_recommended'
  | 'approval_not_recommended'
  | 'no_action_taken'
  | 'receipt_acknowledged';

export type SubmittalCodeset = 'ejcdc' | 'aia' | 'ufgs' | 'custom';

export type SubmittalStatus =
  | 'draft'
  | 'sub_uploading'        // magic-link pending
  | 'gc_review'
  | 'preflight'            // Iris is checking before forward
  | 'sent_to_reviewer'
  | 'in_review'
  | 'returned'
  | 'distribute'           // approved, distribution to field pending
  | 'closed'
  | 'void';

export interface SubmittalSpecMapping {
  csi_division: string;        // e.g. "08"
  csi_section: string;         // e.g. "08 41 13"
  spec_section_paragraph: string; // e.g. "§2.04.B"
  spec_pdf_page: number;
  spec_pdf_highlight_rect: [number, number, number, number]; // PDF coordinates
}

export interface SubmittalRequiredOnSiteCalc {
  schedule_activity_id: string;
  schedule_start_date: string;       // ISO
  buffer_days: number;
  fab_lead_time_days: number;
  ship_lead_time_days: number;
  review_duration_days: number;      // SLA + a/e turnaround
  computed_required_on_site: string; // ISO — derived
  computed_submit_by: string;        // ISO — derived
  is_critical_path: boolean;
}
```

### 3.2 DB schema (consolidated migration)

New canonical migration: `supabase/migrations/202605070XXXXX_submittals_canonical.sql`. **This is a single replacement migration.** Run with `db-types:write` and commit `database.ts` in the same PR (per Sprint Invariant #1).

```sql
-- 1. Submittal package (the parent — what gets a number)
create table submittals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  number text not null,                            -- "0231-A" auto-numbered
  title text not null,
  kind submittal_kind not null,
  status submittal_status not null default 'draft',
  csi_division text,
  csi_section text,
  spec_section_paragraph text,
  spec_pdf_page int,
  spec_pdf_highlight_rect jsonb,
  required_on_site_date date,
  submit_by_date date,
  lead_time_weeks int,
  review_duration_days int default 10,             -- SLA default
  buffer_days int default 5,
  schedule_activity_id uuid references schedule_activities(id),
  is_critical_path boolean default false,
  is_federal boolean default false,                -- UFGS toggle
  responsible_sub_id uuid references organizations(id),
  current_reviewer_id uuid references users(id),
  current_reviewer_role text,
  ball_in_court_since timestamptz,
  approval_chain jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,  -- DO NOT lose this column again
  closed_at timestamptz,
  closed_by uuid references users(id),
  closed_reason text,
  parent_submittal_id uuid references submittals(id),  -- for revisions
  rev_number int not null default 0,
  is_soft_pilot boolean default false,             -- per ADR-006
  -- telemetry per IRIS_TELEMETRY_SPEC
  iris_preflight_score numeric,
  iris_preflight_findings jsonb,
  iris_drafted_by_human boolean,
  iris_voice_score numeric,
  -- audit
  created_at timestamptz default now(),
  created_by uuid references users(id),
  updated_at timestamptz default now(),
  updated_by uuid references users(id),
  hash_chain_prev text,                            -- per ADR Lap 1 hash chain
  hash_chain_self text
);

create index on submittals (project_id, status);
create index on submittals (project_id, csi_section);
create index on submittals (current_reviewer_id) where status in ('in_review', 'sent_to_reviewer');
create index on submittals (required_on_site_date) where status not in ('closed', 'void');

-- 2. Revisions (every Rev N is a row; parent_submittal_id chains them)
-- already covered by parent_submittal_id + rev_number above.

-- 3. Reviewers (the chain — many per submittal)
create table submittal_reviewers (
  id uuid primary key default gen_random_uuid(),
  submittal_id uuid not null references submittals(id) on delete cascade,
  sequence int not null,
  reviewer_id uuid references users(id),
  reviewer_role text,                              -- "GC PE", "Architect of Record"
  reviewer_org_id uuid references organizations(id),
  reviewer_email text,                             -- if external w/ no user
  parallel_group int,                              -- nulls = sequential; ints = parallel groups
  due_date date,
  received_at timestamptz,
  responded_at timestamptz,
  disposition text,                                -- one of the codeset values
  comments text,
  stamp_url text,                                  -- generated PDF stamp
  unique (submittal_id, sequence)
);

-- 4. Items inside the package (cut sheets, drawings, test reports — at file level)
create table submittal_items (
  id uuid primary key default gen_random_uuid(),
  submittal_id uuid not null references submittals(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  kind submittal_item_kind,                        -- cut_sheet, shop_drawing, test_report, sample_photo, …
  manufacturer text,                               -- OCR-extracted
  product_name text,                               -- OCR-extracted
  product_model text,                              -- OCR-extracted
  ocr_text text,                                   -- searchable
  page_count int,
  uploaded_by uuid references users(id),
  uploaded_via text,                               -- magic_link, web, mobile, email_in
  created_at timestamptz default now()
);

create index on submittal_items using gin (to_tsvector('english', coalesce(ocr_text, '')));

-- 5. Markup (annotations live here, separate from items)
create table submittal_markup (
  id uuid primary key default gen_random_uuid(),
  submittal_item_id uuid not null references submittal_items(id) on delete cascade,
  rev_number int not null,
  pdf_page int not null,
  geometry jsonb not null,                         -- bbox + free-form ink path
  kind text not null,                              -- highlight, callout, redline, stamp
  comment_md text,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

-- 6. Transmittals (existing table, expand)
alter table transmittals
  add column if not exists submittal_id uuid references submittals(id),
  add column if not exists kind text,              -- to_arch, to_sub, distribute_field
  add column if not exists pdf_url text,
  add column if not exists email_message_id text;

-- 7. Magic-link tokens (separate from sub portal tokens — narrower scope)
create table submittal_magic_links (
  token text primary key,
  submittal_id uuid not null references submittals(id) on delete cascade,
  intent text not null,                            -- 'sub_upload' | 'reviewer_review'
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

-- 7b. Submittal Packages (first-class — Procore parity)
create table submittal_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  number int not null,                             -- "Package #1"
  title text not null,
  description text,
  responsible_sub_id uuid references organizations(id),
  csi_section text,                                -- if package is spec-aligned
  status text not null default 'open',
  distribution_list jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  created_by uuid references users(id),
  unique (project_id, number)
);

alter table submittals
  add column if not exists submittal_package_id uuid references submittal_packages(id);

-- 7c. Workflow Templates (per trade — Procore parity, plus Iris-suggested)
create table submittal_workflow_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),         -- null = company-level template
  company_id uuid references companies(id),
  name text not null,                              -- "Architectural", "MEP", "Structural", etc.
  trade text,
  steps jsonb not null,                            -- array of {role, default_offset_days, parallel_group, can_add_reviewers}
  is_default boolean default false,
  created_at timestamptz default now(),
  unique (project_id, name)
);

-- 7d. Email-in / Email-out audit (Procore parity: Emails tab)
create table submittal_emails (
  id uuid primary key default gen_random_uuid(),
  submittal_id uuid not null references submittals(id) on delete cascade,
  direction text not null,                         -- 'in' | 'out'
  message_id text not null,
  subject text,
  from_addr text,
  to_addrs text[],
  cc_addrs text[],
  body_html text,
  body_text text,
  attachments jsonb,
  received_at timestamptz default now(),
  unique (message_id)
);

-- 7e. Change history (Procore parity: Change History tab; we already hash-chain)
create table submittal_change_history (
  id uuid primary key default gen_random_uuid(),
  submittal_id uuid not null references submittals(id) on delete cascade,
  action_at timestamptz default now(),
  action_by uuid references users(id),
  field text,
  from_value jsonb,
  to_value jsonb,
  hash_chain_prev text,
  hash_chain_self text
);

-- 7f. Distribution list audit (every redistribute logs here)
create table submittal_distributions (
  id uuid primary key default gen_random_uuid(),
  submittal_id uuid not null references submittals(id) on delete cascade,
  distributed_at timestamptz default now(),
  distributed_by uuid references users(id),
  to_user_ids uuid[],
  to_emails text[],
  message text,
  pdf_url text
);

-- 8. Settings per project (codeset, default SLA, federal mode, custom codes)
create table submittal_settings (
  project_id uuid primary key references projects(id),
  codeset submittal_codeset not null,              -- no default; project-setup wizard must pick. See SUBMITTAL_OPEN_QUESTIONS_RESOLUTION_2026-05-06.md decision #1.
  custom_codes jsonb,
  default_sla_days int not null default 10,
  default_buffer_days int not null default 5,
  default_submittal_manager_id uuid references users(id),
  default_distribution jsonb default '[]'::jsonb,  -- auto-add list (Procore parity)
  include_spec_section_number boolean default true,
  numbering_format text default '{spec_section}-{seq}', -- "03-3000-1"
  is_federal boolean not null default false,
  ufgs_approving_authority text,
  -- workflow toggles (Procore parity)
  allow_approvers_to_add_reviewers boolean default true,
  approvers_required_by_default boolean default true,
  enable_reject_workflow boolean default false,    -- auto-route to manager on reject/resubmit
  enable_dynamic_due_dates boolean default true,
  enable_schedule_linking boolean default true,
  private_by_default boolean default false,
  enable_qr_codes boolean default true,
  -- email matrix (Procore parity)
  email_notifications jsonb not null default '{}'::jsonb,
  enable_overdue_reminders boolean default true,
  allow_attachment_download_no_login boolean default true,
  -- AI / SiteSync-only
  ai_preflight_enabled boolean not null default true,
  ai_preflight_block_threshold numeric,            -- 0..1; if Iris confidence-of-rejection > X, hard-block
  voice_review_enabled boolean default false,
  closeout_template jsonb
);

-- 9. Materialized view for the log (refresh hourly + on key events)
create materialized view submittals_log_mv as
select s.*,
  org_sub.name as sub_name,
  user_reviewer.full_name as current_reviewer_name,
  extract(day from now() - s.ball_in_court_since) as days_in_court,
  case
    when s.required_on_site_date < current_date and s.status not in ('approved', 'closed', 'distribute') then 'overdue'
    when s.submit_by_date < current_date and s.status = 'draft' then 'submit_overdue'
    when s.required_on_site_date - current_date < 7 and s.status not in ('approved', 'closed', 'distribute') then 'at_risk'
    else 'on_track'
  end as risk_band
from submittals s
left join organizations org_sub on org_sub.id = s.responsible_sub_id
left join users user_reviewer on user_reviewer.id = s.current_reviewer_id;

-- 10. RLS
alter table submittals enable row level security;
create policy submittals_project_member on submittals
  for all using (project_id in (select project_id from project_members where user_id = auth.uid()));
-- Pilot isolation per ADR-006: any soft-pilot project's rows visible only to soft-pilot users.
```

The materialized view feeds the log paint. Refresh on insert/update of `submittals` via trigger + every 5 min via `pg_cron` (per ADR-003).

### 3.3 RPCs (atomic transitions; called by the state machine)

```
submittal_advance_status(p_id uuid, p_to text, p_actor uuid, p_reason text) returns submittals
submittal_record_disposition(p_reviewer_id uuid, p_disposition text, p_comment text, p_stamp_url text) returns void
submittal_create_revision(p_parent_id uuid) returns submittals
submittal_distribute(p_id uuid, p_to_user_ids uuid[]) returns void
submittal_close(p_id uuid, p_reason text) returns void
submittal_compute_required_on_site(p_id uuid) returns submittal_required_on_site_calc
```

Each RPC is wrapped in a transaction, computes hash-chain prev/self, emits a telemetry event, and returns the updated row.

---

## Part 4 — State Machine (Fixed)

The bug at `submittalMachine.ts:58` (`// BUG #1 FIX`) is a real defect: `gc_review` → `architect_review` should not auto-advance on `GC_APPROVE`; the GC PE must explicitly transmit. Replace the machine with this XState 5 chart:

```
draft
  ├ SUBMIT_BY_SUB (magic link) → sub_uploading → SUBMITTED → gc_review
  └ ASSIGN_TO_GC                              → gc_review

gc_review
  ├ PREFLIGHT_PASS                → preflight → READY_TO_SEND → gc_review
  ├ PREFLIGHT_FAIL                → preflight_failed (back to sub w/ Iris findings)
  ├ FORWARD_TO_REVIEWER (manual)  → sent_to_reviewer
  ├ INTERNAL_REJECT               → returned (to sub)
  └ HOLD                          → on_hold

sent_to_reviewer
  └ REVIEWER_OPENED               → in_review (auto on first markup or open)

in_review
  ├ DISPOSITION_A | B             → returned_approved → distribute
  ├ DISPOSITION_C | F             → returned_resubmit (creates rev)
  ├ DISPOSITION_D                 → returned_rejected
  ├ DISPOSITION_E                 → returned_info_only → distribute
  └ FORWARD (delegate)            → in_review (chain advances)

distribute
  ├ FIELD_PUSH_DONE               → closed
  └ HOLD_DISTRIBUTION              → distribute (sticky)

returned_resubmit / returned_rejected
  └ SUB_UPLOADS_NEW_REV           → gc_review (rev_number++ + parent_submittal_id link)

closed
  └ REOPEN (admin only)            → gc_review

void  (terminal)
```

Helpers exported (used by gates and side panels):
- `getValidSubmittalTransitions(status, role)` → typed list
- `getStampConfig(codeset, disposition)` → label, color, PDF stamp template
- `getSlaState(submittal)` → on_track | at_risk | overdue | overdue_critical
- `getBicHolder(submittal)` → user + role + days_in_court

Test file: `src/test/machines/submittalMachine.test.ts` — replace existing tests; cover every edge above.

---

## Part 5 — The 3 Killer Workflows

### 5.1 Spec-to-Log Auto-Extraction (`/submittals/import`)

**The single highest-leverage feature in the entire product.** Procore can't do this without partners; AutoSpecs is in Autodesk's bundle. We ship it natively at no upcharge.

**Flow (target: 8 minutes from drop to committed log):**

1. PE drags a 3,000-page spec PDF onto `/submittals/import`. (Or pulls from Box / Drive / Dropbox via existing connectors.)
2. Server-side: chunk by CSI section header (regex + ML; fallback to PDF outline).
3. For each section, Iris extracts §1.04 (Action Submittals) and §1.05 (Informational Submittals) using a tuned prompt + retrieval over the section text. Output: structured submittal list with type, deviation flags, sample size, certification requirements.
4. Iris auto-classifies kind (`shop_drawing`, `product_data`, `sample`, `test_report`, etc.) per CSI canonical types (per industry-standards research).
5. Iris auto-assigns the responsible sub from the project's buyout matrix (existing `subcontracts` table) using vector similarity on scope-of-work text.
6. Iris auto-computes lead time: pull from a curated reference table (`reference_lead_times` — seeded from manufacturer norms; we'll build from CoConstruct + Buildertrend lead-time data). Then walks back from the schedule activity (matched by CSI section) to compute `submit_by_date`.
7. PE sees a draft log with rows colored: green = high confidence, yellow = needs review, red = couldn't auto-fill (requires human).
8. PE bulk-edits, approves, commits → ~1,500 submittals seeded in one click.
9. Each submittal carries the citation back to the spec PDF page + highlighted region (citation kind 5: `spec_section`).

**Deep-link backref is the differentiator.** Hover any submittal row → preview pops the exact spec PDF page with the source paragraph highlighted. AutoSpecs doesn't do this.

**P0 acceptance:** drop the `Carleton-Spec-Book.pdf` (~2,800 pages) → log generated in <12 min with >85% rows green or yellow, <15% red. Coordinator finishes log in <60 min total.

### 5.2 AI Pre-Flight (`/submittals/:id` → "Run preflight")

Before a submittal goes to the architect, Iris checks it against the spec section. Same 8 citation kinds as RFI module, with citation kind 8 (`submittal_package`) added.

**Checks (each yields a finding with severity P0/P1/P2):**

- **Required-item check.** Spec §1.04.B.3 lists "AAMA TIR-A14 test certificate" → does the package include a file containing those keywords? OCR text from `submittal_items.ocr_text`. If missing → P0 finding.
- **Manufacturer-match check.** Spec lists 3 acceptable manufacturers; product data shows a 4th. Flag with citation to spec.
- **Calculation completeness.** If kind = `shop_drawing`, does the package include a stamped calculation? OCR for engineer license seal.
- **Deviation declaration.** If product specs differ from contract spec, has the sub flagged the deviation per A201 §3.12.8? If no flag but Iris detects a difference → P0.
- **Past-rejection pattern.** Iris searches for similar past submittals on this project (or org-wide if org-level Iris memory enabled). "Submittals 0119, 0143, 0187 with this same sub were all rejected first round for missing test reports" → P1 finding with citations to past submittals.
- **Voice / completeness.** Same voice linter from `IRIS_VOICE_GUIDE_SPEC` applied to any cover letter / transmittal.

**Outcomes:**
- All P0 clear → green badge, "Ready to forward."
- Any P0 → red badge, list of findings with **fix-it** actions ("Add AAMA test cert", "Declare deviation per A201 §3.12.8"). Configurable hard-block per project setting.
- All findings emit telemetry events keyed by submittal_id (per IRIS_TELEMETRY_SPEC) so we can measure **first-pass approval rate uplift** for the Day-60 acceptance gate.

**P0 acceptance:** preflight runs in <8 sec p95 on a 50MB package, 200 spec pages of context. First-pass approval rate uplift ≥ 25 percentage points vs. baseline (industry baseline 60–70% → SiteSync target 85–95%).

### 5.3 Inline Rev-Diff (`/submittals/:id` → Revisions tab)

Architect opens Rev 1 of a 80-page shop drawing. They want to know what changed since Rev 0. Currently every tool makes them re-read the whole thing. We don't.

**Flow:**

1. On rev creation, server runs structural PDF diff (`pdfminer` text + bounding-box + image diff with PIL).
2. Side-by-side viewer (using existing `react-pdf` we already ship): Rev 0 left, Rev 1 right, scrolled in lockstep.
3. Changed regions highlighted with subtle yellow tint; click a region → Iris generates a one-sentence summary ("Mullion thickness increased from 2.5" to 3.0", per §2.04.B").
4. Reviewer can mark each change individually accepted/rejected/needs-comment, then issue a rolled-up disposition.
5. Markup from Rev 0 is persisted and overlaid on Rev 1 by default (so prior comments don't disappear — direct fix to the #1 community complaint about Procore + Bluebeam).

**P0 acceptance:** rev-diff renders in <3 sec for 80-page docs. Architect-reported "I read Rev 1 in <10 min vs. >45 min in Procore" in soft pilot exit interview.

---

## Part 6 — Reviewer & Sub Experience

### 6.1 The Magic-Link Sub Upload (sister of Sub Portal v0)

Same pattern as `SUB_PORTAL_V0_SPEC`. The GC creates a submittal placeholder, picks the responsible sub, clicks "Request from sub." Sub gets text + email with a magic link → 60 seconds from tap to upload page → drag-and-drop → done. No SiteSync account needed forever.

The link is scoped to that one submittal (not full sub-portal access). After upload, the sub gets a status link they can revisit; we email them on disposition change.

### 6.2 The External Reviewer Portal (architect/engineer)

This is the deal-killer. **Architects refuse to learn another PM tool.** Procore solves this with free unlimited collaborator seats; Newforma Submittal Exchange solves it by being the architect's familiar muscle memory. We solve it with a **review-only portal** that doesn't require a SiteSync account at all.

**Flow:**
1. GC PE forwards submittal to architect; system emails the architect a magic-link review URL.
2. Architect clicks → `review.sitesync.com/submittal/:token`. Identity established by the link + an optional one-time email code (no password, no signup).
3. Architect sees: package, markup tools (native, Bluebeam-grade), rev-diff if rev > 0, disposition selector with the project's codeset (default EJCDC 6-code), comment box, license-seal upload (one-time per architect; cached by email).
4. Architect marks up, picks disposition, clicks Submit Review. We generate a stamped PDF (license seal + name + date + disposition + AIA §4.2.7 disclaimer block hard-coded) and attach to the submittal.
5. State machine advances; the GC PE gets notified.

**The PDF stamp is non-trivial.** Per industry-standards research, the AIA §4.2.7 disclaimer is required to limit architect liability. We bake it in:

> *"Review of this submittal is for the limited purpose of checking for conformance with information given and the design concept expressed in the Contract Documents. Review does not constitute approval of safety precautions, dimensional accuracy, or compliance with regulations. The Contractor remains responsible for accuracy and completeness."*

Architects historically fight to add this language manually; we make it default. Major reason architects will prefer SiteSync to bare email PDF.

### 6.3 The Field Distribution Flow

After approval, the submittal is distributed. This is where Procore's data model is strongest but the workflow is weakest. Subs and supers don't read email.

**Flow:**
1. On disposition `A` or `B`: state machine advances to `distribute`.
2. Auto-pin to plan: if the spec section maps to a drawing region (we already have the drawing-pin engine from RFIs), auto-pin the approved submittal there.
3. Push notification to all assignees who have the schedule activity in their next-7-day field plan (per the existing `field_plan` table).
4. Generate a QR code per submittal; QR codes printed on Daily Log handouts auto-include a "scan to see latest approved" link.
5. Foreman scans QR or opens phone → 2 taps to the approved PDF + stamp + spec link, offline-cached.
6. SLA: "from disposition to field-confirmed-seen" must be <24 hours. We track this as a telemetry event.

---

## Part 7 — Closeout Binder

The owner's moment of truth. Today, GCs spend 60+ hours assembling the closeout binder at substantial completion. We compress to one click.

**Flow:**
1. Project hits "Substantial Completion" milestone.
2. PE clicks `/submittals/closeout` → "Generate Closeout Binder."
3. Server walks all `kind in ('warranty', 'closeout', 'maintenance')` submittals + all `status = 'closed'` submittals, indexes by CSI division, generates a hyperlinked PDF + a COBie-tagged ZIP.
4. COBie tagging: per industry-standards research, Type sheet ↔ product data; Component sheet ↔ as-built/commissioning; Document sheet ↔ closeout artifacts; Job/Resource/Spare/Attribute sheets ↔ maintenance. We tag each submittal artifact at upload and roll up at closeout.
5. Output: one indexed PDF (hyperlinked TOC), one COBie spreadsheet, one ZIP of stamped originals. Owner opens the PDF on their phone, taps Section 08 41 13, reads the warranty.

**P0 acceptance:** generate in <90 sec for a 1,500-submittal project. Owner-reported "this is the cleanest closeout I've ever received" in soft pilot exit interview.

---

## Part 8 — Iris Voice & Citations Specific to Submittals

Per `IRIS_VOICE_GUIDE_SPEC_2026-05-04.md` and `IRIS_CITATIONS_SPEC_2026-05-04.md`:

- **Voice rules (additions for submittals):**
  - Never say "Approved" without context — always reference the disposition code (e.g., "Disposition A: No Exceptions Taken").
  - Never paraphrase the architect's stamp; quote it verbatim and cite.
  - Never declare design intent; only the architect can. Iris-generated reject reasons must always include the §4.2.7 disclaimer when standing in for an architect's voice.
  - When Iris drafts a transmittal, the recipient and CC list must be human-confirmed before send (per ADR-006 and security rules above).
- **Citations (use kinds 5, 6, 7, 8 from the citations spec):**
  - Kind 5: `spec_section` — link + page + highlight rect.
  - Kind 6: `prior_submittal` — link to past submittal that matches.
  - Kind 7: `industry_standard` — AIA, ASTM, AAMA refs.
  - Kind 8: `submittal_package_item` — citation into a specific page in this submittal's package PDF.

---

## Part 9 — Telemetry (per IRIS_TELEMETRY_SPEC)

Every event below is emitted with `submittal_id`, `project_id`, `actor_id`, `is_soft_pilot`, plus event-specific fields. All hash-chained per Lap 1 audit trail.

| Event | When | Why |
|---|---|---|
| `submittal.created_from_spec` | Spec import commits a row | Measure spec-to-log automation adoption |
| `submittal.preflight_run` | Iris preflight runs | Measure preflight coverage |
| `submittal.preflight_finding_resolved` | A P0/P1 finding closes | Measure usefulness |
| `submittal.first_pass_approved` | Disposition `A` on rev 0 | The headline metric |
| `submittal.rejected` | Disposition `C/D/F` on any rev | Counterpoint metric |
| `submittal.cycle_time_hours` | From sent_to_reviewer → returned | SLA telemetry |
| `submittal.rev_diff_used` | Architect opens rev-diff side panel | Feature adoption |
| `submittal.field_seen` | Foreman opens the approved PDF on mobile | Distribution effectiveness |
| `submittal.closeout_generated` | Closeout binder created | Closeout flow adoption |
| `submittal.dont_want_to_go_back` | Soft-pilot user clicks "I don't want to go back" prompt | Day-60 gate (per LAP_2_ACCEPTANCE_GATE_SPEC) |

**Dashboard (`/submittals/reports`):**
- First-pass approval rate (uplift vs. baseline)
- Median + p95 cycle time
- BIC heatmap (which architects/subs are bottlenecks; counts and durations)
- Predictive bottleneck warning (Iris flag)
- Closeout-readiness % (closed_submittals / required_at_closeout)

---

## Part 10 — Implementation Gameplan (Day-by-Day)

**Sprint window:** Lap 2, Day 35 (May 14) → Lap 2, Day 60 (June 9, soft pilot start) → Lap 3, Day 30 (continued polish + binder + federal).

**Numbering:** D-N = Lap 2 day N (Lap 2 starts ~May 11 per Reverse-Engineered Milestones). Times are aspirational; cut ruthlessly if a day blows.

### Phase P0 — Floor (Days 35-42, ~1 week) — "Don't Lose Data"

- **D35** Delete duplicate files (`SubmittalDetail 2.tsx`, `*.test 2.tsx`, `*.spec 2.ts`, `*.spec 3.ts`); fix the `// BUG #1 FIX` in `submittalMachine.ts` properly (no auto-advance from `gc_review`). Run typecheck — must stay zero (Sprint Invariant #1).
- **D36** Write canonical migration `202605070XXXXX_submittals_canonical.sql`. Backfill missing telemetry columns; add `submittal_settings`, `submittal_reviewers`, `submittal_items`, `submittal_markup`, `submittal_magic_links`. Regenerate `database.ts` via `npm run db-types:write` and commit in same PR.
- **D37** Materialized view `submittals_log_mv` + `pg_cron` refresh per ADR-003. RPCs (`submittal_advance_status`, `submittal_record_disposition`, `submittal_create_revision`, `submittal_distribute`).
- **D38** Refactor service layer (`src/services/submittalService.ts`) to use new RPCs. Add bulk-update + filter + search endpoints.
- **D39** Rebuild `/submittals` log with the 5 view types (List, Kanban, Timeline, Spec-Section, Schedule-Linked). Use the existing `useEntityStore('submittals')`. Saved Views model identical to RFIs.
- **D40** Rebuild `/submittals/:id` detail page with Iris citations side-panel (per ADR-004).
- **D41** Rewrite Vitest tests for the new state machine and service. Remove all duplicates.
- **D42** Cut a P0 release tag. Acceptance: log paint <200ms p95 for 5,000 rows; detail page paints <500ms; typecheck zero; existing E2E lifecycle test green.

### Phase P1 — The Killer (Days 43-49, ~1 week) — "Spec → Log"

- **D43** Build `/submittals/import` skeleton + drop zone + queue table.
- **D44** PDF chunking by CSI section header. Reference table `reference_lead_times` seeded.
- **D45** Iris extractor for §1.04 + §1.05. Citation kind 5 wiring (deep-link to spec PDF page + highlight rect).
- **D46** Auto-assignment of responsible sub from buyout matrix (vector similarity on scope-of-work text).
- **D47** Schedule walk-back: compute `submit_by_date` from `required_on_site_date - lead_time - review_duration - buffer`. Ground in `schedule_activities` table.
- **D48** Bulk-edit + commit flow + rollback. Telemetry events.
- **D49** Acceptance test: drop `Carleton-Spec-Book.pdf` → log in <12 min. Receipt drop.

### Phase P2 — AI Pre-Flight + Magic-Link (Days 50-56, ~1 week, overlaps soft-pilot start)

- **D50** Magic-link upload portal (`sub.sitesync.com/submittal/:token`). 60-second flow.
- **D51** External reviewer portal (`review.sitesync.com/submittal/:token`) with PDF viewer + native markup.
- **D52** AIA §4.2.7 disclaimer-stamp PDF generator (PDF-Lib + license-seal cache).
- **D53** Iris pre-flight: required-item, manufacturer, calc-completeness, deviation, past-rejection-pattern checks. Telemetry hook.
- **D54** Inline rev-diff (Rev N-1 vs. Rev N). PDF text + bbox diff. Iris one-line change summary.
- **D55** Markup persistence across revisions. Comment carry-forward.
- **D56** Acceptance test: end-to-end Sub → Iris pre-flight → GC PE → Architect → Disposition → Distribute. Soft pilot user clicks "I don't want to go back."

### Phase P3 — Field Distribution + Mobile (Days 57-63, ~1 week)

- **D57** Auto-pin approved submittal to drawing region (reuse RFI drawing-pin engine).
- **D58** QR code generation + handout PDF.
- **D59** Mobile detail page (PWA + iOS/Android per IOS_APP_SPEC + ANDROID_APP_SPEC). Offline cache via Workbox + IndexedDB.
- **D60** Push-on-approval to field assignees. Telemetry: `submittal.field_seen`.
- **D61** Voice-driven review codes (iOS/Android). Speech-to-text → disposition → state machine advance.
- **D62** Predictive bottleneck warning (Iris background job hourly + on-event).
- **D63** Day-60 acceptance gate hits. Receipt + tracker update.

### Phase P4 — Closeout Binder + Federal Mode (Days 64-77, ~2 weeks, Lap 3)

- **D64** `/submittals/closeout` skeleton.
- **D65** COBie tagging at upload. Type/Component/Document/Job/Resource/Spare/Attribute mappings.
- **D66** Closeout PDF generator with hyperlinked TOC.
- **D67** COBie spreadsheet generator (xlsx skill).
- **D68** Federal toggle in settings. UFGS Approving Authority codeset. WH-347 weekly payroll integration. DBE/MBE recurring submittal templates.
- **D69-D77** Polish, defect-burn, soft-pilot iteration.

### Phase P5 — Polish (Days 78-90, ~2 weeks, Lap 3)

- Reports & dashboards (`/submittals/reports`).
- Saved-view share + URL state.
- Settings & Workflow Builder UI.
- Bulk operations UI.
- Email-in / email-out (per-project unique reply-to).
- Hash-chain audit page.
- Acceptance: 95/100 vs. Procore on the 14 dimensions in the TL;DR.

---

## Part 11 — Acceptance Criteria

A submittal-module ship is **accepted** when ALL of the following hold:

1. **Typecheck zero.** Both `tsconfig.app.json` and `tsconfig.node.json`. (Sprint Invariant #1.)
2. **Money math via `src/types/money.ts`.** No raw `*` or `+` on cents. (Invariant #2.)
3. **PermissionGate wraps every action button** that touches money, schedule, or the field. (Invariant #5.)
4. **No revived deleted stores.** `useEntityStore('submittals')` only. (Invariant #3.)
5. **Spec-to-log automation:** drop `Carleton-Spec-Book.pdf` → ≥85% rows green/yellow, total time <12 min for ~1,500 submittals.
6. **Pre-flight uplift:** measured first-pass approval rate ≥ 25 percentage points above baseline in soft pilot.
7. **Cycle time:** median from sent_to_reviewer → returned ≤ 7 working days; p95 ≤ 14 working days.
8. **Field push:** ≥80% of approved submittals confirmed seen on mobile within 24 hours.
9. **Closeout:** binder generated in <90 sec for 1,500 submittals; owner clicks through ≥75% of TOC entries.
10. **Soft pilot exit interview:** Brad Cameron at Nexus and the Carleton coordinator both pick "I don't want to go back" on the submittals module specifically.
11. **All 10 telemetry events instrumented** and visible on the Day-60 acceptance dashboard.
12. **Hash chain validates** end-to-end across rev 0 → rev N for a sample 50-submittal project.

---

## Part 12 — Risks & Open Questions

| Risk | Mitigation |
|---|---|
| Spec-to-log accuracy plateau at <85% green | Seed `reference_lead_times` heavily; collect human corrections as training data; allow per-firm overrides |
| Architects refuse magic-link review (signup walls feel safer) | Offer both: magic-link + optional 30-second email-code identity confirmation; cache license-seal once-per-architect across projects |
| AIA §4.2.7 disclaimer language fails legal review at large architect firms | Make stamp text per-firm-overridable in settings; ship 3 default flavors (AIA / EJCDC / firm-custom) |
| Pre-flight false positives erode trust | Default mode is "warn, don't block"; firm can opt into hard-block per project; ship feedback button on every finding |
| Mobile offline cache leaks PII for non-pilot users | Per ADR-006 + ADR-008: only soft-pilot rows cached client-side, encrypted at rest, 24h TTL |
| Rev-diff struggles on raster shop drawings (no embedded text) | Fall back to image-diff with PDFium rasterization; OCR pass on Rev 0 + Rev 1 to compare extracted text |
| Voice review on iOS gets misheard ("approved" → "improved") | Confirmation step: read back the disposition and require tap-confirm before state advance |
| Federal mode complexity blows the timeline | Keep federal mode behind a feature flag; ship in P4 not P0 |
| Closeout COBie correctness is hard to verify without a real pilot | Recruit one healthcare or higher-ed soft pilot specifically to exercise closeout; partner with NIBS for review |

**Open questions: resolved 2026-05-06.** See `SUBMITTAL_OPEN_QUESTIONS_RESOLUTION_2026-05-06.md` for the full decisions:
1. Codeset → user picks at project-setup wizard; no default value.
2. Pre-flight → warn but don't block; track override rate for future hard-block opt-in.
3. License-seal cache → per architect, org-wide, with revocation; encrypted at rest; 12-month TTL.
4. Federal mode → punt to Lap 3. Keep `is_federal` schema columns in P0-D36 for forward compatibility.
5. Iris memory → per-org during soft pilot; industry-wide opt-in post-pilot with SOC 2 review.

---

## Part 13 — What This Replaces / What Survives

**Delete in P0:**
- `src/pages/submittals/SubmittalDetail 2.tsx`
- `src/pages/submittals/SubmittalDetailPage 2.tsx`
- `src/test/pages/smoke/submittals.test 2.tsx`
- `src/test/pages/smoke/submittal-detail.test 2.tsx`
- `e2e/page-6-submittals.spec 2.ts`
- `e2e/page-6-submittals.spec 3.ts`
- `src/components/forms/CreateSubmittalModal.tsx` (legacy; wizard is canonical)

**Refactor in P0:**
- `src/machines/submittalMachine.ts` — fix the `gc_review` bug; rewrite to the chart in Part 4
- `src/services/submittalService.ts` — switch to RPC-backed atomic transitions
- `src/api/endpoints/submittals.ts` — add bulk + filter + search + import + closeout
- `src/types/submittal.ts` — expand to the canonical types in Part 3

**Survive untouched:**
- `src/services/iris/citationVerify.ts` (Lap 1 hash-chain compatibility)
- `src/services/iris/executors/submittalTransmittal.ts` (extend, don't rewrite)
- `useEntityStore` generic infra (per ADR-002)

**Net new (Lap 2):**
- `src/components/submittals/` directory becomes the unified home for everything submittal-related
- `src/pages/submittals/import/` (spec importer) (planned)
- `src/pages/submittals/closeout/` (closeout binder) (planned)
- `src/services/iris/preflight.ts` (planned)
- `src/services/iris/specExtract.ts` (planned)
- `src/services/iris/revDiff.ts` (planned)
- `src/services/closeoutBinder.ts` (planned)

---

## Appendix A — Pain-Point Receipts (the dollar figures)

- 30–40% reject rate on first review — BuildSync pain study
- $805 per rejection × 1,500 submittals × 35% reject rate = ~$423K/job — BuildSync
- 5 hrs/wk chasing approvals = $10K+/yr per coordinator — SubmittalLink
- 90% of Procore mobile uploads fail on cellular per Procore Help — Procore community
- 10–14 calendar days is the AIA A201 §4.2.7 SLA default — AIA contract docs
- 6-code EJCDC disposition is the engineer-preferred legally-clean codeset — EJCDC O'Beirne Part 4
- 50 CSI MasterFormat divisions; §01 33 00 sets submittal procedures — CSI
- COBie is part of NBIMS-US V3; closeout binder generation is a $60+ hour manual job — NIBS / WBDG

Full citations live in:
- `outputs/submittal_pain_points_research.md` (subagent-1, ~2,000 words, 30+ URL citations)
- `outputs/SUBMITTAL_COMPETITIVE_ANALYSIS_2026-05-06.md` (subagent-2, capability matrix + white-space)
- `outputs/claude_code_output.md` (subagent-3, AIA/CSI/EJCDC/UFGS standards)

---

## Appendix B — Procore Parity Reference (Walker's pasted spec, 2026-05-06)

This is the exhaustive Procore reference Walker pasted. Each Procore item is mapped to the SiteSync surface that matches or exceeds it. Items marked **NEW** are net additions not present in Procore's submittals module.

### B.1 Procore A1-A10 surface parity (we match all 10, plus add 6)

| Procore surface | SiteSync surface | Status |
|---|---|---|
| A1. Items view | Part 2.2 #1 (Items / List) | ✅ matched |
| A2. Packages view | Part 2.2 #2 (Packages — first-class entity in `submittal_packages` table) | ✅ matched |
| A3. Spec Sections view | Part 2.2 #3 (Spec Sections) | ✅ matched |
| A4. Ball-in-Court view | Part 2.2 #4 (Ball-in-Court) | ✅ matched |
| A5. Recycle Bin | Part 2.2 (sub-tab); existing soft-delete pattern | ✅ matched |
| A6. Create / Edit form | Part 1 surface #4 (`/submittals/new`); fields enumerated below | ✅ matched + extended |
| A7. Submittal Detail (General / Related Items / Emails / Change History) | Part 1 surface #2 (`/submittals/:id`); tabs: Overview / Markup / Revisions / Citations / History / Distribute / Emails | ✅ matched + extended (Markup, Revisions, Citations) |
| A8. Settings (7 sub-tabs) | `/submittals/settings`; tabs map below | ✅ matched |
| A9. URL pattern | Same query-param structure for views; deep-linkable | ✅ matched |
| A10. Lifecycle / concepts | State machine in Part 4; Packages, Stamps, Redistribute, Dynamic due dates, Reject Workflow all covered | ✅ matched |
| **NEW: Spec Importer** | Part 1 surface #3 (`/submittals/import`) | ⭐ net new |
| **NEW: Magic-Link Sub Upload** | Part 1 surface #7 (`sub.sitesync.com`) | ⭐ net new |
| **NEW: External Reviewer Portal** | Part 1 surface #8 (`review.sitesync.com`) | ⭐ net new |
| **NEW: Closeout Binder** | Part 1 surface #10 (`/submittals/closeout`) | ⭐ net new |
| **NEW: Mobile / PWA / iOS / Android** | Part 1 surface #9 | ⭐ net new (Procore mobile is web-app; ours is native + offline) |
| **NEW: Reports & Dashboards** | Part 1 surface #6 with predictive bottleneck | ⭐ net new vs. Procore canned reports |

### B.2 The Create / Edit form (A6 fields → SiteSync fields)

Every Procore field is supported. Net-new fields marked.

| Procore field | SiteSync column / source | Notes |
|---|---|---|
| Title | `submittals.title` | |
| Specification | `submittals.csi_section` | Picker drives auto-numbering |
| Number & Revision | `submittals.number` + `rev_number` | Default `{spec_section}-{seq}` per `submittal_settings` |
| Submittal Type | `submittals.kind` | 13 canonical kinds (Part 3.1); custom add via settings |
| Submittal Package | `submittals.submittal_package_id` | FK to `submittal_packages` |
| Responsible Contractor | `submittals.responsible_sub_id` | |
| Received From | tracked on `submittal_items.uploaded_by` | |
| Submittal Manager | role on `submittal_reviewers` (sequence 1) | Default from `submittal_settings.default_submittal_manager_id` |
| Status | `submittals.status` | 9-state machine, Part 4 |
| Submit By | `submittals.submit_by_date` | Auto-computed if schedule linking on |
| Received Date | first `submittal_reviewers.received_at` | |
| Issue Date | `submittals.created_at` | |
| Final Due Date | computed from workflow steps + `review_duration_days` | |
| Location | reuse existing `locations` join (project locations table) | |
| Linked Drawings | `submittal_drawing_pins` (Part 6.3 reuses RFI pin engine) | ⭐ exceeds Procore — actual pin, not just reference |
| Distribution List | `submittal_packages.distribution_list` or per-submittal override | |
| Ball In Court | computed from current active reviewer | |
| Lead Time | `submittals.lead_time_weeks` | |
| Required On-Site Date | `submittals.required_on_site_date` | Auto-walked from schedule (Part 5.1 step 7) |
| Private | `submittals.is_private` (add column) | Default from `submittal_settings.private_by_default` |
| Description | rich text (TipTap, already shipped) | |
| Attachments | `submittal_items` rows | OCR'd, manufacturer/product extracted |
| Schedule Task | `submittals.schedule_activity_id` | |
| Anticipated Delivery Date | computed from `submit_by_date` + lead time | |
| Confirmed Delivery Date | `submittals.confirmed_delivery_date` (add column) | |
| Actual Delivery Date | `submittals.actual_delivery_date` (add column) | |
| Workflow / Template | from `submittal_workflow_templates`; per-trade defaults | |
| Step roles (Submitter / Approver / Reviewer) | `submittal_reviewers.reviewer_role` | |
| Response Types | codeset on `submittal_settings.codeset` | 8 default + custom (Procore parity) |
| **NEW: Iris Pre-flight findings** | `submittals.iris_preflight_findings` | ⭐ |
| **NEW: Spec PDF deep-link backref** | `submittals.spec_pdf_page` + `spec_pdf_highlight_rect` | ⭐ |
| **NEW: Critical-path flag** | `submittals.is_critical_path` | ⭐ |
| **NEW: Hash-chain audit** | `submittals.hash_chain_prev/self` | ⭐ |

Add migration columns to cover the gaps:

```sql
alter table submittals
  add column if not exists is_private boolean not null default false,
  add column if not exists confirmed_delivery_date date,
  add column if not exists actual_delivery_date date,
  add column if not exists anticipated_delivery_date date generated always as
    (submit_by_date + (lead_time_weeks * 7) * interval '1 day') stored;
```

### B.3 Settings tabs (A8 → SiteSync `/submittals/settings`)

| Procore sub-tab | SiteSync sub-tab | Notes |
|---|---|---|
| General | General | All 17 toggles on `submittal_settings` |
| Responses | Response Types | Codeset picker (EJCDC / AIA / UFGS / Custom) + per-response edits |
| Workflow Templates | Workflow Templates | Pre-seed Architectural / Civil / Interior / Landscape / MEP / Owner / Structural per Procore + Iris-suggested for the project |
| Replace Workflow User | Replace User | Bulk reassignment RPC `submittal_replace_user(p_old uuid, p_new uuid)` |
| Imports | Imports | CSV/XLSX bulk import using `xlsx` skill; idempotent by external ID |
| Custom Reports | Reports | First-class on `/submittals/reports`; saved filters become custom reports |
| Permissions | Permissions | Read-only summary (PermissionGate manages real perms — Sprint Invariant #5) |

### B.4 Procore B1-B23 attack vectors → where SiteSync wins

This is the kill matrix. Every gap Walker called out in Procore is mapped to a SiteSync section. We are NOT shipping a parity clone — we are shipping the parity surface plus all 23 attack vectors.

| # | Procore gap | SiteSync section | Phase |
|---|---|---|---|
| 1 | No AI extraction from submittal PDFs | Part 5.2 (pre-flight + OCR `submittal_items.ocr_text`) | P2 |
| 2 | No spec compliance checker | Part 5.2 (Iris reads spec § + package) | P2 |
| 3 | No automatic submittal log generation from spec book | Part 5.1 (`/submittals/import`) | P1 |
| 4 | No drawing pin / sheet linkage | Part 6.3 (reuse RFI pin engine) | P3 |
| 5 | Stamped markup happens in Bluebeam | Part 6.2 (native Bluebeam-grade markup, Part 5.3 rev-diff) | P2 |
| 6 | No live status / visual workflow chain | Part 2.4 sketch + workflow chain card on detail page | P0/P2 |
| 7 | No predicted delivery / supply-chain risk | Part 9 telemetry + `/submittals/reports` predictive bottleneck | P3 |
| 8 | No critical-path linkage | `submittals.is_critical_path` + auto-update from schedule webhook | P1 |
| 9 | No vendor portal | Part 6.1 (magic-link, zero seat) + sister `SUB_PORTAL_V0_SPEC` | P2 |
| 10 | No closeout package automation | Part 7 (`/submittals/closeout` + COBie) | P4 |
| 11 | No version diff Rev 0 vs Rev 1 | Part 5.3 (inline rev-diff) | P2 |
| 12 | No QR + jobsite verification | Part 6.3 (QR code + handout PDF + offline cache) | P3 |
| 13 | No vendor scoring | `/submittals/reports` BIC heatmap + sub-level metrics | P5 |
| 14 | Custom fields only company-level | `submittal_settings` + per-project `custom_fields jsonb` | P5 |
| 15 | Email notifications matrix is rigid | `submittal_settings.email_notifications jsonb` + per-user override + Slack/Teams/SMS via existing notification fanout | P5 |
| 16 | No threaded discussion on approver comments | Threaded comments on `submittal_reviewers.comments` (TipTap thread, reuse RFI infra) | P4 |
| 17 | No e-signature on stamped approval | DocuSign / native PKI signature on stamp PDF generator | P4 |
| 18 | No procurement / PO linkage | Webhook on disposition `A` → trigger Embedded Payments PO release (per `EMBEDDED_PAYMENTS_SPEC`) | P5 |
| 19 | No long-lead detection | Iris background job `/submittals/reports` flag; tied to `is_critical_path` | P3 |
| 20 | No batch upload of stamped reviews | Bulk-upload UI on detail page; multi-file drop matches by filename → reviewer | P5 |
| 21 | Reject workflow is binary | `submittal_advance_status` RPC accepts `back_to_step` arg; reject can target any step or specific user | P2 |
| 22 | No mobile shop-drawing markup | Part 1 surface #9 + Part 6.3; native iOS/Android markup parity | P3 |
| 23 | Translation missing | Bilingual EN/ES per `IRIS_VOICE_GUIDE_SPEC`; reuse i18n infra from Sub Portal v0 | P5 |

**All 23 covered.** Phasing aligns with Part 10. Soft pilot at Nexus + Carleton hits B1, B2, B3, B5, B9, B11 by Day 60 (the headline demo set).

### B.5 Where we differ from Procore intentionally

Some Procore conventions we deliberately don't copy:
- **Procore status names ("Open" / "Closed")** are too coarse — coordinators must open every record to find what's actually live. We use the 9-state machine (Part 4) so the Log answers "what's actually waiting on whom" without opening rows.
- **Procore "Approved" as a default response** has §4.2.7 liability exposure. Our default codeset is **EJCDC 6-code** ("No Exceptions Taken" instead of bare "Approved") with the AIA disclaimer baked into every stamp PDF. Walker can override per-firm in settings.
- **Procore numbering is `{seq}.{rev}`** (e.g. `17.0`); we mirror with `{spec_section}-{seq}` default but make the format a `submittal_settings.numbering_format` template so federal + healthcare + private clients can override.
- **Procore's "Submittal Manager" role** is one named user per project; we keep it but allow multi-manager + Iris-as-virtual-manager (with confirmation) for solo PEs at small GCs.
- **Procore's "Private" flag** restricts visibility to admins + workflow + distribution list; we honor it but enforce it via PermissionGate (Sprint Invariant #5) so the privacy is structural, not just a soft filter.

---

**End of spec.** Open questions are listed in Part 12. The following appendices are referenced: A (pain-point receipts), B (Procore parity above). Any further Procore feature Walker spots that's not covered → add as B.6 and a row in B.4.
