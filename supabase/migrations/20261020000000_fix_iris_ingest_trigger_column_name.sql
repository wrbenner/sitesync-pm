-- Fix-up for 20261008000004_iris_ingest_triggers.sql AND
-- 20261008000006_iris_ingest_dispatcher.sql.
--
-- All four iris ingest trigger functions select `org_id FROM public.projects`,
-- but the projects table column has always been `organization_id` (created
-- in 00021_organization_permissions.sql, reaffirmed in 00053_multi_tenant.sql).
-- Any INSERT or UPDATE on documents, rfis, daily_logs, or change_orders
-- trips PGSQL 42703 and fails the mutation — including every seed-data
-- INSERT and every production write.
--
-- Recreating the trigger functions with `organization_id` keeps the rest
-- of the trigger logic intact. The pgmq payload field stays `org_id` so
-- worker contracts don't change.

CREATE OR REPLACE FUNCTION public.documents_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_type TEXT := 'unclassified';
  v_version_hash TEXT;
BEGIN
  IF NEW.mime_type IS NOT NULL THEN
    IF NEW.mime_type LIKE 'image/%' THEN v_source_type := 'photo';
    ELSIF NEW.mime_type LIKE '%spreadsheetml%' OR NEW.mime_type LIKE '%csv%' THEN v_source_type := 'spreadsheet';
    ELSIF NEW.mime_type LIKE 'message/%' THEN v_source_type := 'conversation';
    END IF;
  END IF;

  v_version_hash := COALESCE(NEW.checksum, NEW.id::text || COALESCE(NEW.updated_at::text, NEW.created_at::text));

  PERFORM public.iris_enqueue_ingest(
    v_source_type,
    NEW.id::text,
    NEW.project_id,
    (SELECT organization_id FROM public.projects WHERE id = NEW.project_id LIMIT 1),
    v_version_hash
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rfis_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_hash TEXT;
BEGIN
  v_version_hash := md5(
    coalesce(NEW.title, '')
    || '|' || coalesce(NEW.description, '')
    || '|' || coalesce(NEW.status, '')
    || '|' || coalesce(NEW.updated_at::text, '')
  );

  PERFORM public.iris_enqueue_ingest(
    'rfi',
    NEW.id::text,
    NEW.project_id,
    (SELECT organization_id FROM public.projects WHERE id = NEW.project_id LIMIT 1),
    v_version_hash
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.daily_logs_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_hash TEXT;
BEGIN
  v_version_hash := md5(
    coalesce(NEW.weather, '')
    || '|' || coalesce(NEW.narrative, '')
    || '|' || coalesce(NEW.status, '')
    || '|' || coalesce(NEW.log_date::text, '')
    || '|' || coalesce(NEW.updated_at::text, '')
  );

  PERFORM public.iris_enqueue_ingest(
    'daily_log',
    NEW.id::text,
    NEW.project_id,
    (SELECT organization_id FROM public.projects WHERE id = NEW.project_id LIMIT 1),
    v_version_hash
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_orders_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_hash TEXT;
BEGIN
  v_version_hash := md5(
    coalesce(NEW.co_number, '')
    || '|' || coalesce(NEW.status, '')
    || '|' || coalesce(NEW.total_cents::text, '')
    || '|' || coalesce(NEW.justification, '')
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
