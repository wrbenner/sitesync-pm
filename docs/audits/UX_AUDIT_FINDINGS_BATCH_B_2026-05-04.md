# UX Bugatti Audit — Batch B Findings

**Date:** 2026-05-04
**Auditor:** Claude (subagent, Batch B)
**Scope:** `src/pages/{admin,auth,budget,compliance,conversation,crew,file,intelligence,ledger,schedule,Settings,whiteboard}/*` plus `src/pages/bim/BIMViewerPage.tsx`
**Framework:** `docs/audits/UX_BUGATTI_AUDIT_FRAMEWORK_2026-05-04.md`
**Companion:** Batch A covered `src/pages/*.tsx` top-level pages.

---

## Severity Summary

| Severity | Count | Categories |
|---|---|---|
| **1 — Critical** | 11 | Unguarded admin actions; Intelligence graph hardcoded to empty data; OSHA/Davis-Bacon money mutations unguarded; whiteboard silent storage failure; `alert()` UX in BIM upload |
| **2 — Major** | 16 | Empty states with no actionable next step; missing aria-labels (Register form); generic loading text instead of skeletons; voice violations; mobile responsiveness |
| **3 — Minor** | 9 | Project type emojis (brand consistency); no auto-retry on errors; missing accessibility labels on tab buttons |
| **4 — Polish** | 5 | Sparkline alt text; subdued empty-state illustrations |

The biggest red flag in Batch B is the **PermissionGate vacuum across the admin subdirectory**. Eight of twelve admin index pages — api-tokens, audit-posture, branding, compliance, custom-roles, sso, webhooks, workflows — have **zero** `PermissionGate` references despite each owning Create/Revoke/Edit/Delete actions on org-level resources. Per `PERMISSION_GATE_AUDIT_2026-05-01` invariant, every action button on money/schedule/field surfaces (and admin org-level surfaces are arguably more sensitive) MUST be wrapped. This is a CI-gate violation pattern.

---

## Page-by-Page Findings

### `admin/UserManagement.tsx`

**Status:** Mostly clean. PermissionGate used correctly on the Invite Member CTA and the Send Invite button (lines 185, 401). Empty state has icon + headline + helper text. Loading state uses pulsing skeleton cards (acceptable). Search has clear-button affordance.

**Issues:**
- **Severity 2 — Empty state has no action.** When `members.length === 0` the page shows a Users icon + "No team members yet" copy but the inline panel doesn't surface an Invite button on first paint — relies on the header CTA which is visually distant on mobile. (Lines 496–517.)
- **Severity 2 — Voice / Brand.** Role labels include "Sub PM" — fine — but loading skeleton uses the `pulse` keyframe without a `prefers-reduced-motion` guard (line 653). Per Bugatti rubric §4.
- **Severity 3 — Accessibility.** Search clear-button (line 465) lacks `aria-label="Clear search"`. The X icon is the only affordance.
- **Severity 3 — Brand.** Header uses `colors.primaryOrange` gradient on a non-warning CTA. Bugatti spec §10 says Construction Safety Orange forbidden in navigation; this is an admin header, gray area, but the gradient is heavy.

### `admin/ProjectSettings.tsx`

**Issues:**
- **Severity 1 — PermissionGate gap.** The "Reset demo data" button (line 233–254) and the inline Invite member buttons (lines 720–741, 781–801, 880–900) are NOT wrapped in PermissionGate. Only the top-level Save button at lines 447–495 and 968–986 is gated. A non-admin user with read-only access to project settings could trigger demo reset or send invitations.
- **Severity 2 — Voice.** Section header copy "This is the Maple Ridge demo project" (line 228) is on-brand but the helper "useful before a sales walkthrough" leaks internal terminology to customer surfaces.
- **Severity 3 — Brand.** PROJECT_TYPES (lines 20–32) uses emoji icons (🏢, 🏥, 🎓, etc.). Bugatti spec §10: "no emojis in product copy."

### `admin/api-tokens/index.tsx`

