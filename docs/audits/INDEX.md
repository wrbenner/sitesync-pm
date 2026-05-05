# Audits & Receipts Index

**Last updated:** 2026-05-04 (Lap 2 spec set landed)
**Purpose:** Single map of every audit, receipt, and ADR. Read the relevant
entries before starting work. Update this file when you add a new doc.

---

## How to Use This Index

- **Starting a new session?** Read CLAUDE.md → this file → the most recent receipt.
- **Working on Day N?** Find the relevant audit/spec in the table below.
- **Adding a new doc?** Append a row. Keep entries one-line. Date in filename.

---

## Receipts (what shipped, by day)

| Day | Theme | Receipt | One-line summary |
|---|---|---|---|
| 1 | PermissionGate audit | `PERMISSION_GATE_AUDIT_2026-05-01.md` | Inventoried unguarded action buttons. CI gate added. |
| 5 | Stub-page audit | `STUB_PAGE_AUDIT_2026-05-01.md` | 30 stub-class pages identified; 14 orphans queued for deletion. |
| 6 | Store consolidation plan | `STORE_CONSOLIDATION_PLAN_2026-05-01.md` | 33→5 design (revised to 33→13 in ADR-002). |
| 7 | (No standalone receipt — see Day 8 doc) | — | authStore absorbs organizationStore; projectContext renamed to projectStore. |
| 8 | Group A dead-store sweep + uiStore merge | `DAY_8_ZUSTAND_RECEIPT_2026-05-01.md` | 14 stores deleted, notificationStore merged, 2 shims removed. 33→16. |
| 9 | Group B migrations + AI-store decision | `DAY_9_ZUSTAND_RECEIPT_2026-05-01.md` | crew/equipment/submittal deleted, punchList slimmed. 16→13. |
| 10–11 | Scattered state | `DAY_10_11_SCATTERED_STATE_RECEIPT_2026-05-01.md` | Scattered state cleanup. |
| 14–19 | Money-cents migration | `DAY_15_PAYAPP_CENTS_RECEIPT_2026-05-03.md`, `DAY_17_19_MONEY_CENTS_RECEIPT_2026-05-03.md` | PayApp + global money-to-cents migration shipped. |
| 26 | Permission gate sweep | `DAY_26_GATE_SWEEP_RECEIPT_2026-05-03.md` | PermissionGate audit closure. |
| ~ | Typecheck → ZERO | `TYPECHECK_ZERO_2026-05-04.md` | 4339 → 0 errors. CI tsc gate green for the first time since the campaign began. |
| 30 | Lap 1 acceptance gate (FINAL) | `DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md` | All 3 gates green. Bundle 580 KB ≤ 600 KB; first paint 976ms ≤ 4000ms; drawer skips on empty seed. Lap 1 closed. |
| 30.5 | Iris telemetry instrumentation | `DAY_30_5_IRIS_TELEMETRY_RECEIPT_2026-05-04.md` | 5 telemetry cols + 2 generated cols + 3 indexes + 2 RPCs + matview + ADR-008. Lap 2 gate is now measurable. |
| 30.75 | Lap 2 acceptance gate wired | `DAY_30_75_LAP_2_GATE_RECEIPT_2026-05-04.md` | audit_incidents migration + gate-tightened matview + lap-2-acceptance.yml + threshold source-of-truth + 7-scenario seed/check scripts + 15 unit tests. Gate is fail-closed and dry-runnable. |
| 31 | Scheduled insights foundation + aging | `DAY_31_SCHEDULED_INSIGHTS_RECEIPT_2026-05-04.md` | 4 migrations (heartbeat/dedupe/log/soft-pilot flag) + scheduled-insights-worker edge fn + ADR-003 promoted standalone. Day 31 detector (aging) live; cascade/variance/staffing/weather queued for Days 32–35. |
| 32 | Cascade detector + envelope test extraction | `DAY_32_CASCADE_DETECTOR_RECEIPT_2026-05-04.md` | Pure insightEnvelope.ts module (worker + Vitest both consume) + cascade detector + 24 unit tests. Adding next detector = 1 query + 1 builder call. |
| 33–35 | Variance, staffing, weather detectors | `DAYS_33_34_35_DETECTORS_RECEIPT_2026-05-04.md` | All 5 spec detectors live: variance (week-over-week acceleration), staffing (project-level shortfall), weather (≥3 bad days × outdoor activities). 22 new tests; 46 total in worker test file. Detector pipeline complete. |
| 38 | Iris citations: server backbone + side panel + auto-reject | `DAY_38_CITATIONS_RECEIPT_2026-05-04.md` | resolve_citation RPC + citation_interactions table + fake_citation audit category + verifyCitationSnippet + auto-reject in draftAction.ts + side panel host + RFI/Drawing dedicated panels + generic fallback for 6 kinds + clickable citation chips. 28 new tests (101 total in session). |
| 43–49 | Iris voice guide infrastructure | `DAYS_43_49_VOICE_GUIDE_RECEIPT_2026-05-04.md` | iris_voice_diffs migration + style.ts (10 seed rules) + voiceLinter.ts (fixed-point autofix) + voicePrompt.ts (action-scoped) + sample-voice-corpus.ts + ADR-005 standalone. 40 new tests; voice work substrate ready for Walker's hand-edit cycle. |
| 50–60 | Soft pilot playbook substrate | `DAYS_50_60_PILOT_PLAYBOOK_RECEIPT_2026-05-04.md` | pilot_agreements migration + is_pilot_user() helper + agreement template v1 + standup template + provision-pilot-org.ts + ADR-006 standalone. Code substrate complete; Walker-side recruit/onboard/run pilot remains. |
| 39+45+60 | Citations dedicated panels + voice linter wiring + pilot data export | `DAYS_39_45_60_FOLLOWUP_RECEIPT_2026-05-04.md` | 4 dedicated citation panels (daily_log/CO/spec/schedule_phase) + iris-call voice linter post-process with iris_voice_diffs logging + 11-case Deno/src parity tests + scripts/export-pilot-data.ts. 29 new tests; 170 total session tests green. |

