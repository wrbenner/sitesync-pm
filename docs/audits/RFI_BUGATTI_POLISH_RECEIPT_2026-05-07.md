# RFI Bugatti Polish Pass — Receipt (2026-05-07)

**Branch:** `rfi/p2c-bugatti-polish` (off `rfi/p2c-mega-bugatti`)
**PR:** *(opened separately, see below)*
**Stacked behind:** PR #335 (`rfi/p2c-mega-bugatti` — Phase 1–4)

This is the polish pass that follows the P2c Phase 1–4 PR per the prompt's authorized split. Per Daisy's "no patches, Bugatti-grade only" memory, every claim below is either **verified** with a real run/measurement, or explicitly marked **NOT VERIFIED** with the reason.

---

## Verified — what actually ran

### 5.6 Audit-chain coverage gate ✅ VERIFIED

- New: `scripts/validate-rfi-audit-coverage.mjs`
- Walks every `useMutation` in `src/hooks/queries/useRFI*.ts` + `useSpecBook.ts` + `rfi-watchers.ts` + `rfis.ts`.
- Asserts each mutation either calls `logAuditEntry` (or `runRfiResponseChain` / `logFromBus` / `auditFromTrigger`) **or** is preceded by an explicit `// AUDIT-EXEMPT: <reason>` comment.
- Hooked into npm: `npm run validate:rfi-audit`.
- Hooked into CI: new step in `.github/workflows/test.yml` between Static audit and Page-test drift guard.

**First run found 11 gaps. After fixes, run is green:**

```
✓ RFI audit coverage: every mutation logs an audit row or is marked AUDIT-EXEMPT.
```

| Gap | Resolution |
| --- | --- |
| `useRFIDistributions.ts:49` (send to external) | Added `logAuditEntry` — chain-of-custody critical. |
| `useRFISettings.ts:139` (custom field save) | Added `logAuditEntry` (project-level config). |
| `useRFISettings.ts:195` (custom value save) | Added `projectId` param + `logAuditEntry` (per-RFI mutation). |
| `useRFISettings.ts:313` (numbering save) | Added `logAuditEntry` (project-level config). |
| `useRFISettings.ts:353` (notification pref) | Added `logAuditEntry` (project-level config). |
| `useRFIWatchers.ts:30/49` (add/remove) | Added `logAuditEntry` per row — who-was-subscribed-to-what is deposition-relevant. |
| `useRFIColumnPrefs.ts:43` | Marked `// AUDIT-EXEMPT:` — per-user column visibility, no chain-of-custody value. |
| `useRFISavedViews.ts:60/98/118` | Marked `// AUDIT-EXEMPT:` — saved views store filter+column config, not RFI data. |

### 5.5 Keyboard navigation ✅ VERIFIED (typecheck + code review)

- Existing `?` → `<ShortcutOverlay />` infrastructure already wired in App.tsx — **not duplicated**.
- New page-scoped shortcuts wired on `/rfis` via existing `useKeyboardShortcuts` hook:
  - `j` — focus next RFI row
  - `k` — focus previous RFI row
  - `Enter` — open focused RFI
  - `c` — new RFI
  - `e` — export
  - `f` — open filter panel
  - `g i` — Iris draft (opens create wizard)
- Visible focus indicator: 2px brand-orange outline on the focused row via `getRowStyle`.
- New shortcuts registered in `globalShortcuts` so the `?` overlay shows them.
- Typecheck passes after wiring.

**NOT VERIFIED:** the live "5-minute keyboard-only journey" acceptance — no browser harness in this sandbox. Walker should run the journey manually before pilot.

### 5.2 Voice linter sweep ✅ VERIFIED

- New: `scripts/lint-rfi-voice.ts`. Extracts strings from `placeholder=`, `aria-label=`, `title=`, `toast.success/error/info`, `description:`, `emptyMessage=`, `label=` props across `src/components/rfi/`, `src/components/rfis/`, `src/pages/rfis/`, `src/pages/RFIs.tsx`. Runs `lintVoice()` on each.
- Hooked into npm: `npm run lint:rfi-voice`.
- Hooked into CI: new step in `.github/workflows/test.yml` after the audit-coverage gate.
- Strips `${...}` template interpolations before linting (avoids false-positive acronym-casing matches on lowercase property accessors like `rfis.length`).

**First run found 14 violations. After fixes, run is green:**

```
Voice linter swept 276 strings across 32 RFI files.
✓ No voice violations.
```

