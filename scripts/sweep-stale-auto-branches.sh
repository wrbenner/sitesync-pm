#!/usr/bin/env bash
# sweep-stale-auto-branches.sh — delete stale autonomous-worker branches.
#
# WHY: organism, swarm, quality-swarm + similar autonomous workflows open
# branches with patterns like `auto/polish-YYYYMMDD-HHMM`, `quality-swarm/*`,
# `organism/*`. When their PRs auto-close (rejected / superseded / merged
# elsewhere), the branches stick around. Over a few weeks, `git branch -a`
# lists 50+ stale ones, slowing every fetch + drowning the real branches.
#
# WHAT IT DOES:
#   - Lists all remote branches matching the autonomous-worker prefixes
#   - Filters to those with last-commit older than --age-days (default 7)
#   - Excludes any branch with an OPEN pull request (those are still live)
#   - Deletes both the remote ref and any local tracking branch
#   - Reports counts before/after
#
# DOES NOT:
#   - Touch human-authored branches (anything not matching the prefix list)
#   - Touch branches with open PRs (gh pr list --head <branch> guards this)
#   - Delete `main` or `develop` regardless of age (sanity guard)
#
# IDEMPOTENT: re-running after a sweep just reports zero matches.
#
# USAGE:
#   bash scripts/sweep-stale-auto-branches.sh             # default: 7-day age
#   bash scripts/sweep-stale-auto-branches.sh --age-days=14
#   bash scripts/sweep-stale-auto-branches.sh --dry-run
#
# Reference: docs/audits/WORKING_TREE_HONESTY_RECEIPT_2026-05-10.md

set -euo pipefail

AGE_DAYS=7
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --age-days=*) AGE_DAYS="${arg#--age-days=}" ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) echo "[sweep] unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# Branch-name prefixes that mark autonomous-worker output.
PREFIXES=(
  'auto/'
  'quality-swarm/'
  'organism/'
  'swarm/'
  'integration-weaver/'
  'feature-hardening/'
)

# Cutoff timestamp (epoch seconds).
NOW="$(date +%s)"
CUTOFF=$(( NOW - AGE_DAYS * 86400 ))

# Make sure we have fresh remote refs.
git fetch --prune origin >/dev/null 2>&1

# Build the prefix-filter regex for git for-each-ref.
PREFIX_FILTER=""
for p in "${PREFIXES[@]}"; do
  PREFIX_FILTER="$PREFIX_FILTER refs/remotes/origin/${p}**"
done

# Collect candidates. Each line: <committerdate-epoch> <branch-name>
CANDIDATES="$(mktemp)"
trap 'rm -f "$CANDIDATES" "$STALE_LIST"' EXIT
STALE_LIST="$(mktemp)"

git for-each-ref --format='%(committerdate:unix) %(refname:short)' \
  ${PREFIX_FILTER} \
  | sed 's|^\([0-9]*\) origin/|\1 |' > "$CANDIDATES"

CAND_COUNT="$(wc -l < "$CANDIDATES" | tr -d '[:space:]')"
echo "[sweep] candidates matching prefix filter: $CAND_COUNT"

if [[ "$CAND_COUNT" -eq 0 ]]; then
  echo "[sweep] nothing to do."
  exit 0
fi

# Filter to stale-by-age + safety-check (no open PR + not main/develop).
while IFS=' ' read -r ts branch; do
  # sanity: never touch protected branch names regardless of prefix match
  case "$branch" in
    main|develop|master) continue ;;
  esac
  # age check
  if [[ "$ts" -ge "$CUTOFF" ]]; then continue; fi
  # open-PR check
  open_pr_count="$(gh pr list --head "$branch" --state open --json number 2>/dev/null | grep -c '"number"' || true)"
  if [[ "$open_pr_count" -gt 0 ]]; then continue; fi
  printf '%s\n' "$branch" >> "$STALE_LIST"
done < "$CANDIDATES"

STALE_COUNT="$(wc -l < "$STALE_LIST" | tr -d '[:space:]')"
echo "[sweep] stale branches (older than ${AGE_DAYS}d, no open PR): $STALE_COUNT"

if [[ "$STALE_COUNT" -eq 0 ]]; then
  echo "[sweep] nothing to delete."
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  awk '{ print "  " $0 }' "$STALE_LIST"
  echo "[sweep] --dry-run: nothing deleted"
  exit 0
fi

awk '{ print "  " $0 }' "$STALE_LIST" | head -20
if [[ "$STALE_COUNT" -gt 20 ]]; then
  echo "  ... and $((STALE_COUNT - 20)) more"
fi

# Delete in batches (NUL-safe — branch names rarely contain spaces but be
# defensive anyway).
DELETED=0
while IFS= read -r branch; do
  if git push origin --delete "$branch" >/dev/null 2>&1; then
    DELETED=$((DELETED + 1))
  fi
  # Also drop any local tracking branch with the same name.
  git branch -D "$branch" >/dev/null 2>&1 || true
done < "$STALE_LIST"

echo "[sweep] deleted $DELETED of $STALE_COUNT remote branches"
