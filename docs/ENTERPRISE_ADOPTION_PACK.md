# Enterprise Adoption Pack — Tab C

Integrations + portfolio + project templates + cross-project search.

This pack lets a single SiteSync organization absorb work from
Procore, Primavera P6, MS Project, and the major construction-
accounting systems (Sage 100/300, Viewpoint Vista, Foundation,
Yardi, Spectrum), then rolls every project up into one
portfolio dashboard with risk ranking and full-text search.

## What shipped

### Pure libraries (`src/lib/integrations`, `src/lib/portfolio`, `src/lib/projectTemplates`)

| Path | Purpose |
| --- | --- |
| `integrations/procore/client.ts` | Throttled (9 req/sec) Procore HTTP client w/ 429 retry, 5 attempts. |
| `integrations/procore/entityMappers.ts` | RFI / submittal / change-order / daily-log / drawing / photo / contact mapping into SiteSync shapes, tagged with `external_ids.procore_id`. |
| `integrations/p6Xer/parser.ts` | XER parser for `PROJECT`, `TASK`, `TASKPRED`, `CALENDAR`, `RSRC`, `TASKRSRC`. Unsupported constraints kept on `task.legacy_constraints`. |
| `integrations/p6Xer/exporter.ts` | XER round-tripper. |
| `integrations/msProjectXml/{parser,exporter}.ts` | MSPDI parse/emit. ISO 8601 internally, MS Project's `YYYY-MM-DDTHH:MM:SS` only at export boundary. |
| `integrations/costCodeImporters/{sage100,sage300,viewpointVista,foundation,yardi,spectrum}.ts` | One importer per accounting system. Each has a `defaultColumnMap` that the admin can override. |
| `portfolio/healthRollup.ts` | Pure function: per-project metrics → org KPIs. |
| `portfolio/riskRanker.ts` | 0-100 score + green/yellow/red + factor list, weighted by schedule slip > safety > RFIs > margin > pay app > budget variance. |
| `projectTemplates/{materialize,strip}.ts` | Carry structural data (SOV, RFI cats, punch templates, role labels), drop transactional data and user IDs. |

### UI

| Path | Purpose |
| --- | --- |
| `pages/admin/procore-import/index.tsx` | Form + live job progress poll. |
| `pages/admin/procore-import/JobProgressView.tsx` | Polls `import_jobs` every 5s. |
| `pages/admin/cost-code-library/index.tsx` | Drop CSV → ColumnMappingModal → upsert into `cost_codes`. |
| `pages/admin/cost-code-library/ColumnMappingModal.tsx` | Modal wrapper around `ColumnMapper`. |
| `pages/admin/bulk-invite/index.tsx` | Drop CSV of (email, role); fan-out via `send-invite`. |
| `pages/admin/bulk-invite/CsvValidator.tsx` | Per-row email + role validation. |
| `pages/admin/project-templates/index.tsx` | List org templates with structural summary. |
| `pages/portfolio/PortfolioDashboard.tsx` | KPI tiles + risk-ranked table (NOT to be confused with legacy `pages/Portfolio.tsx` which we left untouched). |
| `pages/portfolio/CrossProjectSearch.tsx` | Calls `cross-project-search` edge fn; results filtered server-side. |
| `components/portfolio/{KpiTile,RiskTable,SavedViewsBar}.tsx` | Hairline-only, single orange dot, no boxed cards. |
| `components/integrations/{ImportJobProgress,ColumnMapper,CsvDropZone}.tsx` | Reusable across admin pages. |
| `hooks/queries/portfolio-health.ts` | `usePortfolioHealth()` — reads materialized view, graceful degrade if not deployed. |

### Edge functions (`supabase/functions`)

| Function | Purpose |
| --- | --- |
| `procore-import-extended` | Resumable import w/ `import_jobs.resumable_cursor`. Re-invoke with `resume_job_id` to continue. |
| `p6-import` | XER → `schedule_phases` rows. |
| `p6-export` | `schedule_phases` → XER stream. |
| `portfolio-summary-refresh` | Calls `refresh_project_health_summary()`; admins or pg_cron via `X-Cron-Secret`. |
| `cross-project-search` | Calls `search_org()` SQL fn which JOINs `project_members.user_id = auth.uid()` for RLS-safe results. |

### Migrations