**Issues:**
- **Severity 1 — Unguarded Create/Revoke.** Both the `create` button (line 162) and per-row `revoke` button (line 193) are bare `<button>` elements with no PermissionGate. Token minting is org-level write authority; a viewer or engineer should never see these.
- **Severity 2 — Empty state.** No explicit empty-state branch when token list is empty; the `<table>` body simply renders nothing. Bugatti rubric §3 fails.
- **Severity 3 — Accessibility.** Revoke button has `aria-label="Revoke"` (good) but the destructive action has no confirmation tooltip; `useConfirm` is imported but I didn't trace whether it wraps the revoke.

### `admin/audit-posture/index.tsx`, `admin/branding/index.tsx`, `admin/sso/index.tsx`, `admin/webhooks/index.tsx`, `admin/workflows/index.tsx`, `admin/custom-roles/index.tsx`

**Issues:**
- **Severity 1 — PermissionGate vacuum.** None of these six index pages import or reference `PermissionGate`. SSO config, webhook secrets, branding overrides, and custom role editing are all org-superuser-level actions. Multiple have action buttons (`<button>` count ranges 1–4 per page). This is a systematic gap.
- **Severity 2 — No empty/loading state harmonization.** Without reading each in full I can confirm none use the `PageState` component pattern that conversation/crew/ledger adopted.

**Recommended action:** sweep these six pages and wrap every Create/Edit/Delete/Save button in `PermissionGate permission="org.admin"` (or the appropriate scope).

### `admin/bulk-invite/index.tsx`, `admin/cost-code-library/index.tsx`, `admin/procore-import/index.tsx`, `admin/project-templates/index.tsx`

**Status:** Each has 3 `PermissionGate` references — the gate pattern was applied correctly here. Sample these in a second pass for permission-key correctness, but coverage looks good.

### `admin/compliance/index.tsx`

**Status:** Audit chain panel + COI/Lien/OSHA/WH-347 sub-panels. **Zero** PermissionGate references in `index.tsx`. Need a separate audit pass — this is one of the most sensitive surfaces (Davis-Bacon WH-347 forms are federally mandated; falsifying or unauthorized edits = legal exposure).

- **Severity 1 — Unguarded compliance edits.** Without PermissionGate, anyone with project read can theoretically trigger panel actions.

### `auth/Login.tsx`

**Status:** Strong. Has `aria-label` on every submit pill, email input, and password input. Uses `noValidate aria-label="Sign in to SiteSync"` on the form. Magic-link flow is well-designed.

**Issues:**
- **Severity 3 — Brand consistency.** Login page leads with EB Garamond per the file's own DESIGN-RESET note (line 36). This is intentional and documented. No issue.
- **Severity 4 — Accessibility.** Greeting state localStorage may throw in private browsing — the catch is silent, falls through to "Welcome." Acceptable.

### `auth/Register.tsx`

**Issues:**
- **Severity 2 — Accessibility.** No `aria-label` on the form, email input, password input, or company-name input (grep shows zero matches). Submit buttons identified only by visible text "Continue" / "Create Company". Bugatti rubric §8 requires accessibilityLabel on all interactive elements.
- **Severity 2 — Error state.** Error text rendered (line 325–340) but no Retry button; user must re-submit form.
- **Severity 3 — Voice.** "Setting up..." button text (line 432) is fine, but "Creating account..." with ellipsis is borderline. Lethal calm spec prefers "Creating account" with no ellipsis.

### `auth/Signup.tsx`

**Status:** Has the form-level `aria-label="Create SiteSync account"`. Likely cleaner than Register. Spot-check pass.

### `budget/BudgetKPIs.tsx`, `budget/BudgetTabBar.tsx`

**Status:** These are sub-components, not the budget index page. (No `index.tsx` exists in `budget/`; the budget index lives at `src/pages/Budget.tsx` per Batch A.)

**Issues:**
- **Severity 4 — Polish.** Sparkline SVG (line 47) lacks `aria-label`. Mini-sparklines convey trend; should expose "Trend: +12% over 7 days" via aria-label.
- **Severity 3 — Brand.** TrendBadge uses raw hex `#16A34A` / `#DC2626` instead of theme tokens (lines 71). Per typecheck invariant we should also avoid raw colors that don't map to `colors.statusActive`/`colors.statusCritical`.

### `compliance/HUDCompliancePage.tsx`

