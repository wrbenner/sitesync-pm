---
name: iris-spec
description: File a tier-1 Iris Spec describing one Iris feature — entrypoint, persona, specialist (per ADR-018), context fabric inputs (per ADR-020), citation kinds (per IRIS_CITATIONS_SPEC), voice rules (per ADR-005), auto-execute risk, telemetry, acceptance — in ~250 words; sister to page-card and workflow-spec.
version: "1.0.0"
when_to_use: When a new Iris drafting/suggestion/auto-execute feature ships, or when reviewing an existing Iris feature for ADR-018 boundary contract compliance, citation completeness, voice-linter coverage, or auto-execute risk class.
allowed-tools: read_file, write_file, bash, grep, edit_file
---

## Overview

An **Iris Spec** is the primary spec unit for any Iris feature — anything that drafts text for a user, suggests an action, or auto-executes inside the 60-second cancel window (per Lap 3 spec). The card sits on top of the existing Iris substrate (IRIS_TELEMETRY_SPEC, IRIS_CITATIONS_SPEC, IRIS_VOICE_GUIDE_SPEC, the IRIS Native Phase 1–6 specs, ADRs 002–008 and 017–021) and answers: who is this for, what does it do, what does it cite, what voice does it follow, and how risky is its action class?

Sister templates: `/page-card` (UI surfaces) and `/workflow-spec` (cross-feature chains). All three share the same 10-field shape, plus Iris Spec carries one extra row: **Voice rules**.

**Golden rule:** Every Iris feature has a citation contract (≥1 citation kind required, per IRIS_CITATIONS_SPEC) and a voice contract (`style.ts` ruleset + linter, per ADR-005). If your card can't state both in one line each, you don't ship it.

---

## Template

Copy this block, fill it in, save to `docs/audits/IRIS_SPEC_<NAME>_<YYYY-MM-DD>.md`.

```markdown
# Iris Spec — `iris.<entity>.<action>`

**Date:** YYYY-MM-DD · **Status:** Draft | Reviewed | Locked
**Implementation:** `supabase/functions/iris-call/...` + `<consumer surface>`

| Field | Value |
|---|---|
| **Persona(s)** | (per ADR-019) — who reviews; who is the target reader of the output |
| **Job-to-be-done** | One sentence. "When X, draft/suggest/execute Y so the user can do Z faster." |
| **Entrypoints** | UI surfaces that surface this feature + scheduled-insights detector (if any). `[Deep dive →]` |
| **Context Fabric inputs** | (per ADR-020) — what `buildContext({...})` pulls. List every entity kind. `[Deep dive →]` |
| **Stores** | Consumer-side stores: `useIrisDraftStore`, `useIrisInsights`, etc. (per ADR-002 — they stay separate). |
| **Auto-execute risk** | `READ-ONLY DRAFT` \| `SUGGESTION` \| `AUTO-EXECUTE (60s cancel window)` |
| **Specialist + boundary** | (per ADR-018) — Drafter \| Money \| Schedule \| Code, plus the deterministic check + write scope |
| **Citations required** | (per IRIS_CITATIONS_SPEC) — list of kinds; minimum count; side-panel per ADR-004. `[Deep dive →]` |
| **Voice rules** | (per ADR-005) — `style.ts` ruleset name; linter required Y/N; post-process `iris_voice_diffs` logged Y/N. |
| **Telemetry** | (per IRIS_TELEMETRY_SPEC + ADR-008) — `iris.<feature>.shown / accepted / dismissed / executed / cancelled`, or `⚠️ none`. |
| **Acceptance** | Test counts + cite-or-reject coverage + voice-linter zero-violations + Day-N gate. `[Deep dive →]` |

**Open questions:** 1–3 bullets. Empty when locked.
```

---

## Section-by-section authoring guide

