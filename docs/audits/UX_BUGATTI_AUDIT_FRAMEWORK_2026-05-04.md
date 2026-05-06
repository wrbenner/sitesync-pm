# UX Bugatti Audit Framework

**Date:** 2026-05-04
**Status:** Framework ready. Execution dispatched to parallel subagents; findings consolidated in `UX_BUGATTI_AUDIT_FINDINGS_2026-05-04.md`.
**Purpose:** Audit every page in SiteSync against Bugatti / Lockheed-Martin standard. End-to-end. Every detail. Find every gap.

---

## TL;DR

This is the rubric. 12 categories × every page = the audit matrix. A page that scores < 9 in any category gets a "needs fix" note with a specific action.

The audit is **static-code-driven** (read every page file, evaluate against the rubric) plus **manual verification** of the top 5 demo surfaces. No production data accessed. No login used.

---

## The 12 Audit Categories

### 1. Functional Correctness

Does the page actually work?

- [ ] Renders without runtime error
- [ ] Fetches data correctly (correct query, correct endpoint, correct RLS)
- [ ] Mutations work (create/update/delete)
- [ ] Navigation works (back button, deep links)
- [ ] Refresh-from-bookmark works (state hydrated from URL/storage)

**Failure mode:** any blocker = severity 1 (blocks demo, blocks customer).

### 2. Field-Test Rig (mobile pages)

Per `ADR_010_MOBILE_NATIVE_ARCHITECTURE` § Field-Test Rig — every mobile screen tested in adversarial conditions:

- [ ] Direct-sun readability (max brightness, outdoor; reads cleanly)
- [ ] Gloved-thumb tap targets (≥ 44 px)
- [ ] 95°F-heat resilience (no thermal throttle crash)
- [ ] Dropped-device survival (case-protected; functions after fall)
- [ ] 12-hour-shift battery drain (background-aware)
- [ ] Cellular-dead-zone offline + sync
- [ ] Port-a-potty one-handed operation

**Failure mode:** tap target < 44 px = severity 2 (UX issue); thermal crash = severity 1.

### 3. Empty States

When the user has no data yet, what do they see?

- [ ] No "blank screen with no info"
- [ ] Clear "you don't have X yet" message
- [ ] Actionable next step (button or link)
- [ ] On-brand visual (illustration, not stock)

**Failure mode:** blank screen = severity 1 (looks broken).

### 4. Loading States

Between request fired and data returned:

