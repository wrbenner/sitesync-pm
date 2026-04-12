# DEPRECATION_LEDGER.md — SiteSync PM

> **Version:** 1.0.0
> **Status:** Draft — Awaiting Owner Approval
> **Author:** Walker Benner (@wrbenner)
> **Last Updated:** 2026-04-09
> **Depends On:** DOMAIN_KERNEL_SPEC.md v1.0.0, SCHEMA_GAP_ANALYSIS.md v1.0.0
> **CODEOWNERS:** @wrbenner (changes require PR + review)

---

## 1. Purpose

This document tracks all planned deprecations across the SiteSync PM codebase:

- **Tables** to deprecate or consolidate
- **Columns** to deprecate (renamed, replaced, or removed)
- **Pages** to hide from navigation (incomplete or non-conformant features)
- **Hooks** to consolidate (redundant or pre-kernel hooks)
- **Edge functions** to merge (into shared policy layer)

**Deprecation policy:** No deprecated item is removed until:
1. Core workflows (Step 7) are stable and passing evals
2. The replacement is fully operational
3. A migration script handles data transfer
4. Owner (@wrbenner) approves removal

---

## 2. Tables to Deprecate

| # | Table | Reason | Replacement | Timeline | Migration Path |
|---|-------|--------|-------------|----------|----------------|
| 1 | `bim_markups` | No kernel mapping. BIM markup functionality is not part of the kernel domain model. The `drawing_markups` table covers construction drawing annotations. BIM is a separate domain (Non-Goal N1). | `drawing_markups` for 2D annotations; BIM features deferred to future BIM module | After Step 7 (core workflows stable) | 1. Audit usage: check if any frontend code references `bim_markups`. 2. If data exists, export as JSON backup. 3. Migrate any shared fields to `drawing_markups` if applicable. 4. Drop table after confirmation of zero references. |
| 2 | `payment_applications` | Suspected duplicate of `pay_applications`. Both names appear in the schema. The kernel entity `PayApplication` maps to `pay_applications`. | `pay_applications` (kernel-canonical name) | Immediate (Step 2 migration) | 1. Confirm whether `payment_applications` and `pay_applications` are the same table (alias) or distinct tables with different data. 2. If distinct: migrate all rows from `payment_applications` → `pay_applications`, reconciling any schema differences. 3. If alias/view: drop the alias. 4. Update all frontend code referencing `payment_applications` to use `pay_applications`. |

---

## 3. Columns to Deprecate

### 3.1 Role Enum Migration (`project_members.role`)

| # | Table.Column | Reason | Replacement | Timeline | Migration Path |
|---|-------------|--------|-------------|----------|----------------|
| 1 | `project_members.role` value `'member'` | Kernel requires 6 specific roles (`owner`, `admin`, `project_manager`, `superintendent`, `subcontractor`, `viewer`). The generic `'member'` role is ambiguous and prevents proper permission enforcement. | Split into `project_manager`, `superintendent`, or `subcontractor` based on actual user function | Step 3 (Phase 1: Critical Security) | 1. Audit all `project_members` rows where `role = 'member'`. 2. For each user, determine correct kernel role from usage patterns (do they create daily logs → superintendent; create submittals → subcontractor; manage workflows → project_manager). 3. If ambiguous, default to `viewer` (least-privilege principle — users can be upgraded after review). 4. Update CHECK constraint to kernel values. 5. Run data migration. 6. Update `is_project_role()` function. 7. Update all RLS policies using role arrays. |

### 3.2 Columns to Add (not deprecations, but tracked here for completeness)

These are new columns required by the kernel that will be added across most tables. They are not deprecations but are tracked here because their absence represents a gap.

| Column | Tables Affected | Purpose | Default | Notes |
|--------|----------------|---------|---------|-------|
| `created_by` | ~75 tables | Audit provenance — who created the row | `auth.uid()` via trigger or application | Nullable for existing rows (backfill where possible from `audit_log`) |
| `deleted_at` | ~86 tables | Soft delete timestamp | `NULL` | Non-null = soft-deleted |
| `deleted_by` | ~86 tables | Soft delete actor | `NULL` | FK → `auth.users` |

### 3.3 Columns to Verify for Deprecation (post-kernel review)

After kernel conformance is achieved, these column patterns should be reviewed:

