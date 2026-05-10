# Working tree honesty (PR β) — receipt
**Date:** 2026-05-10
**Branch:** `working-tree-honesty`
**Status:** Ready for review.

## Goal

`git status` is always trustworthy. Phantom changes don't happen. iCloud regeneration stops at the source.

## Three one-shot tools

### `scripts/relocate-out-of-icloud.sh`

Moves the repo out of iCloud Drive (`~/Desktop/sitesync-pm/` → `~/code/sitesync-pm/` by default). The cleanup script (`scripts/cleanup-icloud-duplicates.sh` from PR #401) is a band-aid that runs after the damage is done; **this is the actual fix** — eliminates duplicate regeneration at the source.

Safety:
- Verifies repo is currently inside iCloud-synced path
- Verifies destination doesn't exist + working tree has no in-flight rebase/merge
- Surfaces processes holding files open (lsof) so Walker can quit them first
- Prints next-step instructions (npm install, Claude Code path update, alias edits) — does NOT auto-edit shell rc files
- Idempotent: re-running after a successful move bails because source is no longer in iCloud
- `--dry-run` mode

### `scripts/sweep-stale-auto-branches.sh`

Deletes stale autonomous-worker branches:
- Prefixes covered: `auto/`, `quality-swarm/`, `organism/`, `swarm/`, `integration-weaver/`, `feature-hardening/`
- Default age threshold: 7 days (override with `--age-days=N`)
- **Excludes any branch with an open PR** (those are still live)
- Sanity guard: never touches `main`, `develop`, `master` regardless of prefix match
- Both remote ref + local tracking branch deleted

Local dry-run found **96 stale branches** older than 7 days with no open PR — most are `auto/metrics-*` from earlier autonomous-worker waves.

### Husky activation note in `CLAUDE.md`

Documents: `npm install` activates the husky hook via `prepare` script. If you skip it after a fresh clone, pre-commit is silently absent. Added to the "Sandbox hygiene & merge protocol" section.

## What this push does NOT do (deliberately)

- Does NOT relocate the repo automatically — Walker runs `bash scripts/relocate-out-of-icloud.sh` himself, when he's ready, in a fresh shell.
- Does NOT run the stale-branch sweep automatically — Walker runs it himself; first run with `--dry-run` to confirm.
- Does NOT auto-edit `~/.zshrc` aliases — too risky to touch a user's shell config from a script.
- Does NOT quarantine autonomous workers further — they're already `workflow_dispatch`-only per their YAML; adding a worktree-based sandbox is a separate, larger refactor (PR γ scope or later).

## Files

| Path | Status |
|---|---|
| `scripts/relocate-out-of-icloud.sh` | New |
| `scripts/sweep-stale-auto-branches.sh` | New |
| `CLAUDE.md` | First-run setup section + maintenance-scripts list |
| `docs/audits/WORKING_TREE_HONESTY_RECEIPT_2026-05-10.md` | This file |
| `docs/audits/INDEX.md` | Add receipt row |

## Verification

| Check | Method | Expected |
|---|---|---|
| Relocation script dry-run | `bash scripts/relocate-out-of-icloud.sh --dry-run` | Lists source, destination, processes-holding-files; doesn't move anything |
| Sweep script dry-run | `bash scripts/sweep-stale-auto-branches.sh --dry-run` | Lists candidate branches (96 currently); doesn't delete |
| Both scripts idempotent | Re-run after first execution | Reports zero work needed |
| `npm install` activates husky | After clone, `git commit` runs the pre-commit hook | Hook fires + lints staged files |

## What's still queued (PR γ + δ of the perfect-velocity push)

- **PR γ**: Strip synthetic check writes from `organism-cycle.yml`, ship `scripts/stack-rebase.sh` + `scripts/ship.sh`
- **PR δ**: `npm run doctor` self-diagnostic
