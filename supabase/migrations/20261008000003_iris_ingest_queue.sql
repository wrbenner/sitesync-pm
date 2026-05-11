-- ────────────────────────────────────────────────────────────────────────────
-- iris_ingest_queue — Phase 3a pgmq queue scaffold
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
-- ADR-003 (hybrid cron: pg_cron heartbeat + pgmq queue + edge fn workers)
--
-- Day-0 R14 mitigation: pgmq install requires the schema to exist first,
-- then CREATE EXTENSION. This migration handles both. Future fresh-DB
-- applies are idempotent via IF NOT EXISTS guards.
--
-- The queue itself uses pgmq's name convention: pgmq.create('iris_ingest')
-- produces table pgmq.q_iris_ingest. Workers (Phase 3b-3d) call
-- pgmq.send('iris_ingest', <payload>) and pgmq.read('iris_ingest', ...).
--
-- The pg_cron heartbeat that wakes the dispatcher edge fn is wired in
-- Phase 3b (alongside the dispatcher itself). Phase 3a stops at the queue.
--
-- Rollback: SELECT pgmq.drop_queue('iris_ingest'); DROP EXTENSION pgmq;
-- DROP SCHEMA pgmq;

CREATE SCHEMA IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;

-- Create the queue if it doesn't exist. pgmq.create() raises on re-create;
-- the EXCEPTION handler swallows the duplicate.
DO $$ BEGIN
  PERFORM pgmq.create('iris_ingest');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ── Telemetry view ──────────────────────────────────────────────────────────
-- Read-only depth + age summary. Phase 3e's matview replaces this with
-- persistent per-source counters.

CREATE OR REPLACE VIEW public.iris_ingest_queue_depth AS
SELECT
  COUNT(*) AS total_pending,
  COUNT(*) FILTER (WHERE vt > NOW()) AS in_flight,
  COALESCE(MAX(NOW() - enqueued_at), INTERVAL '0') AS oldest_age
FROM pgmq.q_iris_ingest;

COMMENT ON VIEW public.iris_ingest_queue_depth IS
  'Read-only summary of the ingest queue. Phase 3a placeholder; Phase 3e telemetry matview replaces this with persistent counters.';

GRANT SELECT ON public.iris_ingest_queue_depth TO authenticated;
