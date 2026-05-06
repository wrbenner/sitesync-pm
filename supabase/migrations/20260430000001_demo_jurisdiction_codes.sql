-- Adds two demo-grounding columns consumed by the cockpit Iris "Ground in
-- the world" pill on the day-one investor demo:
--   * projects.jurisdiction  — string label rendered in the Iris context
--                              banner (e.g. "Dallas, TX").
--   * rfis.applicable_codes  — citations attached to RFIs that have a code
--                              dimension (IBC / NFPA / ADA / ICC). Renders
--                              as the code-pill row on the RFI detail.
--
-- Both columns are nullable + idempotent so this can be re-applied safely
-- on top of any existing schema state. No backfill — demo seeds populate
-- them at seed time, real projects fill them when the feature ships.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS jurisdiction text;

ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS applicable_codes text[];
