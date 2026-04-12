# DOMAIN_KERNEL_SPEC.md — SiteSync PM

> **Version:** 1.0.0  
> **Status:** Draft — Awaiting Owner Approval  
> **Author:** Walker Benner (@wrbenner)  
> **Last Updated:** 2026-04-09  
> **CODEOWNERS:** @wrbenner (changes require PR + review)

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Scope Taxonomy and Identity Rules](#2-scope-taxonomy-and-identity-rules)
3. [Entity Graph](#3-entity-graph)
4. [Entity Relationships](#4-entity-relationships)
5. [State Machines](#5-state-machines)
6. [Temporal, Versioning, and Supersession Rules](#6-temporal-versioning-and-supersession-rules)
7. [Permission Matrix](#7-permission-matrix)
8. [Provenance and Audit](#8-provenance-and-audit)
9. [Event Model](#9-event-model)
10. [Workflow Boundaries](#10-workflow-boundaries)
11. [AI Policy Layer](#11-ai-policy-layer)
12. [Kernel Assumptions and Non-Goals](#12-kernel-assumptions-and-non-goals)
13. [Gold-Standard Scenario Fixtures](#13-gold-standard-scenario-fixtures)

---

## 1. Purpose and Scope

### 1.1 What This Document Is

This is the **canonical domain model** for SiteSync PM. Every database table, API endpoint, permission rule, UI component, and AI agent must conform to the definitions in this document. When there is a conflict between code and this spec, this spec wins.

### 1.2 What This Document Is Not

- **Not a database migration.** This document defines *what the schema must look like*, not SQL to execute. Migrations are derived from the gap analysis that compares this spec to the existing 98-table schema.
- **Not a UI spec.** Entity definitions inform UI, but page layouts and interaction patterns live elsewhere.
- **Not an API contract.** Endpoint shapes derive from these entities, but REST/RPC signatures are separate.

### 1.3 Authority Chain

```
DOMAIN_KERNEL_SPEC.md       (this document — source of truth)
    ↓
SCHEMA_GAP_ANALYSIS.md      (compares existing DB to kernel)
    ↓
supabase/migrations/         (SQL to close gaps)
    ↓
src/hooks/                   (TypeScript hooks implement kernel)
    ↓
evals/                       (tests verify kernel compliance)
```

### 1.4 Design Principles

1. **Construction-first.** Every entity maps to a real construction workflow concept. No generic "items" or "records."
2. **Tenant-isolated.** Organization A cannot see Organization B's data. Ever. No exceptions.
3. **Project-scoped by default.** 90% of entities belong to a project. Cross-project access is explicit and audited.
4. **State machines enforce process.** Documents flow through defined states. Ad-hoc status strings are banned.
5. **Audit everything.** Every mutation is logged with who, what, when, and from-where.
6. **AI is advisory.** AI may suggest, never commit. Human approval required for all state transitions.
7. **RLS is the security boundary.** Client-side permission checks are convenience; server-side RLS is enforcement.

---

## 2. Scope Taxonomy and Identity Rules

### 2.1 Scope Types

Every entity in SiteSync PM belongs to exactly one of five scope types:

| Scope Type | Description | Tenant Boundary | Example Entities |
|---|---|---|---|
| **system** | Platform-wide, no tenant | None (platform operator only) | `api_keys`, `webhooks` |
| **org** | Belongs to one organization | `organization_id` | `organizations`, `organization_members`, `organization_settings`, `cost_database`, `integrations` |
| **project** | Belongs to one project within one org | `project_id` → `organization_id` | `rfis`, `submittals`, `daily_logs`, `punch_items`, `change_orders` |
| **org+project** | Scoped to org, optionally narrowed to project | `organization_id` + optional `project_id` | `custom_reports`, `executive_reports` |
| **user** | Belongs to one authenticated user | `user_id` | `notifications`, `notification_preferences` |

### 2.2 Identity Resolution Chain

Every request resolves identity in this order:

```
1. auth.uid()              → Supabase auth JWT → user_id (uuid)
2. organization_members    → user_id + organization_id → org_role (owner|admin|member)
3. project_members         → user_id + project_id → project_role (owner|admin|project_manager|superintendent|subcontractor|viewer)
4. Permission matrix       → project_role → allowed actions
```

**Rules:**
- A user may belong to multiple organizations.
- A user may belong to multiple projects within an organization.
- A user's project role determines their permissions. Organization role is used only for org-scoped operations.
- A user with no `project_members` row for a given project has **zero** access to that project's data.

### 2.3 Cross-Scope Reference Rules

| Reference Type | Allowed? | Constraint |
|---|---|---|
| Project entity → same-project entity | Yes | FK within same `project_id` |
| Project entity → org entity | Yes | Read-only reference (e.g., `cost_database` lookup) |
| Project entity → different-project entity | **No** | Hard constraint. Never cross project boundaries. |
| Org entity → project entity | **No** | Org-scoped entities cannot depend on project-scoped data |
| User entity → project entity | Yes | Via `project_id` FK (e.g., notifications about a project) |

### 2.4 Canonical Identifiers

- All primary keys are `uuid` (v4, generated via `gen_random_uuid()`).
- Human-readable identifiers (RFI numbers, submittal numbers, CO numbers) are **project-scoped sequential integers**, auto-assigned via `BEFORE INSERT` triggers.
- Human-readable IDs are **display-only** — never used as foreign keys.
- Format convention: `{entity_prefix}-{number}` (e.g., `RFI-042`, `SUB-017`, `CO-003`). Prefix is UI-only; database stores the integer.

---

## 3. Entity Graph

### 3.1 Tier 1 — Organization

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| Organization | `organizations` | org | Tenant container. All projects, members, settings live under one org. |
| OrganizationMember | `organization_members` | org | Join table: user ↔ org with org-level role (`owner`, `admin`, `member`). |
| OrganizationSettings | `organization_settings` | org | Org-wide configuration (notification defaults, feature flags, billing). |
| Portfolio | `portfolios` | org | Cross-project grouping for executive dashboards. |
| PortfolioProject | `portfolio_projects` | org | Join table: portfolio ↔ project. |

### 3.2 Tier 2 — Project

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| Project | `projects` | project | The core work container. Has address, contract value, dates, status. |
| ProjectMember | `project_members` | project | Join table: user ↔ project with project-level role. |
| ProjectSnapshot | `project_snapshots` | project | Point-in-time JSON capture for historical reporting. |

**Project.status** enum: `active`, `completed`, `on_hold`, `cancelled`

### 3.3 Tier 3 — Document Control

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| Drawing | `drawings` | project | Construction drawings with discipline, sheet number, revision tracking. |
| DrawingMarkup | `drawing_markups` | project | Annotations layered on drawings (personal, shared, official). |
| File | `files` | project | General file storage with versioning chain. |
| Transmittal | `transmittals` | project | Formal document transmission record. |
| FieldCapture | `field_captures` | project | Photos, voice memos, text notes captured from the field. |

### 3.4 Tier 4 — Communication & Tracking

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| RFI | `rfis` | project | Request for Information — formal question requiring documented answer. |
| RFIResponse | `rfi_responses` | project (child) | Individual responses/comments on an RFI. |
| RFIWatcher | `rfi_watchers` | project (child) | Users subscribed to RFI updates. |
| Submittal | `submittals` | project | Material/product submittals for architect review. |
| SubmittalApproval | `submittal_approvals` | project (child) | Individual approval records in the review chain. |
| Task | `tasks` | project | Action items with status, priority, assignment, and hierarchy. |
| TaskTemplate | `task_templates` | project | Reusable task configurations. |
| Meeting | `meetings` | project | OAC, subcontractor, safety, coordination, progress meetings. |
| MeetingAttendee | `meeting_attendees` | project (child) | Attendance tracking per meeting. |
| MeetingActionItem | `meeting_action_items` | project (child) | Follow-up actions from meetings. |
| MeetingAgendaItem | `meeting_agenda_items` | project (child) | Pre-defined agenda structure. |
| MeetingSeries | `meeting_series` | project | Recurring meeting definitions. |

### 3.5 Tier 5 — Financial

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| BudgetItem | `budget_items` | project | Cost-code-level budget lines (original, committed, actual, forecast). |
| ChangeOrder | `change_orders` | project | PCO → COR → CO pipeline with cost/schedule impact tracking. |
| Contract | `contracts` | project | Prime, subcontract, PO, professional services agreements. |
| ScheduleOfValues | `schedule_of_values` | project (child) | Line items within a contract for progress billing. |
| PayApplication | `pay_applications` | project | AIA G702/G703-style payment applications. |
| RetainageLedger | `retainage_ledger` | project | Retainage held/released per contract. |
| JobCostEntry | `job_cost_entries` | project | Individual cost transactions (labor, material, equipment, sub, other). |
| InvoicePayable | `invoices_payable` | project | Vendor invoices received for payment processing. |
| WIPReport | `wip_reports` | project | Work-in-progress financial reporting. |
| PurchaseOrder | `purchase_orders` | project | Material/equipment procurement with line items. |
| POLineItem | `po_line_items` | project (child) | Individual items within a purchase order. |

### 3.6 Tier 6 — Schedule

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| SchedulePhase | `schedule_phases` | project | Project schedule activities with dependencies and critical path. |
| WeeklyCommitment | `weekly_commitments` | project | Lean construction weekly work plan commitments (PPC tracking). |
| LaborForecast | `labor_forecasts` | project | Trade-level headcount/hour projections (manual or AI-predicted). |
| WeatherRecord | `weather_records` | project | Daily weather data for delay tracking. |

### 3.7 Tier 7 — Field Operations

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| DailyLog | `daily_logs` | project | Daily field report with weather, headcount, summary. |
| DailyLogEntry | `daily_log_entries` | project (child) | Line items: manpower, equipment, incidents, notes, materials, visitors, delays. |
| PunchItem | `punch_items` | project | Deficiency items requiring correction before closeout. |
| Delivery | `deliveries` | project | Material delivery tracking. |
| DeliveryItem | `delivery_items` | project (child) | Individual items in a delivery with condition assessment. |
| MaterialInventory | `material_inventory` | project | On-site material tracking with QR codes. |

### 3.8 Tier 8 — Workforce & Equipment

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| Crew | `crews` | project | Named work crews with lead, trade, productivity tracking. |
| WorkforceMember | `workforce_members` | project | Individual workers with trade, rate, skills, certifications. |
| WorkforceAssignment | `workforce_assignments` | project | Worker ↔ crew assignment with date range. |
| TimeEntry | `time_entries` | project | Clock in/out with geolocation, cost codes, approval. |
| Equipment | `equipment` | project | Heavy equipment/tools with rental rates, status, maintenance. |
| EquipmentLog | `equipment_logs` | project (child) | Daily usage logs (hours, fuel, operator). |
| EquipmentMaintenance | `equipment_maintenance` | project (child) | Scheduled/corrective maintenance records. |

### 3.9 Tier 9 — Safety & Compliance

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| SafetyInspection | `safety_inspections` | project | Scheduled safety inspections with scoring. |
| SafetyObservation | `safety_observations` | project | Ad-hoc safety observations (positive or negative). |
| SafetyCertification | `safety_certifications` | project | Worker certifications (OSHA-10, OSHA-30, etc.) with expiration. |
| SafetyInspectionTemplate | `safety_inspection_templates` | project | Reusable inspection checklist templates. |
| Incident | `incidents` | project | Injury, near-miss, property damage, environmental events. |
| ToolboxTalk | `toolbox_talks` | project | Pre-shift safety briefings. |
| ToolboxTalkAttendee | `toolbox_talk_attendees` | project (child) | Attendance records for toolbox talks. |
| Permit | `permits` | project | Building, electrical, plumbing, etc. permits. |
| PermitInspection | `permit_inspections` | project (child) | Inspections required by permits. |
| InsuranceCertificate | `insurance_certificates` | project | COI tracking per subcontractor. |

### 3.10 Tier 10 — Closeout & Sustainability

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| CloseoutItem | `closeout_items` | project | As-builts, O&M manuals, warranties, training, etc. |
| CorrectiveAction | `corrective_actions` | project | Formal corrective actions from inspections/incidents. |
| Warranty | `warranties` | project | Warranty records with expiration tracking. |
| WarrantyClaim | `warranty_claims` | project | Claims filed against warranties. |
| SustainabilityMetric | `sustainability_metrics` | project | LEED/green building metric tracking. |
| WasteLog | `waste_logs` | project | Construction waste disposition (recycled, landfill, etc.). |

### 3.11 Tier 11 — Preconstruction

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| Estimate | `estimates` | project | Cost estimates at various design stages. |
| EstimateLineItem | `estimate_line_items` | project (child) | Hierarchical cost breakdown within an estimate. |
| TakeoffItem | `takeoff_items` | project | Quantity takeoff measurements linked to drawings. |
| BidPackage | `bid_packages` | project | Bid solicitation packages by trade. |
| BidInvitation | `bid_invitations` | project (child) | Individual subcontractor invitations to bid. |
| BidResponse | `bid_responses` | project (child) | Submitted bids with pricing and analysis. |
| CostDatabase | `cost_database` | org | Organization-wide unit cost reference data (RSMeans, historical). |

### 3.12 Tier 12 — System & Integration

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| Notification | `notifications` | user | Per-user notifications with project context. |
| NotificationPreference | `notification_preferences` | user | User delivery preferences (email, push, in-app). |
| ActivityFeed | `activity_feed` | project | Project-level activity stream. |
| AuditLog | `audit_log` | project | Immutable audit trail of all mutations. |
| DirectoryContact | `directory_contacts` | project | Project contact directory (companies, trades, contacts). |
| Integration | `integrations` | org | Third-party connections (QuickBooks, Sage, Procore, etc.). |
| IntegrationSyncLog | `integration_sync_log` | org (child) | Sync execution history. |
| IntegrationFieldMapping | `integration_field_mappings` | org (child) | Field mapping configuration between systems. |
| Webhook | `webhooks` | system | Outbound webhook configurations. |
| WebhookDelivery | `webhook_deliveries` | system (child) | Webhook delivery attempt logs. |
| APIKey | `api_keys` | system | API authentication keys. |
| CustomReport | `custom_reports` | org+project | Saved report configurations. |
| ExecutiveReport | `executive_reports` | org+project | Portfolio-level executive summaries. |

### 3.13 Tier 13 — AI & Agents

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| AIAgent | `ai_agents` | project | Configured AI agent instances per project. |
| AIAgentAction | `ai_agent_actions` | project | Individual AI actions with confidence scores and approval status. |
| AIInsight | `ai_insights` | project | AI-generated insights surfaced in the UI. |
| AIUsage | `ai_usage` | project | Token/cost tracking for AI operations. |

### 3.14 Tier 14 — Portal (External Access)

| Kernel Entity | DB Table | Scope | Description |
|---|---|---|---|
| PortalUser | `portal_users` | project | External users (owners, architects, inspectors) with limited access. |
| PortalInvitation | `portal_invitations` | project | Invitation tokens for portal onboarding. |
| PortalAccessToken | `portal_access_tokens` | project | Session tokens for portal authentication. |
| OwnerUpdate | `owner_updates` | project | Published project updates visible to owner portal. |

### 3.15 Entity-to-Table Mapping (Complete)

| # | Kernel Entity | DB Table | Scope | Gap Status |
|---|---|---|---|---|
| 1 | Organization | `organizations` | org | ✅ exists |
| 2 | OrganizationMember | `organization_members` | org | ✅ exists |
| 3 | OrganizationSettings | `organization_settings` | org | ✅ exists |
| 4 | Portfolio | `portfolios` | org | ✅ exists |
| 5 | PortfolioProject | `portfolio_projects` | org | ✅ exists |
| 6 | Project | `projects` | project | ✅ exists |
| 7 | ProjectMember | `project_members` | project | ⚠️ role enum mismatch (DB has owner/admin/member/viewer; kernel needs owner/admin/project_manager/superintendent/subcontractor/viewer) |
| 8 | ProjectSnapshot | `project_snapshots` | project | ✅ exists |
| 9 | Drawing | `drawings` | project | ✅ exists |
| 10 | DrawingMarkup | `drawing_markups` | project | ✅ exists |
| 11 | File | `files` | project | ✅ exists |
| 12 | Transmittal | `transmittals` | project | ✅ exists |
| 13 | FieldCapture | `field_captures` | project | ✅ exists |
| 14 | RFI | `rfis` | project | ✅ exists |
| 15 | RFIResponse | `rfi_responses` | project (child) | ✅ exists |
| 16 | RFIWatcher | `rfi_watchers` | project (child) | ✅ exists |
| 17 | Submittal | `submittals` | project | ✅ exists |
| 18 | SubmittalApproval | `submittal_approvals` | project (child) | ✅ exists |
| 19 | Task | `tasks` | project | ✅ exists |
| 20 | TaskTemplate | `task_templates` | project | ✅ exists |
| 21 | Meeting | `meetings` | project | ✅ exists |
| 22 | MeetingAttendee | `meeting_attendees` | project (child) | ✅ exists |
| 23 | MeetingActionItem | `meeting_action_items` | project (child) | ✅ exists |
| 24 | MeetingAgendaItem | `meeting_agenda_items` | project (child) | ✅ exists |
| 25 | MeetingSeries | `meeting_series` | project | ✅ exists |
| 26 | BudgetItem | `budget_items` | project | ✅ exists |
| 27 | ChangeOrder | `change_orders` | project | ✅ exists |
| 28 | Contract | `contracts` | project | ✅ exists |
| 29 | ScheduleOfValues | `schedule_of_values` | project (child) | ✅ exists |
| 30 | PayApplication | `pay_applications` | project | ✅ exists |
| 31 | RetainageLedger | `retainage_ledger` | project | ✅ exists |
| 32 | JobCostEntry | `job_cost_entries` | project | ✅ exists |
| 33 | InvoicePayable | `invoices_payable` | project | ✅ exists |
| 34 | WIPReport | `wip_reports` | project | ✅ exists |
| 35 | PurchaseOrder | `purchase_orders` | project | ✅ exists |
| 36 | POLineItem | `po_line_items` | project (child) | ✅ exists |
| 37 | SchedulePhase | `schedule_phases` | project | ✅ exists |
| 38 | WeeklyCommitment | `weekly_commitments` | project | ✅ exists |
| 39 | LaborForecast | `labor_forecasts` | project | ✅ exists |
| 40 | WeatherRecord | `weather_records` | project | ✅ exists |
| 41 | DailyLog | `daily_logs` | project | ✅ exists |
| 42 | DailyLogEntry | `daily_log_entries` | project (child) | ✅ exists |
| 43 | PunchItem | `punch_items` | project | ✅ exists |
| 44 | Delivery | `deliveries` | project | ✅ exists |
| 45 | DeliveryItem | `delivery_items` | project (child) | ✅ exists |
| 46 | MaterialInventory | `material_inventory` | project | ✅ exists |
| 47 | Crew | `crews` | project | ✅ exists |
| 48 | WorkforceMember | `workforce_members` | project | ✅ exists |
| 49 | WorkforceAssignment | `workforce_assignments` | project | ✅ exists |
| 50 | TimeEntry | `time_entries` | project | ✅ exists |
| 51 | Equipment | `equipment` | project | ✅ exists |
| 52 | EquipmentLog | `equipment_logs` | project (child) | ✅ exists |
| 53 | EquipmentMaintenance | `equipment_maintenance` | project (child) | ✅ exists |
| 54 | SafetyInspection | `safety_inspections` | project | ✅ exists |
| 55 | SafetyObservation | `safety_observations` | project | ✅ exists |
| 56 | SafetyCertification | `safety_certifications` | project | ✅ exists |
| 57 | SafetyInspectionTemplate | `safety_inspection_templates` | project | ✅ exists |
| 58 | Incident | `incidents` | project | ✅ exists |
| 59 | ToolboxTalk | `toolbox_talks` | project | ✅ exists |
| 60 | ToolboxTalkAttendee | `toolbox_talk_attendees` | project (child) | ✅ exists |
| 61 | Permit | `permits` | project | ✅ exists |
| 62 | PermitInspection | `permit_inspections` | project (child) | ✅ exists |
| 63 | InsuranceCertificate | `insurance_certificates` | project | ✅ exists |
| 64 | CloseoutItem | `closeout_items` | project | ✅ exists |
| 65 | CorrectiveAction | `corrective_actions` | project | ✅ exists |
| 66 | Warranty | `warranties` | project | ✅ exists |
| 67 | WarrantyClaim | `warranty_claims` | project | ✅ exists |
| 68 | SustainabilityMetric | `sustainability_metrics` | project | ✅ exists |
| 69 | WasteLog | `waste_logs` | project | ✅ exists |
| 70 | Estimate | `estimates` | project | ✅ exists |
| 71 | EstimateLineItem | `estimate_line_items` | project (child) | ✅ exists |
| 72 | TakeoffItem | `takeoff_items` | project | ✅ exists |
| 73 | BidPackage | `bid_packages` | project | ✅ exists |
| 74 | BidInvitation | `bid_invitations` | project (child) | ✅ exists |
| 75 | BidResponse | `bid_responses` | project (child) | ✅ exists |
| 76 | CostDatabase | `cost_database` | org | ✅ exists |
| 77 | Notification | `notifications` | user | ✅ exists |
| 78 | NotificationPreference | `notification_preferences` | user | ✅ exists |
| 79 | ActivityFeed | `activity_feed` | project | ✅ exists |
| 80 | AuditLog | `audit_log` | project | ✅ exists |
| 81 | DirectoryContact | `directory_contacts` | project | ✅ exists |
| 82 | Integration | `integrations` | org | ✅ exists |
| 83 | IntegrationSyncLog | `integration_sync_log` | org (child) | ✅ exists |
| 84 | IntegrationFieldMapping | `integration_field_mappings` | org (child) | ✅ exists |
| 85 | Webhook | `webhooks` | system | ✅ exists |
| 86 | WebhookDelivery | `webhook_deliveries` | system (child) | ✅ exists |
| 87 | APIKey | `api_keys` | system | ✅ exists |
| 88 | CustomReport | `custom_reports` | org+project | ✅ exists |
| 89 | ExecutiveReport | `executive_reports` | org+project | ✅ exists |
| 90 | AIAgent | `ai_agents` | project | ✅ exists |
| 91 | AIAgentAction | `ai_agent_actions` | project | ✅ exists |
| 92 | AIInsight | `ai_insights` | project | ✅ exists |
| 93 | AIUsage | `ai_usage` | project | ✅ exists |
| 94 | PortalUser | `portal_users` | project | ✅ exists |
| 95 | PortalInvitation | `portal_invitations` | project | ✅ exists |
| 96 | PortalAccessToken | `portal_access_tokens` | project | ✅ exists |
| 97 | OwnerUpdate | `owner_updates` | project | ✅ exists |

**Critical Gap:** `project_members.role` CHECK constraint currently allows `('owner', 'admin', 'member', 'viewer')` but the kernel requires `('owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer')`. The frontend `usePermissions.ts` already uses the 6-role model. The database constraint must be updated to match.

---

## 4. Entity Relationships

### 4.1 Relationship Types

| Type | Notation | Meaning | Cascade Rule |
|---|---|---|---|
| **owns** | `A ──owns──▸ B` | A is parent; deleting A deletes B | `ON DELETE CASCADE` |
| **references** | `A ──refs──▸ B` | A points to B; B may exist independently | `ON DELETE SET NULL` or restrict |
| **belongs-to** | `A ──belongs──▸ B` | A is scoped under B (mandatory FK, not null) | `ON DELETE CASCADE` |

### 4.2 Core Entity Relationship Graph

```
Organization
├──owns──▸ OrganizationMember
├──owns──▸ OrganizationSettings
├──owns──▸ Portfolio ──owns──▸ PortfolioProject ──refs──▸ Project
├──owns──▸ Integration ──owns──▸ IntegrationSyncLog
│                       ──owns──▸ IntegrationFieldMapping
├──owns──▸ CostDatabase
│
└──owns──▸ Project
           ├──owns──▸ ProjectMember
           ├──owns──▸ ProjectSnapshot
           │
           ├── Document Control ─────────────────────────
           │   ├──owns──▸ Drawing ──owns──▸ DrawingMarkup
           │   │                   ◂──refs── TakeoffItem
           │   │                   ◂──refs── FieldCapture
           │   ├──owns──▸ File
           │   └──owns──▸ Transmittal ──refs──▸ File[]
           │
           ├── Communication ────────────────────────────
           │   ├──owns──▸ RFI ──owns──▸ RFIResponse
           │   │              ──owns──▸ RFIWatcher
           │   │              ──refs──▸ Drawing (drawing_reference)
           │   ├──owns──▸ Submittal ──owns──▸ SubmittalApproval
           │   │                     ──refs──▸ Submittal (parent_submittal_id, resubmissions)
           │   ├──owns──▸ Task ──refs──▸ Task (parent_task_id, subtasks)
           │   └──owns──▸ Meeting ──owns──▸ MeetingAttendee
           │                       ──owns──▸ MeetingActionItem
           │                       ──owns──▸ MeetingAgendaItem
           │                       ──refs──▸ MeetingSeries
           │
           ├── Financial ────────────────────────────────
           │   ├──owns──▸ BudgetItem ◂──refs── ChangeOrder
           │   │                     ◂──refs── JobCostEntry
           │   │                     ◂──refs── InvoicePayable
           │   │                     ◂──refs── PurchaseOrder
           │   ├──owns──▸ ChangeOrder ──refs──▸ ChangeOrder (promoted_from_id)
           │   │                      ──refs──▸ BudgetItem
           │   ├──owns──▸ Contract ──owns──▸ ScheduleOfValues
           │   │                   ──owns──▸ RetainageLedger
           │   │                   ◂──refs── PayApplication
           │   │                   ◂──refs── JobCostEntry
           │   ├──owns──▸ PayApplication ──refs──▸ Contract
           │   ├──owns──▸ JobCostEntry ──refs──▸ Contract, BudgetItem
           │   ├──owns──▸ InvoicePayable ──refs──▸ BudgetItem, PurchaseOrder
           │   ├──owns──▸ WIPReport
           │   └──owns──▸ PurchaseOrder ──owns──▸ POLineItem
           │                            ◂──refs── Delivery
           │                            ──refs──▸ BudgetItem
           │
           ├── Schedule ─────────────────────────────────
           │   ├──owns──▸ SchedulePhase ──refs──▸ SchedulePhase (depends_on)
           │   │                        ──refs──▸ Crew (assigned_crew_id)
           │   ├──owns──▸ WeeklyCommitment ──refs──▸ Task, Crew
           │   ├──owns──▸ LaborForecast
           │   └──owns──▸ WeatherRecord
           │
           ├── Field ────────────────────────────────────
           │   ├──owns──▸ DailyLog ──owns──▸ DailyLogEntry
           │   ├──owns──▸ PunchItem
           │   ├──owns──▸ Delivery ──owns──▸ DeliveryItem ──refs──▸ POLineItem
           │   │                   ──refs──▸ PurchaseOrder
           │   └──owns──▸ MaterialInventory
           │
           ├── Workforce ────────────────────────────────
           │   ├──owns──▸ Crew
           │   ├──owns──▸ WorkforceMember
           │   ├──owns──▸ WorkforceAssignment ──refs──▸ WorkforceMember, Crew
           │   ├──owns──▸ TimeEntry ──refs──▸ WorkforceMember
           │   ├──owns──▸ Equipment ──owns──▸ EquipmentLog
           │   │                     ──owns──▸ EquipmentMaintenance
           │
           ├── Safety ──────────────────────────────────
           │   ├──owns──▸ SafetyInspection
           │   ├──owns──▸ SafetyObservation
           │   ├──owns──▸ SafetyCertification
           │   ├──owns──▸ Incident
           │   ├──owns──▸ ToolboxTalk ──owns──▸ ToolboxTalkAttendee
           │   ├──owns──▸ Permit ──owns──▸ PermitInspection
           │   └──owns──▸ InsuranceCertificate
           │
           ├── Closeout ────────────────────────────────
           │   ├──owns──▸ CloseoutItem
           │   ├──owns──▸ Warranty ──owns──▸ WarrantyClaim
           │   ├──owns──▸ CorrectiveAction
           │   ├──owns──▸ SustainabilityMetric
           │   └──owns──▸ WasteLog
           │
           ├── Preconstruction ─────────────────────────
           │   ├──owns──▸ Estimate ──owns──▸ EstimateLineItem
           │   ├──owns──▸ TakeoffItem ──refs──▸ Drawing
           │   └──owns──▸ BidPackage ──owns──▸ BidInvitation
           │                          ──owns──▸ BidResponse ──refs──▸ BidInvitation
           │
           ├── AI ──────────────────────────────────────
           │   ├──owns──▸ AIAgent ──owns──▸ AIAgentAction
           │   ├──owns──▸ AIInsight
           │   └──owns──▸ AIUsage
           │
           └── Portal ─────────────────────────────────
               ├──owns──▸ PortalUser
               ├──owns──▸ PortalInvitation
               ├──owns──▸ PortalAccessToken
               └──owns──▸ OwnerUpdate
```

### 4.3 Cross-Entity Linking (Key Relationships)

These relationships connect entities across domain tiers:

| From | To | FK Column | Purpose |
|---|---|---|---|
| `rfis` | `drawings` | `drawing_reference` (text) | RFI references a specific drawing |
| `drawing_markups` | `rfis` | `linked_rfi_id` | Markup linked to an RFI |
| `drawing_markups` | `punch_items` | `linked_punch_item_id` | Markup linked to a punch item |
| `change_orders` | `budget_items` | `budget_line_item_id` | CO impacts a budget line |
| `change_orders` | `change_orders` | `promoted_from_id` | PCO→COR→CO promotion chain |
| `invoices_payable` | `purchase_orders` | `purchase_order_id` | Invoice matches a PO |
| `job_cost_entries` | `budget_items` | `budget_item_id` | Cost posts to budget line |
| `job_cost_entries` | `contracts` | `contract_id` | Cost charged to a contract |
| `delivery_items` | `po_line_items` | `po_line_item_id` | Delivery fulfills PO line |
| `weekly_commitments` | `tasks` | `task_id` | Commitment maps to a task |
| `weekly_commitments` | `crews` | `crew_id` | Commitment assigned to a crew |
| `field_captures` | `drawings` | `linked_drawing_id` | Field photo pinned to a drawing |
| `schedule_phases` | `schedule_phases` | `depends_on` | Schedule dependency chain |
| `schedule_phases` | `crews` | `assigned_crew_id` | Activity assigned to a crew |
| `submittals` | `submittals` | `parent_submittal_id` | Resubmission chain |
| `tasks` | `tasks` | `parent_task_id` | Task hierarchy |
| `estimate_line_items` | `estimate_line_items` | `parent_id` | Estimate breakdown hierarchy |
| `files` | `files` | `previous_version_id` | File version chain |
| `drawings` | `drawings` | `previous_revision_id` | Drawing revision chain |
| `equipment` | `projects` | `current_project_id` | Equipment's current location |

---

## 5. State Machines

Every stateful entity uses a PostgreSQL `text` column with a `CHECK` constraint defining the allowed values. State transitions are enforced at the application layer (hooks/edge functions) and will be enforced at the database layer via `BEFORE UPDATE` trigger functions after the gap analysis migrations.

### 5.1 RFI State Machine

```
         ┌─────────┐
         │  draft   │
         └────┬─────┘
              │ submit (creator)
              ▼
         ┌─────────┐
         │  open    │◄──────────────────┐
         └────┬─────┘                   │
              │ assign/review           │ reopen (owner, admin, pm)
              ▼                         │
     ┌───────────────┐                  │
     │ under_review   │                 │
     └───────┬───────┘                  │
             │ respond (assignee)       │
             ▼                          │
      ┌───────────┐                     │
      │  answered  ├────────────────────┘
      └─────┬─────┘
            │ accept & close (creator or pm)
            ▼
      ┌───────────┐
      │  closed    │
      └───────────┘

  Any state except closed/void ──void──▸ void (owner, admin only)
```

**Transition Rules:**

| Entity | From | To | Allowed Roles | Side Effects |
|---|---|---|---|---|
| RFI | `draft` | `open` | owner, admin, pm, superintendent | Set `ball_in_court` = `assigned_to ?? created_by`; set default `due_date` = today + 7 if null; auto-add watchers (creator, assignee) |
| RFI | `open` | `under_review` | owner, admin, pm, superintendent | Set `ball_in_court` = `assigned_to` |
| RFI | `under_review` | `answered` | owner, admin, pm, superintendent, subcontractor | Set `ball_in_court` = `created_by`; requires at least one `rfi_responses` row with `is_official = true` |
| RFI | `answered` | `closed` | owner, admin, pm | Set `ball_in_court` = null; set `closed_date` = today |
| RFI | `answered` | `open` | owner, admin, pm | Set `ball_in_court` = `assigned_to`; reopen for additional clarification |
| RFI | `*` (not `closed`/`void`) | `void` | owner, admin | Requires `void_reason`; set `ball_in_court` = null |

**Ball-in-Court Logic (computed on transition, stored as column):**

| Status | Ball-in-Court |
|---|---|
| `draft` | `created_by` |
| `open` | `assigned_to` (fallback: `created_by`) |
| `under_review` | `assigned_to` |
| `answered` | `created_by` |
| `closed` | null |
| `void` | null |

### 5.2 Submittal State Machine

```
     ┌─────────┐
     │  draft   │
     └────┬─────┘
          │ submit (sub or pm)
          ▼
    ┌───────────┐
    │ submitted  │
    └─────┬─────┘
          │ begin review (pm)
          ▼
  ┌───────────────┐          ┌───────────┐
  │ under_review   │──reject──▸│ rejected  │
  └───────┬───────┘          └─────┬─────┘
          │                        │ resubmit (creates new revision)
          │ approve                ▼
          ▼                  [new Submittal with parent_submittal_id,
    ┌───────────┐             revision_number + 1, status = draft]
    │ approved   │
    └─────┬─────┘
          │                  ┌───────────┐
          ├── or ──────────▸ │ resubmit  │ (reviewer requests changes)
          │                  └───────────┘
          │ close
          ▼
    ┌───────────┐
    │  closed    │
    └───────────┘
```

**Transition Rules:**

| Entity | From | To | Allowed Roles | Side Effects |
|---|---|---|---|---|
| Submittal | `draft` | `submitted` | owner, admin, pm, subcontractor | Set `submitted_date` = today; create `submittal_approvals` rows per `approval_chain`; set `current_reviewer` = first in chain |
| Submittal | `submitted` | `under_review` | owner, admin, pm | Update `current_reviewer` to active reviewer |
| Submittal | `under_review` | `approved` | owner, admin, pm | Set `approved_date` = today; all `submittal_approvals` must have `status = 'approved'` |
| Submittal | `under_review` | `rejected` | owner, admin, pm | At least one `submittal_approvals` has `status = 'rejected'` |
| Submittal | `under_review` | `resubmit` | owner, admin, pm | Reviewer requests revisions before final approval |
| Submittal | `rejected` | `draft` | owner, admin, pm, subcontractor | Creates new revision: `revision_number` + 1, `parent_submittal_id` = current ID |
| Submittal | `approved` | `closed` | owner, admin, pm | Set `closed_date` = today |

**Approval Chain:** Stored as `approval_chain jsonb` (e.g., `["gc_pm", "architect"]`). Each entry maps to a `submittal_approvals` row. The submittal advances through reviewers in `chain_order` sequence.

### 5.3 Change Order State Machine (PCO → COR → CO Pipeline)

Change orders use a `type` field (`pco`, `cor`, `co`) combined with a `status` field. The promotion pipeline is:

```
PCO (Potential Change Order)
  draft → submitted → under_review → approved/rejected
  If approved → promote to COR

COR (Change Order Request)  
  draft → submitted → under_review → approved/rejected
  If approved → promote to CO

CO (Change Order)
  draft → submitted → approved/rejected → executed
```

**Transition Rules:**

| Entity | Type | From | To | Allowed Roles | Side Effects |
|---|---|---|---|---|---|
| ChangeOrder | pco | `draft` | `submitted` | owner, admin, pm | Set `submitted_by`, `submitted_at` |
| ChangeOrder | pco | `submitted` | `under_review` | owner, admin, pm | Set `reviewed_by`, `reviewed_at` |
| ChangeOrder | pco | `under_review` | `approved` | owner, admin | Set `approved_by`, `approved_at`, `approved_cost` |
| ChangeOrder | pco | `under_review` | `rejected` | owner, admin | Set `rejected_by`, `rejected_at`, `rejection_comments` |
| ChangeOrder | pco | `approved` | (promote) | owner, admin, pm | Creates new COR with `promoted_from_id` = PCO.id, `promoted_at` = now |
| ChangeOrder | cor | `draft` | `submitted` | owner, admin, pm | Set `submitted_by`, `submitted_at`; set `submitted_cost` |
| ChangeOrder | cor | `submitted` | `under_review` | owner, admin | — |
| ChangeOrder | cor | `under_review` | `approved` | owner, admin | — |
| ChangeOrder | cor | `under_review` | `rejected` | owner, admin | — |
| ChangeOrder | cor | `approved` | (promote) | owner, admin, pm | Creates new CO with `promoted_from_id` = COR.id |
| ChangeOrder | co | `draft` | `submitted` | owner, admin, pm | — |
| ChangeOrder | co | `submitted` | `approved` | owner, admin | Update `budget_items.committed_amount` += `approved_cost`; update `projects.contract_value` |
| ChangeOrder | co | `submitted` | `rejected` | owner, admin | — |
| ChangeOrder | co | `approved` | `executed` | owner, admin | Lock record; record in `audit_log` |

**Reason Codes:** `owner_change`, `design_error`, `field_condition`, `regulatory`, `value_engineering`, `unforeseen`

### 5.4 Pay Application State Machine

```
  ┌─────────┐
  │  draft   │
  └────┬─────┘
       │ submit (pm)
       ▼
  ┌───────────┐
  │ submitted  │
  └─────┬─────┘
       │ certify (owner, admin)
       ▼
  ┌───────────┐
  │ certified  │
  └─────┬─────┘
       │ mark paid (owner, admin)
       ▼
  ┌─────────┐
  │  paid    │
  └─────────┘
```

**Transition Rules:**

| Entity | From | To | Allowed Roles | Side Effects |
|---|---|---|---|---|
| PayApplication | `draft` | `submitted` | owner, admin, pm | Set `submitted_date` = today; calculate totals from `schedule_of_values` |
| PayApplication | `submitted` | `certified` | owner, admin | Set `certified_date` = today; set `certified_by` = current user |
| PayApplication | `certified` | `paid` | owner, admin | Set `paid_date` = today; set `paid_amount`; update `retainage_ledger` |

### 5.5 Punch Item State Machine

```
  ┌─────────┐
  │  open    │
  └────┬─────┘
       │ start work (assigned sub/superintendent)
       ▼
  ┌──────────────┐
  │ in_progress   │
  └──────┬───────┘
       │ mark resolved (assigned sub/superintendent)
       ▼
  ┌───────────┐
  │ resolved   │──reject──▸ open (pm verifies, finds incomplete)
  └─────┬─────┘
       │ verify (pm)
       ▼
  ┌───────────┐
  │ verified   │
  └───────────┘
```

**Transition Rules:**

| Entity | From | To | Allowed Roles | Side Effects |
|---|---|---|---|---|
| PunchItem | `open` | `in_progress` | owner, admin, pm, superintendent, subcontractor | — |
| PunchItem | `in_progress` | `resolved` | owner, admin, pm, superintendent, subcontractor | Set `resolved_date` = today |
| PunchItem | `resolved` | `verified` | owner, admin, pm | Set `verified_date` = today |
| PunchItem | `resolved` | `open` | owner, admin, pm | Clear `resolved_date` (verification failed) |

### 5.6 Daily Log State Machine

```
  ┌─────────┐
  │  draft   │
  └────┬─────┘
       │ submit (superintendent)
       ▼
  ┌───────────┐
  │ submitted  │──reject──▸ draft (pm sends back for corrections)
  └─────┬─────┘
       │ approve (pm)
       ▼
  ┌───────────┐
  │ approved   │
  └───────────┘
```

**Transition Rules:**

| Entity | From | To | Allowed Roles | Side Effects |
|---|---|---|---|---|
| DailyLog | `draft` | `submitted` | owner, admin, pm, superintendent | Set `superintendent_signature_url` (optional) |
| DailyLog | `submitted` | `approved` | owner, admin, pm | Set `approved` = true; set `approved_by` = current user; set `approved_at` = now; set `manager_signature_url` (optional) |
| DailyLog | `submitted` | `rejected` | owner, admin, pm | Set `rejection_comments` (required) |
| DailyLog | `rejected` | `draft` | owner, admin, pm, superintendent | Clear rejection; allow edits |
| DailyLog | `approved` | — | — | **Terminal state.** Approved logs are immutable. |

### 5.7 Permit State Machine

```
  ┌──────────────┐
  │ not_applied    │
  └──────┬───────┘
         │ apply
         ▼
  ┌────────────────────┐
  │ application_submitted│
  └──────────┬─────────┘
             │ authority begins review
             ▼
  ┌───────────────┐          ┌─────────┐
  │ under_review   │──deny───▸│ denied  │
  └───────┬───────┘          └─────────┘
          │ approve
          ▼
  ┌───────────┐
  │ approved   │──expire──▸ expired
  └─────┬─────┘
        │ all inspections passed, close
        ▼
  ┌───────────┐
  │  closed    │
  └───────────┘
```

**Transition Rules:**

| Entity | From | To | Allowed Roles | Side Effects |
|---|---|---|---|---|
| Permit | `not_applied` | `application_submitted` | owner, admin, pm | Set `applied_date` = today |
| Permit | `application_submitted` | `under_review` | owner, admin, pm | — |
| Permit | `under_review` | `approved` | owner, admin, pm | Set `issued_date`; set `expiration_date` |
| Permit | `under_review` | `denied` | owner, admin, pm | — |
| Permit | `approved` | `expired` | system (cron) | Triggered when `expiration_date` < today |
| Permit | `approved` | `closed` | owner, admin, pm | All `permit_inspections` must have `status` = `passed` |

### 5.8 Permit Inspection State Machine

```
  ┌────────────────┐
  │ not_scheduled    │
  └──────┬─────────┘
         │ schedule
         ▼
  ┌───────────┐
  │ scheduled  │──cancel──▸ cancelled
  └─────┬─────┘
        │ inspect
        ▼
  ┌───────┐   ┌───────────┐
  │ passed │   │  failed    │──re-inspect──▸ scheduled
  └───────┘   └───────────┘
              │
              ▼
          ┌──────────┐
          │ partial   │──re-inspect──▸ scheduled
          └──────────┘
```

**Transition Rules:**

| Entity | From | To | Allowed Roles | Side Effects |
|---|---|---|---|---|
| PermitInspection | `not_scheduled` | `scheduled` | owner, admin, pm, superintendent | Set `scheduled_date` |
| PermitInspection | `scheduled` | `passed` | owner, admin, pm, superintendent | Set `result_notes` |
| PermitInspection | `scheduled` | `failed` | owner, admin, pm, superintendent | Set `corrections_required` (required) |
| PermitInspection | `scheduled` | `partial` | owner, admin, pm, superintendent | Set `result_notes`, `corrections_required` |
| PermitInspection | `failed` | `scheduled` | owner, admin, pm, superintendent | Set `re_inspection_date` |
| PermitInspection | `partial` | `scheduled` | owner, admin, pm, superintendent | Set `re_inspection_date` |
| PermitInspection | `scheduled` | `cancelled` | owner, admin, pm | — |

---

## 6. Temporal, Versioning, and Supersession Rules

### 6.1 Required Temporal Columns

Every table in the kernel must have these columns:

| Column | Type | Default | Nullable | Purpose |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NO | Primary key |
| `created_at` | `timestamptz` | `now()` | NO | Row creation timestamp |
| `updated_at` | `timestamptz` | `now()` | YES | Last modification timestamp (auto-set by `update_updated_at()` trigger) |

**Audit columns** (required on all entities that support user-initiated creation):

| Column | Type | Default | Nullable | Purpose |
|---|---|---|---|---|
| `created_by` | `uuid` | — | YES | FK to `auth.users` — who created |

**Gap:** Many existing tables have `created_at`/`updated_at` but are missing `created_by`. The gap analysis will enumerate these.

### 6.2 Versioned Entity Rules

These entities support explicit versioning:

| Entity | Version Column | Supersession Column | Supersession Semantics |
|---|---|---|---|
| Drawing | `revision` (text, e.g., "A", "B") | `previous_revision_id` | New revision supersedes previous; old status → `superseded` |
| File | `version` (int, auto-increment) | `previous_version_id` | New version supersedes previous; old version retained for history |
| Submittal | `revision_number` (int) | `parent_submittal_id` | Resubmission creates new row with incremented `revision_number` |
| Estimate | `version` (int) | — | New version replaces old; old kept for comparison |

**Versioning Rules:**

1. **Creating a new version** never deletes the previous version. The old version remains in the database with its original data intact.
2. **Drawing supersession:** When a new revision is uploaded, the previous drawing's `status` is set to `superseded`. Only one drawing per `(project_id, sheet_number)` combination may have `status = 'current'` at a time.
3. **File versioning:** Files form a singly-linked list via `previous_version_id`. The latest version has the highest `version` number.
4. **Submittal resubmission:** A rejected submittal is resubmitted by creating a new `submittals` row with `parent_submittal_id` pointing to the rejected one, and `revision_number` incremented.

### 6.3 Soft Delete Policy

SiteSync PM uses **soft delete** for all business entities. Hard delete is reserved for:
- Cascade deletions when a parent project or organization is deleted
- Child join-table rows (e.g., watchers, attendees) that have no audit significance

**Soft delete implementation:**

| Column | Type | Default | Purpose |
|---|---|---|---|
| `deleted_at` | `timestamptz` | `null` | Non-null means soft-deleted |
| `deleted_by` | `uuid` | `null` | FK to `auth.users` — who deleted |

**Gap:** Most existing tables lack `deleted_at`/`deleted_by` columns. The gap analysis will add these.

**RLS enforcement:** All `SELECT` policies must include `AND deleted_at IS NULL` (or be rewritten as views) to hide soft-deleted rows from normal queries. Service-role access can see deleted rows for audit/recovery.

### 6.4 AI Trust Levels

Every field that may contain AI-generated content carries a trust tag:

| Trust Level | Code | Meaning | UI Treatment |
|---|---|---|---|
| Human-authored | `human` | Created/edited by a human user | No badge |
| AI-suggested | `ai_suggested` | AI generated, not yet reviewed | Yellow badge: "AI Suggested" |
| AI-approved | `ai_approved` | AI generated, human reviewed and accepted | Blue badge: "AI Assisted" |
| AI-rejected | `ai_rejected` | AI generated, human reviewed and rejected | Hidden from UI |

**Implementation:** Entities with AI-generatable fields include a `trust_level` column on the field or a `metadata jsonb` column containing `{"trust": "ai_suggested", "ai_model": "...", "ai_confidence": 0.92}`.

**Existing AI columns in schema:**
- `daily_logs.ai_summary` — AI-generated daily log summary
- `ai_insights.*` — All AI insight content
- `bid_responses.ai_analysis` — AI analysis of bid
- `field_captures.ai_category`, `ai_tags` — AI classification
- `drawings.ai_changes_detected` — AI drawing comparison

---

## 7. Permission Matrix

### 7.1 Role Definitions

| Role | Level | Scope | Description |
|---|---|---|---|
| `owner` | 6 | org + project | Organization owner. Full access to everything. Cannot be removed. |
| `admin` | 5 | org + project | Full project access, org settings. Can manage members. |
| `project_manager` | 4 | project | Day-to-day project management. Approves logs, verifies punch items, manages workflows. |
| `superintendent` | 3 | project | Field operations. Creates daily logs, manages crews, safety. Limited financial access. |
| `subcontractor` | 2 | project | External contractor. Creates submittals, responds to RFIs. Sees only assigned scope. |
| `viewer` | 1 | project | Read-only access to permitted modules. Cannot create, edit, or delete. |

**Role hierarchy rule:** A user with role level N has all explicit permissions defined for that role. Roles do NOT automatically inherit lower-role permissions — each role's permission set is explicitly defined in the matrix below.

### 7.2 Full Permission Matrix

Legend: **C** = Create, **R** = Read, **U** = Update, **D** = Delete, **T** = Transition (state change), **A** = Approve/Reject

| Permission | owner | admin | pm | super | sub | viewer |
|---|---|---|---|---|---|---|
| **Dashboard** | | | | | | |
| `dashboard.view` | R | R | R | R | R | R |
| **Tasks** | | | | | | |
| `tasks.view` | R | R | R | R | R | R |
| `tasks.create` | C | C | C | C | — | — |
| `tasks.edit` | U | U | U | U | — | — |
| `tasks.delete` | D | D | D | — | — | — |
| `tasks.assign` | U | U | U | U | — | — |
| **RFIs** | | | | | | |
| `rfis.view` | R | R | R | R | R | R |
| `rfis.create` | C | C | C | C | — | — |
| `rfis.edit` | U | U | U | — | — | — |
| `rfis.respond` | T | T | T | T | T | — |
| `rfis.delete` | D | D | D | — | — | — |
| `rfis.void` | T | T | — | — | — | — |
| **Submittals** | | | | | | |
| `submittals.view` | R | R | R | R | R | R |
| `submittals.create` | C | C | C | — | C | — |
| `submittals.edit` | U | U | U | — | — | — |
| `submittals.approve` | A | A | A | — | — | — |
| `submittals.delete` | D | D | D | — | — | — |
| **Budget** | | | | | | |
| `budget.view` | R | R | R | R | — | — |
| `budget.edit` | U | U | U | — | — | — |
| `budget.approve` | A | A | — | — | — | — |
| **Change Orders** | | | | | | |
| `change_orders.view` | R | R | R | R | — | — |
| `change_orders.create` | C | C | C | — | — | — |
| `change_orders.edit` | U | U | U | — | — | — |
| `change_orders.approve` | A | A | — | — | — | — |
| `change_orders.delete` | D | D | — | — | — | — |
| `change_orders.promote` | T | T | T | — | — | — |
| **Financials** | | | | | | |
| `financials.view` | R | R | R | — | — | — |
| `financials.edit` | U | U | U | — | — | — |
| **Estimating** | | | | | | |
| `estimating.view` | R | R | R | — | — | — |
| **Procurement** | | | | | | |
| `procurement.view` | R | R | R | R | — | — |
| **Schedule** | | | | | | |
| `schedule.view` | R | R | R | R | R | R |
| `schedule.edit` | U | U | U | — | — | — |
| **Daily Logs** | | | | | | |
| `daily_log.view` | R | R | R | R | — | R |
| `daily_log.create` | C | C | C | C | — | — |
| `daily_log.edit` | U | U | U | U | — | — |
| `daily_log.submit` | T | T | T | T | — | — |
| `daily_log.approve` | A | A | A | — | — | — |
| `daily_log.reject` | A | A | A | — | — | — |
| **Punch List** | | | | | | |
| `punch_list.view` | R | R | R | R | R | R |
| `punch_list.create` | C | C | C | C | — | — |
| `punch_list.edit` | U | U | U | U | — | — |
| `punch_list.delete` | D | D | D | — | — | — |
| `punch_list.verify` | A | A | A | — | — | — |
| **Drawings** | | | | | | |
| `drawings.view` | R | R | R | R | R | R |
| `drawings.upload` | C | C | C | — | — | — |
| `drawings.markup` | U | U | U | U | — | — |
| `drawings.delete` | D | D | — | — | — | — |
| **Files** | | | | | | |
| `files.view` | R | R | R | R | R | R |
| `files.upload` | C | C | C | C | — | — |
| `files.download` | R | R | R | R | R | R |
| `files.delete` | D | D | D | — | — | — |
| **Field Capture** | | | | | | |
| `field_capture.view` | R | R | R | R | — | R |
| `field_capture.create` | C | C | C | C | — | — |
| **Crews** | | | | | | |
| `crews.view` | R | R | R | R | — | R |
| `crews.manage` | CUD | CUD | CUD | — | — | — |
| **Safety** | | | | | | |
| `safety.view` | R | R | R | R | — | R |
| `safety.manage` | CUD | CUD | CUD | CUD | — | — |
| **Directory** | | | | | | |
| `directory.view` | R | R | R | R | R | R |
| `directory.manage` | CUD | CUD | CUD | — | — | — |
| **Meetings** | | | | | | |
| `meetings.view` | R | R | R | R | R | R |
| `meetings.create` | C | C | C | — | — | — |
| `meetings.delete` | D | D | — | — | — | — |
| **Project Admin** | | | | | | |
| `project.settings` | U | U | — | — | — | — |
| `project.members` | CUD | CUD | — | — | — | — |
| `project.delete` | D | — | — | — | — | — |
| **Org Admin** | | | | | | |
| `org.settings` | U | — | — | — | — | — |
| `org.billing` | U | — | — | — | — | — |
| `org.members` | CUD | CUD | — | — | — | — |
| **Cross-cutting** | | | | | | |
| `ai.use` | ✓ | ✓ | ✓ | ✓ | — | — |
| `export.data` | ✓ | ✓ | ✓ | — | — | — |
| `reports.view` | R | R | R | — | — | — |

### 7.3 RLS Implementation Rules

**Source of truth:** Server-side RLS policies are the security boundary. Client-side `usePermissions.ts` is a UX convenience that mirrors these rules but never replaces them.

**Helper functions (existing):**

```sql
-- Returns true if current user is a member of the project
is_project_member(p_project_id uuid) → boolean

-- Returns true if current user has one of the allowed roles
is_project_role(p_project_id uuid, allowed_roles text[]) → boolean
```

**Standard policy patterns:**

| Operation | Policy Pattern | Role Mapping |
|---|---|---|
| SELECT (project-scoped) | `is_project_member(project_id)` | All project members |
| INSERT (project-scoped) | `is_project_role(project_id, ARRAY['owner','admin','project_manager','superintendent'])` | Per permission matrix |
| UPDATE (project-scoped) | `is_project_role(project_id, ARRAY['owner','admin','project_manager'])` | Per permission matrix |
| DELETE (project-scoped) | `is_project_role(project_id, ARRAY['owner','admin'])` | Owner/admin only for most entities |
| SELECT (child table) | `is_project_member((SELECT project_id FROM parent WHERE parent.id = parent_fk))` | Resolved via parent |
| SELECT (user-scoped) | `user_id = auth.uid()` | Own records only |
| SELECT (org-scoped) | `organization_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())` | Org members |

**Critical gap:** Current DB `project_members.role` CHECK constraint uses `('owner', 'admin', 'member', 'viewer')` which maps imprecisely to the kernel's 6-role model. The `is_project_role` function and all policies using role arrays must be updated to use the kernel roles: `('owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer')`.

**Mapping from current DB roles to kernel roles:**
- `owner` → `owner` (no change)
- `admin` → `admin` (no change)
- `member` → Split into `project_manager`, `superintendent`, or `subcontractor` based on actual usage
- `viewer` → `viewer` (no change)

### 7.4 Service-Role Access Rules

The Supabase service role (`service_role` key) bypasses all RLS. It is used only by:

1. **Edge functions** — Server-side business logic (e.g., AI agent actions, notification triggers)
2. **Database triggers** — System-initiated operations (e.g., auto-numbering, ball-in-court)
3. **Cron jobs** — Scheduled tasks (e.g., permit expiration, warranty status updates)

**Rules:**
- Service-role access is never exposed to client-side code.
- Every service-role mutation must write to `audit_log` with `actor_type = 'system'`.
- Service-role edge functions must validate the calling user's permissions before performing actions on their behalf.

---

## 8. Provenance and Audit

### 8.1 Audit Log Schema

The `audit_log` table records every mutation:

```sql
CREATE TABLE audit_log (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   uuid REFERENCES projects,
    entity_type  text NOT NULL,       -- e.g., 'rfi', 'submittal', 'change_order'
    entity_id    uuid NOT NULL,       -- PK of the affected row
    action       text NOT NULL,       -- 'create', 'update', 'delete', 'transition'
    user_id      uuid REFERENCES auth.users,
    actor_type   text DEFAULT 'user', -- 'user', 'system', 'ai_agent'
    old_values   jsonb,               -- Previous state (for updates)
    new_values   jsonb,               -- New state
    metadata     jsonb DEFAULT '{}',  -- Additional context (IP, user-agent, etc.)
    created_at   timestamptz DEFAULT now()
);
```

### 8.2 Audit Rules

1. **Every state transition** generates an audit entry with `action = 'transition'`, `old_values` containing the previous status, and `new_values` containing the new status.
2. **Every create** generates an audit entry with `action = 'create'` and `new_values` containing the full row.
3. **Every update** generates an audit entry with `action = 'update'`, `old_values` and `new_values` containing only the changed columns.
4. **Every delete** (soft or hard) generates an audit entry with `action = 'delete'` and `old_values` containing the full row.
5. **Audit log is immutable.** RLS policies: SELECT for project members; INSERT for service role; no UPDATE or DELETE ever.
6. **AI actions** are audited with `actor_type = 'ai_agent'` and `metadata` containing the agent ID, confidence score, and model version.

### 8.3 Retention Policy

- Audit logs are retained for the lifetime of the project.
- When a project is deleted (hard delete), associated audit logs are retained for 7 years per construction industry record-keeping requirements.
- Export: Audit logs are exportable as CSV/JSON for compliance.

---

## 9. Event Model

### 9.1 Domain Events

Every state transition and significant mutation emits a domain event. Events are used for:
- **Notifications** — alerting relevant users
- **Activity feed** — building the project timeline
- **Webhooks** — notifying external systems
- **AI triggers** — feeding data to AI agents

### 9.2 Event Schema

```typescript
interface DomainEvent {
  id: string;                    // uuid
  event_type: string;            // e.g., 'rfi.transitioned', 'submittal.created'
  entity_type: string;           // e.g., 'rfi', 'submittal'
  entity_id: string;             // uuid of the affected entity
  project_id: string;            // uuid of the project
  organization_id: string;       // uuid of the organization
  actor_id: string;              // uuid of the user or system that caused the event
  actor_type: 'user' | 'system' | 'ai_agent';
  payload: {
    action: 'create' | 'update' | 'delete' | 'transition';
    from_status?: string;        // for transitions
    to_status?: string;          // for transitions
    changed_fields?: string[];   // for updates
    [key: string]: unknown;      // entity-specific data
  };
  timestamp: string;             // ISO 8601
}
```

### 9.3 Event Catalog

| Event Type | Trigger | Notifies | Activity Feed |
|---|---|---|---|
| `rfi.created` | New RFI inserted | Assigned user, watchers | Yes |
| `rfi.transitioned` | Status change | Creator, assignee, watchers | Yes |
| `rfi.response_added` | New RFI response | Creator, assignee, watchers | Yes |
| `submittal.created` | New submittal | Assigned reviewer | Yes |
| `submittal.transitioned` | Status change | Creator, reviewers | Yes |
| `submittal.approval_recorded` | Approval/rejection | Creator, next reviewer | Yes |
| `change_order.created` | New CO/PCO/COR | PM, owner | Yes |
| `change_order.transitioned` | Status change | Creator, approvers | Yes |
| `change_order.promoted` | PCO→COR or COR→CO | PM, owner | Yes |
| `daily_log.submitted` | Log submitted for review | PM | Yes |
| `daily_log.approved` | Log approved | Creator (superintendent) | Yes |
| `daily_log.rejected` | Log rejected | Creator (superintendent) | Yes |
| `punch_item.created` | New punch item | Assigned user | Yes |
| `punch_item.transitioned` | Status change | Creator, assignee | Yes |
| `pay_app.submitted` | Pay app submitted | Owner, admin | Yes |
| `pay_app.certified` | Pay app certified | PM | Yes |
| `permit.transitioned` | Permit status change | PM, superintendent | Yes |
| `drawing.uploaded` | New drawing/revision | Project members | Yes |
| `drawing.superseded` | Drawing superseded | Users who marked up old rev | Yes |
| `meeting.scheduled` | Meeting created | Attendees | Yes |
| `incident.reported` | New incident | PM, safety manager, owner | Yes |
| `safety_inspection.failed` | Inspection failed | PM, superintendent | Yes |
| `certification.expiring` | Cert expires within 30 days | PM, worker | No (notification only) |
| `insurance.expiring` | Insurance expires within 30d | PM | No (notification only) |
| `ai_agent.action_created` | AI suggests an action | PM, relevant user | No (notification only) |
| `file.uploaded` | New file uploaded | — | Yes |

### 9.4 Event Delivery

Events are delivered through three channels:

1. **Supabase Realtime** — `postgres_changes` subscriptions for instant UI updates
2. **Notification queue** — Database trigger inserts into `notifications` table with appropriate routing
3. **Webhook dispatch** — For configured webhooks, events are serialized and delivered via `webhook_deliveries`

---

## 10. Workflow Boundaries

### 10.1 Workflow Definitions

SiteSync PM has 7 core workflows. Each workflow is a bounded context that coordinates multiple entities.

#### Workflow 1: RFI Lifecycle

**Entities:** RFI, RFIResponse, RFIWatcher, Drawing (reference), Notification  
**Entry point:** `rfis.create` permission  
**Happy path:** draft → open → under_review → answered → closed  
**Ball-in-court:** Automatically computed on every transition  
**Notifications:** On create (assignee), on response (creator + watchers), on close (all watchers)  
**Metrics:** Average days open, days overdue, response rate by trade

#### Workflow 2: Submittal Review

**Entities:** Submittal, SubmittalApproval, File (attachments), Notification  
**Entry point:** `submittals.create` permission  
**Happy path:** draft → submitted → under_review → approved → closed  
**Approval chain:** Configurable per submittal (e.g., ["gc_pm", "architect"])  
**Resubmission:** Rejected submittals create new rows with incremented revision_number  
**Metrics:** Average review days, resubmission rate, overdue count

#### Workflow 3: Change Order Pipeline

**Entities:** ChangeOrder (PCO/COR/CO), BudgetItem, Contract, Notification  
**Entry point:** `change_orders.create` permission  
**Happy path:** PCO draft → submitted → approved → promote to COR → approve → promote to CO → approve → executed  
**Budget impact:** Approved COs update `budget_items.committed_amount` and `projects.contract_value`  
**Metrics:** Total pending cost exposure, CO-to-contract ratio, approval cycle time

#### Workflow 4: Pay Application Processing

**Entities:** PayApplication, Contract, ScheduleOfValues, RetainageLedger, Notification  
**Entry point:** `financials.edit` permission  
**Happy path:** draft → submitted → certified → paid  
**Financial calculation:** Based on `schedule_of_values` progress percentages  
**Retainage:** Tracked per contract in `retainage_ledger`; released on final payment  
**Metrics:** Payment cycle time, retainage balance, billing-to-date vs budget

#### Workflow 5: Daily Field Reporting

**Entities:** DailyLog, DailyLogEntry, WeatherRecord, Notification  
**Entry point:** `daily_log.create` permission  
**Happy path:** draft → submitted → approved  
**Weather:** Auto-populated from `weather_records` or API integration  
**AI summary:** Generated on submit, stored in `ai_summary`  
**Metrics:** Submission rate, headcount trends, delay tracking

#### Workflow 6: Punch List Management

**Entities:** PunchItem, Drawing (location reference), Photo (attachments), Notification  
**Entry point:** `punch_list.create` permission  
**Happy path:** open → in_progress → resolved → verified  
**Closeout gate:** All punch items must be `verified` before project can reach `completed` status  
**Metrics:** Open count by trade, average resolution time, verification backlog

#### Workflow 7: Safety & Compliance

**Entities:** SafetyInspection, SafetyObservation, Incident, ToolboxTalk, SafetyCertification, Permit, PermitInspection  
**Entry point:** `safety.manage` permission  
**Sub-workflows:**
- Inspection: scheduled → in_progress → passed/failed → corrective_action_required
- Incident: reported → investigated → corrective actions → closed
- Permit: not_applied → submitted → under_review → approved → closed
- Certification tracking: active → expiring_soon → expired (automated)

**Metrics:** TRIR (Total Recordable Incident Rate), EMR, inspection pass rate, certification compliance %

### 10.2 Workflow Isolation Rules

1. Workflows may read data from other workflows (e.g., Change Order reads Budget) but must not directly mutate entities outside their boundary.
2. Cross-workflow mutations use domain events (e.g., CO approval emits `change_order.approved` → budget service updates `budget_items`).
3. No workflow may skip states in its state machine. The only way to change state is through a defined transition.

---

## 11. AI Policy Layer

### 11.1 Core Principle

**AI is advisory. Humans decide.**

No AI agent may independently:
- Transition an entity's state
- Modify financial data
- Delete any entity
- Change permissions or membership
- Send external communications

### 11.2 AI Agent Types

| Agent Type | Code | Purpose | Output |
|---|---|---|---|
| Drawing Analyzer | `drawing_analyzer` | Compare drawing revisions, detect changes | `ai_insights` with change counts |
| Submittal Prefiller | `submittal_prefiller` | Auto-fill submittal metadata from spec sections | `ai_agent_actions` with suggested fields |
| Schedule Predictor | `schedule_predictor` | Predict delays based on weather, workforce, progress | `ai_insights` with risk flags |
| Daily Log Analyzer | `daily_log_analyzer` | Summarize daily log entries, flag anomalies | `daily_logs.ai_summary` |
| RFI Router | `rfi_router` | Suggest assignee based on trade/discipline | `ai_agent_actions` with suggested `assigned_to` |
| Safety Monitor | `safety_monitor` | Flag overdue inspections, expiring certs | `ai_insights` with severity |
| Cost Forecaster | `cost_forecaster` | Project cost-at-completion based on trends | `ai_insights` with financial projections |
| Document Classifier | `document_classifier` | Auto-tag and categorize uploaded files | `field_captures.ai_category`, `ai_tags` |

### 11.3 AI Action Lifecycle

```
AI generates action → ai_agent_actions (status: pending_review)
                            │
                      User reviews
                     ┌──────┼──────┐
                     ▼      ▼      ▼
                 approved  rejected  auto_applied*
                     │               │
                     ▼               ▼
              Apply to entity   (only for low-risk,
              via normal         confidence > 0.95,
              transition         pre-configured by admin)
```

*`auto_applied` is available only for:
- Document classification tags
- AI summaries on daily logs
- Drawing change detection counts

All other AI actions require explicit human approval.

### 11.4 AI Guardrails

| Guardrail | Rule |
|---|---|
| **Confidence threshold** | Actions with `confidence < 0.7` are flagged for review and never auto-applied |
| **Financial guardrail** | AI may never create, modify, or approve financial entities (change orders, pay apps, invoices) |
| **State transition guardrail** | AI may suggest transitions but never execute them directly |
| **Rate limiting** | Per-project daily limits on AI actions (configurable in `ai_agents.configuration`) |
| **Usage tracking** | Every AI invocation logged in `ai_usage` with token count and cost |
| **Hallucination prevention** | AI outputs that reference entities must include entity IDs; IDs are verified against DB before display |
| **Citation requirement** | AI insights that reference documents must cite specific drawing numbers, RFI numbers, or spec sections |

### 11.5 AI Trust Tagging

Every AI-generated field must carry provenance:

```jsonc
// In entity metadata or dedicated column
{
  "trust": "ai_suggested",       // ai_suggested | ai_approved | ai_rejected | human
  "ai_model": "gpt-4o-2025-03", // Model identifier
  "ai_confidence": 0.87,         // 0.0 to 1.0
  "ai_agent_id": "uuid",         // Reference to ai_agents row
  "generated_at": "2026-04-09T...",
  "reviewed_by": null,            // null until human reviews
  "reviewed_at": null
}
```

---

## 12. Kernel Assumptions and Non-Goals

### 12.1 Assumptions

| # | Assumption | Rationale |
|---|---|---|
| A1 | **Supabase is the persistence layer.** PostgreSQL with RLS, Supabase Auth, Supabase Realtime, Supabase Storage. | Current stack; no plans to change. |
| A2 | **Single-region deployment.** No multi-region replication or geo-partitioning. | Sufficient for current scale. Revisit at 10K concurrent users. |
| A3 | **English-primary.** All system strings, enums, and column names are English. UI localization is separate. | Domain terminology is English-standard in construction industry. |
| A4 | **UTC timestamps.** All `timestamptz` values stored in UTC. Client converts to local time. | Standard practice for multi-timezone collaboration. |
| A5 | **Organization = Tenant.** Multi-tenancy is at the organization level. One org = one isolated dataset. | Simplest model for GC + sub collaboration. |
| A6 | **Project = Primary work unit.** All construction data is organized under projects. Cross-project queries only via portfolios. | Matches construction industry workflow. |
| A7 | **6-role model is sufficient.** The roles (owner, admin, pm, superintendent, subcontractor, viewer) cover 95% of use cases. Custom roles are a non-goal. | Validated against competitor analysis (Procore, PlanGrid, Fieldwire). |
| A8 | **Sequential numbering is project-scoped.** RFI-001 in Project A is independent from RFI-001 in Project B. | Construction industry standard. |
| A9 | **Offline mode is out of scope for kernel.** Field data capture may buffer locally, but the kernel assumes online connectivity for state transitions. | Offline sync is a separate architecture concern. |
| A10 | **File storage via Supabase Storage.** Files are stored in buckets, not in the database. `file_url` columns contain storage paths. | Standard Supabase pattern. |

### 12.2 Non-Goals

| # | Non-Goal | Reason |
|---|---|---|
| N1 | **Custom entity types.** Users cannot define new entity types. | Complexity vs. value trade-off. Custom fields on existing entities may be added later. |
| N2 | **Custom state machines.** Status enums are fixed in the kernel. | Predictable behavior is more valuable than flexibility for construction workflows. |
| N3 | **Cross-organization sharing.** Org A cannot share data with Org B. | Security boundary. If needed, both parties join the same project under one org. |
| N4 | **Historical schema migration.** The kernel does not retroactively fix data quality in existing rows. | Migration scripts handle data cleanup separately. |
| N5 | **Mobile-native persistence.** The kernel defines server-side state. Mobile caching/sync is an implementation detail. | Separate architecture layer. |
| N6 | **Workflow automation rules engine.** "When X happens, automatically do Y" is deferred. | AI policy layer handles this for v1. Custom automation is a future feature. |
| N7 | **Multi-currency.** All financial values are in a single currency (default USD). | US construction market focus. International support is a future feature. |
| N8 | **Document content indexing.** Full-text search of PDF/drawing contents. | Requires specialized infrastructure (e.g., OCR pipeline). Separate from kernel. |

---

## 13. Gold-Standard Scenario Fixtures

These 20 fixtures define expected system behavior for evaluation testing. Each fixture specifies preconditions, action, expected result, and the entities/permissions involved. An eval engineer can translate each fixture directly into an executable test.

### Fixture 1: Tenant Isolation — Org A Cannot See Org B Data

**Preconditions:**
- Org A exists with Project Alpha. User Alice is `project_manager` on Project Alpha.
- Org B exists with Project Beta. User Bob is `project_manager` on Project Beta.
- Project Alpha has RFI-001 (`rfis` row with `project_id` = Alpha.id).

**Action:** Bob (authenticated) queries `SELECT * FROM rfis WHERE id = '{RFI-001.id}'`

**Expected Result:** Empty result set. RLS policy `is_project_member(project_id)` returns false because Bob has no `project_members` row for Project Alpha.

**Entities:** `organizations`, `projects`, `project_members`, `rfis`  
**Permission tested:** Tenant isolation via RLS

---

### Fixture 2: Role-Based Create — Viewer Cannot Create RFI

**Preconditions:**
- Project exists. User Vic has role `viewer` in `project_members`.

**Action:** Vic (authenticated) attempts `INSERT INTO rfis (project_id, title, created_by) VALUES ('{project.id}', 'Test RFI', '{vic.id}')`

**Expected Result:** Insert rejected by RLS. `is_project_role(project_id, ARRAY['owner','admin','project_manager','superintendent'])` returns false for `viewer`.

**Entities:** `project_members`, `rfis`  
**Permission tested:** `rfis.create` → viewer denied

---

### Fixture 3: Role-Based Approve — Superintendent Cannot Approve Change Order

**Preconditions:**
- Project exists. User Sam has role `superintendent`.
- Change order CO-001 exists with `status = 'submitted'`, `type = 'co'`.

**Action:** Sam attempts to update CO-001 status from `submitted` to `approved`.

**Expected Result:** Rejected. `change_orders.approve` permission requires `owner` or `admin`. Superintendent is excluded.

**Entities:** `project_members`, `change_orders`  
**Permission tested:** `change_orders.approve` → superintendent denied

---

### Fixture 4: RFI Lifecycle — Happy Path

**Preconditions:**
- Project exists. Alice is `project_manager`. Bob is `superintendent`. Charlie is `subcontractor`.
- No RFIs exist.

**Actions (sequential):**
1. Bob creates RFI with `status = 'draft'`, `assigned_to = Alice.id`
2. Bob transitions RFI from `draft` → `open`
3. Alice transitions from `open` → `under_review`
4. Alice creates an `rfi_responses` row with `is_official = true`
5. Alice transitions from `under_review` → `answered`
6. Alice transitions from `answered` → `closed`

**Expected Results:**
1. RFI created with auto-number = 1, `ball_in_court` = Alice, watchers include Bob + Alice
2. Status = `open`, `ball_in_court` = Alice, `due_date` = today + 7
3. Status = `under_review`, `ball_in_court` = Alice
4. Response created successfully
5. Status = `answered`, `ball_in_court` = Bob (creator)
6. Status = `closed`, `ball_in_court` = null, `closed_date` = today
7. Audit log has 6 entries

**Entities:** `rfis`, `rfi_responses`, `rfi_watchers`, `audit_log`

---

### Fixture 5: RFI Void — Only Owner/Admin Can Void

**Preconditions:**
- RFI-001 exists with `status = 'open'`.
- Alice is `project_manager`. Eve is `owner`.

**Actions:**
1. Alice attempts to set status = `void` → **Rejected** (pm lacks `rfis.void`)
2. Eve sets status = `void` with `void_reason = 'Duplicate of RFI-003'` → **Succeeds**

**Expected Results:**
1. Alice's update fails
2. Status = `void`, `ball_in_court` = null, `void_reason` set, audit entry created

**Entities:** `rfis`, `audit_log`  
**Permission tested:** `rfis.void` → owner only

---

### Fixture 6: Submittal Resubmission Flow

**Preconditions:**
- Submittal SUB-001 exists, `status = 'under_review'`, `revision_number = 1`.
- Alice is `project_manager`.

**Actions:**
1. Alice rejects SUB-001 (transition to `rejected`)
2. Subcontractor creates new submittal with `parent_submittal_id = SUB-001.id`, `revision_number = 2`, `status = 'draft'`
3. New submittal transitions through `draft` → `submitted` → `under_review` → `approved`

**Expected Results:**
1. SUB-001 status = `rejected`
2. New submittal exists with `number` = same as SUB-001, `revision_number` = 2
3. New submittal reaches `approved`, `approved_date` set
4. Audit log captures full chain

**Entities:** `submittals`, `submittal_approvals`, `audit_log`

---

### Fixture 7: Change Order Promotion — PCO to COR to CO

**Preconditions:**
- Project exists. Alice is `project_manager`. Eve is `owner`.
- PCO-001 exists with `type = 'pco'`, `status = 'draft'`, `estimated_cost = 15000`.

**Actions:**
1. Alice transitions PCO-001: `draft` → `submitted` → `under_review`
2. Eve approves PCO-001 (`under_review` → `approved`)
3. Alice promotes PCO-001 to COR (creates new record, `type = 'cor'`, `promoted_from_id = PCO-001.id`)
4. Eve approves COR
5. Alice promotes COR to CO
6. Eve approves CO (`submitted` → `approved`)

**Expected Results:**
- 3 `change_orders` rows exist (PCO, COR, CO) linked via `promoted_from_id`
- CO's `approved_cost` = 15000
- `budget_items` row updated: `committed_amount` += 15000
- Audit log has entries for every transition and promotion
- `projects.contract_value` updated

**Entities:** `change_orders`, `budget_items`, `projects`, `audit_log`

---

### Fixture 8: Daily Log Rejection and Resubmission

**Preconditions:**
- Sam is `superintendent`. Alice is `project_manager`.
- Daily log for today exists, `status = 'draft'`, `created_by = Sam.id`.

**Actions:**
1. Sam adds 3 `daily_log_entries` (manpower, equipment, note)
2. Sam transitions to `submitted`
3. Alice rejects with `rejection_comments = 'Missing equipment hours'`
4. Sam edits entry (adds hours), transitions to `submitted` again
5. Alice approves

**Expected Results:**
1. 3 entries created
2. Status = `submitted`
3. Status = `rejected`, `rejection_comments` set
4. Entry updated, status = `submitted`
5. Status = `approved`, `approved_by` = Alice, `approved_at` set
6. Log is now immutable (further edits blocked)

**Entities:** `daily_logs`, `daily_log_entries`, `audit_log`

---

### Fixture 9: Punch Item Verification Rejection

**Preconditions:**
- Punch item PI-001, `status = 'resolved'`, `assigned_to = sub.id`.
- Alice is `project_manager`.

**Action:** Alice inspects and determines the fix is incomplete. She transitions from `resolved` → `open`.

**Expected Result:**
- Status = `open`, `resolved_date` cleared
- Assignee is notified
- Audit log entry: transition `resolved` → `open` by Alice

**Entities:** `punch_items`, `audit_log`, `notifications`

---

### Fixture 10: Pay Application Lifecycle

**Preconditions:**
- Contract C-001 exists with `original_value = 1,000,000`, `retainage_percent = 10`.
- Schedule of values has 5 line items totaling $1M.
- Pay App #1 exists, `status = 'draft'`.

**Actions:**
1. PM updates SOV progress percentages (30% across the board)
2. PM transitions pay app: `draft` → `submitted`
3. Owner certifies: `submitted` → `certified`
4. Owner marks paid: `certified` → `paid` with `paid_amount = 270,000`

**Expected Results:**
- `total_completed_and_stored = 300,000`
- `retainage = 30,000`
- `current_payment_due = 270,000`
- `paid_amount = 270,000`
- `retainage_ledger` updated with held amount

**Entities:** `pay_applications`, `schedule_of_values`, `retainage_ledger`, `contracts`

---

### Fixture 11: Drawing Supersession

**Preconditions:**
- Drawing A-101 Rev A exists, `status = 'current'`, `sheet_number = 'A-101'`.
- 3 markups exist on Rev A.

**Action:** PM uploads Drawing A-101 Rev B with `previous_revision_id = RevA.id`.

**Expected Results:**
- Rev A status → `superseded`
- Rev B status = `current`
- Only one row with `sheet_number = 'A-101'` and `status = 'current'`
- Rev A markups remain accessible for reference
- Event emitted: `drawing.superseded` notifies markup authors

**Entities:** `drawings`, `drawing_markups`, `activity_feed`

---

### Fixture 12: Subcontractor Scope Limitation

**Preconditions:**
- Charlie has role `subcontractor` on the project.
- Budget items, change orders, and financial data exist.

**Actions:**
1. Charlie queries `budget_items` → Empty (budget.view denied for subcontractor)
2. Charlie queries `change_orders` → Empty (change_orders.view denied for subcontractor)
3. Charlie queries `rfis` → Returns RFIs (rfis.view allowed for subcontractor)
4. Charlie queries `submittals` → Returns submittals (submittals.view allowed for subcontractor)
5. Charlie attempts to create a change order → Rejected

**Expected Results:**
1-2. Empty result sets
3-4. Data returned
5. Insert rejected

**Entities:** `budget_items`, `change_orders`, `rfis`, `submittals`, `project_members`  
**Permission tested:** Subcontractor financial data isolation

---

### Fixture 13: Permit Lifecycle with Inspection

**Preconditions:**
- Building permit P-001, `status = 'not_applied'`.
- 2 required inspections configured.

**Actions:**
1. PM transitions permit: `not_applied` → `application_submitted` → `under_review` → `approved`
2. Inspector schedules inspection #1, conducts it → `passed`
3. Inspector schedules inspection #2, conducts it → `failed`, `corrections_required = 'Fire blocking missing'`
4. Re-inspection scheduled, conducted → `passed`
5. PM transitions permit: `approved` → `closed`

**Expected Results:**
- Permit status = `closed`
- 2 inspections with `passed`, 1 with `failed` (3 total `permit_inspections` rows)
- Step 5 only succeeds because all inspections are `passed`
- Audit trail captures full history

**Entities:** `permits`, `permit_inspections`, `audit_log`

---

### Fixture 14: Concurrent Project Isolation

**Preconditions:**
- Alice is `project_manager` on Project A and Project B.
- Project A has 5 RFIs. Project B has 3 RFIs.

**Action:** Alice queries `SELECT * FROM rfis` while authenticated and with `project_id` context for Project A.

**Expected Result:** Returns exactly 5 RFIs (Project A only). RLS `is_project_member(project_id)` returns true for both projects, but the query filters by `project_id = ProjectA.id`.

**Note:** RLS allows Alice to see both projects' RFIs (she's a member of both). The application layer must always include `project_id` in queries to scope results correctly. This is an important distinction: RLS prevents unauthorized access; application queries provide correct scoping.

**Entities:** `rfis`, `project_members`

---

### Fixture 15: Audit Log Immutability

**Preconditions:**
- Audit log entries exist from prior operations.

**Actions:**
1. Admin attempts `UPDATE audit_log SET action = 'delete' WHERE id = '{entry.id}'`
2. Admin attempts `DELETE FROM audit_log WHERE id = '{entry.id}'`

**Expected Results:**
1. Update rejected by RLS policy ("No updates to audit logs")
2. Delete rejected by RLS policy ("No deletes from audit logs")

**Entities:** `audit_log`  
**Invariant tested:** Audit log immutability

---

### Fixture 16: Soft Delete Invisibility

**Preconditions:**
- RFI-001 exists with `deleted_at = null`.
- PM soft-deletes RFI-001 (sets `deleted_at = now()`, `deleted_by = pm.id`).

**Action:** Any project member queries `SELECT * FROM rfis`.

**Expected Result:** RFI-001 does not appear in results. RLS policy includes `deleted_at IS NULL` filter.

**Note:** This fixture requires the `deleted_at` column to exist on `rfis`. If not present (gap), the fixture is deferred until the column is added.

**Entities:** `rfis`  
**Invariant tested:** Soft delete enforcement

---

### Fixture 17: AI Agent Action Requires Human Approval

**Preconditions:**
- AI agent `rfi_router` creates an `ai_agent_actions` row with `status = 'pending_review'` suggesting `assigned_to = Bob.id` for a new RFI.

**Actions:**
1. Verify the RFI's `assigned_to` has NOT been changed (AI cannot directly modify entity)
2. PM reviews the action and approves it
3. System applies the suggestion: RFI `assigned_to` → Bob

**Expected Results:**
1. RFI `assigned_to` remains unchanged
2. `ai_agent_actions.status` → `approved`, `reviewed_by` = PM, `reviewed_at` = now
3. RFI `assigned_to` = Bob, audit entry with `actor_type = 'user'` (the PM, not the AI)

**Entities:** `ai_agents`, `ai_agent_actions`, `rfis`, `audit_log`  
**Invariant tested:** AI advisory-only policy

---

### Fixture 18: Cross-Entity Financial Integrity

**Preconditions:**
- Budget line item BL-001: `original_amount = 500,000`, `committed_amount = 450,000`.
- Approved CO increases committed by $25,000.

**Action:** CO approval trigger updates budget.

**Expected Results:**
- BL-001 `committed_amount` = 475,000
- `projects.contract_value` updated accordingly
- Audit log entry records the budget change with `entity_type = 'budget_item'` and `metadata` referencing the CO

**Entities:** `change_orders`, `budget_items`, `projects`, `audit_log`  
**Invariant tested:** Financial data consistency across entities

---

### Fixture 19: Portal User Limited Access

**Preconditions:**
- External owner portal user (PortalUser type = 'owner') exists for Project A.
- Project has unpublished owner update and one published owner update.
- Project has RFIs, submittals, budget items.

**Actions:**
1. Portal user queries `owner_updates` → Returns only published update
2. Portal user queries `rfis` → Empty (no `project_members` row)
3. Portal user queries `budget_items` → Empty

**Expected Results:**
1. One row returned (published = true)
2-3. Empty results (portal users access data through portal-specific RLS, not project_members)

**Entities:** `portal_users`, `owner_updates`, `rfis`, `budget_items`  
**Invariant tested:** Portal access boundary

---

### Fixture 20: Referential Integrity — Cascading Delete

**Preconditions:**
- Project A has: 3 RFIs, 5 submittals, 2 daily logs with 10 entries each, 1 meeting with 3 attendees.

**Action:** Organization owner hard-deletes Project A (the only path to hard delete, per `project.delete` permission).

**Expected Results:**
- Project A row deleted
- All 3 RFIs deleted (`ON DELETE CASCADE`)
- All RFI responses, watchers deleted (cascade through RFIs)
- All 5 submittals + approval records deleted
- All 2 daily logs + 20 entries deleted
- Meeting + 3 attendees deleted
- All `project_members` rows for Project A deleted
- Audit log entries for Project A are **retained** (per retention policy)
- `portfolios` remain; `portfolio_projects` rows referencing Project A are deleted

**Entities:** All project-scoped entities  
**Invariant tested:** Cascade deletion completeness + audit log retention

---

## Appendix A: Enum Reference

### A.1 Project Status
`active`, `completed`, `on_hold`, `cancelled`

### A.2 Project Member Roles (Kernel)
`owner`, `admin`, `project_manager`, `superintendent`, `subcontractor`, `viewer`

### A.3 Organization Member Roles
`owner`, `admin`, `member`

### A.4 RFI Status
`draft`, `open`, `under_review`, `answered`, `closed`, `void`

### A.5 RFI Priority
`low`, `medium`, `high`, `critical`

### A.6 Submittal Status
`draft`, `pending`, `submitted`, `under_review`, `approved`, `rejected`, `resubmit`, `closed`

### A.7 Change Order Type
`pco`, `cor`, `co`

### A.8 Change Order Status
`draft`, `submitted`, `under_review`, `approved`, `rejected`, `executed`

### A.9 Change Order Reason Code
`owner_change`, `design_error`, `field_condition`, `regulatory`, `value_engineering`, `unforeseen`

### A.10 Pay Application Status
`draft`, `submitted`, `certified`, `paid`

### A.11 Punch Item Status
`open`, `in_progress`, `resolved`, `verified`

### A.12 Daily Log Status
`draft`, `submitted`, `approved`, `rejected`

### A.13 Permit Status
`not_applied`, `application_submitted`, `under_review`, `approved`, `denied`, `expired`, `closed`

### A.14 Permit Inspection Status
`not_scheduled`, `scheduled`, `passed`, `failed`, `partial`, `cancelled`

### A.15 Drawing Status
`current`, `superseded`, `void`, `for_review`

### A.16 Drawing Discipline
`architectural`, `structural`, `mechanical`, `electrical`, `plumbing`, `civil`, `fire_protection`, `landscape`, `interior`

### A.17 Contract Type
`prime`, `subcontract`, `purchase_order`, `professional_services`

### A.18 Contract Status
`draft`, `executed`, `in_progress`, `completed`, `closed`, `terminated`

### A.19 Purchase Order Status
`draft`, `issued`, `acknowledged`, `partially_received`, `fully_received`, `closed`, `cancelled`

### A.20 Equipment Status
`active`, `idle`, `maintenance`, `transit`, `off_site`

### A.21 Safety Inspection Status
`scheduled`, `in_progress`, `passed`, `failed`, `corrective_action_required`

### A.22 Incident Severity
`first_aid`, `medical_treatment`, `lost_time`, `fatality`

### A.23 AI Agent Action Status
`pending_review`, `approved`, `rejected`, `auto_applied`

### A.24 AI Agent Status
`active`, `paused`, `disabled`

### A.25 Closeout Item Status
`not_started`, `in_progress`, `submitted`, `approved`, `na`

### A.26 Warranty Status
`active`, `expiring_soon`, `expired`, `claimed`

### A.27 Invoice Payable Status
`received`, `coded`, `approved`, `scheduled`, `paid`, `disputed`

### A.28 Bid Package Status
`draft`, `issued`, `responses_received`, `leveled`, `awarded`

### A.29 Estimate Status
`draft`, `in_review`, `submitted`, `awarded`, `lost`

### A.30 Delivery Status
`scheduled`, `in_transit`, `delivered`, `inspected`, `rejected`

### A.31 Task Status
`todo`, `in_progress`, `in_review`, `done`

---

## Appendix B: Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-04-09 | @wrbenner | Initial kernel specification |

---

*End of DOMAIN_KERNEL_SPEC.md*
