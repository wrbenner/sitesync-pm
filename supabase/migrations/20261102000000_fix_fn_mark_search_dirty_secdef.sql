-- =============================================================================
-- fn_mark_search_dirty: add SECURITY DEFINER + lock down owner/search_path
-- =============================================================================
-- P0 production bug: every authenticated INSERT/UPDATE/DELETE on rfis,
-- submittals, change_orders, punch_items, meetings, daily_logs, drawings
-- aborts with `42501 new row violates row-level security policy for table
-- "search_index_dirty_flags"`. The seven tables' triggers all call
-- public.fn_mark_search_dirty(), which writes a bookkeeping row into
-- search_index_dirty_flags. That table is service_role-only by policy
-- (see 20260507000002_submittals_log_mv_and_rpcs.sql Section 1).
--
-- Source-of-truth migration (20260503110003_search_index_dirty_flags.sql)
-- declares fn_mark_search_dirty without SECURITY DEFINER. The receipt at
-- docs/audits/IRIS_TRIGGER_FIX_RECEIPT_2026-05-14.md retracted an earlier
-- SECDEF patch after a `prosecdef=true` verification on staging — but the
-- source SQL was never updated to match, so any prod that re-applies the
-- source migration (or any database reset) loses the SECDEF flag and the
-- bug returns.
--
-- This migration is the missing follow-up: declare the function SECDEF in
-- the source-of-truth so the flag survives re-applies, and re-set the
-- owner to postgres (which has BYPASSRLS in Supabase) so the elevated
-- privilege actually lets the trigger insert past the table's restrictive
-- policy.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_mark_search_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_type text := TG_ARGV[0];
  v_org_id uuid;
BEGIN
  SELECT pr.organization_id INTO v_org_id
    FROM public.projects pr
   WHERE pr.id = COALESCE(
       (CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW)->>'project_id' END),
       (CASE WHEN TG_OP = 'DELETE'              THEN to_jsonb(OLD)->>'project_id' END)
     )::uuid;

  INSERT INTO public.search_index_dirty_flags
    (entity_type, entity_id, project_id, organization_id, dirty, marked_at)
  VALUES (
    v_entity_type,
    COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid),
    COALESCE((to_jsonb(NEW)->>'project_id')::uuid, (to_jsonb(OLD)->>'project_id')::uuid),
    v_org_id,
    true,
    now()
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET dirty        = true,
        marked_at    = now(),
        reindexed_at = NULL;

  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION public.fn_mark_search_dirty() OWNER TO postgres;

COMMENT ON FUNCTION public.fn_mark_search_dirty() IS
  'Marks an entity dirty in search_index_dirty_flags so the reindex worker '
  'will pick it up. Must run as SECURITY DEFINER because the target table '
  'is restricted to service_role; the function owner (postgres) bypasses '
  'RLS so user-driven writes on the seven wired tables (rfis, submittals, '
  'change_orders, punch_items, meetings, daily_logs, drawings) succeed.';
