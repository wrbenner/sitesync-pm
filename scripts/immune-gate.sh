#!/bin/bash
# immune-gate.sh — The organism's immune system
# Runs on every push. AI agent commits get MORE scrutiny, not less.
# Exit codes: 0 = all gates passed, 1 = blocked

set -e

PASS=0
FAIL=0
WARNINGS=""

echo "╔══════════════════════════════════════════╗"
echo "║     SITESYNC IMMUNE GATE v1.0            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Gate 1: TypeScript Strict ──
echo "=== GATE 1: TypeScript Strict Mode ==="
if npx tsc --noEmit 2>&1; then
    echo "✓ TypeScript: PASSED"
    PASS=$((PASS + 1))
else
    echo "✗ TypeScript: FAILED — type errors detected"
    FAIL=$((FAIL + 1))
fi

# ── Gate 2: ESLint ──
echo ""
echo "=== GATE 2: ESLint ==="
LINT_OUTPUT=$(npx eslint . --format json 2>/dev/null || true)
LINT_ERRORS=$(echo "$LINT_OUTPUT" | jq '[.[].errorCount] | add // 0' 2>/dev/null || echo "0")
LINT_WARNINGS=$(echo "$LINT_OUTPUT" | jq '[.[].warningCount] | add // 0' 2>/dev/null || echo "0")

# Check against floor
FLOOR_WARNINGS=$(jq '.eslintWarnings' .quality-floor.json 2>/dev/null || echo "999999")

if [ "$LINT_ERRORS" -gt 0 ]; then
    echo "✗ ESLint: FAILED — $LINT_ERRORS errors"
    FAIL=$((FAIL + 1))
elif [ "$LINT_WARNINGS" -gt "$FLOOR_WARNINGS" ]; then
    echo "✗ ESLint: FAILED — $LINT_WARNINGS warnings exceeds floor of $FLOOR_WARNINGS (quality ratchet)"
    FAIL=$((FAIL + 1))
else
    echo "✓ ESLint: PASSED ($LINT_ERRORS errors, $LINT_WARNINGS warnings, floor: $FLOOR_WARNINGS)"
    PASS=$((PASS + 1))
    # Update floor if improved
    if [ "$LINT_WARNINGS" -lt "$FLOOR_WARNINGS" ]; then
        jq ".eslintWarnings = $LINT_WARNINGS" .quality-floor.json > .quality-floor.json.tmp
        mv .quality-floor.json.tmp .quality-floor.json
        echo "  ↓ Quality floor improved: $FLOOR_WARNINGS → $LINT_WARNINGS warnings"
    fi
fi

# ── Gate 3: Unit Tests ──
echo ""
echo "=== GATE 3: Unit Tests ==="
if npx vitest run --reporter=verbose 2>&1; then
    echo "✓ Tests: PASSED"
    PASS=$((PASS + 1))
else
    echo "✗ Tests: FAILED"
    FAIL=$((FAIL + 1))
fi

# ── Gate 4: Build ──
echo ""
echo "=== GATE 4: Build ==="
if npx vite build 2>&1; then
    echo "✓ Build: PASSED"
    PASS=$((PASS + 1))
else
    echo "✗ Build: FAILED"
    FAIL=$((FAIL + 1))
fi

