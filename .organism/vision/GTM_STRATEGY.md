# SiteSync PM — Strategic Implementation Guide

## Three Initiatives That Create an Unbreakable Competitive Moat

**Prepared for:** Walker Benner, wrbenner/sitesync-pm  
**Date:** July 2025  
**Scope:** Procore Migration Tool + Certified Payroll (Davis-Bacon) + Sub Portal with Free Tier

---

## Executive Summary

SiteSync PM has the opportunity to execute a three-part strategy that no competitor in the construction PM market has assembled: a Procore migration tool that eliminates switching costs, a free sub portal that creates viral network effects, and integrated certified payroll that locks in government-project GCs through compliance dependency. Each initiative is individually valuable, but together they form a flywheel that compounds: the migration tool pulls GCs off Procore by removing their biggest objection (data loss); each migrated GC invites 15-40 subs who get permanent, cross-GC profiles they actually own (better than Procore's disposable sub access); those subs evangelize SiteSync to their other GCs; and certified payroll — a $217B/year compliance obligation that no construction PM platform has natively solved — creates switching costs so high that GCs on federal projects cannot leave without rebuilding their entire compliance infrastructure. Procore has none of these. Autodesk has none. Fieldwire has none. The standalone compliance tools (LCPtracker, Elation) are disconnected from PM workflows. No single competitor has all three, and having all three creates a moat that is extraordinarily difficult to replicate because it requires simultaneously owning the GC relationship, the sub relationship, and the compliance workflow.

---

## Table of Contents

1. [Initiative 1: Procore Migration Tool](#initiative-1-procore-migration-tool)
2. [Initiative 2: Certified Payroll / Davis-Bacon](#initiative-2-certified-payroll--davis-bacon)
3. [Initiative 3: Sub Portal with Free Tier](#initiative-3-sub-portal-with-free-tier)
4. [The Flywheel](#the-flywheel)
5. [Pricing Strategy](#pricing-strategy)
6. [Priority Order](#priority-order)
7. [Risk Analysis](#risk-analysis)

---

## Initiative 1: Procore Migration Tool

### Why This Is the GTM Wedge

**Procore's pricing pain is real and growing.** Mid-market GCs ($20M–$150M annual construction volume) pay $35,000–$80,000/year for Procore, with annual renewals increasing 10–14% year over year. A GC running $55M in work volume pays approximately $55,000/year. A GC with a single $59M project reported paying $80,000/year for the non-financial-modules package. A $38M project was quoted $110,000 for 16 months — roughly 0.3% of project cost. For context, Procore's minimum realistic entry cost is $10,000–$15,000/year, even for small GCs with $5M ACV. These contractors are being priced out of the only competent full-platform option in the market.

**The switching cost barrier is the only thing keeping them.** GCs who want to leave Procore face a terrifying problem: years of RFI histories, submittal workflows, daily logs, photos, and documents are trapped inside Procore. There is no "Export Everything" button. Each module must be exported separately. Custom fields don't appear in CSV exports. Daily logs only export as PDF. Attachments require separate download steps per record. And the clock is ticking — Procore cuts off data access when the contract expires.

**A migration tool eliminates this barrier entirely.** By building a tool that ingests Procore's exported data (CSV/Excel for structured records, API for complete extraction), SiteSync removes the last rational objection a GC has to switching. The message becomes: "Bring your entire project history. Nothing is lost."

**Competitor landscape.** The existing migration tools don't compete with what SiteSync would build:

| Tool | What It Does | Why It Doesn't Compete |
|------|-------------|----------------------|
| **ProjectReady / WorkBridge** | Procore ↔ Autodesk ACC migration (documents, RFIs, submittals, drawings) with optional bidirectional sync | Serves Autodesk's ecosystem, not yours. Professional services model. |
| **IMAGINiT Pulse** | Professional services migration: projects, companies, users, docs, photos, punch lists, RFIs, budgets | Consulting engagement, not a self-service product. Serves the Autodesk migration path. |
| **Cloudsfer / Tzunami** | File/document migration only (Google Drive, Box, SharePoint → Procore) | Document storage migration, not construction PM data (no RFIs, submittals, workflows). |
| **Manual export** | GC exports CSVs and PDFs module by module, rebuilds in new system | Time-consuming, lossy, and terrifying for GCs. This is what most do today. |

No competitor offers a self-service "Procore → [alternative PM tool]" migration. SiteSync would be the first.

---

### Procore Data Model (What We're Importing)

#### RFI Fields and Status Mapping

Procore RFIs contain the following fields (from the API/CSV schema):

| Field | Type | Notes |
|-------|------|-------|
| id | integer | Procore internal ID |
| number | string | Sequential or stage-prefixed (e.g., "RFI-042") |
| subject | string | Title displayed in list view |
| status | enum | Draft / Open / Closed / Closed-Draft |
| question | text | Body of the RFI request |
| created_by | user_ref | User who created the RFI |
| date_initiated | date | Set when moved to Open status |
| due_date | date | Admin-set or auto-calculated |
| rfi_manager | user_ref | Admin user responsible for managing |
| assignees | user_ref[] | Users responsible for responding |
| received_from | user_ref | Originator of the question |
| responsible_contractor | company_ref | Company of Received From user |
| distribution | user_ref[] | Notification list |
| drawing_number | string | Linked drawing reference |
| spec_section | spec_ref | Linked specification section |
| location | location_ref | Job site location |
| cost_code | cost_code_ref | Linked cost code |
| cost_impact | enum | Yes / Yes (Unknown) / No / TBD / N/A |
| cost_impact_amount | decimal | Dollar amount if cost_impact = Yes |
| schedule_impact | enum | Yes / Yes (Unknown) / No / TBD / N/A |
| schedule_impact_days | integer | Calendar days if schedule_impact = Yes |
| private | boolean | Restricts visibility |
| reference | string | Optional reference tag |
| project_stage | string | Project stage prefix |
| custom_fields | object | Company/project-configured fields |
| attachments | file_ref[] | Attached files |
| responses | response[] | Thread of responses (official and non-official) |

Procore has 4 RFI statuses. SiteSync's kernel has 6 states. The mapping:

#### Status Mapping Table: RFIs

| Procore RFI Status | SiteSync RFI Status | Notes |
|---|---|---|
| Draft | draft | Direct map |
| Open | open | Direct map |
| Closed | closed | Direct map |
| Closed-Draft | void | Map to void — this represents a draft that was closed without resolution |

#### Status Mapping Table: Submittals

Procore submittals have a richer status model:

| Procore Submittal Status | SiteSync Submittal Status | Notes |
|---|---|---|
| Draft | draft | Direct map |
| Open | open | Direct map |
| Approved | approved | Direct map |
| Approved as Noted | approved | Map to approved; preserve "as noted" in a notes/metadata field |
| Revise and Resubmit | returned | Map to returned; SiteSync should track reason |
| Rejected | rejected | Direct map |
| Closed | closed | Direct map |

#### Submittal Fields

Key fields from Procore's submittal schema:

| Field | Type | Notes |
|-------|------|-------|
| number | string | Required. Unique per submittal (revisions tracked separately) |
| revision | integer | Auto-incremented (0, 1, 2...) |
| title | string | Descriptive name |
| type | enum | Document / Pay Request / Plans / Shop Drawing / Sample / etc. |
| spec_section | spec_ref | Corresponding spec section |
| submittal_package | package_ref | Optional package grouping |
| submittal_manager | user_ref | Person responsible for managing |
| responsible_contractor | company_ref | Company submitting |
| received_from | user_ref | Contact at responsible contractor |
| received_date | date | Date received |
| submit_by_date | date | Deadline for design team submission |
| required_on_site_date | date | Date materials must be on site |
| lead_time | integer | Days for materials to arrive |
| workflow_data | workflow[] | Sequence of submitter/approver groups with dates and responses |
| ball_in_court | user_ref | Current responsible party |
| attachments | file_ref[] | Note: NOT carried over between revisions in Procore |

#### Schedule Data

Procore is a **read-only display layer** for schedules. The authoritative data lives in external tools (Primavera P6, MS Project). Migration strategy:

1. Retrieve the original schedule file from the Procore Documents tool (stored in locked "Schedules" folder — Admin access required)
2. Original file formats preserved: MPP, XER, XML, PP, etc.
3. Alternatively, use the Procore Schedule API to extract activity-level data (WBS, activity names, IDs, dates, durations, % complete, predecessors/successors)
4. SiteSync should accept the same file imports Procore accepts (at minimum: XER, MPP, XML)

**Supported schedule formats in Procore:** MPP, MPX, XER, PP, XML (MS Project), XML (Primavera PMXML), PPX, FTP/FTS, POD, GAN, PEP, PRX, STX, CDPX/CDPZ, SP, ZIP.

#### Daily Logs

Procore daily logs are modular (20 sections). Key sections enabled by default:

| Section | Key Fields |
|---------|-----------|
| Weather | Time observed, sky conditions, temp, precipitation, wind, weather delay toggle |
| Manpower | Company, number of workers, hours worked, cost code |
| Notes | Free-text notes |
| Equipment | Equipment name, hours used, inspection time, cost code |
| Deliveries | Delivery records |
| Safety Violations | Safety violation log |
| Quantities | Material quantities |
| Productivity | Material arriving vs. installed |
| Photos | Progress photos linked to date |

**Critical limitation:** Daily logs export as PDF only from Procore's UI. For migration, the API is required:
```
GET /rest/v1.0/projects/{project_id}/daily_construction_report_logs
```

#### User/Contact Mapping

Procore user IDs are integers internal to each company account. **Email address is the only reliable cross-system key.** The migration tool must:

1. Extract all Procore users via `GET /rest/v1.0/companies/{company_id}/users`
2. Match Procore users → SiteSync users by email (with fuzzy matching suggestions)
3. Handle unmapped users: create a "legacy import" placeholder or store the original Procore name/email in a notes field

---

### Architecture

#### Phase 1: CSV/Excel Import (No API Needed)

This is the lowest-barrier entry point. Works even if Procore revokes API access. GCs export their own data from Procore's UI and upload to SiteSync.

**What Procore exports as CSV:**
- RFIs: All list items with configurable columns (including custom fields as of Aug 2025)
- Submittals: Items tab (Excel or CSV) — does NOT include custom fields
- Specs, Documents, Observations, Transmittals: CSV available
- Directory/Contacts: CSV from Company Directory

**What Procore does NOT export as CSV:**
- Daily Logs (PDF only)
- Custom fields on submittals
- Attachments (separate download)
- Response threads on RFIs (embedded in PDF export, not CSV)

**Implementation:**
- Build a CSV parser that accepts Procore's known column headers
- Map columns to SiteSync fields
- Show the user a preview with field mapping (drag-and-drop column matching)
- Handle missing/optional fields gracefully
- Import in dependency order: Projects → Users → Specs → RFIs → Submittals

#### Phase 2: API-Based Sync (OAuth2 Client Credentials / DMSA)

Full programmatic extraction from Procore's REST API.

**Authentication:**
- OAuth 2.0 with Client Credentials / DMSA (Developer Managed Service Account) grant — no user interaction required for server-to-server
- Auth endpoint: `https://login.procore.com/oauth/authorize`
- Token endpoint: `https://login.procore.com/oauth/token`
- Access token expiry: 1.5 hours (5400 seconds)
- Refresh token: does not expire until used
- Required header on all calls: `Procore-Company-Id: <integer>`
- API base URL: `https://api.procore.com/rest/v1.0/`

**Rate Limiting:**
- Dual limits: hourly (~3,600 requests/hour per FAQ) + spike (25 per 10-second window)
- Rate limit headers: `X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining`, `X-Rate-Limit-Reset`
- On 429: pause until `X-Rate-Limit-Reset` timestamp. Implement exponential backoff with jitter.
- On 503: check `Retry-After` header

**Pagination:**
- All list endpoints: `page` (1-indexed) + `per_page` (max 10,000)
- Response headers: `Total`, `Per-Page`, `Link` (RFC 5988 with first/prev/next/last)

**Key endpoints:**
```
GET /rest/v1.0/projects?company_id={company_id}
GET /rest/v1.0/projects/{project_id}/rfis?per_page=100&page=1
GET /rest/v1.0/projects/{project_id}/rfis/{rfi_id}
GET /rest/v1.0/projects/{project_id}/submittals?per_page=100&page=1
GET /rest/v1.0/projects/{project_id}/daily_construction_report_logs
GET /rest/v1.0/companies/{company_id}/users
GET /rest/v1.0/projects/{project_id}/users
```

#### Phase 3: Live Sync (Bidirectional for Transitioning Teams)

For GCs running both platforms in parallel during transition (typically 2-4 weeks). Changes in either system propagate to the other. This is the hardest phase and should only be built after Phase 2 is proven.

#### ID Mapping Table Design

```sql
CREATE TABLE migration_id_map (
  id              SERIAL PRIMARY KEY,
  migration_run   UUID NOT NULL,         -- groups records from one migration session
  entity_type     VARCHAR(50) NOT NULL,  -- 'rfi', 'submittal', 'project', 'user', etc.
  procore_id      INTEGER NOT NULL,
  procore_number  VARCHAR(100),          -- human-readable (e.g., RFI-042)
  sitesync_id     UUID,                  -- new system's ID (null until migrated)
  migrated_at     TIMESTAMPTZ,
  status          VARCHAR(20) DEFAULT 'pending'  -- 'pending', 'migrated', 'failed', 'skipped'
);

CREATE INDEX idx_migration_lookup ON migration_id_map(entity_type, procore_id);
CREATE INDEX idx_migration_reverse ON migration_id_map(entity_type, sitesync_id);
```

**Usage:** Before inserting a child record (e.g., an RFI response), look up the parent RFI's mapped `sitesync_id`. Cross-references (RFIs linked to drawings, submittals linked to specs) require all referenced entities to be migrated first.

#### Migration Order

Migrate in strict dependency order:

```
1. Projects
2. Users / Contacts (matched by email)
3. Specifications (spec sections)
4. Drawings
5. RFIs
6. RFI Responses
7. Submittals
8. Submittal Workflow / Responses
9. Daily Logs
10. Photos / Attachments (last — largest volume, most API calls)
```

#### Cutover Strategy

| Phase | Description |
|-------|-------------|
| **Phase 1 — Historical Migration** | Migrate all closed/completed records first (lower risk, no active changes) |
| **Phase 2 — Freeze Window** | GC stops making changes in Procore (typically Friday evening or weekend) |
| **Phase 3 — Delta Migration** | Migrate records changed/created since Phase 1 (use `updated_at` filter) |
| **Phase 4 — Cutover** | GC switches to SiteSync as primary system |
| **Phase 5 — Procore Read-Only** | Keep Procore access for 30-90 days as reference |

#### Attachment Handling

Procore stores files in AWS S3 and returns presigned URLs via the API. Migration pattern:

1. Fetch each record's attachment list from the API
2. Download each attachment (presigned URLs expire — fetch just-in-time, don't cache)
3. Re-upload to SiteSync's storage
4. Map new file URL/ID back to the migrated record
5. Implement retry with exponential backoff — downloads fail
6. Handle large files (drawings can be 100+ MB)
7. Deduplicate: some attachments appear on multiple records

---

### Implementation Plan

| Week | Deliverable | Details |
|------|-------------|---------|
| **1-2** | CSV import for RFIs | Build `DataMigration.tsx` page. CSV parser that accepts Procore RFI column headers. Field mapping UI (preview → confirm). Status mapping (4 Procore → 6 SiteSync). User matching by email. Import queue with progress bar. This is the minimum that proves the concept. |
| **3-4** | CSV import for Submittals + Daily Logs | Extend parser for submittal columns. Handle submittal revisions and package grouping. Daily log import from API JSON (PDF parsing is too lossy). |
| **5-6** | Procore API OAuth2 integration | Register SiteSync as a Procore App. Implement DMSA auth flow. Build rate-limit-aware HTTP client. Pagination helper. Token refresh logic. |
| **7-8** | Full API-based migration with progress UI | End-to-end: Projects → Users → Specs → RFIs → Responses → Submittals → Attachments. Progress dashboard showing record counts, success/fail/skip per entity type. Conflict resolution UI for duplicate detection. Verification report (Procore counts vs. SiteSync counts). |

**What to build in SiteSync:**

- **New page:** `DataMigration.tsx` — wizard-style UI: Choose Source (Procore) → Upload Files or Connect API → Map Fields → Preview → Import → Verify
- **Migration service:** `procore-migration.service.ts` — extraction, transform, load logic
- **Import queue:** Background job processor for large migrations (use existing job queue or add Bull/BullMQ)
- **Conflict resolution UI:** When a record already exists (by number or email), show side-by-side comparison and let user choose: skip, overwrite, or merge
- **ID mapping store:** `migration_id_map` table (schema above)

---

## Initiative 2: Certified Payroll / Davis-Bacon

### Why This Is an Unowned Vertical

**The market is enormous.** Davis-Bacon and its 71+ Related Acts cover approximately $217 billion in annual federal and federally-assisted construction spending — about 63% of all government construction. Every project over $2,000 that involves federal funds triggers prevailing wage requirements. The threshold is so low that virtually every federal construction contract is covered.

**It's growing fast.** The Inflation Reduction Act (IRA, 2022) and Infrastructure Investment and Jobs Act (IIJA, 2021) together authorized approximately $550 billion in new infrastructure spending over 5-10 years, most of it subject to prevailing wage requirements. This represents a massive expansion of the Davis-Bacon compliance market that is just beginning to flow into construction pipelines.

**No construction PM platform has real certified payroll.**

| Platform | Certified Payroll? | Reality |
|----------|-------------------|---------|
| Procore | No | Zero native CPR capability. GCs use standalone tools alongside Procore. |
| Autodesk Build | No | No prevailing wage features. |
| Fieldwire | No | Field management only. |
| Buildertrend | No | Residential focus; no federal compliance. |
| CMiC / Viewpoint | Partial | ERP-embedded; not accessible to PM-first users. Enterprise pricing. |

**Standalone tools are disconnected from PM workflows:**

| Tool | Annual Cost | Limitation |
|------|-----------|-----------|
| LCPtracker (LCPcertified) | $500–$7,400/year depending on project count | Standalone compliance platform — separate login, separate data entry. No connection to project schedules, daily logs, or sub management. |
| B2Gnow (eComply) | $2,932–$90,950/year based on construction volume | Government agency tool. Expensive. Complex. Not for mid-market GCs. |
| Elation Systems | Moderate (custom pricing) | Standalone compliance. No PM integration. |
| Foundation / Sage 300 | $500–$1,200/month + implementation | Full ERP — overkill for GCs who just need CPR on a few federal projects. 8-16 week implementation. |

**The opportunity:** Certified payroll integrated inside the PM tool means: time data from daily logs pre-populates the WH-347. Sub compliance status gates payment applications. Wage determinations are imported at project setup and monitored for changes. The GC's PM workflow and compliance workflow become one workflow. No competitor can match this because no competitor has both PM and certified payroll in the same product.

---

### Compliance Requirements (What We Must Get Right)

#### WH-347 Form Specification

Form WH-347 (OMB Control No. 1235-0008, Expires 01/31/2028) is the DOL's official weekly certified payroll form. Use is optional (contractors may use any form with equivalent content), but weekly submission of certified payroll data is mandatory under the Copeland Act (40 U.S.C. § 3145).

**Page 1: Payroll Report**

Header fields:
- Final DBRA Certified Payroll Checkbox (check if this is the last week on project)
- Prime Contractor / Subcontractor Checkbox
- Project Name
- Project No. or Contract No.
- Certified Payroll No. (sequential, starting at 1, every week regardless of work performed)
- Business Name (legal name of contractor/sub)
- Project Location (full address or at minimum county + state)
- Wage Determination No. (all WD numbers AND revision numbers for this pay period)
- Week Ending Date
- Business Address

Worker columns (1A–9):
- **1A:** Worker Entry No. (sequential; same number for all rows if worker did multiple classifications)
- **1B/C/D:** Last Name, First Name, Middle Initial
- **1E:** Worker Identifying No. (last 4 of SSN ONLY — full SSN must NOT be included)
- **2:** Journeyworker (J) or Registered Apprentice (RA, with progression level)
- **3:** Labor Classification (from wage determination, NOT job title — must reflect actual work performed)
- **4:** Hours Worked Each Day — Straight Time (ST) and Overtime (OT) per day
- **5:** Total Hours Worked for Week
- **6A:** Hourly Wage Rate for ST and OT (do NOT include cash fringe here)
- **6B:** Total Fringe Benefit Credit (hours × hourly fringe credit from Page 2 table)
- **6C:** Payment in Lieu of Fringe Benefits (cash-in-lieu — must be separate from base rate)
- **7A:** Gross Amount Earned (this project only)
- **7B:** Gross Amount Earned for ALL Work (all projects, including non-DBRA)
- **8:** Deductions — Tax Withholdings / FICA / Other / Total. "Other" requires description.
- **9:** Net Payment to Worker for All Work

**Critical classification rule:** If a worker performed multiple classifications in a week, the contractor MUST either (a) maintain accurate breakdown of hours by classification with separate rows, OR (b) pay ALL hours at the HIGHEST applicable prevailing wage rate.

**Page 2: Statement of Compliance**

6 certification checkboxes (Boxes 1, 2, 3, 6 always required; 4 and 5 if applicable):

| Box | Content | Required? |
|-----|---------|-----------|
| 1 | Workers paid full wages, no unauthorized deductions | Always |
| 2 | Payrolls correct and complete, wages meet WD rates, classification matches work | Always |
| 3 | Workers performing work in listed classification | Always |
| 4 | Apprentice program details (program name, OA or SAA, classification) | If apprentices employed |
| 5 | Fringe benefit credit details (per-plan hourly credit table) | If claiming fringe credit |
| 6 | Deductions comply with Copeland Act (29 CFR Part 3) | Always |

Signature block: Certifying Official name, title, signature, date, phone, email. The certifying official must be someone who paid or supervised payment of covered workers.

#### Weekly Filing Cadence

- CPR submitted weekly for every week in which DBRA-covered work is performed
- Certified Payroll Number increments every week regardless of whether work was performed
- Submit to: contracting agency (if federal party to contract) or applicant/sponsor/owner (on federally-assisted contracts)

#### GC Collects from Subs → GC Certifies to Owner/Agency

Under 29 CFR 5.5(a)(3)(ii)(A), the prime contractor is responsible for the submission of ALL certified payrolls by ALL subcontractors. The workflow:

| Step | Actor | Action |
|------|-------|--------|
| 1 | Field/timekeeping | Capture hours by worker, by classification, by project, by day (ST/OT) |
| 2 | Payroll processor | Run payroll ensuring base + fringe meets prevailing rate |
| 3 | Payroll processor | Generate WH-347 |
| 4 | Certifying official | Review and sign Statement of Compliance (valid e-signature) |
| 5 | Sub | Upload signed CPR to GC by deadline |
| 6 | GC | Review and approve/reject sub CPRs |
| 7 | GC | Submit own CPR + all approved sub CPRs to contracting agency |

**Payment hold leverage:** Most federal contracts allow the GC to withhold payment from subs until compliant CPRs are received.

#### The 2023 Final Rule Changes

The DOL's August 2023 Final Rule (effective October 23, 2023) made the first major Davis-Bacon overhaul in 40+ years:

1. **30% rule reinstated** — prevailing wage is the rate paid to at least 30% of workers (not just majority)
2. **Prime contractor strict liability** — GCs responsible for sub back wages regardless of intent
3. **Cross-contract withholding** — DOL can withhold across contractor's other federal contracts
4. **ECI escalation** — non-CBA rates updated every 3 years using Employment Cost Index
5. **Enhanced recordkeeping** — email addresses and phone numbers now required; explicit 3-year retention
6. **Electronic systems explicitly authorized** for CPR submission and retention

#### Records Retention

**3 years minimum after completion of all work on the prime contract.** If the prime contract runs 5 years and a sub finishes in year 1, that sub must keep records until year 8. If litigation or audit is initiated, records must be kept until resolution.

Required records: basic payroll (name, last 4 SSN, address, phone, email), classification records, compensation records, hours records (daily and weekly), deductions, actual wages paid, copy of every WH-347, signed Statements of Compliance, all contracts/subcontracts, applicable wage determinations.

#### Penalties

| Penalty Type | Amount |
|---|---|
| Back wages owed | No cap — full underpayment to all affected workers |
| Civil monetary penalties (per violation) | Up to **$13,508** per violation (2025, inflation-adjusted) |
| Liquidated damages | Up to amount equal to unpaid wages (can double liability) |
| Contract fund withholding | Agency can withhold payments until resolved |
| Debarment | Up to **3 years** from all federal contracting |
| Contract termination | For severe or repeated violations |
| Criminal penalties (falsified payrolls) | Under 18 U.S.C. § 1001: fine + up to **5 years imprisonment** |

Real-world examples: $180,000 penalty on a single federal highway project. $2.8 million to resolve violations across multiple highway projects (400+ workers). Combined federal + state penalties up to $85,000+ per incident.

---

### Prevailing Wage Rate Engine

#### SAM.gov API Integration

**Primary source:** SAM.gov is the official and only source for Davis-Bacon General Wage Determinations.

- API: `https://api.sam.gov` — REST API, free API key from SAM.gov
- Rate limits: Non-federal users without role: 10 requests/day. With SAM.gov role: 1,000/day. System accounts: up to 10,000/day (federal) or 1,000/day (non-federal).
- Data returned: WD number, revision number, state, county, construction type, classification list, base hourly rates, fringe benefit rates, modification history.

**Integration approach:**
1. On project creation, prompt user for state + county + construction type
2. Query SAM.gov API to retrieve applicable General Wage Determination
3. Parse classification list and rates into the project's wage table
4. Schedule daily check against WD revision numbers to detect modifications
5. On modification, notify PM/payroll admin to assess impact

#### Rate Structure

**Total prevailing wage = Basic Hourly Rate (BHR) + Fringe Benefit Rate**

Example:
```
Basic Hourly Rate:  $34.00
Fringe Benefits:    $21.00
Total Prevailing:   $55.00
```

A contractor may satisfy the $55.00 obligation in multiple ways:
- $55.00 all in cash wages
- $34.00 cash + $21.00 in bona fide fringe contributions
- $32.00 cash + $23.00 in bona fide fringe (excess cash above BHR offsets fringe requirement)

**What counts as bona fide fringe:** Health insurance, pension, life insurance, disability insurance, vacation/holiday pay (if contributed to a bona fide fund), apprenticeship training fund contributions.

**What does NOT count:** Workers' comp, FICA, state unemployment taxes — any amount required by law.

**Annualization rule:** Fringe credits must be annualized across ALL hours worked (DBA and non-DBA), not just covered project hours. This prevents double-counting fringes from private work.

```
Hourly Fringe Credit = Total Annual Plan Cost ÷ Total Hours Worked by All Workers in That Classification
```

#### Four Construction Categories

Wage determinations are organized by construction type. Each has its own classification system:

| Category | Example Trades |
|----------|---------------|
| **Building** | Carpenters, electricians, plumbers, ironworkers, operating engineers, laborers, painters, sheet metal, masons, elevator constructors, glaziers, roofers |
| **Residential** | Carpenters, electricians, plumbers, HVAC technicians, roofers |
| **Heavy** (dams, tunnels, power plants) | Ironworkers, operating engineers (crane, heavy lift), demolition workers |
| **Highway** | Laborers, operating engineers, truck drivers (by type/capacity), equipment operators (paving, grading) |

**Critical:** There is no universal classification list. Classifications come exclusively from the project's applicable wage determination for its county, state, and construction type.

#### Rate Change Monitoring (90-Day Lock-In Rule)

- For new contracts: rate is locked at bid opening. Modifications published within 90 days of bid opening should be reviewed.
- For multi-year contracts: contracting agency must incorporate current WD on each anniversary date.
- Software must track: WD number + revision number per project. Alert when SAM.gov shows a newer revision than what's locked in the project.

#### State Prevailing Wage Overlay

26 states + DC have active prevailing wage laws. On projects with both federal and state funding, contractors must compare rates and **pay whichever is higher** for each classification. Key complexity states:

| State | Threshold | Special Requirements |
|-------|-----------|---------------------|
| California | $1,000 | Mandatory eCPR electronic submission to DIR in XML format. DIR registration required. |
| New York | None (all public works) | Mandatory electronic submission through NYSDOL starting Jan 1, 2026. |
| Washington | None (all public works) | L&I XML format required. |
| Illinois | None (all public works) | — |
| Massachusetts | None (all public works) | — |

Software must handle: import of both federal and state wage determinations for the same project, classification mapping between systems, rate comparison with "pay higher" enforcement, generation of both WH-347 and state-specific forms.

---

### WH-347 Generation

#### PDF Generation Requirements

- Page 1: Payroll data table (header + worker rows). Support multiple workers per page (standard form fits ~8 worker rows). Overflow to additional pages with header repeated.
- Page 2: Statement of Compliance with 6 certification checkboxes, Hourly Credit for Fringe Benefits table (if Box 5 checked), Additional Remarks section, and signature block.
- Output: PDF/A for archival compliance. Print-ready layout matching official DOL form.

#### E-Signature Support

Electronic signatures are legally valid per DOL guidance (codified in 2023 Final Rule). Authority: E-SIGN Act, GPEA.

Requirements for valid e-signature:
1. Electronic process indicating acceptance of the certified payroll record
2. Electronic method of verifying the signer's identity
3. NOT a photocopy or scan of a handwritten signature

**Implementation:** Require a separate e-signature PIN/credential from the login password (similar to LCPtracker). When certifying, user enters their e-signature credential — this constitutes legally valid electronic acceptance.

#### Common Rejection Errors to Validate Against

Build a pre-submission validation engine that catches these before the CPR is submitted:

| # | Error | Validation Rule |
|---|-------|----------------|
| 1 | Worker misclassification | Classification must match wage determination, not internal job title |
| 2 | Incomplete fringe benefit documentation | If Box 5 checked, Hourly Credit table must be complete |
| 3 | Missing/incorrect WD number | Validate WD number + revision against project's locked WD |
| 4 | No multi-classification split | If worker did 2+ trades in a week, separate rows required |
| 5 | Full SSN included | Only last 4 digits permitted — reject if >4 digits detected |
| 6 | Scanned/photocopied signature | Flag if uploaded image rather than proper e-signature flow |
| 7 | Incorrect payroll number sequence | No gaps, no restarts |
| 8 | Deductions not itemized | "Other" deductions require description/addendum |
| 9 | Missing all-work gross | Column 7B requires gross from ALL work, not just this project |
| 10 | Apprentice rate without Box 4 | Must confirm DOL/SAA registration |
| 11 | Cash-in-lieu embedded in base rate | Column 6C must be populated separately |
| 12 | Missing "Final Payroll" checkbox | Flag on last submission for project |

---

### Architecture

#### New Database Tables

> **Note:** Some of these tables may already exist in the SiteSync schema. Merge rather than duplicate.

```sql
-- Wage determinations imported from SAM.gov
CREATE TABLE prevailing_wage_determinations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id),
  wd_number           VARCHAR(50) NOT NULL,    -- e.g., "NC20240005"
  wd_revision         INTEGER NOT NULL,        -- e.g., 2
  state               VARCHAR(2) NOT NULL,
  county              VARCHAR(100) NOT NULL,
  construction_type   VARCHAR(20) NOT NULL,    -- building/residential/heavy/highway
  source              VARCHAR(20) DEFAULT 'federal', -- 'federal' or state name
  effective_date      DATE NOT NULL,
  locked_at_bid       BOOLEAN DEFAULT FALSE,
  raw_data            JSONB,                   -- full WD as returned by SAM.gov
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Classification rates within a wage determination
CREATE TABLE wd_classification_rates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wd_id               UUID NOT NULL REFERENCES prevailing_wage_determinations(id),
  classification_name VARCHAR(200) NOT NULL,   -- e.g., "ELEC0003-005 06/01/2024"
  trade_group         VARCHAR(100),            -- e.g., "Electrician"
  base_hourly_rate    DECIMAL(10,2) NOT NULL,
  fringe_rate         DECIMAL(10,2) NOT NULL,
  total_rate          DECIMAL(10,2) GENERATED ALWAYS AS (base_hourly_rate + fringe_rate) STORED,
  notes               TEXT
);

-- Weekly certified payroll reports
CREATE TABLE certified_payroll_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  contractor_id       UUID NOT NULL REFERENCES companies(id), -- GC or sub
  is_prime            BOOLEAN NOT NULL,
  payroll_number      INTEGER NOT NULL,         -- sequential, never gaps
  week_ending_date    DATE NOT NULL,
  wd_numbers          TEXT[] NOT NULL,          -- all applicable WD numbers for this period
  is_final            BOOLEAN DEFAULT FALSE,
  status              VARCHAR(20) DEFAULT 'draft', -- draft/submitted/approved/rejected/revised
  certified_by        UUID REFERENCES users(id),
  certified_at        TIMESTAMPTZ,
  signature_token     VARCHAR(100),             -- e-signature verification
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, contractor_id, payroll_number)
);

-- Individual worker entries on a CPR
CREATE TABLE certified_payroll_employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID NOT NULL REFERENCES certified_payroll_reports(id),
  entry_number        INTEGER NOT NULL,        -- Column 1A
  last_name           VARCHAR(100) NOT NULL,
  first_name          VARCHAR(100) NOT NULL,
  middle_initial      VARCHAR(1),
  worker_id_last4     VARCHAR(4) NOT NULL,     -- last 4 SSN only
  is_apprentice       BOOLEAN DEFAULT FALSE,   -- J or RA
  apprentice_level    VARCHAR(50),             -- progression level if RA
  apprentice_program  VARCHAR(200),            -- program name if RA
  apprentice_body     VARCHAR(5),              -- 'OA' or 'SAA'
  classification      VARCHAR(200) NOT NULL,   -- from wage determination
  wd_classification_id UUID REFERENCES wd_classification_rates(id)
);

-- Hours and pay per worker per classification
CREATE TABLE payroll_line_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES certified_payroll_employees(id),
  day_of_week         INTEGER NOT NULL,        -- 1-7
  date                DATE NOT NULL,
  st_hours            DECIMAL(5,2) DEFAULT 0,  -- straight time
  ot_hours            DECIMAL(5,2) DEFAULT 0,  -- overtime
  hourly_rate_st      DECIMAL(10,2) NOT NULL,  -- Column 6A top
  hourly_rate_ot      DECIMAL(10,2) NOT NULL,  -- Column 6A bottom
  fringe_credit       DECIMAL(10,2) DEFAULT 0, -- Column 6B
  cash_in_lieu        DECIMAL(10,2) DEFAULT 0, -- Column 6C
  gross_this_project  DECIMAL(10,2),           -- Column 7A
  gross_all_work      DECIMAL(10,2),           -- Column 7B
  deductions_tax      DECIMAL(10,2) DEFAULT 0,
  deductions_fica     DECIMAL(10,2) DEFAULT 0,
  deductions_other    DECIMAL(10,2) DEFAULT 0,
  deductions_other_desc TEXT,
  net_pay             DECIMAL(10,2)            -- Column 9
);

-- Fringe benefit plans per employee (for Box 5 / Page 2 table)
CREATE TABLE employee_fringe_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES certified_payroll_employees(id),
  plan_name           VARCHAR(200) NOT NULL,
  plan_type           VARCHAR(50),             -- health, pension, vacation, etc.
  plan_number         VARCHAR(50),
  is_funded           BOOLEAN DEFAULT TRUE,
  hourly_amount       DECIMAL(10,2) NOT NULL
);
```

#### SAM.gov Integration Service

```
procore-migration.service.ts    → already planned
sam-gov.service.ts              → NEW: wage determination lookup + caching
wh347-generator.service.ts     → NEW: PDF generation from CPR data
payroll-validation.service.ts  → NEW: pre-submission validation engine
payroll-collection.service.ts  → NEW: sub CPR collection workflow
```

#### Sub Payroll Collection Workflow

1. GC creates project → marks as Davis-Bacon covered → enters WD numbers
2. System imports classifications and rates from SAM.gov
3. GC invites subs → subs receive notification: "Weekly certified payroll required on this project"
4. Each week, sub enters payroll data (or uploads from their payroll system)
5. System validates against WD rates, flags errors
6. Sub certifies with e-signature
7. GC reviews all sub CPRs in a dashboard → approves or rejects with comments
8. GC submits own CPR + approved sub CPRs to agency (export as PDF bundle or integrate with agency portal)

#### GC Review and Certification Workflow

The GC dashboard shows:

```
PROJECT: Highway 42 Bridge Replacement
Week Ending: 2025-07-12

| Sub Company          | CPR # | Status     | Workers | Issues | Action     |
|---------------------|-------|------------|---------|--------|------------|
| Smith Concrete LLC   | 14    | Submitted  | 8       | 0      | [Review]   |
| Valley Electric Inc  | 14    | Submitted  | 12      | 2 ⚠️   | [Review]   |
| Iron Works Co        | 14    | Missing    | —       | —      | [Remind]   |
| [Your Company]       | 14    | Draft      | 15      | 0      | [Complete] |
```

Issues flagged: "Worker #3 classification 'Helper' not found in WD NC20240005/2 — did you mean 'Laborer, Common'?"

---

### Implementation Plan

| Month | Deliverable |
|-------|-------------|
| **Month 1** | **Prevailing wage rate lookup + basic payroll data entry.** SAM.gov API integration (query by state/county/type, parse WD, import classifications + rates). Project-level "Davis-Bacon Covered" toggle that triggers WD import. Basic payroll data entry form: worker info, classification selection (dropdown from imported WD), daily hours (ST/OT), rates (auto-populated from WD). Store in `certified_payroll_reports` + `certified_payroll_employees` + `payroll_line_items` tables. |
| **Month 2** | **WH-347 PDF generation + sub payroll collection.** PDF generator that produces compliant Page 1 + Page 2 from stored data. E-signature flow for Statement of Compliance. Sub-facing payroll entry (sub logs in → enters their payroll → certifies → submits to GC). GC notification when sub CPRs arrive. |
| **Month 3** | **GC certification workflow + compliance validation + state overlay.** GC review dashboard (all subs, all weeks, approve/reject). Pre-submission validation engine (12+ checks from the rejection errors table). State prevailing wage import for overlay states. Rate comparison logic (federal vs. state, pay higher). |
| **Month 4** | **Apprentice handling + fringe benefit calculations + audit export.** Apprentice rate tracking with ratio monitoring (alert if ratio exceeded). Fringe benefit annualization calculator. Per-plan hourly credit computation for Page 2. One-click audit export (all CPRs + WDs + contracts for a project, organized by contractor and week). Daily log vs. CPR cross-check (compare manpower counts in daily logs against CPR worker entries). |

---

## Initiative 3: Sub Portal with Free Tier

### Why This Creates an Unbreakable Moat

**The viral math.** A single GC project involves 15-40 subcontractor companies. Each sub company works for 3-8 different GCs. The exponential reach is staggering:

```
1 GC customer → 20 subs per project → each sub works for 5 GCs
= 100 GCs exposed to the platform per initial GC customer
```

**Procore's critical flaw: sub identity is siloed per GC.** If Jack Smith from ABC Concrete works with GC Gold and GC Silver (both Procore customers), he exists as two separate user records in two separate GC accounts. There is no unified sub identity across GC accounts. This means subs lose their performance history, project records, and professional identity every time a GC relationship ends or a project closes.

**BuildingConnected proved the model.** BuildingConnected built a cross-GC sub identity for preconstruction (bidding). One login sees invitations from ALL GCs. 700,000+ subs. Free for subs. Autodesk paid over $275M to acquire it. The critical architectural decision: subs have platform-level accounts, not GC-scoped accounts.

**The data moat.** Every sub interaction generates data that makes the platform more valuable:

| Data Type | Source | Value Created |
|-----------|--------|---------------|
| RFI response times | RFI workflow | Sub performance scoring |
| Submittal approval rates | Submittal workflow | Quality reputation signal |
| Defect/punch list rates | Punch list completions | Field quality indicator |
| Schedule adherence | Project schedule vs. actuals | Reliability scoring |
| Pay app submission timing | Invoice workflow | Professionalism signal |
| Repeat hire rate | Project membership history | Trust signal (GC hired them again) |
| Pricing patterns (anonymized) | Subcontract values | Market rate benchmarking |

After 12-18 months of accumulation, this data supports a Sub Performance Score that no competitor can replicate — because no competitor has cross-GC sub data.

---

### What's Free for Subs (The Viral Features)

These features are permanently free because they drive viral adoption, generate data, and create switching costs:

**Read access (always free):**

| Feature | Rationale |
|---------|-----------|
| Read-only project access (plans, specs, drawings) | Core value prop; "all the prints in my pocket" is the #1 sub use case |
| RFI viewing | Subs need to see their open/closed RFIs |
| Submittal status viewing | Track approval status |
| Schedule viewing | Know when their work is due |
| Daily log viewing (GC logs) | Contextual awareness of project status |
| Punch list viewing (items assigned to them) | Know what needs fixing |
| Photo viewing | Project progress documentation |
| Payment application status | "When was my pay app approved?" |
| Project archive after close | **Key differentiator vs. Procore** — Procore deletes sub access at project close |

**Write access (also free — gating this kills the viral loop):**

| Feature | Rationale |
|---------|-----------|
| **RFI creation** | CRITICAL. Subs MUST be able to create RFIs to do their job. Gating this pushes subs back to email and kills GC adoption. |
| Submittal uploads | Workflow-critical for the GC; subs contribute data |
| Daily log creation (their own logs) | Subs own their field notes; generates data |
| Photo uploads | Documentation; zero marginal cost |
| Punch list item responses | Respond to items assigned to them |
| Pay app submission | Gate this and you'll never get sub adoption |

**The critical design principle:** The biggest mistake competing platforms make is charging subs to create RFIs and submittals. This destroys the viral loop: GC mandates platform → sub hits paywall → sub goes back to email → GC gets no adoption benefit → GC churns.

---

### What's Paid

**GC tiers (per-project pricing):**

| Tier | Price | Includes |
|------|-------|---------|
| GC Starter | $299/month | 3 active projects, all core features, unlimited users + subs, 10GB storage |
| GC Professional | $699/month | 10 projects, financial management, certified payroll, Procore import, sub performance analytics, 100GB, API access |
| GC Enterprise | $1,499+/month | Unlimited projects, custom ERP integrations, AI features, white-label sub portal, SSO, unlimited storage |

**Sub Pro (optional, not required):**

| Tier | Price | Includes |
|------|-------|---------|
| Sub Pro | $49/month per company | Create own projects, advanced reporting, Verified Performance Score badge, priority integrations |

**The Sub Pro tier is never required.** A sub can use the platform forever for free. Sub Pro is for specialty contractors who want to actively market their performance record to new GCs.

---

### RLS Architecture for Sub Access

#### Role: 'subcontractor' in project_members

SiteSync's kernel already has the concept of project membership. The sub portal adds:

```sql
-- Platform-level identity (users are NOT tenant-scoped)
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  -- NO tenant_id — users are platform-level (cross-GC identity)
);

-- Companies are also platform-level
CREATE TABLE companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  platform_claimed BOOLEAN DEFAULT FALSE -- has sub claimed this company profile?
  -- NO tenant_id — companies are platform-level
);

-- Project membership creates the GC-scoped context
CREATE TABLE project_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  company_id    UUID NOT NULL REFERENCES companies(id),
  role          TEXT NOT NULL CHECK (role IN ('gc_admin', 'gc_pm', 'gc_super', 'subcontractor', 'owner_rep', 'invoice_contact')),
  trade_scopes  TEXT[],        -- optional CSI divisions, e.g., ['16', '26', '28']
  access_level  TEXT NOT NULL DEFAULT 'standard' CHECK (access_level IN ('read_only', 'standard', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### RLS Policies

```sql
-- Subcontractor gets SELECT on most tables, scoped to their project + company
CREATE POLICY sub_rfi_read ON rfis
FOR SELECT
USING (
  tenant_id = current_setting('app.current_tenant')::uuid
  AND project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user')::uuid
  )
  AND (
    -- GC roles see everything
    current_setting('app.current_role') IN ('gc_admin', 'gc_pm', 'gc_super')
    OR
    -- Subs see own company's RFIs or project-wide RFIs
    (
      current_setting('app.current_role') = 'subcontractor'
      AND (
        responsible_company_id = current_setting('app.current_company')::uuid
        OR visibility = 'project_wide'
      )
    )
  )
);

-- Sub INSERT on rfis (can create RFIs)
CREATE POLICY sub_rfi_create ON rfis
FOR INSERT
WITH CHECK (
  current_setting('app.current_role') IN ('gc_admin', 'gc_pm', 'gc_super', 'subcontractor')
  AND project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user')::uuid
  )
);

-- Financial isolation: subs NEVER see budgets, other subs' contracts
CREATE POLICY no_sub_financials ON budget_line_items
USING (
  current_setting('app.current_role') NOT IN ('subcontractor', 'invoice_contact')
);
```

#### Three Access Models (configurable per project)

| Model | Description | Best For |
|-------|-------------|----------|
| **A: Whole-Project** | Sub sees ALL RFIs, submittals, daily logs | Small/simple projects |
| **B: Company-Scoped** (default) | Sub sees only items where `responsible_company_id = their company` OR `visibility = 'project_wide'` | Most projects |
| **C: Trade/Spec-Section Scoped** | Sub sees items tagged to their CSI division(s) | Large, complex projects |

**Recommendation:** Implement Model B as default, Model C as opt-in, Model A as project-level setting.

#### Cross-GC Identity

This is the key architectural decision that differentiates SiteSync from Procore:

- Users are **platform-level** (one account, one email, sees ALL projects across ALL GCs)
- Companies are **platform-level** (one company record, claimed by the sub)
- Project memberships are **project-level** (scoped to specific GC's project)
- RLS uses `tenant_id` to scope GC-specific data while user/company records are global

A sub logs in → sees "My Projects" dashboard → lists active projects from GC Alpha, GC Beta, GC Gamma → each project's data is isolated by RLS but accessible from one login.

#### Performance Considerations

- Index `tenant_id`, `project_id`, `company_id`, `user_id` on every RLS-enabled table
- Use `SET LOCAL` (not `SET`) for session variables in transactions — prevents context leakage in connection pooling
- Avoid table joins in RLS predicates where possible — inline lookups or use session variables
- Do NOT use pgBouncer in transaction mode with session-variable RLS — use per-session pooling
- Test with 100k+ rows per table in CI

---

### The Onboarding Flow

**Critical principle:** First login must deliver value in under 3 minutes. Any friction here kills the viral loop.

```
STEP 1: EMAIL INVITATION (sent by GC admin)
Subject: "[GC Company] invited you to [Project Name] on SiteSync"
Body:
  - Project name + location + GC PM contact info
  - What they can do: "View plans, submit RFIs, track payments"
  - ONE big CTA button: "Accept Invitation & Set Up Your Account"
  - Magic link (token-based, 7-day expiry, auto-resend at day 3)

STEP 2: CLICK MAGIC LINK → PASSWORD SETUP (30 seconds)
  - Set password (or Google/Microsoft SSO)
  - Confirm company name (pre-filled from GC's invite)
  - Optional: add phone for SMS notifications
  - NO multi-step wizard. NO feature tour. Get to value.

STEP 3: FIRST-TIME SUB DASHBOARD (immediate value)
  - Banner: "Welcome to [Project Name]. Here's what's waiting for you:"
  - Card 1: "3 Open RFIs — you're the ball-in-court" [action button]
  - Card 2: "New drawings uploaded 2 days ago" [action button]
  - Card 3: "Your pay app is due in 5 days" [action button]
  - Big CTA: "View Plans" (most universally valuable first action)

STEP 4: PLAN VIEWER (within 2 minutes of invitation)
  - Opens most recent drawing set
  - Pinch to zoom, tap to annotate
  - "This is the pull moment" — sub realizes the value

STEP 5: FOLLOW-UP (Day 3, if no RFI submitted)
  Subject: "Quick tip: Submit your first RFI in SiteSync"
  - 30-second GIF walkthrough
  - Link back to open RFIs
```

**Sub profile persists across projects and GCs.** When the same sub is invited to a second project (same or different GC), they get a notification: "You've been added to [New Project]." No password setup. No re-onboarding. They click → see the new project in their dashboard alongside existing ones.

---

### Implementation Plan

| Timeframe | Deliverable |
|-----------|-------------|
| **Week 1-2** | **Sub invitation flow.** GC enters sub email + company + role → system sends branded invitation email → magic link → password setup → project dashboard. Mobile-responsive. This is the 2-week MVP that creates the viral loop. |
| **Week 3-4** | **Sub-scoped RLS policies + read-only project views.** Implement `subcontractor` role in `project_members`. RLS policies for SELECT on rfis, submittals, daily_logs, documents, schedule. Company-scoped visibility (Model B). Financial table isolation. |
| **Week 5-6** | **Sub RFI creation + submittal upload.** INSERT policies for RFIs and submittals. Simple form: title, description, photo attachments. Ball-in-court notification to GC when sub creates RFI. Submittal upload with file attachment. |
| **Week 7-8** | **Cross-GC sub dashboard + persistent profile.** "My Projects" view showing all active projects across all GCs. Sub company profile page (trades, geography, claimed status). Project archive: data remains accessible after project close. |
| **Month 3** | **Sub performance tracking + pay app submission.** Begin collecting performance metrics (RFI response times, submittal cycle times, punch list close rates). Store silently — don't expose yet. AIA-format pay app submission with schedule of values. |
| **Month 4** | **Sub Pro tier + performance badge.** Optional $49/month upgrade. Verified Performance Score computed from cross-GC metrics. Shareable badge/link for sub to include in bids. Analytics dashboard for Sub Pro users. |

---

## The Flywheel

The complete strategic flywheel, step by step:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. PROCORE MIGRATION TOOL gets GCs to switch                  │
│     → Eliminates the switching cost barrier                     │
│     → "Bring your entire project history. Nothing is lost."    │
│                                                                 │
│          ↓                                                      │
│                                                                 │
│  2. Each GC project INVITES 15-40 SUBS                         │
│     → Viral adoption via sub portal                             │
│     → Sub gets free access with magic link in 2 minutes        │
│                                                                 │
│          ↓                                                      │
│                                                                 │
│  3. Subs get CROSS-GC PROFILES they actually own               │
│     → Better than Procore: data persists after project close   │
│     → One login, all projects, all GCs                          │
│     → Subs become advocates: "Do you use SiteSync?"            │
│                                                                 │
│          ↓                                                      │
│                                                                 │
│  4. SUB PERFORMANCE DATA ACCUMULATES                            │
│     → RFI response times, defect rates, schedule adherence     │
│     → Cross-GC data that no single GC could have alone         │
│     → Data moat deepens with every project                      │
│                                                                 │
│          ↓                                                      │
│                                                                 │
│  5. Government project GCs need CERTIFIED PAYROLL              │
│     → $217B/year in Davis-Bacon covered construction            │
│     → Integrated CPR = no competitor can match                  │
│     → Compliance dependency = enormous switching cost            │
│                                                                 │
│          ↓                                                      │
│                                                                 │
│  6. MORE GCs attract MORE SUBS, more subs attract more GCs     │
│     → Network effect compounds                                  │
│     → Each new GC brings 15-40 new subs into the ecosystem     │
│     → Each new sub advocates to 3-8 additional GCs             │
│                                                                 │
│          ↓                                                      │
│                                                                 │
│  7. Certified payroll data + sub performance data =             │
│     UNMATCHED CONSTRUCTION INTELLIGENCE PLATFORM               │
│     → Verified performance scores                               │
│     → Market rate benchmarking                                  │
│     → Workforce capacity insights                               │
│     → No competitor has this data because no competitor         │
│       has PM + certified payroll + cross-GC sub identity        │
│                                                                 │
│          ↓ (loops back to 1)                                    │
│                                                                 │
│  More intelligence → more GC value → more GCs switch →         │
│  more subs exposed → more data → stronger moat                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The viral coefficient formula:
```
K = (avg subs per GC project) × (% who adopt) × (% who advocate) × (% advocacy that converts)
  = 20 × 0.70 × 0.25 × 0.12
  = K ≈ 0.42 per project per quarter
```

At K < 1, the flywheel needs marketing to sustain. But each additional initiative (migration tool reducing friction, certified payroll increasing lock-in, permanent data increasing advocacy rate) pushes K higher. The goal is to push the advocacy conversion rate from 12% toward 20%+ by giving subs a genuinely better experience than Procore — which no other competitor does.

---

## Pricing Strategy

### Tier Comparison

| Tier | Price | Includes |
|------|-------|---------|
| **Sub Free** | $0 | Read-only project access, RFI creation, submittal upload, daily log creation, photo upload, punch list response, pay app submission, cross-GC dashboard, project archive after close |
| **Sub Pro** | $49/month | Own project creation, Verified Performance Score badge, analytics dashboard, priority integrations |
| **GC Free** | $0 | 1 active project, core features (plans, RFIs, submittals, daily logs), unlimited subs, 2GB storage, "Powered by SiteSync" branding |
| **GC Starter** | $299/month | 3 active projects, all core features, unlimited users + subs, 10GB storage |
| **GC Professional** | $699/month | 10 projects, financial management, certified payroll, Procore import, sub performance analytics, 100GB, API access |
| **GC Enterprise** | $1,499+/month | Unlimited projects, custom ERP integrations, AI features, white-label, SSO, unlimited storage, dedicated support |

### Comparison to Procore Pricing

Procore uses Annual Construction Volume (ACV) pricing:

| GC Size (ACV) | Procore Annual Cost | SiteSync Annual Cost | Savings |
|------|-----|-----|-----|
| $10M | ~$15,000/year | $3,588/year (Starter) | **~76%** |
| $50M | ~$45,000/year | $8,388/year (Professional) | **~81%** |
| $100M | ~$80,000/year | $17,988/year (Enterprise) | **~78%** |
| $500M+ | ~$250,000/year | Custom ($50-100K/year) | **~60-80%** |

Additionally, Procore charges per-module add-ons ($2,400-$12,000/year each for Financials, Quality & Safety, Field Productivity, Preconstruction, Analytics). SiteSync bundles these into tier pricing.

**Competitive messages:**
- "Procore for GCs under $100M ACV is like buying a 747 to fly to the grocery store."
- "Same unlimited-users model, 80% less cost, 100% of what mid-market GCs actually use."
- "Your subs prefer working with us — they actually own their data."

---

## Priority Order

### 1. Sub Portal (Build First)

**Why first:** The sub portal creates the network effect that makes everything else work. Without subs on the platform, GCs have no reason to switch from Procore. The 2-week MVP (invitation flow → plan viewer → RFI creation) is the minimum that starts the viral loop.

**The math:** One GC signing up without a sub portal = one customer. One GC signing up with a sub portal = one customer + 20 subs exposed to SiteSync + those subs mentioning SiteSync to their other GCs. The sub portal transforms every sale into a viral event.

**Timeline:** 2-week MVP, 2-month full feature set, ongoing iteration.

### 2. Procore Migration Tool (Build Second)

**Why second:** Once subs are on the platform and GCs see value, the migration tool eliminates the last switching barrier. The GC who says "I'd switch but I have 3 years of RFI history in Procore" now has an answer. Start with CSV import (2 weeks of engineering, works without any API dependency, covers the majority of use cases).

**The sequence matters:** If you build the migration tool first but have no sub portal, GCs migrate their data but their subs refuse to adopt (because there's no sub value). You get data-complete projects with zero engagement. Build the sub experience first so that when GCs migrate, their subs are already onboard or have a compelling reason to join.

**Timeline:** Weeks 1-2 for CSV import MVP. Weeks 5-8 for full API-based migration.

### 3. Certified Payroll (Build Third)

**Why third:** This is the lock-in play. Once a GC is using SiteSync for project management AND certified payroll, the switching cost becomes enormous — they'd have to rebuild their entire compliance workflow. This is also the highest-margin feature (compliance software commands premium pricing) and the one no construction PM competitor has.

**Why not first:** Certified payroll is only relevant to GCs on federal projects. The sub portal and migration tool serve ALL GCs regardless of project type. Building the broadest-appeal features first maximizes the addressable market for initial traction.

**The compounding effect:** A GC using SiteSync for PM has moderate switching costs. A GC using SiteSync for PM + sub management has high switching costs (their sub network is here). A GC using SiteSync for PM + sub management + certified payroll has prohibitive switching costs (their compliance history, their sub compliance collection workflow, their wage determination records, and their audit trail are all in SiteSync).

**Timeline:** 4 months from start to full feature set. Can begin after sub portal and migration tool Phase 1 are shipped.

---

## Risk Analysis

### Risk 1: Procore API Access Revocation

**Threat:** Procore could restrict or revoke API access for applications that facilitate migration away from their platform.

**Probability:** Medium. Procore has an open developer program, but they control the approval process and could reject or revoke an app that explicitly markets "leave Procore."

**Mitigation:**
- **CSV import works without any API dependency.** Phase 1 is completely independent of Procore's API. GCs export their own data from the Procore UI and upload to SiteSync. Procore cannot prevent this.
- Position the API tool as "integration" not "migration" in the Procore App Marketplace listing.
- Build the CSV path first and ensure it's robust enough to be the primary method.
- If API access is revoked, the CSV path still works. The tool becomes "upload your Procore exports" rather than "connect your Procore account."

### Risk 2: Davis-Bacon Compliance Liability

**Threat:** Incorrect payroll calculations are a legal risk. If SiteSync's certified payroll feature generates a WH-347 with wrong rates or missing data, the GC faces penalties. If the GC blames SiteSync, there's reputational and potentially legal exposure.

**Probability:** Medium. The compliance domain is complex (multi-classification workers, fringe annualization, state overlays).

**Mitigation:**
- **"Tools, not legal advice" disclaimer.** SiteSync provides payroll generation tools; the certifying official is legally responsible for the accuracy of the Statement of Compliance they sign.
- **Validation engine catches errors before submission.** The 12+ automated checks (classification matching, rate verification, apprentice ratio monitoring, etc.) reduce error rates dramatically vs. manual entry.
- **Partnership with compliance consultants.** Offer a "compliance review" service tier where a compliance professional reviews CPRs before submission (can be a channel partner like an LCPtracker consultant).
- **Audit trail.** Every CPR, every change, every signature is logged with timestamps. If a dispute arises, the audit trail shows exactly what was entered, by whom, and when.
- **SAM.gov as source of truth.** Rates come directly from the official federal source, not from manual entry. This removes a major error vector.

### Risk 3: Sub Adoption Resistance

**Threat:** Subs hate new tools. They already juggle Procore, PlanGrid, email, text messages, ISNetworld, and their own accounting software. Another platform login is friction.

**Probability:** High. This is the biggest operational risk.

**Mitigation:**
- **Mobile-first design.** Subs live on their phones. Plan viewer, RFI creation, and photo upload must work perfectly on mobile. If the mobile experience is better than Procore (which is designed for desktop GC project managers), subs will prefer SiteSync.
- **Zero training needed.** The 2-minute onboarding flow (magic link → plans → RFIs) requires no training session. If a sub can use a web browser, they can use SiteSync.
- **Permanent data they own.** This is the differentiator that converts compliance into advocacy. When a sub realizes their project history, RFI records, and photos persist after the project closes — and that they can show this record to their next GC — they have a reason to prefer SiteSync.
- **Don't require the app for everything.** Email notifications with deep links into the right context (e.g., "RFI #42 needs your response" → click → lands on RFI #42 in SiteSync) minimize the cognitive overhead of "another app to check."

### Risk 4: Market Timing

**Threat:** Procore has 17,500+ customers and 2M+ users. Breaking through is hard even with better features.

**Probability:** High (difficulty), but the mid-market is genuinely underserved.

**Mitigation:**
- Target the mid-market first ($20M-$150M ACV GCs). Procore's pricing model has abandoned this segment.
- Lead with price + sub experience: "80% cheaper, and your subs actually like it."
- Government/prevailing wage GCs are a natural niche: they need certified payroll AND project management, and no one offers both. This is a beachhead where SiteSync has zero direct competition.

### Risk 5: Engineering Capacity

**Threat:** Three major initiatives is a lot of engineering for what is likely a small team.

**Probability:** High.

**Mitigation:**
- The priority order (sub portal → migration tool → certified payroll) means each initiative builds on the last. You're never building three things at once.
- Sub portal 2-week MVP is genuinely achievable with 1-2 developers.
- CSV migration import is straightforward (parser + field mapper + import queue).
- Certified payroll is the heaviest lift but is also the last priority — by the time you start it, the team has shipped two features and understands the product better.

---

## Appendix: Quick Reference URLs

| Resource | URL |
|----------|-----|
| Procore Developer Portal | https://developers.procore.com |
| Procore API Rate Limiting | https://procore.github.io/documentation/rate-limiting |
| Procore OAuth Documentation | https://procore.github.io/documentation/oauth-choose-grant-type |
| DOL Davis-Bacon Home | https://www.dol.gov/agencies/whd/government-contracts/construction |
| WH-347 Form & Instructions | https://www.dol.gov/agencies/whd/forms/wh347 |
| WH-347 Online Fillable Form | https://www.dol.gov/agencies/whd/forms/wh347-web |
| SAM.gov Wage Determinations | https://sam.gov/wage-determinations |
| SAM.gov API | https://api.sam.gov |
| State Prevailing Wage Thresholds (DOL) | https://www.dol.gov/agencies/whd/state/prevailing-wages |
| LCPtracker (market leader, competitive reference) | https://lcptracker.com |
| Procore Construction Network | https://www.procore.com/network |
| BuildingConnected (cross-GC sub model reference) | https://www.buildingconnected.com |

---

*This document synthesizes research from Procore official support documentation, Procore Developer Portal, DOL Wage and Hour Division guidance, SAM.gov, Federal Register, FHWA, industry publications (Downtobid, SubmittalLink, Constructable, Muro AI), competitor documentation (LCPtracker, BuildingConnected, Fieldwire, GCPay, Oracle Textura), and community sources (Reddit r/Construction, r/MEPEngineering). All sources cited in the underlying research files.*
