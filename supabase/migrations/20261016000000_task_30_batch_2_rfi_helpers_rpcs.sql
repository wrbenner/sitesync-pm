-- Task #30 Batch 2 — 10 RFI helpers, RPCs, and trigger-invoked fns.
--
-- Classification (per caller-grep on 2026-05-14):
--
-- RLS helpers (called inside policy expressions; authenticated must
-- retain EXECUTE for RLS to evaluate, anon never needed):
--   fn_rfi_project_id, fn_user_is_rfi_assignee, is_pilot_project,
--   is_pilot_user
--
-- Trigger-invoked (called inside INSERT/UPDATE triggers; same as RLS
-- helpers for grants):
--   iris_enqueue_ingest
--
-- RPCs that already have inline membership gates from prior work
-- (just need search_path pin + revoke anon/PUBLIC):
--   restore_rfi, list_deleted_rfis
--
-- RPCs needing inline gate added (modify-in-place per §3):
--   reorder_tasks (bulk task reorder from frontend; gate via tasks'
--                  project_id × project_members)
--
-- Service-role-only RPCs (frontend doesn't call; only edge fns under
-- service_role context):
--   promote_insight_to_draft, withdraw_stale_draft

-- ─────────────────────────────────────────────────────────────────────────
-- 1-5. RLS helpers + trigger-invoked — pin + revoke anon/PUBLIC, no body.
-- ─────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.fn_rfi_project_id(uuid) SET search_path = public;
REVOKE ALL     ON FUNCTION public.fn_rfi_project_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_rfi_project_id(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_rfi_project_id(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.fn_rfi_project_id(uuid) IS
  'Task #30 batch 2: RLS helper. Called inside RLS policy expressions; authenticated retains EXECUTE.';

ALTER FUNCTION public.fn_user_is_rfi_assignee(uuid, uuid) SET search_path = public;
REVOKE ALL     ON FUNCTION public.fn_user_is_rfi_assignee(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_user_is_rfi_assignee(uuid, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_user_is_rfi_assignee(uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.fn_user_is_rfi_assignee(uuid, uuid) IS
  'Task #30 batch 2: RLS helper. Called inside RLS policy expressions.';

ALTER FUNCTION public.is_pilot_project(uuid) SET search_path = public;
REVOKE ALL     ON FUNCTION public.is_pilot_project(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_pilot_project(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_pilot_project(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.is_pilot_project(uuid) IS
  'Task #30 batch 2: RLS helper. Called inside RLS policy expressions.';

ALTER FUNCTION public.is_pilot_user(uuid) SET search_path = public;
REVOKE ALL     ON FUNCTION public.is_pilot_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_pilot_user(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_pilot_user(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.is_pilot_user(uuid) IS
  'Task #30 batch 2: RLS helper. Called inside RLS policy expressions.';

ALTER FUNCTION public.iris_enqueue_ingest(text, text, uuid, uuid, text) SET search_path = public;
REVOKE ALL     ON FUNCTION public.iris_enqueue_ingest(text, text, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.iris_enqueue_ingest(text, text, uuid, uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.iris_enqueue_ingest(text, text, uuid, uuid, text) TO authenticated, service_role;
COMMENT ON FUNCTION public.iris_enqueue_ingest(text, text, uuid, uuid, text) IS
  'Task #30 batch 2: trigger-invoked fire-and-forget pgmq.send. No membership gate — caller is a trigger running as SECURITY DEFINER under authenticated INSERT/UPDATE context; row-level RLS on the originating table already gates write access.';

-- ─────────────────────────────────────────────────────────────────────────
-- 6-7. RPCs with pre-existing membership gates — pin + revoke anon/PUBLIC.
-- ─────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.restore_rfi(uuid) SET search_path = public;
REVOKE ALL     ON FUNCTION public.restore_rfi(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_rfi(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.restore_rfi(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.restore_rfi(uuid) IS
  'Task #30 batch 2: RPC with inline is_project_role(v_project_id, owner/admin/member) gate (pre-existing). Path pinned; anon revoked.';

ALTER FUNCTION public.list_deleted_rfis(uuid) SET search_path = public;
REVOKE ALL     ON FUNCTION public.list_deleted_rfis(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_deleted_rfis(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.list_deleted_rfis(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.list_deleted_rfis(uuid) IS
  'Task #30 batch 2: RPC with inline is_project_member(p_project_id) gate (pre-existing).';

-- ─────────────────────────────────────────────────────────────────────────
-- 8. reorder_tasks — RPC needs inline membership gate (modify-in-place §3).
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reorder_tasks(task_ids uuid[], new_orders integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Task #30 batch 2: added membership guard. Verifies every task_id
-- belongs to a project the caller is a member of. Single EXISTS keeps
-- the predicate to one query plan regardless of task_ids cardinality.
BEGIN
  IF array_length(task_ids, 1) IS NULL OR array_length(task_ids, 1) != array_length(new_orders, 1) THEN
    RAISE EXCEPTION 'task_ids and new_orders must have the same length and be non-empty';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(task_ids) AS tid
     WHERE NOT EXISTS (
       SELECT 1 FROM public.tasks t
        JOIN public.project_members pm ON pm.project_id = t.project_id
       WHERE t.id = tid
         AND pm.user_id = (SELECT auth.uid())
     )
  ) THEN
    RAISE EXCEPTION 'forbidden: caller not a member of all task projects'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.tasks
  SET sort_order = t.new_order, updated_at = now()
  FROM (
    SELECT unnest(task_ids) AS id, unnest(new_orders) AS new_order
  ) AS t
  WHERE tasks.id = t.id;
END;
$$;

REVOKE ALL     ON FUNCTION public.reorder_tasks(uuid[], integer[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reorder_tasks(uuid[], integer[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reorder_tasks(uuid[], integer[]) TO authenticated, service_role;
COMMENT ON FUNCTION public.reorder_tasks(uuid[], integer[]) IS
  'Task #30 batch 2: bulk task reorder gated by project_members for every task_id.';

-- ─────────────────────────────────────────────────────────────────────────
-- 9-10. Service-role-only RPCs — revoke anon AND authenticated.
-- ─────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.promote_insight_to_draft(jsonb, uuid) SET search_path = public;
REVOKE ALL     ON FUNCTION public.promote_insight_to_draft(jsonb, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_insight_to_draft(jsonb, uuid) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.promote_insight_to_draft(jsonb, uuid) TO service_role;
COMMENT ON FUNCTION public.promote_insight_to_draft(jsonb, uuid) IS
  'Task #30 batch 2: service-role-only. Called by scheduled-insights-worker edge fn.';

ALTER FUNCTION public.withdraw_stale_draft(uuid, text) SET search_path = public;
REVOKE ALL     ON FUNCTION public.withdraw_stale_draft(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.withdraw_stale_draft(uuid, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.withdraw_stale_draft(uuid, text) TO service_role;
COMMENT ON FUNCTION public.withdraw_stale_draft(uuid, text) IS
  'Task #30 batch 2: service-role-only. Called by scheduled-insights-worker edge fn.';
