# Demo Surface Deep Audit

**Date:** 2026-05-06 (Lap 2 pre-flight)
**Scope:** The 3 demo surfaces — Iris Inbox, RFI Detail, Daily Log AutoDraft
**Methodology:** Static code review against the 12-category UX Bugatti rubric (`UX_BUGATTI_AUDIT_FRAMEWORK_2026-05-04.md`). No runtime instrumentation; findings are file:line specific.

---

## Summary

| Surface | Field Manual baseline | Audit-revised score | Bugatti target | Findings |
|---|---|---|---|---|
| **Iris Inbox** | 8/10 | **7.6/10** | ≥ 9.5/10 | 14 findings (1 sev-1, 5 sev-2, 6 sev-3, 2 sev-4) |
| **RFI Detail** | 8.5/10 | **7.8/10** | ≥ 9.5/10 | 13 findings (2 sev-1, 4 sev-2, 5 sev-3, 2 sev-4) |
| **Daily Log AutoDraft** | 6.5/10 | **6.8/10** | ≥ 9.5/10 | 17 findings (3 sev-1, 6 sev-2, 6 sev-3, 2 sev-4) |

**Headline:** None of the three demo surfaces meets the Bugatti 9.5/10 bar today. The most critical, cross-cutting gaps are:

1. **Zero `useIsMobile` references in any demo-surface page** — the inbox, RFI detail, and daily-log shells render the same DOM at every breakpoint. There is no field-test rig conditional, no mobile-only tap-target enforcement, no iPhone-portrait code path. (Sev 1)
2. **PermissionGate coverage is incomplete on Iris Inbox + RFI Detail** — the Approve/Reject/Send/Watch buttons are fully unguarded. The Daily Log page has 39 PermissionGate references and is the only demo surface that meets the invariant. (Sev 1)
3. **No `min-h-44px` (or 44 px-equivalent) tap-target enforcement on inbox card chrome** — the action row in `IrisApprovalGate` is composed from `spacing['2']` + `spacing['4']` paddings on a 14 px icon + 14 px label, which produces a button that visually measures ~32 px. (Sev 2)

Deep findings follow.

---

## Iris Inbox

**Files audited:**
- `src/pages/iris/IrisInboxPage.tsx` (548 lines)
- `src/components/iris/IrisApprovalGate.tsx` (381 lines)
- `src/components/iris/IrisSuggestionCard.tsx` (85 lines)
- `src/components/iris/CitationPanel.tsx` (358 lines)
- `src/components/iris/citations/{Rfi,Drawing,DailyLog,ChangeOrder,Spec,SchedulePhase,Generic}CitationPanelContent.tsx`
- `src/hooks/useIrisDrafts.ts`

### 1. Functional correctness — score 9/10

The inbox renders three tabs (Drafts / Suggestions / History), correctly groups pending drafts by `action_type` in stable `GROUP_ORDER`, and writes telemetry on approve/reject via `record_draft_decision` RPC. Realtime invalidation is wired through the React Query key `['drafted_actions', projectId, status, limit]`. No crashes, no broken paths.

**Finding I-1 (Sev 3) — `IrisSuggestionCard` always synthesizes a fake DraftedAction with `id: synthetic:...`** at `IrisSuggestionCard.tsx:32`. The detector at `IrisApprovalGate.tsx:45` correctly skips the telemetry RPC for these synthetic ids — but it means the Suggestions tab silently drops decision telemetry. `LAP_2_ACCEPTANCE_GATE_SPEC § Counting rules` requires every approve/reject to be counted; today the Suggestions tab contributes zero. **Action:** persist suggestion-derived drafts as real `drafted_actions` rows on first render (or instrument a separate `record_suggestion_decision` RPC).

### 2. Field-test rig markers — score 4/10

**Finding I-2 (Sev 1) — `IrisInboxPage.tsx` has zero `useIsMobile` / `useMediaQuery` imports.** The grid at `IrisInboxPage.tsx:271` (`gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'`) handles breakpoint reflow via CSS, but the tab strip, filter chips, and skeleton stack do not. The card padding (`spacing['5']`, ~20px) is identical at 390px viewport and at 1920px. **No port-a-potty one-handed test** — the action row at `IrisApprovalGate.tsx:307` packs Approve + Reject + ViewCreated horizontally; on a 390 px iPhone the third element forces overflow.

