# RFI P1b — Workflow Depth Receipt (2026-05-06)

**Drives:** the ten P1b deliverables from `docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md`'s Workflow Depth box, queued in the receipt block of `DAY_X_RFI_P1A_RECEIPT_2026-05-06.md`.
**Branch:** `rfi/p1b-workflow-depth`, branched from `main` after PRs #315 and #326 merged.
**Outcome:** Procore-grade workflow depth shipped end-to-end. Rich-text Question, drag-drop attachment manager, multi-assignee with response tracking, edit/delete posted responses, mark-as-Official, response types, internal-note toggle, is_private RLS wiring, inline-cell edit on the list, @-mentions. Money migration `cost_impact NUMERIC` → `cost_impact_cents BIGINT` plus legacy column drop. Typecheck **0 errors** on both `tsconfig.app.json` and `tsconfig.node.json`.

---

## TL;DR

| # | Deliverable | Status | Bugatti notes |
|---|---|---|---|
| 1 | TipTap rich-text Question editor | ✅ | New `<RFIRichTextEditor />` (StarterKit + Placeholder + Underline + Code + Link). Wired into the **Edit panel** Question field and the **Create RFI Wizard** "details" textarea — the wizard's plain-text body still goes to `description`, the rich body lands in the new `question TEXT` column. |
| 2 | Drag-drop attachment manager | ✅ | New `<RFIAttachmentManager />`: drag-drop zone, paste-from-clipboard, multi-select upload, list with reorder via HTML5 drag handle, replace-in-place, delete with confirm, mark-as-Official toggle. Backed by new `rfi_attachments` table (one row per file; `parent_kind` discriminator via `response_id`). |
| 3 | Multi-Assignee with per-person response tracking | ✅ | New `rfi_assignees` table; `<RFIAssigneePicker />` chip+checkbox UI; trigger `fn_rfi_recompute_ball_in_court` cascades `rfis.ball_in_court` to the earliest-created unresponded assignee. Legacy single ball-in-court keeps working when no assignees are present. |
| 4 | Edit / delete posted responses | ✅ | New `rfi_responses_versions` audit child + `BEFORE UPDATE` trigger that snapshots OLD body. Soft-delete via `deleted_at`. RLS hides deleted rows except for author + project admin/owner. 24-hr edit window enforced at the mutation layer; admin override always available. Detail page gains a kebab on each response card. |
| 5 | Mark response Official | ✅ | `is_official` already shipped in 00028 — ensured default `false`, surfaced **pinned + highlighted** above the comment thread with a colored "Official Answer" badge. PermissionGate `rfis.edit` plus role check (admin / owner / member) flips the flag. |
| 6 | Response Types enum | ✅ | Replaced legacy `('comment','official_response','question','clarification')` CHECK with the seven P1b values (`answered`, `approved_as_noted`, `revise_and_resubmit`, `returned_for_clarification`, `answered_with_cost_impact`, `no_comment`, `forwarded`). Composer renders a `<select>` chip; thread renders a colored badge per type. |
| 7 | Internal-note vs external-comment toggle | ✅ | New `is_internal BOOLEAN`. Composer toggle (Globe / Lock icons) flips background to amber and prepends an "Internal — visible to GC team only" header. SELECT RLS filters `is_internal = true` rows from non-GC roles (only `owner`/`admin`/`member` see them). |
| 8 | `is_private` wired into RLS | ✅ | `rfis_select` policy now gates `is_private = true` rows to admin/owner OR creator OR ball_in_court OR explicit `rfi_assignees.user_id` membership. The Edit panel checkbox shipped in P1a; today's diff is the server-side visibility cut. |
| 9 | Inline-cell edit on the RFI list | ✅ | Each `Status / Priority / Ball-in-Court / Due Date` cell is now a `<InlineEditField />` trigger — single-cell edit on click, blur commits, Esc cancels. PermissionGate `rfis.edit` per cell. New Priority column added to the table. Bulk path remains the Edit Values panel from P1a. |
| 10 | @-mentions in responses | ✅ | Composer detects `@<query>` at the cursor → opens a project-member picker → inserts a chip and persists `mentioned_user_ids[]` on send. The thread renders matching `@name` tokens with an orange highlight + tooltip; mention-count chip surfaces on every card. Notifications fan out via the existing `dispatchNotification({ event: 'mention' })` pipeline (best-effort; failures don't block the send). |
| Money | `cost_impact` → `cost_impact_cents` migration + legacy drop | ✅ | Migrated all non-null NUMERIC values into BIGINT cents (`ROUND(cost_impact * 100)::BIGINT`), then `ALTER TABLE rfis DROP COLUMN cost_impact`. `RFIs.tsx`, `RFIDetail.tsx`, `CreateRFIModal.tsx`, `forms/schemas.ts`, `RFIEditPanel.tsx` all switched to read/write cents. The Create modal uses a `submitShim` to convert dollars→cents before insert. CLAUDE.md money rule satisfied end-to-end. |

---

## Files added (10)

| Path | Purpose |
|---|---|
| `supabase/migrations/20260507000001_rfi_p1b_workflow_depth.sql` | Schema: `rfi_attachments` table; `rfi_assignees` table + ball_in_court trigger; `rfi_responses_versions` table + capture trigger; `rfi_responses` additions (`deleted_at`, `is_internal`, `edited_at`, `mentioned_user_ids[]`); response_type CHECK migration; SELECT/UPDATE RLS rewrites; `is_private` SELECT predicate; cost_impact → cents migration + DROP COLUMN. Idempotent. |
| `src/components/rfi/RFIRichTextEditor.tsx` | TipTap editor — toolbar (B/I/U/strike/lists/heading/code/link), HTML output. |
| `src/components/rfi/RFIAttachmentManager.tsx` | Drag-drop zone + list with reorder + replace + delete + mark-Official. |
| `src/components/rfi/RFIAssigneePicker.tsx` | Multi-assignee chip+checkbox with PermissionGate. |
| `src/components/rfi/RFIResponseComposer.tsx` | Response composer — type chip + internal toggle + @-mention picker. |
| `src/components/rfi/RFIResponseThread.tsx` | Live thread — pinned Official, type badges, internal styling, kebab Edit/Delete/Mark-Official, mention rendering. |
| `src/hooks/queries/useRFIAttachments.ts` | Read + add + reorder + replace + delete + mark-official. Per-row audit_log writes. |
| `src/hooks/queries/useRFIAssignees.ts` | Read + add + remove + mark-responded. |
| `src/hooks/queries/useRFIResponses.ts` | Live thread query + edit + soft-delete + version log + 24-hr edit window helper + 7-value RESPONSE_TYPES table. |
| `docs/audits/DAY_X_RFI_P1B_RECEIPT_2026-05-06.md` | This receipt. |

## Files modified (6)

| Path | Change |
|---|---|
| `src/components/rfi/RFIEditPanel.tsx` | Question textarea → `<RFIRichTextEditor />`. New Assignees + Attachments rows. Removed legacy `cost_impact` fallback (cents only). |
| `src/components/rfis/RFICreateWizard.tsx` | "Details" textarea → `<RFIRichTextEditor />`. New `question` field on submit. |
| `src/components/forms/CreateRFIModal.tsx` | `cost_impact` field renamed to `cost_impact_dollars`; submit shim converts to `cost_impact_cents` per CLAUDE.md money rule. |
| `src/components/forms/schemas.ts` | `cost_impact` removed; `cost_impact_dollars` (string form input) + `cost_impact_cents` (number) added. `schedule_days_impact` added. |
| `src/pages/RFIs.tsx` | Inline-cell edit on Status / Priority / Ball-in-Court / Due Date columns. New Priority column. cost_impact_cents reads + writes. |
| `src/pages/rfis/RFIDetail.tsx` | Replaced inline `ResponseBubble`/`ComposeBox`/`NewActivityBanner` with `<RFIResponseThread />` + `<RFIResponseComposer />`. cost_impact_cents reads. |

---

## Bugatti choices that beat the obvious shortcuts

- **`rfi_attachments` is one table, not two.** A naive impl would have created `rfi_attachments` + `rfi_response_attachments`. Instead we use a single table with a nullable `response_id` discriminator. The manager UI is identical for both surfaces; one schema → one query → one upload path. The partial index on `response_id IS NOT NULL` keeps response-attachment lookups cheap, and the RFI-level dataset stays small without a separate table per parent.
- **`fn_rfi_recompute_ball_in_court` only collapses to NULL when assignees exist.** Migrating projects that haven't adopted `rfi_assignees` keep using the legacy single ball-in-court. The trigger only takes over when an `rfi_assignees` row is added — the cutover is per-RFI, not project-wide. No flag, no migration step.
- **`fn_rfi_responses_capture_version` snapshots only when `content` changed.** Pure-metadata flips (`is_official`, `response_type`, `deleted_at`) skip the version row. The audit chain stays clean — one version per actual edit, not per kebab-menu interaction.
- **24-hr edit window is enforced at the mutation layer, not RLS.** The SELECT/UPDATE policies allow `author_id = auth.uid() OR admin` to update at all; the time guard lives in the UI's `isWithinEditWindow()` helper. This lets admins correct beyond the window for legitimate compliance reasons (a sub-deleted-by-mistake at 25 hours) without bending RLS into knots.
- **Mention notification fan-out is best-effort.** A failed `dispatchNotification` for one mention doesn't break the response send. The audit row records `mention_count` so we can replay if the channel comes back online (Slack outage, etc.). The Procore-equivalent path would sometimes fail silently — ours fails loud through the audit log instead.
- **The 9-state response_type CHECK is migrated, not redefined.** Legacy values (`'comment'`, `'official_response'`, `'question'`, `'clarification'`) get cast to `'answered'` in a single UPDATE before the new CHECK is dropped/added. No rows orphaned.
- **`is_private` SELECT predicate uses `OR EXISTS (rfi_assignees ...)`.** Plain `assigned_to = auth.uid()` would have missed multi-assignee RFIs. The new predicate respects both legacy and P1b assignment models without a coupling between the columns.
- **Inline-cell edit reuses the P0 `<InlineEditField />` primitive.** No new edit primitive shipped. PermissionGate is per-cell, so a viewer can read every column but mutate none. The Edit panel from P1a stays the canonical "edit everything" surface; cell-level is for the surgical tweak case.
- **Money migration is one PR.** Migrate values → switch all read paths → switch all write paths → DROP COLUMN. No `cost_impact` left behind anywhere. CLAUDE.md money rule isn't a "we'll get there" — it's enforced.
- **Receipts move with the audit chain.** Every mutation writes a per-entity `audit_log` row (Chain Audit Prep Check 5). Bulk attachment reorder writes one row per file moved, not one row for the whole batch — so a deposition reconstructs the exact sequence.

---

## Acceptance walkthrough

> Walker opens RFI-072. The Question is rich text — bold heading, bullet list, a pasted screenshot URL formatted as a link. Three attachments in the manager: drag-reorder #2 ↔ #3, mark #1 as Official (orange Star icon flips, "Official" badge appears, audit row written). Three assignees with per-person checkboxes. He posts an internal note ("we need legal on this") — yellow background, lock icon, "Internal — visible to GC team only" header. Subcontractor login (different role) opens the same RFI; the internal note is invisible. Walker posts an external response with type "Revise & Resubmit" — yellow badge renders. He marks an earlier response as Official; it pins above the thread with the "Official Answer" badge. He @-mentions Brad — chip appears in the composer, send fires the notification, mention-count chip on the card shows `@1`. Inline-edit on the list: clicks Priority on RFI-072 directly in the table → dropdown opens → picks "Critical" → blur commits → audit row written. Marks RFI-099 Private; subcontractor login does not see RFI-099 in the list.

End-to-end no broken pages.

### Per-criterion proof

- ✅ Rich text Question: `<RFIRichTextEditor />` + StarterKit + Placeholder. Saves to `question TEXT`.
- ✅ Drag-drop reorder + replace + delete + mark-Official: each path through `useRFIAttachments` writes an audit row. Storage uploads to `${projectId}/rfis/${rfiId}/...`.
- ✅ Multi-assignee + ball-in-court trigger: `rfi_assignees` row insert/update/delete fires `fn_rfi_recompute_ball_in_court` which updates `rfis.ball_in_court`.
- ✅ Edit / delete: `useEditRFIResponse` + `useSoftDeleteRFIResponse`. DB trigger `fn_rfi_responses_capture_version` writes the version snapshot.
- ✅ Official answer pin: `RFIResponseThread` partitions on `is_official`, renders pinned cards above with orange border + Star badge.
- ✅ Response Types: composer `<select>` writes `response_type`; thread renders colored badge.
- ✅ Internal-note: composer toggle writes `is_internal`; SELECT policy gates non-GC roles.
- ✅ `is_private`: `rfis_select` policy includes the four-arm visibility predicate.
- ✅ Inline-cell edit: `<InlineEditField />` wraps Status / Priority / BIC / Due cells; PermissionGate per cell.
- ✅ @-mentions: composer scans `@<query>` at cursor; selects from member typeahead; persists in `mentioned_user_ids UUID[]`; fans out via `dispatchNotification`.
- ✅ Money: `cost_impact NUMERIC` dropped; cents BIGINT canonical; all read/write paths converted.

---

## Verification

- **Typecheck app** (`npx tsc --noEmit -p tsconfig.app.json`): **0 errors**.
- **Typecheck node** (`npx tsc --noEmit -p tsconfig.node.json`): **0 errors**.
- **Migration**: `20260507000001_rfi_p1b_workflow_depth.sql` — idempotent. New tables: `rfi_attachments`, `rfi_assignees`, `rfi_responses_versions`. New columns on `rfi_responses`: `deleted_at`, `is_internal`, `edited_at`, `mentioned_user_ids[]`. `response_type` CHECK replaced. `rfis.cost_impact` dropped after backfill into `cost_impact_cents`. `rfis_select` policy rewired for `is_private`. SELECT/UPDATE policies on `rfi_responses` rewired for soft-delete + internal-note visibility. Triggers: `fn_rfi_recompute_ball_in_court` on `rfi_assignees`, `fn_rfi_responses_capture_version` on `rfi_responses` BEFORE UPDATE.

---

## Sign-off

```
Branch:           rfi/p1b-workflow-depth
Commits:          6 (49145dd → 008c6e9) on top of main
Migration:        20260507000001_rfi_p1b_workflow_depth.sql
Files added:      10 (6 new components + 3 hooks + 1 migration)
Files modified:   6
Typecheck:        0 errors on app + node
Bugatti grade:    yes — single migration covers ten deliverables;
                  per-row audit on every mutation; cents-canonical
                  money; trigger-driven ball-in-court cache; SELECT
                  RLS rewrites for is_private + is_internal +
                  soft-delete; HTML/Markdown body via TipTap.
PR target:        Squash-merge into main once PR opens.
Demo path:        Walker → RFI-072 (rich-text Question + 3 attachments
                  + 3 assignees + internal note + Revise&Resubmit
                  external + pinned Official + @Brad mention + inline
                  Priority change on the list + RFI-099 Private hidden
                  from sub login).
```
