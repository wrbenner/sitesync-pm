# Search Architecture

Two surfaces:
- **Per-project search** — pre-existing (`search_project()` SQL function). Driven by per-table GIN indexes on `to_tsvector('english', ...)` columns. Lives in 00023.
- **Cross-project search** — new in this stream. Driven by `org_search_index` view + `search_org()` RPC.

## Cross-project search flow

```
User types in Cmd+K
   │
   ▼
parseQuery(raw)  →  strips !&|()<>:* operators, normalizes ws,
                    flags empty / too-short
   │
   ▼
runSearch(parsed.tsqueryInput)  →  Supabase RPC search_org(query, org_id, limit)
   │
   ▼
search_org() (SECURITY INVOKER):
   SELECT … FROM org_search_index s
    WHERE s.organization_id = $org_id
      AND s.search_vector @@ plainto_tsquery('english', $query)
    ORDER BY rank DESC, created_at DESC LIMIT $limit
   │
   │  RLS on the underlying tables (rfis, submittals, ...) filters out
   │  rows the user can't see — never expose row counts for inaccessible
   │  projects.
   ▼
groupByEntity(rows)  →  buckets by entity_type, sorts by rank desc
   │
   ▼
SearchResultRow renders:
   • per-entity icon + project breadcrumb + status pill
   • title + snippet around first highlight match
   • longest-token-first highlighting
```

## What's indexed

| Entity | Source columns | GIN index |
| --- | --- | --- |
| RFI            | title, description                              | `idx_rfis_fts` |
| Submittal      | title, spec_section                              | `idx_submittals_fts` |
| Change Order   | title, description                              | (covered by org_search_index UNION) |
| Punch Item     | title, description, location                    | `idx_punch_items_fts` |
| Meeting        | title, notes                                     | `idx_meetings_fts` |
| Daily Log      | summary, weather                                 | `idx_daily_logs_fts` |
| Drawing        | title, sheet_number, discipline                  | `idx_drawings_fts` |

Per-table GIN indexes were created in `00023_global_search.sql`. The
new `20260503110000_fts_indexes.sql` migration rebuilds the union view +
adds the `search_org()` RPC.

## Why a view, not a materialized table

For the org sizes we currently see (≤ 100 projects, ≤ 100k searchable
entities), the unioned view computes in ~50–80ms across all entities at
query time. That's well below the user-perceptible threshold and avoids
the consistency burden of a materialized table that has to be refreshed
on every entity write.

When org sizes hit ~1M+ entities, we switch to a materialized table:
1. Convert `org_search_index` to a `CREATE MATERIALIZED VIEW`.
2. The dirty-flag triggers (already in place via
   `20260503110003_search_index_dirty_flags.sql`) drive incremental
   rebuilds.
3. Nightly full rebuild as a safety net.

The triggers fire today (per-entity dirty flag rows accumulate), but no
consumer reads them yet. That switch is one migration's worth of work —
no app-side change required.

## Privacy + RLS

- `search_org()` runs `SECURITY INVOKER` so queries inherit the calling
  user's RLS context. No `service_role` shortcuts.
- The view itself doesn't bypass RLS — it `JOIN`s `projects pr` to scope
  by `organization_id`, but the underlying RFI/punch/etc. rows are still
  filtered by `project_members` via their own table-level policies.
- `parseQuery()` strips tsquery operators so user input can't construct
  a query that returns rows outside the user's scope.

## Operational checklist

- [ ] Cron `pg_cron`-schedule `refresh-materialized-views` every 5 min once the rollup views are in production traffic.
- [ ] Add a "Search across projects" entry to the existing CommandPalette (parent integration).
- [ ] Wire `view_freshness_status()` into the per-page banner.
- [ ] Schedule the index audit script weekly: `bun scripts/index-audit.ts > index-audit.md` and PR the file as a discussion artifact.
- [ ] Once incremental search reindex is built, switch `org_search_index` to a materialized table and add `pg_cron` for the dirty-flag drain.
