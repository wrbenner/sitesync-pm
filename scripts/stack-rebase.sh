#!/usr/bin/env bash
# stack-rebase.sh — rebase a stacked PR onto fresh main + recreate it.
#
# WHY: when a base PR merges, GitHub deletes its branch (--delete-branch).
# Any PR that targeted that base auto-closes and CANNOT be reopened (per
# memory `feedback_gh_pr_workflow_quirks`). The dependent has to be
# rebased onto main and submitted as a fresh PR. This script does that
# in one command.
#
# USAGE:
#   bash scripts/stack-rebase.sh                 # rebases current branch
#   bash scripts/stack-rebase.sh feature-branch  # rebases specific branch
#   bash scripts/stack-rebase.sh --dry-run       # show plan only
#
# WHAT IT DOES:
#   1. Fetches origin/main
#   2. Saves current branch state (no-op if working tree dirty — bails)
#   3. Rebases current branch onto origin/main
#   4. Force-pushes with --force-with-lease (safe; aborts if remote moved)
#   5. Looks up any prior PR for this branch via gh CLI
#   6. If a closed PR exists with the old base, prints a recreate command
#      (does NOT auto-recreate — Walker may want to edit the title/body)
#
# Reference: docs/audits/MERGE_LOOP_RECEIPT_2026-05-10.md

set -euo pipefail

DRY_RUN=0
BRANCH=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    -*) echo "[stack-rebase] unknown arg: $arg" >&2; exit 2 ;;
    *) BRANCH="$arg" ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Default to current branch if not specified.
if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

if [[ "$BRANCH" == "main" || "$BRANCH" == "master" || "$BRANCH" == "develop" ]]; then
  echo "[stack-rebase] refusing to rebase $BRANCH" >&2
  exit 1
fi

# Working tree must be clean enough to rebase.
if ! git diff-index --quiet HEAD --; then
  echo "[stack-rebase] working tree has uncommitted changes — commit or stash first" >&2
  exit 1
fi

echo "[stack-rebase] target branch: $BRANCH"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[stack-rebase] --dry-run: would now run:"
  echo "  git fetch origin main"
  echo "  git checkout $BRANCH"
  echo "  git rebase origin/main"
  echo "  git push --force-with-lease origin $BRANCH"
  echo "  gh pr list --head $BRANCH --state closed   # check for prior PR"
  exit 0
fi

git fetch origin main
git checkout "$BRANCH"

if ! git rebase origin/main; then
  echo ""
  echo "[stack-rebase] REBASE CONFLICT — resolve, then run:"
  echo "  git rebase --continue"
  echo "  git push --force-with-lease origin $BRANCH"
  exit 1
fi

git push --force-with-lease origin "$BRANCH"

# Check for a prior closed PR (auto-closed by base deletion).
PRIOR=$(gh pr list --head "$BRANCH" --state closed --limit 1 --json number,baseRefName,closedAt 2>/dev/null || echo "[]")
PRIOR_NUM=$(echo "$PRIOR" | grep -o '"number":[0-9]*' | head -1 | sed 's/"number"://' || echo "")
PRIOR_BASE=$(echo "$PRIOR" | grep -o '"baseRefName":"[^"]*"' | head -1 | sed 's/"baseRefName":"\(.*\)"/\1/' || echo "")

if [[ -n "$PRIOR_NUM" && "$PRIOR_BASE" != "main" ]]; then
  echo ""
  echo "[stack-rebase] prior PR #$PRIOR_NUM was closed (base: $PRIOR_BASE)."
  echo "[stack-rebase] To create a fresh PR against main:"
  echo ""
  echo "  gh pr create --base main \\"
  echo "    --title \"<title from #$PRIOR_NUM>\" \\"
  echo "    --body \"<body — copy from #$PRIOR_NUM via 'gh pr view $PRIOR_NUM --json body'>\""
  echo ""
  echo "Or use scripts/ship.sh which handles this end-to-end."
fi

echo "[stack-rebase] DONE — $BRANCH is now on top of origin/main + force-pushed."
