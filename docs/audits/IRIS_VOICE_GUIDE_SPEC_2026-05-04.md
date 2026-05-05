# Iris Voice Guide Spec — Lap 2 Days 43–49

**Date:** 2026-05-04
**Status:** Spec ready. Rules themselves emerge from the 150-draft hand-edit cycle; this spec defines methodology + enforcement.
**Includes ADR-005:** voice enforcement timing (prompt-time + post-process).
**Blocks:** Lap 2 Week 7.
**Companion:** `IRIS_CITATIONS_SPEC` (citations don't go through voice processing — they're already structured), `SOFT_PILOT_PLAYBOOK` (voice is what the pilot PM rejects on most often if we get it wrong).

---

## TL;DR

`src/lib/iris/style.ts` does not exist. Iris speaks with the default Anthropic system-prompt voice — warm, hedging, em-dash-heavy, "certainly," "I hope this helps." This is the #1 reason the soft-pilot PM will reject drafts on tone alone.

This spec defines: (1) where the 150 sample drafts come from, (2) the schema of `style.ts` once it exists, (3) ADR-005 — how the rules are enforced (prompt-time injection + post-process linter), (4) how we measure "voice is locked," (5) how the PM-network reviewer gives signoff on Day 48.

---

## ADR-005 — Voice Enforcement Timing

**Decision:** **Both — prompt-time injection sets the baseline; a post-process linter catches drift and produces an auditable diff.**

### The two paths

```
Insight + payload → iris-call → raw LLM output → voice linter → final draft text
                       ▲                              │
                       │                              │
                  style.ts as system                  │
                  prompt block                        ▼
                                          (diff stored on draft;
                                           used as training signal)
```

### Why both

| Approach | Pros | Cons |
|---|---|---|
| Prompt-time only | Cheap. No second pass. Visible to the model itself. | LLM ignores ~15% of voice rules silently. No measurement. No diff = no training signal. |
| Post-process only | Deterministic. Auditable. Cheap to evolve. | Linter rules duplicate what the prompt already says. Can produce awkward edits when forcing rule compliance. |
| **Both (chosen)** | Prompt sets the baseline so the linter doesn't have to do heavy lifting. Linter catches the 15% drift. The diff is the training corpus for future fine-tunes. | Slightly more work; two surfaces to keep in sync — solved by a single source-of-truth file (`style.ts`) that both consume. |

### What goes prompt-side vs linter-side

| Type of rule | Where enforced | Example |
|---|---|---|
| Voice / register | Prompt + linter | "Write like a 28-year-old PE talking to her super, not like ChatGPT." |
| Banned phrases | Linter (regex) | No "certainly," "I hope this helps," "great question," em-dashes |
| Required structure | Prompt | Every RFI follow-up: one sentence stating the question, one sentence stating the deadline pressure |
| Length cap | Linter (token count) | RFI follow-up ≤ 60 words; daily log narrative ≤ 200 |
| Citation-tag presence | Linter (already in citations spec) | Every claim has a citation |
| Construction vernacular | Prompt | Use "RFI" not "request"; "cut sheet" not "data sheet"; "punch" not "punch list item" in casual reference |

The linter source-of-truth: `src/lib/iris/style.ts`. The prompt source-of-truth: `src/lib/iris/voicePrompt.ts` which imports from `style.ts` and renders a prompt block. One file changes, both surfaces update.

---

## Phase 1 — Where the 150 sample drafts come from

The Day 43–47 hand-edit cycle needs 150 drafts. The pilot doesn't start until Day 50. Drafts can't come from the pilot.

### Source: dev environment + scheduled-insights backfill

By Day 43, the `scheduled-insights` cron is live (Day 31 ship per `SCHEDULED_INSIGHTS_SPEC`). It's been running for 12 days against the 3 demo seed projects. Each project + 5 detectors + 4 ticks/hour × 24 hr × 12 days = ~17K detector runs, with promotion rate ~3% = ~500 drafts in the dev environment.

