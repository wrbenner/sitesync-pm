-- Task #30 Batch 3 — 12 submittal workflow / package / event fns.
--
-- All 12 are RPC-callable functions in the submittal management flow.
-- Per Standing Decisions §3 (modify in place, conservative): all have
-- bodies that delegate membership to RLS on the underlying `submittals`
-- and `submittal_packages` tables (project_members-gated). No inline
-- guards added in this batch — the existing RLS is the gate.
--
-- Treatment: pin search_path = public + REVOKE FROM PUBLIC, anon;
-- keep GRANT to authenticated (frontend calls these from
-- submittalService.ts and components) + service_role (edge fns).
--
-- Projected advisor delta:
--   anon_security_definer_function_executable: -12
--   authenticated_security_definer_function_executable: 0
--   function_search_path_mutable: 0 (all already pinned)

DO $$
DECLARE
  fn_signature text;
  signatures text[] := ARRAY[
    'emit_submittal_event(uuid, text, uuid, jsonb)',
    'submittal_advance_status(uuid, text, uuid, text)',
    'submittal_close(uuid, text)',
    'submittal_compute_required_on_site(uuid)',
    'submittal_create_package(uuid, text, text, uuid, text, uuid[])',
    'submittal_create_revision(uuid)',
    'submittal_delete_package(uuid)',
    'submittal_distribute(uuid, uuid[])',
    'submittal_record_disposition(uuid, text, text, text)',
    'submittal_replace_user(uuid, uuid)',
    'submittal_set_package_members(uuid, uuid[])',
    'submittal_update_package(uuid, text, text, uuid, text)'
  ];
BEGIN
  FOREACH fn_signature IN ARRAY signatures LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', fn_signature);
    EXECUTE format('REVOKE ALL     ON FUNCTION public.%s FROM PUBLIC', fn_signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn_signature);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn_signature);
    EXECUTE format($cmt$COMMENT ON FUNCTION public.%s IS 'Task #30 batch 3: submittal workflow RPC. RLS on submittals/submittal_packages gates project-level access; anon revoked.'$cmt$, fn_signature);
  END LOOP;
END;
$$;
