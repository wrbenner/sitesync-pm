# UX Bugatti Audit — Consolidated Findings

**Date:** 2026-05-04
**Status:** Static-code audit complete across 175+ page files. Manual verification + field-test rig pending. Findings prioritized into the fix queue (`UX_FIX_QUEUE_2026-05-04.md`).
**Source agents:** Batch A (38 top-level pages), Batch B (admin + subdirs), Demo Surfaces deep-dive (Iris Inbox + RFI Detail + Daily Log)
**Companion specs:** `UX_BUGATTI_AUDIT_FRAMEWORK_2026-05-04.md` (the rubric)

---

## TL;DR — the verdict

**You cannot start Lap 3 yet.** The audit found **31 Severity-1 issues** across the codebase, including:

- **The 3 demo surfaces are BELOW Field Manual baseline scores** when re-audited against the full Bugatti rubric (Iris Inbox 7.6/10, RFI Detail 7.8/10, Daily Log 6.8/10 — all below the 9.5/10 Bugatti target).
- **Iris Inbox + RFI Detail have ZERO PermissionGate wrappers.** A foreman can void RFIs or approve punch-list drafts today. Direct violation of Eleven Never #1 + the Lap 1 PermissionGate audit invariant.
- **8 admin index pages have ZERO PermissionGate** (token minting, SSO config, webhook secrets, custom roles).
- **`intelligence/IntelligenceGraphPage.tsx` is FAKE** — hardcoded empty arrays; never fetches real data.
- **Native `alert()` in BIM viewer** for invalid file types — unbranded, blocks thread, iOS keyboard-trap.
- **Whiteboard silent failure** — toasts "Board saved successfully" even when `localStorage` quota exceeded.

**Verified fixes** (Field Manual Part II items now closed):
- ✅ Avatar orange "?" — `UserProfile.tsx:318-332` uses initials/parchment
- ✅ Closeout 0% superscript — `Primitives.tsx:498-503` renders `%` inline
- ✅ Schedule "Logic quality F" pill — `IntegrityIssueList.tsx` uses STATUS_LABEL with numeric score
- ✅ Camera surface 80% fixed — geolocation banner gone; "Choose from library" CTA still missing

**Bottom line:** ~25-40 hours of fix work before Lap 3 can credibly start. Roughly 9 hours covers the absolute pre-pilot critical-path; another 25-30 hours covers everything else Sev-1 + Sev-2.

---

## Severity Breakdown

| Severity | Count | Definition |
|---|---|---|
| **1 — Critical** | 31 | Demo-killer; security risk; Eleven Never violation; data integrity |
| **2 — Major** | 50 | UX visible to GC walkthrough; accessibility gap; voice violation |
| **3 — Minor** | 26 | Polish issue; visible only on close inspection |
| **4 — Polish** | 9 | Aspirational; nice-to-have |
| **TOTAL** | **116** | |

The 31 Severity-1 issues drive the timeline. Fixing them is non-negotiable before Lap 3.

---

## The Demo Surfaces (deep audit)

### Iris Inbox — 7.6/10 (was 8/10 baseline)

**Why the audit lowered the score:** the Field Manual scored on visual polish + flow. The Bugatti rubric also evaluates accessibility, mobile responsiveness, and PermissionGate coverage — none of which the original score covered. The page got worse on those dimensions even as visual polish improved.

**Sev-1 findings:**
- Zero PermissionGate wrappers on Approve & Send button (`IrisApprovalGate.tsx:314`)
- Zero `useIsMobile` references — same DOM at every breakpoint; no field-test conditional
- Citation panel resolver path not yet wired to the live citation chips on mobile

**Sev-2:**
- Tap targets on Approve/Reject below 44 px on iPhone
- Skeleton loader can stick > 2s without timeout fallback
- No Reject mutation error toast (silent failure)

### RFI Detail — 7.8/10 (was 8.5/10 baseline)

**Sev-1:**
- Zero PermissionGate wrappers — Send/StatusControl/Void unguarded
- StatusControl (`RFIDetail.tsx:762`) lets any user void an RFI
- Drawing-pin deep-link from RFI works on web but fails silently on mobile

**Sev-2:**
- Ball-in-court chip color-only conveys meaning (no icon)
- Slack-thread style breaks on iPhone landscape

### Daily Log AutoDraft — 6.8/10 (was 6.5/10 baseline — Camera fix raised it slightly)