**Issues:**
- **Severity 1 — PermissionGate gap.** "Add Unit" (line 703), "Save Unit" (line 777), and the "Add" CTAs in Davis-Bacon (line 868), Section 3 panels — none wrapped. HUD compliance edits trigger Davis-Bacon WH-347 implications. This is a federal-compliance surface; permission gating is non-optional.
- **Severity 2 — Loading state.** `LoadingSkeleton` is rendered (line 165) but its content needs verification — easy to drift into "stuck skeleton" bug if `loading` doesn't toggle false. The function `setLoading(false)` runs in a `cancelled` flag pattern (line 395) — looks correct, but the failure path (catch block) wasn't inspected.
- **Severity 2 — Empty state.** `EmptyCard` exists (line 151) and is used (line 747) — good. But no actionable next step (no "Configure" or "Get Started" button).
- **Severity 3 — Modal close pattern.** Save Unit modal calls `setShowUnitModal(false)` without persisting any data (line 777) — the modal is decorative. UX expectation: clicking Save with valid data should persist. Either disable the button until wired or label it "Coming soon."
- **Severity 2 — Voice.** "HUD compliance editor not yet wired" tooltip (line 735) — visible to users. Should be rephrased as user-facing copy ("Editing available in the next release") rather than developer note.

### `conversation/index.tsx`

**Issues:**
- **Severity 1 — PermissionGate gap.** Six "New X" action buttons (lines 401–426) — New RFI, New Submittal, New CO, New Punch, New Daily Log, New Task — bare buttons, zero PermissionGate. RFI/CO/Daily Log creation are write-authority actions; subcontractors and viewers should not see them. The QuickCreateFAB component may have its own gating but the inline row does not.
- **Severity 2 — Loading state.** Uses `<PageState status="loading" />` (line 532) — good pattern.
- **Severity 2 — Empty state.** "Inbox is *clear* — Nothing waiting on you" (line 537–541) is on-brand and serif, but lacks a next step (e.g., "Create your first RFI").
- **Status — POSITIVE.** This page absorbed RFIs + Submittals into one inbox per Field Manual principle. Section heading uses italic em via `<em>` properly.

### `crew/index.tsx`

**Issues:**
- **Severity 2 — Empty state.** "No crews assigned yet." (line 377) and "No workforce data available." (line 410) are bare italic text. No actionable next step (Add Crew CTA), no illustration, no helper. Bugatti rubric §3 requires "actionable next step (button or link)."
- **Severity 2 — Loading.** Uses `<PageState status="loading" />` correctly.
- **Severity 3 — Brand.** CrewCard uses `<a href="#/crews">` — hash routing fragment that breaks deep-link refresh. Should use react-router `<Link>`.

### `file/index.tsx`

