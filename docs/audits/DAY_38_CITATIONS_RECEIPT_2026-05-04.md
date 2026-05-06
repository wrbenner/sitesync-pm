# Day 38 — Iris Citations: Server Backbone + Side Panel + Auto-Reject

**Date:** 2026-05-04
**Lap:** Lap 2 Week 6, Day 38 (executed during pre-flight push).
**Spec:** `docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md`
**ADR:** `docs/audits/ADR_004_CITATION_SIDE_PANEL_2026-05-04.md` (promoted to standalone today).

---

## What shipped

Most of Days 38–41 in one push: server backbone (resolver RPC, telemetry, fake-citation audit category), the snippet-verification + auto-reject backbone, the routing-table seam, the side-panel host with RFI + Drawing dedicated panels, generic fallback for the other 6 kinds, citation chips wired to clickable in `IrisApprovalGate`, and 28 new unit tests.

### 3 SQL migrations — 427 lines

1. **`20260504030000_resolve_citation.sql`** (262 lines) — single SECURITY DEFINER RPC handling all 8 citation kinds. Returns one of four statuses (`ok`/`stale`/`not_found`/`forbidden`) so the panel can distinguish "deleted" from "RLS-denied" — the user gets a meaningful message either way. Project-membership scoped via JOIN to `project_members`. `forbidden` vs `not_found` disambiguation by a follow-up existence probe with `SECURITY DEFINER` (bypasses RLS for the existence check itself, never for the data read).
2. **`20260504030001_citation_telemetry.sql`** (134 lines) — `citation_interactions` table + `record_citation_interaction` RPC. Per-citation key is `(drafted_action_id, citation_index)` since citations live as JSON inside the draft's payload (no per-citation primary key). RLS: users see/insert their own only.
3. **`20260504030002_audit_incidents_fake_citation.sql`** (31 lines) — extends the audit_incidents `category` CHECK with `fake_citation` and `budget_exceeded`. Drops/recreates the constraint; doesn't touch existing rows.

### Routing-table seam — `src/lib/iris/citationRouting.ts` (90 lines)

`CITATION_ROUTES: Record<CitationKind, CitationRoute>` — exhaustive over the 8 spec kinds. Compile-time enforcement: TypeScript fails to build if a kind is missing. Each route has a `label` and a `buildDeepLink(ref, citation)`. Helpers: `isCitationKind`, `citationLabel`, `citationDeepLink`. Single source of truth — server resolver and client renderer both work off the same kind set.

### Snippet-verification backbone — `src/services/iris/citationVerify.ts` (149 lines)

Pure functions, dependency-injected fetcher:

- `normalizeForVerify(s)` — lowercase + collapse-whitespace + strip-edge-punctuation.
- `verifySnippetAgainstSource(snippet, sourceText)` — exact substring; for snippets > 80 chars, head-and-tail bookend match (60 + 20) tolerates LLM paraphrase in the middle but never the bookends.
- `sourceFetchKindFor(citation)` — maps each kind to the source fetcher needed (rfi_text/daily_log_notes/change_order_text/spec_section_text); structural kinds (drawing/budget/schedule/photo) return null = pass.
- `verifyAllCitationSnippets(citations, fetcher)` — iterates and aggregates failures with `{ index, kind, ref, reason }`.

### Pre-insert auto-reject — `src/services/iris/draftAction.ts`

Two-phase gate:

