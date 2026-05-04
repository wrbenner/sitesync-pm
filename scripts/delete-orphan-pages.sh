#!/usr/bin/env bash
# delete-orphan-pages.sh — Day 6 cleanup
#
# Deletes 14 confirmed-orphaned page files.  All have 0 import references
# in the active codebase.  Their former routes have been replaced with
# <Navigate> redirects or removed entirely.
#
# Verified: grep -rn "from.*pages/<Name>" src/ → 0 hits for each file.
# Documented: docs/audits/STUB_PAGE_AUDIT_2026-05-01.md (Category A)
#
# Run from repo root:
#   bash scripts/delete-orphan-pages.sh
#   git commit -m "chore: delete 14 orphaned page files (~10,767 dead LOC)"

set -e
cd "$(git rev-parse --show-toplevel)"

ORPHANS=(
  "src/pages/AIAgents.tsx"        # 878 LOC — AI agent mgmt, no route
  "src/pages/Activity.tsx"        # 281 LOC — activity feed, no route
  "src/pages/Deliveries.tsx"      # 716 LOC — material deliveries, no route
  "src/pages/LienWaivers.tsx"     # 625 LOC — lien waivers (integrated into PayApp)
  "src/pages/Lookahead.tsx"       # 626 LOC — /lookahead → /schedule redirect
  "src/pages/OwnerPortal.tsx"     # 438 LOC — owner portal, no route
  "src/pages/Preconstruction.tsx" # 1760 LOC — preconstruction dashboard, no route
  "src/pages/ProjectHealth.tsx"   # 625 LOC — health scorecard, no route
  "src/pages/Resources.tsx"       # 490 LOC — resource planning, no route
  "src/pages/SiteMap.tsx"         # 1787 LOC — site map viewer, no route
  "src/pages/Specifications.tsx"  # 385 LOC — spec viewer, no route
  "src/pages/Transmittals.tsx"    # 478 LOC — transmittals, no route
  "src/pages/Vendors.tsx"         # 1049 LOC — /vendors → /contracts redirect
  "src/pages/Wiki.tsx"            # 629 LOC — project wiki, no route
)

echo "=== Deleting orphaned page files ==="
total_lines=0
for f in "${ORPHANS[@]}"; do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f")
    git rm "$f"
    echo "  ✓  $f ($lines lines)"
    total_lines=$((total_lines + lines))
  else
    echo "  ⚠  $f — already gone, skipping"
  fi
done

echo ""
echo "=== Summary ==="
echo "  Files removed: ${#ORPHANS[@]}"
echo "  Dead LOC removed: ~$total_lines"
echo ""
echo "Suggested commit:"
echo "  git commit -m \"chore: delete 14 orphaned page files (~\${total_lines} dead LOC)\""
echo ""
echo "This satisfies Day 6 of the 90-day plan (Lap 1 — Subtract)."
