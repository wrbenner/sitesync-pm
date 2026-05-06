# ADR-004 — Citation Rendering Surface: Side Panel

**Status:** Accepted
**Date:** 2026-05-04
**Companion to:** `IRIS_CITATIONS_SPEC_2026-05-04.md` (this ADR was inline; promoted to standalone for citation by future specs)
**Implementation:**
- `src/components/iris/CitationPanel.tsx`
- `src/components/iris/citations/RfiCitationPanelContent.tsx`
- `src/components/iris/citations/DrawingCitationPanelContent.tsx`
- `src/components/iris/citations/GenericCitationPanelContent.tsx`
- `src/hooks/useOpenCitationPanel.ts`

## Context

Drafted-action citations are the integrity backbone of "Iris that acts." Every draft cites its sources; the user must be able to peek at any cited source and decide on the draft without leaving the inbox queue rhythm ("Approve, Approve, Approve"). The rendering surface for that peek shapes the entire inbox UX.

## Options considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Full-page navigation** (`router.push('/rfis/:id')`) | Familiar. Each entity already has its own route. | Loses inbox context. PM has to navigate back. Breaks the queue rhythm — once you're on the RFI page you're "researching," not "deciding." | Rejected |
| **Modal overlay** | In-context. Familiar pattern. | Modals can't comfortably show large surfaces (drawing pin overlays at scale, multi-page spec sections). Modals trap focus and feel heavyweight. On mobile a modal becomes full-screen anyway = same as navigation. | Rejected |
| **Side panel** | Keeps the inbox in view. Sized for content. Mobile collapses to a bottom sheet. Matches the existing `IrisDraftDrawer` UX vocabulary. | New surface to build (no existing component). Layout work for narrow viewports. | **Accepted** |
| Tooltip / popover | Lowest cost. | Can't render drawing pins, scrollable spec sections, or status pills. Wrong tool for the job. | Rejected |

## Decision

**Citations open in a right-edge side panel** that slides over the inbox. The inbox remains visible underneath; the panel is a peek, not a navigation.

### Side-panel contract

- **Width**: `min(480px, 100vw)` — desktop side panel, mobile full-width sheet.
- **Animation**: 200ms slide-in from right via framer-motion (`type: 'tween'`, `ease: 'easeOut'`).
- **Backdrop**: 35% slate at `zIndex: 70`; click-outside closes.
- **Close paths**: X button, click-outside backdrop, or Esc key.
- **Body**: kind-specific content component (`<RfiCitationPanelContent>`, `<DrawingCitationPanelContent>`, etc.). Common chrome: header (`Citation · {kind}` eyebrow + label), snippet blockquote, footer "Open in full page" link.
- **Status banner** at top of body when the resolver returns `stale`, `not_found`, or `forbidden` — never a broken-link 404, always a meaningful message.

### Routing semantics

The panel state lives in the URL as `?cite=<draftId>:<citationIndex>`. Three properties this gives us:

1. **Back-button-compatible**: closing the panel via Esc or X uses `setSearchParams(next, { replace: false })` — it pushes a history entry, so the browser's Back navigates back to the citation panel exactly as it was.
2. **Shareable**: Walker can copy the URL of an open panel and the recipient (with access) lands directly on the same citation. Useful for the soft-pilot review loop.
3. **State-locality without a global store**: the inbox already has the drafts in memory; the panel reads `(draftId, citationIndex)` from the URL and looks up the citation locally. No prop-drilling, no context, no Redux.

### Resolver flow

When the panel mounts, it calls the `resolve_citation(p_kind, p_ref, p_payload)` RPC (server-side, SECURITY DEFINER). The RPC returns one of four statuses:

- `ok` → render the body normally with `side_panel_data` injected.
- `stale` → entity exists but predicate no longer matches (RFI was answered, snippet drift) → status banner.
- `not_found` → entity deleted → status banner.
- `forbidden` → RLS blocked → status banner.

The 4th case is critical: distinguishing `forbidden` from `not_found` is what keeps the side panel honest. A user who can't see a row should be told "you don't have access" rather than "this doesn't exist."

## Consequences

**Positive.**
- The "Approve, Approve, Approve" demo rhythm holds. The panel takes < 200ms to open; closing returns the user to the same scroll position.
- Adding a new citation kind = adding a new content component + a new route entry. No layout surgery; the panel chrome is shared.
- URL-as-state means E2E tests can navigate directly to a panel without simulating clicks. (`page.goto('/iris/inbox?cite=draft-1:0')` renders the same panel.)
- Status banners give honest feedback — no broken-link UX, no silent failures.

**Negative / accepted tradeoffs.**
- Stacked panels (citation panel + IrisDraftDrawer) overlap visually if the user opens both. The current implementation gives the citation panel a higher `zIndex` so it always wins; both close on Esc. This is fine until we have a third panel; then we'd need a stack manager.
- Mobile bottom-sheet is the same component with a width override; we're not building a separate component for it. Long content on a narrow viewport scrolls within the panel — acceptable.
- The resolver is one round-trip per panel open. With React Query caching keyed on `(kind, ref)` we should rarely re-hit it within a session; if the resolver becomes hot in production we add server-side caching in Lap 3.

## Implementation status

- ✅ Side-panel host and routing.
- ✅ RFI dedicated panel.
- ✅ Drawing dedicated panel.
- ✅ Generic fallback panel covering the other 6 kinds (daily_log, change_order, spec, schedule_phase, budget_line, photo).
- 🟡 Day 39 promotes 4 of the generic-fallback kinds to dedicated panels (daily_log, change_order, spec, schedule_phase).
- 🟡 Photo + budget_line stay on the generic panel until their data shape stabilizes (Lap 3).

## References

- `docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md` — full spec; this ADR is its rendering decision.
- `src/components/cockpit/IrisDraftDrawer.tsx` — sibling slide-in pattern (drafts) we deliberately match.
- `supabase/migrations/20260504030000_resolve_citation.sql` — the resolver this panel calls.
- `supabase/migrations/20260504030001_citation_telemetry.sql` — the click-through telemetry the panel writes.