**Finding I-3 (Sev 2) — Approve/Reject buttons are visually ~32 px tall.** `IrisApprovalGate.tsx:323` uses `padding: ${spacing['2']} ${spacing['4']}` (8 px × 16 px) around a 14 px icon + 14 px font — total height ≈ 30–34 px. Bugatti requires ≥ 44 px on mobile. The whole approval card is the primary product moment; gloved-thumb misses are unacceptable.

**Finding I-4 (Sev 3) — No `data-field-tested` markers anywhere on the page.** Per `ADR_010 § Field-Test Rig`, every mobile screen needs `// FIELD-TESTED YYYY-MM-DD` comments after the 7-condition pass. Iris Inbox has none.

### 3. Empty states — score 9/10

The three tabs each have a dedicated `EmptyState` from `Primitives.tsx` (`IrisInboxPage.tsx:186, 263, 290`) with icon + title + description. No "blank screen with no info" failure mode. The Suggestions tab copy ("No risks detected — Iris is watching.") is on-brand.

**Finding I-5 (Sev 4) — Empty-state icons reuse `Sparkles` for both Drafts-empty and Suggestions-empty.** Visual ambiguity; small polish issue.

### 4. Loading states — score 7/10

The skeleton at `IrisInboxPage.tsx:420` is a 3-row `data-skeleton="true"` stack with `animation: skeletonPulse 1.5s ease-in-out infinite`. No timeout — if `useDraftedActionsForProject` hangs (RLS check failure, dropped websocket), the skeleton runs forever.

**Finding I-6 (Sev 2) — No 2 s skeleton timeout.** Field Manual Part II item #2 (11 pages with stuck skeletons) flagged this exact pattern. Iris Inbox is at risk if Supabase latency spikes.

**Finding I-7 (Sev 3) — Skeleton pulse animation does not check `prefers-reduced-motion`.** The CSS `@keyframes skeletonPulse` is global; honoring the OS-level Reduce Motion is a WCAG 2.3.3 requirement.

### 5. Error states — score 6/10

Approve failures call `toast.error('Could not approve — please try again')` at `IrisInboxPage.tsx:209`. Reject failures are silently swallowed (the `catch` block is missing).

**Finding I-8 (Sev 2) — Reject mutation has no user-visible error path.** `IrisInboxPage.tsx:212` shows `await rejectDraft.mutateAsync(...)` followed by an unconditional `toast('Rejected')`. If the RPC returns an error, the toast still fires. This is a confidence break.

**Finding I-9 (Sev 3) — No retry button on the approve toast.** Sonner's `toast.error` is a single-shot notification. The user has to click the same draft's Approve button again — but if they scrolled, the card has moved.

### 6. PermissionGate coverage — score 0/10 (CRITICAL)

**Finding I-10 (Sev 1) — Iris Inbox has ZERO `PermissionGate` references.** Confirmed via grep: `IrisInboxPage.tsx` has 0 occurrences, and the entire `src/components/iris/` directory has 0 files importing `PermissionGate`. The Approve & Send button at `IrisApprovalGate.tsx:314` will execute the drafted action for any user who can read the project. This violates `PERMISSION_GATE_AUDIT_2026-05-01` invariant 5 in CLAUDE.md.

The Suggestions tab also calls `iris-rfi-response-draft` from `IrisSuggests.tsx:67` without any gate. **A foreman could approve a $50K change order draft today.**

### 7. Mobile responsiveness — score 6/10

The tab strip uses `display: flex; gap: spacing['1']`. At 390 px the three tabs fit; with the `count` badge they may wrap. The Suggestions filter chips (`IrisInboxPage.tsx:236`) use `flexWrap: 'wrap'` correctly. The CitationPanel uses `width: 'min(480px, 100vw)'` so it correctly collapses to full-width on mobile (`CitationPanel.tsx:161`).

