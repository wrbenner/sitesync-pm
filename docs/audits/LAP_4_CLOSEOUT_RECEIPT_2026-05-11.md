# Lap 4 closeout — apply remaining migrations + regen types + fix workflow bug

Date: 2026-05-11. Branch: lap-4-closeout. Single closeout PR.

## TL;DR

Closes the 3 gaps between "Lap 4 merged" and "Lap 4 live": 4 missing migrations applied to staging, `database.ts` regenerated, retrieve.ts typecast bridge removed, Phase 3 Acceptance workflow `node -e` bug replaced with `npx tsx -e`. Typecheck zero on both project configs; retrieve + cutover tests still green; db-types:check confirms no drift between staging schema and `database.ts`.

## What changed

### Staging migrations applied (4 of 9 Phase 3 migrations)

Pre-state: `npx supabase migration list` showed local-only for `20261008000005`-`_008`. Workers + retrieve() telemetry + 3 new citation kinds + health views were code-merged but not live.

```
$ npx supabase db push
Applying migration 20261008000005_iris_kb_telemetry.sql...
Applying migration 20261008000006_iris_ingest_dispatcher.sql...
NOTICE: iris.dispatcher_url GUC not set; iris-ingest-dispatcher-tick cron not scheduled.
        Set via ALTER DATABASE postgres SET iris.dispatcher_url = '...'; then re-run.
Applying migration 20261008000007_iris_citation_kinds_extension.sql...
Applying migration 20261008000008_iris_kb_health_daily.sql...
Finished supabase db push.
```

Post-state: all 9 Phase 3 migrations have a remote-applied timestamp.

The pg_cron heartbeat in `_006` is not scheduled — the `iris.dispatcher_url` GUC needs to be set after the iris-ingest-dispatcher edge fn deploys. That deployment is part of the first-soft-pilot-upload milestone (out of scope for this closeout per the Lap 4 plan deferrals).

### `database.ts` regenerated

```
$ npm run db-types:write
[db-types:write] Regenerated src/types/database.ts. Commit the change.

$ git diff --stat src/types/database.ts
 src/types/database.ts | 121 ++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 121 insertions(+)
```

5 new symbols:
- `iris_kb_record_retrieve` (Function — 8 args, returns uuid)
- `iris_kb_telemetry` (Table.Row + Insert + Update)
- `iris_kb_retrieval_p95_1h` (View)
- `iris_kb_health_daily` (View)
- `iris_kb_source_coverage_7d` (View)

### Typecast bridge removed in `retrieve.ts`

Removed the `(supabase.rpc as unknown as ...)` cast in `emitTelemetry`. Native typed `supabase.rpc('iris_kb_record_retrieve', { ... })` call now lands. The two field defaults shifted from `?? null` to `?? undefined` (or just identity) to match the generated optional-field signature.

### `phase-3-acceptance.yml` workflow fix

Pre-state: the "Print acceptance thresholds" step ran `node -e "const m=require('./src/services/iris/types/retrieval')"`, which failed with `MODULE_NOT_FOUND` because Node can't `require()` a `.ts` file directly. The job reported failure even though the 12 unit tests passed.

Post-state: replaced with `npx tsx -e "import { PHASE_3_ACCEPTANCE } from './src/services/iris/types/retrieval'; ..."`. `tsx` handles the TypeScript import natively. Smoke-tested locally — prints valid JSON.

## Verification

```bash
$ npx supabase migration list | grep -c "20261008"
9    # all 9 migrations local + remote applied

$ NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.app.json
# exit 0

$ NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.node.json
# exit 0

$ npm run db-types:check
[db-types:check] OK — database.ts matches live schema.

$ npx vitest run src/services/iris/__tests__/retrieve.test.ts src/services/iris/__tests__/code-retrieval-cutover.test.ts
Tests  90 passed (90)

$ grep "supabase.rpc as unknown" src/services/iris/retrieve.ts
# (no matches)

$ npx tsx -e "import { PHASE_3_ACCEPTANCE } from './src/services/iris/types/retrieval'; console.log(JSON.stringify(PHASE_3_ACCEPTANCE, null, 2))"
{
  "recall_at_5_floor": 0.85,
  "precision_at_5_floor": 0.7,
  "latency_p95_ms_ceiling": 800,
  "rls_pass_rate_required": 1,
  "embedding_leakage_pearson_r_ceiling": 0.05,
  "cost_per_project_per_month_ceiling_dollars": 2
}
```

## What this does NOT do (still deferred — by design, not bugs)

- **Real OpenAI embedding call / iris-embed edge fn deployment** — first soft-pilot artifact upload milestone.
- **`iris.dispatcher_url` GUC + pg_cron schedule** — set after iris-ingest-dispatcher edge fn deploys.
- **Real PDF / OCR / vision-LLM caption** — workers stay scaffolds until live corpus.
- **80 additional goldens** — Walker authors during the measurement window.
- **Live RLS SQL parallel assertion** — runs alongside corpus.
- **kb-stub.ts deletion** — 14-day post-cutover window.
- **Phase 2 router invocation of `runCodeRetrievalViaPgvector`** — small follow-up after 7 days green.

## State after this PR

Lap 4 is genuinely closed. Every PR merged + every migration applied + db-types in sync + workflow runs clean. The 7-day measurement window for the Phase 3 acceptance gate can start the moment the first soft-pilot artifact uploads.