| Field | What goes here | What does NOT go here |
|---|---|---|
| **Persona(s)** | "PM (reviews); Architect (target reader of output)" — note both reviewer and downstream reader if they differ. | Don't write `system` even for cron-fired drafts; the reviewer persona always matters. |
| **Job-to-be-done** | Business outcome, not "Iris drafts a thing." Example: "When RFI ball-in-court > 5d, surface a predicted answer so the architect's reply lands faster." | Don't paraphrase the function name. |
| **Entrypoints** | Every UI surface where the feature is reachable. If a scheduled-insights detector fires it (per SCHEDULED_INSIGHTS_SPEC), name the detector. | Don't list "potential" entrypoints. |
| **Context Fabric inputs** | The literal `buildContext({ persona, entity, related: [...] })` shape — list every related entity kind. | Don't list every column you read; the related entities are enough. |
| **Stores** | The 5 separate Iris stores (per ADR-002 — never merge them). List only the ones this feature touches. | Don't list non-Iris stores the consumer surface uses. |
| **Auto-execute risk** | Pick exactly one: `READ-ONLY DRAFT` (never writes; user must accept), `SUGGESTION` (writes a non-destructive hint row), `AUTO-EXECUTE (60s cancel window)` (writes the real entity, can be cancelled in 60s per Lap 3 spec). | Don't invent new risk classes. |
| **Specialist + boundary** | The ADR-018 contract: which specialist (Drafter / Money / Schedule / Code), the deterministic predicate that gates the LLM call, the write scope, the audit fields, the tool allow-list. | Don't list the LLM model — that's an implementation detail behind the deep dive. |
| **Citations required** | Per IRIS_CITATIONS_SPEC — the 8 citation kinds (rfi / drawing / spec_section / daily_log / change_order / schedule_phase / photo_anchor / audio_anchor) plus the minimum count and "OR" / "AND" semantics. | Don't list "potential" citations; only what the feature requires. |
| **Voice rules** | The exact `style.ts` ruleset name (e.g., `rfi_draft`, `incident_summary`). Whether the voice linter is required to gate accept (Y/N). Whether `iris_voice_diffs` are logged on user edits (Y/N). | Don't paraphrase the rules; the ruleset name is enough — the deep dive holds the rules themselves. |
| **Telemetry** | Specific event names: `iris.rfi.draft.shown`, `iris.rfi.draft.accepted`, etc. If none, write `⚠️ none` and add an Open Question. | Don't conflate per-feature telemetry with the substrate's `iris_telemetry` table — list events, not the table. |
| **Acceptance** | "N unit tests in <path>; cite-or-reject test in <path>; voice linter 0 violations on the corpus in <path>; lands the Day-N gate in <receipt>." | Don't paste test source. |
| **Open questions** | Concrete bullets. "Should the cancel window be 30s instead of 60s for high-confidence drafts?" — that kind of thing. | Don't use this for general musings. |

---

## How to populate from code (the 90-second sweep)

```bash
# Find the iris-call edge fn handler for this feature
ls supabase/functions/iris-call/
grep -rn "iris\\.<entity>\\.<action>" supabase/functions/

# Find consumer-side hooks + components
grep -rn "iris\\.<entity>\\.<action>\|useIris.*<Entity>.*Draft" src/

# Find the citation contract
grep -rn "citations.*required\|cite-or-reject\|verifyCitationSnippet" supabase/functions/iris-call/

# Find the voice ruleset
grep -rn "style\\.ts.*rfi_draft\|style\\.ts.*<ruleset>" src/

# Find the boundary contract (per ADR-018)
grep -rn "specialist.*Drafter\|specialist.*Money\|specialist.*Schedule\|specialist.*Code" src/

# Find existing telemetry hooks
grep -rn "iris\\.<entity>\\.<action>\\." src/  # any matches = events emitted today
```

For citations: every Iris feature must specify ≥1 required citation kind from the 8-kind taxonomy (per IRIS_CITATIONS_SPEC). For voice: every Iris feature that produces user-facing strings must wire the linter (per ADR-005).

---

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| No Auto-execute risk class | Card silently implies `READ-ONLY DRAFT` even for chains that auto-fire | Always write the exact class. If unsure, default to `READ-ONLY DRAFT` and revisit. |
| "Citations: optional" or "as needed" | Violates IRIS_CITATIONS_SPEC | Pick at least one required kind. If the feature genuinely needs none (rare), write "N/A — interpretive output, not citation-bearing" and justify in Open Questions. |
| Voice ruleset = `default` or unnamed | Means the feature uses generic voice rules — almost never right | Name the action-scoped ruleset (e.g., `rfi_draft`, `incident_summary`); add it to `style.ts` if missing. |
| Listing the LLM model | Model choice leaks into every card; rotates often | Keep the model behind the deep dive. The card carries the contract, not the implementation. |
| Specialist boundary = "Drafter" with no deterministic check | Violates ADR-018 — every specialist needs the deterministic gate | Write the predicate (e.g., `rfi.status = 'open' AND ball_in_court_days >= 5`). |
| Telemetry = `(none)` and you move on | Same Lap-2 gap as page cards / workflow specs | Write `⚠️ none` and add an Open Question; flag in receipt |
| Filing under the wrong path | Card hides from INDEX.md | `docs/audits/IRIS_SPEC_<NAME>_<DATE>.md` and append to INDEX |

---

## After you save

1. Append a one-line entry to `docs/audits/INDEX.md` under the **Iris Specs** section
2. Cross-link: every page that surfaces this Iris feature should list it in the page card's **Iris hooks** field; verify the back-references
3. If the feature is `AUTO-EXECUTE`, double-check that the cancel-window UX is wired per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md` before promoting status from `Draft` to `Reviewed`
4. If `⚠️ none` is in Telemetry, add the feature to the Lap-2 telemetry-instrumentation punch list

---

## Usage Tracking

usage_count: 0
last_used: null
