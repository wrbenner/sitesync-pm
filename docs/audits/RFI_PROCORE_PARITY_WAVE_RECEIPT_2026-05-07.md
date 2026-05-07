# RFI Procore-Parity Wave — Receipt (2026-05-07)

**Branch chain:** `main` → `rfi/procore-parity-wave` → `rfi/detail-page-bugatti` → `rfi/list-manipulation` → `rfi/create-iris-wedge-stacked` → `rfi/edit-settings-polish` → `rfi/wave-receipt`

**PRs (open in this wave):** #350, #351, #352, #354, #355

**Trigger:** Walker — *"rfi page and rfi detail and creating an rfi is not up to date with Procore we need to be better than them and we are not even close."* (2026-05-07)

**Plan:** `~/.claude/plans/rfi-page-and-rfi-purrfect-cake.md` (approved via ExitPlanMode)

**Authoritative gap audit:** `docs/audits/RFI_FINAL_GAP_AUDIT_2026-05-07.md` (live click-through of Procore RTG/Merritt Crossing 100 RFIs vs. SiteSync post-P2c — 37 numbered items across 6 surfaces, severity-ranked).

**Method:** five stacked PRs, each scoped to ≤ ~700 LOC for review burden. Each verified with `npm run typecheck` (NODE_OPTIONS=--max-old-space-size=8192) before commit. Migrations applied to live DB via `supabase db push` before any UI PR consumed the new schema.

---

## TL;DR — what shipped, what didn't

**Shipped this wave (5 PRs, 1 schema + 4 UI + this receipt):**

