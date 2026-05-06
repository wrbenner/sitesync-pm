-- ═══════════════════════════════════════════════════════════════
-- Migration: fix_rfi_watchers_rls
-- Version:   20260506000001
-- Purpose:   The original `rfi_watchers_insert` policy whitelisted
--            roles ['owner', 'admin', 'member'] only — a leftover
--            from the generic Supabase template. SiteSync's
--            canonical 15-role construction model (see stream.ts)
--            includes `project_manager`, `superintendent`,
--            `foreman`, `project_engineer`, etc. — none of which
--            could subscribe to RFI updates. Every PM hit a 403
--            on the Watch button.
--
--            Rewrite intent:
--              • Anyone with project membership can watch (it's
--                opt-in receive-only — no privilege escalation).
--              • A user can ONLY insert their own watch (prevents
--                "subscribe a coworker against their will").
--              • A user can delete their own watch; project
--                owner/admin can remove anyone (moderation path).
--
--            Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── INSERT ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS rfi_watchers_insert ON rfi_watchers;
CREATE POLICY rfi_watchers_insert ON rfi_watchers FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id))
  );

-- ── DELETE ─────────────────────────────────────────────────────
-- Self-unwatch always allowed; moderation reserved for owner/admin.
DROP POLICY IF EXISTS rfi_watchers_delete ON rfi_watchers;
CREATE POLICY rfi_watchers_delete ON rfi_watchers FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    OR is_project_role(
      (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
      ARRAY['owner', 'admin']
    )
  );

-- SELECT was already correct — uses is_project_member directly. Left untouched.
