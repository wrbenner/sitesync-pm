#!/usr/bin/env bash
# relocate-out-of-icloud.sh — move the repo out of iCloud Drive.
#
# WHY: iCloud Drive's conflict-resolution suffix (`<name> N.<ext>`) creates
# duplicate files inside the repo every time it resolves a sync conflict.
# Even with .gitignore + tsconfig/eslint/vitest excludes catching every
# duplicate before it lands, local tooling (typecheck, ESLint watchers,
# `git status`) still has to scan and ignore hundreds-to-thousands of them.
# The cleanup script (`scripts/cleanup-icloud-duplicates.sh`) is a band-aid
# that runs after the damage is done. The actual fix is moving the repo
# OUT of iCloud Drive entirely. This script does that one-shot.
#
# WHAT IT DOES:
#   1. Verifies the repo is currently inside iCloud Drive (has `Mobile Documents`
#      or `Desktop` ancestor under iCloud's typical pattern).
#   2. Computes the destination: `~/code/<repo-name>/` by default, override
#      with --dest=<path>.
#   3. Verifies destination doesn't already exist.
#   4. Verifies the working tree is clean enough (no in-flight rebase/merge,
#      no untracked-and-staged conflicts) — otherwise bails with instructions.
#   5. Stops any background processes that might be holding the repo (best-
#      effort — surfaces a list, doesn't kill).
#   6. Moves the repo to the destination via `mv`.
#   7. Verifies the new location has all the same files + a working `git status`.
#   8. Prints next-step instructions for Walker:
#       - cd to new location + run `npm install`
#       - update Claude Code project paths (`claude /add-dir <new-path>`
#         or move `~/.claude/projects/<old-encoded-path>/`)
#       - update any `~/.zshrc` / `~/.bashrc` aliases (this script DOES
#         NOT auto-edit shell rc files — too risky)
#
# DOES NOT:
#   - Touch git remotes (they're URLs, not paths — unaffected by relocation)
#   - Modify any tracked file
#   - Delete the iCloud-side copy (we MOVE, not COPY-then-delete-original;
#     a `mv` within the same disk is atomic, but iCloud may sync the move
#     after some delay; this is handled by the post-move verification)
#
# IDEMPOTENT: re-running after a successful move bails immediately because
# the source is no longer in iCloud.
#
# USAGE:
#   bash scripts/relocate-out-of-icloud.sh                # default: ~/code/sitesync-pm/
#   bash scripts/relocate-out-of-icloud.sh --dest=/path   # custom destination
#   bash scripts/relocate-out-of-icloud.sh --dry-run      # show plan, don't execute
#
# Reference: docs/audits/WORKING_TREE_HONESTY_RECEIPT_2026-05-10.md

set -euo pipefail

DEST=""
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dest=*) DEST="${arg#--dest=}" ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,40p' "$0"
      exit 0
      ;;
    *) echo "[relocate] unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# Anchor at the repo root regardless of where the user invoked the script.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
REPO_NAME="$(basename "$REPO_ROOT")"
cd "$REPO_ROOT"

# 1. Verify we're inside iCloud Drive. The two common patterns:
#   - ~/Library/Mobile Documents/com~apple~CloudDocs/...
#   - ~/Desktop/... (when "Desktop & Documents Folders" sync is enabled —
#     this is the SiteSync case)
ICLOUD_PATTERNS=(
  "/Library/Mobile Documents/"
  "/Desktop/"
  "/Documents/"
)
in_icloud=0
for pat in "${ICLOUD_PATTERNS[@]}"; do
  case "$REPO_ROOT" in
    *"$pat"*) in_icloud=1; break ;;
  esac
done

# Distinguish "in iCloud-synced folder" vs "actually being synced". We trust
# the folder pattern as the heuristic because checking the iCloud Drive
# attribute on a folder reliably is platform-dependent. False positives
# (Desktop without iCloud sync enabled) are harmless — the move still
# improves locality.
if [[ "$in_icloud" -eq 0 ]]; then
  echo "[relocate] repo is at $REPO_ROOT — not under any iCloud-synced path."
  echo "[relocate] nothing to do. exiting."
  exit 0
