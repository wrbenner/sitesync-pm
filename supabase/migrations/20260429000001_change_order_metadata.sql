-- ═══════════════════════════════════════════════════════════════
-- Migration: change_orders metadata column
-- Version: 20260429000001
--
-- Purpose: extends the cross-feature metadata pattern (see
-- 20260428100000_cross_feature_metadata.sql) to change_orders so
-- the schedule-slip → AI-draft CO chain can write idempotency
-- markers (`metadata @> '{"task_id":"<uuid>"}'`).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_change_orders_metadata
  ON change_orders USING gin (metadata);
