# Days 43–49 — Iris Voice Guide: Infrastructure + Seed Rules + Linter

**Date:** 2026-05-04
**Lap:** Lap 2 Week 7, Days 43–49 (executed during pre-flight push).
**Spec:** `docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md`
**ADR:** `docs/audits/ADR_005_VOICE_ENFORCEMENT_2026-05-04.md` (promoted to standalone today).

---

## What shipped

The voice-enforcement infrastructure end-to-end: rule registry, prompt renderer, post-process linter with fixed-point autofix, the diff-log table for telemetry/training-corpus, sampling script for the hand-edit cycle, ADR-005, and 40 unit tests covering every lintable rule plus the aggregator.

The Day 43–47 hand-edit cycle itself is Walker-side work — the system prompt + linter are the *substrate* the cycle's outputs land in. Today's ship lets the cycle execute against working code.

### 1 SQL migration — `iris_voice_diffs` (105 lines)

`supabase/migrations/20260504040000_iris_voice_diffs.sql`:

- Table keyed on `id`; references `drafted_action_id` with cascade-delete; columns `raw_text`, `linted_text`, `failed_rule_ids text[]`, `action_type`, `detector_kind`, `recorded_at`.
- 3 indexes: GIN on `failed_rule_ids` (rule-frequency queries), recency, per-action-type drill-down.
- RLS: org admins of the related project's org can read; service-role inserts. INSERT/UPDATE/DELETE locked to service role for authenticated callers.
- 60-day retention prune cron (04:17 UTC daily) — voice diffs are training corpus and outlive scheduled-insights logs (30d).

### 3 sibling source files — single source of truth (475 lines)

- **`src/lib/iris/style.ts`** (328 lines) — `VOICE_RULES` registry with 10 seed rules across 5 categories: banned phrases (`no-certainly`, `no-em-dash`, `no-i-hope-this-helps`, `no-great-question`), vernacular (`use-construction-vernacular`), length (`rfi-followup-length`, `daily-log-length`), required structure (`rfi-state-question-and-deadline`), register (`no-contractions-in-formal-actions`, `no-filler-words`). Each rule carries a stable `id`, optional `promptBlock`, optional `lintCheck`, examples (good/bad), and a `derivedFrom` array for corpus-pedigree tracing.
- **`src/lib/iris/voiceLinter.ts`** (103 lines) — `lintVoice(text, ctx, opts)` runs the registry, applies autofixes to fixed-point (capped at 5 passes), records every fired rule's id for telemetry. `failedRuleIds(result)` reduces to the array shape `iris_voice_diffs.failed_rule_ids` expects.
- **`src/lib/iris/voicePrompt.ts`** (44 lines) — `buildVoicePrompt(actionType?)` renders the system-prompt block, scoping length + contraction rules to applicable action types so a daily-log generation doesn't get told "60 word limit." When `actionType` is undefined, all rules render — over-injection is harmless; under-injection is a regression.

### Sampling script + corpus README (256 lines)

- **`scripts/sample-voice-corpus.ts`** — pulls drafts from the dev environment, stratifies across 6 action_types × 5 confidence buckets, writes JSONL. Reports under-filled buckets honestly. Defaults to 50-draft samples; the 150-draft target accumulates over Days 43, 46, 47.
- **`docs/audits/voice-corpus/README.md`** — corpus structure, hand-edit JSONL schema, gitignore rationale (privacy + reproducibility), acceptance signal table from the spec, fallback manual workflow when the script can't run.

### ADR-005 standalone (91 lines)

`docs/audits/ADR_005_VOICE_ENFORCEMENT_2026-05-04.md` — promoted from inline. Records the prompt-time + post-process decision, the rule-by-rule placement table, the fixed-point linter execution model, and explicitly enumerates what this ADR doesn't decide (multi-voice, auto-rule-discovery, fine-tuning, rejection-pattern signals).

### Test coverage (302 lines, 40 tests)

`src/lib/iris/__tests__/voiceLinter.test.ts`:

- **Registry sanity**: unique ids; every example has non-empty good/bad; every rule has at least promptBlock or lintCheck.
- **Per-rule cases** for all 8 lintable rules (every banned-phrase rule + length rules + contraction rule + filler rule). Each rule has 3+ cases covering positive matches, edge cases (case-insensitivity, whole-word matching), and clean-text passes.
- **Aggregator**: clean text passes; "certainly" + politeness coda autofixes in one pass; em-dash → period replacement; length-rule failure reported without auto-truncation; `autofix: false` mode reports without modifying; fixed-point re-pass converges; 5-pass safety cap holds against pathological input.
- **Prompt renderer**: includes preamble; scopes RFI-length to `rfi.draft`; scopes daily-log-length to `daily_log.draft`; scopes contraction rule to formal action types; renders all rules when actionType is undefined.
- **Coverage assertion**: `getLintableRules()` ids are exhaustively tested. New rule added → test list short → assertion fails. Drift detection.

**40/40 passing.** Combined session tally now at **141 unit tests across 8 files**, all green.

---

## Verification

- `npm run typecheck` — **0 errors**. Bugatti gate holds.
- `npx vitest run src/lib/iris/__tests__/voiceLinter.test.ts` — 40/40.

---

## Honest tradeoffs