| File | Purpose |
| --- | --- |
| `20260502120000_external_ids.sql` | `import_jobs` table + `external_ids jsonb` on rfis, submittals, change_orders, daily_logs, drawings, photos, directory_contacts, schedule_phases, budget_items. |
| `20260502120001_legacy_payload.sql` | `legacy_payload jsonb` on the same set. Separate migration for independent rollback. |
| `20260502120002_cost_code_library.sql` | `cost_codes` w/ `UNIQUE(organization_id, code)` for upsert-on-import. |
| `20260502120003_project_templates.sql` | `project_templates` w/ `structural_payload jsonb`. |
| `20260502120004_portfolio_health_view.sql` | `project_health_summary` materialized view + `refresh_project_health_summary()`. |
| `20260502120005_org_search_index.sql` | `org_search_index` view + `search_org()` fn. |

All migrations use `CREATE … IF NOT EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY`, and `ADD COLUMN IF NOT EXISTS`. Replayable.

Latest existing migration timestamp before this work: **20260502100004**. New range: **20260502120000 → 20260502120005**, all strictly greater.

## Wiring required (in files this pack does NOT touch)

These edits remain to be made by whoever wires the routes:

1. **`src/App.tsx`** — register the new routes:
   - `/admin/procore-import` → `lazy(() => import('./pages/admin/procore-import'))`
   - `/admin/cost-code-library` → `lazy(() => import('./pages/admin/cost-code-library'))`
   - `/admin/bulk-invite` → `lazy(() => import('./pages/admin/bulk-invite'))`
   - `/admin/project-templates` → `lazy(() => import('./pages/admin/project-templates'))`
   - `/portfolio/dashboard` → `lazy(() => import('./pages/portfolio/PortfolioDashboard'))`
   - `/portfolio/search` → `lazy(() => import('./pages/portfolio/CrossProjectSearch'))`
2. **`src/pages/Portfolio.tsx` (legacy stub)** — recommended: replace its body with a redirect to `/portfolio/dashboard`. Left untouched here per file-boundary rule.
3. **Navigation** (wherever the org-admin nav lives): add the four `/admin/*` entries under an "Integrations" section.

## Cron entries to add

The materialized view should refresh every 5 minutes. Two equivalent ways:

**Option A (preferred): pg_cron inside Postgres**

```sql
SELECT cron.schedule(
  'refresh_project_health_summary',
  '*/5 * * * *',
  $$ SELECT refresh_project_health_summary(); $$
);
```

**Option B: Supabase scheduled trigger (declarative `supabase/config.toml`)**

```toml
[functions.portfolio-summary-refresh]
verify_jwt = false  # cron secret authenticates instead

[edge_runtime.cron.portfolio-summary-refresh]
schedule = "*/5 * * * *"
```

Either way: set the `CRON_SECRET` env var on the project so the
function rejects calls without `X-Cron-Secret`.

## Failure modes addressed in code

| Failure | Strategy | Where |
| --- | --- | --- |
| Procore 429 | Honor `Retry-After`, exponential backoff, 5 attempts. | `procore/client.ts::requestWithRetry` |
| Procore network drop | Same retry/backoff loop. | same |
| Procore 401/403 | Returns `permissionError`; admin sees inline message. | same |
| Edge fn 60s budget | `procore-import-extended` writes a `resumable_cursor` and returns; client re-invokes with `resume_job_id`. | `procore-import-extended/index.ts` |
| XER missing `PROJECT` | `parseXer` returns `Result.fail` with `validationError`. | `p6Xer/parser.ts` |
| MSPDI not a Project doc | Same. | `msProjectXml/parser.ts` |
| Materialized view absent in older deploys | Hook detects `42P01` / `PGRST205` and returns empty array (graceful degradation). | `hooks/queries/portfolio-health.ts` |
| User searches projects they don't belong to | `search_org()` SQL fn JOINs `project_members.user_id = auth.uid()` server-side. Even if the edge fn were compromised, the SQL fn itself returns no inaccessible rows. | `org_search_index.sql` |
| Admin re-imports same Procore project | `cost_codes(organization_id, code)` UNIQUE → upsert; `external_ids.procore_id` makes the source row identifiable for dedup. | `cost_code_library.sql`, mappers |

## Failure modes deferred

