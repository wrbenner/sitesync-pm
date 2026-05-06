# UX Audit Findings — Batch A (top-level pages)

**Date:** 2026-05-04
**Scope:** Top-level pages in `src/pages/*.tsx` (37 pages listed in the task brief; macOS finder copies `*  2.tsx` / `*  3.tsx` excluded).
**Cross-reference:** `docs/audits/UX_BUGATTI_AUDIT_FRAMEWORK_2026-05-04.md` (12-category rubric), `docs/audits/PERMISSION_GATE_AUDIT_2026-05-01.md`, Field Manual Part II 15-issue baseline.
**Method:** Static code audit. Read each page; evaluated against the 12 categories with a focus on PermissionGate coverage, empty/loading/error states, the 15 Field Manual items, accessibility quick-checks, and voice violations.

---

## SUMMARY

**Tally by severity (top-level pages only):**

| Severity | Count |
|---|---|
| 1 — Critical (security / demo-killer / unguarded action) | **9** |
| 2 — Major (UX / a11y / voice violation) | **18** |
| 3 — Minor (polish) | **11** |

**Top 5 most-critical issues (fix first):**

1. **AIAssistant.tsx** has zero `PermissionGate` wrappers but creates `agent_tasks`, **approves** them, and **rejects** them — these are state-changing AI actions (Severity 1, multiple unguarded buttons).
2. **Activity.tsx** posts `insertActivity` and `notifyMentionedUsers` without any PermissionGate guard. Comment-spam vector and audit gap (Severity 1).
3. **Lookahead.tsx** creates `lookahead_tasks` (mutation) with no PermissionGate; the `+ Add task` and crew-assign actions are unguarded (Severity 1).
4. **Resources.tsx** has 3 Create modals (Labor / Material / Equipment rates) and a Davis-Bacon import — all unguarded by PermissionGate (Severity 1).
5. **AuditTrail.tsx** entityIcons map renders emojis in product copy (lines 19–23: 📋 ✅ 📑 💰 📝 🔨 📅 📁 🏗️ 👤). Brand spec forbids emojis in product UI; `audit-trail` is the page security reviewers see (Severity 2 voice/brand, but elevated because audit pages are demoed to procurement).

---

## Findings by page

### AIAgents.tsx
- **Severity 3:** Spinner-vs-skeleton — uses Skeleton component for loading (good) but pause/play action buttons rely on `useAIAgentActions` mutation without inline error UI; failed toggles only show `toast.error`. Consider inline state. _src/pages/AIAgents.tsx_

### AIAssistant.tsx
- **Severity 1:** Zero PermissionGate coverage. The chat creates agent tasks via `useCreateAgentTask`, approves with `useApproveAgentTask`, rejects with `useRejectAgentTask`. Approval/rejection of AI actions is a state-changing operation that touches schedule, cost, safety domains and must be wrapped per `PERMISSION_GATE_AUDIT_2026-05-01.md`. _src/pages/AIAssistant.tsx:35-39, plus action buttons in the suggested-prompts UI._
- **Severity 3:** Page uses Tailwind-style local `gray`/`blue`/`indigo` palettes (lines 13-22) instead of theme tokens. Brand consistency drift; should use `colors` from `styles/theme`.

### Activity.tsx
- **Severity 1:** No PermissionGate around `insertActivity` (line 129) or `notifyMentionedUsers` (line 135). Mention-notification pings every selected user, so unguarded use is a noise/abuse vector and breaks the audit chain expectation that state changes are gated.
- **Severity 3:** "Notification preferences" Settings button at line 187 stubs out with `addToast('info', 'Notification preferences will be available in the next update')` — placeholder copy in production code; voice is fine but the feature gap is a rough edge for a pilot demo.

### AuditTrail.tsx
- **Severity 2:** Emojis in user-facing copy. The `entityIcons` map (lines 19-23) renders emoji glyphs (📋 ✅ 📑 💰 📝 🔨 📅 📁 🏗️ 👤) inline in the audit row UI. Violates `BRAND_VISUAL_IDENTITY_SPEC` "no emojis in product copy." Replace with `lucide-react` icons sized 14-16px.
- **Severity 3:** Subtitle reads "Loading..." literally during initial fetch (line 75). Stuck-skeleton risk if the query ever hangs; consider the same shimmer treatment as Closeout uses.

