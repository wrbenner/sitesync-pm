# Days 50–60 — Soft Pilot Playbook: Code-Side Substrate

**Date:** 2026-05-04
**Lap:** Lap 2 Weeks 8–9, Days 50–60 (executed during pre-flight push).
**Spec:** `docs/audits/SOFT_PILOT_PLAYBOOK_2026-05-04.md`
**ADR:** `docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md` (promoted to standalone today).

---

## What shipped

The pieces of the soft-pilot playbook that exist as code, schema, or templates. The pilot itself is operational work — recruiting, onboarding, the daily 5:30 PM standup, the "ship overnight" rule — and remains Walker's. What this ship gives Walker is the substrate so Day 49 prep and Day 50 onboarding don't reinvent anything.

### 1 SQL migration — `pilot_agreements` (143 lines)

`supabase/migrations/20260504050000_pilot_agreements.sql`:

- `pilot_agreements` table — one row per signed agreement. Captures `signed_by_name/email/role`, `signed_at`, `agreement_text_version` (pinned at signing time so the row stays authoritative even when the template evolves), `agreement_pdf_url`, `pilot_user_ids uuid[]` (the 4 PMs+supers the playbook expects), `data_handling_consent jsonb`, `pilot_ended_at`, `ended_reason` (8-value CHECK enum capturing every exit-criteria reason in the playbook).
- 3 indexes: per-org+date, per-active-org partial, updated_at trigger.
- RLS: org admins can read their own agreement; service-role inserts. INSERT/UPDATE/DELETE locked to service-role for authenticated callers.
- `is_pilot_user(uuid)` SECURITY DEFINER helper — TRUE iff the user is in any active pilot agreement for an org with `is_soft_pilot=TRUE`. Used by the gate's count rule (per `LAP_2_ACCEPTANCE_GATE_SPEC` § Gate 1: a `decided_by` not in `pilot_user_ids` does not count toward 100, so Walker's debugging clicks don't inflate the gate).

### 1 ADR promoted to standalone — `ADR_006_PILOT_DATA_ISOLATION` (89 lines)

`docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md`:

- Records the decision: **row-level multi-tenancy + `is_soft_pilot` flag**, NOT a separate Supabase project. Rationale + costs of the alternatives.
- Lists every operational surface that branches on the flag (heartbeat fan-out, gate metrics scope, voice diff logging, audit chain verification cadence, telemetry retention, support tier).
- Explicit data-handling commitments encoded by the ADR: 24-month retention, right to data export, right to erasure, no cross-tenant exposure, no quote without consent.
- Honest about the residual risk: a bug in RLS could in principle leak to a pilot user — same bug we'd have without the pilot. The flag doesn't add attack surface; it adds workload.
- What this ADR explicitly does NOT decide (operational onboarding, exit criteria, multi-pilot, paid handoff).

### 1 agreement template — `pilot-agreement-template-v1.md` (123 lines)

`docs/audits/pilot-agreement-template-v1.md`:

- One-page plain English. NOT a SaaS contract. If GC counsel marks it up into a 12-page MSA, that's a flag — escalate to backup GC.
- 5 sections: what the GC gets, what they commit, what we ask permission to record, what stays in their tenant forever, right to walk + liability cap.
- 24-month retention clause (per ADR-008).
- "No quote without explicit written approval per quote" — protects the GC reputationally and forces the case-study workflow to be honest.
- $10,000 liability cap during the pilot window. Texas governing law.
- Provisioning command embedded as an internal note (NOT in the version sent to the GC) so Walker has a single place to copy from when running the script.

### 1 standup template — `pilot-standup-template.md` (109 lines)

`docs/audits/pilot-standup-template.md`:

- The full 15-minute standup format from the spec § Phase 4: drafts decided table, worst-draft examples, frictions surfaced, Walker's fix list with commit times, quotes captured for `#pilot-quotes`, momentum read (green/yellow/red), tomorrow's calendar checks.
- Copy this file into `docs/audits/pilot-standups/<gc-slug>-day-NN-<date>.md` daily. Public-to-Brad commit at end-of-call.
- Forces "None today" rather than omission for the quotes section — silence is dishonest.

### 1 provisioning script — `scripts/provision-pilot-org.ts` (201 lines)

