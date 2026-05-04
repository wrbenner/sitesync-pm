# Lap 2 Readiness Audit — Bugatti-Standard Gap Report

**Date:** 2026-05-04
**Author:** Claude (under Walker)
**Question asked:** "Is Lap 2 perfectly defined the way Lap 1 was?"
**One-line verdict:** **NO. The strategic frame is rock-solid. The execution-grade specs Lap 1 had don't exist yet for Lap 2. Eight artifacts must be written before Claude Code starts Day 31.**

---

## TL;DR

Lap 2 has the *what* and the *why* nailed. It does not yet have the *how-Claude-Code-can-execute-without-asking-questions* layer that made Lap 1 ship clean. Lap 1 carried six per-theme specs (PERMISSION_GATE_AUDIT, STORE_CONSOLIDATION_PLAN, MONEY_CENTS_AUDIT, STATE_MACHINE_INVENTORY, BUNDLE_ATTACK_SPEC, LAP_1_ACCEPTANCE_GATE_SPEC) plus a CI gate workflow, plus ADRs, plus the day-row format in the tracker. Lap 2 has the day-row format and the strategic positioning. That's it.

If you start Lap 2 in Claude Code today, the first three days will be discovery, not subtraction. Bugatti standard is "no discovery; execute." Eight specs close the gap.

---

## What Lap 2 Already Has (the foundation is real)

| Artifact | Where | Quality |
|---|---|---|
| Strategic frame | `SiteSync_North_Star.docx` Part VIII; `SiteSync_Field_Manual.docx`; `SiteSync_Bugatti_Audit.docx` Lap 2 section | Excellent |
| Reverse-engineered milestones | `docs/audits/REVERSE_ENGINEERED_MILESTONES_2026-05-04.md` (T-300 = Lap 2 gate, T-345 = scheduled-insights, T-330 = grounding+citations, T-320 = pilot kickoff, T-310 = voice work) | Excellent — this is the dependency-ordered view |
| Day-by-day tracker | `SiteSync_90_Day_Tracker.xlsx` → "Lap 2 — Watch" sheet (Days 31–60, all 30 rows populated with target + week + owner placeholder) | Strong — one-line outcome per day |
| Acceptance gate (one row) | Tracker Day 60: "100+ drafts approved, ≥70% acceptance, ≤90s avg approve" + "I don't want to go back" qualitative gate | One row only. No measurement methodology, no CI gate, no failure-mode decision tree |
| Risk register | Tracker → "Risk Register" sheet, 10 rows; Lap-2-specific: row 4 (pilot churn), row 10 (voice fails) | Decent strategic level. Missing the "what triggers escalation" detail |
| Substrate code shipped | `drafted_actions` table + type + writer (`draftAction.ts`) + 5 executors + `IrisApprovalGate.tsx` UI + 5 insight detectors (`insights.ts`) + groundingFallback + iris-call edge function chokepoint + hash-chain audit migration | Real — Lap 2 isn't building from zero |
| Carry-over from Lap 1 | Day 30 receipt names three items: drawer-gate seed, Dexie defer, state-machine wiring | Listed but not spec'd |

That's a real foundation. Lap 1 didn't have the milestone-reverse-engineering doc this early; Lap 2 does. Credit where due.

---

## What's Missing (the eight gaps)

Each gap below is a doc that, if it existed by Day 30 of Lap 1, would have eliminated discovery work in Lap 2. The Bugatti standard from the Field Manual is explicit: **"No discovery. No exploration. Execute."** That requires the spec to be on the desk before the day starts.

### Gap 1 — `LAP_2_ACCEPTANCE_GATE_SPEC.md` (highest priority)

**Why it matters.** The Day 60 gate is *qualitative* ("I don't want to go back") and *quantitative* (100+ approved, ≥70%, ≤90s) but the spec doesn't exist anywhere except as one row in the tracker. Lap 1's gate spec was 200+ lines and named: the test environment, the network throttle profile, the bundle measurement methodology, the drawer-click instrumentation, what counts as a "skip" vs. a "fail," and the rollover behavior.