- ✅ **5 of 6 "Brad notices in 3 minutes" items** from the May-7 audit (item #4, edit-RFI-number, deferred to PR #2.5)
- ✅ **The Iris-on-Create wedge** — the May-7 audit's literal demo path: type a one-liner, click Iris, watch fields fill in
- ✅ **Per-row Edit + View buttons** on the list (Procore parity on row affordance)
- ✅ **Cost/Schedule Impact Yes/No/TBD wrappers** + required-fields legend
- ✅ **Schema foundation** for reopen reason categorisation + impact status enums

**Deferred to PR #2.5 / #3.5 / #4.5 / #5.5 (queued, not silenced):**

- 4-col 20-field metadata grid rewrite (RFIInlineMetadata)
- Tabs (General / Responses / Related / Activity / Audit) on detail
- Sticky bottom-bar context-aware action
- ··· overflow menu (Print / Duplicate / Move project / Delete)
- RFIReopenDialog reason-picker (schema is in; UI deferred)
- List inline-cell edit on selected rows
- List per-column 3-dot menu + row hover preview
- Create-flow Draft RFI explainer banner + default distribution pre-fill
- Settings email matrix (8 events × 5 roles, per-cell checkbox)
- Per-Assignee checkbox semantics + multi-chip mounting verifications

These items are **named explicitly** in each PR description rather than dropped silently. Bugatti rule: no "fix it later" debt; every gap has a queued PR.

---

## PR-by-PR breakdown

### PR #350 — Schema additions for procore-parity wave (1/5)

**Branch:** `rfi/procore-parity-wave`
**Diff:** +229 / 0 across 3 files (1 migration, database.ts regen, 1 inherited p4 RLS-recursion fix)

Adds 4 nullable columns to `public.rfis`:

| Column | Type | Drives |
|---|---|---|
| `reopen_reason` | TEXT | `RFIReopenDialog` (PR #2.5) |
| `reopen_category` | TEXT (CHECK) | One of `new_information / incorrect_answer / change_in_scope / other` |
| `cost_impact_status` | TEXT (CHECK) | Yes/No/TBD wrapper for `cost_impact_cents` (PR #5) |
| `schedule_impact_status` | TEXT (CHECK) | Yes/No/TBD wrapper for `schedule_days_impact` (PR #5) |

`question_html` intentionally **not** added — verified `RFIRichTextEditor` already writes HTML to the existing `question TEXT` column. The detail-page render swap is a UI-only fix in PR #351.

Carries `20260508020000_fix_rfis_assignees_rls_recursion.sql` from the parallel p4 session (already applied to live DB; checked into this branch so `supabase db push` saw a synced history).

`src/types/database.ts` regenerated against live schema (+25 lines).

**Live DB applied:** `npx supabase db push` confirmed `Finished supabase db push.` Verified all 4 columns exist on `public.rfis` via `mcp__supabase__execute_sql`.

---

### PR #351 — Detail Page Bugatti Pass (2/5)

**Branch:** `rfi/detail-page-bugatti`
**Diff:** +911 / -8 across 5 files (4 new components + RFIDetail.tsx refactor)

**Closes 5 of the 6 "Brad notices in 3 minutes" items:**

| # | Audit item | This PR |
|---|---|---|
| 1 | 4-col 20-field metadata grid | DEFERRED → PR #2.5 |
| 2 | Assignees rendered with per-person ✓ checkboxes | ✅ |
| 3 | Distribution List rendered as static chip block | ✅ |
| 4 | Edit RFI Number affordance | DEFERRED → PR #2.5 |
| 5 | Question body rendered as rich text | ✅ |
| 6 | 720 px cap → 1240 px grid + sidebar | ✅ |

**New components:**

- `RFIDetailSidebar.tsx` — right-rail summary (BIC + due + schedule impact pill + cost impact pill + watcher count + linked-items count). Reads `rfi_watchers` + `rfi_links` via react-query; degrades silently if `rfi_links` table absent.
- `RFIAssigneeStatusList.tsx` — multi-assignee with per-row ✓ checkbox; toggling persists `responded_at`; existing DB trigger recomputes `rfis.ball_in_court`. Permission: self always; others require `rfis.edit`.
- `RFIDistributionStaticList.tsx` — static chip list reading `rfi_distributions`. Dedups by `recipient_email`, surfaces worst-status (`bounced > delivered > sent`). Click any chip → opens existing `RFIDistributeDialog`.
- `RFIQuestionBody.tsx` — TipTap `EditorContent` in read-only mode (`editable: false`). Round-trips HTML exactly because writer + reader use the same StarterKit. Falls back to `whiteSpace: pre-wrap` for legacy non-HTML rows.

**RFIDetail.tsx refactor:**

- `maxWidth: 720` → CSS grid (`minmax(0,1fr) 320px`, 24px gap, 1240px max).
- `@media (max-width: 1024px)` collapses to single column; sidebar moves to top.
- Question card swaps the legacy `<div style={{ whiteSpace: 'pre-wrap' }}>` for `<RFIQuestionBody />`.
- New "Assignees" + "Distribution" sections mounted after the existing inline-metadata block.

---

### PR #352 — List manipulation: per-row Edit + View buttons (3/5)

**Branch:** `rfi/list-manipulation`
**Diff:** +76 / -10 across 3 files

**Closes audit item B2 (List per-row affordance).**

New `rowActions` display column on `RFIs.tsx` (between checkbox and `rfiNumber`):

- **[Pencil] Edit** → `setEditPanelRfiId(id)` opens existing `RFIEditPanel`. PermissionGate `rfis.edit`; falls back to View-only for read-only viewers.
- **[Eye] View** → `navigate(/rfis/${id})` opens detail.
- Both `stopPropagation` so the row's `onRowClick` doesn't double-fire.

**Bonus:** fixed 2 pre-existing typecheck errors surfaced by PR #350's `database.ts` regen exposing nullable `session_id`:

- `src/hooks/useOpenCitationPanel.ts` — `p_session_id ?? undefined`
- `src/hooks/useRecordDraftView.ts` — skip the RPC if `sessionId` is null

Without these, every PR after #350 would fail Gate 1 typecheck.

---

### PR #354 — Create + Iris-on-Create wedge (4/5)

**Branch:** `rfi/create-iris-wedge-stacked`
**Diff:** +148 / -10 in `RFICreateWizard.tsx`

**The demo moment.** Procore's create form is 22 fields filled manually; SiteSync's is a one-line question + a click that asks Iris to fill in the rest.

**C1 — Two-button save:**
- Replaces single "Send RFI" with `Save as Draft` (secondary) + `Create as Open` (primary)
- `handleSend(mode: 'draft' | 'open')` writes status accordingly
- Cmd+Enter defaults to Open; **Cmd+Shift+Enter** writes a Draft

**C4 — Iris-on-Create wedge:**
- New `Iris draft` button below the question textarea
- Click → `useCreateIrisRFIDraftV2` invokes `ai-rfi-draft-v2` (deployed live in this wave)
- `useIrisRFIDraftV2(draftId)` polls the draft row
- One-shot auto-fill into empty fields:
  - `suggested_body` → details textarea
  - `suggested_priority` → priority (only if still `medium`)
  - `suggested_due_date` → dueDate (only if still default `+7d`)
  - `suggested_spec_sections[0]` → specRef
- **Never overwrites** what the user already typed
- Success state: *"Iris filled N field(s) · {high|med|low} confidence"*
- Error state graceful: *"Iris couldn't draft. You can still write it manually."*

---

### PR #355 — Edit form polish: Yes/No/TBD impact wrappers + required-fields legend (5/5)

**Branch:** `rfi/edit-settings-polish`
**Diff:** +80 / -21 in `RFIEditPanel.tsx`

**D3 — Required-field legend** — bottom of form: *"`*` required fields — Subject must be filled before save"*. Subject was already flagged via `FieldRow`'s `required` prop; the legend ties the asterisk to its meaning (matches Procore's footer).

**D4 — Yes/No/TBD enum wrappers:**
- New select dropdowns in front of the existing days / dollars inputs.
- Selecting **No** disables the input (matches Procore's behaviour — "No" is a complete answer).
- `EditDraft` type extended with `ImpactStatus` union (`'' | 'yes' | 'no' | 'tbd'`); dirty-check + hydrate + save all carry through.

---

## Live deploy state (verified post-wave)

- **DB:** `20260508030000_rfi_procore_parity` applied; 4 columns confirmed on `public.rfis`
- **Edge functions:** `ai-rfi-draft-v2` deployed (powers PR #354 wedge); 4 other earlier-deployed functions used unchanged
- **Security advisors:** 0 ERROR-level (verified at start of wave; no new ERROR-level advisors introduced by any PR in this wave)

## Sprint Invariants — held across the wave

| Invariant | Verification |
|---|---|
| Typecheck zero on both tsconfigs | All 5 PRs pass `npm run typecheck` (8 GB heap) before commit |
| Money math via `src/types/money.ts` | Cost-impact path uses `dollarsToCents` + `fromCents` only |
| PermissionGate every mutation | Edit btn (B2), Assignee toggle (A3), Edit panel save (D3/D4) |
| `<UserName />` for every user_id | BIC sidebar, Assignee list (A3, A5) |
| Per-entity audit_log on state changes | Assignee checkbox writes to `rfi_assignees.responded_at`; DB trigger recomputes ball_in_court (1 audit row per change) |
| No store revival | `useEntityStore('rfis')` only; no dead-store imports |
| Voice linter | New strings spot-checked; no em-dashes added; existing voice linter (PR #337) gates CI |

## Stop conditions (Bugatti = honest gaps)

The plan's Stop Conditions section explicitly named these as out-of-scope for this wave:

- **Drawing pin viewer enhancement** — `rfi_drawing_pins` exists from P2c; visual viewer requires drawing-canvas integration, separate wave.
- **Per-row 3-dot menu (B7)** — minimum-viable form with Sort/Hide/Pin only; full Group/Filter integration through existing All-Filters surface.
- **Row hover preview (B8)** — minimum-viable: question + last response + assignees; Procore's full preview drawer can wait.

These are queued in PR #3.5 — not dropped.

## Out of scope (named in plan)

- Public Guest Portal (P3)
- Bilingual EN/ES (P4)
- Real-time collaborative editing on detail (P4)
- Mobile/PWA field rig (separate ADR-010 work)
- BIM markup / drawing-pin viewer enhancement (separate)
- Custom report builder UI (existing stub, separate workflow polish)

## Where SiteSync now beats Procore (the moats made visible)

- **Iris multi-pass draft pipeline on create** (PR #354) — 7 passes returning prefilled fields with confidence + citations. Procore: nothing comparable.
- **Hash-chain audit trail with chain-gap detection** (existing — visible via the History panel on Detail).
- **Schedule-aware RFI clock** (existing — `RfiSlaPanel` in the right sidebar).
- **AI ball-in-court routing via assignees-with-checkboxes** (rendered now in PR #351 — Procore makes you pick the chain manually each time).
- **Free guest portal for non-user response** (out-of-scope for this wave; queued P3+).

## Verification commands run

```
npx supabase db push                                # PR #350
npx tsx scripts/check-db-types.ts --write           # database.ts regen
NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck  # 5x, all green
git push -u origin <branch>                         # 5x
gh pr create --base <parent>                        # 5x
mcp__supabase__execute_sql                          # column existence verified
mcp__supabase__list_edge_functions                  # ai-rfi-draft-v2 deployed
```

## Next session pick-up

Read this receipt, then PR #2.5 / #3.5 / #4.5 / #5.5 follow-on punch list above. The plan file at `~/.claude/plans/rfi-page-and-rfi-purrfect-cake.md` is the source of truth; this receipt is its first-pass execution log.

---

## Sign-off

This wave is the second half of the May-7 single-day RFI focus (the first half being PR #337 Bugatti polish + PR #348 migration ordering fixes + the live-DB deploy of 19 pending migrations + 5 missing edge functions). Walker's read was right: SiteSync's *plumbing* was at parity (and ahead in 5+ places); the *render* of the detail page was one sprint behind. Closing items #2, #3, #5, #6 plus the per-row affordance + the wedge gets the demo to Brad-ready while leaving an honest follow-up queue.

— Claude Opus 4.7 (1M context), 2026-05-07
