#!/usr/bin/env bash
# ship.sh — one command from feature branch to merged.
#
# WORKFLOW:
#   You finished a feature on a branch. You ran the pre-commit hook and
#   committed. Now you want to merge. Today that's:
#
#     git push -u origin <branch>
#     gh pr create --base main --title "..." --body "..."
#     gh pr merge <N> --auto --squash --delete-branch
#     # check back in 5 minutes to see if it merged
#
# `ship.sh` collapses this into one command:
#
#   bash scripts/ship.sh "ci: my fix" "Body of the PR description here"
#
# It:
#   1. Pushes the branch to origin (creates if needed)
#   2. Creates a PR against main with the given title + body (or reads
#      from stdin if body is "-", or omits if body is "")
#   3. Sets auto-merge with squash + delete-branch
#   4. Returns immediately (auto-merge fires when required checks pass)
#
# USAGE:
#   bash scripts/ship.sh "<title>"                    # body from last commit message
#   bash scripts/ship.sh "<title>" "<body>"
#   bash scripts/ship.sh "<title>" -                  # body from stdin
#   bash scripts/ship.sh                              # title + body from last commit
#
# Reference: docs/audits/MERGE_LOOP_RECEIPT_2026-05-10.md

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" || "$BRANCH" == "develop" ]]; then
  echo "[ship] refusing to ship from $BRANCH — checkout a feature branch first" >&2
  exit 1
fi

# Title/body resolution.
TITLE="${1:-}"
BODY="${2:-}"

if [[ -z "$TITLE" ]]; then
  TITLE="$(git log -1 --format=%s)"
fi

if [[ "$BODY" == "-" ]]; then
  BODY="$(cat)"
elif [[ -z "$BODY" ]]; then
  # Multi-line body from the last commit, sans the title line.
  BODY="$(git log -1 --format=%b)"
  if [[ -z "$BODY" ]]; then
    BODY="(no body)"
  fi
fi

# 1. Push.
echo "[ship] pushing $BRANCH → origin..."
git push -u origin "$BRANCH" 2>&1 | tail -2

# 2. PR exists? If yes, just enable auto-merge. If no, create.
EXISTING=$(gh pr list --head "$BRANCH" --state open --limit 1 --json number 2>/dev/null | grep -o '"number":[0-9]*' | head -1 | sed 's/"number"://' || echo "")
if [[ -n "$EXISTING" ]]; then
  PR_NUMBER="$EXISTING"
  echo "[ship] reusing existing PR #$PR_NUMBER"
else
  echo "[ship] creating PR..."
  PR_URL=$(gh pr create --base main --title "$TITLE" --body "$BODY" 2>&1 | tail -1)
  PR_NUMBER="${PR_URL##*/}"
  echo "[ship] created PR #$PR_NUMBER: $PR_URL"
fi

# 3. Enable auto-merge. May fail if branch protection isn't satisfied yet
# (auto-merge gets enabled but waits for CI).
echo "[ship] enabling auto-merge..."
if gh pr merge "$PR_NUMBER" --auto --squash --delete-branch 2>&1 | tail -3; then
  echo "[ship] auto-merge enabled. PR #$PR_NUMBER will merge when required checks pass."
else
  echo "[ship] auto-merge couldn't be enabled — check 'gh pr checks $PR_NUMBER' for issues"
  exit 1
fi

echo ""
echo "[ship] DONE. Watch progress at:"
echo "  gh pr view $PR_NUMBER --web"
