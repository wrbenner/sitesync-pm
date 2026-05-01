-- =============================================================================
-- projects.auto_co_drafting_enabled — per-project opt-out
-- =============================================================================
-- Some owner contracts require the architect to be the sole CO author. On
-- those projects, the GC should not see auto-drafted COs (it would create a
-- procedural mess). Default ON because most projects want it.
-- =============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS auto_co_drafting_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN projects.auto_co_drafting_enabled IS
  'When false, the RFI→CO auto-drafter skips this project. Used on contracts that require architect-only CO authorship.';

-- Index isn't worth it for a boolean default-true column — every read of
-- projects already pulls the row by id. No idx.
