-- ═══════════════════════════════════════════════════════════════
-- Migration: Cross-feature metadata columns
-- Version: 20260428100000
--
-- Purpose: enable idempotent cross-feature workflows. When a workflow
-- creates an entity downstream of another (e.g. an overdue-RFI sweep
-- creates a follow-up task), we need to record the source so a
-- subsequent sweep doesn't create a duplicate.
--
-- Uses a generic `metadata jsonb` column rather than typed FK columns
-- because the source can be any entity type (rfi, submittal, daily
-- log entry, drawing revision, schedule slip, …) and adding a typed
-- column per source would mean a wide schema. jsonb keeps it open.
--
-- Convention for cross-feature links:
--   metadata = { "source": "<workflow_name>", "<source>_id": "<uuid>" }
-- e.g. tasks created by the RFI-overdue sweep get
--   { "source": "rfi_overdue_sweep", "rfi_id": "<uuid>" }
--
-- Callers query existence with `metadata @> '{"rfi_id":"<uuid>"}'`.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE rfis       ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE incidents  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- GIN indexes accelerate `metadata @> ...` containment queries used
-- by the idempotency checks in src/lib/crossFeatureWorkflows.ts.
CREATE INDEX IF NOT EXISTS idx_tasks_metadata     ON tasks     USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_rfis_metadata      ON rfis      USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_incidents_metadata ON incidents USING gin (metadata);
