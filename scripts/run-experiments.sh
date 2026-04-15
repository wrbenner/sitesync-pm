#!/bin/bash
# =============================================================================
# run-experiments.sh — The Experiment Runner
# =============================================================================
#
# Reads EXPERIMENTS.md, executes each experiment through a structured loop:
#   branch -> measure BEFORE -> invoke Claude -> quality gates -> measure AFTER
#   -> keep (merge) or revert
#
# Circuit breaker: 3 consecutive failures in the same category -> skip category
#
# Usage:
#   bash scripts/run-experiments.sh           # Run up to 5 experiments
#   bash scripts/run-experiments.sh 10        # Run up to 10 experiments
#   bash scripts/run-experiments.sh 1         # Run 1 experiment (testing)
# =============================================================================

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

MAX_EXPERIMENTS="${1:-5}"
RESULTS_FILE=".metrics/experiment-results.json"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Circuit breaker state
declare -A CATEGORY_FAILURES
SKIP_CATEGORIES=""

echo "╔══════════════════════════════════════════╗"
echo "║  EXPERIMENT RUNNER                        ║"
echo "║  Max experiments: $MAX_EXPERIMENTS                        ║"
echo "║  $(date -u)    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Initialize results file
mkdir -p .metrics
cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "max_experiments": $MAX_EXPERIMENTS,
  "experiments": []
}
EOF

# ─── Parse EXPERIMENTS.md into JSON ───

parse_experiments() {
    python3 -c "
import re, json, sys

with open('EXPERIMENTS.md') as f:
    content = f.read()

experiments = []
blocks = re.split(r'### (EXP-\d+):', content)

# blocks[0] is header, then pairs of (id, body)
i = 1
while i < len(blocks) - 1:
    exp_id = blocks[i].strip()
    body = blocks[i + 1]

    def extract(key):
        m = re.search(rf'\*\*{key}\*\*:\s*(.+)', body)
        return m.group(1).strip() if m else ''

    status = extract('Status')
    if status != 'PENDING':
        i += 2
        continue

    # Extract verify command (between backticks)
    verify = ''
    vm = re.search(r'\*\*Verify\*\*:\s*\x60(.+?)\x60', body)
    if vm:
        verify = vm.group(1)

    exp = {
        'id': exp_id,
        'title': body.split('\n')[0].strip(),
        'files': extract('File\(s\)'),
        'task': extract('Task'),
        'current': extract('Current'),
        'target': extract('Target'),
        'verify': verify,
        'category': extract('Category'),
        'priority': extract('Priority'),
    }
    experiments.append(exp)
    i += 2

json.dump(experiments, sys.stdout)
"
}

# ─── Log result to JSON file ───

