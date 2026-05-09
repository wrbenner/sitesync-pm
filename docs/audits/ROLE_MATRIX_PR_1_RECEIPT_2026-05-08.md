# Role-Permission Matrix — PR 1 Receipt (Consolidation)

**Date:** 2026-05-08
**Plan:** `~/.claude/plans/3-build-the-role-permission-imperative-parasol.md`
**Status:** Complete. typecheck=0, tests pass, audit-gate baseline unchanged.

## What changed

Consolidated the existing `PERMISSION_MATRIX` (52 permissions × 23 resources) and `ROLE_HIERARCHY` (15 roles) into a single canonical file `src/permissions.ts`. Retired the scattered `role === 'admin'` ad-hoc checks across 4 state machines and 3 page-level bypasses. Zero behavioral churn at the 545 `PermissionGate` call sites and the 29 `usePermissions()` consumers — they see identical hook shape.

## Files touched

| File | Change |
|---|---|
| **`src/permissions.ts`** (new, 269 LOC) | Canonical source: `ROLES`, `Role`, `ROLE_HIERARCHY`, `ROLE_LEVELS`, `Permission`, `PERMISSION_MATRIX`, `MODULE_PERMISSIONS`, `DEV_BYPASS_ROLE`, plus pure helpers `can()`, `canAny()`, `isAtLeast()`, `getAllowedActions()`, `canAccessModule()`. Zero imports from `src/`. Edge-compatible. |
| `src/hooks/usePermissions.ts` (395 → 205 LOC, **−190**) | Hook now imports from `permissions.ts` and re-exports for backwards compat. Hook logic itself preserved (membership query + realtime invalidation + dev-bypass warning). |
| `src/types/stream.ts` | `ProjectRole = Role` (aliases canonical type). `Permission` import re-routed through `permissions.ts`. Breaks the previous stream.ts↔usePermissions.ts↔database.ts type cycle. |
| `src/types/tenant.ts` | Removed duplicate `ROLE_HIERARCHY` literal. Re-exports from `permissions.ts`. |
| `src/lib/supabase.ts` | Removed legacy `UserRole` import. `getProjectRole()` returns `Role \| null`. `isOrgAdmin()` keeps literal `=== 'admin'` (org role is its own 3-value domain, distinct from project matrix). |
| `src/machines/rfiMachine.ts` | `userRole === 'admin' \|\| 'owner'` → `can(role, 'rfis.void')` |
| `src/machines/submittalMachine.ts` | `userRole !== 'viewer'` → `isAtLeast(role, 'subcontractor')`. Redundant `\|\| admin \|\| owner` removed (already in `isGC`). |
| `src/machines/changeOrderMachine.ts` | `['admin','owner'].includes(role)` → `can(role, 'change_orders.approve')`. Workflow-lane checks (`isApprover`, `isSubmitter`) kept as role lists with rationale comment. |
| `src/machines/drawingMachine.ts` | `isAdminOrOwner` → `can(role, 'drawings.delete')`. `isReviewer` → `can(role, 'drawings.upload')`. Phantom `'reviewer'` role check eliminated (never existed in DB). |
| `src/components/rfi/RFIResponseThread.tsx` | `isAdmin = role === 'owner' \|\| 'admin'` → `can(role, 'rfis.admin_edit')`. `canFlipOfficial` → new `rfis.flip_official` matrix key. |
| `src/pages/payment-applications/index.tsx` | `canReleaseRetainage` → new `financials.release_retainage` matrix key. `canBypassPeriodLock` → new `financials.bypass_period_lock` matrix key. |
| `src/pages/OwnerPortal.tsx` | `isOwner = role === 'owner'` → new `project.owner_view` matrix key. |
| `src/services/drawingService.test.ts` (test fix) | Phantom `'reviewer'` literal → `'project_manager'` (the matrix equivalent). |
| `src/test/machines/drawingMachine.test.ts` (test fix) | Same. |

## New permission keys added (4)

- `rfis.flip_official` — owner/admin/member (preserves original literal check from response thread)
- `financials.release_retainage` — owner/admin/project_manager (matches original)
- `financials.bypass_period_lock` — owner/admin (matches original)
- `project.owner_view` — owner-only literal (Owner Portal lens)

## Verification (all clean)

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.app.json   # 0 errors
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.node.json  # 0 errors
npx vitest run                                                                  # 3,325 passed
node scripts/audit-permission-gate.mjs                                          # 0/0/0/0/0/0 (baseline unchanged)
grep -rn "role === '\(admin\|owner\)'" src/                                     # 4 hits, all in OrgRole domain (acceptable)
grep -rn "userRole === " src/                                                   # 0 hits
grep -rn "UserRole\." src/                                                      # 0 hits
```

## Out of scope (next PRs per plan)

- **PR 2:** Codegen DB CHECK constraint from `permissions.ts`; expand DB role allowlist from 6 → 15 to fix the latent `'project_executive'` insertion drift.
- **PR 3:** Wire Iris (system prompt + tool allowlist) to `getAllowedActions(role)` so `viewer` users get a polite refusal when asking Iris to mutate state.
- **PR 4:** Audit baseline already at 0/0/0/0/0/0 — the May 1 audit's 27 unguarded buttons were closed in earlier sessions. PR 4 is now a no-op; remove from plan.

## Sprint invariants preserved

- Typecheck 0 → 0 (no regression).
- 545 `PermissionGate` call sites untouched — public hook shape preserved by re-exports.
- No new stores added; no money-math regressions; no patches.
