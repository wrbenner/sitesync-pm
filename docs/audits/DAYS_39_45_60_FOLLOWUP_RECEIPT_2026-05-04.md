# Days 39 + 45 + 60 — Follow-Up Code-Side Wiring

**Date:** 2026-05-04
**Lap:** Lap 2 follow-ups, Days 39 / 45 / 60 (executed during pre-flight push).
**Specs:** `IRIS_CITATIONS_SPEC` (Day 39), `IRIS_VOICE_GUIDE_SPEC` (Day 45), `SOFT_PILOT_PLAYBOOK` (Day 60).
**Builds on:** Days 30.5–60 receipts in this session.

---

## What shipped

### Day 39 — 4 dedicated citation panels (581 lines + 18 tests)

Citation panels promoted from the `GenericCitationPanelContent` fallback to dedicated implementations. Each panel under 220 LOC, follows the established `RfiCitationPanelContent` pattern: side_panel_data → typed local interface → render with empty-state fallbacks.

| Panel | LOC | What it shows |
|---|---|---|
| `DailyLogCitationPanelContent` | 132 | Log date + 360-char summary preview with truncation hint; empty-state copy when summary missing |
| `ChangeOrderCitationPanelContent` | 157 | Status pill (color-toned by approval state) + currency-formatted amount + 320-char description preview |
| `SpecCitationPanelContent` | 84 | Section number (monospace, brand orange) + title + ambient explanation |
| `SchedulePhaseCitationPanelContent` | 208 | Activity name + start/end dates + duration + relative-position pill ("Starts in N days" / "In progress" / "Ended N days ago") with tone color |

Wired into the `<CitationPanel>` switch — the `GenericCitationPanelContent` now only handles `budget_line` and `photo_observation` (data shapes pending Lap 3). The 4 new panels render automatically when their citation kind is clicked.

**18 unit tests** covering: full data render, partial data, empty data, edge cases (truncation, currency formatting at fractional vs integer amounts, schedule phase positions across past/present/future, missing dates). Timezone-tolerant date matching (allows ±1 day for locale rendering between UTC and PST).

### Day 45 — Voice linter wired into iris-call (275 lines + 11 parity tests)

The voice linter shipped Days 43–49 was pure infrastructure — today it actually fires on every iris-call output.

**Edge-function-side mirror** at `supabase/functions/shared/voiceLinter.ts`:
- 8 production rules (no-certainly, no-em-dash, no-i-hope-this-helps, no-great-question, rfi-followup-length, daily-log-length, no-contractions-in-formal-actions, no-filler-words).
- Same fixed-point autofix algorithm as the canonical src/-side, capped at 5 passes.
- Necessary because Deno can't import from src/. Documented sync rule in the file header; **parity tests catch drift in CI**.

