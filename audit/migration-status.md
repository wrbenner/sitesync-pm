# Migration Status

> Generated 2026-04-29T19:26:33Z against project `hypxrmcppjfbtlwuoafc` (ss pm).
> Re-run with: `bun scripts/audit-migrations.ts`

| Metric | Count |
| --- | --- |
| Applied (cloud) |      160 |
| In repo |      214 |
| **Missing** (in repo, not applied) | **      54** |
| Manual SQL (applied, not in repo) | 0 |
| Out-of-order timestamps | 0 |

## Missing — in repo but not applied

Every missing migration is from **2026-04-29 onwards** — i.e. the
last few days of session work. These represent the schema shipped this
session that hasn't yet hit production.

- `20260429000001_change_order_metadata.sql`
- `20260429010001_rfi_escalations.sql`
- `20260429010002_crew_attendance.sql`
- `20260429020000_payapp_audit_overrides.sql`
- `20260429020001_coi_check_in_block.sql`
- `20260429093836_media_links.sql`
- `20260429093837_drawing_scopes.sql`
- `20260430120000_inbound_email_threading.sql`
- `20260430130000_daily_log_drafts.sql`
- `20260430140000_co_source_rfi.sql`
- `20260430140001_auto_co_settings.sql`
- `20260430150000_walkthrough_sessions.sql`
- `20260430150001_walkthrough_captures.sql`
- `20260430160000_notification_queue_worker_cron.sql`
- `20260501100000_magic_link_tokens.sql`
- `20260501100001_typing_indicators.sql`
- `20260501110000_site_geofence.sql`
- `20260501110001_daily_log_revisions.sql`
- `20260501110002_check_in_dispute_status.sql`
- `20260501120000_pay_app_reconciliation.sql`
- `20260501120001_lien_waiver_signatures.sql`
- `20260501120002_payapp_owner_previews.sql`
- `20260502100000_org_sso_config.sql`
- `20260502100001_org_custom_roles.sql`
- `20260502100002_per_project_role_overrides.sql`
- `20260502100003_org_api_tokens.sql`
- `20260502100004_outbound_webhooks.sql`
- `20260502100005_org_branding.sql`
- `20260502110000_prevailing_wage_decisions.sql`
- `20260502110001_payment_performance_bonds.sql`
- `20260502110002_state_lien_rules.sql`
- `20260502110003_eeo1_demographics.sql`
- `20260502110004_cost_code_tax_flags.sql`
- `20260502110005_closeout_deliverables.sql`
- `20260502120000_external_ids.sql`
- `20260502120001_legacy_payload.sql`
- `20260502120002_cost_code_library.sql`
- `20260502120003_project_templates.sql`
- `20260502120004_portfolio_health_view.sql`
- `20260502120005_org_search_index.sql`
- `20260502130000_portfolio_summary_refresh_cron.sql`
- `20260503100000_presence_room_keys.sql`
- `20260503100001_collab_doc_state.sql`
- `20260503110000_fts_indexes.sql`
- `20260503110001_query_indexes_audit.sql`
- `20260503110002_materialized_views.sql`
- `20260503110003_search_index_dirty_flags.sql`
- `20260503110004_org_s3_export_config.sql`
- `20260503110005_view_refresh_metadata.sql`
- `20260503120000_workflow_definitions.sql`
- `20260503120001_notification_preferences.sql`
- `20260503120002_iris_suggestion_history.sql`
- `20260503120003_document_gen_templates.sql`
- `20260503120004_ai_extraction_results.sql`

## Apply commands

```bash
# Apply a single migration via the Supabase MCP
# (or directly via psql for self-managed DBs)

# Recommended path: use the Supabase CLI
supabase db push --project-ref hypxrmcppjfbtlwuoafc

# To dry-run (preview without applying)
supabase db push --project-ref hypxrmcppjfbtlwuoafc --dry-run

# To apply a single specific migration via SQL editor / RPC
psql "$DATABASE_URL" -f supabase/migrations/20260429093836_media_links.sql
```

## Hand-edited / drift detection

There are 0 migrations applied on cloud that aren't in the repo —
nobody has hand-edited via the SQL editor, or if they have they also
saved the change as a migration.

To detect *content* drift (a migration applied on cloud whose SHA
differs from the repo's version), the auditor would need to compare
the pg_stat / migration history table's stored SQL to the repo
file. This is a TODO; the Supabase MCP doesn't currently expose
the applied-migration SQL.

## Apply order safety

The Supabase MCP returns the applied list sorted by version. The
missing migrations all have timestamps strictly greater than the
latest applied (`20260428110000`). They can be applied in
filename-order without any risk of stomping on prior migrations.

## Action items

1. **Apply the 54 missing migrations** to bring cloud current with repo.
   Recommended: `supabase db push --project-ref hypxrmcppjfbtlwuoafc`.
2. After applying, **deploy the 47 missing edge functions** (per the
   companion edge-function-status.md). Several of those functions
   reference tables in the new migrations — applying migrations first
   is mandatory.
3. Run `bun scripts/audit-migrations.ts` weekly via the
   `platform-health` GH workflow.
