-- ══════════════════════════════════════════════════════════════
-- Draw Report ingestion — schema extensions
--
-- Adds AIA G703 continuation-sheet columns to pay_application_line_items
-- so uploaded draw reports can populate a full schedule-of-values breakdown
-- (scheduled value, previous completed, this period, materials stored,
-- percent complete, retainage, balance to finish).
--
-- Also adds provenance columns (source_document_id, raw_extraction,
-- extraction_confidence) so we can trace every line item back to the
-- uploaded PDF/xlsx and re-process if Gemini output changes.
-- ══════════════════════════════════════════════════════════════

-- ── pay_application_line_items: G703 continuation-sheet columns ──

ALTER TABLE pay_application_line_items
  ADD COLUMN IF NOT EXISTS item_number text,
  ADD COLUMN IF NOT EXISTS cost_code text,
  ADD COLUMN IF NOT EXISTS scheduled_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_completed numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS materials_stored numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percent_complete numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_to_finish numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extraction_confidence numeric;

CREATE INDEX IF NOT EXISTS idx_pay_app_line_items_cost_code
  ON pay_application_line_items(cost_code);

CREATE INDEX IF NOT EXISTS idx_pay_app_line_items_source_doc
  ON pay_application_line_items(source_document_id);

-- ── pay_applications: extraction provenance ──

ALTER TABLE pay_applications
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS raw_extraction jsonb;

CREATE INDEX IF NOT EXISTS idx_pay_applications_source_doc
  ON pay_applications(source_document_id);

-- ── documents: add tags/category values recognized by draw-report flow ──
-- (No schema change — just a comment for future grep-ability)
-- category = 'draw_report' is the canonical marker for uploaded draws.
COMMENT ON COLUMN documents.category IS
  'Free-form category. Known values include: draw_report, pay_application, drawing, submittal, rfi, meeting.';
