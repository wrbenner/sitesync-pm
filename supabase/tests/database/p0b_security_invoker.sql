-- BRT sub-0 Day 1 — P0-B verification: SECURITY INVOKER on 6 views
--
-- Asserts that each of the 6 views flagged by the Stage-1 audit has the
-- `security_invoker = true` reloption set. This is the simplest pgTAP
-- check that the Day 1 migration took effect — `pg_class.reloptions`
-- contains the array element directly.

BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(6);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'iris_ingest_queue_depth'
      AND c.relkind = 'v'
      AND c.reloptions @> ARRAY['security_invoker=true']
  ),
  'iris_ingest_queue_depth runs as security_invoker'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'iris_kb_health_daily'
      AND c.relkind = 'v'
      AND c.reloptions @> ARRAY['security_invoker=true']
  ),
  'iris_kb_health_daily runs as security_invoker'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'iris_kb_retrieval_p95_1h'
      AND c.relkind = 'v'
      AND c.reloptions @> ARRAY['security_invoker=true']
  ),
  'iris_kb_retrieval_p95_1h runs as security_invoker'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'iris_kb_source_coverage_7d'
      AND c.relkind = 'v'
      AND c.reloptions @> ARRAY['security_invoker=true']
  ),
  'iris_kb_source_coverage_7d runs as security_invoker'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'org_executor_cancel_rate_7d'
      AND c.relkind = 'v'
      AND c.reloptions @> ARRAY['security_invoker=true']
  ),
  'org_executor_cancel_rate_7d runs as security_invoker'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'executor_daily_counts'
      AND c.relkind = 'v'
      AND c.reloptions @> ARRAY['security_invoker=true']
  ),
  'executor_daily_counts runs as security_invoker'
);

SELECT * FROM finish();

ROLLBACK;
