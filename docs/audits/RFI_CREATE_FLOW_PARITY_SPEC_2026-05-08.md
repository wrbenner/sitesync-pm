# RFI Create Flow — Procore Parity Spec (2026-05-08)

**Trigger:** Walker — *"i still cant assign multiple people and check certain people when creating an rfi. has the create rfi been touched at all? we should have extensive research on all of this — we need to have creating an rfi have most of the stuff procore has. we need to add this and then focus on making it better."*

**Status:** Spec only — no code changes in this PR. Implementation is queued for a fresh session per the agent's recommendation (multi-step state refactor + chip editor + per-chip toggle + fan-out hook + tests = 6–10 hr of focused work, not a tail-end push).

**Drives:** Two predecessor docs:
- `RFI_FINAL_GAP_AUDIT_2026-05-07.md` (the live Procore walkthrough)
- `RFI_PROCORE_PARITY_FOLLOW_ON_RECEIPT_2026-05-07.md` (the deferral list)

This spec consolidates and extends them with a **Create-flow-specific** plan since the gap turned out to be larger than either prior doc captured.

---

## Why this spec is needed

The May-7 audit identified multi-assignee + per-person Response Required checkboxes as the #2 "Brad notices in 3 minutes" item. PR #351 closed that **on the Detail page** (rendering the existing `rfi_assignees` rows). It did **not** touch the **Create** flow, which still:

- Has a single `assignee` state field (`DirectoryContact | null`)
- Writes `assigned_to: null` to the DB on submit (line 486 of `RFICreateWizard.tsx`)
- Stuffs the chosen contact's name into the description string as a fallback
- Never inserts a row into `rfi_assignees`

Procore's Create form is functionally **its own surface** with ~22 fields, multi-select assignees with per-person checkbox, distribution list, default-from-Settings prefill, etc. SiteSync's Create form is a 9-field one-screen wizard with the Iris voice button. The Iris wedge is great — it doesn't replace the structural fields a PM needs to capture on creation.

---

## Inventory — Procore Create form (verified 2026-05-07 walkthrough)

22 fields organized in 2 sections + bottom bar.

**Request section (collapsible)**
1. Subject* (text, required)
2. Question* (full rich-text editor — bold, italic, lists, indent, font size, link, etc.)
3. Attachments (drop zone + chip per file with X-remove)

**General Information section (collapsible) — 4-column grid, 19 fields**
4. Number (text input, admin-overridable)
5. Due Date* (date)
6. RFI Manager* (single typeahead, required, with X-clear)
7. Status (read-only — driven by lifecycle, not free text)
8. Received From (single typeahead, X-clear)
9. **Assignees*** (multi-select with **a checkbox per assignee** — checked = responded; unchecked = "Response Required")
10. **Distribution List** (multi-select chips with X-remove + scrollable container + typeahead append)
11. Ball In Court (read-only, **computed live** from the un-checked Assignees rows)
12. Responsible Contractor (vendor typeahead with X-clear)
13. Specification (typeahead linked to spec book)
14. Location (typeahead linked to project locations / building / level / unit)
15. Created By (read-only)
16. RFI Stage (admin-defined dropdown enum)
17. Drawing Number (text — auto-link to drawings on display)
18. Cost Code (typeahead linked to budget)
19. Date Initiated (read-only)
20. Schedule Impact (Yes/No/TBD + days field)
21. Cost Impact (Yes/No/TBD + $ field)
22. Reference (free text)
23. Private (checkbox — default value pulled from Settings)

**Bottom bar:** `* required fields` legend · `Cancel` · `Create as Draft` · `Create as Open`

---

## Inventory — SiteSync Create form (current state on `main` post-PR-#365)

`src/components/rfis/RFICreateWizard.tsx` — 11-field one-screen modal.