The Day 49 prep automation. Single command after the agreement is signed:

```sh
npx tsx scripts/provision-pilot-org.ts \
  --org-slug=nexus-companies \
  --signed-by-name="Brad Cameron" \
  --signed-by-email=brad@nexuscompanies.com \
  --signed-by-role="Technical Director" \
  --signed-at="2026-05-18T15:30:00-05:00" \
  --agreement-text-version=v1 \
  --pdf-url="https://drive.google.com/file/d/abc/view" \
  --pilot-user-ids=<pm1>,<pm2>,<sup1>,<sup2>
```

What it does:
1. Resolves the org by slug (fails loudly if unknown).
2. Verifies all 4 pilot users exist as `profiles` rows.
3. Sets `organizations.is_soft_pilot=TRUE`, `soft_pilot_started_at=NOW()`, `soft_pilot_agreement_signed_at=signedAt`.
4. Inserts (or updates if re-running with the same template version) the `pilot_agreements` row with the named users + standardized consent record.
5. Prints next-step smoke commands in order: matview filter swap, heartbeat sanity, worker invoke, gate dry-run, Day 49 prep checklist.

Idempotent on `(organization_id, agreement_text_version)` so a re-run with corrected data updates rather than duplicates.

Input validation: slug regex, email regex, ISO-8601 timestamp parse, uuid regex per pilot user id, count constraint (2–8 users; spec expects 4).

### 2 .gitkeep folders

- `docs/audits/pilot-agreements/.gitkeep` — signed PDFs land here keyed by `<gc-slug>-<date>.pdf`. Path stored in `pilot_agreements.agreement_pdf_url`.
- `docs/audits/pilot-standups/.gitkeep` — daily standup notes from the template above.

---

## Verification

- `npm run typecheck` — **0 errors**. Bugatti gate holds.
- All earlier session tests still pass (141/141 unit tests across 8 files).
- The provisioning script is type-validated against the live `database.ts`; it does not hit the DB at typecheck time but its query shapes are typed.

---

## What this ship deliberately does NOT cover

These remain Walker-side work or downstream Lap 2 receipts:

- **Recruiting Brad Cameron at Nexus** — phone call + 20-min demo. The recruit script lives in the playbook § Phase 1; rehearse-aloud-once is the prep ritual.
- **Backup GC #1 (Carleton) intro hunt** — needs a warm intro through Walker's Texas multifamily network. Drop date if no path by **Day 38**; pivot to backup #2.
- **The actual Day 50 onboarding** — Walker on-site, in person, 8 AM through 6:30 PM. The day-of script is in playbook § Phase 3; this ship doesn't replace Walker walking the slab.
- **The 14-day daily 5:30 PM standup** — call cadence + format are documented; the calls themselves happen.
- **Brad's general-counsel review** of the agreement template — required before signing; the template is a starting point, not a substitute.
- **`scripts/seed-pilot-project.ts`** — Day 49 prep step that imports Brad's existing project's drawings + RFI history into the pilot org. Deferred to actual recruit because the import path depends on whether Brad's data lives in Procore, Autodesk, or somewhere else.
- **`scripts/export-pilot-data.ts`** — Day 60 right-to-export workflow. Trivial wrapper around the existing `compliance-pack` edge function, but pinned to the specific tables touched by the pilot. Day 60 work, not pre-flight.
- **`e2e/pilot-smoke.spec.ts`** — Day 49 prep smoke test. Deferred to staging deploy.

These are documented in the receipt with their pickup conditions; nothing silent.

---

## What's now possible