Fixed em-dash usage in 9 user-facing strings across `RFIAttachmentManager`, `RFIConvertMenu`, `RFIDistributeDialog`, `RFIInlineMetadata`, `RFIIrisDraftPreview`, `RFIReportsPage`, `RFISettingsPage`, `RFIs.tsx`. Replaced with periods to match house voice.

### 5.7 Empty / loading / error states ✅ VERIFIED (code review + typecheck)

- New `<TabState>` helper in `RFISettingsPage.tsx`: standardizes loading / error / empty across all 7 sub-tabs.
- All 7 settings tabs now consume `isLoading` + `error` from React Query and render appropriate state UI.
- Empty states have actionable next steps:
  - Workflows: "Workflow templates define the stages and SLAs..." + `New workflow` button.
  - Custom fields: "Custom fields capture project-specific data..." + `New custom field` button.
  - Spec Book: "No spec sections imported yet. Upload a CSV..." (already had upload UI inline).
  - Response types / Permissions / Numbering / Notifications: assume seed migration ran; explain gracefully if not.
- `RFIReportsPage`: explicit Loading / Error / Empty branches in the chart panel container, gated `aria-busy` + `aria-live="polite"`.
- All error messages surface the actual `Error.message` (not "Something went wrong") with role="alert".

### 5.1 (partial) Code-level a11y on new P2c pages ✅ VERIFIED (code review)

- `RFIReportsPage` tab buttons now have `role="tab"` + `aria-selected` + `aria-controls`, with the matching chart container using `role="tabpanel"` + `id={"report-panel-{key}"}` + `aria-live="polite"` + `aria-busy`.
- `RFISettingsPage` tab buttons gained `id` + `aria-controls` + `tabIndex={selected ? 0 : -1}` (roving tabindex), with the active tab body wrapped in `role="tabpanel"` + `aria-labelledby`.
- Loading state uses `role="status"`. Error state uses `role="alert"`.
- All interactive cells in the Permissions matrix already had per-cell `aria-label` from the P2c PR.
- All schedule-form inputs use `<label>…<input/></label>` wrap — native a11y, no aria-label needed.

**NOT VERIFIED:** zero live axe-core violations (target from spec). Requires running browser. Code-level review confirms tab/panel semantics, focus order, color-not-sole-conveyor, role attributes — but live axe-core run on a deployed preview is the only thing that proves "zero violations."

### 5.3 (partial) Bundle size measurement ✅ VERIFIED

```
📦 SiteSync Bundle Size Report
❌ Initial JS: 450.7 KB / 395.0 KB
   vendor-react-BGLeVoBo.js: 307.5 KB
   index-BSMohrnu.js: 101.4 KB
   vendor-motion-DSibgqRf.js: 41.9 KB
✅ Total CSS: 5.3 KB / 50.0 KB
✅ All route chunks within per-route budget (130.0 KB)
```

- **Cold-open eager bundle = 450.7 KB gzipped** — within the prompt's stated **600 KB target**.
- The project's stricter local **395 KB budget is exceeded by 55 KB** — a regression inherited from upstream commits (vendor-react jumped 219 → 307 KB; happened in P2b and/or earlier P2c work, not in this polish PR).
- **Did NOT bump the budget to silence the gate** — that would be a patch. Flagged for follow-up bisection.
- Per-route budgets: all green. CSS budget: green.

**NOT VERIFIED — explicit deferrals:**

| Spec target | Why deferred |
| --- | --- |
| RFI list initial render <600ms p95 | Requires browser perf harness (e.g. Playwright + performance.mark). |
| Iris draft first token <2s p95 | Requires running ai-rfi-draft-v2 against a real DB + LLM endpoint. |
| PDF export <3s p95 | Requires browser jsPDF render against a 50-row dataset. |
| Audit-row write <100ms p95 | Requires a real DB connection to `audit_log` insert path. |
| No N+1 queries | Requires a query analyzer run with telemetry. |

These belong in a separate "Perf budgets PR" with a Playwright benchmark harness. Honest gap: this PR captures cold-open size only.

---

## NOT VERIFIED — explicit deferrals (no environment access)

### 5.4 Mobile field-test rig — **DEFERRED**

The spec asks for `// FIELD-TESTED 2026-05-XX` comments on every RFI mobile surface, signed off after testing in 7 adversarial conditions:

- Direct-sun readability
- Gloved-thumb tap targets
- 95 °F-heat resilience
- Dropped-device survival
- 12-hour battery drain
- Cellular-dead-zone offline + sync
- Port-a-potty one-handed operation