---

## Lap 2 Pre-Flight (2026-05-04 spec set — READ BEFORE STARTING LAP 2)

| Order | Spec | One-line summary |
|---|---|---|
| 0 | `LAP_2_READINESS_AUDIT_2026-05-04.md` | The gap report. Identified 8 missing specs. Every doc below closes one of them. |
| 1 | `LAP_1_CARRYOVER_PLAN_2026-05-04.md` | Drawer-gate seed → Lap 2 Day 31. Dexie defer → Lap 3. State-machine wiring → DESCOPED (ADR-009). |
| 2 | `ADR_009_STATE_MACHINE_WIRING_DESCOPED_2026-05-04.md` | Ratifies the descope of `useMachine` wiring for the 15 machines. |
| 3 | `IRIS_TELEMETRY_SPEC_2026-05-04.md` | 6 telemetry columns + 2 RPCs + materialized view. **Migration must land before Lap 2 Day 31.** |
| 4 | `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md` | Day 60 gate: 4 programmatic + 1 qualitative. CI workflow `lap-2-acceptance.yml`. |
| 5 | `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` | Hybrid pg_cron heartbeat → pgmq queue → edge fns + external workers. ADR-003 inline. |
| 6 | `IRIS_CITATIONS_SPEC_2026-05-04.md` | 8 citation kinds → routing table → side panel. Resolver + auto-reject + snippet verification. ADR-004 inline. |
| 7 | `IRIS_VOICE_GUIDE_SPEC_2026-05-04.md` | 150-draft hand-edit cycle → `style.ts` → linter + prompt-time. ADR-005 inline. |
| 8 | `SOFT_PILOT_PLAYBOOK_2026-05-04.md` | Nexus (Brad Cameron, primary) + Carleton (backup). Pilot agreement + Day 50 onboarding + 5:30 PM standup + exit criteria. ADR-006 inline. |
| 9 | `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` | When underlying state changes mid-draft: withdraw, never auto-update, never stay-stale. |
| 10 | `SOFT_PILOT_GC_RESEARCH_2026-05-04.md` | Nexus Companies (Dallas) + Carleton Companies. Brad Cameron contact verified. |

---

## Specs (what's queued, by day)