We sample 150 drafts from this pool, biased to:
- Even distribution across the 6 `action_type`s (rfi, daily_log, pay_app, punch_item, schedule, submittal_transmittal — 25 each)
- Even distribution across the 5 detector kinds (cascade, aging, variance, staffing, weather)
- All 5 confidence buckets (0.7–0.75, 0.75–0.8, 0.8–0.85, 0.85–0.9, 0.9+)

Sampling script: `scripts/sample-voice-corpus.ts`. Output: `docs/audits/voice-corpus/sample-150.jsonl` (gitignored except for the schema file).

### Why dev environment is acceptable

The voice work is about HOW Iris writes, not WHAT Iris writes. The seed projects produce drafts that look a lot like real ones — same `templates.ts`, same prompts. The risk is that dev-seed produces edge cases the real projects won't (and vice versa), but we mitigate that with the Day 48 PM-network review against drafts they recognize.

---

## Phase 2 — The style.ts schema

```ts
// src/lib/iris/style.ts

/**
 * Iris voice style guide — single source of truth for how Iris writes.
 * Consumed by:
 *   - src/lib/iris/voicePrompt.ts (renders system prompt block)
 *   - src/lib/iris/voiceLinter.ts (post-process check)
 *
 * Edit this file = edit both surfaces atomically.
 *
 * Authoring rule: every rule below was derived from at least 3 hand-edits
 * across the 150-draft corpus. Don't add rules from anecdote.
 */

export interface VoiceRule {
  id: string                    // stable, like 'no-certainly'
  category: 'banned_phrase' | 'required_structure' | 'register' | 'length' | 'vernacular'
  description: string           // human-readable
  promptBlock?: string          // text injected into system prompt (optional)
  lintCheck?: (text: string, context: VoiceLintContext) => VoiceLintResult
  examples: { good: string; bad: string }[]   // at least 1 of each
  derivedFrom: number[]         // indices into the 150-draft corpus this rule was learned from
}

export interface VoiceLintContext {
  actionType: 'rfi.draft' | 'daily_log.draft' | 'pay_app.draft' | 'punch_item.draft' | 'schedule.resequence' | 'submittal.transmittal_draft'
  citations: DraftedActionCitation[]
}

export interface VoiceLintResult {
  passed: boolean
  message?: string
  suggestedReplacement?: string
}

export const VOICE_RULES: VoiceRule[] = [
  // --- Banned phrases (filled in during Day 43–47 hand-edit cycle) ---
  {
    id: 'no-certainly',
    category: 'banned_phrase',
    description: 'Never use the word "certainly". Construction PMs do not say it.',
    promptBlock: 'Do NOT use the word "certainly". Be direct.',
    lintCheck: (text) => {
      const m = text.match(/\bcertainly\b/i)
      return m ? { passed: false, message: '"certainly" is banned', suggestedReplacement: text.replace(/\bcertainly\b/gi, '') } : { passed: true }
    },
    examples: [
      { good: 'The architect needs to weigh in by Friday.', bad: 'Certainly, the architect needs to weigh in by Friday.' },
    ],
    derivedFrom: [],  // populated as corpus is edited
  },
  {
    id: 'no-em-dash',
    category: 'banned_phrase',
    description: 'No em-dashes. Use a period or a comma. Construction writing uses neither em-dashes nor en-dashes.',
    promptBlock: 'Do NOT use em-dashes (—) or en-dashes (–) in your output. Use commas or split into two sentences.',
    lintCheck: (text) => {
      return /[—–]/.test(text)
        ? { passed: false, message: 'em-dash or en-dash present', suggestedReplacement: text.replace(/—/g, ',').replace(/–/g, '-') }
        : { passed: true }
    },
    examples: [
      { good: 'The slab pour slipped to Friday. We need a new submittal date.', bad: 'The slab pour slipped to Friday — we need a new submittal date.' },
    ],
    derivedFrom: [],
  },
  {
    id: 'no-i-hope-this-helps',
    category: 'banned_phrase',
    description: 'Never close with "I hope this helps" or any LLM-trained politeness coda.',
    promptBlock: 'Do NOT include sign-offs like "I hope this helps", "Let me know if you have questions", or "Happy to help further". The reader is busy.',
    lintCheck: (text) => {
      const banned = /\b(I hope this helps|let me know if (you have|there are) (any |further )?(questions|concerns)|happy to (help|assist)|please (don't )?hesitate)\b/i
      return banned.test(text) ? { passed: false, message: 'LLM politeness coda present' } : { passed: true }
    },
    examples: [
      { good: 'Need a response by EOD Wednesday to keep the slab on schedule.', bad: 'Need a response by EOD Wednesday. I hope this helps!' },
    ],
    derivedFrom: [],
  },

  // --- Length caps (Phase 4 will set per actionType) ---
  {
    id: 'rfi-followup-length',
    category: 'length',
    description: 'RFI follow-ups: ≤ 60 words. The architect is reading on a phone between meetings.',
    promptBlock: 'For RFI follow-ups, keep total length under 60 words.',
    lintCheck: (text, ctx) => {
      if (ctx.actionType !== 'rfi.draft') return { passed: true }
      const words = text.trim().split(/\s+/).length
      return words > 60
        ? { passed: false, message: `RFI follow-up is ${words} words; cap is 60` }
        : { passed: true }
    },
    examples: [],
    derivedFrom: [],
  },

  // --- Vernacular (Phase 4 — derived from corpus) ---
  // Seeded with known terms; expanded during hand-edit cycle.
  {
    id: 'use-rfi-not-request',
    category: 'vernacular',
    description: 'Refer to RFIs as "RFI" not "request" or "question for the architect"',
    promptBlock: 'Use construction vocabulary: "RFI" (not "request"), "submittal" (not "submission"), "punch" (not "punch list"), "pay app" (not "payment application").',
    lintCheck: undefined, // soft rule; prompt-only
    examples: [],
    derivedFrom: [],
  },

  // --- Required structure ---
  {
    id: 'rfi-state-question-and-deadline',
    category: 'required_structure',
    description: 'Every RFI follow-up: one sentence states the question concisely; one sentence states the impact / deadline.',
    promptBlock: 'For RFI follow-ups, structure as: 1 sentence summarizing what was asked, 1 sentence stating why it matters now (deadline, dependency, cost). Two sentences total in 80% of cases.',
    lintCheck: undefined, // hard to lint; rely on prompt + post-edit review
    examples: [
      { good: 'Need wall finish at column line 7 confirmed before MEP rough-in. Slab pour is Friday and trades are scheduled to start Monday.', bad: 'Hi! I am following up on the RFI from last week. Could you let us know about the wall finish? It would be great to hear back when you have a moment.' },
    ],
    derivedFrom: [],
  },

  // ... 12+ more rules added during the hand-edit cycle
]

// Convenience accessors
export const getRulesByCategory = (cat: VoiceRule['category']) => VOICE_RULES.filter(r => r.category === cat)
export const getLintableRules = () => VOICE_RULES.filter(r => r.lintCheck !== undefined)
```

