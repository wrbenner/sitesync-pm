#!/usr/bin/env bash
# delete-dead-stores.sh — Day 6 cleanup (stores)
#
# Deletes 15 confirmed-dead Zustand stores.  All have 0 external consumers
# (no imports outside src/stores/ itself).  Their state has been migrated to
# entityStore, React Query hooks, or authStore/projectContextStore.
#
# Verified: grep -rn "use<StoreName>\|from.*stores/<name>" src/ → 0 hits
# Documented: docs/audits/STORE_CONSOLIDATION_PLAN_2026-05-01.md (Group A)
#
# Run from repo root:
#   bash scripts/delete-dead-stores.sh
#   git commit -m "chore: delete 15 dead Zustand stores (~3,400 dead LOC)"

set -e
cd "$(git rev-parse --show-toplevel)"

DEAD_STORES=(
  "src/stores/activityStore.ts"      # 70 LOC — activity feed items; page removed
  "src/stores/changeOrderStore.ts"   # 89 LOC — change orders; migrated to entityStore + RQ
  "src/stores/dailyLogStore.ts"      # 154 LOC — daily log; migrated to React Query
  "src/stores/directoryStore.ts"     # 107 LOC — team directory; migrated to entityStore
  "src/stores/documentStore.ts"      # 164 LOC — document metadata; migrated to React Query
  "src/stores/drawingStore.ts"       # 271 LOC — drawing sheets/revisions; migrated to React Query
  "src/stores/fieldCaptureStore.ts"  # 78 LOC — field capture sessions; migrated to React Query
  "src/stores/fileStore.ts"          # 242 LOC — file/folder tree; migrated to React Query
  "src/stores/lienWaiverStore.ts"    # 94 LOC — lien waiver records; migrated to React Query
  "src/stores/projectStore.ts"       # 163 LOC — old project list; replaced by projectContextStore
  "src/stores/punchItemStore.ts"     # 170 LOC — punch items; migrated to entityStore
  "src/stores/rfiStore.ts"           # 160 LOC — RFI list; migrated to entityStore
  "src/stores/sovStore.ts"           # 87 LOC — schedule of values; migrated to React Query
  "src/stores/teamStore.ts"          # 126 LOC — team membership; migrated to projectContextStore
  "src/stores/userStore.ts"          # 140 LOC — user profile; migrated to authStore
)

echo "=== Deleting dead Zustand store files ==="
total_lines=0
deleted=0
for f in "${DEAD_STORES[@]}"; do
  # Strip inline comment to get just the path
  path="${f%%#*}"
  path="${path%% }"
  if [ -f "$path" ]; then
    lines=$(wc -l < "$path")
    git rm "$path"
    echo "  ✓  $path ($lines lines)"
    total_lines=$((total_lines + lines))
    deleted=$((deleted + 1))
  else
    echo "  ⚠  $path — already gone, skipping"
  fi
done

echo ""
echo "=== Summary ==="
echo "  Files removed: $deleted"
echo "  Dead LOC removed: ~$total_lines"
echo ""
echo "Suggested commit:"
echo "  git commit -m \"chore: delete $deleted dead Zustand stores (~\${total_lines} dead LOC)\""
echo ""
echo "This completes Day 6 store cleanup (Group A of STORE_CONSOLIDATION_PLAN_2026-05-01.md)."
echo "Next: Day 7 migrations are already applied in authStore.ts and projectStore.ts."
