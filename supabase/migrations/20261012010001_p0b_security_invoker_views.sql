-- BRT sub-0 Day 1 — P0-B: convert 6 SECURITY DEFINER views to SECURITY INVOKER
--
-- The Stage 1 audit flagged 6 views in `public` schema whose queries run
-- as the view owner (postgres) regardless of caller, so RLS on the
-- underlying tables is bypassed. Postgres 15+ supports a view-level
-- `security_invoker = true` reloption that flips this: queries run as the
-- caller, and RLS on underlying tables applies normally.
--
-- Verified during Day 0 preflight that all 6 views have `reloptions IS
-- NULL` in live (i.e. no explicit invoker flag — the postgres default,
-- which on Supabase means SECURITY DEFINER semantics). Owners are all
-- `postgres`.
--
-- Per-view risk note (also in Day 1 receipt):
--
--   1. iris_ingest_queue_depth — reads pgmq.q_iris_ingest. That queue
--      has no user-facing RLS. Under INVOKER, regular users will see 0
--      rows. If a user-token dashboard polls this, dashboard goes blank.
--      Mitigation if observed: route the dashboard through a SECURITY
--      DEFINER *function* that checks for an admin role.
--
--   2. iris_kb_health_daily / iris_kb_retrieval_p95_1h /
--      iris_kb_source_coverage_7d — read iris_kb_telemetry / iris_kb_chunks.
--      Those tables have org-scoped RLS, so users see only their own
--      org's data after the switch. Org-wide and global aggregates
--      collapse to user-scope, which is the correct posture.
--
--   3. executor_daily_counts / org_executor_cancel_rate_7d — read
--      executor_runs + organizations. Same shape — users see only orgs
--      they're members of.
--
-- All 6 ALTER statements are idempotent (Postgres accepts re-setting an
-- already-set reloption with no error).

ALTER VIEW public.iris_ingest_queue_depth      SET (security_invoker = true);
ALTER VIEW public.iris_kb_health_daily          SET (security_invoker = true);
ALTER VIEW public.iris_kb_retrieval_p95_1h      SET (security_invoker = true);
ALTER VIEW public.iris_kb_source_coverage_7d    SET (security_invoker = true);
ALTER VIEW public.org_executor_cancel_rate_7d   SET (security_invoker = true);
ALTER VIEW public.executor_daily_counts         SET (security_invoker = true);

COMMENT ON VIEW public.iris_ingest_queue_depth IS
  'BRT sub-0 day-1 P0-B: converted to SECURITY INVOKER. Non-admin '
  'callers see 0 rows. Admin dashboard should route through a guarded '
  'SECURITY DEFINER function if needed.';
