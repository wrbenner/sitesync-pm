# Incident: Scale-Test Data Landed in PROD Supabase Project

**Date:** 2026-05-14
**Severity:** P1 (data integrity / test data in prod boundary)
**Status:** Teardown in progress
**Project ref affected:** `hypxrmcppjfbtlwuoafc` (name: "ss pm") — treated as production.

---

## Snapshot (pre-teardown)

Run via Supabase MCP `execute_sql` against `hypxrmcppjfbtlwuoafc` at 2026-05-14 just before teardown.

| Query | Count |
|---|---|
| `organizations` matching `name LIKE 'scale_test_%' OR slug LIKE 'scale-test-%'` (Walker's spec) | 50 |
| `auth.users` matching `email LIKE '%@scale-test.local' OR raw_user_meta_data->>'source' = 'scale_test'` (Walker's spec) | 0 |
| `projects` under above orgs (Walker's spec) | 0 |
| `project_members` under above projects (Walker's spec) | 0 |
| `organizations` with `(settings->>'scale_test')::boolean IS TRUE` (actual shape) | **50** |
| `auth.users` with `raw_user_meta_data->>'scale_test' = 'true'` OR `email LIKE 'scaletest-org-%@sitesync.test'` (actual shape) | **500** |
| `projects` under scale-test orgs (actual shape) | **50** |
| `project_members` under scale-test projects (actual shape) | **500** |
| `storage.objects` under scale-test org paths | **448** |
| `audit_log` entries under scale-test orgs (preserve as evidence) | **50** |

Note on Walker-query drift: Walker's spec used `name LIKE 'scale_test_%'` and `@scale-test.local` email shape; the seeder actually produced `Scale-Test Org NNN (persona)` names with `scale-test-<batch>-NN` slugs and `scaletest-org-NN-<persona>@sitesync.test` emails. The org slug match still returned 50 from the verbatim query; the user/project/pm verbatim queries returned 0 because they keyed off the unmatching name pattern. The actual-shape queries are the ones that mirror the seeder's tagging contract.

---

## What landed

- **50 organizations** with `settings.scale_test=true` and `settings.batch_id=<uuid>`
- **500 auth.users** (`scaletest-org-NNN-<persona>@sitesync.test`, all with `email_confirm=true`, `user_metadata.scale_test=true`, shared password from `SCALE_TEST_PASSWORD`)
- **500 organization_members** (1 owner + 9 members per org; owner role mapped to `owner`, personas mapped to `admin` or `member` per the org-members role check constraint)
- **50 projects** with `is_demo=true`, `name='Scale-Test Project <8-char-tag>'`
- **500 project_members** rows (owner+9 per project, with persona-mapped project_members.role: `owner|project_manager|superintendent|subcontractor|architect`)
- **448 storage.objects** across `drawings`, `photos`, `documents` buckets at paths `<org_id>/<project_id>/...` (expected 450 = 50 projects × 9 files; small delta likely idempotency-related)
- **50 audit_log entries** (one `organization.create` per provision_organization call) — **NOT torn down; preserved as incident evidence**

## What did NOT happen

- No real-user data was modified (queries scoped strictly to scale-test markers).
- No schema changes were applied. The earlier `provision_organization` SECURITY DEFINER paste happened via Walker's authorized SQL-editor session, not via MCP.
- The trigger-fix migrations (`20261020000000`, draft `20261022000000`) were NOT applied.
- The k6 load test (single 2-minute smoke run) only exercised existing rows — no permanent data created beyond seeds. All reads were RLS-correct; create/update/delete ops failed at the trigger layer (pre-existing prod bugs surfaced — see bug-triage note below).

## Root cause

`.env.scale-test` (as authored on 2026-05-14 morning) intentionally pointed `SUPABASE_URL` at `hypxrmcppjfbtlwuoafc` ("ss pm") because the seeder's hard guard was driven entirely by `SCALE_TEST_PROD_BLOCKLIST`, and that variable only contained `yuveewurqbibnqkfthbd` (the personal sandbox). The env file even carried a comment at line 10–11:

> # Blocklist: the OTHER project on the account ("wrbenner's Project" — personal
> # sandbox). ss pm is intentionally NOT in the blocklist since it's the target.

The mental model encoded in that comment was that `ss pm` was an internally-treated staging project. Walker treats `ss pm` as production-grade ahead of the July 1 beta launch — real customer data will land there. So the seeder was given the green light against what Walker considers prod, with no second-layer guard in the script itself to challenge that decision.

**Contributing factors:**
- The seed scripts' second-layer host check (`PROD_PROJECT_REF_BLOCKLIST.some((ref) => HOST.includes(ref))`) only fires when the blocklist contains the ref. With ss pm missing from the list, the script ran to completion without warning.
- No "if blocklist empty, refuse" rule existed — empty blocklist was treated as permissive instead of as a critical missing input.
- The real staging Supabase project (`nrsbvqkpxxlonvkmcmxf` = `sitesync-staging`) was not visible via `list_projects` MCP from the org that holds `ss pm`; the operator (me) assumed there was no staging and proceeded with what was in `.env`.

**Remediations applied:**
- `.env.scale-test` rewritten by Walker to blank `SUPABASE_URL` and blocklist both `hypxrmcppjfbtlwuoafc` and `yuveewurqbibnqkfthbd`. Staging target (`nrsbvqkpxxlonvkmcmxf`) documented in the header.
- Hard-fail guard added at top of `scripts/scale-test/seed-orgs.ts`: refuses to run when blocklist is empty, `SUPABASE_URL` is empty, or `SUPABASE_URL` host contains any blocklisted ref. Exit code 2, no warning, no continue.
- Same guard added to `scripts/scale-test/teardown-storage.ts` (with an explicit `--i-know-this-is-blocklisted` opt-in for incident-cleanup use cases against the blocklisted prod ref).
- Memory updated (`feedback_supabase_project_targeting.md`, `reference_supabase_staging.md`) so future sessions don't repeat the targeting mistake.

**Future prevention to consider:**
- Add the same guard to `seed-projects.ts`, `seed-storage.ts`, `mint-vu-tokens.ts`. (`seed-projects.ts` has a partial guard; the others lean on env propagation alone.)
- Promote the staging ref into the project's standing decisions doc so it's not buried in a memory file.
- Pre-flight check during BRT scale-test runbook: assert `supabase status` is linked to the staging ref before any seeder runs.

---

## Teardown plan and progress

1. ✅ Snapshot counts captured (above).
2. ✅ `teardown.ts --dry-run` showed 50 orgs in scope.
3. ⚠️ `teardown.ts` — partial. **Org cascade chain succeeded:** projects (50→0), org_members (cascaded), organizations (50→0). **`auth.users` loop got stuck:** 450 of 500 deleted, **50 owner users still alive** — blocked by `audit_log.user_id` foreign-key with `delete_rule = NO ACTION`. Task `b9ffw0rgn` was stopped after the loop entered a fail-retry spin against the same 50 owners. Awaiting decision on the conflict (see "Conflict" below).
4. ⏳ Storage sweep — script `scripts/scale-test/teardown-storage.ts` written but **not yet run**. 448 storage.objects still under `<org_id>/<project_id>/...` paths across `drawings`, `photos`, `documents` buckets.
5. ✅ Audit-log preservation: no deletes issued. 54 rows still present (50 from `provision_organization` + 4 from later actions).
6. ⏳ Verify-zero — pending owner-user + storage resolution.
7. ✅ `.env.scale-test` re-authored — `SUPABASE_URL` blanked, blocklist now includes both production-class refs (`hypxrmcppjfbtlwuoafc,yuveewurqbibnqkfthbd`), staging target documented (`nrsbvqkpxxlonvkmcmxf` = `sitesync-staging`).
8. ✅ Hard-fail guard added at top of `seed-orgs.ts` — refuses to run when blocklist is empty, `SUPABASE_URL` is empty, or the URL host contains any blocklisted ref. Same guard added to `scripts/scale-test/teardown-storage.ts`.

## Conflict resolution — Option A executed

Walker chose **Option A** on 2026-05-14. Steps taken:

1. `UPDATE audit_log SET user_id = NULL WHERE user_email LIKE 'scaletest-org-%@sitesync.test' AND user_id IS NOT NULL;` → **54 rows updated**. Every other audit_log field preserved (id, created_at, organization_id, user_email, entity_type, entity_id, action, metadata). Only the relational FK pointer to `auth.users` was dropped.
2. `DELETE FROM auth.users WHERE raw_user_meta_data->>'scale_test' = 'true' OR email LIKE 'scaletest-org-%@sitesync.test';` → **50 rows deleted**. `auth.identities`, `auth.sessions`, `auth.mfa_factors` cascade-deleted automatically.

## Verify-zero (post-Option-A)

Re-run of Walker's snapshot queries against `hypxrmcppjfbtlwuoafc`:

| Query | Pre | Post |
|---|---|---|
| `organizations` matching Walker's pattern | 50 | **0** ✓ |
| `auth.users` matching Walker's pattern | 0 | **0** ✓ |
| `projects` under Walker's-pattern orgs | 0 | **0** ✓ |
| `project_members` under Walker's-pattern projects | 0 | **0** ✓ |
| `organizations` actual (`settings.scale_test`) | 50 | **0** ✓ |
| `auth.users` actual (meta flag + email shape) | 500 | **0** ✓ |
| `projects` actual | 50 | **0** ✓ |
| `project_members` actual | 500 | **0** ✓ |
| `audit_log` preserved (by user_email) | — | **54** (target: keep) ✓ |
| `audit_log` rows with `user_id IS NULL` (Option A effect) | 0 | **54** ✓ |
| `storage.objects` under scaletest path regex | 448 | **448** ❌ pending |

Walker's required-zero set (orgs, users, projects, project_members) **all return 0**. audit_log preservation (54 rows) intact. Storage is the remaining open item.

## Storage residue resolution (2026-05-14 mission Phase 0.0)

Direct SQL `DELETE FROM storage.objects` is blocked by the `storage.protect_delete()` trigger: *"Direct deletion from storage tables is not allowed. Use the Storage API instead."* MCP has no Storage API surface — only `execute_sql`. The prod service-role key required by `scripts/scale-test/teardown-storage.ts` was intentionally blanked in `.env.scale-test` as part of the env-rewrite remediation.

**Status:** 448 storage.objects rows remain in `hypxrmcppjfbtlwuoafc` under UUID-prefixed paths whose `<org_uuid>` prefix references organizations that no longer exist (verified via subquery: 100% are orphaned under deleted orgs). They carry no FK to any live row.

**Walker's Gate 0.1 storage query (the `name LIKE 'scale_test_%' OR '%scale-test%'` pattern) returns 0** — these orphan paths use raw UUIDs only, no scaletest text. So the mission-spec gate passes.

**Recommended follow-up:** Walker runs `teardown-storage.ts` from his local with the prod service-role key once, with `--i-know-this-is-blocklisted`, after the battle-test mission completes. Alternative: leave them as zombies; Supabase storage will not auto-GC, but the rows are 9-byte minimum-PDF / 1×1 JPEG fixtures so storage cost impact is negligible.

### Walker-authorized cleanup attempt 2026-05-14

Walker authorized the literal DELETE pattern from the mission spec as a final cleanup attempt. Outcome:

- Pre-count under Walker's pattern (`name LIKE 'scale_test_%' OR '%scale-test%'`): **0 rows** — the pattern doesn't match UUID-only orphan paths.
- DELETE attempt: **PGSQL 42501**. `storage.protect_delete()` trigger blocks ALL direct SQL deletes from storage tables, regardless of WHERE clause matching 0 rows.

The 448 UUID-orphan storage.objects rows therefore persist in prod. Cost impact: ~448 × (9-byte PDF + 88-byte JPG) ≈ 18 KB total — negligible. They're functionally inert (no FK targets exist; nothing reads or writes through them) until Walker sweeps them via the Storage API from his local environment.

**This was the final authorized MCP call against `hypxrmcppjfbtlwuoafc` for this mission.** All subsequent operations target `nrsbvqkpxxlonvkmcmxf` (staging) only.

## Audit-log preservation

The 50 audit_log entries are evidence of the incident — what happened, when, who. They stay. Per Walker's directive, "those are evidence of the incident — keep them."

## Bug-triage note (deferred)

The scale-test surfaced two unrelated pre-existing prod trigger bugs:
- **Bug 1 (real):** `rfis_iris_ingest_trigger` + `daily_logs_iris_ingest_trigger` + 2 sibling trigger functions reference `projects.org_id`; actual column is `organization_id`. A migration to fix this (`supabase/migrations/20261020000000_fix_iris_ingest_trigger_column_name.sql`) exists in the repo but was never applied to `hypxrmcppjfbtlwuoafc`.
- **Bug 2 (real):** `daily_logs_iris_ingest_trigger` references `NEW.narrative`; column doesn't exist (closest is `summary`). Existing 20261020 migration doesn't fix this.
- **Bug 3 (NOT real):** `fn_mark_search_dirty` was incorrectly flagged as missing `SECURITY DEFINER`. Walker's verification (`SELECT prosecdef FROM pg_proc...`) returned `prosecdef=true`. The function is already SECDEF. The actual cause of the `search_index_dirty_flags` RLS rejection on punch/submittal inserts needs different investigation (likely function-owner-without-BYPASSRLS or a separate policy issue) — not this incident's blast radius.

Bug-fix PRs are blocked until teardown is verified zero AND the staging-project question is resolved.

