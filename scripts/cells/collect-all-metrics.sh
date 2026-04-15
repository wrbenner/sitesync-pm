#!/bin/bash
# collect-all-metrics.sh — Run all worker cell scripts and produce summary
# Single entry point for the heartbeat pipeline
set -e

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "╔══════════════════════════════════════════╗"
echo "║  WORKER CELLS: Collecting Metrics         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

mkdir -p .metrics

echo "=== Cell 1: Type Issues ==="
python3 scripts/cells/count-type-issues.py

echo ""
echo "=== Cell 2: Quality Issues ==="
python3 scripts/cells/count-quality-issues.py

echo ""
echo "=== Cell 3: Untested Files ==="
python3 scripts/cells/find-untested.py

echo ""
echo "=== Cell 4: ESLint Issues ==="
python3 scripts/cells/count-eslint-issues.py

echo ""
echo "=== Producing Summary ==="
python3 -c "
import json, os
from datetime import datetime, timezone

summary = {}
for name in ['type-issues', 'quality-issues', 'untested-files', 'eslint-issues']:
    path = f'.metrics/{name}.json'
    if os.path.exists(path):
        with open(path) as f:
            summary[name.replace('-', '_')] = json.load(f)

summary['collected_at'] = datetime.now(timezone.utc).isoformat()

with open('.metrics/summary.json', 'w') as f:
    json.dump(summary, f, indent=2)

# Print headline numbers
ti = summary.get('type_issues', {}).get('totals', {})
qi = summary.get('quality_issues', {}).get('totals', {})
uf = summary.get('untested_files', {})
ei = summary.get('eslint_issues', {}).get('totals', {})

print(f'  as_any: {ti.get(\"as_any\", \"?\")}  ts_ignore: {ti.get(\"ts_ignore\", \"?\")}')
print(f'  mock_data: {qi.get(\"mock_data\", \"?\")}  hardcoded_colors: {qi.get(\"hardcoded_colors\", \"?\")}')
print(f'  test_coverage: {uf.get(\"coverage_pct\", \"?\")}%  untested: {uf.get(\"untested_count\", \"?\")}')
print(f'  eslint_errors: {ei.get(\"errors\", \"?\")}  eslint_warnings: {ei.get(\"warnings\", \"?\")}')
"

echo ""
echo "All metrics collected -> .metrics/summary.json"
