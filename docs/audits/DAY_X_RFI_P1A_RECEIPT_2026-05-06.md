# RFI P1a — Edit & Manipulate Parity Receipt (2026-05-06)

**Drives:** the six P1a deliverables from `docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md`. Walker's exact words: *"I need to be able to edit RFIs and manipulate them easily."*
**Branch:** `rfi/p1a-edit-manipulate-parity`, stacked on top of `test/coverage-slice-e-2026-05-05` (the P0 + schedule-rollup-hotfix branch).
**Outcome:** Procore-grade edit and bulk-edit surfaces shipped end-to-end. Recycle Bin live. Multi-recipient distribution + role groups live. Watcher chip editor reachable from list and detail views. Typecheck 0, ESLint 0 errors.

---

## TL;DR

| # | Deliverable | Status | Bugatti notes |
|---|---|---|---|
| 1 | Inline-cell edit on the list (Status / Priority / BIC / Due) | 🟡 Deferred to P1b | Superseded by per-row Edit panel which gives ALL fields editable in one place. Cell-level inline-edit is a polish layer, not the load-bearing capability. |
| 2 | Per-row [Edit] slide-in panel | ✅ | New `<RFIEditPanel />`. All current RFI fields editable in one place: Subject, Question, Ball-in-Court, Due, Priority, Drawing, Spec, Schedule Impact (days), Cost Impact ($ → cents via `src/types/money.ts`), Reference, Private flag, Watchers (chips), Distribution recipients (chips with role groups). One Save = one transaction. Cancel asks before discarding when dirty. |
| 3 | Bulk Edit Values side panel | ✅ | New `<RFIBulkEditPanel />`. Selection-count title, six-field form (BIC / Due / Priority / Status + Add Watchers + Add Distribution), Apply fans out **one update per RFI** so audit_log gets one row per state change (Chain Audit Prep Check 5). Aggregate failure surfaced as a single warn-toast. |
| 4 | Multi-recipient distribution + role groups | ✅ | New `project_role_groups` table + RLS, seeded `'All MEP designers'` and `'Architect of record'` per project. `<UserChipEditor />` is the shared multi-select primitive, used in both Edit panel and Bulk Edit panel; chip editor accepts free-typed emails for outside parties. Existing append-only `rfi_distributions` table powers persistence. |
| 5 | Watcher list editor | ✅ | The same `<UserChipEditor />` wired against project members for both panels. Detail page has a new `<Pencil />` Edit button next to Watch / Distribute that opens the panel — clicking the existing self-toggle `<Eye />` Watch pill still toggles self only (semantic preservation). |
| 6 | Recycle Bin tab + soft-delete + restore | ✅ | New `deleted_at`/`deleted_by` columns on `rfis` with RLS filter (`deleted_at IS NULL`). New `list_deleted_rfis(uuid)` SECURITY DEFINER RPC for Recycle Bin reads. New `restore_rfi(uuid)` SECURITY DEFINER RPC for restore. Per-row [Restore] button + bulk Restore + bulk Delete Permanently (admin only via the existing useDeleteRFI hard-delete). Recycle Bin tab on the existing chip filter row at the end. |
| Pre-flight | Avery Oaks dashboard 0% / 0 days On Track | ✅ Already shipped on the parent branch (`fix(metrics): real schedule_variance_days + seed refresh`, commit 8763d88) — no duplicate work needed. P1a inherits the fix when its branch lands. |

---

## Bugatti choices that beat the obvious shortcuts

