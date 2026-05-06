# Iris Citations Spec — Lap 2 Days 38–41

**Date:** 2026-05-04
**Status:** Spec ready. Includes ADR-004 (rendering surface) inline.
**Blocks:** Lap 2 Week 6 (Days 38–41).
**Companions:** `SCHEDULED_INSIGHTS_SPEC` (drafts that need citations), `IRIS_TELEMETRY_SPEC` (we add citation_clicked telemetry here).
**Format reference:** `LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md`.

---

## TL;DR

`DraftedActionCitation` exists with 8 `kind`s but is rendered as inert text in `IrisApprovalGate.tsx` (label + snippet, no link). This spec wires:

1. **A routing table** mapping each citation kind to a deep link (8 entries).
2. **A side-panel surface** (ADR-004) that opens when a citation is clicked, showing the source resource without leaving the inbox.
3. **A server-side resolver** that, on read, validates each citation still points to an entity the user has RLS access to. Stale citations render as `[source no longer available]` instead of broken-link 404s.
4. **A pre-insert auto-reject** for drafts that arrive without citations or with citations whose snippet doesn't substring-match the source.
5. **A click-through telemetry hook** so the Lap 2 dashboard can answer "what % of approvals involved a citation click."

---

## ADR-004 — Citation Rendering Surface

**Decision:** Citations open in a **right-edge side panel** that slides over the inbox, NOT a full-page navigation, NOT a modal.

### Options considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Full-page navigation (`router.push`) | Familiar. Each entity has its own route already. | Loses inbox context. PM has to navigate back. Breaks the "Approve, Approve, Approve" rhythm of the demo. | Rejected |
| Modal overlay | In-context. Familiar pattern. | Modals can't show large surfaces (drawing pin overlays, multi-line spec sections). Modals trap focus. Modals on mobile = full-screen anyway = same as navigation. | Rejected |
| **Side panel** | Keeps inbox in view. Sized for content. Mobile collapses to bottom sheet. Same UX vocabulary as the existing `IssueOverlay`. | New surface to build (no existing component). Layout work for narrow viewports. | **Chosen.** |
| Tooltip / popover | Lowest cost. | Can't render drawing pins or scrollable spec sections. Wrong tool. | Rejected |

### Side-panel contract

- 480px wide on desktop, full bottom-sheet on mobile (< 768px viewport)
- Slides in from right edge in 200ms
- Closes on Esc, click-outside, or X button
- Contents = whatever the citation kind's `<CitationDetail>` component renders (8 implementations, one per kind)
- Telemetry: each open fires `record_citation_view`; each entity-link click inside fires `record_citation_followthrough`

### Side-panel routing semantics

URL changes to `?cite=<draftId>:<citationIndex>` while panel is open. This makes panel state shareable + back-button-compatible without leaving the inbox. The router treats `cite` as a query param; the inbox page reads it and conditionally mounts `<CitationPanel>`.

---

## Phase 1 — Citation kind → routing table

For each of the 8 `DraftedActionCitation['kind']` values:

| Kind | What `ref` holds | Side-panel component | "Open in full page" link |
|---|---|---|---|
| `drawing_coordinate` | `drawing_id` (UUID); `x`, `y` (normalized 0–1) | `<DrawingCitationPanel>` — embeds existing `IssueOverlay` with pin at `(x,y)` | `/drawings/:drawing_id?pin=x,y` |
| `rfi_reference` | `rfi.id` | `<RfiCitationPanel>` — RFI summary + last 3 messages + ball-in-court chip | `/rfis/:id` |
| `daily_log_excerpt` | `daily_log.id` (+ optional `excerpt_offset`) | `<DailyLogCitationPanel>` — log header + scrolled to excerpt with highlight | `/daily-logs/:id#excerpt-:offset` |
| `photo_observation` | `photo.id` | `<PhotoCitationPanel>` — photo viewer + EXIF + AI classifier output | `/photos/:id` |
| `spec_reference` | `spec_section.id` (or anchor) | `<SpecCitationPanel>` — spec section text scrolled to anchor | `/specs/:id#anchor-:section` |
| `schedule_phase` | `schedule_phase.id` | `<SchedulePhaseCitationPanel>` — Gantt slice for phase + predecessors + slack | `/schedule?phase=:id` |
| `budget_line` | `budget_item.id` | `<BudgetLineCitationPanel>` — line item + variance + recent transactions | `/budget?line=:id` |
| `change_order` | `change_order.id` | `<ChangeOrderCitationPanel>` — CO summary + reason code + impact | `/change-orders/:id` |

