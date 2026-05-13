# BRT sub-0 Day 3 — P0-C + P0-D + P0-F Receipt

**Date:** 2026-05-13
**Branch:** `brt/sub-0-day-3-p0c-p0d-p0f` (merged via PR #509)
**Operator:** Claude Code (Opus 4.7 1M-ctx) via Supabase MCP, with Cowork-side dashboard execution for P0-F
**Linked plan:** `~/.claude/plans/lucky-watching-bird.md` (Days 3–5 autonomous runbook)
**Linked specs:** `BRT_SUBSYSTEM_0_P0_SPRINT_2026-05-12.md`, `STAGE_1_FOUNDATION_AUDIT_2026-05-12.md`, `STAGE_2_SCALE_AUDIT_2026-05-12.md`
**Standing decisions:** `BRT_SUB_0_STANDING_DECISIONS_2026-05-13.md`

## Purpose

Close three P0 findings:
- **P0-C** `search_project` lacked membership check; any authenticated caller could full-text search any project's RFIs/submittals/tasks/punch items/drawings/contacts/meetings/files by passing the project UUID.
- **P0-D** `write_audit_entry` lacked membership check; any authenticated caller could forge audit entries for any project.
- **P0-F** 8 storage buckets had weak ALL-policies (`bucket_id='X' AND auth.uid() IS NOT NULL`); every authenticated user could read/write/delete files across all tenants.

Two SQL fixes (in-place modifications per Standing Decisions §3) + one per-command storage policy replacement (dashboard apply via Cowork due to MCP role limitation per §10 case 3).

## Verifications captured

### P0-C + P0-D — membership guards present

```sql
SELECT p.proname, p.prosecdef, p.proconfig,
       pg_get_functiondef(p.oid) ~ 'forbidden.*42501' AS has_guard,
       (SELECT string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee)
          FROM information_schema.role_routine_grants g
         WHERE g.routine_schema='public' AND g.routine_name=p.proname) AS grants
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
 WHERE p.proname IN ('search_project','write_audit_entry');
```

Both functions: `prosecdef=true`, `proconfig=['search_path=public']`,
`has_guard=true`, grants `authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE`
(no anon).

### P0-F — storage policy shape

```sql
SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
     AND policyname IN ('storage_attachments_access','storage_daily_log_photos_access',
                        'storage_daily_log_signatures_access','storage_documents_access',
                        'storage_punch_list_photos_access','storage_reports_access',
                        'storage_safety_photos_access','storage_submittal_specs_access')) AS old_weak,
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
     AND policyname ~ '^storage_.*_access_(select|insert|update|delete)$') AS new_per_cmd,
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
     AND policyname ~ '^storage_.*_access_(select|insert|update|delete)$'
     AND roles::text[] = ARRAY['authenticated']) AS scoped_authenticated,
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
     AND policyname ~ '^storage_.*_access_(select|insert|update|delete)$'
     AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%project_members%') AS has_membership_gate;
```

Result: `old_weak=0, new_per_cmd=32, scoped_authenticated=32, has_membership_gate=32`.

All 8 weak ALL-policies dropped; 32 per-command (4 cmds × 8 buckets) policies created, all scoped to `authenticated`, all gating via `project_members` EXISTS.

### Schema_migrations bookkeeping

```sql
SELECT version, name, created_by FROM supabase_migrations.schema_migrations
 WHERE version IN ('20261014000000','20261014010000') OR name LIKE 'p0%_%_guards' OR name LIKE 'p0f_%';
```

| Version | Name | Created by |
|---|---|---|
| 20260513… | p0c_p0d_membership_guards | wrbenner23@gmail.com (real MCP apply) |
| 20261014000000 | p0c_p0d_membership_guards | shadow:p0-sprint-sync |
| 20261014010000 | p0f_storage_buckets_project_scoped | shadow:p0-sprint-sync (paired with Cowork dashboard apply) |

## Deliverables landed

| Path | Purpose |
|---|---|
| `supabase/migrations/20261014000000_p0c_p0d_membership_guards.sql` | In-place `CREATE OR REPLACE` of search_project + write_audit_entry with membership guards (Day 3 AM) |
| `supabase/migrations/20261014010000_p0f_storage_buckets_project_scoped.sql` | DROP/CREATE 32 per-command storage policies (Day 3 PM, applied via Cowork dashboard) |
| `supabase/tests/database/p0c_search_project_cross_tenant.sql` | pgTAP: non-member call raises 42501 |
| `supabase/tests/database/p0d_write_audit_entry_cross_tenant.sql` | pgTAP: same shape |
| `supabase/tests/database/p0f_storage_cross_tenant.sql` | pgTAP shape check: 8 weak gone, 32 new present, all authenticated + membership-gated |

PR: #509 (merged via auto-merge past the 3 documented pre-existing infra reds per Standing Decisions §7).

## Security advisor lint diff

| Lint family | Day 2 end | Day 3 end | Δ | Level | Disposition |
|---|---|---|---|---|---|
| security_definer_view | 0 | 0 | 0 | ERROR | ✅ held |
| materialized_view_in_api | 0 | 0 | 0 | WARN | ✅ held |
| **anon_security_definer_function_executable** | **76** | **74** | **−2** | WARN | ✅ explicit REVOKE on search_project + write_audit_entry |
| authenticated_security_definer_function_executable | 82 | 82 | 0 | WARN | ✅ modify-in-place per §3 — no stragglers |
| **function_search_path_mutable** | **83** | **81** | **−2** | WARN | ✅ bonus — both new guards pin search_path (originally P2-3 scope) |
| rls_enabled_no_policy | 3 | 3 | 0 | INFO | unchanged |
| rls_policy_always_true | 31 | 31 | 0 | WARN | P1-A scope |
| extension_in_public | 3 | 3 | 0 | WARN | P2-1 scope |
| public_bucket_allows_listing | 1 | 1 | 0 | WARN | P1-F scope (unrelated to P0-F) |
| auth_leaked_password_protection | 1 | 1 | 0 | WARN | P2-4 scope |
| **TOTAL** | **280** | **276** | **−4** | — | |

P0-F closure is a posture improvement (cross-tenant access blocked) not a lint-count delta — the storage-schema policies don't appear in any of the advisor's tracked families. The receipt artifact is the shape verification above.

## Risk + fallback notes

**P0-F dashboard apply through Cowork (not MCP):** Standing Decisions §10 case 3 (MCP write failure) was correctly triggered when MCP `apply_migration` hit `42501 must be owner of relation objects` on `DROP POLICY ... ON storage.objects`. Cowork applied the same SQL via dashboard SQL editor (admin role). Shadow row paired by version 20261014010000 so future `db push --linked` is idempotent. On-disk file is the canonical SQL; matches what was applied.

**`function_search_path_mutable` bonus drop (−2):** opportunistic — both functions had unpinned search_paths pre-fix. Pinning is canon per Standing Decisions §2, so adding it as part of the in-place modification was free. No risk; aligns with the broader P2-3 sweep direction.

**Storage path malformation risk:** the new policies use `(storage.foldername(name))[1]::uuid` with a regex guard before the cast. Files uploaded with non-UUID prefixes at folder level 1 will fail the regex check → deny rather than raise. Day 0 receipt confirmed the 2 populated buckets are 100% UUID-prefixed; the 6 empty buckets are unaffected until first write.

**Untested: P0-F functional cross-tenant fixture.** The pgTAP test (`p0f_storage_cross_tenant.sql`) only verifies policy shape. A functional test (user-A attempts insert into project-B path → expect RLS violation) requires seed data (auth.users, projects, project_members) that pgTAP's clean-transaction rollback doesn't trivially support. Walker can spot-check via dashboard or Vercel preview (try downloading a daily-log photo from an out-of-org project as a normal user → expect 403).

## Outstanding sprint scope

| Day | Status |
|---|---|
| Day 0+1 | ✅ Closed |
| Day 2 | ✅ Closed (signed off) |
| **Day 3** | ✅ **CLOSED (this receipt)** |
| Day 4 AM | ⏳ P0-G authStore atomicity (next) |
| Day 4 PM | ⏳ P0-H signup slug surfacing + P0-I ToS checkbox |
| Day 5 | ⏳ Final advisor + sprint receipt for Walker signature |

## Exit criteria checklist

- [x] search_project + write_audit_entry both have membership guards (verified via `pg_get_functiondef ~ 'forbidden.*42501'`)
- [x] Both pinned `search_path = public`
- [x] Grants: `authenticated, postgres, service_role` (no anon)
- [x] 8 weak storage ALL-policies dropped
- [x] 32 per-command storage policies created (4 × 8)
- [x] All new policies scoped to `authenticated`
- [x] All new policies gate via `project_members` EXISTS
- [x] Shadow rows in `schema_migrations` for both Day 3 migrations
- [x] PR #509 merged to main
- [x] Advisor lint deltas match projection (no regressions; −4 total)
- [ ] (Optional) Walker spot-check on Vercel preview / dashboard: re-fetch a known daily-log photo confirms no regression

— End of Day 3 receipt —
