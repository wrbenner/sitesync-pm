-- Widen activity_feed.type to accept entity-type values used by the enrichment layer.
-- The old constraint used composite event-type strings (rfi_created, task_moved, etc.)
-- but the enrichment code expects bare entity types (rfi, task, etc.) in item.type
-- and reads the action verb from metadata.action.
ALTER TABLE activity_feed DROP CONSTRAINT IF EXISTS activity_feed_type_check;