The 8 components live in `src/components/iris/citations/`. Each is < 100 LOC because each just wraps an existing detail component.

### Why a routing table and not a switch statement

The table compiles into a single config object exported from `src/lib/iris/citationRouting.ts`. Server-side resolver and client-side renderer both read from it. New kind = new row in the table = both ends pick it up automatically. Switch statements would diverge.

---

## Phase 2 — Server-side resolver

Citations are JSON in `drafted_actions.payload.citations`. They are NOT foreign-keyed because each kind points to a different table. The resolver is a single RPC that takes a citation, returns one of:

- `{ status: 'ok', label, snippet, deep_link, side_panel_data }` — found, accessible, render normally
- `{ status: 'stale', label }` — entity exists but no longer matches predicate (e.g., RFI was answered, snippet no longer in current text). Show as "[source updated since draft created]"
- `{ status: 'not_found', label }` — entity deleted. Show as "[source no longer available]"
- `{ status: 'forbidden', label }` — RLS denied. Show as "[source not visible to you]"

### RPC signature

```sql
-- Migration: 20260504030000_resolve_citation.sql
CREATE OR REPLACE FUNCTION resolve_citation(
  p_kind TEXT,
  p_ref UUID,
  p_payload JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  CASE p_kind
    WHEN 'rfi_reference' THEN
      SELECT jsonb_build_object(
        'status', 'ok',
        'label', 'RFI #' || number || ' — ' || title,
        'deep_link', '/rfis/' || id,
        'side_panel_data', jsonb_build_object(
          'rfi_id', id, 'status', status, 'ball_in_court', ball_in_court
        )
      ) INTO v_result
      FROM rfis
      WHERE id = p_ref
        AND (
          -- RLS enforced via project membership
          EXISTS (SELECT 1 FROM project_members
                  WHERE project_id = rfis.project_id AND user_id = v_user_id)
        );

      IF v_result IS NULL THEN
        -- Distinguish "doesn't exist" from "no access"
        IF EXISTS (SELECT 1 FROM rfis WHERE id = p_ref) THEN
          v_result := jsonb_build_object('status', 'forbidden');
        ELSE
          v_result := jsonb_build_object('status', 'not_found');
        END IF;
      END IF;

    WHEN 'drawing_coordinate' THEN
      -- Similar pattern; coords come from p_payload
      ...

    -- ... 6 more cases

    ELSE
      RAISE EXCEPTION 'Unknown citation kind: %', p_kind;
  END CASE;

  RETURN v_result;
END;
$$;
```

### Caching

Resolver responses are cached client-side per `(kind, ref)` for the duration of the inbox session (`useInboxSession` from telemetry spec). Stale-while-revalidate via React Query: show cached, revalidate in background. Cache invalidates on draft approval (because the draft is now history; future citations will re-resolve fresh).

Server-side cache: none in Lap 2. Reconsider in Lap 3 if resolver becomes hot.

---

## Phase 3 — Pre-insert auto-reject

The Day 41 tracker target: "any draft without a citation is auto-rejected before hitting drafted_actions."

### Where the check fires

In `src/services/iris/draftAction.ts`, before the `INSERT`. New early return:

```ts
// Existing function header...
if (!input.citations || input.citations.length === 0) {
  return {
    ok: false,
    error: 'Draft rejected: no citations attached. Iris must always cite its sources.',
  }
}

// Substring verification (Phase 4 below)
const verification = await verifyAllCitationSnippets(input.citations, input.payload)
if (!verification.ok) {
  await logAuditIncident({
    severity: 'medium',
    category: 'fake_citation',
    description: verification.failedCitations.map(c => `${c.kind}:${c.ref}`).join(', '),
    related_entity_type: 'drafted_action',
    related_entity_id: undefined,
  })
  return {
    ok: false,
    error: 'Draft rejected: one or more citation snippets do not match source text.',
  }
}
```

### Why client-side and not DB CHECK constraint

The check needs to call out to other tables (verify the snippet is a substring of source text). DB CHECK constraints can't do cross-table queries. A trigger could, but triggers are invisible — the rejection logic should live where the call site is.

### Audit incident on failure

