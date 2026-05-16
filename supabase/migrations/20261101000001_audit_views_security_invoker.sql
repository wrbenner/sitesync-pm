-- Flip 3 RLS-audit views to SECURITY INVOKER.
--
-- Background: Supabase security advisor flags 8 views as
-- `security_definer_view` ERRORs. Postgres views default to running with
-- the *owner's* (creator's) privileges, which on Supabase is
-- `supabase_admin` — effectively a superuser. When the view reads
-- RLS-protected tables, the calling user's RLS is bypassed.
--
-- Three of the eight flagged views read only from pg_catalog /
-- information_schema (which are universally readable, no RLS) and are
-- safe to flip to `security_invoker = true` with zero behavior change:
--
--   - v_rls_policy_matrix              (pg_policies + pg_class + pg_namespace)
--   - v_rls_table_coverage             (same)
--   - v_writable_restrictive_coverage  (same)
--
-- These are internal RLS-audit views used by scripts/rls-matrix-audit.ts
-- and the nightly drift detector. They're granted to authenticated +
-- service_role; flipping security_invoker means the calling role's own
-- privileges apply, which is fine because pg_catalog reads succeed for
-- both roles.
--
-- NOT INCLUDED in this PR (need owner decisions):
--   - usage_summary           : billing rollup; may need to stay DEFINER
--   - v_active_plans          : billing plans; review needed
--   - v_project_members_kernel: used inside RLS predicates; recursion risk
--   - org_search_index        : federated search across RLS-protected tables
--   - v_applied_migrations    : reads supabase_migrations schema
--
-- Each of those 5 needs a per-view decision: stay DEFINER (and document
-- why), or flip to INVOKER with a follow-up policy that lets the calling
-- role read the underlying tables.
--
-- Safety: ALTER VIEW SET is idempotent and reversible. No data movement.

BEGIN;

ALTER VIEW public.v_rls_policy_matrix             SET (security_invoker = true);
ALTER VIEW public.v_rls_table_coverage            SET (security_invoker = true);
ALTER VIEW public.v_writable_restrictive_coverage SET (security_invoker = true);

COMMIT;
