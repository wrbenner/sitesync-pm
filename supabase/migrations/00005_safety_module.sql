-- =============================================================================
-- SiteSync AI: Safety Module
-- Full safety management: inspections, incidents, toolbox talks, certifications,
-- observations, and all supporting infrastructure.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend notification types to support safety events
-- ---------------------------------------------------------------------------

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'rfi_assigned', 'submittal_review', 'punch_item',
    'task_update', 'meeting_reminder', 'ai_alert',
    'daily_log_approval',
    'safety_inspection_failed', 'safety_corrective_action',
    'incident_reported', 'certification_expiring'
  ));

-- Extend activity feed types
ALTER TABLE activity_feed
  DROP CONSTRAINT IF EXISTS activity_feed_type_check;

ALTER TABLE activity_feed
  ADD CONSTRAINT activity_feed_type_check CHECK (type IN (
    'rfi_created', 'submittal_updated', 'task_moved',
    'file_uploaded', 'daily_log_approved', 'punch_resolved',
    'comment_added', 'change_order_submitted', 'meeting_scheduled',
    'safety_inspection_completed', 'incident_reported',
    'toolbox_talk_conducted', 'safety_observation_logged'
  ));

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- Safety Inspections
CREATE TABLE safety_inspections (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    type              text NOT NULL CHECK (type IN (
                          'daily_site', 'weekly_area', 'equipment', 'scaffold',
                          'excavation', 'electrical', 'fire_protection', 'crane',
                          'confined_space'
                      )),
    inspector_id      uuid REFERENCES auth.users,
    date              date NOT NULL,
    area              text,
    floor             text,
    status            text DEFAULT 'scheduled' CHECK (status IN (
                          'scheduled', 'in_progress', 'passed', 'failed',
                          'corrective_action_required'
                      )),
    score             numeric,
    max_score         numeric,
    weather_conditions text,
    temperature       int,
    signature_url     text,
    signature_date    timestamptz,
    notes             text,
    ai_summary        text,
    created_at        timestamptz DEFAULT now(),
    updated_at        timestamptz DEFAULT now()
);

-- Inspection Items (child of safety_inspections)
CREATE TABLE inspection_items (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id     uuid NOT NULL REFERENCES safety_inspections ON DELETE CASCADE,
    category          text CHECK (category IN (
                          'fall_protection', 'housekeeping', 'ppe', 'electrical',
                          'scaffolding', 'excavation', 'fire_safety', 'signage',
                          'equipment', 'environmental'
                      )),
    question          text NOT NULL,
    response          text CHECK (response IN ('pass', 'fail', 'na', 'corrective_action')),
    severity          text CHECK (severity IN ('minor', 'major', 'critical', 'imminent_danger')),
    photo_url         text,
    corrective_action text,
    responsible_party uuid REFERENCES auth.users,
    due_date          date,
    resolved          boolean DEFAULT false,
    resolved_date     date,
    created_at        timestamptz DEFAULT now()
);

-- Incidents
CREATE TABLE incidents (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id             uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    incident_number        serial,
    type                   text CHECK (type IN (
                               'injury', 'near_miss', 'property_damage', 'environmental',
                               'equipment_failure', 'fire', 'electrical', 'fall'
                           )),
    severity               text CHECK (severity IN (
                               'first_aid', 'medical_treatment', 'lost_time', 'fatality'
                           )),
    date                   timestamptz NOT NULL,
    location               text,
    floor                  text,
    area                   text,
    description            text NOT NULL,
    root_cause             text,
    injured_party_name     text,
    injured_party_company  text,
    injured_party_trade    text,
    witness_names          jsonb DEFAULT '[]',
    immediate_actions      text,
    osha_recordable        boolean DEFAULT false,
    osha_report_number     text,
    investigation_status   text DEFAULT 'open' CHECK (investigation_status IN (
                               'open', 'investigating', 'closed'
                           )),
    corrective_actions     jsonb DEFAULT '[]',
    preventive_actions     jsonb DEFAULT '[]',
    photos                 jsonb DEFAULT '[]',
    documents              jsonb DEFAULT '[]',
    reported_by            uuid REFERENCES auth.users,
    investigated_by        uuid REFERENCES auth.users,
    created_at             timestamptz DEFAULT now(),
    updated_at             timestamptz DEFAULT now()
);

-- Toolbox Talks
CREATE TABLE toolbox_talks (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    title            text NOT NULL,
    topic            text CHECK (topic IN (
                         'fall_protection', 'ppe', 'heat_illness', 'electrical_safety',
                         'excavation', 'scaffolding', 'hazcom', 'housekeeping',
                         'equipment_operation', 'emergency_procedures', 'covid', 'custom'
                     )),
    date             date NOT NULL,
    presenter_id     uuid REFERENCES auth.users,
    content          text,
    duration_minutes int,
    attendance_count int,
    language         text DEFAULT 'en',
    sign_in_sheet_url text,
    created_at       timestamptz DEFAULT now()
);

-- Toolbox Talk Attendees (child of toolbox_talks)
CREATE TABLE toolbox_talk_attendees (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    toolbox_talk_id uuid NOT NULL REFERENCES toolbox_talks ON DELETE CASCADE,
    worker_name     text NOT NULL,
    company         text,
    trade           text,
    signature_url   text,
    signed_at       timestamptz
);

-- Safety Certifications
CREATE TABLE safety_certifications (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    worker_name          text NOT NULL,
    company              text,
    trade                text,
    certification_type   text CHECK (certification_type IN (
                             'osha_10', 'osha_30', 'first_aid_cpr', 'rigging',
                             'crane_operator', 'confined_space', 'fall_protection',
                             'forklift', 'scaffold_competent', 'electrical_qualified',
                             'hazmat', 'excavation_competent'
                         )),
    certification_number text,
    issued_date          date,
    expiration_date      date,
    document_url         text,
    verified             boolean DEFAULT false,
    verified_by          uuid REFERENCES auth.users,
    verified_at          timestamptz,
    created_at           timestamptz DEFAULT now()
);