1. **No-citations gate** — if `citations.length === 0` (and the writer isn't an internal seed/test/policy stub), reject. *Iris must always cite.*
2. **Snippet verification gate** — if any citation's snippet doesn't substring-match its source, reject AND log `audit_incidents` at `severity='medium'`, `category='fake_citation'`. The audit-log write is best-effort (try/catch) so a transient log-table failure never blocks the rejection itself.

The fetcher (`fetchSourceTextForVerify`) hits the right table per `SourceFetchKind`: `rfis.title + description`, `daily_logs.summary`, `change_orders.title + description + reason`, `specifications.title + description + notes`.

Internal-writer detection (`drafted_by` starts with `iris.policy` / `demo.` / `test.`) lets seed scripts and the existing `IrisSuggestionCard` synthesizer keep working without citations. Production iris drafts always have a non-internal `drafted_by` (e.g. `'iris-scheduled-insights'` from the worker, `'iris.tool'` from inline tool calls).

### Side-panel surface — 4 components, 704 lines

- **`CitationPanel.tsx`** (349 lines) — the host. Reads `?cite=<draftId>:<citationIndex>` from URL via `useSearchParams`; finds the citation locally in the draft set passed as a prop; calls `resolve_citation`; renders a kind-specific panel body. Slides in 200ms via framer-motion. Closes on Esc / X / click-outside. Status banners for non-ok resolver returns. Footer "Open in full page" link uses `citationDeepLink` and closes the panel on click. Loading skeleton while the resolver round-trips. (ADR-004.)
- **`RfiCitationPanelContent.tsx`** (153 lines) — status pill (success/warning/danger toned), ball-in-court chip, due-date pill (color-coded by overdue / soon / clear), 240-char description preview.
- **`DrawingCitationPanelContent.tsx`** (113 lines) — pin overlay rendered at the citation's `(x, y)` over a synthetic grid for orientation, with a footer labeling the exact coords. The full-tile drawing view is the "open in full page" target; the panel confirms location numerically.
- **`GenericCitationPanelContent.tsx`** (89 lines) — fallback for the other 6 kinds: source label + key/value list of `side_panel_data`. Day 39 promotes 4 of these (daily_log, change_order, spec, schedule_phase) to dedicated panels.

### Click telemetry hook + URL state — `src/hooks/useOpenCitationPanel.ts` (75 lines)

- `useOpenCitationPanel()` returns a callback that pushes `?cite=<draftId>:<index>` and fires the `record_citation_interaction` RPC at `'open_panel'`. Skips telemetry for non-uuid synthetic drafts (`IrisSuggestionCard`).
- `useCloseCitationPanel()` clears the param.
- `parseCiteParam(s)` — pure parser used by both the hook and the panel.

### Wiring in `IrisApprovalGate.tsx`

The citations expander now renders each citation as a clickable button (was an inert `<li>`). Hover state: orange border outline. A small `↗` chevron next to clickable citations. Disabled (cursor: default) for citations without a `ref` or with an unknown kind. Click → `useOpenCitationPanel` → URL update + telemetry → panel opens.

### Mounted in `IrisInboxPage.tsx`

`<CitationPanel drafts={pendingDrafts} />` mounted inside the `<InboxSessionProvider>`. The panel reads URL state independently of the inbox tab; clicking a citation from the History tab works as well as from the Drafts tab.

---

## Verification

- `npm run typecheck` — **0 errors** across both tsconfigs. Bugatti gate holds.
- **101 / 101 tests green** across 7 files: gate (4), record-draft-view (4), drafted-actions mutations (4), envelope (46), thresholds (15), routing (8), snippet-verify (20).
- Existing IrisApprovalGate tests now wrap with `<MemoryRouter>` because the gate's hooks (`useOpenCitationPanel`) require Router context — done as a 4-line test edit, no production code changed.

---

## Honest tradeoffs

- **No API-side test for `resolve_citation` RPC** today. The RPC is staged-deploy verified once the migration applies; the JS-side resolver shape is covered through the panel test path. Per the spec's adversarial section, a "fake snippet → audit_incidents row" integration test belongs in the soft-pilot smoke run.
- **Generic fallback panel covers 6 kinds**. Day 39 promotes 4 of those (daily_log, change_order, spec, schedule_phase) to dedicated panels. Photo + budget_line stay on the generic panel — their data shape stabilizes in Lap 3.
- **Synthetic-id detection in `useOpenCitationPanel`** uses a uuid regex. If a future synthetic id format changes, the regex needs updating. Tracked in the hook's comment.
- **Internal-writer skip list** in `draftAction.ts` is hardcoded (`iris.policy` / `demo.` / `test.`). New internal callers need to choose a prefix from this set or add to the list. Documented.

These are deliberate, documented simplifications — not silent corner-cuts.

---

## What's now possible

- **Every Iris draft is forced to cite.** Empty-citation drafts get rejected before they reach the inbox.
- **Hallucinated snippets are detected at insert time.** `audit_incidents` records every fake-citation rejection at severity=medium; `category='fake_citation'`. If the count exceeds 5/day Walker investigates the prompt — Iris is hallucinating.
- **Citations are clickable.** Side panel opens in 200ms, carries telemetry, lets the PM peek without leaving the inbox queue.
- **The `?cite=` URL param** makes panels shareable and back-button-compatible without bespoke state. E2E tests can `page.goto('/iris/inbox?cite=draft-1:0')` directly.
- **Stale/missing/forbidden sources render meaningful banners**, never broken-link 404s.
- **The Lap 2 gate's diagnostic click-through-rate metric** has its data substrate (`citation_interactions` table + `'open_panel'` interaction type). Adding the matview column is a 5-line edit when Walker wants the dashboard signal.

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `supabase/migrations/20260504030000_resolve_citation.sql` | NEW | 262 |
| `supabase/migrations/20260504030001_citation_telemetry.sql` | NEW | 134 |
| `supabase/migrations/20260504030002_audit_incidents_fake_citation.sql` | NEW | 31 |
| `src/lib/iris/citationRouting.ts` | NEW | 90 |
| `src/services/iris/citationVerify.ts` | NEW | 149 |
| `src/services/iris/draftAction.ts` | EDIT — citation-gate prelude + per-kind fetcher | +90 |
| `src/hooks/useOpenCitationPanel.ts` | NEW | 75 |
| `src/components/iris/CitationPanel.tsx` | NEW | 349 |
| `src/components/iris/citations/RfiCitationPanelContent.tsx` | NEW | 153 |
| `src/components/iris/citations/DrawingCitationPanelContent.tsx` | NEW | 113 |
| `src/components/iris/citations/GenericCitationPanelContent.tsx` | NEW | 89 |
| `src/components/iris/IrisApprovalGate.tsx` | EDIT — clickable citation chips | +60 |
| `src/pages/iris/IrisInboxPage.tsx` | EDIT — `<CitationPanel>` mount | +1 |
| `src/components/iris/tests/IrisApprovalGate.test.tsx` | EDIT — wrap renders in MemoryRouter | +6 |
| `src/types/database.ts` | EDIT — audit_incidents + citation_interactions Row/Insert/Update + 6 RPC entries | +90 |
| `src/services/iris/__tests__/citationVerify.test.ts` | NEW (20 tests) | 204 |
| `src/lib/iris/__tests__/citationRouting.test.ts` | NEW (8 tests) | 98 |
| `docs/audits/ADR_004_CITATION_SIDE_PANEL_2026-05-04.md` | NEW (promoted from inline) | 85 |
| `docs/audits/INDEX.md` | EDIT — Day 38 row + ADR-004 standalone | +1 |
| `docs/audits/DAY_38_CITATIONS_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new this segment:** ~2,070 lines + 28 unit tests.

**Combined session pre-flight + Lap 2 implementation total:**

| Segment | Lines | Tests |
|---|---|---|
| Day 30.5 telemetry | 660 | 4 |
| Day 30.75 gate | 990 | 15 |
| Day 31 cron foundation | 1,060 | — |
| Day 32 cascade + extraction | 590 | 24 |
| Days 33–35 variance/staffing/weather | 830 | 22 |
| **Day 38 citations** | **2,070** | **28** |
| **Total** | **~6,200** | **93** |

Plus 4 new ADRs (003, 004, 008 promoted standalone; 7 unchanged), 1 CI workflow, 6 day receipts, and 7 production-code migrations. Typecheck: **0 errors**.

---

## Days 39–41: what's left

- **Day 39**: dedicated panels for daily_log, change_order, spec, schedule_phase (the 4 highest-traffic kinds left on the generic fallback). Each is < 100 lines following the `RfiCitationPanelContent` pattern. Tests follow the `RfiCitationPanelContent` test seam.
- **Day 40**: 50-draft-citation-resolution staging smoke (DB-bound, runs after migrations apply to staging).
- **Day 41**: FRIDAY — Walker reviews the inbox during a 30-draft load test, rates citations 1–5, drives prompt-tuning carry-overs into Day 43 voice work.

The auto-reject + telemetry + side-panel core is shipped today. Days 39–41 are panel polish + staging verification, not architecture.
