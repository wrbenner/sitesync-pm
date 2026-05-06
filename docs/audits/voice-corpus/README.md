# Voice Corpus

The 150-draft hand-edit corpus that informs `src/lib/iris/style.ts`.

**This directory is gitignored except for this README.** Sample files (`sample-*.jsonl`) and edit files (`edits-*.jsonl`) contain real-ish draft text from the dev environment. Even though dev data is synthetic-ish, we don't track it in git — only the *rules* derived from it land in `style.ts`, where they're traceable via each rule's `derivedFrom` field.

## Structure

```
docs/audits/voice-corpus/
├── README.md                   # This file (committed)
├── sample-2026-06-17.jsonl     # 50 raw draft samples — gitignored
├── sample-2026-06-19.jsonl     # 50 more — gitignored
├── sample-2026-06-21.jsonl     # 50 more — gitignored
├── edits-2026-06-17.jsonl      # Hand-edited pairs (Day 43) — gitignored
├── edits-2026-06-19.jsonl      # Day 46 — gitignored
└── edits-2026-06-21.jsonl      # Day 47 — gitignored
```

## How to use

1. **Sample** (Day 43, 46, 47):

   ```sh
   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
     npx tsx scripts/sample-voice-corpus.ts \
     --count=50 \
     --out=docs/audits/voice-corpus/sample-$(date +%Y-%m-%d).jsonl
   ```

   Output is JSONL — one drafted_action row per line. Stratified across 6 action types × 5 confidence buckets to ensure variety.

2. **Hand-edit**: open the JSONL in a side-by-side editor. For each entry, write a paired record to `edits-<date>.jsonl`:

   ```json
   {
     "draftId": "abc-123",
     "actionType": "rfi.draft",
     "before": "<the original text>",
     "after": "<what it should sound like>",
     "rationale": "removed greeting; killed 'certainly'; restructured to question-then-impact",
     "rulesApplied": ["no-certainly", "rfi-state-question-and-deadline"],
     "newRulesObserved": []
   }
   ```

3. **Cluster + commit rules**: every 50 edits, read every `rationale` field. Cluster into rule families. Add new rules to `src/lib/iris/style.ts` with `derivedFrom: [<index list>]` so the rule's pedigree is auditable. Each rule's `derivedFrom` is the truth-of-origin — never write a rule from anecdote.

## Acceptance signals

The hand-edit cycle has built-in measurements (per spec § Phase 3):

| Day | Acceptance signal |
|---|---|
| 43 | First 50 hand-edited; rationales captured. Baseline diff word-count established. |
| 45 | `style.ts` v1 with ≥ 12 rules; linter wired into iris-call; deployed to dev. |
| 46 | Fresh 50 sampled (post-deploy); diff word-count per draft ≤ 50% of Day 43's average. |
| 47 | Final 50 hand-edited; diff word-count ≤ 25% of Day 43's average. |
| 48 | PM-network reviewer Q3 ("would you send this?") ≥ 24/30 Y. |
| 49 | Voice ships behind `VITE_FLAG_IRIS_VOICE_V1=true`. |

## Privacy note

Even if the dev environment data is synthetic-ish, the same script can be pointed at staging or production by changing the env vars. **Never run this script against production without explicit Walker approval.** The script uses the service-role key, which bypasses RLS — a misuse would expose pilot data to the local filesystem.

## Why corpus stays out of git

Three reasons:
1. **Privacy** — the script can produce real-shaped text; commit nothing that could embarrass a future pilot if exposed.
2. **Size** — 150 entries × ~1KB each = 150KB; not crushing, but grows fast in subsequent rounds.
3. **Reproducibility** — the rules are the durable artifact, not the corpus. Fresh sampling at Day 46/47 produces different drafts deliberately; pinning a specific corpus would be the wrong target.

## Manual workflow when the script can't run

If `scripts/sample-voice-corpus.ts` fails (no service-role key, dev environment empty, etc.) Walker can:

1. Open the dev `/iris/inbox`, click 50 different drafts, copy each to a text file
2. Hand-edit each into a target version
3. Walk the rationales the same way — outcome is the same `style.ts` rule additions

The script saves time, but the human-in-the-loop is the load-bearing piece.
