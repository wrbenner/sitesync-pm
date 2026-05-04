-- =============================================================================
-- change_orders.source_rfi_id — closes the loop from RFI answer to CO
-- =============================================================================
-- The RFI→CO auto-drafter writes a CO with source_rfi_id set so the system
-- can:
--   1. Refuse to draft a duplicate when an existing CO already references
--      the RFI (avoids stepping on a PM's manual draft).
--   2. Surface the chain on both ends — "this CO came from RFI 112" /
--      "this RFI's answer produced CO #014".
--   3. Audit-trail the link permanently. Six months later when an owner
--      disputes a CO, the originating RFI is one click away.
-- =============================================================================

ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS source_rfi_id uuid REFERENCES rfis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_change_orders_source_rfi
  ON change_orders(source_rfi_id)
  WHERE source_rfi_id IS NOT NULL;

-- A unique partial index ensures one CO per (rfi, draft-state). Approved /
-- rejected COs don't block re-drafting if the RFI gets answered again.
-- We allow one pending and one approved per RFI so the most-recent answer
-- can produce a fresh draft even if a prior approved CO exists.
CREATE UNIQUE INDEX IF NOT EXISTS uq_change_orders_pending_per_rfi
  ON change_orders(source_rfi_id)
  WHERE source_rfi_id IS NOT NULL
    AND status IN ('pending_review','draft','submitted');
