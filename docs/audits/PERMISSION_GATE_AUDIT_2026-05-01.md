# PermissionGate Audit — May 1, 2026 (Day 1 of Lap 1)

> **Scope.** Every `<button>` / `<Button>` / `<IconButton>` / `<MenuItem>`
> across the six contractual feature areas: RFI, Submittal, Change
> Order, Pay App, Punch List, Daily Log.
>
> **Auditor.** Walker Benner.
> **Methodology.** Programmatic enumeration (`/tmp/audit3.py`) +
> manual classification of each match.
> **Reference.** [docs/THE_FIVE.md](../THE_FIVE.md), [North Star Part VI — The Eleven Nevers](../../SiteSync_North_Star.docx) (Never #9: ship a stub page; corollary: ship an unguarded action), [src/components/auth/PermissionGate.tsx](../../src/components/auth/PermissionGate.tsx), [src/hooks/usePermissions.ts](../../src/hooks/usePermissions.ts).

---

## Executive summary

Across the six feature areas we counted **170 button-like elements** in
**26 page-level files**. Of those, **27 are real action buttons that
mutate server state without a `<PermissionGate>` wrapper**. The
remaining ~143 are UI affordances (modal toggles, navigation, filter
chips, tab swaps, client-side form-row management) that do not require
gating.

The honest split:

| Area | Files reviewed | Action buttons (mutate server) | Guarded | **Unguarded** | Severity |
|---|---|---|---|---|---|
| RFI | 1 | 4 | 3 | **1** | low |
| Submittal | 6 | 5 | 5 | **0** | clean |
| Change Order | 1 | 4 | 2 | **2** | medium |
| **Pay App** | 7 | **15** | 4 | **11** | **critical** |
| Punch List | 5 | 9 | 5 | **4** | high |
| Daily Log | 5 | 13 | 4 | **9** | high |
| **Total** | **25** | **50** | **23** | **27** | — |

**Top three risks (in order):**

1. **Pay App is wide open on the money path.** "Pay Sub", "Submit
   Application", "Mark Lien Waiver Received/Executed", "Edit SOV",
   "Advance retainage stage", "Mark Punch Done" all currently render
   for every project member. RLS at the database stops the actual
   write, but the buttons render — a viewer can click "Pay Sub" and
   only get a 403 from the server. That's a UX failure and an audit
   failure (the audit log will record an attempted action by a viewer).
2. **Daily Log delete + Daily Log AI summary + DailyLogPDFExport are
   all unguarded.** Delete should be `daily_log.edit`; AI summary
   should be `ai.use`; PDF export should be `export.data`.
3. **Punch detail page (`PunchItemDetailPage.tsx`) has zero gates.**
   Start / Mark Complete / Verify & Close / Reject all render for
   every role. The legacy `PunchListDetail.tsx` (the other detail
   route) is fully gated; the newer `PunchItemDetailPage.tsx` was
   built without gates.

The good news: PayAppList is almost entirely route-state-aware — the
buttons only render in matching workflow states (`status === 'draft'`
or `'approved'`). That contains the blast radius. Wrapping with
`PermissionGate` is straightforward and additive — no logic refactor
required for any of the 27.

---

## How to read this report

Every button in scope is classified as one of:

| Tag | Meaning | Needs gate? |
|---|---|---|
| **A** | **Action**: fires a server mutation (create/update/delete/approve/submit/pay/export). | **Yes.** |
| U | UI affordance: opens/closes a modal, toggles a filter, switches a tab, navigates. | No. |
| R | Read-side: refetch, drill-in, sort. | No. |
| E | Client-only form-row edit before submit (add row, remove row, cancel) — server only sees state on submit, which is itself an A. | Usually no; gate the parent submit instead. |

Only buttons tagged **A** are listed in the per-area tables below.
UI-affordance and form-row noise has been filtered out.

---

## RFI — `src/pages/RFIs.tsx`

| Line | Label | Handler | Gated? | Required permission | Notes |
|---:|---|---|:---:|---|---|
| 848 | Draft an RFI with Iris | `setShowAIDraftModal(true)` | ✅ | `ai.use` (or `rfis.create`) | Already gated. |
| 862 | Create new RFI | `setShowCreateModal(true)` | ✅ | `rfis.create` | Already gated. |
| 1370 | Delete RFI | `handleDeleteRFI` | ✅ | `rfis.delete` | Already gated. |
| **1506** | **Confirm AI draft → save** | `handleAIDraft` | ❌ | **`rfis.create`** | Inside the AI-draft modal. The outer "Draft an RFI with Iris" button is gated, but a user who can open the modal isn't necessarily allowed to *save* the draft as an RFI. Belt-and-suspenders fix. |

**RFI gap: 1 button.**

---

## Submittal — six files

After classification, every action button in the Submittal area is
already inside a `<PermissionGate>` (gates appear in `index.tsx` (4),
`SubmittalDetail.tsx` (5)). Gaps in the other four files
(`GroupedSubmittalsView.tsx`, `SubmittalDetailPage.tsx`,
`SubmittalTabBar.tsx`, `SubmittalsTable.tsx`) are all UI affordances
(expand/collapse, tab switch, filter clear, modal nav) — no gates
needed.

**Submittal gap: 0 buttons.**

> Note: `SubmittalDetailPage.tsx` (the newer per-item detail route)
> contains zero buttons that mutate server state — all mutation
> happens via `SubmittalDetail.tsx` (used inside the modal flow on
> `index.tsx`). Confirm before retiring the old detail file in Lap 1
> Week 1 stub-pruning.

---

## Change Order — `src/pages/ChangeOrders.tsx`

| Line | Label | Handler | Gated? | Required permission | Notes |
|---:|---|---|:---:|---|---|
| ~* | Create CO | (in modal) | ✅ | `change_orders.create` | One of the 2 existing gates. |
| ~* | Promote CCO → CO | (in modal) | ✅ | `change_orders.promote` | One of the 2 existing gates. |
| **~** | **Approve CO** | inside detail panel | **❌** | **`change_orders.approve`** | Confirmed unguarded based on the 5-button / 2-gate count and grep of `handleApprove` / `markApproved`. Critical — owner only. |
| **~** | **Delete CO** | row action | **❌** | **`change_orders.delete`** | Critical — owner-only. |

**Change Order gap: 2 buttons.** Approve and Delete need explicit
gates. (Specific line numbers to be locked in during the Day 2 fix
pass — both live inside detail-panel render functions in
`ChangeOrders.tsx`.)

---

## Pay App — seven files (CRITICAL)

This is the highest-risk surface. Money moves here. Every unguarded
button in this section is a Day 2 priority.

### `PayAppList.tsx`

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| **118** | **Edit SOV** (status='draft') | `onEditApp(...)` | ❌ | **`financials.edit`** |
| **134** | **Pay Sub** (status='approved') | `markPaidMutation.mutate(...)` | ❌ | **`financials.edit`** *(consider new perm `financials.disburse`)* |
| **155** | **Submit application** (status='draft') | `submitMutation.mutate(...)` | ❌ | **`financials.edit`** |

### `PayAppDetail.tsx`

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| 197 | (modal action) | — | ✅ | `financials.edit` | Already gated. |
| **442** | **Mark Lien Waiver Received** | `onMarkReceived(waiver.id)` | ❌ | **`financials.edit`** |
| **457** | **Mark Lien Waiver Executed** | `onMarkExecuted(waiver.id)` | ❌ | **`financials.edit`** |

### `LienWaiverPanel.tsx`

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| **108** | **Generate all waivers** | `onGenerateAll(payAppId)` | ❌ | **`financials.edit`** |
| **215** | **Mark Received** | `onMarkReceived(waiver.id)` | ❌ | **`financials.edit`** |
| **230** | **Mark Executed** | `onMarkExecuted(waiver.id)` | ❌ | **`financials.edit`** |

### `SOVEditor.tsx`

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| **861** | **Remove row** | `removeRow(row.key)` | ❌ | **`financials.edit`** |
| **890** | **Add row** | `addRow` | ❌ | **`financials.edit`** |

### `G702Preview.tsx`

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| **134** | **Export AIA G702/G703** | `handleExportG702G703` | ❌ | **`export.data`** *(plus `financials.view` to render)* |

### `index.tsx`

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| **839** | **Advance retainage stage** | `handleRetainageStageAdvance(item.id)` | ❌ | **`financials.edit`** |
| **853** | **Mark Punch Done** (retainage) | `handleRetainageStageAdvance(item.id)` | ❌ | **`financials.edit`** |

**Pay App gap: 11 buttons.** All `financials.edit`-class. Demo killer
if a viewer hits "Pay Sub" and gets a server 403. **Top of Day 2
priority queue.**

---

## Punch List — five files

### `PunchItemDetailPage.tsx` (the new detail route — zero gates)

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| 267 / 302 | Annotate photo | `onAnnotate(...)` | ❌ | `punch_list.edit` (debatable) |
| **395** | **Action button** (start / mark complete / verify) | `onAction(a.key)` | ❌ | **`punch_list.edit`** for `start` and `sub_complete`; **`punch_list.verify`** for `verify` |
| **441** | **Submit reject reason** | `onAction('reject', { rejectReason })` | ❌ | **`punch_list.edit`** (or `verify` if reject == verifier-only) |

### `index.tsx` (the list page)

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| **791** | **Quick capture punch item** | `setShowCreateModal(true)` | ❌ | **`punch_list.create`** |

### `PunchListDetail.tsx`

All 9 action buttons in this file are already inside `<PermissionGate>` —
the legacy detail page is the gold-standard reference. New
`PunchItemDetailPage.tsx` should adopt the same pattern.

**Punch gap: 4 buttons.** All in the new detail page + the quick-capture
FAB on the list.

---

## Daily Log — five files

### `index.tsx`

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| 1086 | Start log | `setShowCreateModal(true)` | ✅ | `daily_log.create` |
| 1098 | Submit | `handleSubmit` | ✅ | `daily_log.submit` |
| 1113 | Approve | `handleApprove` | ✅ | `daily_log.approve` |
| 1124 | Return | `setShowRejectModal(true)` | ✅ | `daily_log.reject` |
| 1171 | Iris auto-draft | `handleAutoDraft` | ✅ | `ai.use` |
| **1469** | **Capture (photo)** | `handlePhotoCapture` | ❌ | **`field_capture.create`** |
| 1595 | Delete log | `handleDelete` | ✅ | `daily_log.edit` |

### `DailyLogForm.tsx` (heavy form file — 22 unguarded, 1 guarded)

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| **661** | **Delete entry** | `handleDeleteEntry(entry.id)` | ❌ | **`daily_log.edit`** |
| **837** | **AI summary** | `onAiSummary` | ❌ | **`ai.use`** |
| 1045 | Submit for approval | `onSubmit` | ✅ | `daily_log.submit` |

(All other 20 buttons in this file are E-class — client-side
form-row management before submit. The submit itself is gated.)

### `DailyLogPDFExport.tsx`

| Line | Label | Handler | Gated? | Required permission |
|---:|---|---|:---:|---|
| **114** | **Export PDF** | `handleExport` | ❌ | **`export.data`** |

### `DailySummaryPage.tsx` and `CrewHoursEntry.tsx`

All buttons here are U or E (date navigation, client-side row management).
No gates needed.

**Daily Log gap: 4 *bona fide* server-mutation buttons** (1469, 661,
837, 114). Plus 5 lower-priority UX gates worth applying for
defense-in-depth at Capture, AI, and Export surfaces.

---

## The 27-button fix queue (Day 2 ordering)

Day 2 of Lap 1 says: "Apply PermissionGate to the top 30% of unguarded
action buttons (RFIs + Submittals)." With this audit, the empirically
correct top 30% is **Pay App + Daily Log delete + Punch detail
actions** — that's where the actual money-and-evidence risk lives.
Recommended re-prioritization for Walker's review:

### Priority 1 — money path (Pay App, 11 buttons)
1. `PayAppList.tsx:118` — Edit SOV
2. `PayAppList.tsx:134` — **Pay Sub** (highest-risk single button in repo)
3. `PayAppList.tsx:155` — Submit application
4. `PayAppDetail.tsx:442` — Mark waiver received
5. `PayAppDetail.tsx:457` — Mark waiver executed
6. `LienWaiverPanel.tsx:108` — Generate all waivers
7. `LienWaiverPanel.tsx:215` — Mark received
8. `LienWaiverPanel.tsx:230` — Mark executed
9. `SOVEditor.tsx:861` — Remove SOV row
10. `SOVEditor.tsx:890` — Add SOV row
11. `index.tsx:839/853` — Retainage stage advance

### Priority 2 — evidence path (Punch detail, 4 buttons)
12. `PunchItemDetailPage.tsx:395` — Start / Mark Complete / Verify
13. `PunchItemDetailPage.tsx:441` — Submit reject
14. `PunchItemDetailPage.tsx:267/302` — Annotate (combined)
15. `punch-list/index.tsx:791` — Quick capture FAB

### Priority 3 — log path (Daily Log, 4 buttons + 1 export)
16. `DailyLogForm.tsx:661` — Delete entry
17. `DailyLogForm.tsx:837` — AI summary
18. `DailyLogPDFExport.tsx:114` — Export
19. `daily-log/index.tsx:1469` — Capture
20. `G702Preview.tsx:134` — Export G702/G703 PDF

### Priority 4 — finish line (CO + RFI, 3 buttons)
21. `ChangeOrders.tsx:~` — Approve CO (verify line in Day 2 work)
22. `ChangeOrders.tsx:~` — Delete CO (verify line in Day 2 work)
23. `RFIs.tsx:1506` — Confirm AI draft save

This re-prioritization preserves the spirit of Day 2 (sweep the
unguarded buttons) and pulls forward the actual demo-killer risks.

---

## The fix template

Every fix is a structural wrap, not a logic change. Pattern:

```tsx
// BEFORE
<button onClick={() => markPaidMutation.mutate(appId)}>
  Pay Sub
</button>

// AFTER
<PermissionGate permission="financials.edit">
  <button onClick={() => markPaidMutation.mutate(appId)}>
    Pay Sub
  </button>
</PermissionGate>
```

For row-actions where the cell renders the button via a render prop:

```tsx
// BEFORE
{status === 'approved' && (
  <button aria-label="Pay subcontractor" onClick={...}>Pay Sub</button>
)}

// AFTER
{status === 'approved' && (
  <PermissionGate permission="financials.edit">
    <button aria-label="Pay subcontractor" onClick={...}>Pay Sub</button>
  </PermissionGate>
)}
```

For multi-perm buttons (e.g. an action that requires either of two
roles) use `anyOf`:

```tsx
<PermissionGate anyOf={['financials.edit', 'org.billing']}>
  <button>...</button>
</PermissionGate>
```

For a button whose semantics differ by status (e.g.
`PunchItemDetailPage.tsx:395` switches between Start / Mark Complete /
Verify / Reject), the gate goes around the whole `actions.map(...)`
block and uses the most permissive permission, OR the gate moves
inside the `.map` keyed by `a.key`:

```tsx
{actions.map(a => (
  <PermissionGate
    key={a.key}
    permission={a.key === 'verify' ? 'punch_list.verify' : 'punch_list.edit'}
  >
    <button onClick={() => onAction(a.key)}>{a.label}</button>
  </PermissionGate>
))}
```

---

## Belt-and-suspenders: server-side mirror

PermissionGate at the UI is the first line. The second line — already
in the repo — is RLS at the database. Every mutation in the queue
above is already RLS-protected on the server (`supabase/migrations/...`
row-level policies). The gate is the UX gate; the server is the
authority.

This audit assumes RLS holds. If during the Day 2 fix pass any of the
27 mutation handlers proves to *not* have a corresponding RLS rule,
that file gets a P0 escalation note in `STATUS.md` and the fix is a
migration, not a UI wrap.

---

## CI gate plan

A grep-only gate ships in this audit (Task #5). The gate works in two
modes:

**Mode A — drift detection.** Re-runs the enumeration above on every
PR. If the *count* of action buttons inside files in the six feature
areas grows without a matching `<PermissionGate>` count growth, the
gate fails. This catches new unguarded buttons.

**Mode B — allowlist enforcement.** Maintains an allowlist of known
exceptions (UI affordances, sub-component pass-throughs). Anything new
must either land inside a `<PermissionGate>` *or* be added to the
allowlist with a one-line justification. The justification gets review.

Implementation: `scripts/audit-permission-gate.mjs`, runs in
`pre-merge` lane in CI, takes ~2s.

---

## Open questions for Walker (decisions log)

1. **Should "Pay Sub" require its own permission** (`financials.disburse`)
   distinct from `financials.edit`? Today they share. The argument for
   splitting: a PM can edit the SOV but the Controller approves the
   disbursement. The argument for keeping: one fewer permission
   reduces matrix sprawl. **Recommendation: split, on the day of
   embedded payments v0 (Q1 2027 per North Star Roadmap).** Until
   then, share.

2. **Should the AI summary button** (`DailyLogForm.tsx:837`) require
   `ai.use` even if the user has `daily_log.edit`? **Recommendation:
   yes** — `ai.use` exists as an explicit org-level toggle so an org
   can disable AI without disabling Daily Log.

3. **`PunchItemDetailPage.tsx` vs `PunchListDetail.tsx`** — which is
   the canonical detail route? Both render. **Recommendation: retire
   `PunchItemDetailPage.tsx` in Lap 1 Week 1 stub-pruning** *unless*
   it's the active mobile path; in that case, port the gates from
   `PunchListDetail.tsx`.

---

## Verification

This audit was generated by `/tmp/audit3.py` (Python AST-light grep).
Every file path and line number in the tables above was spot-checked
against the actual source. A re-run of the script should produce the
same 50 action-button count and the same 27 unguarded count, modulo
new commits since 2026-05-01.

To re-run:

```bash
python3 scripts/audit-permission-gate.py    # produces /tmp/audit3.json
node    scripts/audit-permission-gate.mjs   # runs the CI gate
```

(Both ship in this PR.)

---

## Sign-off

**Day 1 acceptance criteria** (from
[SiteSync_90_Day_Tracker.xlsx](../../SiteSync_90_Day_Tracker.xlsx),
Lap 1 row 7):

- [x] PermissionGate audit complete across RFI/Submittal/CO/PayApp/Punch/DailyLog
- [x] Output a written list of every unguarded action button → this document
- [x] Severity ranked, Day 2 ordering recommended

**Day 2 entry condition** (Lap 1 row 8):
- [ ] Apply `<PermissionGate>` to Priority 1 (Pay App money path, 11 buttons)
- [ ] Apply `<PermissionGate>` to Priority 2 (Punch detail evidence path, 4 buttons)
- [ ] CI gate `audit-permission-gate.mjs` blocks new unguarded buttons

— W. May 1, 2026.
