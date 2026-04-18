#!/usr/bin/env bash
# product-state.sh — generate a product state JSON report of pages with UI but
# missing wiring to existing mutation/query hooks.
#
# Writes JSON to stdout; also writes it to /tmp/product-state.json for reuse.
# Used by the Workflow Builder to feed Claude Code holistic product context.

set -uo pipefail
# Note: no `-e` because grep/head pipelines return non-zero on no matches,
# which is expected when a page has zero mutation hooks wired.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT_FILE="${1:-/tmp/product-state.json}"

# Priority pages (highest impact → lowest). Format: NAME|PATH|DOMAIN|MUTATION_HOOKS|QUERY_HOOKS
read -r -d '' PAGES <<'EOF' || true
Safety.tsx|src/pages/Safety.tsx|safety|useCreateIncident,useCreateSafetyInspection,useCreateCorrectiveAction,useUpdateCorrectiveAction|useIncidents,useSafetyInspections
Meetings.tsx|src/pages/Meetings.tsx|meetings|useCreateMeeting|useMeetings
Permits.tsx|src/pages/Permits.tsx|permits||usePermits
Procurement.tsx|src/pages/Procurement.tsx|procurement||useProcurementItems,useEquipment
DailyLogForm.tsx|src/pages/daily-log/DailyLogForm.tsx|daily-logs|useCreateDailyLogEntry,useSubmitDailyLog|useDailyLogs,useDailyLogEntries
SOVEditor.tsx|src/pages/payment-applications/SOVEditor.tsx|payment-applications||usePaymentApplications
PunchListDetail.tsx|src/pages/punch-list/PunchListDetail.tsx|punch-items|useUpdatePunchItem,useCreatePunchItem|usePunchItems
DrawingDetail.tsx|src/pages/drawings/DrawingDetail.tsx|drawings||useDrawings
CaptureUpload.tsx|src/pages/field-capture/CaptureUpload.tsx|field-captures|useCreateFieldCapture|useFieldCaptures
FileGrid.tsx|src/pages/files/FileGrid.tsx|files|useCreateFile,useDeleteFile|useFiles
EOF

echo "{" > "$OUT_FILE"
echo "  \"generated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$OUT_FILE"
echo "  \"unwired_pages\": [" >> "$OUT_FILE"

FIRST=1
PRIORITY=0
while IFS='|' read -r NAME FILE DOMAIN MHOOKS QHOOKS; do
  [ -z "$NAME" ] && continue
  PRIORITY=$((PRIORITY + 1))

  if [ ! -f "$FILE" ]; then
    continue
  fi

  # Count existing mutation hook imports (rough: match useCreate/useUpdate/useDelete)
  MUTATIONS_WIRED=$(grep -cE "useCreate[A-Z]|useUpdate[A-Z]|useDelete[A-Z]|useSubmit[A-Z]|useApprove[A-Z]|useReject[A-Z]" "$FILE" 2>/dev/null || true)
  MUTATIONS_WIRED="${MUTATIONS_WIRED:-0}"

  # Check which of the expected hooks are already imported
  MISSING_MUTATIONS=""
  if [ -n "$MHOOKS" ]; then
    IFS=',' read -ra MARR <<< "$MHOOKS"
    for h in "${MARR[@]}"; do
      if ! grep -q "$h" "$FILE" 2>/dev/null; then
        MISSING_MUTATIONS="${MISSING_MUTATIONS}${MISSING_MUTATIONS:+,}\"$h\""
      fi
    done
  fi

  MISSING_QUERIES=""
  if [ -n "$QHOOKS" ]; then
    IFS=',' read -ra QARR <<< "$QHOOKS"
    for h in "${QARR[@]}"; do
      if ! grep -q "$h" "$FILE" 2>/dev/null; then
        MISSING_QUERIES="${MISSING_QUERIES}${MISSING_QUERIES:+,}\"$h\""
      fi
    done
  fi

  # Gap status
  if [ -z "$MISSING_MUTATIONS" ] && [ -z "$MISSING_QUERIES" ]; then
    STATUS="wired"
  else
    STATUS="unwired"
  fi

  LOC=$(wc -l < "$FILE" 2>/dev/null || echo 0)

  if [ "$FIRST" -eq 0 ]; then echo "," >> "$OUT_FILE"; fi
  FIRST=0

  cat >> "$OUT_FILE" <<JSONEOF
    {
      "priority": $PRIORITY,
      "page": "$NAME",
      "file": "$FILE",
      "domain": "$DOMAIN",
      "loc": $LOC,
      "mutations_count": $MUTATIONS_WIRED,
      "available_mutation_hooks": [$(echo -n "$MHOOKS" | awk -F, '{for(i=1;i<=NF;i++) printf "%s\"%s\"", (i>1?",":""), $i}')],
      "available_query_hooks": [$(echo -n "$QHOOKS" | awk -F, '{for(i=1;i<=NF;i++) printf "%s\"%s\"", (i>1?",":""), $i}')],
      "missing_mutations": [$MISSING_MUTATIONS],
      "missing_queries": [$MISSING_QUERIES],
      "status": "$STATUS",
      "gap": "Page has UI but doesn't import expected hooks"
    }
JSONEOF
done <<< "$PAGES"

echo "" >> "$OUT_FILE"
echo "  ]," >> "$OUT_FILE"

# Enumerate all mutation and query hooks files so Claude has catalog awareness
MUTATION_FILES=$(ls src/hooks/mutations/*.ts 2>/dev/null | sed 's|.*/||;s|\.ts$||' | awk '{printf "%s\"%s\"", (NR>1?",":""), $0}')
QUERY_FILES=$(ls src/hooks/queries/*.ts 2>/dev/null | sed 's|.*/||;s|\.ts$||' | awk '{printf "%s\"%s\"", (NR>1?",":""), $0}')

echo "  \"hook_catalog\": {" >> "$OUT_FILE"
echo "    \"mutations\": [$MUTATION_FILES]," >> "$OUT_FILE"
echo "    \"queries\": [$QUERY_FILES]" >> "$OUT_FILE"
echo "  }" >> "$OUT_FILE"
echo "}" >> "$OUT_FILE"

cat "$OUT_FILE"
