-- ══════════════════════════════════════════════════════════════
-- agent_tasks — persistence for every Iris turn and any
-- agent-orchestrator tool invocation. One row per attempted
-- action (chat reply, read-only tool call, or mutation awaiting
-- human approval). Enables history, audit, and an approval queue.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id   uuid,
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  agent_domain      text NOT NULL CHECK (agent_domain IN (
                      'schedule', 'cost', 'safety', 'quality',
                      'compliance', 'document', 'general'
                    )),
  tool_name         text,
  tool_input        jsonb,
  tool_output       jsonb,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending', 'running', 'succeeded',
                      'failed', 'cancelled', 'pending_approval'
                    )),
  error_message     text,
  approval_required boolean NOT NULL DEFAULT false,
  approved_by       uuid REFERENCES auth.users(id),
  approved_at       timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_project_created
  ON agent_tasks (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_pending_approval
  ON agent_tasks (status)
  WHERE approval_required = true;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_created
  ON agent_tasks (user_id, created_at DESC);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

-- Reads: any project member can see tasks for that project.
DO $$ BEGIN
  CREATE POLICY agent_tasks_select ON agent_tasks
    FOR SELECT USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Writes: only the task's owner may insert their own row.
DO $$ BEGIN
  CREATE POLICY agent_tasks_insert ON agent_tasks
    FOR INSERT WITH CHECK (
      user_id = (SELECT auth.uid())
      AND is_project_member(project_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Updates: owner can update their own rows; project admins/owners
-- can update any row in their project (needed so a supervisor can
-- approve a subordinate's pending_approval task).
DO $$ BEGIN
  CREATE POLICY agent_tasks_update ON agent_tasks
    FOR UPDATE USING (
      user_id = (SELECT auth.uid())
      OR is_project_role(project_id, ARRAY['owner', 'admin'])
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Delete: owner only.
DO $$ BEGIN
  CREATE POLICY agent_tasks_delete ON agent_tasks
    FOR DELETE USING (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep updated_at current.
CREATE OR REPLACE FUNCTION agent_tasks_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_agent_tasks_updated_at
    BEFORE UPDATE ON agent_tasks
    FOR EACH ROW EXECUTE FUNCTION agent_tasks_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