### Why ID-keyed rules

Each rule has a stable `id` so the linter can attach `failed_rule_ids: string[]` to the audit trail. This lets us answer "which rule fires most" — and retire rules that catch nothing (overfitting).

---

## Phase 3 — The hand-edit cycle (Days 43–47)

### Day 43 — first 50 drafts

- Sample 50 drafts via `scripts/sample-voice-corpus.ts`
- Walker reads each draft, edits in place to "what it should sound like"
- Each edit is committed as a JSON entry in `voice-corpus/edits.jsonl`:

```json
{
  "draftId": "abc-123",
  "actionType": "rfi.draft",
  "before": "Hi! I'm following up on RFI #42 to ask about the wall finish at column line 7. Could you certainly let us know when you get a chance? Thanks!",
  "after": "Need wall finish at column line 7 confirmed before MEP rough-in. Slab pour is Friday.",
  "rationale": "removed greeting, removed 'certainly', removed sign-off, restructured to question-then-impact, killed the contraction in formal context",
  "rulesApplied": ["no-certainly", "rfi-state-question-and-deadline", "no-i-hope-this-helps"],
  "newRulesObserved": []  // any pattern not yet captured in style.ts
}
```

### Day 45 — assemble style.ts

- Read every `rationale` from the 50 edits
- Cluster into rule families
- Write the rules into `src/lib/iris/style.ts` with `derivedFrom: [<draftIds>]`
- Re-render the system prompt block
- Deploy to dev

