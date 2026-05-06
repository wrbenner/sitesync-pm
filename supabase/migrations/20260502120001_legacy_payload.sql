-- ═══════════════════════════════════════════════════════════════
-- Migration: legacy_payload columns
-- Version: 20260502120001
--
-- Adds `legacy_payload jsonb` to every importable entity. This
-- column holds the unmodified source-system row (Procore JSON,
-- P6 task fields, etc.) so we can re-import or audit what was
-- actually received without losing data through the mapping pass.
--
-- Separate migration from external_ids so it can be rolled back
-- independently.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE rfis ADD COLUMN IF NOT EXISTS legacy_payload jsonb;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS legacy_payload jsonb;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS legacy_payload jsonb;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_logs') THEN
    EXECUTE 'ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS legacy_payload jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drawings') THEN
    EXECUTE 'ALTER TABLE drawings ADD COLUMN IF NOT EXISTS legacy_payload jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'photos') THEN
    EXECUTE 'ALTER TABLE photos ADD COLUMN IF NOT EXISTS legacy_payload jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'directory_contacts') THEN
    EXECUTE 'ALTER TABLE directory_contacts ADD COLUMN IF NOT EXISTS legacy_payload jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_phases') THEN
    EXECUTE 'ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS legacy_payload jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_items') THEN
    EXECUTE 'ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS legacy_payload jsonb';
  END IF;
END $$;
