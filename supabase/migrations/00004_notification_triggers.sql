-- =============================================================================
-- Notification triggers for automated alerts
-- =============================================================================

-- Function to create an in-app notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_project_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, project_id, type, title, body, link)
  VALUES (p_user_id, p_project_id, p_type, p_title, p_body, p_link);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: When an RFI is assigned, notify the assignee
CREATE OR REPLACE FUNCTION notify_rfi_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD IS NULL OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      NEW.project_id,
      'rfi_assigned',
      'RFI #' || NEW.number || ' assigned to you',
      NEW.title,
      '/rfis'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_rfi_assigned
  AFTER INSERT OR UPDATE ON rfis
  FOR EACH ROW EXECUTE FUNCTION notify_rfi_assigned();

-- Trigger: When a submittal status changes to under_review, notify reviewer
CREATE OR REPLACE FUNCTION notify_submittal_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'under_review' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM create_notification(
        NEW.assigned_to,
        NEW.project_id,
        'submittal_review',
        'Submittal #' || NEW.number || ' needs your review',
        NEW.title,
        '/submittals'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_submittal_review
  AFTER INSERT OR UPDATE ON submittals
  FOR EACH ROW EXECUTE FUNCTION notify_submittal_review();

-- Trigger: When a daily log is submitted (not approved), notify approver
CREATE OR REPLACE FUNCTION notify_daily_log_submitted()
RETURNS TRIGGER AS $$
DECLARE
  v_approver uuid;
BEGIN
  IF NEW.approved = false AND (OLD IS NULL OR OLD.approved IS DISTINCT FROM NEW.approved OR OLD IS NULL) THEN
    -- Notify project owners and admins
    FOR v_approver IN
      SELECT user_id FROM project_members
      WHERE project_id = NEW.project_id AND role IN ('owner', 'admin')
    LOOP
      PERFORM create_notification(
        v_approver,
        NEW.project_id,
        'daily_log_approval',
        'Daily log for ' || NEW.log_date || ' ready for approval',
        COALESCE(NEW.summary, 'Daily log submitted'),
        '/daily-log'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_daily_log_submitted
  AFTER INSERT ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION notify_daily_log_submitted();

-- Trigger: When a punch item is assigned, notify assignee
CREATE OR REPLACE FUNCTION notify_punch_item_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD IS NULL OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      NEW.project_id,
      'punch_item',
      'Punch item assigned: ' || NEW.title,
      COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.floor, ''),
      '/punch-list'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_punch_item_assigned
  AFTER INSERT OR UPDATE ON punch_items
  FOR EACH ROW EXECUTE FUNCTION notify_punch_item_assigned();

-- Trigger: When a task is assigned, notify assignee
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD IS NULL OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      NEW.project_id,
      'task_update',
      'Task assigned: ' || NEW.title,
      COALESCE(NEW.description, ''),
      '/tasks'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_assigned
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();

-- Trigger: Auto create activity feed entry on key events
CREATE OR REPLACE FUNCTION log_activity_on_rfi()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata)
    VALUES (
      NEW.project_id,
      NEW.created_by,
      'rfi_created',
      'Created RFI #' || NEW.number,
      NEW.title,
      jsonb_build_object('rfi_id', NEW.id, 'priority', NEW.priority)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_activity_rfi
  AFTER INSERT ON rfis
  FOR EACH ROW EXECUTE FUNCTION log_activity_on_rfi();

CREATE OR REPLACE FUNCTION log_activity_on_punch_resolved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO activity_feed (project_id, user_id, type, title, body)
    VALUES (
      NEW.project_id,
      NEW.assigned_to,
      'punch_resolved',
      'Resolved punch item: ' || NEW.title,
      COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.floor, '')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_activity_punch_resolved
  AFTER UPDATE ON punch_items
  FOR EACH ROW EXECUTE FUNCTION log_activity_on_punch_resolved();