| # | Pattern | Tables | Reason | Action |
|---|---------|--------|--------|--------|
| 1 | Ad-hoc `status` string columns (not CHECK-constrained) | Various (needs audit) | Kernel Section 5 requires CHECK constraints on all status columns. Any `status text` without a CHECK is a schema smell. | Add CHECK constraint or convert to kernel enum values |
| 2 | Redundant `is_active` / `active` boolean columns | Various (needs audit) | If a table has both a `status` enum and an `is_active` boolean, the boolean is redundant. Status enum is the source of truth. | Deprecate boolean; derive active state from status |
| 3 | Denormalized `organization_id` on project-scoped tables | Various (needs audit) | Project-scoped tables can resolve `organization_id` through `projects.organization_id`. Storing it directly is denormalization that can cause inconsistency. | Evaluate: if used in RLS policies for performance, retain. If only for convenience queries, consider removing. |

---

## 4. Pages to Hide from Navigation

Pages corresponding to features that are not yet kernel-conformant should be hidden from the navigation to prevent users from interacting with non-conformant data flows. Hidden pages retain their routes and components; they are simply removed from the navigation menu.

| # | Page / Route | Reason | Restore Condition |
|---|-------------|--------|-------------------|
| 1 | BIM Viewer / BIM Markups | No kernel mapping. `bim_markups` table is deprecated. Feature is outside kernel scope. | Restore when/if a BIM module is added to the kernel in a future version. |
| 2 | Estimating Module | Tables (`estimates`, `estimate_line_items`, `takeoff_items`) have no RLS policies. Financial data exposure risk. | Restore after RLS policies are added (Phase 1: CRITICAL priority) and kernel state machine (`draft`, `in_review`, `submitted`, `awarded`, `lost`) is enforced. |
| 3 | Bidding Module | Tables (`bid_packages`, `bid_invitations`, `bid_responses`) have no RLS policies. Competitive pricing data at risk. | Restore after RLS policies are added (Phase 1: CRITICAL priority) and kernel state machine is enforced. |
| 4 | Procurement / Purchase Orders | Tables (`purchase_orders`, `po_line_items`) have no RLS policies. Financial data exposure. | Restore after RLS policies are added and kernel PO status enum is enforced. |
| 5 | Invoices Payable | Table `invoices_payable` has no RLS policy. Financial data exposure. | Restore after RLS policies are added and kernel invoice status enum is enforced. |
| 6 | WIP Reports | Table `wip_reports` has no RLS policy. Financial reporting data exposure. | Restore after RLS policies are added. |
| 7 | Contracts Module | Table `contracts` has no RLS policy. Contract values and terms exposed. | Restore after RLS policies are added and kernel contract status enum is enforced. |
| 8 | Cost Database (Org-level) | Table `cost_database` has no RLS policy. Org-wide cost data exposed cross-tenant. | Restore after org-scoped RLS policies are added. |
| 9 | Integration Settings | Tables (`integrations`, `integration_sync_log`, `integration_field_mappings`) have no RLS. Third-party credentials at risk. | Restore after org-scoped RLS policies are added. |
| 10 | Portal / Owner Portal | Tables (`portal_users`, `portal_invitations`, `portal_access_tokens`, `owner_updates`) have no RLS. Auth tokens and external user PII exposed. | Restore after portal-specific RLS policies are added. |
| 11 | AI Agent Configuration | Tables (`ai_agents`, `ai_agent_actions`, `ai_insights`, `ai_usage`) have no RLS. | Restore after project-scoped RLS policies are added and AI policy layer (Step 7+) is implemented. |
| 12 | Executive Reports | Table `executive_reports` has no RLS. Sensitive executive summaries exposed. | Restore after org+project scoped RLS policies are added. |
| 13 | Labor Forecasts | Table `labor_forecasts` has no RLS. Workforce rate projections exposed. | Restore after project-scoped RLS with financial role restrictions are added. |
| 14 | Sustainability / Waste Tracking | Tables (`sustainability_metrics`, `waste_logs`) have no RLS. Low risk but non-conformant. | Restore after RLS policies are added. |

**Navigation hiding implementation:** Toggle via feature flags or a `HIDDEN_ROUTES` config array in the app layout. No code deletion. All components and routes remain in the codebase for restoration.

---

## 5. Hooks to Consolidate