**What's missing for Lap 2's gate.**
- *Counting rules.* What is a "draft approved"? Does an edited-then-approved draft count? Does a draft Iris withdraws (because the underlying state changed) count against the denominator? Does a duplicate-detection-suppressed draft count?
- *Acceptance-rate formula.* Approved / (approved + rejected)? Or approved / (approved + rejected + ignored-for-N-days)? Lap 1 nailed this for bundle bytes; Lap 2 hasn't for human decisions.
- *Time-to-approve clock.* Starts when the draft is *created* (cron tick) or when the user *opens the inbox*? Lap 1 measured first-paint from `new URL` navigation; Lap 2 needs the equivalent precision for "approve latency."
- *Telemetry plumbing.* `drafted_actions` has timestamps but no `viewed_at` or `time_to_decide_ms`. A migration is required before Day 31 to add the columns the gate measures against.
- *"I don't want to go back" capture.* Is this a Slack message, a recorded voice memo, an email, a survey? If it's an unprompted message, what counts as "unprompted"? Walker can't ask for it; that's the gate.
- *Failure-mode tree.* What if the pilot ships 80 drafts at 75% acceptance? Pass on percentage, fail on volume? Lap 1's spec was binary; Lap 2 has multi-axis criteria that need an explicit AND/OR truth table.
- *CI workflow.* Lap 1 has `.github/workflows/lap-1-acceptance.yml` running three Playwright assertions. Lap 2 needs a parallel workflow that queries the staging DB for the four counts and fails the build if any drift.

**Estimated spec size:** 250 lines, 1 day to write.

---

### Gap 2 — `SCHEDULED_INSIGHTS_SPEC.md` (Days 31–35 are blocked without it)

**Why it matters.** Tracker Day 31 says "scheduled-insights edge function scaffolded. Cron set to every 15 min per project." That's a one-line intent. The actual edge function does not exist (`supabase/functions/scheduled-insights/` is absent — verified). The closest existing functions are `generate-insights` (computes insights, doesn't promote to drafted_actions) and `ai-insights` (CRON-protected by `CRON_SECRET`, also computes only).