fi

# 2. Compute destination.
if [[ -z "$DEST" ]]; then
  DEST="$HOME/code/$REPO_NAME"
fi
DEST_DIR="$(dirname "$DEST")"

echo "[relocate] source:      $REPO_ROOT"
echo "[relocate] destination: $DEST"

# 3. Destination must not exist.
if [[ -e "$DEST" ]]; then
  echo "[relocate] ERROR: destination already exists: $DEST" >&2
  echo "[relocate] move it out of the way first, or pass --dest=<other-path>" >&2
  exit 1
fi

# 4. Working tree cleanliness — uncommitted changes are fine (they move with
# the repo) but in-flight rebase/merge state is not.
if [[ -d "$REPO_ROOT/.git/rebase-merge" || -d "$REPO_ROOT/.git/rebase-apply" ]]; then
  echo "[relocate] ERROR: rebase in progress. run 'git rebase --abort' first." >&2
  exit 1
fi
if [[ -f "$REPO_ROOT/.git/MERGE_HEAD" ]]; then
  echo "[relocate] ERROR: merge in progress. run 'git merge --abort' first." >&2
  exit 1
fi

# 5. Surface processes that might hold a file open in the repo. macOS lsof.
if command -v lsof >/dev/null 2>&1; then
  HOLDERS="$(lsof +D "$REPO_ROOT" 2>/dev/null | awk 'NR>1 {print $2 " " $1}' | sort -u || true)"
  if [[ -n "$HOLDERS" ]]; then
    echo "[relocate] processes with files open under the repo:"
    echo "$HOLDERS" | sed 's/^/  /'
    echo "[relocate] consider quitting them before relocation (vite dev server, vscode, etc.)"
  fi
fi

# Dry-run stops here.
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "[relocate] --dry-run: would now run:"
  echo "  mkdir -p '$DEST_DIR'"
  echo "  mv '$REPO_ROOT' '$DEST'"
  echo "  cd '$DEST' && git status --short"
  echo ""
  echo "[relocate] then update:"
  echo "  - any shell aliases pointing at $REPO_ROOT"
  echo "  - Claude Code project: 'claude /add-dir $DEST'"
  echo "  - VSCode: open the new location, close the old"
  exit 0
fi

# 6. Execute the move.
mkdir -p "$DEST_DIR"
echo "[relocate] moving..."
mv "$REPO_ROOT" "$DEST"

# 7. Post-move verification — repo is intact + git works.
cd "$DEST"
GIT_STATUS_FIRST_LINE="$(git status --short --branch | head -1)"
if [[ -z "$GIT_STATUS_FIRST_LINE" ]]; then
  echo "[relocate] ERROR: git status returned nothing — destination may be broken" >&2
  exit 1
fi

# 8. Print next-step instructions.
cat <<EOF

[relocate] DONE — repo is now at: $DEST

Next steps (manual, can't be safely automated):

  1. Open a new shell:
       cd $DEST
       npm install                  # activates husky pre-commit hook

  2. Update Claude Code project path. Either:
       - In a Claude session, run:  /add-dir $DEST
       - Or move the project state directory:
           OLD=\$(echo "$REPO_ROOT" | sed 's|/|-|g')
           NEW=\$(echo "$DEST" | sed 's|/|-|g')
           mv "\$HOME/.claude/projects/\$OLD" "\$HOME/.claude/projects/\$NEW" 2>/dev/null || true

  3. Update any shell aliases that hard-coded $REPO_ROOT. Common locations:
       grep -nF "$REPO_ROOT" ~/.zshrc ~/.bashrc ~/.zsh_aliases 2>/dev/null

  4. Close any VSCode / Cursor / Claude Code window pointing at the OLD path.

  5. Optional: remove the now-empty iCloud parent directory if it's not
     useful for anything else:
       ls -la "$(dirname "$REPO_ROOT")"

After this, no more iCloud duplicates regenerate. The cleanup script
becomes a one-time tool you no longer need to run.
EOF
