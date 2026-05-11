-- ────────────────────────────────────────────────────────────────────────────
-- iris_ingest_triggers — Phase 3b
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
--
-- AFTER INSERT/UPDATE triggers on the source tables that the Phase 3b
-- workers consume. Each trigger enqueues an iris_ingest message identifying
-- the (source_type, source_id, project_id) tuple. The dispatcher edge fn
-- (lands later in 3c alongside the cron heartbeat) fans the message out to
-- the right per-source worker.
--
-- Phase 3b ships triggers for: documents, rfis. The other source tables get
-- their triggers in 3c (daily_logs, change_orders, media_assets, etc.).
--
-- Idempotent: pgmq.send() will enqueue duplicates if the trigger fires
-- multiple times for the same row. Workers dedupe by (source_id, version_hash)
-- in the iris_kb_sources tracker — a second message with the same hash
-- finds last_version_hash unchanged and skips. So duplicate enqueues are safe.
--
-- Rollback: DROP TRIGGER ... ON public.documents; DROP TRIGGER ... ON public.rfis;
-- DROP FUNCTION iris_enqueue_ingest;

-- Shared trigger helper. Computes a payload from the row and enqueues it.
CREATE OR REPLACE FUNCTION public.iris_enqueue_ingest(
  p_source_type TEXT,
  p_source_id TEXT,
  p_project_id UUID,
  p_org_id UUID,
  p_version_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  PERFORM pgmq.send(
    'iris_ingest',
    jsonb_build_object(
      'source_type', p_source_type,
      'source_id', p_source_id,
      'project_id', p_project_id,
      'org_id', p_org_id,
      'version_hash', p_version_hash
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Trigger failures must not block the originating INSERT/UPDATE. Log
  -- and continue; the dispatcher's daily reconcile will catch missing rows.
  RAISE NOTICE 'iris_enqueue_ingest failed for %=%: %', p_source_type, p_source_id, SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.iris_enqueue_ingest IS
  'Enqueues an iris_ingest message for a single source artifact. Called by per-source AFTER INSERT/UPDATE triggers. Idempotent on duplicate enqueues — workers dedupe via iris_kb_sources.last_version_hash.';

-- ── documents trigger ──────────────────────────────────────────────────────
-- Files uploaded to the project. The router (Phase 3b) classifies on the
-- way to a worker; this trigger just emits the queue message.

CREATE OR REPLACE FUNCTION public.documents_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_type TEXT := 'unclassified';
  v_version_hash TEXT;
BEGIN
  -- Best-effort classification by mime/filename. The TypeScript routeArtifact()
  -- runs again worker-side as the source of truth; this is the kickoff.
  IF NEW.mime_type IS NOT NULL THEN
    IF NEW.mime_type LIKE 'image/%' THEN v_source_type := 'photo';
    ELSIF NEW.mime_type LIKE '%spreadsheetml%' OR NEW.mime_type LIKE '%csv%' THEN v_source_type := 'spreadsheet';
    ELSIF NEW.mime_type LIKE 'message/%' THEN v_source_type := 'conversation';
    END IF;
  END IF;

  -- Use the file metadata as the version hash. If the upload pipeline writes
  -- the same content twice (same checksum) we want zero re-embed.
  v_version_hash := COALESCE(NEW.checksum, NEW.id::text || COALESCE(NEW.updated_at::text, NEW.created_at::text));

  PERFORM public.iris_enqueue_ingest(
    v_source_type,
    NEW.id::text,
    NEW.project_id,
    (SELECT org_id FROM public.projects WHERE id = NEW.project_id LIMIT 1),
    v_version_hash
  );
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER documents_iris_ingest
  AFTER INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_iris_ingest_trigger();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── rfis trigger ───────────────────────────────────────────────────────────

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
    (SELECT org_id FROM public.projects WHERE id = NEW.project_id LIMIT 1),
    v_version_hash
  );
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER rfis_iris_ingest
  AFTER INSERT OR UPDATE ON public.rfis
  FOR EACH ROW EXECUTE FUNCTION public.rfis_iris_ingest_trigger();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
