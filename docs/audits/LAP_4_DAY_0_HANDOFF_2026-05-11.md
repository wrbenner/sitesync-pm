# Lap 4 Day 0 Handoff — Walker-driven pre-flight items

**Date:** 2026-05-11
**Author:** Walker + Claude
**Lap 4 plan:** `~/.claude/plans/user-approved-claude-s-plan-delegated-firefly.md`
**Lap 3 close receipt:** `LAP_3_KICKOFF_RECEIPT_2026-05-11.md`

## What this doc is

The Lap 4 plan's Day-0 pre-flight has 11 items. 7 of them are engineering-side and verified clean during the Lap 4 readiness sweep (separate PR). The remaining 4 are environment / secrets / data and need Walker to run them before opening PR 3a.

This is the explicit checklist. Walker runs each item, ticks the box, and then opens PR 3a with confidence that nothing in Phase 3a will fail on a missing precondition.

---

## Engineering-side pre-flight (already verified — no action needed)

- [x] Lap 3 fully merged into main (last commit: `#430` Lap 3 kickoff receipt)
- [x] Typecheck zero on both `tsconfig.app.json` AND `tsconfig.node.json` (hotfix `#431` restored after a covariance regression in `autoExecute.test.ts`)
- [x] Vitest suite green: 3,541 pass, 10 skipped, 0 failed across 306 files
- [x] All Lap 3 receipts filed: 5 Phase 1 + 5 Phase 2 + cancel-window + auto-execute opt-in + Lap 3 kickoff = 13 receipts under `docs/audits/`
- [x] 4 Iris Spec cards (one per Phase 2 specialist) + 3 Workflow Spec cards (one per executor)
- [x] Phase 2 specialists declared in `src/services/iris/specialists/`: `DRAFTER_DECL`, `MONEY_DECL`, `SCHEDULE_DECL`, `CODE_DECL`
- [x] Router accuracy test passes (50-case starter set, ≥ 95% accuracy enforced)
- [x] All 7 required CI gates green on main HEAD (Gate 1–5 + Eval L1/L2)
- [x] Gate 1 CI hardened to use `npm run typecheck` (both project configs) per the `#431` post-mortem

---

## Walker-driven Day-0 checklist (run these before PR 3a)

### 1. Regenerate `database.ts` against staging

Lap 3 added 4 new tables (`iris_personas`, `iris_user_personas`, `role_to_default_persona`, `executor_runs`, `org_executor_cancel_rate_7d` view) + 1 RPC (`resolve_persona`) + an `organizations.auto_execute_opt_in` column. The typed Supabase client doesn't know about these yet — `usePersona.ts` currently uses a `supabase.rpc as unknown as ...` cast as a temporary workaround.

**Action:**

```bash
# Apply Lap 3 migrations to staging first if not yet applied.
# (Walker confirms which migrations are live before running this.)

npm run db-types:write           # regenerates src/types/database.ts against $STAGING_DB_URL
git diff src/types/database.ts   # spot-check the diff
git add src/types/database.ts
git commit -m "db-types: regen for Lap 3 schema (resolve_persona, executor_runs, auto_execute_opt_in)"
git push  # opens a tiny PR or commits to a Day-0 branch
```

Optional clean-up after the regen lands: remove the `supabase.rpc as unknown` cast in `src/hooks/usePersona.ts` and replace with the typed call.

**Acceptance:** `git grep "supabase.rpc as unknown" src/hooks/usePersona.ts` returns nothing.

---

### 2. Verify `pgvector` extension on staging

Phase 3a's first migration (`20261008000000_iris_kb_chunks.sql`) calls `CREATE EXTENSION IF NOT EXISTS vector`. On Supabase, this works on `pg_extensions = enabled` tiers. Verify before opening 3a so the migration doesn't fail at apply-time.

**Action:**

```bash
psql "$STAGING_DB_URL" -c "SELECT extname FROM pg_extension WHERE extname='vector'"
```

**Acceptance:** Returns 1 row. If 0 rows:

- Verify the Supabase project tier allows extensions (Pro tier+ does by default).
- If allowed but not yet installed, Phase 3a's migration will install it on apply — no manual step needed, but the migration must run with `superuser` privileges via the Supabase CLI / dashboard's "Run SQL" surface.

---

### 3. Confirm OpenAI API key in edge-fn secrets

Phase 3b–3d workers call OpenAI's `text-embedding-3-large` endpoint. The key lives in Supabase Edge Functions secrets (NOT in `.env.local`, NOT in the browser bundle).

**Action:**

```bash
supabase secrets list --project-ref <staging-ref> | grep OPENAI_API_KEY
```