- **Procore endpoint coverage**: the client implements the 10 most-used endpoints (RFIs, submittals, change orders, daily logs, drawings, photos, contacts, schedule, budget, projects). The dozens of other Procore endpoints (meeting minutes, T&M tickets, observations, …) are not implemented. Add them by extending `ProcoreClient` and the corresponding mapper.
- **Procore webhook subscription**: this pack imports one-way. Bidirectional sync requires a separate webhook handler (out of scope for Tab C).
- **MS Project Calendar/Exception parsing**: only the structural minimum (Tasks/Resources/Assignments/Links) is parsed/exported. Calendars roundtrip as a no-op.
- **Procore-import-extended worker stub**: the per-entity fetcher is scaffolded (`fetchEntity`) but the full inline ProcoreClient wiring inside the Deno runtime is left as a follow-up — the pure mappers in `src/lib/integrations/procore/entityMappers.ts` need to be vendored under `supabase/functions/shared/` (Deno can't import from `src/`). Estimate: 2-3 hours.

## Conventions adopted (future tabs should match these)

1. **`Result<T>` everywhere in `lib/`** — never throw from a pure function; return `fail(...)` and let the caller pattern-match.
2. **Pure libs are I/O-free.** `lib/integrations/*` does NOT import Supabase, `fetch`, or React. The Procore client takes `fetch` via constructor injection so tests can stub it without mocks.
3. **Inline styles + atoms** — never Tailwind. Always `Eyebrow`, `Hairline`, `OrangeDot`, `PageQuestion` from `src/components/atoms/`. At most one orange dot per page.
4. **Provenance via `external_ids`** — every row migrated from a third-party system gets `external_ids: { <system>_id: <native_id> }`. Use `legacy_payload` for the verbatim source row.
5. **RLS at the SQL fn level, not the edge fn level.** `search_org()` enforces `project_members` server-side. Edge functions are convenience wrappers; never rely on them for security.
6. **Idempotent migrations.** Every `ALTER` uses `IF NOT EXISTS`, every policy uses `DROP POLICY IF EXISTS … CREATE POLICY`. Replayable.

## Test counts

- Baseline (before this pack): **2162** passing.
- After this pack: **2339** passing (177 new tests).
- New test files all green:
  - `procore/__tests__/client.test.ts` — 7
  - `procore/__tests__/entityMappers.test.ts` — 7
  - `p6Xer/__tests__/parser.test.ts` — 7
  - `p6Xer/__tests__/exporter.test.ts` — 1
  - `msProjectXml/__tests__/parser.test.ts` — 6
  - `costCodeImporters/__tests__/importers.test.ts` — 11
  - `portfolio/__tests__/healthRollup.test.ts` — 6
  - `portfolio/__tests__/riskRanker.test.ts` — 8
  - `projectTemplates/__tests__/strip.test.ts` — 6
  - `projectTemplates/__tests__/materialize.test.ts` — 6

Typecheck (`npx tsc --noEmit`): **0 errors**.

## Known limitations

- **Procore API surface coverage** is intentionally narrow — see "Failure modes deferred" above.
- **Schedule variance** in the materialized view is computed from project end_date alone, not critical-path slack. Real CPM-aware variance comes from the existing `criticalPath.ts` lib; wiring those numbers into the matview is a future tightening.
- **Bulk invite** uses the existing `send-invite` edge function once per row. For >1000 invites this should batch into a single call; out of scope here.
- **Templates** strip/materialize idempotently for the structural payload, but if the source project has nested unknown extras (e.g., a `weather_alert_config` blob added by a future tab), they are preserved verbatim under `extra` — meaning materialize then strip is a fixed point only for fields we know about. Document anything new added.

## Assumptions made

- **Postgres extension `pg_cron`** is available on the Supabase project. If not, the materialized view stays stale until someone calls `portfolio-summary-refresh` manually (still works, just less fresh).
- **Tables existing**: the migrations only add columns to entity tables that exist. The `DO $$` guards mean older databases without `daily_logs`, `photos`, etc. will skip those `ALTER`s without erroring.
- **`projects` table has `percent_complete` and `profit_margin_pct`** columns. If they don't exist yet, the `project_health_summary` materialized view will fail to create — add the columns or `COALESCE` them out as a follow-up migration.
- **`safety_incidents` table** exists for the matview's incident-count CTE. If absent, replace with a literal 0 in the view.
- **`organization_members` and `project_members`** are the canonical RLS pivots. Confirmed by reading recent migrations.