### Day 46 — second 50 drafts

- Sample fresh 50 (post-style.ts deployment)
- Repeat the hand-edit cycle
- **Acceptance signal:** the average word-count of the diff per draft should be ≤ 50% of Day 43's average. If not, style.ts isn't being heeded — investigate.

### Day 47 — third 50 drafts

- Sample fresh 50 again
- Hand-edit
- **Acceptance signal:** diff word-count ≤ 25% of Day 43's average. If not, the voice is genuinely hard to nail; budget extra polish in Lap 3.

### Day 48 — PM-network review

- Walker shares the **after** text from 30 random drafts (10 each from Days 43, 46, 47) with one PM in his network (NOT the soft-pilot PM — keep them surprise-fresh for Day 50).
- Reviewer answers 3 questions per draft:
  1. Could a 28-year-old PE have written this? (Y/N)
  2. Is anything obviously LLM-flavored? (Y/N + what)
  3. Would you send this if it were drafted for you? (Y/N)
- Acceptance: Y on Q3 for ≥ 80% (24 of 30) → voice locked.

### Day 49 — sign-off, ship

- Voice ships behind `VITE_FLAG_IRIS_VOICE_V1=true` (stays on)
- Day 43's 50 "before" drafts archived as the "ChatGPT baseline" comparison set
- FRIDAY retro

---

## Phase 4 — Linter implementation

### File: `src/lib/iris/voiceLinter.ts`

```ts
import { VOICE_RULES, getLintableRules, type VoiceLintContext, type VoiceLintResult } from './style'

export interface LinterResult {
  passed: boolean
  failedRules: Array<{ ruleId: string; message: string; suggestedReplacement?: string }>
  text: string  // original or auto-fixed
}

export function lintVoice(text: string, context: VoiceLintContext, autofix: boolean = true): LinterResult {
  const failed: LinterResult['failedRules'] = []
  let workingText = text

  for (const rule of getLintableRules()) {
    const result = rule.lintCheck!(workingText, context)
    if (!result.passed) {
      failed.push({ ruleId: rule.id, message: result.message ?? '', suggestedReplacement: result.suggestedReplacement })
      if (autofix && result.suggestedReplacement !== undefined) {
        workingText = result.suggestedReplacement
      }
    }
  }

  return {
    passed: failed.length === 0,
    failedRules: failed,
    text: workingText,
  }
}
```

### Integration with `iris-call`

`supabase/functions/iris-call/` post-processes every successful response through the linter. The diff (raw LLM output → linted output) is logged to a new `iris_voice_diffs` table for training-corpus collection (a sentence-by-sentence pair archive that becomes valuable when fine-tuning lands in Q2 2027 per the North Star).

```sql
-- Migration: 20260504040000_iris_voice_diffs.sql
CREATE TABLE iris_voice_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drafted_action_id UUID REFERENCES drafted_actions(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  linted_text TEXT NOT NULL,
  failed_rule_ids TEXT[] NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_iris_voice_diffs_rules
  ON iris_voice_diffs USING GIN(failed_rule_ids);
```

### Telemetry

The diff between raw and linted output, per rule, is the leading indicator for "is the prompt actually working." If 70% of drafts trip `no-em-dash` after Day 49, the prompt isn't sticking and we need a stronger system message. Walker's daily 5:30 PM standup feed includes this query:

```sql
SELECT
  unnest(failed_rule_ids) AS rule_id,
  COUNT(*) AS hits_today
FROM iris_voice_diffs
WHERE recorded_at::DATE = CURRENT_DATE
GROUP BY 1
ORDER BY hits_today DESC;
```

---

## Phase 5 — Acceptance criteria for "voice is locked"

Hard gates (all must pass before flagging Day 49 done):

