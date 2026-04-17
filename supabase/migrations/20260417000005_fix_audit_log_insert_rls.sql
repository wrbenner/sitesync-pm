-- SEC-H08: audit_log INSERT policy used WITH CHECK (true), letting any
-- authenticated user create entries attributed to arbitrary user_ids.
-- Tighten so callers can only insert rows attributed to themselves.
-- Service-role inserts (triggers, server-side) bypass RLS so system
-- provenance is unaffected.

DROP POLICY IF EXISTS "System writes audit logs" ON audit_log;

CREATE POLICY "Users write own audit logs" ON audit_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
