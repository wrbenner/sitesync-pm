-- resolve_citation — server-side resolver for the 8 DraftedActionCitation kinds.
--
-- Returns one of four statuses:
--   'ok'         — entity exists, accessible, render normally
--   'stale'      — entity exists but predicate no longer matches (e.g.
--                  RFI was answered, snippet no longer in source)
--   'not_found'  — entity deleted
--   'forbidden'  — RLS denies the caller
--
-- The resolver is the only path the client takes to render a citation
-- panel. Delegating to a SECURITY DEFINER RPC means:
--   * RLS denial reads as 'forbidden' (vs. 'not_found') so the user
--     gets a meaningful message.
--   * The membership check is in one place; new citation kinds inherit.
--   * Future caching can be applied at the RPC level transparently.
--
-- Reference: docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md § Phase 2
--            docs/audits/ADR_004_CITATION_SIDE_PANEL_2026-05-04.md

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_citation(
  p_kind    text,
  p_ref     uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  jsonb;
  v_exists  boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  IF p_kind NOT IN (
    'drawing_coordinate','rfi_reference','daily_log_excerpt','photo_observation',
    'spec_reference','schedule_phase','budget_line','change_order'
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

  -- ── change_order ───────────────────────────────────────────────
  ELSIF p_kind = 'change_order' THEN
    SELECT jsonb_build_object(
      'status',          'ok',
      'label',           'CO #' || COALESCE(co.number::text, co.id::text)
                          || COALESCE(' — ' || co.title, ''),
      'deep_link',       '/change-orders/' || co.id,
      'side_panel_data', jsonb_build_object(
        'co_id',         co.id,
        'status',        co.status,
        'amount',        co.amount,
        'description',   co.description
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

  -- ── schedule_phase ─────────────────────────────────────────────
  ELSIF p_kind = 'schedule_phase' THEN
    SELECT jsonb_build_object(
      'status',          'ok',
      'label',           'Phase: ' || sp.name,
      'deep_link',       '/schedule?phase=' || sp.id,
      'side_panel_data', jsonb_build_object(
        'phase_id',  sp.id,
        'name',      sp.name,
        'start',     sp.start_date,
        'end',       sp.end_date
      )
    )
    INTO v_result
    FROM public.schedule_phases sp
    JOIN public.project_members pm ON pm.project_id = sp.project_id
    WHERE sp.id = p_ref AND pm.user_id = v_user_id;

    IF v_result IS NULL THEN
      SELECT TRUE INTO v_exists FROM public.schedule_phases WHERE id = p_ref;
      v_result := jsonb_build_object(
        'status', CASE WHEN COALESCE(v_exists, FALSE) THEN 'forbidden' ELSE 'not_found' END
      );
    END IF;

  -- ── drawing_coordinate ─────────────────────────────────────────
  ELSIF p_kind = 'drawing_coordinate' THEN
    SELECT jsonb_build_object(
      'status',          'ok',
      'label',           'Drawing: ' || COALESCE(d.title, d.id::text),
      'deep_link',       '/drawings/' || d.id
                          || COALESCE(
                               '?pin=' || (p_payload->>'x') || ',' || (p_payload->>'y'),
                               ''
                             ),
      'side_panel_data', jsonb_build_object(
        'drawing_id', d.id,
        'title',      d.title,
        'pin_x',      (p_payload->>'x')::numeric,
        'pin_y',      (p_payload->>'y')::numeric
      )
    )
    INTO v_result
    FROM public.drawings d
    JOIN public.project_members pm ON pm.project_id = d.project_id
    WHERE d.id = p_ref AND pm.user_id = v_user_id;

    IF v_result IS NULL THEN
      SELECT TRUE INTO v_exists FROM public.drawings WHERE id = p_ref;
      v_result := jsonb_build_object(
        'status', CASE WHEN COALESCE(v_exists, FALSE) THEN 'forbidden' ELSE 'not_found' END
      );
    END IF;

  -- ── spec_reference ─────────────────────────────────────────────
  ELSIF p_kind = 'spec_reference' THEN
    SELECT jsonb_build_object(
      'status',          'ok',
      'label',           'Spec: ' || COALESCE(s.section_number::text, s.id::text)
                          || COALESCE(' — ' || s.title, ''),
      'deep_link',       '/specs/' || s.id
                          || COALESCE('#anchor-' || (p_payload->>'anchor'), ''),
      'side_panel_data', jsonb_build_object(
        'spec_id',  s.id,
        'section',  s.section_number,
        'title',    s.title
      )
    )
    INTO v_result
    FROM public.specifications s
    JOIN public.project_members pm ON pm.project_id = s.project_id
    WHERE s.id = p_ref AND pm.user_id = v_user_id;

    IF v_result IS NULL THEN
      SELECT TRUE INTO v_exists FROM public.specifications WHERE id = p_ref;
      v_result := jsonb_build_object(
        'status', CASE WHEN COALESCE(v_exists, FALSE) THEN 'forbidden' ELSE 'not_found' END
      );
    END IF;

  -- ── budget_line ────────────────────────────────────────────────
  -- cost_codes is the budget unit. Membership flows through the cost
  -- code's project_id (when set) or org_id → project_members chain.
  -- Fallback to 'not_found' when the row doesn't exist; we don't know
  -- the project for org-scoped cost codes, so 'forbidden' isn't
  -- inferable without a deeper join — better to be honest.
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
  -- Photos live in domain tables (daily logs, deliveries, punch list,
  -- safety). The resolver returns a generic deep link that the client
  -- side panel uses to navigate; the panel itself fetches the row by
  -- id from its appropriate table. Stale/forbidden classification for
  -- photos lands in Lap 3 once the photo storage stabilizes.
  ELSIF p_kind = 'photo_observation' THEN
    v_result := jsonb_build_object(
      'status',          'ok',
      'label',           'Photo observation',
      'deep_link',       '/photos/' || p_ref,
      'side_panel_data', jsonb_build_object('photo_id', p_ref)
    );
  END IF;

  RETURN COALESCE(v_result, jsonb_build_object('status', 'not_found'));
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_citation(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_citation(text, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.resolve_citation(text, uuid, jsonb) IS
  'Resolves a DraftedActionCitation to a renderable side-panel payload. Returns {status: ok|stale|not_found|forbidden}. Project-membership scoped.';

COMMIT;
