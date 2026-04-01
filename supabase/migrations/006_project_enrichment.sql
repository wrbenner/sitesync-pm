-- Migration: Enrich projects table with construction-relevant attributes
-- Adds project type, delivery method, contract type, owner/architect linkage,
-- geographic coordinates, building specs, phase, retainage, and media fields.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type text CHECK (project_type IN (
  'commercial_office', 'mixed_use', 'healthcare', 'education',
  'multifamily', 'industrial', 'data_center', 'retail',
  'hospitality', 'government', 'infrastructure'
));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_method text CHECK (delivery_method IN (
  'design_bid_build', 'cm_at_risk', 'design_build', 'integrated_project_delivery'
));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_type text CHECK (contract_type IN (
  'lump_sum', 'gmp', 'cost_plus', 'time_and_materials', 'unit_price'
));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_contact_id uuid REFERENCES directory_contacts(id) ON DELETE SET NULL;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS architect_name text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS architect_contact_id uuid REFERENCES directory_contacts(id) ON DELETE SET NULL;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude numeric;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS building_area_sqft numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS num_floors int;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_phase text DEFAULT 'construction' CHECK (project_phase IN (
  'preconstruction', 'mobilization', 'construction', 'commissioning', 'closeout', 'warranty'
));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS retainage_rate numeric DEFAULT 10.0;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS time_zone text DEFAULT 'America/New_York';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS weather_location_id text;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_photo_url text;

COMMENT ON COLUMN projects.project_type IS 'Construction project category';
COMMENT ON COLUMN projects.delivery_method IS 'Project delivery method (DBB, CMR, DB, IPD)';
COMMENT ON COLUMN projects.contract_type IS 'Contract structure (lump sum, GMP, cost plus, T&M, unit price)';
COMMENT ON COLUMN projects.owner_contact_id IS 'FK to directory_contacts for the project owner representative';
COMMENT ON COLUMN projects.architect_contact_id IS 'FK to directory_contacts for the architect of record';
COMMENT ON COLUMN projects.latitude IS 'WGS84 latitude for weather API and map display';
COMMENT ON COLUMN projects.longitude IS 'WGS84 longitude for weather API and map display';
COMMENT ON COLUMN projects.weather_location_id IS 'External weather API location identifier';
COMMENT ON COLUMN projects.project_phase IS 'Current phase of the project lifecycle';
COMMENT ON COLUMN projects.retainage_rate IS 'Retainage percentage (0 to 100), configurable per project';
