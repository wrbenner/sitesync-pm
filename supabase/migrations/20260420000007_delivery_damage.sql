-- Add damage_reports jsonb to deliveries for tracking received-damaged items
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS damage_reports jsonb DEFAULT '[]';
-- Add vendor column to match application code (some migrations use supplier, app uses vendor)
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS vendor text;
-- Backfill vendor from supplier where missing
UPDATE deliveries SET vendor = supplier WHERE vendor IS NULL AND supplier IS NOT NULL;
