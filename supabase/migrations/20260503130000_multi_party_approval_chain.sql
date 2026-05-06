-- Multi-party approval chain — extends approval_chain to RFIs, Change Orders,
-- and Punch Items so any document can route through 4-5 parties (e.g.
-- Sub → GC PM → GC Exec → Architect → Owner).
--
-- Submittals already have approval_chain (00029_submittal_workflow.sql).
-- This migration mirrors that for the other three doc types.
--
-- Shape per row in the JSONB array:
--   { "role": "GC PM", "party_id": "<uuid|email|null>", "status": "pending|current|approved|rejected", "stamp": "<iso|null>", "comments": "<text|null>" }

ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS approval_chain jsonb DEFAULT '[{"role":"GC PM","status":"current"},{"role":"Architect","status":"pending"}]'::jsonb;

ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS approval_chain jsonb DEFAULT '[{"role":"GC PM","status":"current"},{"role":"GC Exec","status":"pending"},{"role":"Owner","status":"pending"}]'::jsonb;

ALTER TABLE punch_items
  ADD COLUMN IF NOT EXISTS approval_chain jsonb DEFAULT '[{"role":"Sub","status":"current"},{"role":"GC Super","status":"pending"}]'::jsonb;

CREATE INDEX IF NOT EXISTS rfis_approval_chain_gin ON rfis USING gin (approval_chain);
CREATE INDEX IF NOT EXISTS change_orders_approval_chain_gin ON change_orders USING gin (approval_chain);
CREATE INDEX IF NOT EXISTS punch_items_approval_chain_gin ON punch_items USING gin (approval_chain);

COMMENT ON COLUMN rfis.approval_chain IS 'Multi-party approval routing. JSONB array of { role, party_id, status, stamp, comments }.';
COMMENT ON COLUMN change_orders.approval_chain IS 'Multi-party approval routing. JSONB array of { role, party_id, status, stamp, comments }.';
COMMENT ON COLUMN punch_items.approval_chain IS 'Multi-party approval routing. JSONB array of { role, party_id, status, stamp, comments }.';