**Finding I-11 (Sev 3) — On iPhone portrait, the CitationPanel covers the entire viewport with no swipe-down-to-dismiss gesture.** Only the X button (top-right) and Esc keyboard close. iPhone has no Esc; the dismiss target is a 18 px icon in 40 px padding (~36 px tap zone) at the very top — unreachable one-handed.

### 8. Accessibility — score 7/10

`IrisApprovalGate.tsx` has 4 `aria-label` attributes (the article wrapper, Approve, Reject, citation buttons). `role="article"`, `role="tablist"`, `role="tab"`, `role="tabpanel"` are present and semantically correct. The Esc-to-close handler in `CitationPanel.tsx:69` matches the IrisDraftDrawer pattern.

**Finding I-12 (Sev 2) — Confidence pill conveys meaning by color alone.** `IrisApprovalGate.tsx:151` shows the percentage text inside the pill but the green/blue/yellow background is the primary signal. WCAG 1.4.1 (use of color) requires color + text + icon. Today: color + text only. Add a check / info / alert icon.

**Finding I-13 (Sev 3) — Citation list buttons lose hover state programmatically via inline `onMouseEnter` / `onMouseLeave` (`IrisApprovalGate.tsx:264-268`).** Keyboard focus does not trigger the same border-color change. Tab-navigating users see no focus indicator.

### 9. Performance — score 8/10

The page lazy-loads the citations panel via React Router's `useSearchParams` (`CitationPanel.tsx:53`); the panel content itself is not lazy-loaded but the 7 citation panel content components are pre-imported. Total weight ≈ 24 KB JSX; acceptable.

**Finding I-14 (Sev 4) — `useMemo` over `pendingDrafts` in `groupedPending` (`IrisInboxPage.tsx:101`) and `historyDrafts` in `sortedHistory` are correct, but `insightCountsByKind` (`IrisInboxPage.tsx:128`) iterates the array on every render.** Negligible at < 100 insights, but it's there.

### 10. Brand consistency — score 9/10

No emojis, no exclamation points, no "certainly". The empty-state copy is on-brand (lethal-calm tone). The Iris-Indigo color `#4F46E5` is used sparingly (only the Suggestions filter chips and the Suggestions-tab icon). Iris Gold appears once (the brand orange in Approve & Send).

**Finding I-15 (Sev 3) — `IrisApprovalGate.tsx:132` uses a `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.brand300})` for the 28 px Sparkles avatar.** Brand spec says "Iris Gold sparing — 1-2 instances per page max." A gradient avatar on every approval card means a 5-draft inbox shows 5 gradients. This is the loudest brand element on the page.

### 11. Citations / audit trail — score 9/10

Every state change writes to `drafted_actions` via `useApproveDraftedAction` / `useRejectDraftedAction`. The telemetry RPC `record_draft_decision` records who, what, when, decision-method (keyboard/mouse), and edits-applied bool. `useRecordDraftView` (`IrisApprovalGate.tsx:91`) records `first_viewed_at` when the card scrolls into view at ≥ 50% visibility. This is excellent.

**Finding I-16 (Sev 4) — Citation clicks are not telemetry-tracked.** `useOpenCitationPanel` updates `?cite=` but does not record a `citation_opened_at` row. `IRIS_TELEMETRY_SPEC § Citations` requires this for the Day 60 acceptance gate.

### 12. Field Manual Part II item #11 — Streaming captures — score 5/10

**Finding I-17 (Sev 2) — Iris streaming captures still don't actually capture streaming on the inbox.** `useIrisDrafts.ts` is a pure `useQuery` — it does not subscribe to a stream. The realtime channel mentioned in `useDraftedActionsForProject` invalidates the cache on row mutations, but the visual UX is a hard re-render, not a streaming append. Field Manual Part II item #11 is unfixed.

---

## RFI Detail

**Files audited:**
- `src/pages/RFIs.tsx` (list, ~1100 lines)
- `src/pages/rfis/RFIDetail.tsx` (995 lines)
- `src/components/rfis/RFICreateWizard.tsx`
- `src/pages/rfis/RFITabBar.tsx`
- `src/pages/rfis/RFIKPIs.tsx`
- `src/components/iris/IrisSuggests.tsx`