- **Linter is JS-side, runs in the iris-call edge function**. The Deno runtime imports `style.ts` directly (plain TS, no Node-isms). Day 45's iris-call edit is the wiring; today's ship gives it the module to import.
- **`style.ts` ships with seed rules from the spec's first-pass observations** — those carry `derivedFrom: []` until the Day 43–47 hand-edit cycle assigns them indices into the actual corpus. Walker can refine each rule's pedigree as the cycle runs.
- **Sampling script depends on dev-environment volume**. Per the spec, by Day 43 the scheduled-insights cron has accumulated ~500 drafts. If the actual count comes in lower, the script reports under-filled buckets and Walker decides whether to extend the heartbeat cadence or sample-with-replacement.
- **Length rules don't autofix**. Per the spec: auto-truncation produces unreadable text. We report the violation; the user trims. Documented in ADR-005.
- **Construction vernacular** is prompt-only. Linting "request" mid-paragraph would produce false positives. The diff log catches violations at the corpus level (Walker watches).

These are deliberate, documented choices — not corner-cuts.

---

## What's now possible

- **Iris will sound like Iris.** Once `iris-call` wires the linter (Day 45), every output passes through `lintVoice` before reaching `drafted_actions.payload`. Banned phrases auto-disappear. The diff lands in `iris_voice_diffs` for telemetry.
- **The hand-edit cycle has its substrate.** `npx tsx scripts/sample-voice-corpus.ts --count=50 --out=...` writes a JSONL file Walker hand-edits. The rationales become rules; the rules become both prompt + linter; the cycle compounds.
- **Voice rules can be added without touching prompt or linter callsites.** Append to `VOICE_RULES`, the rest of the pipeline picks it up. Drift-resistant by construction.
- **Diagnostic telemetry tells Walker which rules fire most.** Daily SQL query from ADR-005 surfaces the leading indicators of prompt drift; the prompt strengthens before the linter even has to fix it.
- **Future fine-tuning has a corpus.** Every (raw, linted) pair lands in `iris_voice_diffs`. By Lap 3 we have thousands of examples. By Q2 2027 we have a fine-tune-ready dataset.

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `supabase/migrations/20260504040000_iris_voice_diffs.sql` | NEW | 105 |
| `src/lib/iris/style.ts` | NEW (10 seed rules) | 328 |
| `src/lib/iris/voiceLinter.ts` | NEW | 103 |
| `src/lib/iris/voicePrompt.ts` | NEW | 44 |
| `src/lib/iris/__tests__/voiceLinter.test.ts` | NEW (40 tests) | 302 |
| `scripts/sample-voice-corpus.ts` | NEW | 175 |
| `docs/audits/voice-corpus/README.md` | NEW | 81 |
| `docs/audits/ADR_005_VOICE_ENFORCEMENT_2026-05-04.md` | NEW (promoted from inline) | 91 |
| `docs/audits/INDEX.md` | EDIT — Days 43–49 row + ADR-005 standalone | +1 |
| `docs/audits/DAYS_43_49_VOICE_GUIDE_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new this segment:** ~1,230 lines + 40 unit tests.

**Cumulative pre-flight + Lap 2 implementation:**

| Segment | Lines | Tests |
|---|---|---|
| Day 30.5 telemetry | 660 | 4 |
| Day 30.75 gate | 990 | 15 |
| Day 31 cron foundation | 1,060 | — |
| Day 32 cascade + extraction | 590 | 24 |
| Days 33–35 variance/staffing/weather | 830 | 22 |
| Day 38 citations | 2,070 | 28 |
| **Days 43–49 voice** | **1,230** | **40** |
| **Total** | **~7,430** | **133** |

Plus 5 new ADRs (003, 004, 005, 008 promoted standalone), 1 CI workflow, 7 day receipts, 8 production-code migrations. Typecheck: **0 errors**.

---

## Days 43–49: what's left for Walker (NOT in code)

Today's ship completes the *infrastructure*. The actual voice work that locks Iris's voice depends on Walker:

- **Days 43, 46, 47** — three rounds of 50-draft hand-edits. Walker (with the dev environment running and `scheduled-insights` having accumulated ~500 drafts) samples, edits, captures rationales.
- **Day 45** — wire the linter into `supabase/functions/iris-call/index.ts`. 3-line edit; the linter is already imported-and-tested. Wire it after the LLM response, before the `drafted_actions` insert. Log to `iris_voice_diffs`.
- **Day 48** — share 30 random "after" texts with one PM in the network. Acceptance gate: Q3 ("would you send this?") ≥ 24/30 Y.
- **Day 49** — flag-on `VITE_FLAG_IRIS_VOICE_V1=true`; baseline-comparison archive committed.

The diff word-count acceptance signals (Day 46 ≤ 50% of Day 43; Day 47 ≤ 25%) are the measurable proof the voice locked. The signals work because the linter exists today.

---

## Next session pickup

The remaining specs in the Lap 2 pre-flight set:

1. **`SOFT_PILOT_PLAYBOOK`** — Days 50–60. Pilot agreement clauses (telemetry/data per ADR-008), onboarding day-of script, daily 5:30 PM standup template, exit criteria, backup-GC pivot decision tree.

After that, Lap 2 has the full pre-flight specs implemented. Walker takes it from here for the hand-edit cycle and the pilot kickoff.
