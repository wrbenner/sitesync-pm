-- Task #30 Batch 5 — 11 RLS helpers + search_org RPC. All retain
-- authenticated EXECUTE (RLS evaluation needs it). Revoke anon + PUBLIC.

DO $$
DECLARE
  fn_signature text;
  signatures text[] := ARRAY[
    'has_project_permission(uuid, text)',
    'get_user_project_role(uuid)',
    'is_project_member(uuid)',
    'is_project_role(uuid, text[])',
    'is_project_role_compat(uuid, text[])',
    'is_org_admin_or_empty(uuid, uuid)',
    'current_user_org_ids()',
    'get_my_org_ids()',
    'can_user_approve(uuid)',
    'can_user_create(uuid)',
    'search_org(uuid, uuid, text, integer)'
  ];
BEGIN
  FOREACH fn_signature IN ARRAY signatures LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', fn_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn_signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn_signature);
    EXECUTE format($cmt$COMMENT ON FUNCTION public.%s IS 'Task #30 batch 5: RLS helper / permission predicate.'$cmt$, fn_signature);
  END LOOP;
END;
$$;
