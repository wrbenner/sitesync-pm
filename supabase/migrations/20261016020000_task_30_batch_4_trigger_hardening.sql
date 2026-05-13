-- Task #30 Batch 4 — 18 trigger-only SECURITY DEFINER functions.
-- Verified zero RPC callers; triggers run as definer regardless of
-- the calling role's grants. anon AND authenticated revoked.

DO $$
DECLARE
  fn_signature text;
  signatures text[] := ARRAY[
    'auto_add_rfi_watchers()',
    'fn_audit_trigger()',
    'fn_rfi_recompute_ball_in_court()',
    'fn_rfi_responses_capture_version()',
    'handle_new_user()',
    'log_activity_on_punch_resolved()',
    'log_activity_on_rfi()',
    'log_activity_on_safety_observation()',
    'log_activity_on_toolbox_talk()',
    'notify_daily_log_submitted()',
    'notify_incident_reported()',
    'notify_inspection_corrective_action()',
    'notify_punch_item_assigned()',
    'notify_rfi_assigned()',
    'notify_safety_inspection_result()',
    'notify_submittal_review()',
    'notify_task_assigned()',
    'trg_refresh_submittals_log_mv()'
  ];
BEGIN
  FOREACH fn_signature IN ARRAY signatures LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', fn_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn_signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated', fn_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn_signature);
    EXECUTE format($cmt$COMMENT ON FUNCTION public.%s IS 'Task #30 batch 4: trigger-only.'$cmt$, fn_signature);
  END LOOP;
END;
$$;