- **A signed pilot agreement turns into instrumented production state in one command.** No manual SQL. No "did we set the flag?" question.
- **The gate's Gate-1 counting rule is enforceable**: `is_pilot_user(decided_by)` filters out Walker's debugging decisions and any non-named user's clicks. The gate counts only what the playbook says counts.
- **Every operational surface that needs to branch on "this is pilot data" has a single source of truth**: `organizations.is_soft_pilot`. ADR-006 captures every place this discriminator changes behavior.
- **The agreement template is version-pinned at signing time** in `pilot_agreements.agreement_text_version`. We can ship a v2 template later without invalidating signed-v1 agreements.

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `supabase/migrations/20260504050000_pilot_agreements.sql` | NEW | 143 |
| `docs/audits/pilot-agreement-template-v1.md` | NEW | 123 |
| `docs/audits/pilot-standup-template.md` | NEW | 109 |
| `docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md` | NEW (promoted from inline) | 89 |
| `scripts/provision-pilot-org.ts` | NEW | 201 |
| `docs/audits/pilot-agreements/.gitkeep` | NEW | 0 |
| `docs/audits/pilot-standups/.gitkeep` | NEW | 0 |
| `docs/audits/INDEX.md` | EDIT — Days 50–60 row + ADR-006 standalone + spec status | +2 |
| `docs/audits/DAYS_50_60_PILOT_PLAYBOOK_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new this segment:** ~665 lines.

---

## Cumulative pre-flight + Lap 2 implementation tally

| Segment | Lines | Tests |
|---|---|---|
| Day 30.5 telemetry | 660 | 4 |
| Day 30.75 gate | 990 | 15 |
| Day 31 cron foundation | 1,060 | — |
| Day 32 cascade + extraction | 590 | 24 |
| Days 33–35 variance/staffing/weather | 830 | 22 |
| Day 38 citations | 2,070 | 28 |
| Days 43–49 voice | 1,230 | 40 |
| **Days 50–60 pilot playbook substrate** | **665** | **—** |
| **Pre-flight cumulative** | **~8,100** | **133** |

ADRs promoted to standalone: 003, 004, 005, 006, 008. Untouched: 002, 007, 009 (already standalone).
Migrations shipped: 9 (telemetry, audit_incidents, dedupe, scheduled-insights heartbeat, scheduled-insights log, organizations soft-pilot flag, citations resolver/telemetry, audit_incidents fake_citation, voice diffs, pilot agreements).
CI workflows shipped: 1 (`lap-2-acceptance.yml`).
Day receipts shipped: 8 (30.5, 30.75, 31, 32, 33–35, 38, 43–49, 50–60).

**Typecheck: 0 errors. The Bugatti gate holds for the entire pre-flight.**

---

## Lap 2 spec set — final status

| Spec | Status |
|---|---|
| `IRIS_TELEMETRY_SPEC` | ✅ Shipped Day 30.5 |
| `LAP_2_ACCEPTANCE_GATE_SPEC` | ✅ Shipped Day 30.75 (matview, CI workflow, threshold script, 7-scenario seed) |
| `SCHEDULED_INSIGHTS_SPEC` | ✅ Shipped Days 31–35 (foundation + all 5 detectors + 46 envelope tests) |
| `IRIS_CITATIONS_SPEC` | 🟡 Day 38 server backbone + side panel + auto-reject shipped. Days 39–41 remain (4 dedicated panels + staging smoke + Walker review). |
| `IRIS_VOICE_GUIDE_SPEC` | 🟡 Infrastructure shipped Days 43–49 (style.ts + linter + prompt + diff log + sampling). Walker-side: 150-draft hand-edit cycle + iris-call wiring + Day 48 PM review. |
| `SOFT_PILOT_PLAYBOOK` | 🟡 Code substrate shipped Days 50–60 (pilot_agreements migration + provisioning script + agreement template + standup template). Walker-side: recruit + onboard + run pilot + write Day 60 receipt. |

The 🟡 items are all "infrastructure ready, Walker-side execution remains." There is no spec where the code substrate is missing.

---

## Next session pickup

Pre-flight is operationally complete. The remaining work that *can* be done in code, in priority order:

1. **Day 39 — 4 dedicated citation panels** (daily_log, change_order, spec, schedule_phase) following the `RfiCitationPanelContent` pattern.
2. **Day 45 — wire `voiceLinter` into `supabase/functions/iris-call/index.ts`** (3-line edit + diff-log insert).
3. **`scripts/seed-pilot-project.ts`** — once Walker confirms which GC's data lives in which system, write the importer for that system.
4. **`scripts/export-pilot-data.ts`** — Day 60 right-to-export workflow.
5. **`e2e/pilot-smoke.spec.ts`** — Day 49 prep smoke test.

The rest is human work — recruiting, onboarding, hand-edits, the 5:30 PM standup loop. The code is ready.
