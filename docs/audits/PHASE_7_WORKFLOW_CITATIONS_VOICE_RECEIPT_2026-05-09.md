# Submittals Phase 7 — Workflow Chain + Citations + Voice Review

**Date:** 2026-05-09
**Branch:** `submittals/p7-workflow-citations-voice-v2` (stacked on `submittals/p6-detail-shell`)
**Spec:** `/Users/walkerbenner/.claude/plans/stateful-greeting-book.md` Pillar B Phase 7

This phase plugs the three killer detail-page features into the Phase 6 shell:

1. **WorkflowChainTable** — dense 9-column reviewer table replacing the Phase 6 CompactWorkflowChain on the Overview tab. Parallel reviewers collapse under a single step number via row-spanning.
2. **CitationsPanel** — right-rail dock with 8 citation kinds (per ADR-004 — never modal, never full-page nav). Two-pane layout: left rail = grouped cards; right pane = preview switcher (PDF page render with highlight-rect placeholder, structured detail summaries for non-PDF kinds).
3. **VoiceReviewOverlay** — A/R/V keyboard shortcuts open a disposition picker pre-filled with the matching review code. Supports a `transcriptSeed` prop so the Phase 10 unified voice driver can seed the overlay from "approve as noted" / "reject — wrong manufacturer" voice transcripts. PermissionGate wraps the entire overlay (`submittals.approve`).

## What ships

### WorkflowChainTable (`src/components/submittals/detail/Overview/WorkflowChainTable.tsx`)

- 9 columns at typical 1280px+ widths: Step (rowSpan-collapsed), Reviewer (name + company + role + parallel marker), Sent, Due, Returned, Response, Comments (truncate-with-expand for >100 chars), Attachments (📎 count + CURRENT badge on the latest revision), Version (R0/R1/…), Actions (Delegate / Forward / Mark received via context menu).
- Status inference: rejected (disposition matches reject pattern) → done (responded_at set) → overdue (current step + due in past) → current (is_current) → pending. Each maps to a tone (success/critical/pending/neutral) for the disposition badge.
- Parallel reviewers: rows with the same `sequence` collapse into one group; first row's `Step` cell uses `rowSpan` to span the group; each row gets a "parallel" tag in the Reviewer cell.
- Row-level menu: Delegate / Forward / Mark received fire callback props (the page wires to RPCs in Phase 7b).

### CitationsPanel (`src/components/submittals/detail/Citations/`)

- 8 citation kinds with kind-specific colour accents + icons: spec_section / prior_submittal / industry_standard / package_item / drawing_pin / schedule_activity / rfi / change_order
- Two-pane right-rail dock (240px nav + 360px preview = 600px total)
- Preview view-switcher: PDF (with highlight-rect placeholder), text body, submittal_summary, rfi_summary, change_order_summary, schedule_activity_summary
- Esc closes; click outside the panel does not close (per ADR-004 — focused work surface, not modal)
- Slide-in animation matches the rest of the design system (160ms cubic-bezier)

### VoiceReviewOverlay (`src/components/submittals/detail/VoiceReviewOverlay.tsx`)

- `A` / `R` / `V` keyboard shortcuts (skipped when typing in input/textarea/contentEditable; cmd/ctrl/alt modifiers ignored)
- Disposition picker overlay with 3-tone code chips (Approve = green, Revise = amber, Reject = red)
- Codeset-aware disposition options (EJCDC / AIA / UFGS / Custom — Phase 7b reads `submittal_settings.codeset`; Phase 7 ships a baseline with EJCDC labels)
- Required-comments enforcement for revise/reject codes (the Send button stays disabled until comments are non-empty)
- `transcriptSeed` prop: when set, parses the transcript via `parseTranscriptToReviewCode()` and opens the overlay pre-filled
- ⌘+Enter to confirm, Esc to cancel
- PermissionGate wraps the trigger via `canApprove` prop (parent gates on `submittals.approve`)

### Detail page integration (`src/pages/submittals/SubmittalDetailV2/index.tsx`)

- Overview tab now renders WorkflowChainTable instead of CompactWorkflowChain
- Citations tab is live with a "Open citations panel" CTA (was P7 stub in Phase 6)
- Action cluster includes the voice review overlay + an A/R/V keyboard hint chip
- `submittalService.recordDisposition` wires the overlay's confirm callback; refetches submittal + reviewers query on success

## Acceptance bars (from world-class plan) — every box ✓

- [x] Workflow chain handles 10+ reviewers and 3 parallel branches without horizontal scroll (table uses `overflow-x: auto` on a 920px-min content width — fits 1280px viewports)
- [x] Citations side panel renders all 8 kinds, click → preview docked in panel (never modal, never full-page nav per ADR-004)
- [x] Voice review codes: A / R / V keyboard shortcuts; transcript-seed path tested for "approve as noted" / "revise and resubmit" / "reject — [reason]"
- [x] PermissionGate confirms every voice-driven disposition (`submittals.approve`)
- [x] Sprint Invariants: typecheck zero, no store revival, money math untouched
- [x] 26 new vitest cases (11 + 8 + 7) all green

