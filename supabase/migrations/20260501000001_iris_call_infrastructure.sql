-- =============================================================================
-- iris-call infrastructure: idempotency cache + rate-limit helper
-- =============================================================================
--
-- Backing tables for the canonical AI call path. Every browser-originated AI
-- request now flows through `supabase/functions/iris-call/index.ts`. That
-- function needs:
--
--   1. Idempotency — a user clicking Send twice (or a network retry) must
--      not double-charge the LLM provider or write two audit rows. We cache
--      the response keyed by an SHA-256 of the request inputs, scoped to
--      the user, with a 24h TTL.
--
--   2. Rate limiting — a sliding-window count of recent successful calls
--      per user. Implemented as a SQL function over `audit_log` so we don't
--      need a separate counter table; the audit insert is the source of
--      truth for "did this call happen."
--
-- Audit chain integration: iris-call writes one row to `audit_log` per
-- successful generation with action='iris_call.generate'. The existing
-- audit_log_hash_chain trigger SHA-256s it into the same chain that protects
-- RFI / Submittal / CO history. No constraint changes needed — the
-- `entity.verb` regex in audit_log_action_check already permits this value.
-- =============================================================================

-- ── Idempotency cache ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS iris_call_idempotency (
  idempotency_key text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_hash    text NOT NULL,
  response        jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iris_call_idempotency_user_created
  ON iris_call_idempotency (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iris_call_idempotency_created_for_gc
  ON iris_call_idempotency (created_at);

ALTER TABLE iris_call_idempotency ENABLE ROW LEVEL SECURITY;

-- No CREATE POLICY = no rows accessible to anon/authenticated. Only the
-- service role used by the edge function can read/write. This is intentional:
-- the cache is an internal optimisation, never directly exposed to clients.

COMMENT ON TABLE iris_call_idempotency IS
  'Idempotency cache for iris-call edge function. Application enforces 24h TTL. Service role only — RLS denies all client access. GC: rows older than 24h are safe to delete; cron-based cleanup may be added if cardinality becomes a concern.';

-- ── Rate-limit helper ────────────────────────────────────────────────────────

-- Counts successful iris-call invocations for a user within the last N seconds.
-- Reads from audit_log so it's automatically consistent with the audit chain
-- (rate-limited or failed calls don't show up here, which is the desired
-- behaviour — failed retries shouldn't count against the user's quota).

CREATE OR REPLACE FUNCTION iris_call_count_recent(
  p_user_id uuid,
  p_window_seconds int
) RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
    FROM audit_log
   WHERE user_id = p_user_id
     AND action = 'iris_call.generate'
     AND created_at > now() - make_interval(secs => p_window_seconds);
$$;

REVOKE ALL ON FUNCTION iris_call_count_recent(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iris_call_count_recent(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION iris_call_count_recent(uuid, int) TO authenticated;

COMMENT ON FUNCTION iris_call_count_recent(uuid, int) IS
  'Sliding-window count of successful iris-call generations for a user. Used by iris-call/index.ts for per-user rate limiting. Source-of-truth is audit_log so this stays consistent with the deposition chain.';
