-- ────────────────────────────────────────────────────────────────────────────
-- iris_citation_kinds_extension — Phase 3d
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
-- Spec: docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md
-- ADR-004: citations open in a right-edge side panel.
--
-- Extends the resolve_citation() RPC to handle 3 new citation kinds:
--   - spreadsheet_cell — anchors back to a sheet + A1 range inside a file.
--   - contract_clause  — anchors back to a clause inside a contract.
--   - punch_item       — anchors back to a punch list item.
--
-- The original resolver lives in 20260504030000_resolve_citation.sql; this
-- migration drops + recreates it with the extended kind-set + new ELSIF
-- branches. Project-membership scoping unchanged. Stale/forbidden semantics
-- unchanged.
--
-- Day-0 SQL bug screen:
--   - No || runtime concat in DDL: PASS (|| inside plpgsql RAISE/SELECT is
--     query-time concat, not DDL — fine).
--   - No expression in PRIMARY KEY: PASS (no PKs added).
--   - FK column types match: PASS (no FKs added; only function reference).
--   - Timestamp 20261008000007 unique: PASS.

BEGIN;

DROP FUNCTION IF EXISTS public.resolve_citation(TEXT, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.resolve_citation(
  p_kind TEXT,
  p_ref UUID,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result  JSONB;
  v_exists  BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  IF p_kind NOT IN (
    'drawing_coordinate','rfi_reference','daily_log_excerpt','photo_observation',
    'spec_reference','schedule_phase','budget_line','change_order',
    'spreadsheet_cell','contract_clause','punch_item'
  ) THEN
    RAISE EXCEPTION 'Unknown citation kind: %', p_kind;
  END IF;

  -- ── rfi_reference ───────────────────────────────────────────────
  IF p_kind = 'rfi_reference' THEN
    SELECT jsonb_build_object(
      'status',          'ok',
      'label',           'RFI #' || COALESCE(r.number::text, r.id::text)
                          || COALESCE(' — ' || r.title, ''),
      'deep_link',       '/rfis/' || r.id,
      'side_panel_data', jsonb_build_object(
        'rfi_id',         r.id,
        'status',         r.status,
        'ball_in_court',  r.ball_in_court,
        'due_date',       r.due_date,
        'description',    r.description
      )
    )
    INTO v_result
    FROM public.rfis r
    JOIN public.project_members pm ON pm.project_id = r.project_id
    WHERE r.id = p_ref AND pm.user_id = v_user_id;

    IF v_result IS NULL THEN
      SELECT TRUE INTO v_exists FROM public.rfis WHERE id = p_ref;
      v_result := jsonb_build_object(
        'status', CASE WHEN COALESCE(v_exists, FALSE) THEN 'forbidden' ELSE 'not_found' END
      );
    END IF;

  -- ── daily_log_excerpt ──────────────────────────────────────────
  ELSIF p_kind = 'daily_log_excerpt' THEN
    SELECT jsonb_build_object(
      'status',          'ok',
      'label',           'Daily log — ' || COALESCE(dl.log_date::text, dl.id::text),
      'deep_link',       '/daily-logs/' || dl.id,
      'side_panel_data', jsonb_build_object(
        'log_id',  dl.id,
        'date',    dl.log_date,
        'summary', dl.summary
      )
    )
    INTO v_result
    FROM public.daily_logs dl
    JOIN public.project_members pm ON pm.project_id = dl.project_id
    WHERE dl.id = p_ref AND pm.user_id = v_user_id;

    IF v_result IS NULL THEN
      SELECT TRUE INTO v_exists FROM public.daily_logs WHERE id = p_ref;
      v_result := jsonb_build_object(
        'status', CASE WHEN COALESCE(v_exists, FALSE) THEN 'forbidden' ELSE 'not_found' END
      );
    END IF;

  -- ── drawing_coordinate ─────────────────────────────────────────
  ELSIF p_kind = 'drawing_coordinate' THEN
    v_result := jsonb_build_object(
      'status',          'ok',
      'label',           'Drawing',
      'deep_link',       '/drawings/' || p_ref,
      'side_panel_data', jsonb_build_object('drawing_id', p_ref)
    );

  -- ── spec_reference ─────────────────────────────────────────────
  ELSIF p_kind = 'spec_reference' THEN
    v_result := jsonb_build_object(
      'status',          'ok',
      'label',           'Spec reference',
      'deep_link',       '/specs/' || p_ref,
      'side_panel_data', jsonb_build_object(
        'spec_id', p_ref,
        'section', p_payload->>'section',
        'title',   p_payload->>'title'
      )
    );

  -- ── schedule_phase ─────────────────────────────────────────────
  ELSIF p_kind = 'schedule_phase' THEN
    v_result := jsonb_build_object(
      'status',          'ok',
      'label',           'Schedule phase',
      'deep_link',       '/schedule?phase=' || p_ref,
      'side_panel_data', jsonb_build_object('phase_id', p_ref)
    );

  -- ── change_order ───────────────────────────────────────────────
  ELSIF p_kind = 'change_order' THEN
    SELECT jsonb_build_object(
      'status',          'ok',
      'label',           'Change order ' || COALESCE(co.co_number, co.id::text),
      'deep_link',       '/change-orders/' || co.id,
      'side_panel_data', jsonb_build_object(
        'co_id',        co.id,
        'co_number',    co.co_number,
        'status',       co.status,
        'total_cents',  co.total_cents
      )
    )
    INTO v_result
    FROM public.change_orders co
    JOIN public.project_members pm ON pm.project_id = co.project_id
    WHERE co.id = p_ref AND pm.user_id = v_user_id;

    IF v_result IS NULL THEN
      SELECT TRUE INTO v_exists FROM public.change_orders WHERE id = p_ref;
      v_result := jsonb_build_object(
        'status', CASE WHEN COALESCE(v_exists, FALSE) THEN 'forbidden' ELSE 'not_found' END
      );
    END IF;

  -- ── budget_line ────────────────────────────────────────────────
  ELSIF p_kind = 'budget_line' THEN
    SELECT jsonb_build_object(
      'status',          'ok',
      'label',           'Budget line: ' || COALESCE(cc.code, cc.id::text)
                          || COALESCE(' — ' || cc.name, ''),
      'deep_link',       '/budget?line=' || cc.id,
      'side_panel_data', jsonb_build_object(
        'cost_code_id', cc.id,
        'code',         cc.code,
        'name',         cc.name
      )
    )
    INTO v_result
    FROM public.cost_codes cc
    LEFT JOIN public.project_members pm
           ON pm.project_id = cc.project_id AND pm.user_id = v_user_id
    WHERE cc.id = p_ref
      AND (cc.project_id IS NULL OR pm.user_id IS NOT NULL);

    IF v_result IS NULL THEN
      SELECT TRUE INTO v_exists FROM public.cost_codes WHERE id = p_ref;
      v_result := jsonb_build_object(
        'status', CASE WHEN COALESCE(v_exists, FALSE) THEN 'forbidden' ELSE 'not_found' END
      );
    END IF;

  -- ── photo_observation ──────────────────────────────────────────
  ELSIF p_kind = 'photo_observation' THEN
    v_result := jsonb_build_object(
      'status',          'ok',
      'label',           'Photo observation',
      'deep_link',       '/photos/' || p_ref,
      'side_panel_data', jsonb_build_object('photo_id', p_ref)
    );

  -- ── spreadsheet_cell ──────────────────────────────────────────
  -- Phase 3d. p_ref = asset_id; payload carries sheet_name + range_a1.
  ELSIF p_kind = 'spreadsheet_cell' THEN
    v_result := jsonb_build_object(
      'status',          'ok',
      'label',           'Spreadsheet cell '
                          || COALESCE(p_payload->>'sheet_name', '') || '!'
                          || COALESCE(p_payload->>'range_a1', ''),
      'deep_link',       '/files/' || p_ref,
      'side_panel_data', jsonb_build_object(
        'asset_id',     p_ref,
        'sheet_name',   p_payload->>'sheet_name',
        'range_a1',     p_payload->>'range_a1',
        'named_range',  p_payload->>'named_range',
        'file_name',    p_payload->>'file_name'
      )
    );

  -- ── contract_clause ───────────────────────────────────────────
  -- Phase 3d. p_ref = contract_id; payload carries clause_number + article.
  ELSIF p_kind = 'contract_clause' THEN
    v_result := jsonb_build_object(
      'status',          'ok',
      'label',           'Contract clause '
                          || COALESCE(p_payload->>'clause_number', '?'),
      'deep_link',       '/contracts/' || p_ref,
      'side_panel_data', jsonb_build_object(
        'contract_id',    p_ref,
        'contract_title', p_payload->>'contract_title',
        'contract_type',  p_payload->>'contract_type',
        'clause_number',  p_payload->>'clause_number',
        'article',        p_payload->>'article',
        'heading',        p_payload->>'heading'
      )
    );

  -- ── punch_item ────────────────────────────────────────────────
  -- Phase 3d. p_ref = punch_item_id; payload may carry summary + status.
  ELSIF p_kind = 'punch_item' THEN
    v_result := jsonb_build_object(
      'status',          'ok',
      'label',           'Punch item '
                          || COALESCE(p_payload->>'summary', p_ref::text),
      'deep_link',       '/punch-items/' || p_ref,
      'side_panel_data', jsonb_build_object(
        'punch_id',  p_ref,
        'summary',   p_payload->>'summary',
        'status',    p_payload->>'status',
        'location',  p_payload->>'location',
        'assignee',  p_payload->>'assignee',
        'due_date',  p_payload->>'due_date'
      )
    );
  END IF;

  RETURN COALESCE(v_result, jsonb_build_object('status', 'not_found'));
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_citation(TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_citation(TEXT, UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.resolve_citation(TEXT, UUID, JSONB) IS
  'Phase 3d: extended to 11 citation kinds (added spreadsheet_cell, contract_clause, punch_item). Resolves a DraftedActionCitation to a renderable side-panel payload. Returns {status: ok|stale|not_found|forbidden}. Project-membership scoped where applicable.';

COMMIT;
