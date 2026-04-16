# Procore Migration Research
## Deep Technical Reference for Building a Procore Migration Tool

**Compiled:** June 2025  
**Purpose:** Engineering reference for SiteSync (or competitor) building a Procore data migration tool

---

## TABLE OF CONTENTS

1. [Procore Export Formats](#1-procore-export-formats)
2. [Procore REST API](#2-procore-rest-api)
3. [Procore Data Model: RFIs](#3-procore-data-model-rfis)
4. [Procore Data Model: Submittals](#4-procore-data-model-submittals)
5. [Procore Data Model: Schedule](#5-procore-data-model-schedule)
6. [Procore Data Model: Daily Logs](#6-procore-data-model-daily-logs)
7. [Competitor Migration Tools](#7-competitor-migration-tools)
8. [Migration Strategy Patterns](#8-migration-strategy-patterns)
9. [Key Findings Summary](#9-key-findings-summary)

---

## 1. PROCORE EXPORT FORMATS

### 1.1 General Export Capabilities

Procore supports per-tool exports across most modules. The primary export formats are:

| Format | Availability |
|--------|-------------|
| CSV | RFIs, Submittals, Specifications, Documents, Observations, Transmittals |
| Excel (.xlsx) | Submittals (Items tab only), Reports (360 Reporting) |
| PDF | RFIs (single or full list), Submittals (single with attachments), Daily Logs, Drawings |
| ZIP | Submittals (attachments bundle), RFIs (attachments bundle), Daily Logs (multi-day) |
| PDF with Visuals | 360 Reporting |
| XLS/CSV/GeoJSON/Shapefile/KML | Procore Unearth (field data mapping module) |

**Key limitation:** For large datasets (>150 submittals, >150 RFIs), Procore emails a download link instead of downloading immediately. Report row limits: 700,000 (CSV), 200,000 (Excel), 5,000 (PDF).

Sources: [Procore RFI Export Support](https://v2.support.procore.com/product-manuals/rfi-project/tutorials/export-rfis), [Procore Submittal Export Support](https://en-gb.support.procore.com/products/online/user-guide/project-level/submittals/tutorials/export-the-submittals-log), [Company Single Tool Report](https://en-gb.support.procore.com/products/online/user-guide/company-level/reports/tutorials/export-a-company-single-tool-report)

---

### 1.2 RFI Export (CSV)

**How to export:** Navigate to project RFIs tool → Click Export → Choose CSV or PDF.

**Export options:**
- **CSV**: Exports all RFI list items with the columns currently configured in the UI view (as of Aug 2025, Procore updated CSV exports to honor user column configurations including custom fields)
- **PDF - All Responses**: Full PDF with all response threads
- **PDF - Official Only**: PDF with only official/approved responses

**Exported data respects:** active search filters and sorted columns applied in the UI.

**Known CSV columns** (based on RFI field descriptions — exact column headers match field names):

| Column | Description |
|--------|-------------|
| Number | RFI number (sequential or prefixed by project stage) |
| Subject | Descriptive title of the RFI |
| Status | Draft, Open, Closed, or Closed-Draft |
| Question | The body text of the RFI question |
| Created By | User who created the RFI |
| Date Initiated | Date RFI was placed in Open status (blank for Drafts) |
| Due Date | Response due date |
| RFI Manager | User designated as RFI Manager |
| Assignees | One or more users responsible for responding |
| Received From | Person from whom the question originated |
| Responsible Contractor | Auto-filled from Received From's company |
| Distribution | Distribution list members |
| Drawing Number | Associated drawing reference |
| Spec Section | Linked specification section |
| Location | Job site location |
| Cost Code | Linked cost code |
| Cost Impact | Yes / Yes (Unknown) / No / TBD / N/A |
| Schedule Impact | Yes / Yes (Unknown) / No / TBD / N/A (+ days if Yes) |
| Private | Yes or No |
| Reference | Optional reference tag |
| Project Stage | Project stage when RFI was created |
| Sub Job | Sub job identifier (if WBS sub jobs enabled) |
| Custom Fields | Any company/project configured custom fields |

Source: [Procore RFI Field Descriptions](https://v2.support.procore.com/fieldlist-rfi-field-descriptions), [Seamless RFI Exports blog](https://www.procore.com/whats-new/seamless-rfi-exports-what-you-see-is-what-you-get)

---

### 1.3 Submittal Export (CSV / Excel)

**How to export:** Navigate to project Submittals tool → Click Items / Packages / Spec Sections / Ball In Court tab → Export → CSV or Excel (Excel only on Items tab).

**Important limitations:**
- The exported data **does NOT include custom field columns**
- The exported data **does NOT reflect column display configurations**

**Procore submittal import template headers** (definitive field list from Procore's own import template, which mirrors the data model):

| Field | Notes |
|-------|-------|
| Package Title | Submittal package name |
| Package Spec Section Number | Spec section for the package |
| Package Spec Section Description | Spec section description |
| Package Number | Package identifier |
| Submittal Title | Name of the submittal |
| Submittal Spec Section Number | Spec section linked to individual submittal |
| Submittal Spec Section Description | Description of spec section |
| Submittal Number | Required. Unique identifier (revisions tracked separately) |
| Description | Text description |
| Submittal Manager | Person responsible for the submittal |
| Submittal Status | Draft / Open / Closed / Rejected / Revise and Resubmit |
| Submittal Type | Document / Pay Request / Payroll / Plans / Prints / Product Information / Product Manual / Sample / Shop Drawing / Specification / Other |
| Location | Job site location |
| Received Date | Date submittal was received (MM/DD/YYYY) |
| Issue Date | Date submittal was issued |
| Submit By Date | Date by which submitter must submit to design team |
| Responsible Contractor Name | Company name |
| Required On-Site Date | (if Schedule Calculations enabled) |
| Lead Time | Days for material/services to arrive |
| Design Team Review Time | Days allotted to design team |
| Internal Review Time | Days for internal review |

Individual submittal records also track:
- **Received From** (contact at responsible contractor)
- **Submittal Package** membership
- **Cost Code**
- **Private** flag
- **Distribution List**
- **Linked Drawings**
- **Related Items**
- **Workflow data** (submitter/approver sequence with due dates)
- **Revision number** (auto-incremented, starts at 0)
- **Ball in Court** (current responsible party in workflow)
- **Planned Return Date**, **Planned Internal Review Completed Date**, **Planned Submit By Date** (calculated fields)
- **Confirmed Delivery Date**, **Actual Delivery Date**

Sources: [Procore Submittal Export Support](https://v2.support.procore.com/product-manuals/submittals-project/tutorials/export-the-submittals-log/), [Create a Submittal](https://v2.support.procore.com/product-manuals/submittals-project/tutorials/create-a-submittal/), [Update Submittal Import Template](https://en-ca.support.procore.com/products/online/user-guide/project-level/submittals/tutorials/update-the-submittals-import-template)

---

### 1.4 Schedule Export

Procore **does not have a native schedule export** from within the browser application. Schedules are uploaded from external scheduling software and displayed read-only in Procore.

**How schedule data enters Procore:**
- Upload directly via browser (file import)
- Sync via Procore Drive (desktop app, Windows only) — supports live database connection to Primavera P6

**Supported schedule file formats for IMPORT into Procore:**

| Format | Software |
|--------|---------|
| MPP | Microsoft Project |
| MPX | Microsoft Project, SureTrak |
| XER | Primavera P6, Primavera Contractor |
| PP | Asta Powerproject, Asta Easyplan |
| XML (MS Project format) | Smartsheet, OpenProject, Microsoft Project |
| XML (Primavera PMXML) | Primavera P6 |
| PPX | Phoenix Project Manager |
| FTP/FTS | FastTrack Schedule |
| POD | ProjectLibre |
| GAN | GanttProject |
| PEP | TurboProject |
| PRX | Primavera P3 |
| STX | Primavera SureTrak |
| CDPX, CDPZ | ConceptDraw PROJECT |
| SP | Synchro Scheduler |
| ZIP | Compressed file with any of the above |

**Fields imported from Primavera P6 into Procore (via Procore Drive):**
- Work Breakdown Schedule (WBS)
- Activity Names
- Activity ID
- Baseline Start / Baseline Finish (one baseline supported)
- Start / Finish dates
- Duration
- % Complete (Duration, Physical, or Units)
- Predecessors / Successors
- Notes
- Resources / Resource Assignments

**For schedule EXPORT from Procore:** The Procore API provides schedule endpoints (see Section 2), but the underlying schedule file (MPP, XER, etc.) remains in the original software. Procore stores a read-only view. To export the schedule data, use the API's schedule tasks endpoint.

Sources: [Upload Schedule File - Procore Support](https://v2.support.procore.com/zh-sg/product-manuals/schedule-project/tutorials/upload-a-project-schedule-file-to-procores-web-application), [Integrate P6 Schedule via Procore Drive](https://en-ca.support.procore.com/products/procore-drive/schedule/tutorials/integrate-a-primavera-p6-schedule-using-procore-drive)

---

### 1.5 Daily Log Export

**How to export:** Navigate to Daily Log tool → Select date(s) → Export → PDF or ZIP.

- **Single day:** PDF downloads immediately
- **Multiple days:** ZIP file emailed to user
- **Ranges > 3 months:** Must use Procore Extracts application

**Note:** There is **no CSV export for Daily Logs** — only PDF. Data extraction for migration must go through the API.

---

### 1.6 Bulk / Data Takeout Features

Procore has two bulk data extraction mechanisms:

#### A) Procore Extracts (Desktop App — Windows Only)
- Available to Admin users
- Supports: **Submittals, RFIs, Observations, Photos**
- Allows including or excluding attachments
- Organizes data by project and tool
- Suitable for ranges > 3 months (daily logs)
- Not an API — it's a desktop application requiring Windows

Source: [Procore Extracts](https://v2.support.procore.com/product-manuals/procore-extracts)

#### B) Data Extracts 2.0 (Web Tool — Beta as of Sept 2025)
- Accessible via Procore Explore (opt-in beta)
- Supports: Action Plans, Bidding, and more tools (full list not yet published)
- Flexible filtering and grouping
- Email notification when export complete
- Designed for project closeout, billing, compliance

Source: [Data Extracts 2.0 - Procore Support](https://support.procore.com/products/online/user-guide/project-level/data-extracts-2.0)

**For a migration tool building on Procore:** The REST API is the most reliable and complete mechanism for bulk data extraction across all tools.

---

## 2. PROCORE REST API

### 2.1 Authentication

Procore uses **OAuth 2.0** exclusively.

**Base URLs:**
- Production: `https://api.procore.com/rest/v1.0/`
- Sandbox: `https://sandbox.procore.com/rest/v1.0/`

**Auth endpoints:**
- Authorization: `https://login.procore.com/oauth/authorize`
- Token: `https://login.procore.com/oauth/token`

**Supported grant types:**

| Grant Type | Use Case |
|-----------|---------|
| Authorization Code | Web server applications (user-delegated access) |
| Client Credentials (DMSA) | Server-to-server, no user interaction required (recommended for migration tools) |

**Token details:**
- Access token expiry: **1.5 hours (5400 seconds)**
- Refresh token: Does not expire until used to obtain a new token pair
- Auth header format: `Authorization: Bearer <access_token>`

**Required header for all API calls:**
```
Procore-Company-Id: <integer>  (company ID, required on most endpoints)
```

**For migration tools:** Use the **Client Credentials / DMSA** (Developer Managed Service Account) grant type. This allows your application to authenticate without user interaction, making it suitable for automated, bulk data extraction.

Source: [OAuth 2.0 for Installed Applications](https://procore.github.io/documentation/oauth-installed-apps), [OAuth Grant Types](https://procore.github.io/documentation/oauth-choose-grant-type)

---

### 2.2 Rate Limits

Procore enforces **two concurrent rate limits:**

| Limit Type | Window | Response on Breach |
|-----------|--------|-------------------|
| Hourly limit | 60-minute rolling window | HTTP 429 |
| Spike limit | 10-second rolling window | HTTP 429 |

**Rate limit headers returned on every response:**

| Header | Meaning |
|--------|---------|
| `X-Rate-Limit-Limit` | Total requests allowed in the reported window |
| `X-Rate-Limit-Remaining` | Requests remaining in the current window |
| `X-Rate-Limit-Reset` | Unix timestamp when the window resets |

The headers reflect whichever limit you are closest to exhausting. In normal operation, the **spike limit headers are shown** until you approach the hourly limit.

**Example hourly limit headers:**
```
X-Rate-Limit-Limit: 600
X-Rate-Limit-Remaining: 589
X-Rate-Limit-Reset: 1466182244
```

**Example spike limit headers:**
```
X-Rate-Limit-Limit: 25
X-Rate-Limit-Remaining: 24
X-Rate-Limit-Reset: 1466182247
```

**On 429:** Pause all requests until after `X-Rate-Limit-Reset`. Implement exponential backoff with jitter.  
**On 503:** Check the `Retry-After` header for seconds to wait.

**Known limit from Procore FAQ:** The FAQ references a limit of **3,600 requests per hour** for some configurations. The exact limit per application may vary — always read the headers rather than assuming a static number.

Source: [Procore API Rate Limiting](https://procore.github.io/documentation/rate-limiting), [Procore Developer FAQ](https://developers.procore.com/documentation/faq)

---

### 2.3 Pagination

All major list endpoints support pagination.

**Parameters:**
- `page` — page number (1-indexed)
- `per_page` — items per page (max: **10,000**)

**Response headers:**
- `Total` — total number of records
- `Per-Page` — current page size
- `Link` — RFC 5988 Link header with `first`, `prev`, `next`, `last` rel links

**Example call:**
```
GET https://api.procore.com/rest/v1.0/projects/{project_id}/rfis?per_page=100&page=1
Authorization: Bearer <token>
Procore-Company-Id: 12345
```

Source: [Procore API Pagination](https://procore.github.io/documentation/pagination)

---

### 2.4 Key API Endpoints for Migration

#### Projects
```
GET /rest/v1.0/projects?company_id={company_id}
```
Returns all projects for the company. Use to build the list of project IDs for per-project data extraction.

#### RFIs
```
GET /rest/v1.0/projects/{project_id}/rfis
  ?per_page=100&page=1
  &filters[status]=open,closed,draft
  &filters[created_at]=2020-01-01..2024-12-31

GET /rest/v1.0/projects/{project_id}/rfis/{rfi_id}
  → returns single RFI with full detail

GET /rest/v1.0/projects/{project_id}/rfis/filter_options
  → returns available filter fields and options
```

#### Submittals
```
GET /rest/v1.0/projects/{project_id}/submittals
  ?per_page=100&page=1

GET /rest/v1.0/projects/{project_id}/submittals/{submittal_id}

POST /rest/v1.0/projects/{project_id}/submittal_responses
  → for creating responses (workflow step responses)
```
**Note:** The `workflow_data` field update requires `multipart/form-data` format.

#### Schedule
```
GET /rest/v1.1/projects/{project_id}/schedule/requested_changes
  → schedule change requests

GET /rest/v1.0/projects/{project_id}/calendar_events
  → DEPRECATED; use Schedule Tasks / Calendar Items instead
```
Procore also has schedule task endpoints accessible under the Schedule API section.

#### Daily Logs
```
GET /rest/v1.0/projects/{project_id}/daily_construction_report_logs
  → returns approved Daily Construction Report Logs for current or specified date

(Other daily log sub-endpoints exist for manpower, equipment, notes, weather, etc.)
```

#### Users / Directory
```
GET /rest/v1.0/companies/{company_id}/users
  → list all company users

GET /rest/v1.0/projects/{project_id}/users
  → list project-level users

Headers required: Procore-Company-Id
```

Sources: [RFIs API Reference](https://developers.procore.com/reference/rest/rfis?version=latest), [Submittals API Reference](https://developers.procore.com/reference/rest/submittals?version=latest), [Schedule API Reference](https://developers.procore.com/reference/rest/schedule?version=latest), [Daily Construction Report Logs API](https://developers.procore.com/reference/rest/daily-construction-report-logs?version=latest), [Filter Options API](https://developers.procore.com/reference/rest/filter-options)

---

### 2.5 Data Export / Migration API Endpoint

Procore does **not** have a dedicated "data migration" or "bulk export" API endpoint. Migration tools must:

1. Iterate over all projects using `GET /rest/v1.0/projects`
2. For each project, paginate through each tool's list endpoint
3. For each record, optionally fetch the single-item endpoint for full detail
4. Download file attachments via their direct URLs returned in the API responses

There is a **prime contract PDF export** endpoint (`/rest/v1.0/prime_contracts/{id}/pdf_export`) but this is module-specific, not a bulk takeout feature.

Source: [Prime Contracts Export PDF](https://developers.procore.com/reference/rest/prime-contracts-export-pdf)

---

## 3. PROCORE DATA MODEL: RFIs

### 3.1 RFI Statuses

Procore RFIs have four statuses:

| Status | Description |
|--------|-------------|
| **Draft** | Created but not yet submitted. Ball in court stays with RFI Manager. RFI number may not yet be assigned (Standard permission users). |
| **Open** | Submitted and active. Assignees have first Ball in Court responsibility. Date Initiated is set. |
| **Closed** | RFI has been resolved and closed. |
| **Closed-Draft** | A draft state after closing (less common; used in re-opened workflows). |

Source: [RFI Field Descriptions](https://v2.support.procore.com/fieldlist-rfi-field-descriptions)

---

### 3.2 RFI Ball-in-Court (BIC) Concept

The Ball-in-Court tracks who is currently responsible for action on an RFI.

**BIC workflow progression:**
1. **RFI Created as Draft** → BIC stays with RFI Manager
2. **RFI Created as Open / Sent** → BIC shifts to Assignees
3. **Assignee forwards RFI for Review** → BIC shifts to the forwarded user until they respond
4. **Assignee adds other Assignees** → all share BIC responsibility
5. **All required responses complete** → BIC shifts back to RFI Manager
6. **RFI Manager can shift BIC manually** using "Return to Assignee's Court" or "Return to RFI Manager's Court"

**Permission required to shift BIC manually:** Admin on RFI tool, or Standard + "Act as RFI Manager" granular permission.

Source: [Shift Ball in Court - Procore Support](https://v2.support.procore.com/product-manuals/rfi-project/tutorials/shift-the-ball-in-court-on-an-rfi)

---

### 3.3 Full RFI Field Schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | integer | auto | Procore internal ID |
| number | string | Yes (Open) | Sequential or stage-prefixed |
| subject | string | No | Title displayed in list view |
| status | enum | auto | Draft / Open / Closed / Closed-Draft |
| question | text | Yes | Body of the RFI request |
| created_by | user_ref | auto | User who created the RFI |
| date_initiated | date | auto | Set when moved to Open status |
| due_date | date | No | Admin-set or auto-calculated from default days |
| rfi_manager | user_ref | Yes | Admin user responsible for managing the RFI |
| assignees | user_ref[] | No | Users responsible for responding |
| received_from | user_ref | No | Originator of the question |
| responsible_contractor | company_ref | auto | Company of Received From user |
| distribution | user_ref[] | No | Users notified of RFI progress |
| drawing_number | string | No | Manual input or linked drawing reference |
| spec_section | spec_ref | No | Linked specification section |
| location | location_ref | No | Job site location |
| cost_code | cost_code_ref | No | Linked cost code |
| cost_impact | enum | No | Yes / Yes (Unknown) / No / TBD / N/A |
| cost_impact_amount | decimal | No | Dollar amount (if cost_impact = Yes) |
| schedule_impact | enum | No | Yes / Yes (Unknown) / No / TBD / N/A |
| schedule_impact_days | integer | No | Calendar days (if schedule_impact = Yes) |
| private | boolean | No | Restricts visibility |
| reference | string | No | Optional reference tag |
| project_stage | string | No | Project stage prefix |
| sub_job | sub_job_ref | No | Sub job (if WBS enabled) |
| custom_fields | object | No | Company/project-configured fields |
| attachments | file_ref[] | No | Attached files |
| responses | response[] | No | Thread of responses (official and non-official) |

---

## 4. PROCORE DATA MODEL: SUBMITTALS

### 4.1 Submittal Statuses

Default submittal statuses in Procore:

| Status | Description |
|--------|-------------|
| **Draft** | Created but not yet submitted into the workflow |
| **Open** | Active and progressing through the submittal workflow |
| **Approved** | Workflow approvers marked as Approved |
| **Approved as Noted** | Approved with comments/conditions |
| **Revise and Resubmit** | Returned for revision; triggers reject workflow |
| **Rejected** | Rejected by approver; triggers reject workflow |
| **Closed** | Completed and distributed |
| **Private** | Not a status per se, but a visibility flag |

**Custom statuses:** Companies can configure custom statuses in addition to defaults.

Source: [Submittals - Procore Support](https://support.procore.com/products/online/user-guide/project-level/submittals), [Create a Submittal Revision](https://v2.support.procore.com/product-manuals/submittals-project/tutorials/create-a-submittal-revision)

---

### 4.2 Submittal Ball-in-Court (BIC) Concept

Submittals use a structured **workflow** with sequential or parallel groups of Submitters and Approvers.

**BIC workflow:**
1. When submittal is first sent, **BIC is assigned to the first workflow group**
2. When all required members of a group respond, **BIC advances to the next group**
3. If an approver responds with "Rejected" or "Revise and Resubmit," the **reject workflow is triggered**: BIC automatically moves to the Submittal Manager for intervention
4. Submittal Manager can: resume the workflow, set BIC back to a previous step, or close and distribute
5. BIC can be manually set using "Set Ball in Court" (Admin permission required)

**Requirement to change BIC:** Submittal must be in Draft or Open status.

Source: [Change Ball in Court on Submittal](https://v2.support.procore.com/es-es/product-manuals/submittals-project/tutorials/change-the-ball-in-court-on-a-submittal)

---

### 4.3 Full Submittal Field Schema

| Field | Type | Notes |
|-------|------|-------|
| id | integer | Procore internal ID |
| number | string | Required. Duplicate numbers allowed (across different submittals) |
| revision | integer | Auto-incremented (0, 1, 2…). Each revision is a separate record. |
| title | string | Descriptive name |
| status | enum | Draft / Open / Approved / Approved as Noted / Revise and Resubmit / Rejected / Closed |
| type | enum | Document / Pay Request / Plans / Shop Drawing / Sample / etc. |
| spec_section | spec_ref | Corresponding spec section |
| submittal_package | package_ref | Optional package grouping |
| submittal_manager | user_ref | Person responsible for managing |
| responsible_contractor | company_ref | Company submitting |
| received_from | user_ref | Contact at responsible contractor |
| received_date | date | Date received (MM/DD/YYYY) |
| issue_date | date | Date issued |
| submit_by_date | date | Deadline for submitter to submit to design team |
| final_due_date | date | Final due date |
| required_on_site_date | date | Date materials must be on site |
| lead_time | integer | Days for materials to arrive |
| design_team_review_time | integer | Days allotted for design team review |
| internal_review_time | integer | Days for internal review |
| planned_return_date | date | Calculated: required_on_site_date minus lead_time |
| planned_internal_review_completed_date | date | Calculated field |
| planned_submit_by_date | date | Calculated field |
| actual_return_date | date | When submittal was actually returned |
| confirmed_delivery_date | date | Supplier/contractor confirmed delivery |
| actual_delivery_date | date | When material arrived on site |
| location | location_ref | Job site location |
| cost_code | cost_code_ref | Linked cost code |
| private | boolean | Restricts visibility |
| description | text | Informative details |
| distribution_list | user_ref[] | Users notified of progress |
| workflow_data | workflow[] | Sequence of submitter/approver groups with due dates and responses |
| ball_in_court | user_ref | Current responsible party |
| linked_drawings | drawing_ref[] | Associated drawings |
| related_items | item_ref[] | Documents, plans, etc. |
| attachments | file_ref[] | Attached files (NOTE: not carried over between revisions) |
| custom_fields | object | Company/project-configured fields |

---

## 5. PROCORE DATA MODEL: SCHEDULE

### 5.1 How Procore Handles Schedules

Procore functions as a **read-only display layer** for schedules. The authoritative schedule data lives in the third-party scheduling software (Microsoft Project, Primavera P6, Asta, etc.). The only field editable directly in Procore is **Percent Complete** (via mobile app).

**Schedule tools in Procore:**
- **Schedule tool** — Gantt view of uploaded schedule file
- **Lookahead Schedule** — Short-term scheduling view
- **Calendar Events** — Deprecated; replaced by Schedule Tasks / Calendar Items

### 5.2 Schedule API Data Points

Via the API, Procore exposes schedule activity/task data:

```
GET /rest/v1.1/projects/{project_id}/schedule/requested_changes
```

The schedule tasks endpoint returns activity-level data including WBS, activity names, IDs, dates, durations, percent complete, predecessors/successors, resources, and notes.

### 5.3 For Migration

To migrate Procore schedule data to another platform:
1. Use the Procore Schedule API to extract activity data in JSON format
2. Or retrieve the original schedule file from Procore Documents tool (stored in locked "Schedules" folder — Admin access required)
3. Original file format is preserved (MPP, XER, XML, etc.)

---

## 6. PROCORE DATA MODEL: DAILY LOGS

### 6.1 Daily Log Sections

The Daily Log is organized into discrete sections. Sections marked with `*` are enabled by default on new projects:

| Section | Default | Key Fields |
|---------|---------|-----------|
| **Weather*** | Yes | Time observed, sky conditions, temperature (current + average), precipitation, wind, ground/sea conditions, weather delay toggle, calamity, comments |
| **Manpower*** | Yes | Company, number of workers, hours worked, cost code |
| **Notes*** | Yes | Free-text notes for the day |
| **Timecards*** | Yes | Internal worker hours, billable flag, syncs to Timesheets tool |
| **Equipment*** | Yes | Equipment name, hours used, inspection time, cost code |
| **Visitors*** | Yes | Visitor records |
| **Phone Calls*** | Yes | Call log |
| **Inspections*** | Yes | Inspection records |
| **Deliveries*** | Yes | Delivery records (GC-purchased materials) |
| **Safety Violations*** | Yes | Safety violation log |
| **Accidents*** | Yes | Accident reports |
| **Quantities*** | Yes | Material quantities used |
| **Productivity*** | Yes | Material arriving on site vs. installed |
| **Dumpster*** | Yes | Dumpster records |
| **Waste*** | Yes | Type/amount of waste, disposal method, responsible party |
| **Scheduled Work*** | Yes | Resources scheduled for tasks (shows up or no, workers, hours, compensation rate) |
| **Photos*** | Yes | Progress photos linked to date |
| **Delays** | No | Delay tracking |
| **Daily Construction Report** | No | Total workers/hours per vendor/company/trade |
| **Plan Revisions** | No | Drawing revision records |

**Export limitation:** Daily logs export as **PDF only** (no CSV). For programmatic extraction, use the Daily Construction Report Logs API.

Source: [Daily Log Overview](https://pl-pl.support.procore.com/products/online/user-guide/project-level/daily-log/tutorials/daily-log-overview), [Daily Log Types](https://v2.support.procore.com/zh-sg/product-manuals/daily-log-project/tutorials/daily-log-types), [Configurable Fields](https://support.procore.com/faq/which-fields-in-the-daily-log-tool-can-be-configured-as-required-optional-or-hidden)

### 6.2 Daily Log Configurable Fields (Admin-settable)

The following sections have configurable field requirements (Required / Optional / Hidden):
- Accidents, Call, Daily Construction Report, Delay, Delivery, Dumpster, Equipment, Inspection, Manpower, Notes, Observed Weather Conditions, Plan Revision, Productivity, Quantity, Safety Violation, Visitors, Waste, Work

**Workforce labor categories** (some hidden by default, enabled by Company Admin):
Default categories + optional: Women, Veteran, Minority, First-Year Apprentice, Local (City), Local (County)

---

## 7. COMPETITOR MIGRATION TOOLS

### 7.1 Procore ↔ Autodesk Construction Cloud (ACC) Migration

The most common Procore migration scenario is Procore ↔ Autodesk/BIM 360/ACC.

#### ProjectReady / WorkBridge
- **Type:** API-based automated migration tool
- **URL:** project-ready.com
- **Data migrated:** Documents, RFIs, Submittals, Drawings, Sheets, Photos, Issues
- **Also supports ACC ↔ Procore ongoing sync** (bi-directional, real-time) via WorkBridge product
- **Methodology:** Discovery session → full inventory → phased migration → audit trail
- **Notable:** Supports one-time migration OR continuous sync for active projects
- **Handles:** Metadata preservation, transaction history

Source: [ProjectReady](https://project-ready.com/autodesk-and-procore-migration-with-projectready/)

#### IMAGINiT Pulse
- **Type:** Professional services + tool
- **Data migrated:** Projects, Companies, Users, Documents, Photos, Drawings, Punch Lists, Issues, RFIs, Budgets, Contracts, Change Orders
- **Notable:** Preserves metadata and transaction history

Source: [YouTube - IMAGINiT Pulse Migration Demo](https://www.youtube.com/watch?v=wU6fgymc2m8)

#### Ncircle Tech
- **Type:** Migration services
- **Supports:** Procore to ACC migration
- **Approach:** Step-by-step process demonstration

Source: [YouTube - Ncircle Migration Demo](https://www.youtube.com/watch?v=VVAwMlUuSjE)

---

### 7.2 Cloudsfer / Tzunami
- **Type:** File/document migration tool (primarily file storage)
- **URL:** cloudsfer.com
- **Scope:** Document management migration (NOT structured data like RFIs/submittals)
- **Supported sources to Procore:** Google Drive, Box, Dropbox, OneDrive, SharePoint, IBM, OpenText, FileNet, eRoom, DocuShare, HP TRIM, Lotus Notes, Confluence, Documentum
- **Features:** Delta migration (only newly modified data), filters by date/size/file type, migration report
- **Limitation:** Focused on document/file migration, not construction project management data (RFIs, submittals, etc.)

Source: [Cloudsfer Procore Support](https://cloudsfer.com/supported-systems/procore/)

---

### 7.3 Manual Migration Pattern (Common for Smaller Teams)

Per community advice and Projul/Planyard migration guides:

1. **Audit** which Procore modules you actively use (typically only 40-60% are used)
2. **Export while you have access** — Procore cuts off data when contract expires
3. **What to export manually:**
   - Contacts/companies → CSV from Directory
   - Project documents → Download all drawings, specs, photos, attachments (organized by project)
   - Financial data → Export budgets, change orders, cost records (or pull from accounting integration)
   - Daily logs and reports → Export as PDFs / screenshots (for warranty/legal reference)
   - Schedules → Export as PDFs or screenshots (active projects rebuilt in new platform anyway)
4. **Run platforms in parallel** for 2-4 weeks
5. **Archive exported Procore data** for at least 2 years (warranty claims, legal, tax)

**Common pain points reported:**
- No single "export everything" button — each module must be exported separately
- Access is cut off at contract expiry — data is lost if not exported beforehand
- Schedule data is largely rebuilt from scratch in the new system
- Historical RFIs and submittals are the most valuable but hardest to move programmatically
- Custom fields do not export in CSV exports — must use API to get these
- Attachments require separate download steps

Sources: [Projul Migration Guide](https://projul.com/blog/best-procore-alternatives/), [Planyard Migration Checklist](https://planyard.com/alternatives/procore)

---

### 7.4 Common Data That Is Hardest to Migrate

Based on patterns across construction PM migration projects:

| Data Type | Difficulty | Reason |
|-----------|-----------|--------|
| RFI response threads | High | Multi-step conversations with attachments, official vs non-official responses, timestamps, user attribution |
| Submittal workflows | High | Sequential/parallel approval chains with dates, responses, and role context |
| File attachments | High | Must be downloaded per-record, then re-uploaded; large volumes; S3 presigned URL patterns |
| Custom fields | High | Not in CSV exports; must use API; vary by company configuration |
| Ball-in-court state | Medium | Represents current workflow position — complex to reconstruct in new system |
| User identity | Medium | Procore user IDs ≠ destination system user IDs; email is the safest cross-system key |
| Historical closed items | Medium | Often the most voluminous; must decide cutoff date |
| Linked items | Medium | RFIs linked to drawings, submittals linked to schedule tasks — cross-references break in migration |
| Private items | Medium | API may restrict access based on requestor's permission level |
| Schedule data | Medium | Procore doesn't own the schedule file; must extract from source software |
| Daily logs | Medium | PDF-only export; must use API; highly structured with many sub-sections |

---

## 8. MIGRATION STRATEGY PATTERNS

### 8.1 Architecture Overview for a Procore Migration Tool

```
[Procore API]
     │
     ▼
[Extraction Layer]         ← OAuth2 DMSA auth, rate-limit-aware pagination
     │
     ▼
[Staging / Transform]      ← Normalize data, map IDs, map users, clean attachments
     │
     ▼
[SiteSync API]             ← Write records with mapped IDs
     │
     ▼
[Verification Layer]       ← Count checks, field spot-checks, attachment validation
```

---

### 8.2 ID Mapping (Procore IDs → SiteSync IDs)

**Core principle:** Procore integer IDs cannot be preserved in the destination system. You must maintain a bidirectional mapping table.

**Recommended mapping table schema:**
```sql
CREATE TABLE migration_id_map (
  id              SERIAL PRIMARY KEY,
  entity_type     VARCHAR(50),      -- 'rfi', 'submittal', 'project', 'user', etc.
  procore_id      INTEGER NOT NULL,
  procore_number  VARCHAR(100),     -- human-readable number (e.g., RFI-042)
  sitesync_id     VARCHAR(100),     -- new system's ID
  migrated_at     TIMESTAMP,
  status          VARCHAR(20)       -- 'pending', 'migrated', 'failed', 'skipped'
);
```

**Usage patterns:**
- **Before inserting a child record** (e.g., a response), look up the parent's mapped ID
- **Cross-references** (RFIs linked to drawings, submittals linked to specs) require all referenced entities to be migrated first
- **Migration order matters:** Migrate in dependency order — Projects → Users → Specs → Drawings → RFIs → Responses → Submittals → Submittal Responses

---

### 8.3 User Mapping (Procore Users → SiteSync Users)

**Challenge:** Procore user IDs are integers internal to each Procore company. The only reliable cross-system key is **email address**.

**Recommended approach:**

1. Extract all Procore users via `GET /rest/v1.0/companies/{company_id}/users`
2. Prompt the customer to map Procore users to SiteSync users (by email, with fuzzy matching to suggest matches)
3. Handle unmapped users gracefully:
   - Option A: Create a "legacy import" placeholder user in SiteSync
   - Option B: Assign to the migration tool's service account user
   - Option C: Store original Procore user name/email in a notes field

**User mapping CSV template for customers:**
```
procore_user_id, procore_email, procore_name, sitesync_user_id, sitesync_email
12345, john@contractor.com, John Smith, , 
```

---

### 8.4 Handling Attachments / Files

Procore stores attachments in AWS S3. The API returns presigned URLs or direct download URLs.

**Attachment migration pattern:**

1. For each record (RFI, submittal, daily log), fetch the record's attachment list from the API
2. Download each attachment to intermediate storage (S3 bucket, local disk, or streaming directly)
3. Re-upload to SiteSync's storage backend
4. Map the new file URL/ID back to the migrated record
5. Handle rate limits — large attachment counts can exhaust API limits quickly (each file download is an API call or HTTP request)

**Critical issues to handle:**
- **File size limits:** Some files may be very large (drawings can be 100+ MB)
- **Presigned URL expiry:** Procore S3 URLs have expiry times — don't cache them; fetch just-in-time
- **Retry logic:** Downloads can fail — implement retry with exponential backoff
- **Duplicate detection:** Some attachments may appear on multiple records (linked from Documents tool)

---

### 8.5 Historical vs. Active Data Strategy

**Recommended approach:**

| Data Category | Strategy |
|--------------|---------|
| **Closed/completed records** | Migrate first; lower risk since no active changes |
| **Active/open records** | Migrate last or during cutover window |
| **Archive-only records** | Consider migrating as read-only/historical rather than full workflow import |
| **Records older than N years** | Customer decides cutoff; often last 3-5 years for active reference |

**Cutover pattern:**
1. **Phase 1 - Historical migration:** Migrate all closed records (closed RFIs, closed submittals) before cutover
2. **Phase 2 - Freeze window:** Customer stops making changes in Procore (typically during off-hours)
3. **Phase 3 - Delta migration:** Migrate all records changed/created since Phase 1 (use `updated_at` filter)
4. **Phase 4 - Cutover:** Customer switches to SiteSync as primary system
5. **Phase 5 - Procore read-only:** Keep Procore access for 30-90 days as reference

---

### 8.6 Migration Tool Best Practices

#### Rate Limit Handling
```python
def fetch_with_rate_limit(url, headers):
    response = requests.get(url, headers=headers)
    if response.status_code == 429:
        reset_at = int(response.headers.get('X-Rate-Limit-Reset', time.time() + 60))
        wait_secs = max(reset_at - time.time(), 1)
        time.sleep(wait_secs + 1)  # +1 second buffer
        return fetch_with_rate_limit(url, headers)  # retry
    remaining = int(response.headers.get('X-Rate-Limit-Remaining', 100))
    if remaining < 10:
        time.sleep(2)  # slow down proactively
    return response
```

#### Pagination Pattern
```python
def fetch_all(base_url, headers, params={}):
    results = []
    page = 1
    while True:
        params['page'] = page
        params['per_page'] = 100
        response = fetch_with_rate_limit(base_url, headers, params)
        data = response.json()
        if not data:
            break
        results.extend(data)
        total = int(response.headers.get('Total', 0))
        per_page = int(response.headers.get('Per-Page', 100))
        if len(results) >= total:
            break
        page += 1
    return results
```

#### Data Validation
- **Before migration:** Record counts in Procore for each entity type
- **After migration:** Verify record counts match in SiteSync
- **Field-level:** Spot-check 5-10% of records for field accuracy
- **Attachment validation:** Verify attachment counts and file sizes match

#### Idempotency
Design the migration tool to be re-runnable:
- Check if a Procore ID already exists in the mapping table before migrating
- Skip already-migrated records, but log them
- Support "re-migrate" flag that overwrites existing records

---

### 8.7 What About Procore Webhooks?

Procore offers webhooks, but they have **permission limitations** that make them unsuitable as a primary extraction mechanism for a migration tool (confirmed by Procore community). The REST API polling approach is more reliable for migration purposes.

---

## 9. KEY FINDINGS SUMMARY

### For the Migration Tool Development Team

| Topic | Key Finding |
|-------|------------|
| **Primary extraction method** | Procore REST API (OAuth2 DMSA) — most complete and reliable |
| **Auth for migration tool** | Client Credentials / DMSA grant — no user interaction required |
| **Rate limits** | Dual limits: hourly (~600 in examples, ~3,600 per FAQ) + spike (25 per 10s). Always read headers. |
| **API base URL** | `https://api.procore.com/rest/v1.0/` |
| **Required header** | `Procore-Company-Id: {int}` on all project/company endpoints |
| **Token expiry** | 1.5 hours; use refresh token pattern |
| **RFI statuses** | Draft, Open, Closed, Closed-Draft |
| **Submittal statuses** | Draft, Open, Approved, Approved as Noted, Revise and Resubmit, Rejected, Closed |
| **Ball-in-court** | Both RFIs and Submittals use BIC; it's a workflow position marker, not a static field |
| **Schedule** | Procore is read-only display; native files (XER, MPP) stored in Documents; use API for task data |
| **Daily logs** | PDF-only UI export; use API for programmatic extraction; highly modular (20 sections) |
| **Bulk export tool** | Procore Extracts (Windows desktop app) for Submittals/RFIs/Observations/Photos; Data Extracts 2.0 (beta) for more tools |
| **Custom fields** | Not in CSV exports; must use API |
| **Attachments** | Per-record, presigned S3 URLs; must download + re-upload |
| **User mapping** | Email address is the only reliable cross-system user key |
| **Hardest to migrate** | Response threads, workflow state, attachments at scale, cross-references, custom fields |
| **Competitor tools** | ProjectReady/WorkBridge (most capable), IMAGINiT Pulse, Cloudsfer (documents only) |
| **Best migration order** | Projects → Users → Specs → Drawings → RFIs → RFI Responses → Submittals → Submittal Workflow → Attachments |

---

*Research compiled from Procore official support documentation, Procore Developer Portal (developers.procore.com), Procore GitHub documentation (procore.github.io), Procore community forums, and competitor migration tool websites. All sources accessed June 2025.*