- [ ] Skeleton loader (matches eventual layout) preferred over spinner
- [ ] Skeleton lasts no longer than 2s before timing out gracefully
- [ ] No "stuck skeleton" (Field Manual Part II item #2 — 11 pages had this issue)
- [ ] Shimmer animation respects Reduce Motion

**Failure mode:** stuck skeleton = severity 1 (bug); spinner instead of skeleton = severity 3.

### 5. Error States

When the request fails:

- [ ] Specific error message (not "Something went wrong")
- [ ] Retry mechanism (button or auto-retry with backoff)
- [ ] Stack trace available for support (logged to Sentry)
- [ ] Error doesn't crash the whole page

**Failure mode:** unhandled exception = severity 1; vague error = severity 2.

### 6. PermissionGate Coverage

Per `PERMISSION_GATE_AUDIT_2026-05-01` invariant:

- [ ] Every action button (Create/Send/Approve/Delete/Edit) wrapped in PermissionGate
- [ ] Gate references the correct permission key
- [ ] Disabled state shown (vs hidden) when user lacks permission
- [ ] Explanation tooltip when disabled

**Failure mode:** unguarded action = severity 1 (security issue).

### 7. Mobile Responsiveness

Pages render correctly across viewports:

- [ ] iPad portrait (768×1024)
- [ ] iPad landscape (1024×768)
- [ ] iPhone portrait (390×844 — iPhone 14)
- [ ] Desktop (1280×720)
- [ ] Desktop wide (1920×1080)

**Failure mode:** content clipped or unreadable = severity 1 (Field Manual Part II item #5 — mobile tab bars run together).

### 8. Accessibility (WCAG 2.1 AA)

Per `BUGATTI_LAUNCH_ROADMAP` Program 3.4:

- [ ] Color contrast ≥ 4.5:1 for body text
- [ ] Color contrast ≥ 3:1 for large text + UI elements
- [ ] All interactive elements have `accessibilityLabel` (or `aria-label`)
- [ ] Focus order logical
- [ ] Keyboard navigable (no mouse-only flows)
- [ ] Screen reader tested (VoiceOver / NVDA)
- [ ] No color-only conveying meaning (color + text + icon)
- [ ] Tap targets ≥ 44 px (mobile)
- [ ] Reduce Motion respected
- [ ] Alt text on images

**Failure mode:** missing aria-label on action button = severity 2 (compliance + accessibility).

### 9. Performance

Per `BUGATTI_LAUNCH_ROADMAP` Program 5 — tightened budgets:

- [ ] Initial render < 600ms p95 (inbox baseline)
- [ ] Iris draft first token < 2s p95
- [ ] PDF export < 3s p95
- [ ] Audit chain row write < 100ms p95
- [ ] No N+1 queries
- [ ] Lazy loading on heavy components
- [ ] Code splitting per route
- [ ] Cold-open eager bundle ≤ 600 KB

**Failure mode:** > 100ms regression on any budget = PR-blocked (per CI gate).

### 10. Brand Consistency

Per `BRAND_VISUAL_IDENTITY_SPEC`:

- [ ] Typography: Inter (body) / Söhne (display) — no other fonts
- [ ] Colors: deep slate, slate, iris gold, safety orange (warnings only), neutrals
- [ ] Iris Gold sparing — 1-2 instances per page max
- [ ] Construction Safety Orange forbidden in navigation
- [ ] No emojis in product copy
- [ ] No exclamation points
- [ ] Voice = lethal calm (per `IRIS_VOICE_GUIDE_SPEC` rules)

**Failure mode:** "certainly," em-dash, or ChatGPT-y phrasing = severity 2 (voice violation).

### 11. Citations / Audit Trail

Every state-changing action is audited:

- [ ] State changes write a `audit_log` row (per migration `20260426000001_audit_log_hash_chain.sql`)
- [ ] Audit row includes: who (user_id), what (entity_type + action), when (created_at), with what (before_state + after_state)
- [ ] AI-driven actions include model fingerprint + prompt hash
- [ ] Bulk operations write per-entity rows (per Chain Audit Prep Check 5)

**Failure mode:** state change without audit row = severity 1 (audit chain break risk).

### 12. The 15 Visible-to-GC Issues (Field Manual Part II baseline)

These are the specific issues Field Manual Part II identified. Each must be:

1. ✅ Verified fixed (with screenshot)
2. ❌ Verified still broken (severity flagged)

The 15:
1. iPad sidebar overlaps content on 25+ pages
2. Stuck skeleton loaders on 11 list pages
3. Schedule "Logic quality F" pill bug
4. iPhone bottom-nav + Iris FAB occluding content
5. Mobile tab bars run together on Safety + Time Tracking + Contracts
6. Sidebar user identity shows "—"
7. Reports/Schedule data inconsistent (Owner Portal "243 phases behind" vs iPad "247 Remaining")
8. Profile default avatar orange "?"
9. Primary action buttons render at ~50% opacity (look disabled when not)
10. Daily Log Field Capture: black camera surface, geolocation banner, infinite spinner, capture button greyed
11. Iris streaming captures didn't actually capture streaming
12. Drawings sub-page captures duplicated/wrong (sets-panel + annotations-panel both show upload modal)
13. Closeout 0% glyph in superscript position (looks like 0°)
14. Contracts on iPhone clips "Insurance" mid-word as "Insuranc"
15. Sync banner ("Loading project — submittals (2/16)... · Never synced") visually heavy on every authenticated page

**Failure mode:** any unfixed = severity 1 (visible to first GC who walks through).

---

## The Demo Surfaces (highest priority)

Per `Field Manual` Part III, these three pages were scored. Bugatti standard requires each at ≥ 9.5/10:

| Surface | Field Manual baseline score | Bugatti target |
|---|---|---|
| Iris Inbox (`/iris`) | 8/10 | ≥ 9.5/10 |
| RFI Detail | 8.5/10 | ≥ 9.5/10 |
| Daily Log AutoDraft | 6.5/10 | ≥ 9.5/10 |

These three surfaces get the deepest audit. Every other surface gets the standard rubric.

---

## Severity Levels

| Severity | Definition | Response time |
|---|---|---|
| **1 — Critical** | Demo-killer; security risk; data loss; unguarded action | Fix before next external demo |
| **2 — Major** | UX issue visible to GC walkthrough; accessibility gap; voice violation | Fix this sprint |
| **3 — Minor** | Polish issue; not visible without close inspection | Fix this quarter |
| **4 — Polish** | Aspirational improvement; nice-to-have | Backlog |

Audit findings tagged with severity + page + category + recommended action.

---

## Audit Execution Plan

### Phase 1 — Static code audit (Claude subagents, parallel)

Three subagents run in parallel:
- **Agent A:** Top 38 top-level pages (`src/pages/*.tsx`)
- **Agent B:** Subdirectory pages (`src/pages/*/index.tsx` and key components)
- **Agent C:** Demo surfaces deep-dive (Iris Inbox, RFI Detail, Daily Log AutoDraft)

Each agent:
1. Reads each page file
2. Evaluates against the 12 categories
3. Returns findings in structured format

Output: `UX_BUGATTI_AUDIT_FINDINGS_2026-05-04.md`

### Phase 2 — Manual verification (Walker, this week)

Walker manually clicks through the 3 demo surfaces + the 5 highest-volume pages:
- Iris Inbox
- RFI Detail
- Daily Log AutoDraft
- Day View (the home tab)
- Project Settings (where most Setup happens)

Compares manual experience against Phase 1 findings; closes gaps.

### Phase 3 — Field-test rig (Walker, when mobile native ships)

Per `ADR_010` § Field-Test Rig — every mobile screen tested in 7 adversarial conditions. Sign-off in code as `// FIELD-TESTED 2026-MM-DD`.

This Phase happens after iOS + Android apps are built (Sept 2026 timeframe).

---

## Action Item Format

Each finding becomes an action item:

```markdown
## [Page Name] — [Category] — Severity [N]

**Found:** [specific issue]
**Location:** [file path : line numbers]
**Bugatti standard:** [what it should be]
**Action:** [specific fix]
**Owner:** Walker / engineer #2 / designer
**Target date:** [date]
```

These get rolled into `docs/audits/UX_FIX_QUEUE.md` for execution tracking.

---

## What This Audit Doesn't Cover

- **Backend correctness** — covered separately by integration tests + chain audit
- **Database schema** — covered by migrations + ADR-008/Telemetry
- **API contracts** — covered by `PUBLIC_API_SPEC` (forthcoming)
- **Security** — covered by SOC 2 readiness + pen test
- **Pricing logic** — covered by billing system tests

This audit is **UX + visual + functional + accessibility** focused. The other layers are covered by their respective specs.

---

## Why This Audit Now

Bugatti standard says: every detail works perfectly end-to-end. A pilot PM walking through SiteSync for the first time should find:
- Zero broken pages
- Zero stuck skeletons
- Zero missing PermissionGates
- Zero accessibility violations
- Voice that doesn't sound like ChatGPT
- Mobile that works on the slab

If any of those fail in the soft pilot, the gate doesn't pass. **This audit catches them before the pilot does.**
