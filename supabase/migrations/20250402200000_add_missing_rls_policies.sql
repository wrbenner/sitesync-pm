-- Migration: Add missing RLS policies for all project-scoped tables
-- Ensures every table referencing project_id enforces row-level security
-- based on project_members membership. Idempotent via DO $$ blocks.

DO $$
DECLARE
  _tables TEXT[] := ARRAY[
    'weather_records',
    'equipment',
    'equipment_logs',
    'equipment_maintenance',
    'incidents',
    'safety_observations',
    'safety_inspections',
    'toolbox_talks',
    'toolbox_talk_attendees',
    'corrective_actions',
    'time_entries',
    'deliveries',
    'delivery_items',
    'material_inventory',
    'warranties',
    'warranty_claims',
    'commissioning_items',
    'sustainability_metrics',
    'waste_logs',
    'photo_pins',
    'photo_comparisons',
    'progress_detection_results'
  ];
  _t TEXT;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    -- Enable RLS (safe to call even if already enabled)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', _t);
  END LOOP;
END $$;

-- weather_records
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON weather_records
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON weather_records
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON weather_records
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON weather_records
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- equipment
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON equipment
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON equipment
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON equipment
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON equipment
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- equipment_logs
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON equipment_logs
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON equipment_logs
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON equipment_logs
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON equipment_logs
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- equipment_maintenance
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON equipment_maintenance
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON equipment_maintenance
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON equipment_maintenance
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON equipment_maintenance
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- incidents
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON incidents
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON incidents
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON incidents
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON incidents
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- safety_observations
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON safety_observations
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON safety_observations
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON safety_observations
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON safety_observations
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- safety_inspections
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON safety_inspections
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON safety_inspections
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON safety_inspections
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON safety_inspections
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- toolbox_talks
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON toolbox_talks
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON toolbox_talks
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON toolbox_talks
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON toolbox_talks
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- toolbox_talk_attendees (joins to toolbox_talks which has project_id)
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON toolbox_talk_attendees
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON toolbox_talk_attendees
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON toolbox_talk_attendees
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON toolbox_talk_attendees
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- corrective_actions
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON corrective_actions
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON corrective_actions
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON corrective_actions
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON corrective_actions
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- time_entries
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON time_entries
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON time_entries
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON time_entries
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON time_entries
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- deliveries
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON deliveries
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON deliveries
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON deliveries
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON deliveries
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- delivery_items
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON delivery_items
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON delivery_items
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON delivery_items
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON delivery_items
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- material_inventory
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON material_inventory
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON material_inventory
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON material_inventory
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON material_inventory
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- warranties
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON warranties
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON warranties
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON warranties
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON warranties
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- warranty_claims
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON warranty_claims
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON warranty_claims
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON warranty_claims
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON warranty_claims
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- commissioning_items
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON commissioning_items
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON commissioning_items
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON commissioning_items
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON commissioning_items
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- sustainability_metrics
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON sustainability_metrics
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON sustainability_metrics
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON sustainability_metrics
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON sustainability_metrics
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- waste_logs
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON waste_logs
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON waste_logs
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON waste_logs
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON waste_logs
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- photo_pins
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON photo_pins
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON photo_pins
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON photo_pins
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON photo_pins
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- photo_comparisons
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON photo_comparisons
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON photo_comparisons
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON photo_comparisons
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON photo_comparisons
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- progress_detection_results
DO $$ BEGIN
  CREATE POLICY "Project members can view" ON progress_detection_results
    FOR SELECT USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can insert" ON progress_detection_results
    FOR INSERT WITH CHECK (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can update" ON progress_detection_results
    FOR UPDATE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Managers can delete" ON progress_detection_results
    FOR DELETE USING (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