| Day(s) | Theme | Spec | Status |
|---|---|---|---|
| 14–19 | Money-cents migration | `MONEY_CENTS_AUDIT_2026-05-01.md` | ✅ Shipped (see receipts above) |
| 20–24 | State machine wiring | `STATE_MACHINE_INVENTORY_2026-05-03.md` | ⛔ DESCOPED per ADR-009 (2026-05-04) |
| 27–28 | Bundle attack | `BUNDLE_ATTACK_SPEC_2026-05-01.md` | ✅ Shipped via Day 30 chunking refactor (1,468 KB → 580 KB) |
| 30 | Lap 1 acceptance gate | `LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md` | ✅ Shipped — all 3 gates green; targets re-baselined (see Day 30 receipt) |
| 31–35 | Scheduled insights → drafts | `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` | ✅ All 5 detectors shipped (Days 31–35 receipts). Awaiting staging extensions + smoke. |
| 38–41 | Citations: clickable + verified | `IRIS_CITATIONS_SPEC_2026-05-04.md` | ✅ Days 38 + 39 shipped (server backbone + side panel + auto-reject + 4 dedicated panels). Day 40 staging smoke + Day 41 Walker review remain Walker-side. |
| 43–49 | Iris voice work | `IRIS_VOICE_GUIDE_SPEC_2026-05-04.md` | ✅ Infrastructure + iris-call wiring shipped (Days 43–49 + Day 45). Days 43/46/47 hand-edit cycle + Day 48 PM review remain Walker-side. |
| 50–60 | Soft pilot | `SOFT_PILOT_PLAYBOOK_2026-05-04.md` | ✅ Code substrate + Day 60 export shipped. Recruit + onboard + run pilot remain Walker-side. |
| 60 | Lap 2 acceptance gate | `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md` | ✅ Workflow + scripts + matview shipped (Day 30.75 receipt) — awaiting STAGING_DB_URL secret |

---

## Architectural Decision Records

| ID | Title | File | Status |
|---|---|---|---|
| ADR-001 | (Reserved — no ADR-001 exists yet) | — | — |
| ADR-002 | The Five AI Stores Stay Separate | `ADR_002_AI_STORES_STAY_SEPARATE_2026-05-01.md` | Accepted |
| ADR-003 | Hybrid cron architecture (pg_cron heartbeat + pgmq queue + edge fns + external workers) | `ADR_003_HYBRID_CRON_2026-05-04.md` | Accepted |
| ADR-004 | Citations open in a right-edge side panel (not modal, not full-page nav) | `ADR_004_CITATION_SIDE_PANEL_2026-05-04.md` | Accepted |
| ADR-005 | Voice enforcement is both prompt-time and post-process linter | `ADR_005_VOICE_ENFORCEMENT_2026-05-04.md` | Accepted |
| ADR-006 | Soft pilot uses row-level multi-tenancy + `is_soft_pilot` flag (not separate Supabase project) | `ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md` | Accepted |
| ADR-007 | Auto-withdraw stale drafts; never auto-update; never stay-stale | `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` | Accepted |
| ADR-008 | Telemetry retention: 12-month default, 24-month for soft pilot, then anonymize | `ADR_008_TELEMETRY_RETENTION_2026-05-04.md` | Accepted |
| ADR-009 | `useMachine` wiring for the 15 XState machines is descoped | `ADR_009_STATE_MACHINE_WIRING_DESCOPED_2026-05-04.md` | Accepted |

---

## Other Audits

| Date | File | Topic |
|---|---|---|
| 2026-04-24 | `../SECURITY_AUDIT_2026_04_24.md` | Security audit (lives under `docs/`, not `docs/audits/`) |

---

## Reading Order for a Fresh Session

If you're picking up this project cold (e.g., a Claude Code session with no prior context):

1. **Repo root:**
   - `CLAUDE.md` — operating instructions + sprint invariants
   - `AGENTS.md` — agent-specific rules
   - `README.md` — basic project intro

2. **Strategic orientation (read once, then stop re-reading):**
   - `SiteSync_North_Star.docx`
   - `SiteSync_Constitution.docx`
   - `SiteSync_Field_Manual.docx`

3. **What just shipped:**
   - This file (you're reading it)
   - The most recent `DAY_N_*_RECEIPT_2026-05-01.md`

4. **What's queued:**
   - The Specs table above. Find the next un-✓'d day in the tracker, find its spec.

5. **Tracker:**
   - `SiteSync_90_Day_Tracker.xlsx` — sheet "Lap 1 — Subtract" — find the next row with status `·` and start there.

---

## Naming Convention

- Audits: `*_AUDIT_YYYY-MM-DD.md` — surveys of current state.
- Specs: `*_SPEC_YYYY-MM-DD.md` or `*_INVENTORY_YYYY-MM-DD.md` — what to build.
- Receipts: `DAY_N_THEME_RECEIPT_YYYY-MM-DD.md` — what shipped.
- ADRs: `ADR_NNN_TITLE_YYYY-MM-DD.md` — architectural decisions.
- Plans: `*_PLAN_YYYY-MM-DD.md` — multi-day execution plans (these can supersede each other; ADRs cannot).
