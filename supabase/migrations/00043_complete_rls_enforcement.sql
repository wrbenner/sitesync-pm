-- Complete RLS Enforcement
-- Fills gaps from 00033: adds DELETE policies for safety tables,
-- and adds full CRUD policies for payment_applications, closeout_items,
-- warranties, and directory_contacts.
-- Uses has_project_permission(project_id, min_role) pattern from 00032.

-- ── Safety Incidents DELETE ─────────────────────────────

DROP POLICY IF EXISTS safety_incidents_delete ON safety_incidents;
CREATE POLICY safety_incidents_delete ON safety_incidents FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ── Safety Inspections DELETE ───────────────────────────

DROP POLICY IF EXISTS safety_inspections_delete ON safety_inspections;
CREATE POLICY safety_inspections_delete ON safety_inspections FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ── Corrective Actions DELETE ───────────────────────────

DROP POLICY IF EXISTS corrective_actions_delete ON corrective_actions;
CREATE POLICY corrective_actions_delete ON corrective_actions FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ── Payment Applications ────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_applications') THEN
    EXECUTE 'DROP POLICY IF EXISTS payment_applications_select ON payment_applications';
    EXECUTE 'CREATE POLICY payment_applications_select ON payment_applications FOR SELECT
      USING (has_project_permission(project_id, ''superintendent''))';

    EXECUTE 'DROP POLICY IF EXISTS payment_applications_insert ON payment_applications';
    EXECUTE 'CREATE POLICY payment_applications_insert ON payment_applications FOR INSERT
      WITH CHECK (has_project_permission(project_id, ''project_manager''))';

    EXECUTE 'DROP POLICY IF EXISTS payment_applications_update ON payment_applications';
    EXECUTE 'CREATE POLICY payment_applications_update ON payment_applications FOR UPDATE
      USING (has_project_permission(project_id, ''project_manager''))';

    EXECUTE 'DROP POLICY IF EXISTS payment_applications_delete ON payment_applications';
    EXECUTE 'CREATE POLICY payment_applications_delete ON payment_applications FOR DELETE
      USING (has_project_permission(project_id, ''admin''))';
  END IF;
END $$;

-- ── Closeout Items ──────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'closeout_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS closeout_items_select ON closeout_items';
    EXECUTE 'CREATE POLICY closeout_items_select ON closeout_items FOR SELECT
      USING (has_project_permission(project_id, ''viewer''))';

    EXECUTE 'DROP POLICY IF EXISTS closeout_items_insert ON closeout_items';
    EXECUTE 'CREATE POLICY closeout_items_insert ON closeout_items FOR INSERT
      WITH CHECK (has_project_permission(project_id, ''superintendent''))';

    EXECUTE 'DROP POLICY IF EXISTS closeout_items_update ON closeout_items';
    EXECUTE 'CREATE POLICY closeout_items_update ON closeout_items FOR UPDATE
      USING (has_project_permission(project_id, ''superintendent''))';

    EXECUTE 'DROP POLICY IF EXISTS closeout_items_delete ON closeout_items';
    EXECUTE 'CREATE POLICY closeout_items_delete ON closeout_items FOR DELETE
      USING (has_project_permission(project_id, ''project_manager''))';
  END IF;
END $$;

-- ── Warranties ──────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'warranties') THEN
    EXECUTE 'DROP POLICY IF EXISTS warranties_select ON warranties';
    EXECUTE 'CREATE POLICY warranties_select ON warranties FOR SELECT
      USING (has_project_permission(project_id, ''viewer''))';

    EXECUTE 'DROP POLICY IF EXISTS warranties_insert ON warranties';
    EXECUTE 'CREATE POLICY warranties_insert ON warranties FOR INSERT
      WITH CHECK (has_project_permission(project_id, ''superintendent''))';

    EXECUTE 'DROP POLICY IF EXISTS warranties_update ON warranties';
    EXECUTE 'CREATE POLICY warranties_update ON warranties FOR UPDATE
      USING (has_project_permission(project_id, ''superintendent''))';

    EXECUTE 'DROP POLICY IF EXISTS warranties_delete ON warranties';
    EXECUTE 'CREATE POLICY warranties_delete ON warranties FOR DELETE
      USING (has_project_permission(project_id, ''project_manager''))';
  END IF;
END $$;

-- ── Directory Contacts ──────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'directory_contacts') THEN
    EXECUTE 'DROP POLICY IF EXISTS directory_contacts_select ON directory_contacts';
    EXECUTE 'CREATE POLICY directory_contacts_select ON directory_contacts FOR SELECT
      USING (has_project_permission(project_id, ''viewer''))';

    EXECUTE 'DROP POLICY IF EXISTS directory_contacts_insert ON directory_contacts';
    EXECUTE 'CREATE POLICY directory_contacts_insert ON directory_contacts FOR INSERT
      WITH CHECK (has_project_permission(project_id, ''project_manager''))';

    EXECUTE 'DROP POLICY IF EXISTS directory_contacts_update ON directory_contacts';
    EXECUTE 'CREATE POLICY directory_contacts_update ON directory_contacts FOR UPDATE
      USING (has_project_permission(project_id, ''project_manager''))';

    EXECUTE 'DROP POLICY IF EXISTS directory_contacts_delete ON directory_contacts';
    EXECUTE 'CREATE POLICY directory_contacts_delete ON directory_contacts FOR DELETE
      USING (has_project_permission(project_id, ''project_manager''))';
  END IF;
END $$;

-- ── Budget Items SELECT restriction ─────────────────────
-- Budget should only be visible to superintendent+ (not viewers/subs)

DROP POLICY IF EXISTS budget_items_select ON budget_items;
CREATE POLICY budget_items_select ON budget_items FOR SELECT
  USING (has_project_permission(project_id, 'superintendent'));
