-- BRT sub-1 §4.2 — remediate 7 of the 19 unprotected-org-table findings
-- from RLS_POLICY_MATRIX_2026-05-14.md. The remaining 12 are documented
-- exemptions (service-role-only paths) — see COMMENT ON TABLE entries below.
--
-- Before: 19 tables flagged by find_unprotected_tables()
-- After:  13 (12 exempt + cancellation_reasons append-only)

DROP POLICY IF EXISTS cancellation_reasons_org_insert ON cancellation_reasons;
CREATE POLICY cancellation_reasons_org_insert ON cancellation_reasons FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS collab_doc_state_org_select ON collab_doc_state;
CREATE POLICY collab_doc_state_org_select ON collab_doc_state FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS org_api_tokens_admin_select ON org_api_tokens;
CREATE POLICY org_api_tokens_admin_select ON org_api_tokens FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
     WHERE user_id = (SELECT auth.uid()) AND role IN ('owner','admin')
  ));

DROP POLICY IF EXISTS org_sso_config_admin_select ON org_sso_config;
CREATE POLICY org_sso_config_admin_select ON org_sso_config FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
     WHERE user_id = (SELECT auth.uid()) AND role IN ('owner','admin')
  ));

DROP POLICY IF EXISTS organization_members_owner_update ON organization_members;
CREATE POLICY organization_members_owner_update ON organization_members FOR UPDATE
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
     WHERE user_id = (SELECT auth.uid()) AND role = 'owner'
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members
     WHERE user_id = (SELECT auth.uid()) AND role = 'owner'
  ));

DROP POLICY IF EXISTS outbound_webhooks_admin_select ON outbound_webhooks;
CREATE POLICY outbound_webhooks_admin_select ON outbound_webhooks FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
     WHERE user_id = (SELECT auth.uid()) AND role IN ('owner','admin')
  ));

DROP POLICY IF EXISTS webhook_endpoints_admin_select ON webhook_endpoints;
CREATE POLICY webhook_endpoints_admin_select ON webhook_endpoints FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
     WHERE user_id = (SELECT auth.uid()) AND role IN ('owner','admin')
  ));

-- Documented exemptions — these 12 tables intentionally lack one or more
-- CRUD policies because writes are exclusively service_role.

COMMENT ON TABLE billing_customers IS
  'BRT sub-1 §4.2 exemption: INSERT/UPDATE/DELETE service-role-only (Stripe webhook).';
COMMENT ON TABLE dunning_email_log IS
  'BRT sub-1 §4.2 exemption: INSERT/UPDATE/DELETE service-role-only (cron).';
COMMENT ON TABLE invite_logs IS
  'BRT sub-1 §4.2 exemption: DELETE intentionally absent (append-only audit).';
COMMENT ON TABLE invoices IS
  'BRT sub-1 §4.2 exemption: INSERT/UPDATE/DELETE service-role-only (Stripe webhook).';
COMMENT ON TABLE payment_methods IS
  'BRT sub-1 §4.2 exemption: INSERT/UPDATE/DELETE service-role-only (Stripe webhook).';
COMMENT ON TABLE presence_heartbeats IS
  'BRT sub-1 §4.2 exemption: ephemeral; all CRUD service-role-only.';
COMMENT ON TABLE presence_room_keys IS
  'BRT sub-1 §4.2 exemption: ephemeral; all CRUD service-role-only.';
COMMENT ON TABLE profiles IS
  'BRT sub-1 §4.2 exemption: DELETE cascades from auth.users delete; never client op.';
COMMENT ON TABLE search_index_dirty_flags IS
  'BRT sub-1 §4.2 exemption: internal flag table; all CRUD service-role-only.';
COMMENT ON TABLE slack_delivery_log IS
  'BRT sub-1 §4.2 exemption: append-only log; UPDATE/DELETE service-role-only.';
COMMENT ON TABLE subscriptions IS
  'BRT sub-1 §4.2 exemption: INSERT/DELETE service-role-only (Stripe webhook).';
COMMENT ON TABLE usage_events IS
  'BRT sub-1 §4.2 exemption: append-only telemetry; UPDATE/DELETE service-role-only.';
COMMENT ON TABLE cancellation_reasons IS
  'BRT sub-1 §4.2 exemption: UPDATE/DELETE intentionally absent (append-only by design).';