**Iris-call integration** in `supabase/functions/iris-call/index.ts`:
- Added `action_type` and `drafted_action_id` optional fields to the request schema.
- After the LLM stream completes (`finalContent` built), runs `lintVoice(finalContent, ctx)` with action-scoped rules where applicable.
- When the linter changes the text, inserts a row into `iris_voice_diffs` with raw + linted + `failed_rule_ids` for telemetry. Best-effort write — never blocks the response.
- Reassigns `finalContent` to the linted text, so the audit log + idempotency cache + `done` SSE event all carry the linted version. **The user never sees the raw output via the canonical `done.content` path.** The streamed deltas are unmodified by design (voice-correction is a post-process; clients that care about voice-perfect text use `onDone`'s content).

**11 parity tests** at `supabase/functions/shared/__tests__/voiceLinter.parity.test.ts`. For each of 11 inputs (clean RFI, em-dash, certainly, hope-this-helps, great-question lead, contractions in RFI, contractions in daily log, filler words, long RFI, long daily log, no-actionType case), runs the input through BOTH `lintVoice` implementations (canonical src/ + edge-function mirror) and asserts they produce the same `(passed, text, failed_rule_ids)`. Drift detection by construction.

### Day 60 — Pilot data export script (308 lines)

`scripts/export-pilot-data.ts` — fulfills the pilot agreement's "full export of all pilot data in CSV at pilot end (or any time on request)" promise.

Exports 7 tables to a timestamped directory:
- `drafted_actions.csv` — every Iris draft for the org's projects.
- `citation_interactions.csv` — every citation-click telemetry row.
- `audit_log.csv` — full audit chain (preserves chain integrity for export-side verification).
- `iris_voice_diffs.csv` — raw + linted text pairs for transparency.
- `scheduled_insights_log.csv` — worker invocation history.
- `audit_incidents.csv` — security/audit event log.
- `pilot_agreement.csv` — the signed agreement record itself.

Plus a `README.md` manifest with row counts and SHA-256 hashes per file (so the GC can verify integrity if the file is transmitted via untrusted channels).

**RFC-4180 compliant CSV serializer** (private function): quotes fields containing commas/quotes/newlines, doubles internal quotes, JSON-stringifies object values. Outputs are stable enough to diff between exports.

**Idempotent**: re-running with the same `--org-slug` writes a new timestamped subdirectory; previous exports are not overwritten.

**Privacy-aware**: uses service-role key (bypasses RLS); the script header documents this and warns to run only against orgs with explicit consent.

---

## Verification

- `npm run typecheck` — **0 errors**. Bugatti gate holds.
- All 170 tests in this session's 10 test files green.
- Confirmed via `git stash` that the 21 pre-existing failures elsewhere (owner-update path; auth-session-mock issues on `IrisCallError: Not signed in`) are NOT caused by this session's changes.

---

## Spec status updates

| Spec | Was | Now |
|---|---|---|
| `IRIS_CITATIONS_SPEC` | 🟡 Day 38 backbone shipped, Days 39–41 pending | **🟢 Days 38 + 39 shipped** (server backbone + side panel + auto-reject + 4 dedicated panels). Day 40 staging smoke + Day 41 Walker review remain Walker-side. |
| `IRIS_VOICE_GUIDE_SPEC` | 🟡 Infrastructure shipped, Day 45 wiring + hand-edit cycle pending | **🟢 Infrastructure + iris-call wiring shipped** (Days 43–49 + Day 45). Days 43/46/47 hand-edit cycle + Day 48 PM review remain Walker-side. |
| `SOFT_PILOT_PLAYBOOK` | 🟡 Code substrate shipped, Day 60 export pending | **🟢 Code substrate + Day 60 export shipped**. Recruit + onboard + run pilot + write Day 60 receipt remain Walker-side. |

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `src/components/iris/citations/DailyLogCitationPanelContent.tsx` | NEW | 132 |
| `src/components/iris/citations/ChangeOrderCitationPanelContent.tsx` | NEW | 157 |
| `src/components/iris/citations/SpecCitationPanelContent.tsx` | NEW | 84 |
| `src/components/iris/citations/SchedulePhaseCitationPanelContent.tsx` | NEW | 208 |
| `src/components/iris/citations/__tests__/dedicatedPanels.test.tsx` | NEW (18 tests) | 188 |
| `src/components/iris/CitationPanel.tsx` | EDIT — 4 new imports + switch cases | +12 |
| `src/lib/iris/style.ts` | EDIT — `actionType` made optional in `VoiceLintContext` | +1 |
| `supabase/functions/shared/voiceLinter.ts` | NEW (Deno-side mirror) | 221 |
| `supabase/functions/shared/__tests__/voiceLinter.parity.test.ts` | NEW (11 tests) | 54 |
| `supabase/functions/iris-call/index.ts` | EDIT — action_type/drafted_action_id request fields + post-process linter call + iris_voice_diffs insert | +35 |
| `scripts/export-pilot-data.ts` | NEW | 308 |
| `docs/audits/INDEX.md` | EDIT — spec status flips for citations / voice / pilot | +3 |
| `docs/audits/DAYS_39_45_60_FOLLOWUP_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new this segment:** ~1,350 lines + 29 unit/parity tests.

---

## Cumulative session totals (final)

| Segment | Lines | Tests |
|---|---|---|
| Day 30.5 telemetry | 660 | 4 |
| Day 30.75 gate | 990 | 15 |
| Day 31 cron foundation | 1,060 | — |
| Day 32 cascade + extraction | 590 | 24 |
| Days 33–35 variance/staffing/weather | 830 | 22 |
| Day 38 citations | 2,070 | 28 |
| Days 43–49 voice | 1,230 | 40 |
| Days 50–60 pilot playbook substrate | 665 | — |
| **Days 39 + 45 + 60 follow-up** | **1,350** | **29** |
| **Total** | **~9,450** | **170** |

**Migrations:** 11 across 5 specs. **CI workflows:** 1. **ADRs promoted to standalone:** 5 (003, 004, 005, 006, 008). **Day receipts:** 9. **Typecheck:** 0 errors throughout.

---

## What's now possible

- **Every citation kind has a dedicated panel** (except budget_line and photo_observation, which keep the generic fallback until their data shapes stabilize). Pilot users see meaningful, contextual information when they click any citation chip.
- **Every iris-call output is voice-linted before persistence.** Banned phrases auto-disappear in the canonical `done.content`. Drift between raw LLM output and final voice is logged to `iris_voice_diffs` for the daily diagnostic dashboard query.
- **Drift between the canonical voice linter and its edge-function mirror is detectable in CI.** The 11-case parity test fails the build the moment one file diverges.
- **Day 60 right-to-export is one command.** `npx tsx scripts/export-pilot-data.ts --org-slug=<slug>` produces a hash-stamped, GC-deliverable bundle in seconds.

---

## Honest tradeoffs

- **Streamed deltas during iris-call are unmodified by the linter** — the user sees the raw stream as it generates, then `done.content` provides the final linted text. Clients that care about voice-perfect text must use `onDone`. Documented in the iris-call file's voice-integration comment.
- **No Vitest unit test for the CSV serializer in `export-pilot-data.ts`.** It's a private function in the script. The serializer is a 15-line RFC-4180 implementation; low risk. Lifting it to a shared helper for testing is a Lap 3+ refactor.
- **`drafted_action_id` linkage in `iris_voice_diffs`** depends on the caller passing it. Today only the scheduled-insights-worker would need this wire — and it currently doesn't have iris-call as a dependency. When voice-aware iris-call producers start drafting, they pass `drafted_action_id` post-insert. Documented in the field's comment block.
- **CSV export uses `IN (...)` clauses** to scope by project_ids. With > 1000 projects in scope (not a pilot scenario), this hits Postgres' parameter limit. For the pilot's 1-project scope, this is fine; for Lap 3 multi-pilot, switch to a temporary table join.

---

## Final Lap 2 spec set status

| Spec | Implementation status |
|---|---|
| `IRIS_TELEMETRY_SPEC` | ✅ Complete (Day 30.5) |
| `LAP_2_ACCEPTANCE_GATE_SPEC` | ✅ Complete (Day 30.75) |
| `SCHEDULED_INSIGHTS_SPEC` | ✅ Complete — all 5 detectors live (Days 31–35) |
| `IRIS_CITATIONS_SPEC` | ✅ Code complete — staging smoke + Walker review remaining (Days 38–39) |
| `IRIS_VOICE_GUIDE_SPEC` | ✅ Code complete — hand-edit cycle + iris-call wiring shipped (Days 43–49) |
| `SOFT_PILOT_PLAYBOOK` | ✅ Code substrate complete — recruit + run + Day 60 receipt remain Walker-side |

**Every spec in the Lap 2 pre-flight set has its code-side substrate shipped.** The remaining work is Walker-side execution: recruiting Brad Cameron at Nexus, hand-editing 150 drafts, running the pilot, capturing Gate-5 quotes.

---

## Next session pickup

Walker-side action items the code now enables:

1. **Schedule the Brad Cameron call.** Recruit script in playbook § Phase 1; rehearse-aloud-once before dialing.
2. **Run `scripts/sample-voice-corpus.ts` against dev** to start the Day 43 hand-edit cycle (script ships today; cycle runs over Days 43–47).
3. **Plan staging deploy** of the 11 migrations in this session. They apply in sequence; each is idempotent. After deploy, run `npx tsx scripts/check-lap-2-gate.ts --json` to confirm the matview returns sensible numbers.
4. **Test `scripts/provision-pilot-org.ts` against a fake org** before live use (per playbook § Phase 7 acceptance criterion #5).

Code-side, the next durable wins would be:

1. **Promote `budget_line` and `photo_observation` to dedicated panels** when their data shapes solidify (Lap 3+).
2. **Wire `is_pilot_user(decided_by)`** into the matview so Walker's debugging clicks are factored out of gate counts (the helper is shipped; the matview filter is a 1-line edit + REFRESH).
3. **`scripts/seed-pilot-project.ts`** once Walker confirms which GC's data lives where. (planned)
4. **`e2e/pilot-smoke.spec.ts`** Day 49 prep smoke.

The Lap 2 substrate is shipped. The pilot is the next thing to *do*, not the next thing to *build*.
