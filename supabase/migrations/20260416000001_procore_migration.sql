-- =============================================================================
-- Procore Migration Tool — Database Schema
-- =============================================================================
-- Tracks migration runs and maps Procore IDs to SiteSync IDs.
-- All tables idempotent (IF NOT EXISTS). Safe to re-run.
-- =============================================================================

-- ── Migration Runs ──────────────────────────────────────────────────────────
-- Each run represents a complete migration session (one GC migrating from Procore).

CREATE TABLE IF NOT EXISTS migration_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_platform   TEXT NOT NULL DEFAULT 'procore',
  source_company_id TEXT,                                -- Procore company ID
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id),
  config            JSONB DEFAULT '{}',                  -- migration settings (cutoff date, entity types, etc.)
  summary           JSONB DEFAULT '{}',                  -- post-migration counts (imported, skipped, failed per entity type)
  error_log         TEXT,                                -- last error if status = failed
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── ID Mapping ──────────────────────────────────────────────────────────────
-- Bidirectional map between Procore integer IDs and SiteSync UUIDs.
-- Used to resolve cross-references (RFI linked to drawing, etc.)

CREATE TABLE IF NOT EXISTS migration_id_map (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_run_id  UUID NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE,
  entity_type       TEXT NOT NULL,                       -- 'rfi', 'submittal', 'project', 'user', 'drawing', etc.
  source_id         TEXT NOT NULL,                       -- Procore ID (integer as text for flexibility)
  source_number     TEXT,                                -- human-readable (e.g., 'RFI-042', 'SUB-017')
  target_id         UUID,                                -- SiteSync UUID (null until migrated)
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'migrated', 'failed', 'skipped', 'duplicate')),
  error_message     TEXT,
  migrated_at       TIMESTAMPTZ,
  raw_data          JSONB,                               -- original Procore record (for debugging/re-migration)
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookup during migration
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_migration_map_lookup
    ON migration_id_map(migration_run_id, entity_type, source_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_migration_map_reverse
    ON migration_id_map(entity_type, target_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_migration_map_status
    ON migration_id_map(migration_run_id, status);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── User Mapping ────────────────────────────────────────────────────────────
-- Maps Procore user emails to SiteSync user IDs. Email is the cross-system key.

CREATE TABLE IF NOT EXISTS migration_user_map (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_run_id  UUID NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE,
  procore_user_id   TEXT NOT NULL,
  procore_email     TEXT NOT NULL,
  procore_name      TEXT,
  sitesync_user_id  UUID REFERENCES auth.users(id),
  match_method      TEXT DEFAULT 'pending'
                    CHECK (match_method IN ('pending', 'exact_email', 'fuzzy', 'manual', 'placeholder')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_migration_user_email
    ON migration_user_map(migration_run_id, procore_email);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Migration data scoped to organization.

ALTER TABLE migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_user_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY migration_runs_org ON migration_runs
    USING (organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY migration_id_map_org ON migration_id_map
    USING (migration_run_id IN (
      SELECT id FROM migration_runs
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid())
      )
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY migration_user_map_org ON migration_user_map
    USING (migration_run_id IN (
      SELECT id FROM migration_runs
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid())
      )
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