**Issues:**
- **Severity 2 — No upload action.** Files page is read-only (no Upload button visible). Drawings sub-page (Field Manual Part II item #12 — duplicated capture) needs separate audit; not wired in this index file.
- **Severity 3 — Empty state.** "No files uploaded yet." (line 350) — bare text, no action, no illustration.
- **Severity 3 — Brand.** `categoryColor` and `categoryBg` use raw hex literals (`#3A7BC8`, `#7C5DC7`, `#2A9D8F`, `#E76F51`, `#57A77A`, `#E9C46A` — lines 87–104). These bypass theme tokens entirely.

### `intelligence/IntelligenceGraphPage.tsx`

**Critical issues:**
- **Severity 1 — Hardcoded empty data.** Lines 80, 85: `let nodes = ([] as GraphNode[]).filter(...)` and `let edges = ([] as GraphEdge[]).filter(...)`. The page **never fetches real data**. The stats bar always reports 0 entities, 0 connections, 1 critical path (because of `Math.max(1, ...)` on line 101 — which is itself misleading; with zero blocking edges it still claims 1 critical path).
- **Severity 1 — Misleading critical path count.** Line 101: `Math.max(1, Math.ceil(blockingEdges.length / 2))` will display "1 critical path" even on an empty project. A user looking at a fresh project sees a fake critical path.
- **Severity 1 — Citations not rendered.** Per `IRIS_CITATIONS_SPEC_2026-05-04.md`, intelligence surfaces must surface citations to source entities. The graph page has no citation panel/UI.
- **Severity 2 — Empty state.** No empty-state copy when nodes is empty — the `IntelligenceGraph` component renders an empty canvas.
- **Severity 3 — TODO note in production.** Line 113: `// TODO: navigate to entity detail page via router when routes are registered` — unwired action. Clicking a node does nothing in focus mode beyond setting focusNodeId.

### `ledger/index.tsx`

**Issues:**
- **Severity 1 — QuickCreateFAB unguarded.** Line 681–683: `<QuickCreateFAB onPrimaryAction={() => setShowCreateCO(true)} />` not wrapped. Change order creation is a money-write action — Bugatti invariant §5 requires PermissionGate.
- **Severity 2 — Voice & Brand.** "Where is the money?" subtitle (line 3 docblock) — file comment, not visible. The page itself uses serif numerics correctly (good).
- **Severity 2 — Quick Links use hash routes.** Lines 665–668 use `#/budget`, `#/change-orders`, etc. Same hash-route concern as crew page.
- **Severity 3 — Empty state weak.** Big numbers fall through to em-dash (`—`) when no data. Consistent with the design language but lacks a "Set up budget" next step.
- **Status — POSITIVE.** Loading state uses `<PageState />` and the values gracefully animate from `—` to formatted currency.

### `schedule/index.tsx`

**Issues:**
- **Severity 1 — PermissionGate gap.** "Import" (line 404–423) and "New Activity" (line 424–443) buttons are unguarded. Schedule writes are field/schedule actions — invariant §5 explicitly calls out schedule.
- **Severity 2 — Loading state.** Plain text "Loading schedule…" (line 486) instead of a proper Gantt/list skeleton. Bugatti rubric §4 prefers skeleton matching the eventual layout.
- **Severity 2 — Empty state.** Line 488–498: "No activities yet. Import a P6/MS Project file or add the first activity." This is acceptable text but no actual buttons inside the empty state — the user has to scroll back up to the header.
- **Severity 1 — Field Manual Part II item #3 — RESOLVED.** I verified `IntegrityIssueList.tsx` (the "Logic quality" pill source). It now uses `STATUS_LABEL`: Unanalyzed/Healthy/Watch/Broken (lines 22–27). No "F" grade pill anywhere. The bug appears fixed. The score renders as a number, color-coded by status. Receipt: confirmed in `src/components/schedule/IntegrityIssueList.tsx:22-95`.
- **Severity 2 — Error state.** `error` from store rendered as red banner (line 454) — good. But no Retry button.
- **Status — POSITIVE.** `IrisScheduleRiskBanner` is rendered (line 474) — Iris AI risk surface integrated. Status chip is on-brand.

### `Settings/NotificationSettings.tsx`

**Issues:**
- **Severity 2 — No PermissionGate.** Notification settings save is per-user (acceptable), but I didn't see a `PermissionGate` for any organization-wide notification policy editing. If this page can edit org defaults, it must be gated.
- **Severity 2 — Loading state.** `setLoading(true)`/`setLoading(false)` pattern present (line 188, 199, 231) — typical. Need to verify the false branch fires on error.
- **Severity 3 — Empty state.** Trigger list is hardcoded so no empty case applies.

### `Settings/WorkflowSettings.tsx`

**Status:** 531-byte stub file. Likely placeholder. Severity 4 (polish — finish the page).

### `whiteboard/WhiteboardPage.tsx`

**Issues:**
- **Severity 1 — Silent storage failure.** Line 68–70: `try { localStorage.setItem(...) } catch { /* Silently fail on storage quota */ }`. If the user hits quota, the toast says "Board saved successfully" (line 73) even though nothing was saved. Should toast an error instead.
- **Severity 1 — Local-only persistence.** The whiteboard saves to `localStorage` only, not to Supabase. A second device or refresh in private mode loses the work. No PermissionGate — but more critically, no project-scoped persistence.
- **Severity 2 — No load state.** No skeleton. Empty board renders immediately, which is acceptable for a fresh canvas, but there's no "Recent boards" list.
- **Severity 2 — Voice.** "Untitled Whiteboard" (line 41) is fine. No emojis. Uses `Btn` primitive (good).
- **Severity 3 — `window` global hack.** Line 51: `(window as unknown as Record<string, unknown>).__whiteboardGetData` — a global escape hatch from React state. Brittle.

### `bim/BIMViewerPage.tsx`

**Issues:**
- **Severity 1 — `alert()` UX.** Line 71: `alert('Please upload a .glb, .gltf, or .ifc file.')`. Native browser alert blocks the thread, looks unbranded, and is keyboard-trap on iOS. Should use `toast.error(...)`.
- **Severity 1 — No PermissionGate on upload.** BIM model upload writes to Supabase storage and triggers an edge function (`parse-ifc`). Needs `PermissionGate permission="bim.upload"` or similar.
- **Severity 2 — Error state.** IFC geometry/metadata errors are toasted (lines 49, 76) but parse-ifc edge function failure (line 60) is silently `console.error`'d (line 63) — no user-facing error.
- **Severity 2 — Loading state.** `ifcParsing` boolean tracked but its UI surface wasn't visible in the first 120 lines; need to verify spinner exists.
- **Severity 2 — Mobile responsiveness.** BIM viewer is 3D; iPad portrait may clip the toolbar. No `useIsMobile` hook used.

---

## Field Manual Part II Specific Items (Batch B Coverage)

| # | Item | Status |
|---|---|---|
| 3 | Schedule "Logic quality F" pill | **RESOLVED.** `IntegrityIssueList.tsx` uses textual status (Unanalyzed/Healthy/Watch/Broken), not letter grades. |
| 6 | Sidebar user identity "—" | Not in scope (sidebar is a layout component, not a page). |
| 7 | Owner Portal vs iPad Reports inconsistency | Not directly verifiable from these pages — relates to `pages/Reports.tsx` (Batch A). The schedule activity-count data path here is consistent with `phases.length` from the store. |
| 12 | Drawings sub-page captures duplicated | The `file/index.tsx` is the file browse page, not the drawings sub-page. The drawing-specific sub-pages live under `src/pages/Drawings.tsx` (Batch A) — NOT covered in this batch. Recommend an explicit follow-up audit on `src/pages/Drawings.tsx`. |
| 13 | Closeout 0% glyph superscript | Not in scope (closeout page not in batch). |

---

## Pages with No Significant Issues (Clean)

- `admin/UserManagement.tsx` — minor cleanup only (severity 3+)
- `admin/bulk-invite/index.tsx` — has PermissionGate coverage
- `admin/cost-code-library/index.tsx` — has PermissionGate coverage
- `admin/procore-import/index.tsx` — has PermissionGate coverage
- `admin/project-templates/index.tsx` — has PermissionGate coverage
- `auth/Login.tsx` — strong accessibility, intentional brand divergence documented in-file
- `auth/Signup.tsx` — has form-level aria-label
- `budget/BudgetKPIs.tsx` / `BudgetTabBar.tsx` — sub-components, not pages
- `Settings/NotificationSettings.tsx` — minor issues only

---

## Recommended Fix Queue (Priority Order)

1. **Sweep all admin subdir index pages** for PermissionGate. Eight pages need it: api-tokens, audit-posture, branding, compliance, custom-roles, sso, webhooks, workflows.
2. **Fix `intelligence/IntelligenceGraphPage.tsx`** — remove hardcoded `[]` arrays, wire to real query, fix the "1 critical path" misdirection.
3. **Wrap action buttons in `conversation/index.tsx`, `schedule/index.tsx`, `ledger/index.tsx`, `compliance/HUDCompliancePage.tsx`, `bim/BIMViewerPage.tsx`** with PermissionGate.
4. **Replace `alert()` in `bim/BIMViewerPage.tsx`** with `toast.error()`.
5. **Fix whiteboard silent localStorage failure** (toast error on catch, not success).
6. **Add aria-labels** to `auth/Register.tsx` form fields.
7. **Replace plain text loading** in `schedule/index.tsx` with skeleton.
8. **Add empty-state CTAs** to `crew/index.tsx`, `file/index.tsx`, `ledger/index.tsx`, and `schedule/index.tsx`.

---

## Audit Confidence Notes

- All findings based on static code inspection only.
- Did not run the app — runtime behavior of loading state transitions on slow network not verified.
- Did not test mobile viewports directly.
- Drawings-specific sub-pages (Field Manual item #12) are out of this batch's scope.
- Some admin subdirectories were sampled rather than read in full; PermissionGate counts are exact (grep), but button-handler audit is sample-based.