**Acceptance:** `OPENAI_API_KEY=…` row exists. If not:

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-... --project-ref <staging-ref>
```

Use a project-scoped key with a $20 monthly budget cap as the Lap 4 safety rail (the cost telemetry in 3e will assert ≤ $2/project/month projected; the budget cap is the hard backstop).

---

### 4. Soft-pilot fixture project has uploaded artifacts

Phase 3b–3d ingestion workers need real source artifacts to test against. The soft-pilot org (Brad/Nexus) should have at least:

- 1 drawing PDF (any sheet count)
- 1 spec section PDF (any CSI section)
- 2 RFIs (open or closed)
- 1 daily log
- 1 photo with file attached

These become the first ingest targets. Phase 3b–3d's tests use fixture files in the repo (`tests/fixtures/code-kb/clauses.json` plus new fixtures we'll add); the staging project is the end-to-end smoke target.

**Action:** Walker logs into staging as a Nexus admin, uploads the 6 artifacts above to a Nexus-class project (Avery Oaks if available, otherwise a fresh project), confirms each renders in the existing UI before ingestion is wired.

**Acceptance:**

```sql
SELECT
  (SELECT COUNT(*) FROM documents WHERE project_id = '<avery-oaks-id>' AND mime LIKE 'application/pdf%') AS drawings_and_specs,
  (SELECT COUNT(*) FROM rfis WHERE project_id = '<avery-oaks-id>') AS rfis,
  (SELECT COUNT(*) FROM daily_logs WHERE project_id = '<avery-oaks-id>') AS daily_logs,
  (SELECT COUNT(*) FROM media_assets WHERE project_id = '<avery-oaks-id>') AS photos;
```

All four counts ≥ 1.

---

## Order of operations

These can run in any order, but I recommend:

1. (Item 1) `db-types:write` regen first — small clean PR, lowest risk.
2. (Item 2) pgvector check — pure read.
3. (Item 3) OpenAI key — set-once.
4. (Item 4) Soft-pilot fixture uploads — manual UI work, batch into a single afternoon.

Total Walker time estimate: 60–90 minutes.

---

## When this list is complete

Sign and date the bottom of this file:

```
- [ ] Item 1 — db-types regen — done <date>
- [ ] Item 2 — pgvector verified — done <date>
- [ ] Item 3 — OPENAI_API_KEY set — done <date>
- [ ] Item 4 — soft-pilot fixtures uploaded — done <date>

Lap 4 Day-0 complete. PR 3a ready to open. — Walker
```

The signed receipt lives at the bottom of this file and stays in the repo as proof-of-pre-flight.

---

## Open items for Lap 4 first-week cleanup

These are not Day-0 blockers but should land within Phase 3a's PR:

- **Drop the `supabase.rpc as unknown` cast in `usePersona.ts`** once `database.ts` knows about `resolve_persona`.
- **Migrate Phase 1d's `--no-verify` commit lineage forward** — the App.tsx warning baseline that forced `--no-verify` on PRs #421/#422/#423/#424/#425/#426/#427/#428/#429 is still present. Lap 4 should NOT use `--no-verify`. If App.tsx warnings still trip lint-staged, fix the underlying warnings in a small PR before opening 3a.

---

## Sign-off

| Item | Status | Date |
|------|--------|------|
| 1. db-types regen | ✅ done — 9 migrations pushed (incl. 2 drift-heal renames + 1 orphan capture + 4 SQL bug fixes) — `database.ts` +662 lines | 2026-05-11 |
| 2. pgvector check | ✅ done — `vector 0.8.0`, `pg_trgm 1.6`, `pgcrypto 1.3`, `pg_cron 1.6.4` all available | 2026-05-11 |
| 3. OPENAI_API_KEY | ✅ done — already set in edge-fn secrets | 2026-05-11 |
| 4. Soft-pilot fixtures | 🚫 skipped per Walker — not gating Lap 4 PR 3a | 2026-05-11 |

**Lap 4 Day-0 complete.** PR 3a unblocked.

### What landed in the drift-fix PR

- 2 file renames (`iris_telemetry` away from the May-9 timestamp collision; `rfi_information_density` to the dashboard-applied timestamp).
- 1 new local file (`20260507200810_submittal_emails_drift_heal.sql`) capturing the second orphan that was dashboard-applied during the May 7 RFI push.
- 4 SQL bug fixes in Lap-3 migrations: `||` comment concat → single string; `PRIMARY KEY (col, COALESCE(...))` → generated column + plain PK across 3 migrations; `audit_log_id BIGINT` → `UUID` on `executor_runs`.
- `database.ts` regenerated against staging — 24 new symbol hits (resolve_persona + 5 tables + auto_execute_opt_in trio).
- `usePersona` cleanup: removed the `supabase.rpc as unknown as ...` cast now that the typed RPC is in `database.ts`.

### Schema verified on staging

- 5 new tables: `iris_telemetry`, `iris_personas`, `iris_user_personas`, `role_to_default_persona`, `executor_runs`
- 1 RPC: `resolve_persona(p_user_id UUID, p_project_id UUID) RETURNS TEXT`
- 3 new columns on `organizations`: `auto_execute_opt_in`, `auto_execute_opted_in_at`, `auto_execute_opted_in_by`
- 5 personas seeded: `pm`, `superintendent`, `foreman`, `owner_rep`, `office`