-- Safety Observations
CREATE TABLE safety_observations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    type              text CHECK (type IN (
                          'safe_behavior', 'at_risk_behavior', 'hazard',
                          'positive_recognition'
                      )),
    category          text,
    description       text NOT NULL,
    location          text,
    photo_url         text,
    observed_by       uuid REFERENCES auth.users,
    date              date,
    action_taken      text,
    follow_up_required boolean DEFAULT false,
    created_at        timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Safety inspections
CREATE INDEX idx_safety_inspections_project_id   ON safety_inspections (project_id);
CREATE INDEX idx_safety_inspections_date         ON safety_inspections (date);
CREATE INDEX idx_safety_inspections_status       ON safety_inspections (status);
CREATE INDEX idx_safety_inspections_type         ON safety_inspections (type);
CREATE INDEX idx_safety_inspections_inspector_id ON safety_inspections (inspector_id);

-- Inspection items
CREATE INDEX idx_inspection_items_inspection_id    ON inspection_items (inspection_id);
CREATE INDEX idx_inspection_items_category         ON inspection_items (category);
CREATE INDEX idx_inspection_items_response         ON inspection_items (response);
CREATE INDEX idx_inspection_items_responsible_party ON inspection_items (responsible_party);
CREATE INDEX idx_inspection_items_resolved         ON inspection_items (resolved) WHERE resolved = false;

-- Incidents
CREATE INDEX idx_incidents_project_id            ON incidents (project_id);
CREATE INDEX idx_incidents_date                  ON incidents (date);
CREATE INDEX idx_incidents_type                  ON incidents (type);
CREATE INDEX idx_incidents_severity              ON incidents (severity);
CREATE INDEX idx_incidents_investigation_status  ON incidents (investigation_status);
CREATE INDEX idx_incidents_osha_recordable       ON incidents (osha_recordable) WHERE osha_recordable = true;
CREATE INDEX idx_incidents_reported_by           ON incidents (reported_by);
CREATE INDEX idx_incidents_investigated_by       ON incidents (investigated_by);

-- Toolbox talks
CREATE INDEX idx_toolbox_talks_project_id   ON toolbox_talks (project_id);
CREATE INDEX idx_toolbox_talks_date         ON toolbox_talks (date);
CREATE INDEX idx_toolbox_talks_topic        ON toolbox_talks (topic);
CREATE INDEX idx_toolbox_talks_presenter_id ON toolbox_talks (presenter_id);

-- Toolbox talk attendees
CREATE INDEX idx_toolbox_talk_attendees_talk_id ON toolbox_talk_attendees (toolbox_talk_id);

-- Safety certifications
CREATE INDEX idx_safety_certifications_project_id       ON safety_certifications (project_id);
CREATE INDEX idx_safety_certifications_type              ON safety_certifications (certification_type);
CREATE INDEX idx_safety_certifications_expiration_date   ON safety_certifications (expiration_date);
CREATE INDEX idx_safety_certifications_worker_name       ON safety_certifications (worker_name);
CREATE INDEX idx_safety_certifications_verified          ON safety_certifications (verified) WHERE verified = false;

-- Safety observations
CREATE INDEX idx_safety_observations_project_id      ON safety_observations (project_id);
CREATE INDEX idx_safety_observations_type             ON safety_observations (type);
CREATE INDEX idx_safety_observations_date             ON safety_observations (date);
CREATE INDEX idx_safety_observations_observed_by      ON safety_observations (observed_by);
CREATE INDEX idx_safety_observations_follow_up        ON safety_observations (follow_up_required) WHERE follow_up_required = true;

-- ---------------------------------------------------------------------------
-- 4. Updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_safety_inspections_updated_at
    BEFORE UPDATE ON safety_inspections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE safety_inspections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE toolbox_talks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE toolbox_talk_attendees  ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_certifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_observations     ENABLE ROW LEVEL SECURITY;

-- Standard project scoped policies for tables with project_id
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'safety_inspections', 'incidents', 'toolbox_talks',
            'safety_certifications', 'safety_observations'
        ])
    LOOP
        -- SELECT: any project member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT USING (is_project_member(project_id))',
            tbl || '_select', tbl
        );

        -- INSERT: owner, admin, or member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY[''owner'', ''admin'', ''member'']))',
            tbl || '_insert', tbl
        );

        -- UPDATE: owner, admin, or member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR UPDATE USING (is_project_role(project_id, ARRAY[''owner'', ''admin'', ''member'']))',
            tbl || '_update', tbl
        );

        -- DELETE: owner or admin only
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR DELETE USING (is_project_role(project_id, ARRAY[''owner'', ''admin'']))',
            tbl || '_delete', tbl
        );
    END LOOP;
END
$$;

-- inspection_items: project_id resolved through parent safety_inspections
CREATE POLICY inspection_items_select ON inspection_items FOR SELECT
    USING (is_project_member(
        (SELECT project_id FROM safety_inspections WHERE safety_inspections.id = inspection_id)
    ));

CREATE POLICY inspection_items_insert ON inspection_items FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM safety_inspections WHERE safety_inspections.id = inspection_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY inspection_items_update ON inspection_items FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM safety_inspections WHERE safety_inspections.id = inspection_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY inspection_items_delete ON inspection_items FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM safety_inspections WHERE safety_inspections.id = inspection_id),
        ARRAY['owner', 'admin']
    ));

-- toolbox_talk_attendees: project_id resolved through parent toolbox_talks
CREATE POLICY toolbox_talk_attendees_select ON toolbox_talk_attendees FOR SELECT
    USING (is_project_member(
        (SELECT project_id FROM toolbox_talks WHERE toolbox_talks.id = toolbox_talk_id)
    ));

