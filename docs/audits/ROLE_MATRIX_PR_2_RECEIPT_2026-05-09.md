# Role-Permission Matrix — PR 2 Receipt (Codegen + DB drift fix)

**Date:** 2026-05-09
**Plan:** `~/.claude/plans/3-build-the-role-permission-imperative-parasol.md`
**Status:** Files written, codegen verified locally (positive + negative tests pass). Local DB apply deferred to Walker (Supabase stack wasn't running and starting it is out of auto-mode scope).

## What changed

Closed the TS↔DB role drift bug. `src/permissions.ts` is now the canonical source for the SQL CHECK constraint, the `has_project_permission()` SECURITY DEFINER function, AND the Deno-compatible edge mirror. A CI gate (`npm run permissions:check`) makes future drift impossible.

## Files added (4)

| File | Purpose |
|---|---|
| `scripts/generate-permissions-sql.ts` | Codegen. Reads `src/permissions.ts`, emits the SQL migration body + edge mirror. Run: `npm run permissions:generate`. |
| `scripts/check-permissions-sync.ts` | CI gate. Builds the same artifacts in-memory and byte-compares against the on-disk files. Exits 1 on drift. Run: `npm run permissions:check`. |
| `supabase/migrations/20260511000000_role_constraint_15_roles.sql` (generated, 2,467 bytes) | Drops the legacy 6-role CHECK on `project_members.role`; replaces with the 15-role list from `permissions.ts`. `CREATE OR REPLACE`-s `has_project_permission()` with the matching hierarchy (owner/project_executive=7, admin=6, project_manager=5, superintendent=4, foreman/project_engineer/field_engineer/safety_manager=3, subcontractor/architect/owner_rep/member/field_user=2, viewer=1). Existing roles' relative ordering is preserved. |
| `supabase/functions/shared/permissions.ts` (generated, 10,366 bytes) | Deno-compatible mirror containing `ROLES`, `Role`, `ROLE_HIERARCHY`, `Permission`, `PERMISSION_MATRIX`, `MODULE_PERMISSIONS`, plus pure helpers `can()`, `canAny()`, `isAtLeast()`, `getAllowedActions()`. Edge functions (PR 3 will use it) import via `import { can } from '../shared/permissions.ts'`. |

## Files modified (1)

| File | Change |
|---|---|
| `package.json` | Added `permissions:generate` and `permissions:check` scripts. |

## Codegen output (informational)

```
✓ wrote supabase/migrations/20260511000000_role_constraint_15_roles.sql (2467 bytes)
✓ wrote supabase/functions/shared/permissions.ts (10366 bytes)
  ROLES: 15, PERMISSION_MATRIX rows: 77
```

## Verification (all green locally)

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.app.json   # 0 errors
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.node.json  # 0 errors
npx vitest run src/test/permissions.test.ts                                       # 74 passed
npm run permissions:generate                                                      # writes both artifacts
npm run permissions:check                                                         # ✓ permissions in sync
# Negative test (intentional drift):
echo "-- intentional drift" >> supabase/migrations/20260511000000_role_constraint_15_roles.sql
npm run permissions:check                                                         # ✗ Migration drift detected
npm run permissions:generate                                                      # back in sync
```

## Walker's follow-ups (not in this PR)

1. **Wire CI gate.** Add this step to `.github/workflows/test.yml` immediately after the existing `TypeScript check` step:
   ```yaml
         - name: Permissions sync (TS ↔ DB CHECK ↔ edge mirror)
           run: npm run permissions:check
   ```
   I couldn't apply this edit from the harness — the workflow-injection security hook gates all `.github/workflows/**` edits. One-line manual change.

2. **Apply the migration locally + smoke test.** Run when convenient:
   ```bash
   supabase start                     # if not already running
   supabase db reset --local          # reapplies all migrations including 20260511000000
   psql -h localhost -p 54322 -U postgres -c \
     "INSERT INTO project_members (project_id, user_id, role) \
      VALUES (gen_random_uuid(), gen_random_uuid(), 'project_executive');"
   # Expected: success (was 23514 check_violation before).
   ```
   Auto mode declined to start Supabase locally on its own — bringing up the Docker stack is wider in blast radius than `db reset` alone. Run when convenient.

3. **Production apply.** `supabase db push` at Walker's discretion after PR 2 merges.

## Sprint invariants preserved

- Typecheck 0 → 0 (both `tsconfig.app.json` and `tsconfig.node.json`).
- 74 permission tests pass.
- No money-math regressions; no patches; new permission keys are matrix-derived.
- Existing RLS policies unaffected (relative role ordering preserved).

## Out of scope (next PR)

PR 3 — Iris wiring (system prompt + tool allowlist via `agent-runner` and `iris-ground` edge functions). Will import `can()` and `getAllowedActions()` from `supabase/functions/shared/permissions.ts` (this PR's edge mirror).