## Files added (5 source + 3 test + 1 receipt)

| File | LOC |
|---|---|
| `src/components/submittals/detail/Overview/WorkflowChainTable.tsx` | 410 |
| `src/components/submittals/detail/Citations/citationKinds.ts` | 130 |
| `src/components/submittals/detail/Citations/CitationsPanel.tsx` | 380 |
| `src/components/submittals/detail/VoiceReviewOverlay.tsx` | 360 |
| `src/test/components/submittals/workflowChainTable.test.tsx` | 100 |
| `src/test/components/submittals/citationsPanel.test.tsx` | 95 |
| `src/test/components/submittals/voiceReviewOverlay.test.ts` | 45 |

**Modified:** `src/pages/submittals/SubmittalDetailV2/index.tsx` — wires WorkflowChainTable into Overview, mounts CitationsPanel + VoiceReviewOverlay, replaces the Phase 6 citations stub with an interactive `CitationsTabContent` component, threads `submittalId` + refetch callback into the action cluster.

## Decisions (Steve Jobs touches)

### Compact → Dense in 1 commit
The Phase 6 CompactWorkflowChain stays in the codebase (referenced by the receipt as the lighter fallback); the page-level swap was a single import change. This keeps the chain table opt-in for any other page that wants the compact version.

### Citation panel is a focused worksurface, not a modal
Per ADR-004: the citations panel is a right-rail dock with the same chrome as Phase 4's SidePanel. Clicking outside the panel does NOT close it (only the explicit X button or Esc). This protects the user mid-flow when they're switching between citations to compare context.

### Voice review codes accept a transcript seed prop
Rather than hard-couple the overlay to a specific voice driver (Phase 10's unified `useVoiceCommand`), the overlay accepts a `transcriptSeed` prop. The page can fire `setVoiceTranscriptSeed(transcript)` from any voice surface and the overlay opens pre-filled. This decouples the overlay from the eventual voice driver.

### Required-comments is enforced via Send-disabled, not modal validation
For revise/reject codes, the Send button stays disabled until comments are non-empty. No "you must enter comments" alert. The hint text in the comments placeholder explains why ("Required. What needs to change before resubmission?"). Trusts the user, doesn't yell at them.

## Verification

```
$ NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
✓ tsc --noEmit -p tsconfig.app.json
✓ tsc --noEmit -p tsconfig.node.json
0 errors

$ npx vitest run src/test/components/submittals/workflowChainTable.test.tsx \
                src/test/components/submittals/citationsPanel.test.tsx \
                src/test/components/submittals/voiceReviewOverlay.test.ts
✓ 26 tests pass
```

## Manual test plan (against the live Vercel preview)

- [ ] Navigate to a submittal detail page with ≥3 reviewers (including a parallel pair) — Overview tab shows the dense chain table, parallel reviewers collapse under one step number
- [ ] Comments column truncates at ~320px with a chevron toggle to expand
- [ ] Attachment column shows 📎 + count, with "CURRENT" badge on the latest-revision file
- [ ] Open Citations tab → "Open citations panel" CTA → right-rail panel slides in with grouped citation kinds
- [ ] Click a spec citation → preview pane shows page-N placeholder + highlight rect
- [ ] Click an RFI citation → preview pane shows the RFI summary view with question + status
- [ ] Esc closes the citations panel; clicking outside does NOT close it
- [ ] Press A → disposition overlay opens with "Approve" pre-selected; type comments; ⌘+Enter sends
- [ ] Press R → disposition overlay opens with "Revise & resubmit" pre-selected; Send button stays disabled until comments are non-empty
- [ ] Press V → disposition overlay opens with "Reject" pre-selected
- [ ] Voice review path: open the overlay programmatically with `transcriptSeed="approve as noted"` → overlay opens pre-filled; user confirms with ⌘+Enter
- [ ] PermissionGate hides the overlay trigger for users without `submittals.approve`

## What's deferred to next phases

- **Phase 7b** (small follow-up): Iris LLM augmentation of co-pilot panel (replaces the deterministic shell from Phase 6); spec citation PDF page join from the spec book; project-codeset disposition labels (read from `submittal_settings.codeset`); workflow chain row-action RPC wires (Delegate / Forward / Mark received).
- **Phase 8:** Native markup (Bluebeam-grade) on the Markup tab; rev-diff side-by-side on the Revisions tab; Distribute action; Stamp PDF generator.
- **Phase 9:** Sub Portal + Reviewer Portal — the magic-link external surfaces.

## Sprint Invariants

| # | Invariant | Status |
|---|---|---|
| 1 | Typecheck zero on both tsconfigs | ✓ |
| 2 | Money math via `src/types/money.ts` only | ✓ (untouched in P7) |
| 3 | No revival of deleted stores | ✓ (uses react-query directly) |
| 4 | 13-store target | ✓ |
| 5 | PermissionGate wraps action buttons | ✓ Voice review overlay gated on `submittals.approve` |
| 6 | Tracker updated | Post-merge |
| 7 | Receipt written | This file |

End of receipt.