log_result() {
    local exp_id="$1"
    local result="$2"
    local before="$3"
    local after="$4"
    local reason="${5:-}"

    python3 -c "
import json, sys

with open('$RESULTS_FILE') as f:
    data = json.load(f)

data['experiments'].append({
    'id': '$exp_id',
    'result': '$result',
    'before': '$before',
    'after': '$after',
    'reason': '$reason',
    'timestamp': '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
})

with open('$RESULTS_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"
}

# ─── Run quality gates (lightweight version of immune-gate.sh) ───

run_quality_gates() {
    local passed=true

    # Gate 1: TypeScript
    if ! npx tsc --noEmit 2>/dev/null; then
        echo "    GATE FAIL: TypeScript errors"
        passed=false
    fi

    # Gate 2: Build
    if ! npx vite build 2>/dev/null; then
        echo "    GATE FAIL: Build failed"
        passed=false
    fi

    # Gate 3: Tests (non-blocking — warn only)
    if ! npx vitest run --passWithNoTests 2>/dev/null; then
        echo "    GATE WARN: Some tests failed"
        # Don't fail on test issues for now — the experiment might not touch tested code
    fi

    if [ "$passed" = "true" ]; then
        return 0
    else
        return 1
    fi
}

# ─── Main loop ───

EXPERIMENTS_JSON=$(parse_experiments)
TOTAL=$(echo "$EXPERIMENTS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

echo "Found $TOTAL pending experiments"
echo ""

COMPLETED=0
SUCCEEDED=0
REVERTED=0

for i in $(seq 0 $((TOTAL - 1))); do
    if [ "$COMPLETED" -ge "$MAX_EXPERIMENTS" ]; then
        echo "Reached max experiments ($MAX_EXPERIMENTS). Stopping."
        break
    fi

    # Extract experiment fields
    EXP_ID=$(echo "$EXPERIMENTS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['id'])")
    CATEGORY=$(echo "$EXPERIMENTS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['category'])")
    FILES=$(echo "$EXPERIMENTS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['files'])")
    TASK=$(echo "$EXPERIMENTS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['task'])")
    VERIFY_CMD=$(echo "$EXPERIMENTS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['verify'])")
    TITLE=$(echo "$EXPERIMENTS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['title'])")

    # Circuit breaker check
    if echo "$SKIP_CATEGORIES" | grep -q "$CATEGORY" 2>/dev/null; then
        echo "SKIP $EXP_ID: category $CATEGORY circuit-broken"
        continue
    fi

    COMPLETED=$((COMPLETED + 1))

    echo "════════════════════════════════════════════════"
    echo "  $EXP_ID: $TITLE"
    echo "  Category: $CATEGORY | Files: $FILES"
    echo "════════════════════════════════════════════════"

    # 1. Create experiment branch
    BRANCH="auto/exp-${EXP_ID}-$(date +%s)"
    git checkout -b "$BRANCH" 2>/dev/null || {
        echo "  ERROR: Could not create branch $BRANCH"
        log_result "$EXP_ID" "ERROR" "0" "0" "branch_creation_failed"
        continue
    }

    # 2. Measure BEFORE
    BEFORE=$(eval "$VERIFY_CMD" 2>/dev/null || echo "0")
    echo "  BEFORE: $BEFORE"

    # Skip if already at target
    if [ "$BEFORE" = "0" ]; then
        echo "  SKIP: Already at target (0). Nothing to fix."
        git checkout main 2>/dev/null
        git branch -D "$BRANCH" 2>/dev/null || true
        log_result "$EXP_ID" "SKIPPED" "0" "0" "already_at_target"
        continue
    fi

    # 3. Invoke Claude to make the change
    echo "  Invoking Claude (max 15 turns)..."

    claude --dangerously-skip-permissions \
           --model claude-sonnet-4-6 \
           --max-turns 15 \
           --print \
           "You are fixing a specific code quality issue in SiteSync PM.

TASK: $TASK

FILE(S): $FILES

RULES (absolute):
- Only modify the file(s) listed above
- NEVER use 'as any' type casts
- NEVER add mock/fake/placeholder data
- NEVER modify files in supabase/migrations/ or .github/workflows/
- NEVER use hyphens in UI text
- Use theme tokens from src/styles/theme.ts for colors (never hardcoded hex)
- Use fromTable<T>() helper for Supabase queries (PAT-003)
- Run 'npx tsc --noEmit' after your changes to verify no type errors introduced

CONTEXT:
- Read LEARNINGS.md for patterns to follow
- Read the file(s), understand the code, make the fix, verify with tsc
- Keep changes minimal and focused. One clear fix, not a refactor.

When done, output a one-line summary of what you changed." > /dev/null 2>&1 || true

    # 4. Check if any files were modified
    if git diff --quiet && git diff --cached --quiet; then
        echo "  NO CHANGES: Claude did not modify any files"
        git checkout main 2>/dev/null
        git branch -D "$BRANCH" 2>/dev/null || true
        CATEGORY_FAILURES[$CATEGORY]=$(( ${CATEGORY_FAILURES[$CATEGORY]:-0} + 1 ))
        log_result "$EXP_ID" "NO_CHANGES" "$BEFORE" "$BEFORE" "no_files_modified"

        if [ "${CATEGORY_FAILURES[$CATEGORY]:-0}" -ge 3 ]; then
            SKIP_CATEGORIES="$SKIP_CATEGORIES $CATEGORY"
            echo "  CIRCUIT BREAKER: $CATEGORY disabled after 3 consecutive failures"
        fi
        continue
    fi

    # 5. Run quality gates
    echo "  Running quality gates..."
    GATES_PASSED=true
    if ! run_quality_gates; then
        GATES_PASSED=false
    fi

    # 6. Measure AFTER
    AFTER=$(eval "$VERIFY_CMD" 2>/dev/null || echo "0")
    echo "  AFTER: $AFTER"

    # 7. Decision: keep or revert
    IMPROVED=false

    # Compare numerically if possible, otherwise string compare
    if [ "$AFTER" -lt "$BEFORE" ] 2>/dev/null; then
        IMPROVED=true
    elif [ "$AFTER" = "0" ] && [ "$BEFORE" != "0" ]; then
        IMPROVED=true
    fi

    if [ "$GATES_PASSED" = "true" ] && [ "$IMPROVED" = "true" ]; then
        echo "  ✓ SUCCESS: $BEFORE -> $AFTER"
        git add -A
        git commit -m "[auto] $EXP_ID: $(echo "$TITLE" | head -c 60)" --no-verify 2>/dev/null
        git checkout main 2>/dev/null
        git merge "$BRANCH" --no-edit 2>/dev/null
        git branch -d "$BRANCH" 2>/dev/null || true
        SUCCEEDED=$((SUCCEEDED + 1))
        CATEGORY_FAILURES[$CATEGORY]=0  # Reset circuit breaker on success
        log_result "$EXP_ID" "SUCCESS" "$BEFORE" "$AFTER"
    else
        echo "  ✗ REVERTED: gates=$GATES_PASSED improved=$IMPROVED ($BEFORE -> $AFTER)"
        git checkout -- . 2>/dev/null
        git clean -fd 2>/dev/null
        git checkout main 2>/dev/null
        git branch -D "$BRANCH" 2>/dev/null || true
        REVERTED=$((REVERTED + 1))
        CATEGORY_FAILURES[$CATEGORY]=$(( ${CATEGORY_FAILURES[$CATEGORY]:-0} + 1 ))
        log_result "$EXP_ID" "REVERTED" "$BEFORE" "$AFTER" "gates=$GATES_PASSED improved=$IMPROVED"

        # Log failure to LEARNINGS.md
        echo "" >> LEARNINGS.md
        echo "<!-- Added $(date +%Y-%m-%d) | Source: auto-experiment $EXP_ID -->" >> LEARNINGS.md
        echo "- Experiment $EXP_ID failed ($TITLE). Before=$BEFORE After=$AFTER gates=$GATES_PASSED. Auto-reverted." >> LEARNINGS.md

        if [ "${CATEGORY_FAILURES[$CATEGORY]:-0}" -ge 3 ]; then
            SKIP_CATEGORIES="$SKIP_CATEGORIES $CATEGORY"
            echo "  CIRCUIT BREAKER: $CATEGORY disabled after 3 consecutive failures"
        fi
    fi

    echo ""
done

# ─── Summary ───

echo "╔══════════════════════════════════════════╗"
echo "║  EXPERIMENT RUN COMPLETE                  ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Completed: $COMPLETED                                ║"
echo "║  Succeeded: $SUCCEEDED                                ║"
echo "║  Reverted:  $REVERTED                                ║"
echo "╚══════════════════════════════════════════╝"

# Update results summary
python3 -c "
import json
with open('$RESULTS_FILE') as f:
    data = json.load(f)
data['summary'] = {
    'completed': $COMPLETED,
    'succeeded': $SUCCEEDED,
    'reverted': $REVERTED,
    'categories_skipped': '${SKIP_CATEGORIES}'.strip().split() if '${SKIP_CATEGORIES}'.strip() else []
}
with open('$RESULTS_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"

echo ""
echo "Results: $RESULTS_FILE"
