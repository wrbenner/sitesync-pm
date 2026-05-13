-- Task #30 Batch 6 — final 19 SD functions.
-- Standard: pin + REVOKE PUBLIC/anon + GRANT authenticated/service_role.
-- Pre-auth: pin + REVOKE PUBLIC + GRANT anon (login flow needs it).

DO $$
DECLARE
  fn_signature text;
  standard_signatures text[] := ARRAY[
    'check_ai_rate_limit(uuid, integer)',
    'check_expiring_certifications()',
    'check_plan_limit(uuid, text)',
    'create_notification(uuid, uuid, text, text, text, text)',
    'increment_webhook_failures(uuid)',
    'iris_call_count_recent(uuid, integer)',
    'iris_kb_record_retrieve(uuid, text, text, integer, boolean, integer, text, text)',
    'kb_retrieve(vector, text, uuid, text, integer, real, real, real, real)',
    'record_citation_interaction(uuid, integer, text, text, uuid)',
    'record_draft_decision(uuid, text, boolean)',
    'record_draft_view(uuid, uuid)',
    'record_event(uuid, text, jsonb)',
    'resolve_citation(text, uuid, jsonb)',
    'resolve_persona(uuid, uuid)',
    'search_org(uuid, uuid, text, integer)',
    'seed_iris_suggested_submittal_views(uuid)',
    'should_send_notification(uuid, text, text)'
  ];
  preauth_signatures text[] := ARRAY[
    'check_login_lockout(text)',
    'record_failed_login(text, text, text)'
  ];
BEGIN
  FOREACH fn_signature IN ARRAY standard_signatures LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', fn_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn_signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn_signature);
    EXECUTE format($cmt$COMMENT ON FUNCTION public.%s IS 'Task #30 batch 6: standard hardening.'$cmt$, fn_signature);
  END LOOP;

  FOREACH fn_signature IN ARRAY preauth_signatures LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', fn_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn_signature);
    EXECUTE format($cmt$COMMENT ON FUNCTION public.%s IS 'Task #30 batch 6: PRE-AUTH; anon EXECUTE retained.'$cmt$, fn_signature);
  END LOOP;
END;
$$;