| # | Field | State | Notes |
|---|---|---|---|
| 1 | Question | textarea (NOT rich text on create) | Conflates Procore's Subject + Question into one line |
| 2 | Details | TipTap rich text | Optional — covers Procore's Question richness if used |
| 3 | From | single PersonPicker (`fromContact`) | Auto-fills from session user |
| 4 | To / Assignee | **single** PersonPicker (`assignee` + `manualAssignee` fallback) | **THE GAP — single only** |
| 5 | Spec Section | text | No spec-book typeahead |
| 6 | Drawing Reference | text | No drawing auto-link |
| 7 | Due Date | date | Default +7d |
| 8 | Priority | 4-button pill picker | (Procore doesn't expose priority on Create — we win) |
| 9 | Attachments | drag-drop + Photo + File buttons | Functional |
| 10 | Iris Draft button | calls `ai-rfi-draft-v2` (PR #354) | **Wedge — beats Procore** |
| 11 | Save buttons | `Save as Draft` / `Create as Open` (PR #354) | ✅ Procore parity |

**`assigned_to` write:** the submit handler (line 486) explicitly writes `null` because `DirectoryContact` rows aren't auth users; the chosen name lands in the description string. **`rfi_assignees` is never written by Create.**

---

## Gap matrix (Create-flow only, severity-ranked)

Severity scale: **S1** = visible in 60-second demo · **S2** = visible in 5-minute walkthrough · **S3** = polish before paid GA · **S4** = nice-to-have.

### Tier S1 — Walker's stated complaint

| # | Capability | Procore | SiteSync today | Sev |
|---|---|---|---|---|
| 1 | Multi-select assignees on Create | ✅ | ❌ single only | **S1** |
| 2 | Per-assignee "Response Required" checkbox | ✅ checkbox per row | ❌ no concept on Create | **S1** |
| 3 | Distribution List multi-chip on Create | ✅ | ❌ no field at all | **S1** |
| 4 | `rfi_assignees` rows inserted on Create | required for chain integrity | ❌ never inserted | **S1** |

### Tier S2 — Procore-parity, visible to GC walkthrough

| # | Capability | Procore | SiteSync today | Sev |
|---|---|---|---|---|
| 5 | Default Distribution pre-fill | ✅ from project settings | ❌ (schema unblocked PR #365 — UI not wired) | **S2** |
| 6 | Subject + Question separated | ✅ two fields | ❌ Question + Details (different mental model) | **S2** |
| 7 | Schedule Impact (Yes/No/TBD + days) | ✅ on Create | ❌ Detail-page only | **S2** |
| 8 | Cost Impact (Yes/No/TBD + $) | ✅ on Create | ❌ Detail-page only | **S2** |
| 9 | Private flag | ✅ on Create, default from Settings | ❌ not on Create | **S2** |
| 10 | Watchers list on Create | ✅ multi-chip | ❌ not on Create | **S2** |
| 11 | RFI Manager separate from Assignees | ✅ | ❌ conflated with Assignee | **S2** |
| 12 | Required-field legend (`* required fields`) | ✅ | ❌ | **S2** |

### Tier S3 — Polish

| # | Capability | Procore | SiteSync today | Sev |
|---|---|---|---|---|
| 13 | Specification typeahead (spec book) | ✅ | ❌ free text | S3 |
| 14 | Drawing Number auto-link | ✅ | ❌ free text | S3 |
| 15 | Reference free-text field | ✅ | ❌ no field | S3 |
| 16 | Number override (admin) | ✅ | ❌ auto only | S3 |
| 17 | Two-column or wider form layout | ✅ collapsible 4-col grid | ❌ single column 580 px | S3 |
| 18 | Subject required-validation indicator | ✅ red `*` | ❌ no `*`, only canSend gate | S3 |

### Tier S4 — Procore-only, low business value for SiteSync

| # | Capability | Procore | SiteSync today | Sev |
|---|---|---|---|---|
| 19 | Responsible Contractor (vendor typeahead) | ✅ | ❌ not tracked on rfis | S4 |
| 20 | Location typeahead (building/level/unit) | ✅ | ❌ not tracked on rfis | S4 |
| 21 | RFI Stage admin enum | ✅ | ❌ status state-machine covers this | S4 |
| 22 | Cost Code linked to budget | ✅ | ❌ not tracked on rfis | S4 |
| 23 | Received From separate from Assignees | ✅ | ❌ conflated | S4 |

---

## Where SiteSync still wins on Create

These are the moats — implement the parity above without losing any of these.

| Wedge | Status | Don't trade for |
|---|---|---|
| Iris-on-Create voice/draft button (PR #354) | ✅ live | Demo moment: speak 30s, watch fields fill in |
| Cmd+Enter create | ✅ live | Speed |
| Auto-fill "From" from session user | ✅ live | Friction reduction |
| Duplicate-RFI detection on title | ✅ live | Quality of new RFIs |
| Single-screen wizard (not multi-step) | ✅ live | Procore is also single-page; we should stay one-screen even after adding fields |

---

## Recommended phased plan

Three PRs, sized for review burden + risk isolation. Each merges cleanly on its own.

### PR #366 — Create flow: multi-assignee + distribution + watchers (~3–4 hr)

**Closes Tier S1 (items 1–4) + part of Tier S2 (items 3, 5, 10).**

**State changes in `RFICreateWizard.tsx`:**

```ts
type AssigneePick = {
  // user_id is set when picked from the project member directory
  user_id?: string
  // email is set when free-typed (not an auth user)
  email?: string
  // role is captured on the chip (Procore's recipient_role enum from PR #365)
  role?: 'creator' | 'manager' | 'assignee' | 'distribution_group' | 'watcher'
  // Per-Procore: each assignee has a "Response Required" toggle. On Create
  // they default to TRUE (unchecked = response required), since the RFI is
  // asking for a response from this person. The Detail page's
  // RFIAssigneeStatusList is what flips this to FALSE (= responded).
  // We don't show the checkbox on Create — every assignee starts as
  // "needs to respond" by definition.
  display_name: string
}

const [assignees, setAssignees] = useState<AssigneePick[]>([])
const [distributionRecipients, setDistributionRecipients] = useState<AssigneePick[]>([])
const [watchers, setWatchers] = useState<AssigneePick[]>([])
```

**UI changes:**
- Replace single `<PersonPicker>` for "To" with `<UserChipEditor>` (the multi-select chip primitive that already exists in `src/components/rfi/UserChipEditor.tsx`).
- Add a new "Distribution" `<UserChipEditor>` section.
- Add a new "Watchers" `<UserChipEditor>` section (collapsed-by-default if no value, "Add watchers" link to expand).
- Default distribution pre-fill: on first render, hydrate `distributionRecipients` from `project_rfi_settings.default_distribution` (now schema-unblocked).

**Submit handler:**
```ts
// Fan out after the RFI insert succeeds
const newRfi = await insertRfi(...)
await Promise.all([
  ...assignees
    .filter((a) => a.user_id)
    .map((a) => insertRfiAssignee({ rfi_id: newRfi.id, user_id: a.user_id!, role: a.role ?? 'assignee' })),
  ...distributionRecipients.map((d) =>
    insertRfiDistribution({
      rfi_id: newRfi.id,
      recipient_email: d.email ?? lookupEmailFor(d.user_id!),
      recipient_name: d.display_name,
    })
  ),
  ...watchers
    .filter((w) => w.user_id)
    .map((w) => insertRfiWatcher({ rfi_id: newRfi.id, user_id: w.user_id! })),
])
```

**New hooks needed:**
- `useInsertRFIAssignees(rfiId)` — bulk insert into `rfi_assignees`
- The existing `useAddRFIWatcher` already exists and works
- The existing `rfi_distributions` insert path can be reused

**Acceptance:**
- Walker creates a new RFI, assigns 3 people in the To chip editor, adds 2 distribution recipients, picks 1 watcher, clicks Create as Open. After save:
  1. RFI exists with `created_by = current user`
  2. `rfi_assignees` has 3 rows (one per assignee)
  3. `rfi_distributions` has 2 rows
  4. `rfi_watchers` has 1 row
  5. Detail page renders all 3 assignees in `RFIAssigneeStatusList` with "Response Required" red text on each (since none have responded yet)

### PR #367 — Create flow: Schedule + Cost Impact + Private + RFI Manager + required-legend (~2 hr)

**Closes Tier S2 items 6–9, 11, 12.**

- Add `scheduleImpactStatus`, `scheduleDays`, `costImpactStatus`, `costImpactCents`, `isPrivate`, `rfiManager` state.
- Render impact pairs as Yes/No/TBD select + value input (matches the Edit panel from PR #355).
- Add Subject as a separate text input above the Question textarea.
- Render `*` next to required field labels (Subject, Question, Due Date, RFI Manager, Assignees).
- Add legend at bottom: `*` required fields.

**Acceptance:**
- Walker creates an RFI with Schedule Impact = Yes (5 days), Cost Impact = TBD, Private = checked. Submit: row has all three fields persisted.

### PR #368 — Create flow: Spec book typeahead + Drawing auto-link + Reference + Number override (~2 hr)

**Closes Tier S3 items 13–16, 18.**

- Spec section: typeahead reading from `project_spec_book`
- Drawing Reference: typeahead reading from `drawings` table
- Reference field: free text input
- Number override: PermissionGate `rfis.admin_edit_number`
- Subject required indicator (red `*`)

---

## Out of scope (named explicitly)

| Item | Why not |
|---|---|
| Tier S4 items 19–23 | We don't track Responsible Contractor / Location / Cost Code / RFI Stage / Received From on `rfis`. Adding any of these is its own schema migration + downstream UI; better as separate scoped PRs after the create flow shows demand |
| Two-column wider form layout | Procore's 4-col General Information section requires ~900 px; current 580 px modal is mobile-friendlier. Defer to a layout-only PR after content lands |
| Save & New batch creation | Procore-style PM workflow; deferred to a real-world ask |
| Create-as-template | Out of scope of this gap closure |

---

## File-level implementation map

| File | Change |
|---|---|
| `src/components/rfis/RFICreateWizard.tsx` | All state + UI + submit-handler changes (PRs #366, #367, #368) |
| `src/hooks/queries/useInsertRFIAssignees.ts` | NEW — fan-out hook for `rfi_assignees` (PR #366) |
| `src/hooks/queries/useProjectRFISettings.ts` | NEW or extend — read `default_distribution` (PR #366) |
| `src/components/rfi/UserChipEditor.tsx` | EXISTING — reuse for assignees/distribution/watchers (PR #366) |
| `src/test/components/rfis/RFICreateWizard.test.tsx` | NEW or extend — assert fan-out happens; test the per-assignee semantic |
| `e2e/rfi-create-multi-assignee.spec.ts` | NEW — Playwright walkthrough of the demo path |

---

## Sprint Invariants

- Typecheck zero on both tsconfigs (after each PR)
- PermissionGate every mutation: `rfis.create` on Create, `rfis.admin_edit_number` on Number override
- `<UserName />` for every user_id render in chip-editor read mode
- Per-entity audit_log on every state change — fan-out writes one audit row per `rfi_assignees` insert (the existing trigger handles this)
- Voice linter: 0 violations in any new strings (`npm run lint:rfi-voice`)

---

## Acceptance for the entire 3-PR sub-wave

Walker demos to Brad:

1. Click `+ New RFI` from the RFI list page.
2. See the new wider Create form with explicit Subject + Question fields, multi-chip Assignees + Distribution + Watchers sections, Schedule + Cost Impact pairs, Private toggle.
3. Type a one-line question, click `✨ Iris draft` — fields prefill (the wedge still works).
4. Add 3 assignees from the typeahead, see them appear as chips with each one's "Response Required" red text. Add 2 free-typed emails to Distribution. Optional: pick 1 watcher.
5. Set Schedule Impact = Yes (3 days), Cost Impact = TBD, Private unchecked.
6. Click `Create as Open`.
7. Land on the Detail page. See: 3 assignees in the AssigneeStatusList with checkboxes (all unchecked = needs response), 2 distribution chips, 1 watcher in the sidebar, Schedule/Cost impact pills populated. Audit log has one row for the create + one row per assignee insert + one per distribution + one for the watcher.
8. End-to-end: ~30 seconds with Iris-on-Create wedge; ~90 seconds without.

This brings Create flow to **~85% Procore parity** while keeping all 5 current SiteSync wedges (Iris draft, Cmd+Enter, auto-from, duplicate detection, single-screen).

---

## Sign-off

The May-7 audit and follow-on receipts captured the Create-flow gap *implicitly* (multi-assignee was filed under Detail-page rendering — Track A3). This spec extracts it as its own scoped wave because the user has used the create flow on live and surfaced the gap.

Walker's exact words: *"i still cant assign multiple people and check certain people when creating an rfi."* This spec exists to close that gap honestly, with proper schema + UI + tests, in a fresh session — not rushed at the tail of an already-long Bugatti session.

— Claude Opus 4.7 (1M context), 2026-05-08