# ── Gate 5: Bundle Size Ratchet ──
echo ""
echo "=== GATE 5: Bundle Size ==="
if [ -d "dist" ]; then
    CURRENT_SIZE=$(du -sk dist/assets/*.js 2>/dev/null | awk '{sum += $1} END {print sum+0}')
    FLOOR_SIZE=$(jq '.bundleSizeKB' .quality-floor.json 2>/dev/null || echo "999999")

    if [ "$CURRENT_SIZE" -gt "$FLOOR_SIZE" ]; then
        echo "✗ Bundle: FAILED — ${CURRENT_SIZE}KB exceeds floor of ${FLOOR_SIZE}KB"
        FAIL=$((FAIL + 1))
    else
        echo "✓ Bundle: PASSED (${CURRENT_SIZE}KB, floor: ${FLOOR_SIZE}KB)"
        PASS=$((PASS + 1))
        if [ "$CURRENT_SIZE" -lt "$FLOOR_SIZE" ] && [ "$CURRENT_SIZE" -gt 0 ]; then
            jq ".bundleSizeKB = $CURRENT_SIZE" .quality-floor.json > .quality-floor.json.tmp
            mv .quality-floor.json.tmp .quality-floor.json
            echo "  ↓ Quality floor improved: ${FLOOR_SIZE}KB → ${CURRENT_SIZE}KB"
        fi
    fi
else
    echo "⚠ Bundle: SKIPPED (no dist/ directory)"
    WARNINGS="$WARNINGS\n  - Bundle size check skipped (no build)"
fi

# ── Gate 6: Mock Data Scan ──
echo ""
echo "=== GATE 6: Mock Data ==="
MOCK_COUNT=$(grep -rn "mock\|Mock\|MOCK\|fake\|Fake\|placeholder\|Lorem\|dummy" src/ \
    --include="*.ts" --include="*.tsx" \
    2>/dev/null | grep -v "test\|spec\|__test__\|\.test\.\|\.spec\.\|setup\.ts\|factories\.ts" \
    | grep -v "// immune-ok\|// mock-ok" \
    | wc -l | tr -d ' ')
FLOOR_MOCKS=$(jq '.mockDataInstances' .quality-floor.json 2>/dev/null || echo "999999")

if [ "$MOCK_COUNT" -gt "$FLOOR_MOCKS" ]; then
    echo "✗ Mock Data: FAILED — $MOCK_COUNT instances exceeds floor of $FLOOR_MOCKS"
    FAIL=$((FAIL + 1))
else
    echo "✓ Mock Data: PASSED ($MOCK_COUNT instances, floor: $FLOOR_MOCKS)"
    PASS=$((PASS + 1))
    if [ "$MOCK_COUNT" -lt "$FLOOR_MOCKS" ]; then
        jq ".mockDataInstances = $MOCK_COUNT" .quality-floor.json > .quality-floor.json.tmp
        mv .quality-floor.json.tmp .quality-floor.json
        echo "  ↓ Quality floor improved: $FLOOR_MOCKS → $MOCK_COUNT mock instances"
    fi
fi

# ── Gate 7: Type Safety ──
echo ""
echo "=== GATE 7: Type Safety ==="
ANY_COUNT=$(grep -rn "as any\|@ts-ignore\|@ts-expect-error" src/ \
    --include="*.ts" --include="*.tsx" \
    2>/dev/null | grep -v "test\|spec\|__test__" \
    | grep -v "// type-safe-ok" \
    | wc -l | tr -d ' ')
FLOOR_ANY=$(jq '.anyTypeCasts' .quality-floor.json 2>/dev/null || echo "999999")

if [ "$ANY_COUNT" -gt "$FLOOR_ANY" ]; then
    echo "✗ Type Safety: FAILED — $ANY_COUNT unsafe casts exceeds floor of $FLOOR_ANY"
    FAIL=$((FAIL + 1))
else
    echo "✓ Type Safety: PASSED ($ANY_COUNT unsafe casts, floor: $FLOOR_ANY)"
    PASS=$((PASS + 1))
    if [ "$ANY_COUNT" -lt "$FLOOR_ANY" ]; then
        jq ".anyTypeCasts = $ANY_COUNT" .quality-floor.json > .quality-floor.json.tmp
        mv .quality-floor.json.tmp .quality-floor.json
        echo "  ↓ Quality floor improved: $FLOOR_ANY → $ANY_COUNT unsafe casts"
    fi
fi

# ── Summary ──
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     IMMUNE GATE RESULTS                  ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Passed: $PASS / $((PASS + FAIL))                            ║"

if [ "$FAIL" -gt 0 ]; then
    echo "║  Status: ✗ REJECTED                     ║"
    echo "╚══════════════════════════════════════════╝"
    exit 1
else
    echo "║  Status: ✓ APPROVED                     ║"
    echo "╚══════════════════════════════════════════╝"
    exit 0
fi