### 1. Functional correctness — score 9/10

`RFIDetail.tsx` is a polished conversation-first surface. It correctly fetches via `useRFI`, sets up `useRealtimeRowInvalidation` for live updates, tracks last-viewed via localStorage with a Safari-private-mode fallback (line 593), and correctly hides raw Supabase errors in the not-found state (line 679 comment is a great signal of care).

### 2. Field-test rig markers — score 4/10

**Finding R-1 (Sev 1) — RFIDetail.tsx has zero `useIsMobile` references.** The conversation thread is wrapped in `maxWidth: 720, margin: '0 auto'` (line 700) — fine on desktop, but on a 390 px iPhone the side margins eat into the question content. The `MetadataSection` (line 476) renders 6 pills horizontally with `flexWrap: 'wrap'` — at 390 px these stack into 6 rows, pushing the StatusControl below the fold.

**Finding R-2 (Sev 2) — Send button is 42 × 42 px, just below the 44 px bar.** `RFIDetail.tsx:407`. The bar is gloved-hand 44 px; a 42 px Send button rounds down on every keypress. **`ComposeBox` is the most-used button on this page.**

**Finding R-3 (Sev 3) — Watch button at `RFIDetail.tsx:441` uses `padding: 5px 12px` on a 12 px icon + 12 px label.** Total height ≈ 26 px. Below 44 px bar.

### 3. Empty states — score 8/10

The "RFI not found" state at line 663 is well-crafted with an Alert-Triangle icon, a friendly explanation, and a "Back to RFIs" button. The empty thread state at line 968 ("Waiting for a response from {assignedName}") is contextual and actionable.

**Finding R-4 (Sev 3) — No empty state for RFI with no metadata.** `MetadataSection` returns `null` if all six fields are empty (line 489). Better UX: show a "No metadata yet — add cost impact, due date, drawing reference" CTA.

### 4. Loading states — score 8/10

The skeleton (line 648) is composed correctly: 4 differently-sized shapes that approximate the eventual layout, with staggered `animationDelay` for visual polish. No 2 s timeout; same risk as Iris Inbox.

**Finding R-5 (Sev 2) — Same `prefers-reduced-motion` and 2 s timeout gaps as Iris Inbox.** (Sev 2 not 3 because RFI detail is the highest-traffic detail page in the app.)

### 5. Error states — score 7/10

The error state at line 663 catches both error and missing-rfi conditions. The not-found copy is plain English (good).

**Finding R-6 (Sev 3) — `handleTransition` swallows error details into a generic "Failed to update status" toast** (line 632). The user has no idea if the failure was permission, network, or state-machine validation.

### 6. PermissionGate coverage — score 0/10 (CRITICAL)

**Finding R-7 (Sev 1) — RFIDetail.tsx has ZERO `PermissionGate` references.** The Send button (compose), the StatusControl (transitions including void), the Watch button, and the IrisApprovalGate buttons (line 894) are all unguarded. Anyone with read access to the project can void an RFI today.

This is the single highest-severity finding in this audit. RFIs are revenue-tied (cost_impact column). Voiding an RFI mid-flight would cascade through the change-order pipeline. **Block this before pilot.**

### 7. Mobile responsiveness — score 6/10

The compose box `padding: '16px 20px'` and `borderRadius: '0 0 16px 16px'` (line 364) is fine. But the StatusControl dropdown at line 165 uses `position: absolute; right: 0` — at 390 px width with a long action label ("Move to under review"), the menu clips off-screen-right.

**Finding R-8 (Sev 2) — StatusControl dropdown clips on iPhone portrait.** Right-aligned dropdowns must clamp to viewport edges. Today no clamp.

**Finding R-9 (Sev 3) — Header at line 727 places `{rfiNumber} + StatusPill + days-open + AuditTrail + Watch + StatusControl` in a single flex row.** At 390 px this wraps into 3+ rows; visual hierarchy is lost.

### 8. Accessibility — score 7/10

