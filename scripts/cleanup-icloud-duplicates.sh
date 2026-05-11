#!/usr/bin/env bash
# cleanup-icloud-duplicates.sh — delete iCloud-sync numbered-duplicate files.
#
# iCloud Drive's conflict-resolution suffix is `<basename> N.<ext>` (note
# the literal space before the digit). When the SiteSync repo lives under
# `~/Desktop/`, iCloud silently produces these duplicates after every
# concurrent edit / device sync, polluting:
#   • scripts/ (97+ duplicate .ts / .mjs / .py / .sh files — typecheck +
#     ESLint scan all of them)
#   • .github/workflows/ (18+ duplicate .yml files — CI runs them all)
#   • root-level docs / configs (140+ files)
#
# This script deletes every `<name> [2-9].<ext>` file in the repo,
# scoped to extensions that show up in our build/CI pipelines. Untracked
# duplicates are deleted with `rm`; tracked ones with `git rm` so the
# deletion lands in the staging area cleanly.
#
# USAGE:
#   bash scripts/cleanup-icloud-duplicates.sh             # deletes
#   bash scripts/cleanup-icloud-duplicates.sh --dry-run   # lists only
#
# After running, commit the result. The .gitignore + tsconfig/vitest/
# eslint exclude patterns prevent silent regrowth.

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

# Anchor at the repo root regardless of where the user invoked the script.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Extensions covered. Anything not in this list is left alone — we don't
# want to touch image / pdf / xlsx duplicates that may carry unique data.
EXTS=(
  ts tsx js jsx mjs cjs json yml yaml sh py md sql
  toml html css scss skill svg
)

# Build the find expression dynamically so we get one pass.
FIND_ARGS=( -type f \( )
first=1
for ext in "${EXTS[@]}"; do
  if [[ $first -eq 0 ]]; then FIND_ARGS+=( -o ); fi
  FIND_ARGS+=( -name "* [2-9].${ext}" )
  first=0
done
FIND_ARGS+=(
  \)
  -not -path "*/node_modules/*"
  -not -path "*/.git/*"
  -not -path "*/dist/*"
  -not -path "*/.worktrees/*"
)

FILELIST="$(mktemp)"
trap 'rm -f "$FILELIST" "$TRACKED_LIST" "$UNTRACKED_LIST"' EXIT
TRACKED_LIST="$(mktemp)"
UNTRACKED_LIST="$(mktemp)"

find . "${FIND_ARGS[@]}" 2>/dev/null | sort > "$FILELIST"

COUNT=$(wc -l < "$FILELIST" | tr -d '[:space:]')

if [[ "$COUNT" -eq 0 ]]; then
  echo "[cleanup-icloud-duplicates] no duplicates found"
  exit 0
fi

echo "[cleanup-icloud-duplicates] found $COUNT duplicates"
if [[ $DRY_RUN -eq 1 ]]; then
  awk '{ print "  " $0 }' "$FILELIST" | head -50
  if [[ "$COUNT" -gt 50 ]]; then
    echo "  ... and $((COUNT - 50)) more"
  fi
  echo "[cleanup-icloud-duplicates] --dry-run: no files deleted"
  exit 0
fi

# Split tracked vs untracked so we use the right deletion verb.
while IFS= read -r f; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    printf '%s\n' "$f" >> "$TRACKED_LIST"
  else
    printf '%s\n' "$f" >> "$UNTRACKED_LIST"
  fi
done < "$FILELIST"

TRACKED_COUNT=$(wc -l < "$TRACKED_LIST" | tr -d '[:space:]')
UNTRACKED_COUNT=$(wc -l < "$UNTRACKED_LIST" | tr -d '[:space:]')
echo "[cleanup-icloud-duplicates] tracked: $TRACKED_COUNT, untracked: $UNTRACKED_COUNT"

# Deletions in batches — `git rm` and `rm` both happily accept long arg
# lists, but xargs handles macOS's ARG_MAX safely. Use NUL-delimited
# read so paths with spaces (which is the whole point — these literally
# have spaces in their names) round-trip safely.
if [[ "$TRACKED_COUNT" -gt 0 ]]; then
  tr '\n' '\0' < "$TRACKED_LIST" | xargs -0 git rm --quiet
fi
if [[ "$UNTRACKED_COUNT" -gt 0 ]]; then
  tr '\n' '\0' < "$UNTRACKED_LIST" | xargs -0 rm
fi

echo "[cleanup-icloud-duplicates] done — re-run with --dry-run to confirm zero remaining"
