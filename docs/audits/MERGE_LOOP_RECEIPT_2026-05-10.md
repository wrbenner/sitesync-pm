# Merge loop ergonomics (PR γ) — receipt
**Date:** 2026-05-10
**Branch:** `merge-loop-ergonomics`
**Status:** Ready for review.

## Goal

Commit-to-merged is one command. Main reflects reality (no synthetic check-runs lying about what passed).

## Three changes

### 1. Strip synthetic check-run writes from `organism-cycle.yml`

The organism workflow used to POST hardcoded `conclusion=success` check-runs to the PR's head SHA after creating an organism PR — for `Gate 1: TypeScript`, `Gate 2: ESLint`, `Gate 3: Tests`, `Gate 4: Build`, `Eval Layer 1: Database/RLS`, `Eval Layer 2: API`. This was a lie: the organism's local "build phase" is not the same code path as the real CI gates and often gave a falsely-green view of what passed.

**Removed** (~lines 839–867 in the workflow file). Replaced with two `print()` lines that document what the organism verified locally + note that real CI now has to verify it again. Result: `main` now reflects what actually passed CI, not what the organism claimed.

### 2. `scripts/stack-rebase.sh`

When a base PR merges with `--delete-branch` (canonical pattern), GitHub auto-closes any PR that targeted the deleted branch and **those PRs cannot be reopened** (per memory `feedback_gh_pr_workflow_quirks`). The dependent has to be rebased onto main and submitted as a fresh PR.

This script does that one-shot:
- Fetches `origin/main`
- Rebases the current (or specified) branch onto `origin/main`
- Force-pushes with `--force-with-lease` (safe; aborts if remote moved)
- Detects prior closed PR and prints the recreate command (does NOT auto-recreate; Walker may want to edit title/body)
- Sanity guards: refuses to rebase `main`/`master`/`develop`, bails on dirty working tree

### 3. `scripts/ship.sh`

End-to-end push + PR + auto-merge in one command. Replaces the typical 3-command dance:

```
git push -u origin <branch>
gh pr create --base main --title "..." --body "..."
gh pr merge <N> --auto --squash --delete-branch
```

with:

```
bash scripts/ship.sh "title" "body"
# or just: bash scripts/ship.sh   (uses last commit's message)
```

It:
- Pushes the branch
- Reuses an existing open PR if one exists, otherwise creates fresh
- Enables auto-merge with squash + delete-branch
- Returns immediately (auto-merge fires when required checks pass)

## Files

| Path | Status |
|---|---|
| `.github/workflows/organism-cycle.yml` | Removed synthetic check-run POST block (~30 lines) |
| `scripts/stack-rebase.sh` | New |
| `scripts/ship.sh` | New |
| `docs/audits/MERGE_LOOP_RECEIPT_2026-05-10.md` | This file |
| `docs/audits/INDEX.md` | Add receipt row |

## Verification

| Check | Method | Expected |
|---|---|---|
| Synthetic checks removed | `grep "check-runs.*POST" .github/workflows/organism-cycle.yml` | Zero matches in active code (only comments referencing the removal) |
| Organism PRs run real CI | After next organism dispatch + PR creation | PR shows real Gate 1-4 + Eval Layer 1-2 statuses, no organism-injected ones |
| `stack-rebase.sh` works | `bash scripts/stack-rebase.sh --dry-run` on a feature branch | Lists the rebase plan, doesn't execute |
| `ship.sh` works | `bash scripts/ship.sh "test"` from a feature branch | Pushes + creates PR + enables auto-merge |
| Both refuse main | `bash scripts/{stack-rebase,ship}.sh` from main | Bails immediately |

## What this PR does NOT do (deliberate)

- Does NOT replace `gh pr merge --auto --squash --delete-branch` for hand-typed merges — Walker still uses that directly when not shipping his own branch.
- Does NOT add a merge queue (GitHub's auto-merge covers the use case).
- Does NOT touch other autonomous-worker workflows (organism-verify.yml, swarm.yml, etc.) — those don't write synthetic checks. Only organism-cycle.yml did.

## Sequel

PR δ next: `npm run doctor` — single command that diagnoses every common dev-environment problem with auto-fix offers.
