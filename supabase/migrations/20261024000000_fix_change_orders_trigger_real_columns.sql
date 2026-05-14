-- Fix-up for 20261020000000_fix_iris_ingest_trigger_column_name.sql.
--
-- The change_orders_iris_ingest_trigger function references NEW.co_number,
-- NEW.total_cents, and NEW.justification, but `public.change_orders` has
-- never had those columns. Real columns (verified on staging
-- `nrsbvqkpxxlonvkmcmxf` 2026-05-14):
--   - `number`       (integer)         <- not `co_number`
--   - `amount_cents` (bigint)          <- not `total_cents`
--   - `description`  (text)            <- not `justification`
--
-- Every INSERT or UPDATE on change_orders trips PGSQL 42703 because the
-- trigger fires inline. Gate 7 (run 25890867452) surfaced this via the B.2
-- change-order-create regression spec: `column change_orders.co_number does
-- not exist`.
--
-- This migration uses CREATE OR REPLACE so the existing trigger binding
-- (`change_orders_iris_ingest`) keeps pointing at the same function name
-- without a DROP/CREATE round-trip. The pgmq payload contract is unchanged
-- (still emits 'change_order' with the project's organization_id).
--
-- Other ingest triggers (rfis, daily_logs, documents) were verified clean
-- via pg_get_functiondef on staging and are intentionally untouched.

CREATE OR REPLACE FUNCTION public.change_orders_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_hash TEXT;
BEGIN
  v_version_hash := md5(
    coalesce(NEW.number::text, '')
    || '|' || coalesce(NEW.status, '')
    || '|' || coalesce(NEW.amount_cents::text, '')
    || '|' || coalesce(NEW.description, '')
    || '|' || coalesce(NEW.updated_at::text, '')
  );

  PERFORM public.iris_enqueue_ingest(
    'change_order',
    NEW.id::text,
    NEW.project_id,
    (SELECT organization_id FROM public.projects WHERE id = NEW.project_id LIMIT 1),
    v_version_hash
  );
  RETURN NEW;
END;
$$;