**What's missing.**
- *Cron mechanics.* Supabase cron syntax (pg_cron) vs. Deno scheduled task vs. external pinger. Lap 1's MONEY_CENTS_AUDIT picked a tech and inventoried the migration; this needs the same.
- *Per-project fan-out.* "Every 15 min per project" — does the cron tick once and iterate over `projects.is_active = true`, or does each project get its own cron entry? At 100 paying GCs × 3 active projects, the second approach explodes pg_cron rows.
- *Rate-limiting on the LLM chokepoint.* `iris-call` is a single chokepoint. 100 projects × 4 ticks/hour × 5 insight detectors = 2,000 LLM calls/hour from cron alone. What's the budget? What backs off?
- *Promotion criteria.* When does an insight become a `drafted_action`? Today, insights are pure data (`IrisInsight` type with severity + impact). The promotion logic — "promote when severity ≥ high AND no draft of this kind exists for this entity in the last 24h AND confidence ≥ 0.7" — is unwritten.
- *Idempotency.* If the cron fires twice (because it's distributed), you get duplicate drafts. The dedupe key (`{kind, entity_id, project_id}` with a TTL?) needs to be specified.
- *Withdraw-on-state-change.* `withdrawDraft()` exists but nobody calls it. If the planted RFI gets answered between Iris drafting a follow-up and the user reviewing it, the draft must auto-withdraw. The trigger semantics need spec'ing.
- *File inventory.* Which insight detector goes first? Cascade (most valuable, most complex) or aging (simplest, most volume)? The order matters because the prompt template work compounds.

**Estimated spec size:** 300 lines, 1.5 days to write. Includes the SQL migration script for the new `drafted_action_dedupe_keys` table or equivalent.

---

### Gap 3 — `IRIS_CITATIONS_SPEC.md` (Days 38–41 are blocked without it)

**Why it matters.** Tracker Day 38 says "Grounding upgrade: every Iris draft cites a source." Day 39 says "Citation pill UI: clickable, opens source in side panel." Today the `DraftedActionCitation` type exists with `kind`, `label`, `ref`, `snippet`, and `drawing_id/x/y`. The UI shows label + snippet in an expander but the citations are NOT clickable (verified `IrisApprovalGate.tsx` lines 168–191 — no router push, no `<a>` tags, no `onClick`). Day 41 says "any draft without a citation is auto-rejected before hitting drafted_actions" — that's a CI/pre-insert gate that doesn't exist.

**What's missing.**
- *Citation kind → URL routing table.* For each of the 8 citation kinds (`drawing_coordinate`, `rfi_reference`, `daily_log_excerpt`, `photo_observation`, `spec_reference`, `schedule_phase`, `budget_line`, `change_order`), the spec needs the URL pattern, the side-panel component, the deep-link parameter format. Drawing coordinates are the gnarly one — the existing IssueOverlay gets a pin drop, but the deep link from a draft hasn't been designed.
- *"Resolves to a real entity" check.* Day 40 says "verify every citation resolves to a real entity." That's a runtime FK check. Today citations are denormalized JSON. Either add a foreign-key per kind (8 nullable FKs) or add a server-side resolver that walks the kind→table mapping and returns 410 Gone for stale refs.
- *Auto-reject mechanics.* Day 41 — where does the rejection happen? In `draftAction.ts` (early return), in a DB CHECK constraint, in an edge-function pre-flight? Each has different audit-trail consequences. Lap 1's permission-gate audit picked one (call-site gating) and stuck with it; this decision is unmade.
- *Snippet quality bar.* The current `snippet` field is freeform string. If the LLM hallucinates a snippet that doesn't actually appear in the source, the citation is fake. Spec needs to mandate substring-of-source verification before insert.
- *Performance.* Each draft has up to N citations; each click resolves the entity. The 250ms audit-trail-write target carries over — citation panel open should be instant. Cache or eager-load?

**Estimated spec size:** 200 lines, 1 day. Includes routing table + resolver design + CI assertion.

---

### Gap 4 — `IRIS_VOICE_GUIDE_SPEC.md` (Days 43–49 are blocked without it)

**Why it matters.** Tracker Day 43 starts the voice work; Day 45 expects `src/lib/iris/style.ts` to exist; Day 49 expects voice signed off. The file `src/lib/iris/style.ts` does not exist anywhere in the repo (verified `find . -name "style.ts"` returned nothing under `src/lib/iris`). The Feature Handoff doc says voice is "Planned"; the Field Manual says the first 150 hand-edited drafts inform the rules.

**What's missing.**
- *Methodology spec.* Hand-editing drafts is a labor-intensive feedback loop. What's the corpus? The 150 drafts come from where — the dev environment (untrustworthy seed) or staging (no real volume yet)? Lap 2 needs to commit to a source.
- *Style-guide schema.* Is `style.ts` exporting an array of rules? A prompt-injection block? A post-process linter? Lap 1's MONEY_CENTS spec was clear: every dollar passes through `addCents`. The voice equivalent — every Iris draft passes through `applyVoiceStyle()` — needs the same shape.
- *Acceptance criteria for voice.* "Voice is locked" is qualitative. The Bugatti standard requires a measurable proxy. Candidates: (a) % of drafts containing banned phrases ("certainly," em-dash, "I hope this helps"), (b) reading-grade-level distribution, (c) blind A/B with 5 PMs picking SiteSync vs. ChatGPT default. Pick one, set a target, instrument it.
- *Where the 150 drafts come from.* If the soft pilot starts Day 50 (per tracker), the 150 drafts can't be from the pilot — they have to be pre-pilot. Either Walker generates them by hand against seed data, or the scheduled-insights cron generates them in dev between Days 35 and 42. The tracker doesn't say.
- *PM reviewer commitment.* Day 48 says "Style guide reviewed by a real PM in your network." That PM has to be lined up by Day 31 — a 17-day window from invite to review is tight. Where's the recruit list?

**Estimated spec size:** 180 lines, 1 day.

---

### Gap 5 — `SOFT_PILOT_PLAYBOOK.md` (slip-killer #1 is here; this is the highest-risk gap)

**Why it matters.** Tracker Days 50–60 are the soft pilot. The Reverse-Engineered Milestones doc flags this as critical-path: "Lap 2 gate fails; no PMF signal; nothing downstream is real." The Risk Register lists "Soft pilot customer churns mid-Lap-2" as Medium/High. There is no recruit list, no onboarding checklist, no daily standup template, no exit criteria, no backup-GC plan.

**What's missing.**
- *Two named GCs lined up.* The risk-register mitigation says "Two backup customers in conversation." Where? Names. Phone numbers. Last-contact dates. The Customer Calls sheet in the tracker is empty (55 rows, all unfilled).
- *Pilot data isolation.* Real customer data hits the audit chain for the first time. RLS policies, data-residency assumptions, the right-to-erasure mechanic — all unspecified for live data. Lap 1 was internal; Lap 2 is regulated.
- *Liability disclaimer / pilot agreement.* What does the GC sign? An MSA? A pilot agreement? A click-wrap? The Reverse-Engineered Milestones doc lists Iris's failure-mode policy (#3 in "What This Doc Doesn't Cover"). Still doesn't.
- *Onboarding day-of script.* "In person at the slab" (Day 52). What gets installed, what data gets imported, what's the success criterion at end-of-day-1? Lap 1's PermissionGate sweep had a script: scan, gate, verify. Pilot kickoff has none.
- *Daily standup template.* "Standup at 5:30 PM. Ship a fix overnight." (Days 53–55.) What's the standup format? What's the rule for "ship a fix"? Bugatti standard says no discovery; what's the diagnostic flow when a draft is rejected at 5:30 PM and the next morning needs it fixed?
- *Exit criteria for pilot abandonment.* What metric, on what day, triggers "stop the pilot, recover, restart with backup GC"? Without this, sunk-cost will keep a failing pilot alive past the gate.

**Estimated spec size:** 350 lines, 2 days. The longest spec because it's the most external, least under our control.

---

### Gap 6 — `LAP_1_CARRYOVER_PLAN.md` (decisions deferred from Day 30)

**Why it matters.** The Day 30 receipt explicitly punted three items "to Lap 2": (a) drawer-gate runs against real seed, (b) defer Dexie / offlineDb (~32 KB cold-path saving), (c) Day 20–24 state-machine wiring (15 machines via `useMachine()`). These are not in the Lap 2 — Watch tracker rows. They are not in any spec. They will either silently slip or silently land in the middle of a pilot week.

**What's missing.**
- *Carry decision per item.* For each of the three: do we do it in Lap 2, defer to Lap 3, or descope? STATE_MACHINE_INVENTORY_2026-05-03.md already argued for descope of Days 22–24 wiring; that needs to be ratified as an ADR or rejected.
- *Day allocation.* If we do them in Lap 2, where? The Lap 2 — Watch sheet is full. Either we evict a row or carry the work into the slack windows (the SUNDAY rows are read-only by convention, not compatible with engineering).
- *Risk to the pilot.* Deferring Dexie is bundle-only; safe during pilot. State-machine wiring touches every entity hook; UNSAFE during pilot. Drawer-gate seed is staging-only; safe. Each item needs the safety-during-pilot label.

**Estimated spec size:** 80 lines, 0.5 day.

---

### Gap 7 — `LAP_2_ADRs.md` (decisions that should be made before Day 31, not during)

**Why it matters.** Lap 1 produced exactly one ADR (ADR-002 about the 5 AI stores staying separate) plus a long Decisions sheet in the tracker. Lap 2 has bigger architectural calls and fewer made.

**Decisions that need an ADR before Day 31.**
- *ADR-003: Cron tech for scheduled-insights.* pg_cron (in-DB, transactional with insert) vs. Supabase scheduled functions (separate process, easier to monitor) vs. external pinger (no vendor lock). The choice affects rate-limiting, observability, and disaster recovery.
- *ADR-004: Citation rendering — side panel vs. modal vs. inline drawer.* Affects every existing detail page (RFI, Daily Log, Pay App, Drawing). Pick one and stick.
- *ADR-005: Voice-style enforcement — prompt-time vs. post-process vs. both.* If post-process, the diff between LLM output and corrected output is auditable training data. If prompt-time, no diff. Has compliance implications.
- *ADR-006: Pilot data isolation — separate Supabase project vs. row-level tenant.* Walker's instinct probably says row-level (one DB, RLS); a regulated GC may require separate-project. Pick before kickoff.
- *ADR-007: Auto-withdraw policy.* When the underlying state changes (RFI gets answered, daily log gets manually filed), does the in-flight draft auto-withdraw, auto-update, or stay stale? Affects user trust the most when wrong.

**Estimated spec size:** 5 ADRs × 60 lines = 300 lines, 1.5 days.

---

### Gap 8 — `IRIS_TELEMETRY_SPEC.md` (without this, the gate is unmeasurable)

**Why it matters.** The Day 60 gate measures four things: count, acceptance rate, average time-to-approve, security incidents. The DB schema (`drafted_actions`) records `created_at`, `decided_at`, `status` — but not `first_viewed_at`, `viewer_id`, `inbox_session_id`, `time_to_first_view_ms`, `time_to_decide_ms`, or `decision_method` (keyboard/click/edit-then-approve). Without those columns the gate cannot be measured.

**What's missing.**
- *Migration for telemetry columns.* `ALTER TABLE drafted_actions ADD COLUMN ...`. Spec the columns, the indexes, the RLS policies, the backfill (set existing rows to NULL or "unknown").
- *Client instrumentation.* `IrisApprovalGate.tsx` records the keystroke. The hook needs to fire `recordView`, `recordDecision` events at the right moments. What about scroll-into-view triggering "view"? What about user opens inbox but never scrolls to that draft?
- *Daily aggregation job.* The gate is a 60-day rolling window; computing it on every read is fine for the dashboard but the *gate* assertion in CI needs a stable snapshot. Spec a `lap_2_gate_metrics_daily` materialized view or equivalent.
- *Privacy.* Telemetry rows include `viewer_id`. RLS, retention, and the GC's data-handling agreement all touch this.

**Estimated spec size:** 150 lines, 1 day.

---

## Summary Table

| Gap | Spec to write | Days blocked without it | Lines | Author-days |
|---|---|---|---|---|
| 1 | LAP_2_ACCEPTANCE_GATE_SPEC | Day 60 | 250 | 1 |
| 2 | SCHEDULED_INSIGHTS_SPEC | Days 31–35 | 300 | 1.5 |
| 3 | IRIS_CITATIONS_SPEC | Days 38–41 | 200 | 1 |
| 4 | IRIS_VOICE_GUIDE_SPEC | Days 43–49 | 180 | 1 |
| 5 | SOFT_PILOT_PLAYBOOK | Days 50–60 | 350 | 2 |
| 6 | LAP_1_CARRYOVER_PLAN | Days 31+ | 80 | 0.5 |
| 7 | LAP_2_ADRs (5) | All of Lap 2 | 300 | 1.5 |
| 8 | IRIS_TELEMETRY_SPEC | Day 60 (and earlier for instrumentation) | 150 | 1 |
| **Total** | | | **1,810 lines** | **~10 author-days** |

Plus:
- One CI workflow file (`.github/workflows/lap-2-acceptance.yml`).
- One DB migration (`telemetry columns + dedupe keys`).
- One updated INDEX.md row per spec (8 rows).

---

## Recommendation

**Do not start Lap 2 in Claude Code until at minimum Gaps 1, 2, 3, 5, 8 ship as docs.** Gaps 4, 6, 7 can be written in the first week of Lap 2 if needed, but the others block the daily targets directly.

Realistic sequencing if the goal is a clean Day 31 kickoff:

| Day | Walker writes | Claude reviews + CI scaffolds |
|---|---|---|
| Today (May 4) | Gap 6 carry-over; commit ADR-002 ratification of state-machine descope | INDEX.md update |
| Tomorrow (May 5) | Gap 1 acceptance gate spec + Gap 8 telemetry spec | DB migration draft for telemetry columns |
| May 6 | Gap 2 scheduled-insights spec (the longest single one) | Edge function scaffold, cron syntax decision (ADR-003) |
| May 7 | Gap 3 citations spec (ADR-004 inline) | Resolver design |
| May 8 | Gap 5 soft-pilot playbook part 1 (recruit + agreement) | Pilot data-isolation ADR (ADR-006) |
| May 9 | Gap 5 part 2 (onboarding + standup + exit criteria) | Backup-GC outreach starts; this is the long-lead item |
| May 10 | Gap 4 voice guide + Gap 7 remaining ADRs | CI workflow file lap-2-acceptance.yml |

**That's 7 days of pre-flight, with Lap 2 kicking off ~May 11.** The 90-day calendar from `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md` says scheduled-insights ships May 18 — so the 7 pre-flight days do not slip the critical path. They are inside the 21 days of slack the Reverse-Engineered Milestones doc identified.

Skipping the pre-flight saves a week of doc time and costs at minimum two weeks of execution time, because Days 31–35 turn into "scaffold + design + decide + retry" instead of "execute the spec." The Bugatti standard is non-negotiable here: **Lap 1 shipped clean because Lap 1 had specs. Lap 2 will ship clean if and only if Lap 2 has equivalent specs.**

---

## Codebase Reality Check Findings (verified during this audit)

These are the facts checked against the actual repo, not the docs:

1. ✅ `drafted_actions` table exists (`supabase/migrations/20260427000010_drafted_actions.sql`), `DraftedAction` type exists with discriminated union over 6 action types, `draftAction()` writer exists (95 LOC), `executeAction()` exists with 5 typed executors (RFI, Daily Log, Pay App, Punch Item, Submittal Transmittal).
2. ✅ Five insight detectors exist in `src/services/iris/insights.ts` (cascade, aging, variance, staffing, weather, 427 LOC). They compute deterministic insights but **do not call `draftAction()`**; the promotion link is the missing piece.
3. ❌ **No `scheduled-insights` edge function exists.** Closest: `generate-insights` (computes only) and `ai-insights` (CRON-protected, computes only).
4. ✅ `IrisApprovalGate.tsx` renders the citations expander with label + snippet for each citation kind.
5. ❌ **Citations are not clickable.** Lines 168–191 of `IrisApprovalGate.tsx` render a plain `<li>` per citation. No router navigation, no `<a>` tag, no `onClick` handler.
6. ❌ **`src/lib/iris/style.ts` does not exist.** Only `src/lib/iris/suggestPolicy.ts` lives in that directory. Voice work has zero code surface today.
7. ✅ Hash-chain audit migration exists (`20260426000001_audit_log_hash_chain.sql`); `verifyChain` references found in iris-call edge function and the 90-day-smoke E2E spec.
8. ✅ `iris-call` is the single AI chokepoint per Decision #3 in the tracker; `callIris` browser client routes through it.
9. ❌ **No telemetry columns on `drafted_actions`** for `first_viewed_at`, `time_to_decide_ms`, `decision_method`. The gate metrics cannot be computed today.
10. ✅ Lap 1 acceptance gate CI workflow exists (`.github/workflows/lap-1-acceptance.yml`); pattern ready to copy for Lap 2.
11. ✅ Day-by-day tracker rows exist for all 30 Lap 2 days in the "Lap 2 — Watch" sheet of `SiteSync_90_Day_Tracker.xlsx`.
12. ❌ **Customer Calls sheet is empty** (55 rows, all blank). The risk-register mitigation for "soft pilot churns" assumes "two backup customers in conversation." There is no record of any customer conversation. This is the most concerning finding in the entire audit.
13. ✅ Risk Register has 10 rows including pilot-churn (#4) and voice-fails (#10) for Lap 2.
14. ❌ No Lap-2-specific ADRs exist. Only ADR-002 about AI stores.

Items 3, 5, 6, 9, 12, 14 are the concrete blockers. Items 12 (no customer in conversation) is the slip-killer. Without a recruited GC by ~May 12, Lap 2 cannot start the pilot on time, and the gate cannot be hit by Day 60.

---

## Final Verdict

**Lap 2 strategic frame: A.** The North Star, Field Manual, Reverse-Engineered Milestones, Tracker, Risk Register, and substrate code are all real and align.

**Lap 2 execution-spec readiness: D.** Eight artifacts are missing; the most critical (acceptance gate, scheduled-insights, soft-pilot playbook, telemetry) directly block daily targets.

**Lap 2 customer pipeline: F.** Zero customer conversations logged. The slip-killer for the entire 12-month plan is unaddressed. This is the *single* most urgent action item from this audit and it has nothing to do with code.

**Bugatti-standard pre-flight requires:** ~10 author-days of spec writing + 1 week of GC outreach in parallel. If both run May 4–11, Lap 2 kicks off May 11 with the same level of preparation Lap 1 had on Day 1, and Day 60 lands at ~July 10 — which the Reverse-Engineered Milestones doc shows is still inside the slack window before T-300 (Lap 2 acceptance, July 2 hard date).

If we want to call Lap 2 "perfect like Lap 1 was perfect," we need this week. Don't skip it.

---

## Appendix A — Read order for the next Lap-2 spec session

1. This doc.
2. `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`
3. `SiteSync_90_Day_Tracker.xlsx` → "Lap 2 — Watch" sheet
4. `SiteSync_Field_Manual.docx` → Part III (the three demo surfaces) + Part IV (the sub portal)
5. `SiteSync_Feature_Handoff.docx` § 5.2 (the Lap 2 walkthrough), § 4.2 (drafted-actions architecture)
6. `STATE_MACHINE_INVENTORY_2026-05-03.md` (because its descope recommendation belongs in the carryover plan)
7. `DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md` (to understand which Lap 1 patterns transfer)

## Appendix B — Files to update when these specs ship

- `docs/audits/INDEX.md` — add 8 spec rows to the Specs table; add 5 ADR rows (ADR-003 through ADR-007)
- `CLAUDE.md` — update "Current Sprint Context" to point at Lap 2 specs (currently points at Lap 1 receipts)
- `SiteSync_90_Day_Tracker.xlsx` → "Lap 2 — Watch" — fill the Owner column for each row; flag any rows that change scope based on the carryover plan
- `.github/workflows/lap-2-acceptance.yml` — new file, mirror of `lap-1-acceptance.yml`
- One DB migration adding telemetry columns to `drafted_actions`
- New table `drafted_action_dedupe_keys` (or equivalent) per the scheduled-insights spec