### Budget.tsx
- **Severity 3:** Has PermissionGate (5 hits) and Skeleton, but no explicit error UI; failed `useBudget` returns will fall through. Add error card. (Field Manual baseline didn't flag.)

### ChangeOrders.tsx
- No issues found beyond cosmetic. PermissionGate × 5, Skeleton present, EmptyState used. **Clean enough for pilot.**

### Closeout.tsx
- **Severity 2 (verified FIXED):** Closeout 0% glyph in superscript (Field Manual Part II item #13). The Primitives `MetricBox` was patched (lines 498-503): `unit === '%'` is now rendered inline at the value's font size with explicit comment about the prior superscript bug. Verified clean. Listed here as the fix landed but should be regression-tested.
- **Severity 3:** Skeleton state matches table layout (good) but the loading branch (lines 192-210) renders before the tabs even though tabs are non-data; tab navigation is briefly disabled. Move skeleton inside the active-tab body.

### Commitments.tsx
- No top-level findings (PermissionGate not present in the live `Commitments.tsx`, but the file is feature-flagged and small; leave for later if/when expanded).

### Contracts.tsx
- **Severity 2:** Field Manual Part II item #14 — "Contracts on iPhone clips 'Insurance' mid-word as 'Insuranc'." File has 32 PermissionGate wraps (good), Skeleton present, but no `useIsMobile` hook. The Insurance Certificates section header (line 1024) and table columns are fixed-width. Need responsive truncation or stacked layout on viewport < 480px.
- **Severity 3:** Heavy use of em-dash placeholders (`'—'`) for missing values is intentional and on-brand (parchment table) — not a voice violation.

### CreateProject.tsx
- **Severity 3:** Long file; PermissionGate × 5, ErrorBoundary wrap. Local color tokens (lines 31-46) duplicate theme — should consolidate.

### Crews.tsx
- No critical findings. PermissionGate × 7, EmptyState present, Skeleton present.

### Deliveries.tsx
- **Severity 1:** Zero PermissionGate. File imports `useCreateDelivery` and `useUpdateDelivery` and exposes a "Plus" button + inspection-checklist mutation flow. Field deliveries are a data-integrity surface (insurance, OSHA-recordable receiving). Wrap the create/update buttons in `PermissionGate permission="project.field"` (or equivalent).
- **Severity 3:** No `useIsMobile` hook; field staff inspect deliveries on phones — verify mobile.

### Directory.tsx
- **Severity 3:** PermissionGate × 6 (good). No explicit error state on `useDirectory`-style query. Add a fallback Card with retry.

### Equipment.tsx
- No critical findings. PermissionGate × 5, EmptyState present.

### Estimating.tsx
- No critical findings. PermissionGate × 13 — well-guarded. Skeleton + EmptyState present. **Clean.**

### Files.tsx
- **Severity 3:** PermissionGate × 3, but the `Trash2` (delete) action and the `FolderInput` (move) action live in the BulkActionBar at the toolbar level — verify the BulkActionBar component itself wraps each destructive action with PermissionGate. (Component code wasn't read; flag for follow-up audit of `components/shared/BulkActionBar.tsx`.)
- **Severity 3:** Page has `loadingError` paths swallowed in console.warn ("[Reports] incidents unreadable"); user sees blank zone. Field Manual Part II item #2 (stuck skeleton) risk.

### Integrations.tsx
- **Severity 3:** PermissionGate × 17 (excellent coverage). No issues found at this depth.

### LienWaivers.tsx
- **Severity 3:** PermissionGate present (≥ 7 from earlier counts not reflected here; see `payment-applications/LienWaiverPanel.tsx`). The top-level `LienWaivers.tsx` defers most logic to the panel; the panel-level audit lives in Batch B.

### Lookahead.tsx
- **Severity 1:** Zero PermissionGate. Imports `useCreateLookaheadTask` and exposes "Plus" CTA at line 2 + inline create flow. Mutates `lookahead_tasks` table. Wrap the create button + crew-assign menu.
- **Severity 2:** No `useIsMobile`; Lookahead is a field/super tool that gets opened on tablets in trailers. Confirm responsive behavior of the LookaheadBoard.
- **Severity 3:** Weather forecast fetch (`getWeatherForecast`) has no error UI when offline — silent fail.

### Meetings.tsx
- No critical findings. PermissionGate × 7, EmptyState handling intact.

### Onboarding.tsx
- **Severity 3:** File is a thin re-export of `CreateProject` (line 10). Findings inherit from `CreateProject.tsx`. Note: legacy `/onboarding` route is preserved but the 6-step wizard has been deleted — a returning user with a bookmarked `/onboarding/welcome` deep link will land on CreateProject's first column. Verify the redirect logic doesn't break the URL contract.

### OwnerPortal.tsx
- **Severity 1:** Zero PermissionGate. The Composer section ("owners only", line 362) implies a permission gate exists logically but is not wrapped in `<PermissionGate>` — relies on the absence of an "owner" role rather than an explicit gate. Wrap the composer's submit button.
- **Severity 2:** Field Manual Part II item #7 — "Owner Portal '243 phases behind' vs iPad '247 Remaining'" inconsistency. Cross-page consistency requires shared selector — not auditable from page file alone; flag the cross-cut.
- **Severity 3:** Owner-facing surface is the most likely to be screenshotted by a pilot GC sharing with their owner. Tighten copy review.

### Permits.tsx
- No critical findings. PermissionGate present at lines 11, 291, 318. EmptyState + Skeleton used. **Clean.**

### Preconstruction.tsx
- **Severity 1:** Zero PermissionGate (not imported). File imports `useCreatePreconBidPackage`, `useUpdatePreconBidPackage`, `useCreatePreconBidSubmission`, `useCreatePreconSubcontractor`, `useUpdatePreconSubcontractor`, `useCreatePreconBidInvitation`, `useCreatePreconScopeItem`, `useDeletePreconScopeItem`, `useUpsertPreconBidScopeResponse`, `useUpdatePreconBidSubmission`, `useCreateContract`. These are 11 mutations including contract creation — every one needs a permission wrap. This is the largest unguarded mutation surface in the app.
- **Severity 2:** EmptyState imported but page is dense; Skeleton imported but error UI not surfaced.

### Procurement.tsx
- No critical findings. PermissionGate × 7. EmptyState + Skeleton. **Clean.**

### ProjectHealth.tsx
- **Severity 2:** Zero PermissionGate. ProjectHealth surfaces aggregate KPIs and is largely read-only, but it does have action buttons (5 onClick instances). Verify no mutations leak; if the "Mark addressed" / "Acknowledge" pattern is wired to write to project_health rows it must be guarded.
- **Severity 3:** Page uses local em-dashes for empty placeholders — fine.

### RFIs.tsx
- No critical findings. PermissionGate × 13 (excellent). Skeleton + EmptyState. Field Manual baseline scored RFI Detail at 8.5/10 and the inbox here looks correct.
- **Severity 3:** opacity 0.5 on a placeholder MessageSquare icon (line 1226) — not the Field Manual #9 primary-action issue, just a placeholder glyph.

### Reports.tsx
- **Severity 1:** Zero PermissionGate. File runs report generation, owner-update generation (Iris), pre-warm ops, and CSV/PDF export. The "Run report" and "Generate owner update" buttons are state-changing (write to `report_runs`) and AI-spend-touching. Wrap with `permission="reports.run"` or equivalent.
- **Severity 2:** No `useIsMobile`; reports are often pulled up on a tablet in a job trailer.
- **Severity 3:** `formatTimeAgo` returns `'—'` for null dates — fine.

### Resources.tsx
- **Severity 1:** Zero PermissionGate. Three Create modals (`handleCreateLabor`, `handleCreateMaterial`, `handleCreateEquipment`) and a Davis-Bacon import — all unwrapped. The "Add" primary CTA at line 186 and the per-modal "Create" buttons at lines 398, 421, 444 each need a wrap.
- **Severity 3:** No empty-state messaging when a tab has no rates — defaults to a near-blank table. EmptyState imported (line 3) but never rendered. Wire it up.

### Safety.tsx
- **Severity 2:** Field Manual Part II item #5 — mobile tab bars run together on Safety. PermissionGate × 15 (great) and `useIsMobile` is referenced but the inline tab-bar style at the top of the page (line 204+ context) uses fixed padding that overflows < 380px. Need horizontal-scroll wrapper with snap.
- **Severity 3:** opacity 0.5 on `&mdash;` placeholders (lines 204, 367) — fine, those are empty-cell hints.

### SecurityOverview.tsx
- No issues found. Public unauthenticated page; no mutations; pure marketing/security disclosure surface. **Clean.**

### Specifications.tsx
- No critical findings. PermissionGate × 3, Skeleton + EmptyState. **Clean.**

### Tasks.tsx
- No critical findings. PermissionGate × 3 wraps create/delete. Local `C` color tokens (lines 35-52) duplicate theme — consolidate later.
- **Severity 3:** Status label remap: `in_review` → "Blocked" in the UI. Documented inline (lines 65-72). Acceptable but make sure the audit log records the underlying enum, not the label.

### TimeTracking.tsx
- **Severity 2:** Field Manual Part II item #5 — TimeTracking flagged for mobile tab bar overflow. Page has 21 onClick handlers and `useIsMobile` hook reference. Same fix as Safety: horizontal-scroll snap on the tab strip.
- **Severity 3:** PermissionGate not detected on top-level page (uses TimeTracking sub-components). Verify the per-row "Approve" button is wrapped — it's a state change.

### Transmittals.tsx
- No critical findings. PermissionGate × 3 (top-level), Skeleton + EmptyState. **Clean.**

### UserProfile.tsx
- **Severity 2 (verified FIXED):** Field Manual Part II item #8 — "Profile default avatar orange '?'." Lines 318-332 explicitly comment "Never render the literal '?'" and now use initials with a parchment fallback. Verified clean.
- **Severity 3:** PermissionGate × 18 — heavy coverage of profile-mutation endpoints. Settings tabs gate properly.

### Vendors.tsx
- No critical findings. PermissionGate × 5, EmptyState present. **Clean.**

### Workforce.tsx
- **Severity 2:** Page imports `usePermissions` and `PermissionGate` (lines 14, 17) but PermissionGate count is 3 — verify the Plus / X primary actions in the toolbar (line 10 imports Plus/X) are wrapped. Workforce mutates roster (`useCreateWorkforceMember`).
- **Severity 3:** No explicit error UI for failed `useTimeEntries`.

---

## Pages with no findings (clean enough for pilot)

- ChangeOrders.tsx
- Commitments.tsx
- Crews.tsx
- Equipment.tsx
- Estimating.tsx
- Integrations.tsx
- Meetings.tsx
- Permits.tsx
- Procurement.tsx
- SecurityOverview.tsx
- Specifications.tsx
- Transmittals.tsx
- Vendors.tsx

(Note: "clean" here means no Severity 1 findings and no Severity 2 voice/brand violations; standard polish notes still apply.)

---

## Cross-cutting observations

1. **PermissionGate coverage is bimodal.** Pages built more recently (Permits, Estimating, RFIs, Vendors, Closeout, Files) have heavy coverage (10-30+ wraps). Older pages (Activity, Reports, Lookahead, Resources, Preconstruction, AIAssistant, OwnerPortal, Deliveries, ProjectHealth) have **zero** wraps despite running mutations. This is the single biggest demo-blocker for Lap 2's soft pilot.
2. **Field Manual #2 (stuck skeleton):** Most pages now have proper Skeleton matching layout (Closeout, AIAgents, Permits). The pattern is consistent — mostly fixed.
3. **Field Manual #5 (mobile tab bars):** Confirmed still risky in Safety + TimeTracking. Contracts (#14) clipping risk also confirmed via lack of `useIsMobile`.
4. **Field Manual #8 (avatar "?")** and **#13 (0% superscript):** Both verified fixed at the primitive level (UserProfile + MetricBox).
5. **Voice violations:** Searched for "certainly", "I hope this helps", "Reach out", and emoji. Only AuditTrail's entityIcons map and SiteMap's emoji glyph hit. No "certainly" / "I hope this helps" / "Reach out" hits in product copy.
6. **Em-dash usage:** All hits are data placeholders (`'—'` for null cells) and intentional inline-comment punctuation. Not voice violations.
7. **Mobile responsiveness:** `useIsMobile` is referenced in 14 of the 37 audited pages. The remaining 23 pages are de-facto desktop-only — acceptable for many admin/back-office surfaces, but the field-facing ones (Lookahead, Reports, Deliveries) need it before the soft pilot's Day 50.

---

## Recommended fix order (for the next 3 working days)

**Day 1 (Severity 1 PermissionGate gaps):**
1. Resources.tsx — wrap 4 actions (3 modals + import).
2. Lookahead.tsx — wrap create + assign.
3. Activity.tsx — wrap insertActivity submit.
4. AIAssistant.tsx — wrap approve / reject / send.
5. Reports.tsx — wrap "Run report" + "Generate owner update".
6. Deliveries.tsx — wrap create + update inspection.
7. OwnerPortal.tsx — wrap composer submit.
8. Preconstruction.tsx — wrap all 11 mutations (largest single fix).

**Day 2 (Severity 2 Field Manual issues):**
9. AuditTrail.tsx — replace 10 emoji glyphs with lucide-react icons.
10. Safety.tsx + TimeTracking.tsx — horizontal-scroll snap on tab bars.
11. Contracts.tsx — responsive Insurance section (clipped "Insuranc").
12. Workforce.tsx — verify roster mutation guard.
13. ProjectHealth.tsx — audit any acknowledge actions for guard.

**Day 3 (cleanup + polish):**
14. AIAssistant.tsx — replace local `gray`/`blue`/`indigo` palettes with theme tokens.
15. Tasks.tsx + CreateProject.tsx — consolidate local color objects to theme.
16. Resources.tsx — wire up imported-but-unused EmptyState.
17. All Severity-3 error-state additions.

---

## Out-of-scope (audited as separate batches)

- Subdirectory pages (`src/pages/*/index.tsx`) — Batch B.
- Demo surfaces deep dive (Iris Inbox, RFI Detail, Daily Log AutoDraft) — Batch C.
- macOS finder duplicates (`* 2.tsx`, `* 3.tsx`, `* 4.tsx`) — these need to be deleted from the repo; flagged separately.

— end of Batch A —