Every fake-citation rejection writes an `audit_incidents` row at severity `'medium'`, category `'fake_citation'`. The Lap 2 gate doesn't fail on medium incidents (only high/critical), but the Day 5:30 PM standup feed sees it. If `'fake_citation'` shows up > 5 times in a day, Walker investigates the prompt — Iris is hallucinating snippets.

---

## Phase 4 — Snippet substring verification

For each citation with a `snippet`, verify the snippet appears in the source.

### Algorithm

```ts
async function verifyCitationSnippet(c: DraftedActionCitation): Promise<boolean> {
  if (!c.snippet) return true  // citations without snippets pass (label + ref only)

  const sourceText = await fetchSourceText(c.kind, c.ref)
  if (sourceText === null) return false  // source not found

  // Normalize: lowercase, collapse whitespace, strip punctuation at edges
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/^[^\w]+|[^\w]+$/g, '')

  const haystack = norm(sourceText)
  const needle = norm(c.snippet)

  if (needle.length < 8) return true  // too short to verify meaningfully; pass

  // Exact substring match
  if (haystack.includes(needle)) return true

  // Tolerant fuzzy match: drop the snippet to its first 60 chars + last 20.
  // The middle of a long quote can drift due to model paraphrase; the bookends
  // should still match.
  if (needle.length > 80) {
    const head = needle.slice(0, 60)
    const tail = needle.slice(-20)
    if (haystack.includes(head) && haystack.includes(tail)) return true
  }

  return false
}
```

### `fetchSourceText` per kind

| Kind | Source text |
|---|---|
| `rfi_reference` | RFI title + question + last message body |
| `daily_log_excerpt` | Daily log notes text |
| `photo_observation` | Photo's AI-classifier output text |
| `spec_reference` | Spec section text at anchor |
| `change_order` | CO description + reason code text |
| `budget_line` | Budget line description (no snippet expected here usually) |
| `schedule_phase` | Phase name + notes |
| `drawing_coordinate` | Drawing title + label at coords (if any) |

If a future citation kind doesn't have meaningful source text (pure structural reference), `verifyCitationSnippet` returns `true` for citations of that kind regardless.

---

## Phase 5 — Click-through telemetry

### New columns on a new table

Citations are JSON inside `drafted_actions.payload.citations` — array, no per-citation primary key. To track clicks per citation, we use position-in-array as the key:

```sql
-- Migration: 20260504030001_citation_telemetry.sql
CREATE TABLE citation_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drafted_action_id UUID NOT NULL REFERENCES drafted_actions(id) ON DELETE CASCADE,
  citation_index   INTEGER NOT NULL,   -- 0-based position in citations array
  citation_kind    TEXT NOT NULL,      -- denormalized for easy querying
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'open_panel', 'click_through_to_full', 'copy_text')),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inbox_session_id UUID
);

CREATE INDEX idx_citation_interactions_draft
  ON citation_interactions(drafted_action_id, citation_index);
```

### Hooks

`useRecordCitationView(draftId, citationIndex, kind)` — fires when the citation chip scrolls into view (mirrors `useRecordDraftView` from telemetry spec).

`useOpenCitationPanel(draftId, citationIndex, kind)` — fires when user clicks the citation; opens the side panel; logs `'open_panel'`.

`useFollowThroughToFull(draftId, citationIndex, kind)` — fires when user clicks the "open in full page" link inside the side panel.

### Gate-relevant metric

Add to `lap_2_gate_metrics_daily` materialized view:

```sql
-- Citation click-through rate: % of approved drafts where the user
-- clicked at least one citation before deciding.
COUNT(DISTINCT da.id) FILTER (
  WHERE da.status IN ('approved', 'executed')
    AND EXISTS (
      SELECT 1 FROM citation_interactions ci
        WHERE ci.drafted_action_id = da.id
          AND ci.interaction_type = 'open_panel'
          AND ci.occurred_at < da.decided_at
    )
) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE da.status IN ('approved', 'executed')), 0)
  AS citation_click_pct
```

This isn't a gated metric, but it's the most diagnostic signal we'll have for "is the user trusting Iris" vs. "is the user verifying every claim." Healthy band: 20–50% per the gate spec.

---

## Test plan

### Unit (Vitest)