CREATE POLICY toolbox_talk_attendees_insert ON toolbox_talk_attendees FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM toolbox_talks WHERE toolbox_talks.id = toolbox_talk_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY toolbox_talk_attendees_update ON toolbox_talk_attendees FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM toolbox_talks WHERE toolbox_talks.id = toolbox_talk_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY toolbox_talk_attendees_delete ON toolbox_talk_attendees FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM toolbox_talks WHERE toolbox_talks.id = toolbox_talk_id),
        ARRAY['owner', 'admin']
    ));

-- ---------------------------------------------------------------------------
-- 6. Notification triggers
-- ---------------------------------------------------------------------------

-- 6a. When an inspection fails or requires corrective action, notify responsible parties
CREATE OR REPLACE FUNCTION notify_safety_inspection_result()
RETURNS TRIGGER AS $$
DECLARE
    v_admin uuid;
BEGIN
    -- When inspection status changes to failed or corrective_action_required
    IF NEW.status IN ('failed', 'corrective_action_required')
       AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status)
    THEN
        -- Notify all project owners and admins
        FOR v_admin IN
            SELECT user_id FROM project_members
            WHERE project_id = NEW.project_id AND role IN ('owner', 'admin')
        LOOP
            PERFORM create_notification(
                v_admin,
                NEW.project_id,
                'safety_inspection_failed',
                'Safety inspection ' || UPPER(REPLACE(NEW.status, '_', ' ')) || ': ' || INITCAP(REPLACE(NEW.type, '_', ' ')),
                COALESCE(NEW.area, '') || COALESCE(' Floor ' || NEW.floor, '') || '. Score: ' || COALESCE(NEW.score::text, 'N/A') || '/' || COALESCE(NEW.max_score::text, 'N/A'),
                '/safety/inspections'
            );
        END LOOP;

        -- Log to activity feed
        INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata)
        VALUES (
            NEW.project_id,
            NEW.inspector_id,
            'safety_inspection_completed',
            'Safety inspection ' || REPLACE(NEW.status, '_', ' ') || ': ' || INITCAP(REPLACE(NEW.type, '_', ' ')),
            COALESCE(NEW.notes, ''),
            jsonb_build_object('inspection_id', NEW.id, 'status', NEW.status, 'score', NEW.score)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_safety_inspection_result
    AFTER INSERT OR UPDATE ON safety_inspections
    FOR EACH ROW EXECUTE FUNCTION notify_safety_inspection_result();

-- 6b. When an inspection item has corrective action assigned, notify responsible party
CREATE OR REPLACE FUNCTION notify_inspection_corrective_action()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.response IN ('fail', 'corrective_action')
       AND NEW.responsible_party IS NOT NULL
       AND (OLD IS NULL OR OLD.responsible_party IS DISTINCT FROM NEW.responsible_party
            OR OLD.response IS DISTINCT FROM NEW.response)
    THEN
        PERFORM create_notification(
            NEW.responsible_party,
            (SELECT project_id FROM safety_inspections WHERE id = NEW.inspection_id),
            'safety_corrective_action',
            'Safety corrective action assigned to you',
            COALESCE(NEW.corrective_action, NEW.question) || CASE WHEN NEW.due_date IS NOT NULL THEN ' (due ' || NEW.due_date || ')' ELSE '' END,
            '/safety/inspections'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_inspection_corrective_action
    AFTER INSERT OR UPDATE ON inspection_items
    FOR EACH ROW EXECUTE FUNCTION notify_inspection_corrective_action();

-- 6c. When an incident is reported, notify all project owners and admins
CREATE OR REPLACE FUNCTION notify_incident_reported()
RETURNS TRIGGER AS $$
DECLARE
    v_admin uuid;
    v_severity_label text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_severity_label := COALESCE(INITCAP(REPLACE(NEW.severity, '_', ' ')), 'Unclassified');

        -- Notify all project owners and admins
        FOR v_admin IN
            SELECT user_id FROM project_members
            WHERE project_id = NEW.project_id AND role IN ('owner', 'admin')
        LOOP
            PERFORM create_notification(
                v_admin,
                NEW.project_id,
                'incident_reported',
                'Incident reported: ' || INITCAP(REPLACE(NEW.type, '_', ' ')) || ' (' || v_severity_label || ')',
                LEFT(NEW.description, 200),
                '/safety/incidents'
            );
        END LOOP;

        -- Log to activity feed
        INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata)
        VALUES (
            NEW.project_id,
            NEW.reported_by,
            'incident_reported',
            'Incident #' || NEW.incident_number || ': ' || INITCAP(REPLACE(NEW.type, '_', ' ')),
            LEFT(NEW.description, 200),
            jsonb_build_object('incident_id', NEW.id, 'type', NEW.type, 'severity', NEW.severity, 'osha_recordable', NEW.osha_recordable)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_incident_reported
    AFTER INSERT ON incidents
    FOR EACH ROW EXECUTE FUNCTION notify_incident_reported();

-- 6d. When a certification is expiring within 30 days, notify project admins
--     This is designed to be called by a scheduled cron job (pg_cron or Supabase edge function).
CREATE OR REPLACE FUNCTION check_expiring_certifications()
RETURNS void AS $$
DECLARE
    v_cert RECORD;
    v_admin uuid;
BEGIN
    FOR v_cert IN
        SELECT sc.id, sc.project_id, sc.worker_name, sc.company,
               sc.certification_type, sc.expiration_date
        FROM safety_certifications sc
        WHERE sc.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          -- Only alert once: check if a notification already exists for this cert in last 7 days
          AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.project_id = sc.project_id
                AND n.type = 'certification_expiring'
                AND n.body LIKE '%' || sc.id::text || '%'
                AND n.created_at > now() - INTERVAL '7 days'
          )
    LOOP
        FOR v_admin IN
            SELECT user_id FROM project_members
            WHERE project_id = v_cert.project_id AND role IN ('owner', 'admin')
        LOOP
            PERFORM create_notification(
                v_admin,
                v_cert.project_id,
                'certification_expiring',
                'Certification expiring: ' || v_cert.worker_name || ' ' || INITCAP(REPLACE(v_cert.certification_type, '_', ' ')),
                'Expires ' || v_cert.expiration_date || '. Worker: ' || v_cert.worker_name || ' (' || COALESCE(v_cert.company, 'Unknown') || '). Cert ID: ' || v_cert.id,
                '/safety/certifications'
            );
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6e. Activity feed entry when toolbox talk is conducted
CREATE OR REPLACE FUNCTION log_activity_on_toolbox_talk()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata)
        VALUES (
            NEW.project_id,
            NEW.presenter_id,
            'toolbox_talk_conducted',
            'Toolbox talk: ' || NEW.title,
            COALESCE(NEW.attendance_count::text || ' attendees', ''),
            jsonb_build_object('talk_id', NEW.id, 'topic', NEW.topic, 'attendance', NEW.attendance_count)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_activity_toolbox_talk
    AFTER INSERT ON toolbox_talks
    FOR EACH ROW EXECUTE FUNCTION log_activity_on_toolbox_talk();

-- 6f. Activity feed entry when safety observation is logged
CREATE OR REPLACE FUNCTION log_activity_on_safety_observation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata)
        VALUES (
            NEW.project_id,
            NEW.observed_by,
            'safety_observation_logged',
            'Safety observation: ' || INITCAP(REPLACE(NEW.type, '_', ' ')),
            LEFT(NEW.description, 200),
            jsonb_build_object('observation_id', NEW.id, 'type', NEW.type, 'follow_up', NEW.follow_up_required)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_activity_safety_observation
    AFTER INSERT ON safety_observations
    FOR EACH ROW EXECUTE FUNCTION log_activity_on_safety_observation();

-- ---------------------------------------------------------------------------
-- 7. Seed data
-- ---------------------------------------------------------------------------
-- All seed data references the first project in the projects table.
-- We use a DO block to capture the project_id and owner_id once.

DO $$
DECLARE
    v_project_id uuid;
    v_owner_id   uuid;
    -- Toolbox talk IDs
    v_tt1 uuid := gen_random_uuid();
    v_tt2 uuid := gen_random_uuid();
    v_tt3 uuid := gen_random_uuid();
    v_tt4 uuid := gen_random_uuid();
    v_tt5 uuid := gen_random_uuid();
    v_tt6 uuid := gen_random_uuid();
    v_tt7 uuid := gen_random_uuid();
    v_tt8 uuid := gen_random_uuid();
    v_tt9 uuid := gen_random_uuid();
    v_tt10 uuid := gen_random_uuid();
    -- Inspection IDs
    v_insp1 uuid := gen_random_uuid();
    v_insp2 uuid := gen_random_uuid();
    v_insp3 uuid := gen_random_uuid();
    v_insp4 uuid := gen_random_uuid();
    v_insp5 uuid := gen_random_uuid();
BEGIN
    -- Get the seeded project
    SELECT id, owner_id INTO v_project_id, v_owner_id
    FROM projects
    ORDER BY created_at ASC
    LIMIT 1;

    -- Exit gracefully if no project exists yet
    IF v_project_id IS NULL THEN
        RAISE NOTICE 'No project found. Skipping safety seed data.';
        RETURN;
    END IF;

    -- =====================================================================
    -- 7a. Toolbox Talks (10)
    -- =====================================================================

    INSERT INTO toolbox_talks (id, project_id, title, topic, date, presenter_id, content, duration_minutes, attendance_count, language) VALUES
    (v_tt1, v_project_id, 'Fall Protection: Guardrails, Nets, and Harnesses', 'fall_protection', CURRENT_DATE - INTERVAL '28 days',
     v_owner_id,
     'Reviewed OSHA 1926 Subpart M requirements for fall protection on this project. Covered the three primary systems: guardrail systems, safety net systems, and personal fall arrest systems. Emphasized that 100% tie off is required at any elevation above 6 feet. Demonstrated proper harness inspection: check webbing for fraying, burns, and chemical damage. Inspect buckles, D rings, and stitching. Reviewed anchor point selection and rated capacities. All workers must complete a pre use inspection log before each shift.',
     25, 18, 'en'),

    (v_tt2, v_project_id, 'PPE Requirements and Proper Usage', 'ppe', CURRENT_DATE - INTERVAL '25 days',
     v_owner_id,
     'Covered minimum PPE requirements for this site: hard hat (Type I Class E), safety glasses with side shields, high visibility vest (Class 2 minimum), steel toe boots (ASTM F2413 rated), and hearing protection in designated areas above 85 dB. Discussed specialty PPE for specific tasks: welding helmets, face shields for grinding, respiratory protection for silica exposure, and chemical resistant gloves for concrete work. Reminded crew that damaged PPE must be replaced immediately and that PPE is the last line of defense, not the first.',
     20, 22, 'en'),

    (v_tt3, v_project_id, 'Heat Illness Prevention and Hydration', 'heat_illness', CURRENT_DATE - INTERVAL '21 days',
     v_owner_id,
     'With temperatures climbing, reviewed the four stages of heat related illness: heat rash, heat cramps, heat exhaustion, and heat stroke. Heat stroke is a medical emergency requiring immediate 911 activation. Prevention strategy: drink water every 15 to 20 minutes even if not thirsty, take rest breaks in shaded areas, use cooling towels, watch your buddy for signs of confusion or excessive sweating. Acclimatization plan: new workers and those returning from 7+ days off will work reduced hours for the first week. Water stations will be placed within 200 feet of all work areas.',
     15, 24, 'en'),

    (v_tt4, v_project_id, 'Electrical Safety and Lockout Tagout', 'electrical_safety', CURRENT_DATE - INTERVAL '18 days',
     v_owner_id,
     'Reviewed electrical safety fundamentals: assume all wires are energized until verified dead. Only qualified electricians may work on energized circuits. GFCI protection is required on all temporary power and within 6 feet of water. Covered lockout tagout (LOTO) procedures: identify energy source, notify affected employees, shut down equipment, isolate energy, apply lock and tag, verify zero energy state. Each worker uses their own lock. No one removes another persons lock. Reviewed arc flash boundaries and required PPE levels.',
     30, 16, 'en'),

    (v_tt5, v_project_id, 'Excavation and Trench Safety', 'excavation', CURRENT_DATE - INTERVAL '14 days',
     v_owner_id,
     'Discussed OSHA 1926 Subpart P requirements. Any trench 5 feet or deeper requires a protective system: sloping, benching, shoring, or a trench box. A competent person must inspect the excavation daily and after any rainfall. Soil must be classified (Type A, B, or C) before determining protective system. Spoil piles must be at least 2 feet from the edge. Ladders or ramps required for access/egress within 25 feet of any worker. Never enter an unprotected trench. Underground utilities must be marked before digging. Call 811 at least 48 hours in advance.',
     25, 14, 'en'),

    (v_tt6, v_project_id, 'Scaffold Safety and Inspection', 'scaffolding', CURRENT_DATE - INTERVAL '10 days',
     v_owner_id,
     'Only scaffold competent persons may erect, modify, or dismantle scaffolding. All scaffolds must have guardrails (top rail at 42 inches, mid rail at 21 inches) and toe boards. Platforms must be fully planked with no more than 1 inch gap between planks and the uprights. Maximum gap between platform edge and face of work is 14 inches. Base plates and mudsills are required. Never use a scaffold in winds above 25 mph. Tag system: green tag means inspected and safe; red tag means do not use. Report any scaffold damage immediately.',
     20, 15, 'en'),

    (v_tt7, v_project_id, 'Hazard Communication: SDS and Chemical Safety', 'hazcom', CURRENT_DATE - INTERVAL '7 days',
     v_owner_id,
     'Under GHS/HazCom 2012, every chemical on this site must have a Safety Data Sheet (SDS) available. SDS binders are located at the job trailer and each floor entrance. Reviewed how to read an SDS: Section 2 (hazard identification), Section 4 (first aid), Section 7 (handling and storage), Section 8 (exposure controls and PPE). All chemical containers must be labeled with product name, hazard pictograms, and signal word. Never transfer chemicals to unlabeled containers. Spill kits are located at each chemical storage area.',
     20, 20, 'en'),

    (v_tt8, v_project_id, 'Housekeeping and Slip, Trip, Fall Prevention', 'housekeeping', CURRENT_DATE - INTERVAL '5 days',
     v_owner_id,
     'Good housekeeping prevents injuries and fires. Each crew is responsible for cleaning their work area at the end of every shift. Extension cords and hoses must be routed overhead or protected with cord covers. Material and debris must not block egress paths, stairways, or fire exits. All floor openings must be covered with rated covers marked "HOLE" or protected with guardrails. Wet surfaces must be marked. Nails must be bent over or removed from lumber. Dumpsters will be serviced twice weekly. Report housekeeping violations to your foreman immediately.',
     15, 22, 'en'),

    (v_tt9, v_project_id, 'Heavy Equipment and Struck By Prevention', 'equipment_operation', CURRENT_DATE - INTERVAL '3 days',
     v_owner_id,
     'Struck by incidents are a leading cause of construction fatalities (part of OSHA Focus Four). Rules for working around heavy equipment: maintain visual contact with the operator, wear high vis vests, never walk behind equipment without operator acknowledgment, stay outside the swing radius of cranes and excavators. Operators: complete a pre operation inspection, use spotters when backing, sound horn before moving. Hard barricades required around all overhead work zones. Never stand under a suspended load. Secure all tools and materials at height to prevent dropped objects.',
     25, 19, 'en'),

    (v_tt10, v_project_id, 'Emergency Procedures and Evacuation Plan', 'emergency_procedures', CURRENT_DATE - INTERVAL '1 day',
     v_owner_id,
     'Reviewed the site emergency action plan. Assembly point is the northwest corner of the parking lot. Evacuation signal: continuous air horn blast (3 seconds on, 1 second off, repeated). Each floor has a designated floor warden responsible for headcount. First aid kits are at the job trailer, each floor landing, and the equipment yard. AED locations: job trailer and 3rd floor electrical room. Emergency numbers posted at all phones. Fire extinguisher locations marked on each floor plan. In case of structural collapse or gas leak, evacuate immediately and call 911. Do not reenter until the all clear is given by the site safety manager.',
     30, 26, 'en');

    -- Toolbox talk attendees (sample for first 3 talks)
    INSERT INTO toolbox_talk_attendees (toolbox_talk_id, worker_name, company, trade, signed_at) VALUES
    (v_tt1, 'Carlos Mendez', 'Summit Steel', 'Ironworker', now() - INTERVAL '28 days'),
    (v_tt1, 'James Walker', 'Summit Steel', 'Ironworker', now() - INTERVAL '28 days'),
    (v_tt1, 'David Chen', 'Pacific Mechanical', 'Pipefitter', now() - INTERVAL '28 days'),
    (v_tt1, 'Robert Johnson', 'Apex Concrete', 'Laborer', now() - INTERVAL '28 days'),
    (v_tt2, 'Maria Santos', 'Apex Concrete', 'Laborer', now() - INTERVAL '25 days'),
    (v_tt2, 'Tom Bradley', 'Pacific Mechanical', 'Plumber', now() - INTERVAL '25 days'),
    (v_tt2, 'Ahmed Patel', 'Volt Electric', 'Electrician', now() - INTERVAL '25 days'),
    (v_tt2, 'Kevin O''Brien', 'Summit Steel', 'Welder', now() - INTERVAL '25 days'),
    (v_tt3, 'Luis Garcia', 'Apex Concrete', 'Finisher', now() - INTERVAL '21 days'),
    (v_tt3, 'Mike Thompson', 'Pacific Mechanical', 'Pipefitter', now() - INTERVAL '21 days'),
    (v_tt3, 'Sarah Kim', 'Volt Electric', 'Electrician', now() - INTERVAL '21 days'),
    (v_tt3, 'Carlos Mendez', 'Summit Steel', 'Ironworker', now() - INTERVAL '21 days');

    -- =====================================================================
    -- 7b. Safety Certifications (15)
    -- =====================================================================

    INSERT INTO safety_certifications (project_id, worker_name, company, trade, certification_type, certification_number, issued_date, expiration_date, verified) VALUES
    (v_project_id, 'Carlos Mendez', 'Summit Steel', 'Ironworker', 'osha_30', 'OSHA30-2024-88412', CURRENT_DATE - INTERVAL '8 months', CURRENT_DATE + INTERVAL '4 years 4 months', true),
    (v_project_id, 'Carlos Mendez', 'Summit Steel', 'Ironworker', 'fall_protection', 'FP-2024-3321', CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '6 months', true),
    (v_project_id, 'James Walker', 'Summit Steel', 'Ironworker', 'osha_10', 'OSHA10-2023-55190', CURRENT_DATE - INTERVAL '14 months', CURRENT_DATE + INTERVAL '3 years 10 months', true),
    (v_project_id, 'James Walker', 'Summit Steel', 'Ironworker', 'rigging', 'RIG-2024-7780', CURRENT_DATE - INTERVAL '4 months', CURRENT_DATE + INTERVAL '2 years 8 months', true),
    (v_project_id, 'David Chen', 'Pacific Mechanical', 'Pipefitter', 'osha_30', 'OSHA30-2023-41209', CURRENT_DATE - INTERVAL '18 months', CURRENT_DATE + INTERVAL '3 years 6 months', true),
    (v_project_id, 'David Chen', 'Pacific Mechanical', 'Pipefitter', 'confined_space', 'CS-2024-1190', CURRENT_DATE - INTERVAL '3 months', CURRENT_DATE + INTERVAL '9 months', true),
    (v_project_id, 'Ahmed Patel', 'Volt Electric', 'Electrician', 'osha_30', 'OSHA30-2024-92101', CURRENT_DATE - INTERVAL '5 months', CURRENT_DATE + INTERVAL '4 years 7 months', true),
    (v_project_id, 'Ahmed Patel', 'Volt Electric', 'Electrician', 'electrical_qualified', 'EQ-2024-4450', CURRENT_DATE - INTERVAL '5 months', CURRENT_DATE + INTERVAL '1 year 7 months', true),
    (v_project_id, 'Robert Johnson', 'Apex Concrete', 'Laborer', 'osha_10', 'OSHA10-2024-67230', CURRENT_DATE - INTERVAL '2 months', CURRENT_DATE + INTERVAL '4 years 10 months', true),
    (v_project_id, 'Maria Santos', 'Apex Concrete', 'Laborer', 'osha_10', 'OSHA10-2024-67231', CURRENT_DATE - INTERVAL '2 months', CURRENT_DATE + INTERVAL '4 years 10 months', true),
    (v_project_id, 'Tom Bradley', 'Pacific Mechanical', 'Plumber', 'first_aid_cpr', 'FAC-2024-8812', CURRENT_DATE - INTERVAL '10 months', CURRENT_DATE + INTERVAL '14 months', true),
    (v_project_id, 'Mike Thompson', 'Pacific Mechanical', 'Pipefitter', 'forklift', 'FL-2023-22098', CURRENT_DATE - INTERVAL '20 months', CURRENT_DATE + INTERVAL '16 months', true),
    (v_project_id, 'Kevin O''Brien', 'Summit Steel', 'Welder', 'osha_10', 'OSHA10-2024-71002', CURRENT_DATE - INTERVAL '7 months', CURRENT_DATE + INTERVAL '4 years 5 months', true),
    -- This cert is expiring soon (within 30 days) to test the notification function
    (v_project_id, 'Luis Garcia', 'Apex Concrete', 'Finisher', 'scaffold_competent', 'SC-2023-5501', CURRENT_DATE - INTERVAL '23 months', CURRENT_DATE + INTERVAL '18 days', true),
    (v_project_id, 'Sarah Kim', 'Volt Electric', 'Electrician', 'first_aid_cpr', 'FAC-2024-9930', CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '18 months', true);

    -- =====================================================================
    -- 7c. Safety Inspections (5) with items
    -- =====================================================================

    INSERT INTO safety_inspections (id, project_id, type, inspector_id, date, area, floor, status, score, max_score, weather_conditions, temperature, notes) VALUES
    (v_insp1, v_project_id, 'daily_site', v_owner_id, CURRENT_DATE - INTERVAL '5 days', 'Full Site', NULL, 'passed', 92, 100, 'Clear skies', 78,
     'Overall site conditions are good. Minor housekeeping issues on Level 3 addressed during inspection. All cranes operational with current certifications.'),

    (v_insp2, v_project_id, 'weekly_area', v_owner_id, CURRENT_DATE - INTERVAL '4 days', 'Mechanical Room', 'B1', 'passed', 88, 100, 'Cloudy', 72,
     'Mechanical room work progressing well. Confined space permits verified for all active entries. Ventilation adequate. Minor improvement needed on material storage organization.'),

    (v_insp3, v_project_id, 'scaffold', v_owner_id, CURRENT_DATE - INTERVAL '3 days', 'East Elevation', '3', 'corrective_action_required', 70, 100, 'Partly cloudy', 75,
     'Scaffold on east elevation has missing toe boards on two sections and one mid rail is damaged. Red tagged until corrections are made. Notified scaffold foreman for immediate repair.'),

    (v_insp4, v_project_id, 'electrical', v_owner_id, CURRENT_DATE - INTERVAL '2 days', 'Electrical Room', '2', 'passed', 95, 100, 'Clear', 80,
     'Electrical panels properly locked out. All temporary wiring in good condition with GFCI protection. Junction boxes covered. Arc flash labels posted.'),

    (v_insp5, v_project_id, 'excavation', v_owner_id, CURRENT_DATE - INTERVAL '1 day', 'North Parking Area', NULL, 'failed', 55, 100, 'Rain overnight', 68,
     'Excavation failed inspection. Soil conditions degraded after overnight rain. Trench walls showing signs of sloughing in Type C soil. No protective system in place for 7 foot deep trench. Work stopped immediately. Trench must be sloped or shored before reentry.');

    -- Inspection items for inspection 1 (daily site, passed)
    INSERT INTO inspection_items (inspection_id, category, question, response, severity) VALUES
    (v_insp1, 'housekeeping', 'Are all walkways and egress paths clear of debris?', 'pass', NULL),
    (v_insp1, 'ppe', 'Are all workers wearing required PPE (hard hat, safety glasses, high vis, steel toes)?', 'pass', NULL),
    (v_insp1, 'fall_protection', 'Are guardrails in place at all open edges above 6 feet?', 'pass', NULL),
    (v_insp1, 'fire_safety', 'Are fire extinguishers accessible and inspection tags current?', 'pass', NULL),
    (v_insp1, 'signage', 'Are safety signs and barricades properly placed?', 'pass', NULL),
    (v_insp1, 'housekeeping', 'Are material storage areas organized and stable?', 'corrective_action', 'minor'),
    (v_insp1, 'equipment', 'Are all power tools and equipment in safe operating condition?', 'pass', NULL),
    (v_insp1, 'electrical', 'Is GFCI protection in use on all temporary power outlets?', 'pass', NULL);

    -- Update the corrective action item with details
    UPDATE inspection_items
    SET corrective_action = 'Reorganize material storage on Level 3 west wing. Lumber stack exceeds safe height.',
        responsible_party = v_owner_id,
        due_date = CURRENT_DATE
    WHERE inspection_id = v_insp1 AND response = 'corrective_action';

    -- Inspection items for inspection 3 (scaffold, corrective action required)
    INSERT INTO inspection_items (inspection_id, category, question, response, severity, corrective_action, due_date) VALUES
    (v_insp3, 'scaffolding', 'Are all platforms fully planked with no gaps exceeding 1 inch?', 'pass', NULL, NULL, NULL),
    (v_insp3, 'scaffolding', 'Are guardrails (top and mid) in place on all open sides?', 'fail', 'major', 'Replace damaged mid rail on Section C. Rail is bent and no longer meets 200 lb load requirement.', CURRENT_DATE),
    (v_insp3, 'scaffolding', 'Are toe boards installed on all platform edges?', 'fail', 'major', 'Install toe boards on Sections B and C. Currently missing, creating dropped object hazard.', CURRENT_DATE),
    (v_insp3, 'scaffolding', 'Are base plates and mudsills in good condition?', 'pass', NULL, NULL, NULL),
    (v_insp3, 'scaffolding', 'Is the scaffold tagged green by a competent person?', 'corrective_action', 'critical', 'Red tag applied. Scaffold must not be used until all deficiencies are corrected and reinspected.', CURRENT_DATE),
    (v_insp3, 'fall_protection', 'Are workers using personal fall arrest above scaffold guardrails?', 'pass', NULL, NULL, NULL);

    -- Inspection items for inspection 5 (excavation, failed)
    INSERT INTO inspection_items (inspection_id, category, question, response, severity, corrective_action, due_date) VALUES
    (v_insp5, 'excavation', 'Has soil been classified by a competent person?', 'fail', 'critical', 'Soil must be reclassified after rain event. Current classification of Type B is no longer valid.', CURRENT_DATE),
    (v_insp5, 'excavation', 'Is a protective system (sloping, shoring, or shield) in place?', 'fail', 'imminent_danger', 'No protective system in 7 foot trench. Trench must be sloped to 1.5H:1V for Type C soil or shoring/shield installed before any worker entry.', CURRENT_DATE),
    (v_insp5, 'excavation', 'Is spoil pile at least 2 feet from trench edge?', 'fail', 'major', 'Spoil pile encroaching within 1 foot of east side. Move spoil back to minimum 2 foot setback.', CURRENT_DATE),
    (v_insp5, 'excavation', 'Are ladders or ramps provided within 25 feet of workers?', 'pass', NULL, NULL, NULL),
    (v_insp5, 'excavation', 'Is the excavation free of standing water?', 'fail', 'major', 'Approximately 8 inches of standing water in the north end. Pump out water and inspect walls before reentry.', CURRENT_DATE + INTERVAL '1 day'),
    (v_insp5, 'signage', 'Are barricades and warning signs posted around the excavation?', 'pass', NULL, NULL, NULL);

    -- =====================================================================
    -- 7d. Incidents (3)
    -- =====================================================================

    INSERT INTO incidents (project_id, type, severity, date, location, floor, area, description, root_cause, injured_party_name, injured_party_company, injured_party_trade, witness_names, immediate_actions, osha_recordable, investigation_status, corrective_actions, preventive_actions, reported_by) VALUES

    -- Near miss
    (v_project_id, 'near_miss', NULL, now() - INTERVAL '12 days',
     'Tower crane zone, north side', '6', 'Structural steel area',
     'A 4 foot section of angle iron fell approximately 40 feet from Level 6 during steel erection. The piece landed 3 feet from two laborers working at grade level. No injuries occurred. The steel was not properly secured during a bolt up operation and was dislodged when the crane swung a beam nearby.',
     'Improper material securing during bolt up. Steel section was resting on flange without a clamp or tack weld. Vibration from crane operation dislodged the piece.',
     NULL, NULL, NULL,
     '["Robert Johnson", "Maria Santos"]'::jsonb,
     'Stopped all overhead work immediately. Cleared area below. Retrained iron workers on securing loose material. Installed additional debris nets on the north face.',
     false, 'closed',
     '["Mandatory use of beam clamps during all bolt-up operations", "Debris nets required on all open faces during steel erection"]'::jsonb,
     '["Weekly overhead hazard assessment added to foreman checklist", "Expanded exclusion zone below active steel erection"]'::jsonb,
     v_owner_id),

    -- First aid injury
    (v_project_id, 'injury', 'first_aid', now() - INTERVAL '6 days',
     'Mechanical room', 'B1', 'Piping corridor',
     'Pipefitter sustained a laceration to the left forearm while cutting copper pipe with a reciprocating saw. The pipe shifted during the cut, causing the blade to contact the workers arm. The cut was approximately 2 inches long and shallow. First aid was administered on site: wound was cleaned, butterfly bandages applied, and the worker returned to work with a protective sleeve.',
     'Pipe was not properly secured in the vise. Worker was cutting one handed to hold the pipe steady instead of using a clamp.',
     'David Chen', 'Pacific Mechanical', 'Pipefitter',
     '["Tom Bradley"]'::jsonb,
     'First aid administered by site safety officer. Wound cleaned with antiseptic, butterfly bandages applied. Worker fitted with cut resistant sleeve. Returned to duty same day.',
     false, 'closed',
     '["Retrained crew on proper pipe securing techniques", "Replaced worn pipe vise in mechanical room"]'::jsonb,
     '["Added cut-resistant sleeves to mandatory PPE for all cutting operations", "Pre-task plan now requires identification of material securing method"]'::jsonb,
     v_owner_id),

    -- Property damage
    (v_project_id, 'property_damage', NULL, now() - INTERVAL '2 days',
     'South entrance, grade level', NULL, 'Loading dock',
     'A concrete delivery truck backed into the newly installed bollard and chain link fence at the south loading dock entrance. The driver misjudged the turning radius and struck the bollard at approximately 5 mph, bending it 15 degrees and tearing a 6 foot section of chain link from the top rail. No injuries. The loading dock was not occupied at the time. Estimated repair cost is $2,800.',
     'Inadequate spotting procedures. The truck was backing without a spotter. The turning radius for the concrete trucks is tight at this entrance and mirrors alone are not sufficient.',
     NULL, NULL, NULL,
     '["Kevin O''Brien", "Luis Garcia"]'::jsonb,
     'Area was barricaded and caution tape placed around the damaged bollard. Temporary barrier installed. Concrete deliveries rerouted to the north entrance until repairs are complete.',
     false, 'investigating',
     '["Repair bollard and fence section", "Repaint lane markings with wider turning path"]'::jsonb,
     '["Mandatory spotter for all truck backing operations", "Install convex mirror at south entrance approach", "Add wheel stops to define maximum backup distance"]'::jsonb,
     v_owner_id);

    -- =====================================================================
    -- 7e. Safety Observations (8)
    -- =====================================================================

    INSERT INTO safety_observations (project_id, type, category, description, location, observed_by, date, action_taken, follow_up_required) VALUES

    (v_project_id, 'safe_behavior', 'PPE',
     'Ironworker crew on Level 5 all wearing full PPE including harnesses with 100% tie off while working near open edge. Good compliance even during break period.',
     'Level 5, east wing', v_owner_id, CURRENT_DATE - INTERVAL '10 days', 'Recognized crew at toolbox talk. Positive example for other trades.', false),

    (v_project_id, 'at_risk_behavior', 'Fall Protection',
     'Two laborers observed walking near open stairwell shaft on Level 4 without the temporary guardrail in place. The guardrail had been removed for material hoisting and not reinstalled.',
     'Level 4, stairwell B', v_owner_id, CURRENT_DATE - INTERVAL '8 days', 'Stopped work immediately. Reinstalled guardrail. Counseled workers. Notified foreman.', true),

    (v_project_id, 'hazard', 'Electrical',
     'Extension cord running across a wet floor area in the mechanical room without GFCI protection. The cord was powering a chop saw. Water was pooling from an active plumbing rough in above.',
     'B1, mechanical room', v_owner_id, CURRENT_DATE - INTERVAL '7 days', 'Unplugged cord immediately. Installed GFCI adapter. Rerouted cord to avoid wet area. Notified electrician to add permanent GFCI outlet.', true),

    (v_project_id, 'safe_behavior', 'Housekeeping',
     'Concrete crew maintained excellent housekeeping throughout their pour on Level 3. All hoses coiled, tools organized, and spills cleaned up before leaving for the day.',
     'Level 3, full floor', v_owner_id, CURRENT_DATE - INTERVAL '6 days', 'Acknowledged crew lead. Good example of leaving the area safe for the next trade.', false),

    (v_project_id, 'at_risk_behavior', 'PPE',
     'Plumber observed grinding a cast iron pipe without a face shield. Safety glasses were worn but do not provide adequate protection against grinding sparks and debris.',
     'Level 2, bathroom rough in', v_owner_id, CURRENT_DATE - INTERVAL '5 days', 'Stopped task. Provided face shield. Reviewed grinding PPE requirements. Documented in workers safety record.', false),

    (v_project_id, 'hazard', 'Housekeeping',
     'Protruding nails in a stack of stripped formwork lumber on Level 2. Nails were not bent over or removed. Stack was in a high traffic walkway near the elevator shaft.',
     'Level 2, east corridor', v_owner_id, CURRENT_DATE - INTERVAL '4 days', 'Moved lumber to designated nail pulling area. Assigned laborer to remove all protruding nails before restacking.', false),

    (v_project_id, 'positive_recognition', 'Emergency Procedures',
     'Electrician Ahmed Patel noticed a frayed cord on a temporary panel and immediately de energized the circuit, tagged it out, and reported it to the GC. Prevented a potential electrical fire.',
     'Level 4, electrical closet', v_owner_id, CURRENT_DATE - INTERVAL '3 days', 'Recognized Ahmed at the all hands meeting. Submitted him for the monthly safety award.', false),

    (v_project_id, 'hazard', 'Fall Protection',
     'Floor opening on Level 5 covered with a piece of plywood that is not secured and not marked "HOLE." The cover could shift if stepped on, creating a fall hazard to Level 4 below.',
     'Level 5, northwest corner', v_owner_id, CURRENT_DATE - INTERVAL '1 day', 'Secured plywood cover with screws. Painted "HOLE" on cover per OSHA requirements. Added to daily inspection checklist for this floor.', true);

END
$$;

-- ---------------------------------------------------------------------------
-- Done. Safety module is fully deployed.
-- ---------------------------------------------------------------------------