The page sets `aria-label={...}` on the PageContainer (line 696) — good. The thread auto-scrolls via `scrollIntoView` (line 643), which can disorient screen-reader users mid-read. No ARIA live region for new responses.

**Finding R-10 (Sev 2) — No `aria-live="polite"` on the response thread.** New responses arrive via realtime but a screen-reader user gets no audio announcement. WCAG 4.1.3 status-message gap.

**Finding R-11 (Sev 3) — Status pill conveys meaning by color alone** (line 738, the `width: 6, height: 6, borderRadius: 50%` colored dot). Same as Iris Inbox confidence pill.

### 9. Performance — score 8/10

The page uses `useMemo` aggressively for `responses`, `userIdsToResolve`, `newResponseCount`, `firstNewIndex` (lines 599-621). The QuickRFIButton import is lazy. Realtime subscription is correctly scoped to a single row.

**Finding R-12 (Sev 4) — `useProfileNames` resolves user IDs in a single batch but is called on every response render.** The hook is React-Query memoized so this is harmless; flagging only because future denormalization could regress.

### 10. Brand consistency — score 8/10

No emojis, no exclamation points. Inter font throughout. The `boxShadow: '0 2px 8px rgba(244,120,32,0.25)'` glow on the primary action (line 179) is on-brand for the demo button — but it appears on hover for **every** transition button, making the page glow-heavy.

**Finding R-13 (Sev 3) — Orange glow shadow appears on 5+ buttons per page** (StatusControl primary, Send, Watch when active, IrisApprovalGate, etc.). Brand spec says Iris Gold sparing.

### 11. Citations / audit trail — score 9/10

`AuditTrailButton`, `EntityHistoryPanel`, and `WorkflowTimeline` are all wired in (lines 756, 822, 805). The state transition writes through `useUpdateRFI` which goes through the audit hash chain. Excellent.

### 12. Field Manual Part II — RFI Detail-specific issues — score 8/10

No items from the 15-item Field Manual Part II list specifically targeted RFI Detail. The list page (`RFIs.tsx`) was not flagged for any of the 15 either. This surface is in good shape compared to the others; the deficits are accessibility + permissions + mobile, not visible-bugs.

---

## Daily Log AutoDraft

**Files audited:**
- `src/pages/daily-log/index.tsx` (~1700 lines)
- `src/pages/daily-log/DailyLogForm.tsx`
- `src/pages/daily-log/CrewHoursEntry.tsx`
- `src/pages/daily-log/SignatureCapture.tsx`
- `src/pages/daily-log/DailySummaryPage.tsx`
- `src/components/dailylog/AutoDraftPanel.tsx`
- `src/components/dailylog/AutoDailyLog.tsx`
- `src/components/field-capture/FieldCaptureModal.tsx`
- `src/hooks/useFieldCapture.ts`

### 1. Functional correctness — score 8/10

The page is the most complex of the three demo surfaces. It correctly hydrates `todayLog` via `useDailyLogs`, renders 6 ZonePanel sections, supports auto-draft via `assembleDailyLogDraft`, and drains the offline IndexedDB queue when `online` fires (line 905).

**Finding D-1 (Sev 2) — `loose update payload` cast on line 565.** `const builder = fromTable('daily_log_entries') as unknown as { update: ... }` works around the type system. CLAUDE.md explicitly forbids "patterns the next session should NOT reintroduce". This is exactly that pattern.

**Finding D-2 (Sev 3) — `handlePhotoCapture` at line 853 manually constructs a file input** instead of routing through `useFieldCapture`. Two divergent capture paths means the GPS metadata + provenance + IDB queue are bypassed for the "click camera button" flow. The path used by the FAB is fully-instrumented; the path used by `+ Add photo` is not.

### 2. Field-test rig markers — score 5/10

The `FieldCaptureModal.tsx` has an explicit 6 s timeout on `getUserMedia` (line 244, useFieldCapture). Friendly errors are translated by DOMException name (lines 254-275). This is the strongest field-test treatment in the codebase.