- `verifyCitationSnippet`: 10 test cases covering exact match, fuzzy bookend match, too-short pass, mismatch fail, empty snippet pass
- Citation routing table is exhaustive over `DraftedActionCitation['kind']` (compile-time + runtime check)
- `<CitationPanel>` renders the right component for each kind
- `useOpenCitationPanel` updates URL with `?cite=` param

### Integration (Postgres)

- `resolve_citation` returns `'forbidden'` (not `'not_found'`) when the row exists but RLS blocks
- `resolve_citation` returns `'not_found'` when the row was deleted
- `resolve_citation` returns `'stale'` when the snippet no longer matches source

### E2E (Playwright)

- Click an RFI citation → side panel opens with RFI summary
- Click "open in full page" inside side panel → navigates to `/rfis/:id`
- Open inbox with a draft whose RFI was deleted → citation renders as `[source no longer available]`; approve still works
- Approve a draft after clicking 1 of 3 citations → `citation_interactions` has 1 row with `interaction_type='open_panel'`
- Try to insert a draft via the API with an empty citations array → server returns 4xx with the right error

### Adversarial

- Create a draft with a fake snippet (one that doesn't appear in the source RFI). Insert via internal RPC. Verify the rejection fires + `audit_incidents` row exists.

---

## File-by-file changelog

| Path | Change |
|---|---|
| `supabase/migrations/20260504030000_resolve_citation.sql` | NEW — resolver RPC |
| `supabase/migrations/20260504030001_citation_telemetry.sql` | NEW — interactions table |
| `src/lib/iris/citationRouting.ts` | NEW — kind → component + URL table |
| `src/components/iris/CitationPanel.tsx` | NEW — side-panel host |
| `src/components/iris/citations/RfiCitationPanel.tsx` | NEW |
| `src/components/iris/citations/DrawingCitationPanel.tsx` | NEW |
| `src/components/iris/citations/DailyLogCitationPanel.tsx` | NEW |
| `src/components/iris/citations/PhotoCitationPanel.tsx` | NEW |
| `src/components/iris/citations/SpecCitationPanel.tsx` | NEW |
| `src/components/iris/citations/SchedulePhaseCitationPanel.tsx` | NEW |
| `src/components/iris/citations/BudgetLineCitationPanel.tsx` | NEW |
| `src/components/iris/citations/ChangeOrderCitationPanel.tsx` | NEW |
| `src/components/iris/IrisApprovalGate.tsx` | EDIT — citations rendered as clickable chips; wire the 3 new hooks |
| `src/services/iris/draftAction.ts` | EDIT — add the no-citations + fake-snippet pre-insert checks |
| `src/services/iris/citationVerify.ts` | NEW — `verifyCitationSnippet` + per-kind `fetchSourceText` |
| `src/hooks/useOpenCitationPanel.ts` | NEW |
| `src/hooks/useRecordCitationView.ts` | NEW |
| `src/hooks/useFollowThroughToFull.ts` | NEW |
| `e2e/iris-citations.spec.ts` | NEW — E2E tests above |

---

## Acceptance criteria for this spec to be considered "shipped"

1. All migrations apply
2. Routing table exhaustive (CI assertion)
3. Side panel opens for all 8 kinds without TypeScript errors
4. Stale + not_found + forbidden statuses each render a non-broken UI
5. Empty-citations draft rejected at insert
6. Fake-snippet draft rejected at insert with audit incident
7. `citation_click_pct` appears in the gate metrics view

---

## Day-by-day mapping to the tracker

| Tracker day | What ships |
|---|---|
| Day 38 | Routing table + 4 of 8 panel components (rfi, daily_log, drawing, photo) + side-panel host |
| Day 39 | Remaining 4 panel components (spec, schedule_phase, budget_line, change_order) + telemetry hooks |
| Day 40 | Resolver RPC + verifyCitationSnippet + the 50-draft-citation-resolution test |
| Day 41 | Pre-insert auto-reject live in `draftAction.ts`; FRIDAY |

---

## What this spec deliberately does NOT cover

- Voice-style enforcement on citation snippet text (covered by `IRIS_VOICE_GUIDE_SPEC`)
- The decision of *which* citations to attach to a given draft kind (the detector + prompt design — already in `SCHEDULED_INSIGHTS_SPEC` and the existing `templates.ts`)
- Citation editing (user-facing "wrong source, fix it" — Lap 3)
- Multi-citation reasoning chains (e.g., "RFI A cited Drawing B which cited Spec C") — Lap 3
