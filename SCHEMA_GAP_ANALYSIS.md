# SCHEMA_GAP_ANALYSIS.md — SiteSync PM

> **Version:** 1.0.0
> **Status:** Draft — Awaiting Owner Approval
> **Author:** Walker Benner (@wrbenner)
> **Last Updated:** 2026-04-09
> **Depends On:** DOMAIN_KERNEL_SPEC.md v1.0.0
> **CODEOWNERS:** @wrbenner (changes require PR + review)

---

## 1. Methodology

This document compares the existing 98-table database schema against the canonical domain model defined in `DOMAIN_KERNEL_SPEC.md`. Every table is individually assessed for:

1. **Kernel mapping** — Does a kernel entity exist for this table?
2. **Scope type** — system, org, project, org+project, or user
3. **RLS status** — Per-operation (SELECT, INSERT, UPDATE, DELETE) policy presence
4. **Missing columns** — Kernel-required columns the table lacks
5. **State machine status** — Whether the table has a proper status enum per kernel spec
6. **Temporal columns** — Compliance with Section 6.1 temporal requirements
7. **Migration action** — What must be done to bring the table into conformance

### 1.1 Sources

- **Kernel spec:** `DOMAIN_KERNEL_SPEC.md` Sections 2–6, Appendix A
- **RLS data:** Extracted from `supabase/migrations/` — 44 tables confirmed with RLS enabled, 54 tables with unknown RLS status
- **Table list:** 98 tables confirmed in database

### 1.2 Kernel Temporal Requirements (Section 6.1)

Every kernel table must have:

| Column | Required | Notes |
|--------|----------|-------|
| `id` | All tables | `uuid`, `gen_random_uuid()` |
| `created_at` | All tables | `timestamptz`, `now()` |
| `updated_at` | All tables | `timestamptz`, `now()`, auto-set by trigger |
| `created_by` | All user-initiated entities | `uuid` FK → `auth.users` |
| `deleted_at` | All business entities (soft delete) | `timestamptz`, nullable |
| `deleted_by` | All business entities (soft delete) | `uuid` FK → `auth.users`, nullable |

**Known gap:** The kernel spec (Section 6.1) explicitly notes that most tables are missing `created_by`, and Section 6.3 notes most tables lack `deleted_at`/`deleted_by`.

---

## 2. Master Gap Analysis Table

For every one of the 98 tables:

| # | Table | Kernel Entity | Scope Type | RLS Enabled | Has SELECT | Has INSERT | Has UPDATE | Has DELETE | RLS Status | Missing Columns | State Machine Status | Temporal Columns | Migration Action |
|---|-------|--------------|------------|-------------|------------|------------|------------|------------|------------|-----------------|---------------------|-----------------|-----------------|
| 1 | `organizations` | Organization | org | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 2 | `organization_members` | OrganizationMember | org | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 3 | `organization_settings` | OrganizationSettings | org | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 4 | `projects` | Project | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | has enum (`active`, `completed`, `on_hold`, `cancelled`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 5 | `project_members` | ProjectMember | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by`; **role enum mismatch** (DB: owner/admin/member/viewer; kernel: owner/admin/project_manager/superintendent/subcontractor/viewer) | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns + **update role enum** |
| 6 | `project_snapshots` | ProjectSnapshot | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by` | N/A | ⚠️ partial (missing `created_by`) | add RLS + add columns |
| 7 | `rfis` | RFI | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | has enum (`draft`, `open`, `under_review`, `answered`, `closed`, `void`) | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 8 | `rfi_responses` | RFIResponse | project (child) | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 9 | `rfi_watchers` | RFIWatcher | project (child) | yes | yes | yes | yes | yes | ✅ covered | — | N/A | ✅ complete (join table, no soft delete needed) | none |
| 10 | `submittals` | Submittal | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | has enum (`draft`, `pending`, `submitted`, `under_review`, `approved`, `rejected`, `resubmit`, `closed`) | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 11 | `submittal_approvals` | SubmittalApproval | project (child) | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 12 | `drawings` | Drawing | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | has enum (`current`, `superseded`, `void`, `for_review`) | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 13 | `drawing_markups` | DrawingMarkup | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 14 | `budget_items` | BudgetItem | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 15 | `change_orders` | ChangeOrder | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | has enum (type: `pco`/`cor`/`co`; status: `draft`, `submitted`, `under_review`, `approved`, `rejected`, `executed`) | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 16 | `pay_applications` | PayApplication | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | has enum (`draft`, `submitted`, `certified`, `paid`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 17 | `schedule_of_values` | ScheduleOfValues | project (child) | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 18 | `daily_logs` | DailyLog | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | has enum (`draft`, `submitted`, `approved`, `rejected`) | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 19 | `daily_log_entries` | DailyLogEntry | project (child) | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 20 | `punch_items` | PunchItem | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | has enum (`open`, `in_progress`, `resolved`, `verified`) | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 21 | `field_captures` | FieldCapture | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 22 | `safety_inspections` | SafetyInspection | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | has enum (`scheduled`, `in_progress`, `passed`, `failed`, `corrective_action_required`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 23 | `safety_observations` | SafetyObservation | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 24 | `incidents` | Incident | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | has string (severity: `first_aid`, `medical_treatment`, `lost_time`, `fatality`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns + add enum |
| 25 | `permits` | Permit | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | has enum (`not_applied`, `application_submitted`, `under_review`, `approved`, `denied`, `expired`, `closed`) | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 26 | `permit_inspections` | PermitInspection | project (child) | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | has enum (`not_scheduled`, `scheduled`, `passed`, `failed`, `partial`, `cancelled`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 27 | `crews` | Crew | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 28 | `workforce_members` | WorkforceMember | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 29 | `workforce_assignments` | WorkforceAssignment | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 30 | `tasks` | Task | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | has enum (`todo`, `in_progress`, `in_review`, `done`) | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 31 | `meetings` | Meeting | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 32 | `meeting_attendees` | MeetingAttendee | project (child) | yes | yes | yes | yes | yes | ✅ covered | — | N/A | ✅ complete (join table, no soft delete needed) | none |
| 33 | `meeting_action_items` | MeetingActionItem | project (child) | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 34 | `files` | File | project | yes | yes | yes | yes | yes | ✅ covered | `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `deleted_at`, `deleted_by`) | add columns |
| 35 | `notifications` | Notification | user | yes | yes | yes | yes | yes | ✅ covered | — | N/A | ✅ complete | none |
| 36 | `directory_contacts` | DirectoryContact | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 37 | `insurance_certificates` | InsuranceCertificate | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 38 | `closeout_items` | CloseoutItem | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | has enum (`not_started`, `in_progress`, `submitted`, `approved`, `na`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 39 | `corrective_actions` | CorrectiveAction | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 40 | `warranties` | Warranty | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | has enum (`active`, `expiring_soon`, `expired`, `claimed`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 41 | `warranty_claims` | WarrantyClaim | project | yes | yes | yes | yes | yes | ✅ covered | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add columns |
| 42 | `audit_log` | AuditLog | project | yes | yes | yes | yes | yes | ✅ covered | — | N/A | ✅ complete (immutable, no soft delete) | none |
| 43 | `bim_markups` | **No kernel mapping** | project | yes | yes | yes | yes | yes | ✅ covered | — | N/A | — | **candidate for deprecation** |
| 44 | `webhook_deliveries` | WebhookDelivery | system (child) | yes | yes | yes | yes | yes | ✅ covered | — | N/A | ✅ complete | none |
| 45 | `payment_applications` | **No kernel mapping** (duplicate of `pay_applications`?) | project | yes | yes | yes | yes | yes | ✅ covered | — | — | — | **investigate: possible duplicate of `pay_applications`** |
| 46 | `portfolios` | Portfolio | org | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 47 | `portfolio_projects` | PortfolioProject | org | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete (join table) | add RLS |
| 48 | `transmittals` | Transmittal | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 49 | `contracts` | Contract | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | has enum (`draft`, `executed`, `in_progress`, `completed`, `closed`, `terminated`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 50 | `cost_database` | CostDatabase | org | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 51 | `job_cost_entries` | JobCostEntry | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 52 | `retainage_ledger` | RetainageLedger | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 53 | `invoices_payable` | InvoicePayable | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | has enum (`received`, `coded`, `approved`, `scheduled`, `paid`, `disputed`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 54 | `purchase_orders` | PurchaseOrder | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | has enum (`draft`, `issued`, `acknowledged`, `partially_received`, `fully_received`, `closed`, `cancelled`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 55 | `po_line_items` | POLineItem | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 56 | `wip_reports` | WIPReport | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 57 | `schedule_phases` | SchedulePhase | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 58 | `safety_certifications` | SafetyCertification | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 59 | `safety_inspection_templates` | SafetyInspectionTemplate | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 60 | `equipment` | Equipment | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | has enum (`active`, `idle`, `maintenance`, `transit`, `off_site`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 61 | `equipment_logs` | EquipmentLog | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 62 | `equipment_maintenance` | EquipmentMaintenance | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 63 | `task_templates` | TaskTemplate | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 64 | `meeting_agenda_items` | MeetingAgendaItem | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 65 | `meeting_series` | MeetingSeries | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 66 | `notification_preferences` | NotificationPreference | user | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete | add RLS |
| 67 | `activity_feed` | ActivityFeed | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete (append-only) | add RLS |
| 68 | `estimates` | Estimate | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | has enum (`draft`, `in_review`, `submitted`, `awarded`, `lost`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 69 | `estimate_line_items` | EstimateLineItem | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 70 | `takeoff_items` | TakeoffItem | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 71 | `deliveries` | Delivery | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | has enum (`scheduled`, `in_transit`, `delivered`, `inspected`, `rejected`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 72 | `delivery_items` | DeliveryItem | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 73 | `material_inventory` | MaterialInventory | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 74 | `labor_forecasts` | LaborForecast | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 75 | `bid_packages` | BidPackage | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | has enum (`draft`, `issued`, `responses_received`, `leveled`, `awarded`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 76 | `bid_invitations` | BidInvitation | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 77 | `bid_responses` | BidResponse | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 78 | `custom_reports` | CustomReport | org+project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 79 | `executive_reports` | ExecutiveReport | org+project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 80 | `integrations` | Integration | org | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 81 | `integration_sync_log` | IntegrationSyncLog | org (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete (log table) | add RLS |
| 82 | `integration_field_mappings` | IntegrationFieldMapping | org (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 83 | `webhooks` | Webhook | system | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete | add RLS |
| 84 | `sustainability_metrics` | SustainabilityMetric | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 85 | `waste_logs` | WasteLog | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 86 | `weekly_commitments` | WeeklyCommitment | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 87 | `owner_updates` | OwnerUpdate | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 88 | `portal_users` | PortalUser | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 89 | `portal_invitations` | PortalInvitation | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 90 | `portal_access_tokens` | PortalAccessToken | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete (token table) | add RLS |
| 91 | `ai_agents` | AIAgent | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | has enum (`active`, `paused`, `disabled`) | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 92 | `ai_agent_actions` | AIAgentAction | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | has enum (`pending_review`, `approved`, `rejected`, `auto_applied`) | ✅ complete | add RLS |
| 93 | `ai_insights` | AIInsight | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete | add RLS |
| 94 | `ai_usage` | AIUsage | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete | add RLS |
| 95 | `api_keys` | APIKey | system | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete | add RLS |
| 96 | `toolbox_talks` | ToolboxTalk | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |
| 97 | `toolbox_talk_attendees` | ToolboxTalkAttendee | project (child) | unknown | unknown | unknown | unknown | unknown | ❓ unknown | — | N/A | ✅ complete (join table) | add RLS |
| 98 | `weather_records` | WeatherRecord | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by` | N/A | ⚠️ partial (missing `created_by`) | add RLS + add columns |
| — | `time_entries` | TimeEntry | project | unknown | unknown | unknown | unknown | unknown | ❓ unknown | `created_by`, `deleted_at`, `deleted_by` | N/A | ⚠️ partial (missing `created_by`, `deleted_at`, `deleted_by`) | add RLS + add columns |

**Note on table count:** The provided list contains 98 named tables. The kernel defines 97 entities. Two tables (`bim_markups`, `payment_applications`) have no kernel mapping. `time_entries` is a kernel entity that appears in the unknown-RLS list. The count discrepancy is due to `bim_markups` (no kernel mapping) and `payment_applications` (possible duplicate of `pay_applications`).

---

## 3. Summary

| Metric | Count |
|--------|-------|
| **Total tables** | 98 |
| **Tables with kernel mapping** | 96 (97 kernel entities, 96 unique tables after deduplication) |
| **Tables with no kernel mapping** | 2 (`bim_markups`, `payment_applications`) |
| **Tables fully conformant** (no migration needed) | **6** (`rfi_watchers`, `meeting_attendees`, `audit_log`, `webhook_deliveries`, `notifications`, `payment_applications`*) |
| **Tables needing column additions** | **86** (most need `created_by`, `deleted_at`, `deleted_by`) |
| **Tables needing RLS** | **54** (all tables with unknown RLS status) |
| **Tables needing both RLS + columns** | **48** |
| **Tables needing role enum update** | **1** (`project_members` — critical path item) |
| **Tables needing state machine enum** | **1** (`incidents` — severity should be CHECK-constrained enum) |
| **Tables candidate for deprecation** | **2** (`bim_markups`, `payment_applications`) |

### 3.1 Critical Path Items (ordered by exposure risk)

1. **`project_members` role enum mismatch** — DB allows `('owner', 'admin', 'member', 'viewer')` but kernel requires `('owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer')`. Every RLS policy and the `is_project_role()` function depends on this. **Must be resolved first.**
2. **54 tables with unknown RLS status** — Any table without RLS is potentially exposed via the Supabase REST API to any authenticated user.
3. **`deleted_at`/`deleted_by` columns missing on ~86 tables** — Soft delete cannot function without these columns. RLS SELECT policies cannot include `AND deleted_at IS NULL` until columns exist.
4. **`created_by` column missing on ~75 tables** — Audit provenance incomplete.

---

## 4. Explicit RLS Audit

### 4.1 Tables with Confirmed RLS (44 tables)

Every table below has been confirmed to have RLS enabled via migration analysis. Per-operation policy status is based on migration extraction.

| # | Table | RLS Enabled | Has SELECT | Has INSERT | Has UPDATE | Has DELETE | Status |
|---|-------|-------------|------------|------------|------------|------------|--------|
| 1 | `organizations` | yes | yes | yes | yes | yes | ✅ covered |
| 2 | `organization_members` | yes | yes | yes | yes | yes | ✅ covered |
| 3 | `projects` | yes | yes | yes | yes | yes | ✅ covered |
| 4 | `project_members` | yes | yes | yes | yes | yes | ✅ covered |
| 5 | `rfis` | yes | yes | yes | yes | yes | ✅ covered |
| 6 | `rfi_responses` | yes | yes | yes | yes | yes | ✅ covered |
| 7 | `rfi_watchers` | yes | yes | yes | yes | yes | ✅ covered |
| 8 | `submittals` | yes | yes | yes | yes | yes | ✅ covered |
| 9 | `submittal_approvals` | yes | yes | yes | yes | yes | ✅ covered |
| 10 | `drawings` | yes | yes | yes | yes | yes | ✅ covered |
| 11 | `drawing_markups` | yes | yes | yes | yes | yes | ✅ covered |
| 12 | `budget_items` | yes | yes | yes | yes | yes | ✅ covered |
| 13 | `change_orders` | yes | yes | yes | yes | yes | ✅ covered |
| 14 | `pay_applications` | yes | yes | yes | yes | yes | ✅ covered |
| 15 | `schedule_of_values` | yes | yes | yes | yes | yes | ✅ covered |
| 16 | `daily_logs` | yes | yes | yes | yes | yes | ✅ covered |
| 17 | `daily_log_entries` | yes | yes | yes | yes | yes | ✅ covered |
| 18 | `punch_items` | yes | yes | yes | yes | yes | ✅ covered |
| 19 | `field_captures` | yes | yes | yes | yes | yes | ✅ covered |
| 20 | `safety_inspections` | yes | yes | yes | yes | yes | ✅ covered |
| 21 | `safety_observations` | yes | yes | yes | yes | yes | ✅ covered |
| 22 | `incidents` | yes | yes | yes | yes | yes | ✅ covered |
| 23 | `permits` | yes | yes | yes | yes | yes | ✅ covered |
| 24 | `permit_inspections` | yes | yes | yes | yes | yes | ✅ covered |
| 25 | `crews` | yes | yes | yes | yes | yes | ✅ covered |
| 26 | `workforce_members` | yes | yes | yes | yes | yes | ✅ covered |
| 27 | `workforce_assignments` | yes | yes | yes | yes | yes | ✅ covered |
| 28 | `tasks` | yes | yes | yes | yes | yes | ✅ covered |
| 29 | `meetings` | yes | yes | yes | yes | yes | ✅ covered |
| 30 | `meeting_attendees` | yes | yes | yes | yes | yes | ✅ covered |
| 31 | `meeting_action_items` | yes | yes | yes | yes | yes | ✅ covered |
| 32 | `files` | yes | yes | yes | yes | yes | ✅ covered |
| 33 | `notifications` | yes | yes | yes | yes | yes | ✅ covered |
| 34 | `directory_contacts` | yes | yes | yes | yes | yes | ✅ covered |
| 35 | `insurance_certificates` | yes | yes | yes | yes | yes | ✅ covered |
| 36 | `closeout_items` | yes | yes | yes | yes | yes | ✅ covered |
| 37 | `corrective_actions` | yes | yes | yes | yes | yes | ✅ covered |
| 38 | `warranties` | yes | yes | yes | yes | yes | ✅ covered |
| 39 | `warranty_claims` | yes | yes | yes | yes | yes | ✅ covered |
| 40 | `audit_log` | yes | yes | yes | yes | yes | ✅ covered |
| 41 | `bim_markups` | yes | yes | yes | yes | yes | ✅ covered |
| 42 | `webhook_deliveries` | yes | yes | yes | yes | yes | ✅ covered |
| 43 | `payment_applications` | yes | yes | yes | yes | yes | ✅ covered |

### 4.2 Tables with Unknown RLS Status (54 tables)

**Every table below is potentially exposed.** Until RLS is confirmed or added, these tables may be accessible to any authenticated Supabase user via the REST API.

| # | Table | RLS Enabled | Has SELECT | Has INSERT | Has UPDATE | Has DELETE | Status | Exposure Risk |
|---|-------|-------------|------------|------------|------------|------------|--------|---------------|
| 1 | `organization_settings` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — org config/billing |
| 2 | `project_snapshots` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — historical data |
| 3 | `portfolios` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — cross-project grouping |
| 4 | `portfolio_projects` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — cross-project links |
| 5 | `transmittals` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — document control |
| 6 | `contracts` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — financial data |
| 7 | `cost_database` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — org cost data |
| 8 | `job_cost_entries` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — financial data |
| 9 | `retainage_ledger` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — financial data |
| 10 | `invoices_payable` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — financial data |
| 11 | `purchase_orders` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — financial/procurement |
| 12 | `po_line_items` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — financial line items |
| 13 | `wip_reports` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — financial reporting |
| 14 | `schedule_phases` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — schedule data |
| 15 | `safety_certifications` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — PII/compliance |
| 16 | `safety_inspection_templates` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | LOW — templates |
| 17 | `equipment` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — asset data |
| 18 | `equipment_logs` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — usage logs |
| 19 | `equipment_maintenance` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — maintenance records |
| 20 | `task_templates` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | LOW — templates |
| 21 | `meeting_agenda_items` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — meeting content |
| 22 | `meeting_series` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | LOW — configuration |
| 23 | `notification_preferences` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — user PII |
| 24 | `activity_feed` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — activity stream |
| 25 | `estimates` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — financial data |
| 26 | `estimate_line_items` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — financial data |
| 27 | `takeoff_items` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — quantity data |
| 28 | `deliveries` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — logistics |
| 29 | `delivery_items` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — logistics |
| 30 | `material_inventory` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — inventory |
| 31 | `labor_forecasts` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — workforce/rate data |
| 32 | `bid_packages` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — procurement |
| 33 | `bid_invitations` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — procurement |
| 34 | `bid_responses` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — competitive pricing |
| 35 | `custom_reports` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — saved configurations |
| 36 | `executive_reports` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — executive summaries |
| 37 | `integrations` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — third-party credentials |
| 38 | `integration_sync_log` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — sync history |
| 39 | `integration_field_mappings` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | LOW — configuration |
| 40 | `webhooks` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — endpoint URLs/secrets |
| 41 | `sustainability_metrics` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | LOW — environmental data |
| 42 | `waste_logs` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | LOW — waste tracking |
| 43 | `weekly_commitments` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — schedule commitments |
| 44 | `owner_updates` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — portal content |
| 45 | `portal_users` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — external user PII |
| 46 | `portal_invitations` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — auth tokens |
| 47 | `portal_access_tokens` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — auth tokens |
| 48 | `ai_agents` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — AI configuration |
| 49 | `ai_agent_actions` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — AI actions |
| 50 | `ai_insights` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — AI output |
| 51 | `ai_usage` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — usage/cost data |
| 52 | `api_keys` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **CRITICAL** — API credentials |
| 53 | `toolbox_talks` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — safety content |
| 54 | `toolbox_talk_attendees` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | MEDIUM — attendance |
| — | `weather_records` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | LOW — weather data |
| — | `time_entries` | unknown | unknown | unknown | unknown | unknown | ❓ unknown | **HIGH** — labor/rate data |

### 4.3 RLS Priority Queue (by exposure risk)

Tables that need RLS policies added, ordered by the severity of data exposure if left unprotected:

**CRITICAL (financial data, auth tokens, API credentials — immediate risk):**

| Priority | Table | Exposure | Scope Pattern |
|----------|-------|----------|---------------|
| P0 | `api_keys` | API credentials visible to any authenticated user | system (service-role only) |
| P0 | `portal_access_tokens` | Auth tokens for external users | project (via portal_users) |
| P0 | `contracts` | Contract values, terms exposed cross-tenant | project (is_project_member) |
| P0 | `job_cost_entries` | Actual costs exposed cross-tenant | project (is_project_role for financial roles) |
| P0 | `retainage_ledger` | Retainage amounts exposed | project (is_project_role for financial roles) |
| P0 | `invoices_payable` | Vendor invoices exposed | project (is_project_role for financial roles) |
| P0 | `purchase_orders` | PO values exposed | project (is_project_role for financial roles) |
| P0 | `wip_reports` | Financial reporting exposed | project (is_project_role for financial roles) |
| P0 | `estimates` | Estimate values exposed (bid advantage) | project (is_project_role for financial roles) |
| P0 | `estimate_line_items` | Detailed pricing exposed | project (via parent estimate) |
| P0 | `bid_packages` | Bid scope exposed | project (is_project_role) |
| P0 | `bid_responses` | Competitive pricing exposed | project (is_project_role for financial roles) |

**HIGH (sensitive data, PII, credentials):**

| Priority | Table | Exposure | Scope Pattern |
|----------|-------|----------|---------------|
| P1 | `organization_settings` | Org config/billing exposed | org (is_org_member) |
| P1 | `cost_database` | Unit cost data exposed cross-org | org (is_org_member) |
| P1 | `integrations` | Third-party connection details | org (is_org_member, admin+) |
| P1 | `webhooks` | Endpoint URLs and secrets | system (service-role only) |
| P1 | `safety_certifications` | Worker PII, cert data | project (is_project_member) |
| P1 | `portal_users` | External user PII | project (is_project_role admin+) |
| P1 | `portal_invitations` | Invitation tokens | project (is_project_role admin+) |
| P1 | `owner_updates` | Owner-facing content | project (portal-specific RLS) |
| P1 | `executive_reports` | Executive summaries | org+project (is_project_role admin+) |
| P1 | `labor_forecasts` | Workforce rates and projections | project (is_project_role for financial roles) |
| P1 | `bid_invitations` | Sub invitations to bid | project (is_project_role) |
| P1 | `po_line_items` | PO line item pricing | project (via parent PO) |
| P1 | `time_entries` | Labor hours, rates, geolocation | project (is_project_member) |

**MEDIUM (operational data):**

| Priority | Table | Exposure | Scope Pattern |
|----------|-------|----------|---------------|
| P2 | `project_snapshots` | Historical data | project (is_project_member) |
| P2 | `portfolios` | Cross-project grouping | org (is_org_member) |
| P2 | `portfolio_projects` | Cross-project links | org (is_org_member) |
| P2 | `transmittals` | Document transmission records | project (is_project_member) |
| P2 | `schedule_phases` | Schedule data | project (is_project_member) |
| P2 | `equipment` | Asset data | project (is_project_member) |
| P2 | `equipment_logs` | Usage logs | project (is_project_member) |
| P2 | `equipment_maintenance` | Maintenance records | project (is_project_member) |
| P2 | `meeting_agenda_items` | Meeting content | project (is_project_member) |
| P2 | `notification_preferences` | User preferences | user (user_id = auth.uid()) |
| P2 | `activity_feed` | Activity stream | project (is_project_member) |
| P2 | `deliveries` | Delivery schedules | project (is_project_member) |
| P2 | `delivery_items` | Delivery line items | project (via parent delivery) |
| P2 | `material_inventory` | On-site inventory | project (is_project_member) |
| P2 | `weekly_commitments` | Weekly work plans | project (is_project_member) |
| P2 | `ai_agents` | AI configuration | project (is_project_role admin+) |
| P2 | `ai_agent_actions` | AI actions | project (is_project_member) |
| P2 | `ai_insights` | AI output | project (is_project_member) |
| P2 | `ai_usage` | Token/cost tracking | project (is_project_role admin+) |
| P2 | `custom_reports` | Saved report configs | org+project (is_project_member or is_org_member) |
| P2 | `toolbox_talks` | Safety content | project (is_project_member) |
| P2 | `toolbox_talk_attendees` | Attendance | project (via parent toolbox_talk) |
| P2 | `takeoff_items` | Quantity data | project (is_project_member) |
| P2 | `integration_sync_log` | Sync history | org (is_org_member) |

**LOW (configuration, templates):**

| Priority | Table | Exposure | Scope Pattern |
|----------|-------|----------|---------------|
| P3 | `safety_inspection_templates` | Inspection templates | project (is_project_member) |
| P3 | `task_templates` | Task templates | project (is_project_member) |
| P3 | `meeting_series` | Recurring meeting config | project (is_project_member) |
| P3 | `integration_field_mappings` | Field mapping config | org (is_org_member) |
| P3 | `sustainability_metrics` | Environmental data | project (is_project_member) |
| P3 | `waste_logs` | Waste tracking | project (is_project_member) |
| P3 | `weather_records` | Weather data | project (is_project_member) |

---

## 5. State Machine Compliance

The kernel defines state machines for 8 entities (Section 5) plus status enums for ~15 additional entities (Appendix A). Assessment of current state:

### 5.1 Entities with Kernel State Machines (Section 5)

| Entity | Table | Kernel States | Current DB Type | Status | Migration Action |
|--------|-------|--------------|-----------------|--------|-----------------|
| RFI | `rfis` | `draft`, `open`, `under_review`, `answered`, `closed`, `void` | text with CHECK | ✅ has enum | verify CHECK values match kernel |
| Submittal | `submittals` | `draft`, `pending`, `submitted`, `under_review`, `approved`, `rejected`, `resubmit`, `closed` | text with CHECK | ✅ has enum | verify CHECK values match kernel |
| ChangeOrder | `change_orders` | type: `pco`/`cor`/`co`; status: `draft`, `submitted`, `under_review`, `approved`, `rejected`, `executed` | text with CHECK | ✅ has enum | verify both type and status CHECKs |
| PayApplication | `pay_applications` | `draft`, `submitted`, `certified`, `paid` | text with CHECK | ✅ has enum | verify CHECK values |
| PunchItem | `punch_items` | `open`, `in_progress`, `resolved`, `verified` | text with CHECK | ✅ has enum | verify CHECK values |
| DailyLog | `daily_logs` | `draft`, `submitted`, `approved`, `rejected` | text with CHECK | ✅ has enum | verify CHECK values |
| Permit | `permits` | `not_applied`, `application_submitted`, `under_review`, `approved`, `denied`, `expired`, `closed` | text with CHECK | ✅ has enum | verify CHECK values |
| PermitInspection | `permit_inspections` | `not_scheduled`, `scheduled`, `passed`, `failed`, `partial`, `cancelled` | text with CHECK | ✅ has enum | verify CHECK values |

### 5.2 Entities with Kernel Status Enums (Appendix A)

| Entity | Table | Kernel Enum Values | Current Status | Migration Action |
|--------|-------|--------------------|----------------|-----------------|
| Project | `projects` | `active`, `completed`, `on_hold`, `cancelled` | has enum | verify CHECK |
| ProjectMember | `project_members` | `owner`, `admin`, `project_manager`, `superintendent`, `subcontractor`, `viewer` | **MISMATCH** — DB has `owner`, `admin`, `member`, `viewer` | **update CHECK + migrate data** |
| Drawing | `drawings` | `current`, `superseded`, `void`, `for_review` | has enum | verify CHECK |
| Contract | `contracts` | `draft`, `executed`, `in_progress`, `completed`, `closed`, `terminated` | needs verification | verify or add CHECK |
| PurchaseOrder | `purchase_orders` | `draft`, `issued`, `acknowledged`, `partially_received`, `fully_received`, `closed`, `cancelled` | needs verification | verify or add CHECK |
| Equipment | `equipment` | `active`, `idle`, `maintenance`, `transit`, `off_site` | needs verification | verify or add CHECK |
| SafetyInspection | `safety_inspections` | `scheduled`, `in_progress`, `passed`, `failed`, `corrective_action_required` | needs verification | verify CHECK |
| Incident | `incidents` | severity: `first_aid`, `medical_treatment`, `lost_time`, `fatality` | has string (needs enum) | add CHECK constraint |
| AIAgent | `ai_agents` | `active`, `paused`, `disabled` | needs verification | verify or add CHECK |
| AIAgentAction | `ai_agent_actions` | `pending_review`, `approved`, `rejected`, `auto_applied` | needs verification | verify or add CHECK |
| CloseoutItem | `closeout_items` | `not_started`, `in_progress`, `submitted`, `approved`, `na` | needs verification | verify or add CHECK |
| Warranty | `warranties` | `active`, `expiring_soon`, `expired`, `claimed` | needs verification | verify or add CHECK |
| InvoicePayable | `invoices_payable` | `received`, `coded`, `approved`, `scheduled`, `paid`, `disputed` | needs verification | verify or add CHECK |
| BidPackage | `bid_packages` | `draft`, `issued`, `responses_received`, `leveled`, `awarded` | needs verification | verify or add CHECK |
| Estimate | `estimates` | `draft`, `in_review`, `submitted`, `awarded`, `lost` | needs verification | verify or add CHECK |
| Delivery | `deliveries` | `scheduled`, `in_transit`, `delivered`, `inspected`, `rejected` | needs verification | verify or add CHECK |
| Task | `tasks` | `todo`, `in_progress`, `in_review`, `done` | has enum | verify CHECK |

---

## 6. Migration Action Summary

### 6.1 Phase 1: Critical Security (must complete before any feature work)

| Action | Tables Affected | Risk Level |
|--------|----------------|------------|
| Update `project_members.role` CHECK constraint to kernel 6-role model | 1 | **CRITICAL** — blocks all RLS policy correctness |
| Add RLS policies to CRITICAL-priority tables | 12 | **CRITICAL** — financial data, auth tokens exposed |
| Add RLS policies to HIGH-priority tables | 13 | **HIGH** — PII, credentials exposed |

### 6.2 Phase 2: Schema Conformance (column additions)

| Action | Tables Affected |
|--------|----------------|
| Add `created_by uuid REFERENCES auth.users` | ~75 tables |
| Add `deleted_at timestamptz` + `deleted_by uuid` | ~86 tables |
| Update SELECT RLS policies to include `AND deleted_at IS NULL` | ~86 tables |
| Add `update_updated_at()` trigger where missing | audit all tables |

### 6.3 Phase 3: State Machine Enforcement

| Action | Tables Affected |
|--------|----------------|
| Verify and correct CHECK constraints on all status columns | ~17 tables |
| Add `BEFORE UPDATE` trigger functions for state transition validation | 8 tables (kernel state machines) |
| Migrate `project_members.role` data: `member` → appropriate kernel role | 1 table (data migration) |

### 6.4 Phase 4: Remaining RLS

| Action | Tables Affected |
|--------|----------------|
| Add RLS policies to MEDIUM-priority tables | 25 |
| Add RLS policies to LOW-priority tables | 7 |

### 6.5 Table Resolution

| Table | Action |
|-------|--------|
| `payment_applications` | Investigate: if duplicate of `pay_applications`, deprecate and remove. If distinct, add kernel mapping or deprecate. |
| `bim_markups` | Deprecate (no kernel mapping). See DEPRECATION_LEDGER.md. |

---

*End of SCHEMA_GAP_ANALYSIS.md*
