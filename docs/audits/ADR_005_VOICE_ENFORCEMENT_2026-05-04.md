# ADR-005 — Voice Enforcement: Prompt-Time + Post-Process Linter

**Status:** Accepted
**Date:** 2026-05-04
**Companion to:** `IRIS_VOICE_GUIDE_SPEC_2026-05-04.md`
**Implementation:**
- `src/lib/iris/style.ts` — rule registry
- `src/lib/iris/voicePrompt.ts` — system prompt block renderer
- `src/lib/iris/voiceLinter.ts` — post-process linter
- `supabase/migrations/20260504040000_iris_voice_diffs.sql` — diff log table

## Context

Iris speaks with the default Anthropic LLM voice — warm, hedging, em-dash-heavy, "certainly," "I hope this helps." A 28-year-old PE doesn't sound like that. The Lap 2 soft-pilot PM will reject drafts on tone alone if we don't fix this; per the Field Manual, voice is the #1 reason PMs drop a tool that's otherwise useful. The question is *how* to enforce voice on every iris-call output.

## Options considered

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Prompt-time only** | Cheap (no second pass). Visible to the model itself, so it can self-correct mid-generation. | LLMs ignore ~15% of voice rules silently. No measurement. No diff = no training corpus for future fine-tunes. | Not enough on its own |
| **Post-process linter only** | Deterministic. Auditable. Cheap to evolve. Diff is a free training corpus. | Linter rules duplicate what the prompt would say anyway; the model produces non-conforming text every time and the linter has to fix it. Awkward edits for some rules. | Not enough on its own |
| **Both — prompt-time + linter** (chosen) | Prompt sets the baseline so the linter doesn't do heavy lifting; linter catches the residual ~15% drift. The diff between raw and linted output becomes auditable telemetry AND fine-tune-corpus. | Two surfaces — but solved by `style.ts` as the single source of truth for both. | **Accepted** |

## Decision

Both surfaces enforce. **`style.ts` is the source of truth for both.** Editing `style.ts` updates the prompt block (via `voicePrompt.ts`) and the linter (`voiceLinter.ts`) atomically — there is no second place that needs to be kept in sync.

### What lives where

| Type of rule | Prompt? | Linter? | Why |
|---|---|---|---|
| Banned phrases (no "certainly", no em-dash, no LLM coda) | ✓ | ✓ | Prompt sets expectation; linter catches the 15% miss + autofixes. |
| LLM-affirmation lead ("Great question!") | ✓ | ✓ | Same. |
| Length caps (RFI ≤ 60 words; daily log ≤ 200) | ✓ | ✓ (no autofix) | Prompt teaches; linter measures. We don't auto-truncate — that produces bad text. |
| Required structure ("question + impact for RFIs") | ✓ | — | Hard to lint reliably; prompt + post-edit review carries it. |
| Construction vernacular ("RFI" not "request") | ✓ | — | Linting "request" mid-paragraph would produce false positives. Prompt-only with vocabulary list. |
| Contractions in formal contexts | ✓ | ✓ | Scoped to RFI + submittal; linter catches; daily-log narratives keep contractions (field voice). |

### Linter execution model

1. iris-call gets raw LLM output.
2. `lintVoice(rawText, ctx)` runs.
3. The linter iterates `getLintableRules()`, applies any autofix, re-runs to fixed-point (capped at 5 passes so a pathological pair of rules can't loop).
4. Each rule that fired is recorded in `failedRules: { ruleId, message }[]`.
5. The (raw, linted, failed_rule_ids) triple lands in `iris_voice_diffs` for telemetry + future fine-tuning.
6. The linted text is what the user sees — Iris speaks the way `style.ts` says she does, every time.

### The diff is the load-bearing artifact

`iris_voice_diffs` is more important than the linter itself. Three uses:

1. **Telemetry**: a daily query groups by rule id. A rule that fires on > 50% of drafts means the prompt isn't sticking and the system message needs strengthening. Walker watches this in the 5:30 PM standup.
2. **Training corpus**: paired (raw, linted) text becomes the fine-tune ground truth in Q2 2027 (per the North Star). The linter is the judge; the LLM-of-the-day is the student.
3. **Auditability**: when a pilot rejects on tone, Walker can pull the diff and see what the linter caught vs what slipped through.

## Consequences

**Positive.**
- Voice rules evolve in one file; both surfaces stay in sync by construction.
- Drift between raw LLM output and final voice is observable in real time.
- Adding a rule = adding an entry to `VOICE_RULES`. The linter discovers it via `getLintableRules()`, the prompt discovers it via `voicePrompt.ts` filtering.
- The Day-43-vs-Day-47 hand-edit diff ratio is the acceptance signal — measurable, not vibes.

**Negative / accepted tradeoffs.**
- Two passes per iris-call: a prompt with the rules + a post-process. Latency cost: < 5ms (linter runs in JS, no LLM round-trip). Acceptable.
- Length-cap rules don't autofix — we report the violation and let the user edit the draft. Auto-truncation produces unreadable text. Acceptable.
- The structural rules ("RFI: question + impact") aren't linted programmatically. The prompt has to teach them, and the Day 48 PM-network reviewer has to confirm they stuck. Acceptable for Lap 2; a structural linter is a Lap 3+ research project.

## Implementation status

- ✅ `style.ts` registry with 10 seed rules across 5 categories.
- ✅ `voiceLinter.ts` with fixed-point autofix and pass-count safety cap.
- ✅ `voicePrompt.ts` renders prompt blocks scoped to actionType (no over-injection).
- ✅ `iris_voice_diffs` migration + 60-day retention prune cron.
- ✅ 40 Vitest unit tests covering every lintable rule + the aggregator + the prompt renderer.
- 🟡 `iris-call` integration — adds a 3-line wrap around the existing response path; Day 45 wiring per the spec.
- 🟡 `style.ts` rules grow from 10 to ~15+ during the Day 43–47 hand-edit cycle (the seed rules are derived from the spec's first-pass observations; pilot edits add the rest).

## What this ADR explicitly does NOT decide

- Multi-voice support (one voice per Iris in Lap 2; Lap 3+ may add a `voice_preset_id` to drafted_actions).
- Auto-rule-discovery (a future tool that reads new edit corpora and proposes rule additions). For Lap 2, Walker writes rules manually from rationales.
- Voice fine-tuning. Q2 2027 per the North Star.
- Rejection-pattern signals ("user always rejects drafts containing X — propose a rule"). Lap 3.

## References

- `docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md` — full spec; this ADR is its enforcement decision.
- `src/lib/iris/style.ts` — the rule registry both surfaces consume.
- `supabase/functions/iris-call/index.ts` — the chokepoint where the linter wires in.
- `SiteSync_Field_Manual.docx` — voice as the #1 PM-rejection signal.