The current codebase contains multiple React hooks that perform overlapping functions. The kernel defines clear entity-per-hook boundaries. Hooks should be consolidated into kernel-aligned hooks.

| # | Current Hook(s) | Target Kernel Hook | Timeline | Rationale |
|---|----------------|-------------------|----------|-----------|
| 1 | `useAuth.ts`, `useSSO.ts` | `useAuth.ts` (unified) | After Step 3 (eval harness) | `useSSO.ts` is a specialized auth flow that should be a sub-module of `useAuth`, not a separate hook. SSO is an auth strategy, not a separate domain. |
| 2 | `usePermissions.ts` | `usePermissions.ts` (update to 6-role model) | Step 3 Phase 1 (with role enum migration) | Currently uses the 6-role model in code but DB has 4 roles. After DB migration, hook and DB will be aligned. No consolidation needed — just ensure hook reads from kernel roles. |
| 3 | `useOrganization.ts` | `useOrganization.ts` (retain) | N/A | Already kernel-aligned. Manages org-scoped operations. |
| 4 | Multiple entity-specific query hooks (e.g., `useRFIs`, `useSubmittals`, `useDailyLogs`, etc.) | Per-entity kernel hooks with shared `useKernelQuery` base | After Step 7 (core workflows stable) | Currently each entity hook likely re-implements query patterns, error handling, and cache management. Consolidate into a shared base hook (`useKernelQuery`) that handles: RLS-aware querying, soft-delete filtering (`deleted_at IS NULL`), optimistic updates, realtime subscriptions. Entity-specific hooks become thin wrappers. |
| 5 | Multiple entity-specific mutation hooks (e.g., `useCreateRFI`, `useUpdateRFI`, `useTransitionRFI`) | Per-entity kernel mutation hooks with shared `useKernelMutation` base | After Step 7 (core workflows stable) | Similar to query hooks — consolidate shared patterns (audit log integration, optimistic update, error handling, state transition validation) into a base mutation hook. Entity-specific mutation hooks validate against kernel state machines before calling Supabase. |
| 6 | Any direct Supabase client calls in components | Eliminated — all data access via kernel hooks | After Step 7 | No component should call `supabase.from('table')` directly. All access must go through kernel hooks that enforce permission checks, soft-delete filtering, and audit logging. |

---

## 6. Edge Functions to Merge

Edge functions that perform similar operations (authentication, authorization, audit logging, notification dispatch) should be consolidated into a shared policy layer to reduce duplication and ensure consistent kernel enforcement.

| # | Current Function(s) | Target Shared Layer | Timeline | Rationale |
|---|--------------------|--------------------|----------|-----------|
| 1 | Individual edge functions that check user permissions | **Shared auth middleware** (`_shared/auth.ts`) | After Step 3 (eval harness) | Every edge function that accesses project data needs to verify the user's project role. This should be a shared middleware, not duplicated per function. The middleware resolves `auth.uid() → organization_members → project_members → role` once and passes the resolved context to the handler. |
| 2 | Individual edge functions that write to `audit_log` | **Shared audit service** (`_shared/audit.ts`) | After Step 3 (eval harness) | Audit log writes follow the same pattern (Section 8 of kernel): entity_type, entity_id, action, user_id, actor_type, old_values, new_values, metadata. Centralize into one function: `logAuditEvent(context, entity, action, oldValues, newValues)`. |
| 3 | Individual edge functions that dispatch notifications | **Shared notification service** (`_shared/notifications.ts`) | After Step 7 (core workflows) | Notification dispatch follows the event model (Section 9): determine recipients, create `notifications` rows, optionally trigger email/push. Centralize into: `dispatchNotification(event, recipients, channels)`. |
| 4 | Individual edge functions that validate state transitions | **Shared state machine engine** (`_shared/state-machine.ts`) | After Step 7 (core workflows) | State transition validation follows the same pattern for all 8 state machines: check current state, check target state is reachable, check user role is allowed, execute side effects. Centralize into: `validateTransition(entity, fromState, toState, userRole)` and `executeTransition(entity, toState, sideEffects)`. |
| 5 | AI-related edge functions (drawing analyzer, submittal prefiller, schedule predictor, daily log analyzer, RFI router, safety monitor, cost forecaster, document classifier) | **Shared AI policy layer** (`_shared/ai-policy.ts`) | After AI policy layer (Step 7+) | All AI edge functions must: check trust level, enforce confidence thresholds, write to `ai_agent_actions`, track usage in `ai_usage`, respect guardrails (Section 11). Centralize guardrail enforcement into a shared layer that wraps each AI function. Individual AI functions become handlers that receive validated context from the policy layer. |
| 6 | Webhook dispatch functions | **Shared webhook service** (`_shared/webhooks.ts`) | After Step 7 | Webhook delivery follows a consistent pattern: serialize event, sign payload, deliver to endpoint, log to `webhook_deliveries`, handle retries. Centralize into a single dispatch service. |