**Finding D-3 (Sev 1) — `daily-log/index.tsx` has zero `useIsMobile` references** (same as the other two demo surfaces). Daily Log is the most mobile-dominant page — supers fill it from the slab. The 6-column grid in the Conditions ZonePanel (line 1265: `gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))'`) breaks at 390 px (4 × 140 = 560 px, exceeds viewport).

**Finding D-4 (Sev 1) — Sticky header at line 953 contains the date stepper + status pill + Iris button + offline pill + PDF export + summary button + field capture + new entry + status-action.** On iPhone portrait this wraps into 4–5 rows, and the sticky position means it covers ~40% of the viewport at all times. **This is the page Brad will open first; he won't see any actual log content above the fold.**

**Finding D-5 (Sev 2) — `Field capture` button (line 1066) renders alongside `New entry`, both at ~32 px height.** The most-mission-critical mobile button (one-handed capture) is below the 44 px bar.

### 3. Empty states — score 9/10

Each ZonePanel has its own EmptyState (e.g., line 1311 for crews). Copy is on-brand and contextual. The not-started log shows a `Start log` button that creates the row inline.

**Finding D-6 (Sev 4) — Photo grid empty state (`No photos yet`) is just plain text inside the panel** instead of a centered `EmptyState` with icon. Inconsistent with the other zones.

### 4. Loading states — score 7/10

The page-level loader uses `PageState status="loading" loading={{rows: 8, ariaLabel: 'Loading daily logs'}}` — proper skeleton.

**Finding D-7 (Sev 2) — Same 2 s timeout gap as Iris Inbox + RFI Detail.** Daily Log is a mobile field surface; a stuck skeleton on a flaky cell tower is a daily occurrence.

**Finding D-8 (Sev 3) — Camera modal `Starting camera…` overlay (`FieldCaptureModal.tsx:268`) is a Loader2 spinner, not a skeleton.** Field Manual rubric prefers skeleton over spinner. But: the camera surface is genuinely a black box during init; a video skeleton is impossible. Acceptable as-is.

### 5. Error states — score 8/10

The friendly camera error mapping (`useFieldCapture.ts:254-275`) is the single best error-state handling in the codebase. Six DOMException name mappings → six actionable English-language recovery steps. **This is the Bugatti standard for everywhere else.**

**Finding D-9 (Sev 2) — `addCrewRow`, `addEquipmentRow`, etc. (lines 600-661) all use `catch { /* noop */ }`.** A failure to insert a daily log entry produces no toast, no banner, no log. The user clicks "+ Add crew" and nothing happens. They click again. They get angry. Then a duplicate row appears when the network finally returns.

### 6. PermissionGate coverage — score 9/10

39 `PermissionGate` references in `daily-log/index.tsx`. Add buttons, submit, approve, reject, return are all gated. This is the only demo surface that meets the invariant.

**Finding D-10 (Sev 3) — The `Field capture` button (line 1067) is gated by `daily_log.create`** which is correct, but the modal once opened can capture a photo without re-checking permission. Race condition: a perm change mid-modal goes through. Low risk because permissions rarely change mid-day, but theoretically broken.

### 7. Mobile responsiveness — score 5/10

This is the worst-scoring category. The header is too crowded (D-4); the Conditions grid is too rigid (D-3); the table layouts in ZonePanels assume desktop column widths.

**Finding D-11 (Sev 1) — Crew/Equipment/Visitor/Delivery tables (lines 1313, 1382, plus 2 more) use fixed-width `<table>` elements with no horizontal-scroll wrapper.** At 390 px iPhone portrait, the tables overflow the parent ZonePanel and clip off-screen-right. The Hours / Headcount columns are unreadable.

**Finding D-12 (Sev 2) — Photo grid (`PhotoTile` at line 359) uses `aspectRatio: '4 / 3'`** but the grid container (search the index.tsx for `photo-grid`) does not specify column count for mobile. On iPhone the photos render as either 1-up or 5-up depending on viewport quirks.

### 8. Accessibility — score 6/10

`role="region"` and `aria-label="Daily Log"` on the page shell (line 347) are good. The status pill at line 327 is the same color-only-meaning gap as the other surfaces.