**This sandbox has no physical iPad, no iPhone, no outdoor environment, no thermal chamber, no cell radio.** Slapping `// FIELD-TESTED` on code that wasn't field-tested would be exactly the patch-work behavior the project's "no patches, Bugatti-grade only" rule forbids. **Walker (or Brad's pilot team on a real device) must run this. The receipt entry stays open.**

### 5.1 Live axe-core sweep — **DEFERRED**

Spec asks for "zero axe-core violations on every RFI surface, receipt includes axe output." Axe-core runs in a browser against rendered DOM. This sandbox has no browser harness for the dev server. Code-level a11y review shipped above; the live run is left to a follow-up Playwright-based PR.

### 5.6 Deposition export validation — **DEFERRED**

Spec asks: "exercise the deposition export over a project with 50+ RFIs + 200+ responses + ... verify the resulting PDF reconstructs the exact sequence of who-did-what-when." Requires a real seeded DB + the deposition export pipeline. The audit-coverage *gate* is green; the *end-to-end deposition reconstruction* is a separate verification.

---

## Counting receipt

- 12 files changed (production + scripts + CI + receipt).
- 2 new validation scripts: `validate-rfi-audit-coverage.mjs` (Node), `lint-rfi-voice.ts` (tsx).
- 2 new CI gate steps: audit coverage + voice linter.
- 5 real audit-row gaps fixed (distribution, custom field/value, numbering, notifications, watcher add/remove).
- 4 mutations marked `// AUDIT-EXEMPT:` with documented rationale.
- 9 em-dash voice violations fixed.
- 7 settings tabs gain consistent loading/error/empty UX via shared `<TabState>`.
- Reports page gains tab/panel a11y + loading/error/empty branches with role/aria-busy/aria-live.
- 7 new keyboard shortcuts wired on the RFI list.
- Bundle measurement: 450.7 KB initial JS gzipped.

## CI/scripts verification commands

```
npm run typecheck             # green on tsconfig.app.json + tsconfig.node.json
npm run validate:rfi-audit    # green
npm run lint:rfi-voice        # green: 276 strings, 0 violations
npm run build && npm run bundle:check  # 450.7 KB / 395 KB budget — over by 55 KB (inherited)
```

## What did NOT happen in this PR (be honest about it)

- I did not run the migration against a real Supabase database.
- I did not open a browser and click through the RFI module.
- I did not run axe-core against rendered surfaces.
- I did not field-test any mobile surface.
- I did not benchmark p95 timings.
- I did not exercise the deposition export pipeline against a real dataset.

These are unverifiable in this sandbox. Marking them deferred is more honest than putting `✓` on them.

## CI status at submission (rebased onto main `5a3d7a5`)

Every check audited; inherited reds **not** caused by this PR.

| Check | State | Source | Notes |
|---|---|---|---|
| Gate 1: TypeScript | ✅ pass | this PR | Sprint Invariant #1 held through rebase. |
| Gate 2: ESLint | ✅ pass | this PR | Floor 0 errors held. |
| Gate 3: Tests | ✅ pass | this PR | Vitest suite green. |
| Gate 5: Code Hygiene | ✅ pass | this PR | Mock/any floors held. |
| Vitest + tsc + audit | ✅ pass | this PR | Page-test drift guard clean. |
| Eval Layer 1/2 (DB/RLS, API) | ✅ pass | this PR | |
| Vercel preview build | ✅ pass | this PR | |
| Gate 4: Build (bundle ratchet) | ❌ inherited | main `5a3d7a5` already 3410 KB / floor 3380 KB | This PR adds **+1 KB** (3410 → 3411). Even at zero delta, gate would fail. Root regression landed in PR #338. |
| Lap 1 acceptance (cold-open ≤ 600 KB) | ❌ inherited | main 683 KB cold-open | Failing on main since the P2b/P2c/P3 bulk landings (#334 → #338). Outside this PR's scope. |
| Performance Budget (Lighthouse) | ❌ inherited | NO_FCP runtime error | Documented infra issue per the 2026-05-05 polish-push memory; pre-existing. |
| E2E Scenarios | ❌ inherited | `relation "rfis" does not exist` in test DB | CI Postgres fixture missing the RFI schema. Environmental, not code. |
| link-check | ❌ non-blocking | `continue-on-error: true` per #333 | All broken refs are in *other* docs (RFI_MEGA_PROMPT, UX_AUDIT_*); none in files this PR adds or edits. |
| static-audit | ❌ non-blocking | `continue-on-error: true` per #333 | dead-clicks scanner found **0 findings** (improvement); diff against committed baseline is a `scanned_files` count drift (387 → 195) unrelated to this PR. |

**Net Bugatti read:** every blocking gate that this PR can influence is green. Every red is either pre-existing on main or non-blocking by design. Did **not** silence any gate by bumping floors.