### 6.1 Target Shared Layer Architecture

```
supabase/functions/
├── _shared/
│   ├── auth.ts              — Identity resolution + role check
│   ├── audit.ts             — Audit log writer
│   ├── notifications.ts     — Notification dispatch
│   ├── state-machine.ts     — State transition validator + executor
│   ├── ai-policy.ts         — AI guardrails + trust tagging
│   ├── webhooks.ts          — Webhook delivery service
│   └── types.ts             — Shared kernel types
│
├── rfi-transition/          — Uses: auth, state-machine, audit, notifications
├── submittal-transition/    — Uses: auth, state-machine, audit, notifications
├── change-order-transition/ — Uses: auth, state-machine, audit, notifications
├── pay-app-transition/      — Uses: auth, state-machine, audit, notifications
├── daily-log-transition/    — Uses: auth, state-machine, audit, notifications
├── punch-item-transition/   — Uses: auth, state-machine, audit, notifications
├── permit-transition/       — Uses: auth, state-machine, audit, notifications
│
├── ai-drawing-analyzer/     — Uses: auth, ai-policy, audit
├── ai-submittal-prefiller/  — Uses: auth, ai-policy, audit
├── ai-schedule-predictor/   — Uses: auth, ai-policy, audit
├── ai-daily-log-analyzer/   — Uses: auth, ai-policy, audit
├── ai-rfi-router/           — Uses: auth, ai-policy, audit
├── ai-safety-monitor/       — Uses: auth, ai-policy, audit
├── ai-cost-forecaster/      — Uses: auth, ai-policy, audit
├── ai-document-classifier/  — Uses: auth, ai-policy, audit
│
└── webhook-dispatch/        — Uses: auth, webhooks, audit
```

---

## 7. Deprecation Timeline

| Phase | When | Actions |
|-------|------|---------|
| **Phase 0** | Immediate (with this PR) | Document all deprecations (this file). No code changes. |
| **Phase 1** | Step 3 migrations (Critical Security) | Migrate `project_members.role` enum. Add RLS to CRITICAL tables. Create shared auth + audit edge function layers. |
| **Phase 2** | Step 4-5 migrations (Schema Conformance) | Add `created_by`, `deleted_at`, `deleted_by` to all tables. Add RLS to remaining tables. Hide non-conformant pages from navigation. |
| **Phase 3** | Step 6-7 (Core Workflows) | Consolidate entity hooks into kernel pattern. Merge edge functions into shared layers. Implement state machine engine. |
| **Phase 4** | Post-Step 7 (Cleanup) | Remove `bim_markups` table (after data export). Resolve `payment_applications` duplicate. Remove deprecated columns. Restore hidden pages as RLS coverage is confirmed. |
| **Phase 5** | Ongoing | Restore hidden pages one-by-one as each module passes eval suite. Each restoration requires: RLS confirmed via eval, state machine eval passing, kernel hook in place. |

---

## 8. Restore Checklist Template

When restoring a hidden page/module, verify all of the following:

- [ ] All tables used by the module have RLS enabled (confirmed via `SCHEMA_GAP_ANALYSIS.md`)
- [ ] All tables have per-operation policies (SELECT, INSERT, UPDATE, DELETE) matching the kernel permission matrix
- [ ] All status columns have CHECK constraints matching kernel enum values
- [ ] All tables have `created_by`, `deleted_at`, `deleted_by` columns
- [ ] SELECT policies include `AND deleted_at IS NULL`
- [ ] Kernel hooks are in place (no direct Supabase client calls from components)
- [ ] Layer 1 evals pass (tenant isolation, permission boundary, scope enforcement)
- [ ] Layer 2 evals pass (API auth enforcement, scope enforcement)
- [ ] Owner (@wrbenner) approves restoration

---

*End of DEPRECATION_LEDGER.md*