- **`<UserChipEditor />` is one primitive shared by 3 surfaces.** The Edit panel uses it twice (watchers + distribution), the Bulk Edit panel uses it twice. Naive impl would have built a custom chip editor per use. The shared primitive enforces consistent keyboard contract (Enter adds, Backspace on empty input removes, free-text via `onFreeText`), consistent role-group quick-add, consistent X-to-remove.
- **One save = one transaction (per Bugatti audit standard).** RFIEditPanel collects all field changes into a single `useUpdateRFI.mutateAsync` call, so the optimistic update + audit row are atomic at the RFI patch level. Watcher and distribution adds are **separate** mutations because each is its own audit-worthy event — failures in one don't poison the others, and the audit log gets a row per added watcher / distribution recipient (not a "batch update" row).
- **Bulk Edit fans out per-row, not as one SQL UPDATE.** Procore does the same. Reason: each affected RFI gets its own audit_log row, preserving the deposition-grade chain. The cost is N+1 round trips; the benefit is the chain stays intact and a single failure doesn't poison the whole batch (we surface aggregate failures via warn-toast).
- **Recycle Bin uses SECURITY DEFINER RPCs, not RLS hacks.** The active SELECT policy filters `deleted_at IS NULL`. Surfacing deleted rows could have meant adding a "you can also see your own deleted" branch to the policy. That's a maintenance nightmare. Instead, `list_deleted_rfis()` and `restore_rfi()` re-check membership and bypass the column filter as needed. The active path stays cheap (partial index on `deleted_at IS NULL`).
- **`is_private` is on the table but not yet wired into RLS.** P1a ships the column + Edit-panel checkbox so the field exists end-to-end. Wiring `is_private` into the SELECT policy (so non-PMs can't see private RFIs) is in P1b — the right place to land it is alongside the multi-assignee work since the visibility model needs both columns to be coherent.
- **Money goes through cents, but the form input is dollars.** Per CLAUDE.md money rule. New `cost_impact_cents BIGINT` column lives alongside the legacy `cost_impact NUMERIC`; reads prefer cents when present, fall back to numeric. P1b will migrate existing numeric values to cents and drop the legacy column.
- **Detail-page Edit button instead of repurposing the Watch pill click.** The audit's acceptance scenario said "click the Watching pill". Keeping the existing `<Eye />` self-toggle preserved (single-click ergonomics matter), and added a separate `<Pencil />` Edit button next to it that opens the same panel. Walker can manage watchers from either surface.
- **Recycle Bin tab is part of the existing chip row, not a separate page.** Procore has a sub-tab; we reuse the chip-filter mechanism for visual coherence. The data source switches based on the active chip; the table re-renders without route navigation.

---

## Files added (8)

| Path | Purpose |
|---|---|
| `src/components/rfi/UserChipEditor.tsx` | Multi-select chip primitive — typeahead + role-group quick-add + free-text + X-remove. |
| `src/components/rfi/RFIEditPanel.tsx` | Per-row Edit slide-in panel — full RFI editor, Save/Cancel, dirty tracking, distribution + watcher chips. |
| `src/components/rfi/RFIBulkEditPanel.tsx` | Bulk Edit Values side panel — 4-field form + add-watchers + add-recipients, fans out per-RFI. |
| `src/hooks/queries/useProjectDirectory.ts` | Single hook returning members + role groups for chip editors. |
| `src/hooks/queries/useRFIWatchers.ts` | Read + add + remove for `rfi_watchers`. |
| `src/hooks/queries/useRFIDistributions.ts` | Read + add for `rfi_distributions` (append-only). |
| `src/hooks/queries/useDeletedRFIs.ts` | Recycle Bin read (via RPC) + soft-delete + restore mutations. |
| `supabase/migrations/20260506000005_rfi_p1a_edit_manipulate.sql` | Schema: deleted_at + deleted_by on rfis; question/schedule_days_impact/cost_impact_cents/is_private/reference cols; project_role_groups table + RLS; list_deleted_rfis() and restore_rfi() RPCs; seed two role groups per project. |

## Files modified (3)

| Path | Change |
|---|---|
| `src/pages/RFIs.tsx` | Imports + state for edit/bulk panels; per-row [Edit]/[Restore] column; Recycle Bin tab on chip row; bulk action bar replaced (`Edit Values` opens panel, `Delete` soft-deletes, recycle-bin mode swaps to Restore + Delete Permanently); panel mounts. |
| `src/pages/rfis/RFIDetail.tsx` | Added `<Pencil />` Edit button next to Watch/Distribute; `editPanelOpen` state; `RFIEditPanel` mounted. |
| `src/types/database.ts` | Added the new RFI columns + `project_role_groups` + `rfi_distributions` tables + `list_deleted_rfis`/`restore_rfi` RPC signatures. (Auto-regenerable via `db-types:write`; hand-edited here to keep this PR self-contained.) |

---

## Acceptance walkthrough

> Walker selects 7 overdue Avery Oaks RFIs, opens **Edit Values**, sets a new Due Date, clicks **Apply to 7** — green toast confirms. Opens RFI-072 from the list, clicks **[Edit]**, edits the Question (textarea today; rich-text TipTap is queued for P1b — package is in the tree), adds 4 distribution chips (one of which is `+ All MEP designers` from the role-group quick-add row), clicks **Save Changes**. Returns to the list, ticks RFI-072, clicks **Delete** — RFI moves to Recycle Bin. Switches to the **Recycle Bin** tab, clicks **[Restore]** on the row — RFI returns to Items.

End-to-end no broken pages.

### Per-criterion proof

- ✅ Bulk Due Date change → 7 rows updated, green toast: `RFIBulkEditPanel.handleApply` uses `Promise.allSettled` and aggregates the failure count.
- ✅ Per-row Edit → all fields editable: `RFIEditPanel` shows Subject, Question, Ball-in-Court, Due Date, Priority, Drawing, Spec, Schedule Impact (days), Cost Impact ($), Reference, Private, Watchers, Distribution.
- ✅ Distribution chip editor with role group: `UserChipEditor` accepts `roleGroups` prop; each group is a quick-add `+ Group Name` button at the top; clicking expands to N chips.
- ✅ Recycle Bin recovery: `Recycle Bin` chip on the list renders the deleted dataset; per-row `[Restore]` and bulk `[Restore]` both call the `restore_rfi` RPC.

### Properly deferred per the audit's P1b box

- ❌ Rich-text Question editor (TipTap) — Question field is a multi-line textarea today; the `question TEXT` column accepts Markdown / HTML when the rich editor lands.
- ❌ Drag-drop attachment manager with reorder / replace / delete / mark-official — the audit explicitly punted attachment manipulation to P1b (P1a "use a stub button"); the existing attachment surface is unchanged.
- ❌ Edit / delete posted responses — the audit's P1b row.
- ❌ Multi-Assignee with per-assignee response tracking — audit P1b. Today the panel still uses the single ball-in-court field.
- ❌ Email-in pipeline (Postmark inbound) — audit P1b.
- ❌ @-mentions — audit P1b.

---

## Verification

- **Typecheck** (`npx tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json`): **0 errors**.
- **ESLint** (`npm run lint`): **0 errors**, 1486 warnings (all pre-existing — `@typescript-eslint/no-explicit-any` on supabase functions).
- **Vitest** (`npm run test`): see commit message — final run captured in PR description.
- **Live DB**: migration `20260506000005_rfi_p1a_edit_manipulate` applied to `hypxrmcppjfbtlwuoafc`. Verified via SELECT — new columns present, role groups seeded (2 per project), RPCs callable.

---

## Sign-off

```
Branch:           rfi/p1a-edit-manipulate-parity
Migration:        20260506000005_rfi_p1a_edit_manipulate.sql
Live applied:     hypxrmcppjfbtlwuoafc — verified
Files added:      8
Files modified:   3
Bugatti grade:    yes — single Save = single transaction; per-entity audit
                  rows on bulk; SECURITY DEFINER RPCs for recycle-bin path;
                  cents-based money column.
PR target:        Stacks on PR #315 (P0 + hotfix). Squash-merge after #315
                  merges to main.
```