1. `style.ts` exists with ≥ 12 rules, each with `derivedFrom` populated
2. PM-network reviewer Q3 ≥ 80% Y (24 of 30)
3. Linter pass rate ≥ 90% on a fresh 50-draft sample (i.e., 90% of drafts come out of the LLM already passing all rules; only 10% need autofix)
4. Days-43-vs-Day-47 diff word-count ratio ≤ 25%
5. `iris_voice_diffs` table exists and has > 100 rows logged from dev environment
6. ADR-005 committed

Soft signals to monitor:

- Average length of RFI follow-ups: 35–55 words (target 45)
- Average length of daily log narratives: 100–180 words (target 140)
- "Construction vernacular" rule hit rate < 10% (i.e., the prompt is teaching the model the vocabulary)

---

## Phase 6 — What ships and what defers

### Ships in Lap 2

- `style.ts` with rules derived from 150 hand-edits
- Linter integrated into `iris-call`
- Diff logging table + dashboard query
- Prompt block injection
- ADR-005

### Deferred to Lap 3 / later

- **Multi-voice support.** Different PMs may want different registers. For Lap 2, one voice. Lap 3 may add a `voice_preset_id` to drafted_actions and let the user pick.
- **Auto-rule-discovery.** A future tool that reads new edit corpora and proposes rule additions. Today, Walker writes rules manually from rationales.
- **Voice fine-tuning.** Per the North Star, Q2 2027.
- **Voice signals from rejection patterns.** "User always rejects drafts containing X — propose a rule." Lap 3.

---

## Test plan

### Unit (Vitest)

- Each lintable rule's `lintCheck`: 5 cases (4 pass, 1 fail) per rule
- `lintVoice` aggregates failures across rules
- `lintVoice` autofix produces text that passes a second-pass `lintVoice` call
- Style guide is exhaustive over `actionType` (each has at least one length-cap rule)

### Integration

- `iris-call` post-processes correctly: raw → linted → drafted_actions row's text is linted, raw is logged in `iris_voice_diffs`
- Linter on staging: 100 dev-seed drafts → measure rule hit-rate; assert hit-rate < target

### E2E (manual)

- Walker reads 30 freshly-generated linted drafts on Day 47. Subjective vibes check. Honest Y/N: "is this how I want Iris to sound."

---

## File-by-file changelog

| Path | Change |
|---|---|
| `src/lib/iris/style.ts` | NEW — rule registry |
| `src/lib/iris/voicePrompt.ts` | NEW — prompt block renderer |
| `src/lib/iris/voiceLinter.ts` | NEW — `lintVoice` |
| `supabase/migrations/20260504040000_iris_voice_diffs.sql` | NEW |
| `supabase/functions/iris-call/index.ts` | EDIT — post-process via linter; log diff |
| `scripts/sample-voice-corpus.ts` | NEW — sampling script |
| `docs/audits/voice-corpus/edits.jsonl` | NEW (in-progress, per Day 43+) |
| `docs/audits/voice-corpus/README.md` | NEW — corpus structure + sampling notes |
| `e2e/iris-voice.spec.ts` | NEW — linter integration test |

---

## Day-by-day mapping to the tracker

| Tracker day | What ships |
|---|---|
| Day 43 | Sampling script live; first 50 hand-edited; rationales captured |
| Day 44 | SUNDAY |
| Day 45 | `style.ts` v1 with 12+ rules; linter wired into iris-call; deployed to dev |
| Day 46 | Fresh 50 sampled (post-deployment); hand-edited; diff word-count measured (target: ≤50% of Day 43) |
| Day 47 | Final 50 hand-edited (target: ≤25% of Day 43); voice considered locked pending PM review |
| Day 48 | PM-network reviewer evaluates 30 drafts; passes ≥ 24/30 |
| Day 49 | FRIDAY: voice ships; flag enabled; baseline-comparison archive committed |

---

## What this spec deliberately does NOT cover

- Citation snippet text formatting (already handled by the citation spec — citations are structural, not voice)
- Email signatures or "from" lines (drafts are content, not envelopes; UI wraps)
- Translation / multi-language support (English-only Lap 2)
- Brand voice for marketing copy (different surface, different writers, not Iris's job)