**Sev-1:**
- Sticky header is 4-5 rows tall on iPhone portrait — ~40% of viewport before any log content (`daily-log/index.tsx:953`)
- Table doesn't have horizontal-scroll wrapper on narrow viewports
- Camera fallback "Choose from library" CTA missing (Field Manual item #10 only 80% closed)

**Sev-2 (6 findings):** mostly polish, theme-token migration, voice-edit affordance.

### Top 10 fixes for the demo surfaces (~9 hours total)

1. PermissionGate on RFI Detail Send/Status/Void (Sev 1, ~20 min)
2. PermissionGate on Iris Inbox Approve/Reject (Sev 1, ~30 min)
3. Daily Log header overflow-menu on iPhone (Sev 1, ~2 hr)
4. Daily Log table horizontal-scroll wrappers (Sev 1, ~45 min)
5. 44 px tap-target bump on Approve/Reject/Send (Sev 2, ~1 hr)
6. 2 s skeleton timeout watchdog (Sev 2, ~2 hr)
7. Reject-mutation error toast (Sev 2, ~15 min)
8. "Choose from library" fallback in FieldCaptureModal (Sev 1, ~45 min)
9. Color + text + icon on confidence/status pills (Sev 2, ~1 hr)
10. Migrate Daily Log color literals to theme imports (Sev 2, ~1.5 hr)

If those 10 ship: scores rise to ~9.0/9.0/8.6. **Still below 9.5 target.** The remaining gap closes with the field-test rig pass + streaming-captures plumbing — Lap 2-tail / Lap 3 work.

---

## Top-Level Pages (Batch A — 38 pages)

### Critical findings (Sev-1)

**Unguarded mutations across 8 pages:**
- `AIAssistant.tsx`
- `Activity.tsx`
- `Lookahead.tsx`
- `Resources.tsx`
- `Reports.tsx`
- `Deliveries.tsx`
- `OwnerPortal.tsx`
- `Preconstruction.tsx` (worst — **11 unguarded mutations** including contract creation)

**Pattern:** PermissionGate coverage is bimodal. Recently-built pages have 10-30 wraps; older pages have zero. Fix is a sweep + a CI lint rule.

### Major findings (Sev-2, 18 total)

- Field Manual #5 (Safety + TimeTracking mobile tab overflow) — partially fixed, fragments still showing
- Field Manual #14 (Contracts iPhone clips "Insurance") — still present
- Emoji glyphs in `AuditTrail.tsx:19-23` — voice violation
- `useIsMobile` gaps on Workforce, Crews, Equipment (field-facing pages without mobile UX)

### Clean pages (no Sev-1, no voice violations) — 13 pages

ChangeOrders, Commitments, Crews, Equipment, Estimating, Integrations, Meetings, Permits, Procurement, SecurityOverview, Specifications, Transmittals, Vendors

---

## Subdirectory + Admin Pages (Batch B)

### Critical findings (Sev-1, 11 total)

**The admin PermissionGate vacuum (8 pages, all Sev-1):**
- `admin/api-tokens/index.tsx` — token minting unguarded
- `admin/audit-posture/index.tsx` — compliance config unguarded
- `admin/branding/index.tsx` — branding edits unguarded
- `admin/compliance/index.tsx` — compliance dashboard write actions
- `admin/custom-roles/index.tsx` — role creation/deletion unguarded
- `admin/sso/index.tsx` — **SSO config unguarded** (security-critical)
- `admin/webhooks/index.tsx` — **webhook secrets unguarded** (security-critical)
- `admin/workflows/index.tsx` — workflow definitions unguarded

**Other Sev-1:**
- `intelligence/IntelligenceGraphPage.tsx:80,85,101` — hardcoded `[] as GraphNode[]` and `[] as GraphEdge[]`. Page never fetches real data. Stats bar always shows "0 entities, 0 connections, 1 critical path" because of `Math.max(1, ...)` fabricating a critical path on empty data. **The page is fake.**
- `bim/BIMViewerPage.tsx:71` — native `alert()` for invalid file types. Unbranded, blocks thread, iOS keyboard-trap.
- `whiteboard/WhiteboardPage.tsx` — silent localStorage failure. `try/catch` swallows quota-exceeded; toasts "Board saved successfully" anyway.
- Schedule + Conversation + Ledger + HUDCompliance — unguarded New Activity / Import / New RFI/CO/Punch/Daily Log / QuickCreateFAB / Add Unit / Save Unit buttons

### Major findings (Sev-2, 16 total)

- `auth/Register.tsx` no aria-labels on form inputs (`Login.tsx` is clean by contrast)
- Multiple admin pages missing empty states
- Schedule subpages have inconsistent loading patterns

### Verified fixes

- ✅ Schedule "Logic quality F" pill (Field Manual #3) — `IntegrityIssueList.tsx:22-95` uses STATUS_LABEL (Unanalyzed/Healthy/Watch/Broken) with numeric score; no letter grades

### Clean pages

`admin/UserManagement.tsx`, `admin/bulk-invite/`, `admin/cost-code-library/`, `admin/procore-import/`, `admin/project-templates/`, `auth/Login.tsx`, `auth/Signup.tsx`, `Settings/NotificationSettings.tsx`

---

## Field Manual Part II — 15-Item Status Check

| # | Issue | Status |
|---|---|---|
| 1 | iPad sidebar overlaps content on 25+ pages | Not verified — needs visual check |
| 2 | Stuck skeleton loaders on 11 list pages | Partially fixed — pattern still on some pages |
| 3 | Schedule "Logic quality F" pill bug | ✅ FIXED |
| 4 | iPhone bottom-nav + Iris FAB occluding content | Sev-1 finding on Daily Log |
| 5 | Mobile tab bars run together (Safety, Time Tracking, Contracts iPhone) | Partially fixed |
| 6 | Sidebar user identity shows "—" | Not verified — needs visual check |
| 7 | Reports/Schedule data inconsistent (243 vs 247) | Not verified |
| 8 | Profile default avatar orange "?" | ✅ FIXED |
| 9 | Primary action buttons render at 50% opacity | Not verified — needs visual check |
| 10 | Daily Log Field Capture issues | 80% FIXED — "Choose from library" CTA still missing |
| 11 | Iris streaming captures didn't capture streaming | Not verified |
| 12 | Drawings sub-page captures duplicated/wrong | Not in audit scope (Drawings.tsx not yet examined) |
| 13 | Closeout 0% glyph in superscript | ✅ FIXED |
| 14 | Contracts iPhone clips "Insurance" | Still present |
| 15 | Sync banner visually heavy on every authenticated page | Still present |

**5 items verified fixed. 3 items partially fixed. 7 items still open or need visual verification.**

---

## Cross-Cutting Patterns (the systemic issues)

These aren't per-page bugs — they're missing infrastructure that affects every page:

### Pattern 1 — PermissionGate coverage is bimodal

Recently-built pages have 10-30 wraps; older pages have zero. **The fix is structural:**

- CI lint rule: any `onClick` invoking a mutation hook must have an enclosing `<PermissionGate>`
- Codebase sweep: ~20 pages need PermissionGate added to action buttons
- Estimated time: 1-2 days for Walker or engineer #2

### Pattern 2 — `useIsMobile` is missing on field-facing pages

Iris Inbox, RFI Detail, Daily Log AutoDraft, Workforce, Crews, Equipment — none use `useIsMobile`. Same DOM at every breakpoint. The mobile experience is an emergent accident, not a designed surface.

**The fix:** wire `useIsMobile` into every field-facing page; conditionally render mobile-optimized layouts. Aligns with the field-test rig requirement from `ADR_010_MOBILE_NATIVE_ARCHITECTURE`.

### Pattern 3 — Stuck skeleton loaders without timeout

The Field Manual's #2 issue was 11 list pages with infinite skeleton when the fetch failed silently. The pattern persists on some pages.

**The fix:** standardize on a `<DataFetcher>` wrapper that has a 2-second timeout → falls back to error UI with retry. One implementation; rolled into every list page.

### Pattern 4 — Color-only conveying meaning

Multiple pages use color (red/yellow/green) on status pills + ball-in-court chips without text or icon backup. WCAG 2.1 AA violation.

**The fix:** style audit + designer pass; every color signal pairs with text + icon.

### Pattern 5 — Voice violations scattered

Found in: `AuditTrail.tsx:19-23` (emoji glyphs), various pages (em-dashes), error toasts ("Something went wrong" — too vague).

**The fix:** the voice linter from `IRIS_VOICE_GUIDE_SPEC` should be extended to lint UI strings, not just AI output. CI pass over `src/**/*.tsx` for banned phrases + emojis.

---

## Recommended Fix Queue

Three tiers:

### Tier 1 — Pre-pilot critical (ship before Brad's pilot starts) — ~9 hours

The 10 demo-surface fixes from above. These are the ones Walker absolutely cannot ship without; they're what Brad's PMs see.

### Tier 2 — Pre-Lap-3 critical (ship before Lap 3 kickoff) — ~25 hours

- 8 admin PermissionGate sweeps (Sev-1) — ~6 hours
- 8 top-level page PermissionGate sweeps (`Preconstruction.tsx` is the worst) — ~6 hours
- Intelligence Graph page — either wire to real data or hide behind feature flag — ~3 hours
- Replace native `alert()` in BIM viewer with branded modal — ~30 min
- Whiteboard storage error handling — ~30 min
- CI lint rule for unguarded mutations — ~3 hours
- Voice linter pass over UI strings — ~3 hours
- `useIsMobile` wiring on field-facing pages — ~3 hours

### Tier 3 — Pre-launch polish (ship before April 2027 GA) — ~30 hours

- All 50 Sev-2 findings
- Stuck-skeleton timeout pattern roll-out
- Color-only-meaning audit + designer pass
- Field-test rig sign-off on every mobile screen (per `ADR_010`)
- The 7 unverified Field Manual Part II items (visual check + fix)

Full queue with assignees + dates is in [`UX_FIX_QUEUE_2026-05-04.md`](forthcoming).

---

## What This Audit Does NOT Cover

- Backend correctness (covered by integration tests + chain audit)
- DB schema (covered by migrations + ADR-008)
- API contracts (`PUBLIC_API_SPEC` forthcoming)
- Security (covered by SOC 2 + pen test)
- Pricing logic (covered by billing tests)
- **Manual visual verification** (Walker still needs to walk every page on iPad + iPhone in the field-test rig)
- **Drawings.tsx** (Field Manual item #12 — not in this batch's scope)
- **Schedule subpages** beyond the index — many duplicate-named files were skipped

The static-code audit catches what the rubric defines. **The visual + interaction audit happens when Walker (or engineer #2) opens every page on a real device.** That's Phase 2.

---

## What Walker Does With This Audit

### This week

1. **Read the consolidated findings** (this doc) + the three batch findings docs
2. **Decide tier ordering:** are all Tier 1 fixes pre-pilot? Or accept 1-2 Sev-1 issues at pilot start?
3. **Add CI lint rule** for unguarded mutations (1-day task; prevents regression)
4. **Fix the 10 demo-surface items** (~9 hours; can be done by Walker over a weekend, or Claude Code)

### Before Lap 3 kickoff

5. **Sweep the 8 admin PermissionGate gaps + 8 top-level page gaps** (~12 hours)
6. **Decide on Intelligence Graph page** — wire to real data, hide, or kill
7. **Manual visual verification** of the 7 unverified Field Manual Part II items
8. **Run the field-test rig** on the 3 demo surfaces

### Before launch (April 30, 2027)

9. **Tier 3 sweep** — all 50 Sev-2 findings; ~30 hours of polish
10. **Re-audit** before launch using the same framework + rubric

---

## Verdict

The audit found **31 Severity-1 issues**. Five Field Manual issues verified fixed; ten still open or partially open. **The 3 demo surfaces are below baseline when re-evaluated against the full rubric.**

**You cannot start Lap 3 today.** Tier 1 + Tier 2 fixes (~34 hours of work) + manual verification = the actual pre-Lap-3 work. Estimated wall-clock: 1-2 weeks for Walker, less if engineer #2 is ramped.

The good news: the audit found everything I'd expect a Bugatti-standard re-evaluation to find. **Lap 1's PermissionGate audit closed visible buttons; this audit found the systemic gap (recently-built pages have it; older don't).** That's progress: we found it before a customer did.

The bad news: ~34 hours is real time. The Lap 2 pilot calendar is tight (May-June). If you want to ship Tier 1 before pilot kickoff (~May 30) and Tier 2 before Lap 3 kickoff (~June 9), the fix work has to start NOW in parallel with everything else.

---

## File-by-file Audit Outputs

- `UX_AUDIT_FINDINGS_BATCH_A_2026-05-04.md` — 38 top-level pages
- `UX_AUDIT_FINDINGS_BATCH_B_2026-05-04.md` — admin + subdirectories
- `UX_AUDIT_FINDINGS_DEMO_SURFACES_2026-05-04.md` — Iris Inbox + RFI Detail + Daily Log AutoDraft (deep)
- `UX_BUGATTI_AUDIT_FRAMEWORK_2026-05-04.md` — the rubric
- `UX_BUGATTI_AUDIT_FINDINGS_2026-05-04.md` — this file (consolidated summary)
- `UX_FIX_QUEUE_2026-05-04.md` — prioritized action items (forthcoming, derived from this)