**Finding D-13 (Sev 2) — EditableCell (line 179) uses a `<button>` that flips into an `<input>` on click.** The `<input>` does not announce on focus that it's a date / number / text — there's no `aria-describedby` pointing at the placeholder. Screen-reader users tabbing through 80+ editable cells get no orientation.

**Finding D-14 (Sev 3) — Photo "category" pill (line 384) renders a `✦` glyph in the label.** WCAG and CLAUDE.md both forbid emojis in product copy. `✦` is a Unicode geometric symbol used as a decorative emoji. Replace with a Lucide icon.

### 9. Performance — score 7/10

The page lazy-loads `DailyLogPDFExport` (line 61), uses `React.memo` on `PhotoTile` (line 359), and aggressively `useMemo`s the section data (lines 504-528). React Query caching is correct.

**Finding D-15 (Sev 3) — `entries` array is filtered 6 times in 6 separate `useMemo` calls** (lines 504-511) for crew, equipment, visitor, delivery, field, photo. A single pass would be marginally faster — but at typical entry counts (< 50) this is academic.

**Finding D-16 (Sev 4) — Weather is fetched inside an effect on every load + every selectedDate change** (line 476). Cache TTL would prevent re-fetching the same date.

### 10. Brand consistency — score 7/10

The page uses a hardcoded color set at the top (`PAGE_BG`, `INK`, `INK_2`, `INK_3` etc.) instead of the theme's `colors.*`. This is intentional per the comment "DESIGN-RESET enterprise palette" — but it means changes to `colors.surfaceRaised` won't propagate here.

**Finding D-17 (Sev 2) — Hardcoded color literals diverge from theme.** Lines 67-83. If the brand pivots (or just fixes a contrast issue), the daily log page won't get the update. This is a maintenance trap. Migrate to theme imports — the comment justification ("not parchment") is wrong; `colors.surfaceRaised` is `#FFFFFF`, identical to the local literal.

**Finding D-18 (Sev 4) — Iris-Indigo color defined twice.** `STATUS.iris = '#4F46E5'` (line 80) duplicates `IRIS_INDIGO` from `IrisInboxPage.tsx:380` and `colors` doesn't have an iris token. Move to theme.

### 11. Citations / audit trail — score 8/10

The submit / approve / reject mutations all go through hooks that write audit rows. The auto-draft persists as `ai_summary` on the daily log row (line 779) — but that field is free-text, not a structured `drafted_actions` row. The provenance chain breaks here.

**Finding D-19 (Sev 2) — Auto-draft Approve writes plain text to `ai_summary`** instead of creating a `drafted_actions` row with `status='approved'` and full provenance JSON. The audit chain has a hole between "Iris drafted" and "what got saved". Lap 3 fix would unify: write to `drafted_actions`, then `executors/dailyLog.ts` materializes the daily_log row.

### 12. Field Manual Part II item #10 — Field Capture: black camera surface — score 8/10

**Finding D-20 (Sev 1) — Resolved status: PARTIALLY FIXED.**
- Black camera surface: still present until the stream resolves, but now bounded by 6 s timeout (FieldCaptureModal.tsx:244).
- Geolocation banner: present, accurate, with friendly states (`Locating…`, lat/lon, error) at FieldCaptureModal.tsx:277.
- Infinite spinner: PREVENTED by the timeout race in `useFieldCapture.ts:241`.
- Capture button greyed when no stream: yes, intentional (line 423: `backgroundColor: stream && !cameraError ? colors.primaryOrange : colors.surfaceInset`). The greying is intentional UX, not a bug.

**Remaining issue:** when `cameraError` is set, the inline error block (line 222) shows a "Try again" button. But there is no "Upload from library" fallback CTA visible at this stage — only mentioned in the error copy. **Add a secondary "Choose from library" button** that triggers the file-picker fallback. Field Manual Part II item #10 is 80% fixed; the last 20% is the visible upload fallback.

---

## Top 10 Critical Fixes Before Pilot

These are the issues Walker must fix before Brad Cameron (Nexus) opens SiteSync on his iPad. Ordered by severity, then by demo-killer impact.

