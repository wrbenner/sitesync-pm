# Audits & Receipts Index

**Last updated:** 2026-05-04
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

---

## Specs (what's queued, by day)

| Day(s) | Theme | Spec | Status |
|---|---|---|---|
| 14–19 | Money-cents migration | `MONEY_CENTS_AUDIT_2026-05-01.md` | ✅ Shipped (see receipts above) |
| 20–24 | State machine wiring | `STATE_MACHINE_INVENTORY_2026-05-01.md` | 🟡 Spec ready, NOT executed (deferred to Lap 2) |
| 27–28 | Bundle attack | `BUNDLE_ATTACK_SPEC_2026-05-01.md` | ✅ Shipped via Day 30 chunking refactor (1,468 KB → 580 KB) |
| 30 | Lap 1 acceptance gate | `LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md` | ✅ Shipped — all 3 gates green; targets re-baselined (see Day 30 receipt) |

---

## Architectural Decision Records

| ID | Title | File | Status |
|---|---|---|---|
| ADR-001 | (Reserved — no ADR-001 exists yet) | — | — |
| ADR-002 | The Five AI Stores Stay Separate | `ADR_002_AI_STORES_STAY_SEPARATE_2026-05-01.md` | Accepted |

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