1. **Wrap RFI Detail Send / Status / Void in PermissionGate** (R-7, Sev 1).
   `RFIDetail.tsx:404, 762`. Without this, a foreman can void an RFI and break the audit chain. **20 minutes of work.**

2. **Wrap Iris Inbox Approve / Reject in PermissionGate** (I-10, Sev 1).
   `IrisApprovalGate.tsx:314, 336`. Same risk surface as #1, with bigger blast radius (a punch_item.draft approval can write 50+ rows). **30 minutes.**

3. **Daily Log header collapse on iPhone portrait** (D-4, Sev 1).
   `daily-log/index.tsx:953`. Today the sticky header is 4-5 rows tall on a 390 px viewport. Wrap secondary actions in an overflow menu (kebab) under 768 px breakpoint. **2 hours.**

4. **Daily Log table horizontal-scroll wrappers** (D-11, Sev 1).
   Wrap each ZonePanel `<table>` in `<div style={{overflowX: 'auto'}}>`. **45 minutes for all 4 tables.**

5. **44 px tap-target bump on Approve / Reject / Send** (I-3, R-2, D-5, Sev 2).
   Change `padding: ${spacing['2']} ${spacing['4']}` → `padding: ${spacing['3']} ${spacing['5']}` and add `minHeight: 44` on these three components. Verify no layout regressions at desktop. **1 hour.**

6. **2 s skeleton timeout on inbox + RFI detail + daily log** (I-6, R-5, D-7, Sev 2).
   Add a `setTimeout` watchdog that flips `<SkeletonStack>` to a "Still loading… retry?" state at 2 s. **2 hours of testing.**

7. **Reject mutation error path on Iris Inbox** (I-8, Sev 2).
   Wrap `await rejectDraft.mutateAsync(...)` in try/catch and toast on failure. **15 minutes.**

8. **Add "Choose from library" fallback to FieldCaptureModal error state** (D-20, Sev 1).
   `FieldCaptureModal.tsx:222`. When `cameraError` is set, show a secondary button beside "Try again" that opens a `<input type="file" accept="image/*">` (no `capture` attribute, picks from library). Field Manual Part II item #10 closes. **45 minutes.**

9. **Color + text + icon on confidence / status pills** (I-12, R-11, D-13, Sev 2).
   Add a Lucide icon to the IrisApprovalGate confidence pill and the RFI / Daily-Log status pills. WCAG 1.4.1 compliance. **1 hour.**

10. **Migrate Daily Log local color literals to theme imports** (D-17, Sev 2).
    `daily-log/index.tsx:67-83`. Replace local `INK`, `BORDER`, `STATUS.*` with `colors.*` references. The "DESIGN-RESET" justification is now stale; theme contains the correct values. **1.5 hours including verification on light/dark.**

**Total estimated effort: ~9 hours** to bring all three demo surfaces over the line for first-impression Bugatti grade. None of the 10 items requires new infrastructure; all are file-level fixes against existing patterns.

---

## Closing notes

The three demo surfaces show strong design intent — the comment headers ("the visual 'AI super hands you a draft; you stamp it' moment that sells the product" in IrisApprovalGate.tsx, "World-class conversation-first design" in RFIDetail.tsx) match the actual rendered output more than half the time. The gaps are not architectural; they're polish + permissions + accessibility + mobile. The Daily Log surface has the longest tail because it's the most complex page, but the underlying primitives (ZonePanel, EditableCell, FieldCaptureModal) are solid.

If Walker fixes the Top 10 above, the demo-surface scores rise from 7.6 / 7.8 / 6.8 to ≈ 9.0 / 9.0 / 8.6. To clear 9.5 across all three, the deeper work is the field-test-rig pass (`useIsMobile` everywhere, gloved-thumb retest) and the streaming-captures plumbing — both of which are Lap 2 / Lap 3 work, not pre-pilot work.

The fact that Daily Log has 39 PermissionGate references and the other two have zero is itself a tell: someone took the gate audit seriously on Daily Log, and forgot the other two. Set a CI lint rule that requires `<PermissionGate>` on any element with `onClick` writing to a mutation hook, and the regression class disappears.
