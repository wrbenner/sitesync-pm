#!/bin/bash
###############################################################################
#
#  SITESYNC AI — AUTONOMOUS IMPROVEMENT ENGINE v3.0
#  ═══════════════════════════════════════════════════════════════════════════
#
#  A fully autonomous loop that audits, improves, verifies, and re-audits
#  the SiteSyncAI codebase until zero actionable issues remain across every
#  dimension: architecture, security, performance, AI integration, UI/UX,
#  construction domain depth, financial engine, and more.
#
#  THE LOOP:
#    1. Snapshot entire codebase (git-hash cached — only re-snapshots on change)
#    2. Decompose into logical modules via Haiku (cost-optimized decomposition)
#    3. Deep audit each module across 13 dimensions + competitive web research
#    4. Inject FEEDBACK.md founder priorities into every audit
#    5. Generate specific, self-contained Claude Code prompts for every issue
#    6. Execute each prompt via Claude Code (non-interactive, auto-permissions)
#    7. Verify build passes — auto-fix regressions if not
#    8. Verify every change was correctly implemented
#    9. Loop until zero actionable items remain, or budget/cycle limit hit
#   10. Commit changes, write final report, send completion notification
#
#  USAGE:
#    chmod +x autonomous_loop.sh
#    export ANTHROPIC_API_KEY="sk-ant-..."
#    ./autonomous_loop.sh /path/to/sitesyncai
#
#  RECOMMENDED OVERNIGHT RUN:
#    tmux new -s engine
#    MAX_CYCLES=30 MAX_SPEND=500 ./autonomous_loop.sh /path/to/sitesyncai
#    # Ctrl+B then D to detach. tmux attach -t engine in the morning.
#
#  ENVIRONMENT VARIABLES (all optional):
#    MAX_CYCLES=20                   Max audit-execute-verify cycles (default: 20)
#    MAX_SPEND=500                   Max API spend in USD (default: 500)
#    AUDIT_MODEL=claude-opus-4-6     Model for deep audits (default: opus)
#    CODE_MODEL=claude-sonnet-4-6    Model for Claude Code execution (default: sonnet)
#    DECOMP_MODEL=claude-haiku-4-5-20251001  Model for module decomp (default: haiku)
#    LOG_DIR=./engine-logs           Log directory (default: ./engine-logs)
#    SKIP_WEB_RESEARCH=false         Skip competitive web research (saves ~20%)
#    INCLUDE_UI=true                 Include UI/UX auditing (default: true)
#    DRY_RUN=false                   Audit without executing changes (default: false)
#    BUILD_CMD=""                    Build command verified after each cycle (e.g. "npm run build")
#    TEST_CMD=""                     Test command to run after changes (e.g. "npm test")
#    SKIP_MODULES=""                 Comma-separated module names to skip
#    FEEDBACK_FILE=""                Path to feedback file (default: PROJECT_DIR/FEEDBACK.md)
#    NOTIFY_WEBHOOK=""               Webhook URL for POST notification on completion
#    MAX_ISSUES_PER_MODULE=20        Cap issues processed per module per cycle (default: 20)
#
###############################################################################

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_DIR="${1:?Usage: ./autonomous_loop.sh /path/to/project}"
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

MAX_CYCLES="${MAX_CYCLES:-20}"
MAX_SPEND="${MAX_SPEND:-500}"
AUDIT_MODEL="${AUDIT_MODEL:-claude-opus-4-6}"
CODE_MODEL="${CODE_MODEL:-claude-sonnet-4-6}"
DECOMP_MODEL="${DECOMP_MODEL:-claude-haiku-4-5-20251001}"
LOG_DIR="${LOG_DIR:-./engine-logs}"
SKIP_WEB_RESEARCH="${SKIP_WEB_RESEARCH:-false}"
INCLUDE_UI="${INCLUDE_UI:-true}"
DRY_RUN="${DRY_RUN:-false}"
BUILD_CMD="${BUILD_CMD:-}"
TEST_CMD="${TEST_CMD:-}"
SKIP_MODULES="${SKIP_MODULES:-}"
FEEDBACK_FILE="${FEEDBACK_FILE:-$PROJECT_DIR/FEEDBACK.md}"
NOTIFY_WEBHOOK="${NOTIFY_WEBHOOK:-}"
MAX_ISSUES_PER_MODULE="${MAX_ISSUES_PER_MODULE:-20}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_DIR="${LOG_DIR}/run_${TIMESTAMP}"
mkdir -p "$RUN_DIR"

# Tee all output to log file for later review
exec > >(tee -a "${RUN_DIR}/engine.log") 2>&1

# ── Global state ──────────────────────────────────────────────────────────────
TOTAL_INPUT_TOKENS=0
TOTAL_OUTPUT_TOKENS=0
ESTIMATED_SPEND="0.00"
CYCLE_SPEND="0.00"
CYCLE=0
START_TIME=$(date +%s)
LAST_SNAPSHOT_HASH=""
ALL_CLEAN=false
_INTERRUPTED=false

# Score tracking files (file-based for bash 3 compatibility on macOS)
SCORES_DIR="${RUN_DIR}/scores"
mkdir -p "$SCORES_DIR"

# ── Signal handling — graceful shutdown on Ctrl+C ─────────────────────────────
_handle_interrupt() {
    _INTERRUPTED=true
    echo ""
    warn "Interrupted after cycle ${CYCLE}. Writing final report..."
    generate_report 2>/dev/null || true
    notify_completion "INTERRUPTED" 2>/dev/null || true
    exit 130
}
trap '_handle_interrupt' INT TERM

# ── Pricing (Claude series — March 2026) ──────────────────────────────────────
# Opus 4.6:   $5  input / $25 output per 1M tokens
# Sonnet 4.6: $3  input / $15 output per 1M tokens
# Haiku 4.5:  $1  input / $5  output per 1M tokens
OPUS_INPUT_RATE="0.000005"
OPUS_OUTPUT_RATE="0.000025"
SONNET_INPUT_RATE="0.000003"
SONNET_OUTPUT_RATE="0.000015"
HAIKU_INPUT_RATE="0.000001"
HAIKU_OUTPUT_RATE="0.000005"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
success() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
warn()    { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; }
error()   { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }
header()  {
    echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════════════${NC}\n"
}

# ── Helpers ───────────────────────────────────────────────────────────────────

# macOS-compatible human-readable byte sizes (no numfmt dependency)
format_bytes() {
    local bytes="$1"
    if   [ "$bytes" -gt 1073741824 ]; then echo "$(( bytes / 1073741824 ))G"
    elif [ "$bytes" -gt    1048576 ]; then echo "$(( bytes / 1048576 ))M"
    elif [ "$bytes" -gt       1024 ]; then echo "$(( bytes / 1024 ))K"
    else echo "${bytes}B"
    fi
}

# Human-readable elapsed time since START_TIME
elapsed() {
    local secs=$(( $(date +%s) - START_TIME ))
    printf "%dh %02dm %02ds" $(( secs / 3600 )) $(( secs % 3600 / 60 )) $(( secs % 60 ))
}

# Extract text content from Claude API response (handles tool_use blocks)
extract_text() {
    echo "$1" | jq -r '[.content[] | select(.type=="text") | .text] | join("")' 2>/dev/null || echo ""
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────
preflight() {
    header "PRE-FLIGHT CHECKS"

    # API key
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        error "ANTHROPIC_API_KEY not set."
        echo "  Run: export ANTHROPIC_API_KEY='sk-ant-...'"
        echo "  Get one at: https://console.anthropic.com/settings/keys"
        exit 1
    fi
    success "API key found"

    # Claude Code CLI
    if ! command -v claude &>/dev/null; then
        error "Claude Code CLI not found."
        echo "  Run: npm install -g @anthropic-ai/claude-code"
        exit 1
    fi
    local cc_ver
    cc_ver=$(claude --version 2>/dev/null | head -1 || echo "version unknown")
    success "Claude Code CLI: ${cc_ver}"

    # Required tools
    for tool in jq bc curl; do
        if ! command -v "$tool" &>/dev/null; then
            error "${tool} not found."
            echo "  macOS: brew install ${tool}"
            echo "  Linux: sudo apt-get install -y ${tool}"
            exit 1
        fi
    done
    success "Required tools: jq, bc, curl"

    # Project directory
    if [ ! -d "$PROJECT_DIR" ]; then
        error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi
    success "Project: $PROJECT_DIR"

    # Auto-detect build/test commands from package.json
    if [ -z "$BUILD_CMD" ] && [ -f "$PROJECT_DIR/package.json" ]; then
        if jq -e '.scripts.build' "$PROJECT_DIR/package.json" &>/dev/null; then
            BUILD_CMD="npm run build"
            log "  Auto-detected build: ${BUILD_CMD}"
        fi
    fi
    if [ -z "$TEST_CMD" ] && [ -f "$PROJECT_DIR/package.json" ]; then
        local test_script
        test_script=$(jq -r '.scripts.test // ""' "$PROJECT_DIR/package.json" 2>/dev/null)
        if [ -n "$test_script" ] && [[ "$test_script" != *"echo"* ]] && [[ "$test_script" != *"no test"* ]]; then
            TEST_CMD="npm test -- --passWithNoTests 2>/dev/null || true"
            log "  Auto-detected tests: npm test"
        fi
    fi

    # Git state
    if [ -d "$PROJECT_DIR/.git" ]; then
        cd "$PROJECT_DIR"
        if ! git diff --quiet HEAD 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
            warn "Uncommitted changes detected. Creating backup commit..."
            git add -A
            git commit -m "backup: pre-engine snapshot ($(date +%Y-%m-%d_%H:%M))" 2>/dev/null || true
            success "Backup commit created"
        fi
        success "Git: $(git log -1 --format='%h %s' 2>/dev/null || echo 'clean')"
    else
        warn "Not a git repo. Consider: git init && git add -A && git commit -m 'init'"
    fi

    # Codebase stats
    local file_count code_lines
    file_count=$(find "$PROJECT_DIR" -type f \
        -not -path '*/node_modules/*' -not -path '*/.git/*' \
        -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/.next/*' \
        -not -name '*.lock' -not -name 'package-lock.json' \
        -not -name '*.min.js' -not -name '*.min.css' -not -name '*.map' \
        2>/dev/null | wc -l | tr -d ' ')
    code_lines=$(find "$PROJECT_DIR" -type f \
        \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
        -o -name '*.py' -o -name '*.go' -o -name '*.css' -o -name '*.html' \
        -o -name '*.sql' -o -name '*.prisma' -o -name '*.graphql' \) \
        -not -path '*/node_modules/*' -not -path '*/.git/*' \
        -not -path '*/dist/*' -not -path '*/build/*' \
        -not -name '*.min.js' -not -name '*.min.css' \
        -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
    log "Codebase: ~${file_count} files, ~${code_lines} lines"

    # FEEDBACK.md
    if [ -f "$FEEDBACK_FILE" ] && [ -s "$FEEDBACK_FILE" ]; then
        local fb_lines
        fb_lines=$(wc -l < "$FEEDBACK_FILE" | tr -d ' ')
        success "FEEDBACK.md found (${fb_lines} lines) — injected into all audits as P0 priority"
    fi

    echo ""
    log "Configuration:"
    log "  Max cycles:         ${MAX_CYCLES}"
    log "  Max spend:          \$${MAX_SPEND}"
    log "  Audit model:        ${AUDIT_MODEL}"
    log "  Code model:         ${CODE_MODEL}"
    log "  Decomp model:       ${DECOMP_MODEL}  (cost-optimized)"
    log "  Web research:       $([ "$SKIP_WEB_RESEARCH" = "true" ] && echo "OFF" || echo "ON")"
    log "  UI auditing:        $([ "$INCLUDE_UI" = "true" ] && echo "ON" || echo "OFF")"
    log "  Dry run:            $([ "$DRY_RUN" = "true" ] && echo "YES (audit only)" || echo "NO")"
    log "  Build verify:       $([ -n "$BUILD_CMD" ] && echo "$BUILD_CMD" || echo "OFF")"
    log "  Test verify:        $([ -n "$TEST_CMD" ] && echo "ON" || echo "OFF")"
    log "  Skip modules:       $([ -n "$SKIP_MODULES" ] && echo "$SKIP_MODULES" || echo "none")"
    log "  Max issues/module:  ${MAX_ISSUES_PER_MODULE}"
    log "  Notify webhook:     $([ -n "$NOTIFY_WEBHOOK" ] && echo "SET" || echo "not set")"
    log "  Logs:               ${RUN_DIR}"
    echo ""

    # Validate API key with a cheap Haiku ping
    log "Validating API key..."
    local test_resp http_code
    test_resp=$(curl -s -w "\n%{http_code}" "https://api.anthropic.com/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${ANTHROPIC_API_KEY}" \
        -H "anthropic-version: 2023-06-01" \
        -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}' \
        2>/dev/null)
    http_code=$(echo "$test_resp" | tail -1)
    if [ "$http_code" != "200" ]; then
        error "API validation failed (HTTP ${http_code}). Check key and billing at console.anthropic.com"
        exit 1
    fi
    success "API key valid — billing active"
    echo ""
}

# ── Snapshot codebase ─────────────────────────────────────────────────────────
snapshot_codebase() {
    local output_file="$1"
    log "Snapshotting codebase..."

    # Skip if nothing has changed since last snapshot (git hash check)
    if [ -d "$PROJECT_DIR/.git" ]; then
        local current_hash
        current_hash=$(cd "$PROJECT_DIR" && git rev-parse HEAD 2>/dev/null || echo "")
        if [ -n "$current_hash" ] && [ "$current_hash" = "$LAST_SNAPSHOT_HASH" ] && [ -f "$output_file" ]; then
            log "  Snapshot current ($(cd "$PROJECT_DIR" && git log -1 --format='%h %s' 2>/dev/null)). Reusing cached."
            return 0
        fi
        LAST_SNAPSHOT_HASH="$current_hash"
    fi

    {
        echo "# SITESYNCAI CODEBASE SNAPSHOT"
        echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        [ -d "$PROJECT_DIR/.git" ] && echo "# Git: $(cd "$PROJECT_DIR" && git log -1 --format='%h %s (%ad)' --date=short 2>/dev/null || echo 'n/a')"
        echo ""

        echo "## DIRECTORY STRUCTURE"
        echo '```'
        find "$PROJECT_DIR" -type f \
            -not -path '*/node_modules/*' -not -path '*/.git/*' \
            -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/.next/*' \
            -not -path '*/vendor/*' -not -path '*/__pycache__/*' \
            -not -path '*/.turbo/*' -not -path '*/.cache/*' \
            -not -name '*.lock' -not -name 'package-lock.json' \
            -not -name '*.min.js' -not -name '*.min.css' -not -name '*.map' \
            -not -name '*.ico' -not -name '*.png' -not -name '*.jpg' \
            -not -name '*.jpeg' -not -name '*.gif' -not -name '*.svg' \
            -not -name '*.woff*' -not -name '*.ttf' -not -name '*.eot' \
            2>/dev/null | sed "s|$PROJECT_DIR/||" | sort
        echo '```'
        echo ""

        # Config and meta files first — highest signal per token
        for pattern in package.json tsconfig.json "next.config.*" "vite.config.*" \
                       pyproject.toml requirements.txt Cargo.toml go.mod \
                       docker-compose.yml Dockerfile .env.example \
                       "prisma/schema.prisma" "drizzle.config.*" "tailwind.config.*" \
                       CLAUDE.md README.md FEEDBACK.md; do
            for f in "$PROJECT_DIR"/$pattern; do
                [ -f "$f" ] || continue
                local rel="${f#$PROJECT_DIR/}"
                echo "## FILE: $rel"
                echo '```'
                head -500 "$f"
                echo '```'
                echo ""
            done
        done

        # All source files
        find "$PROJECT_DIR" -type f \
            \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
            -o -name '*.py' -o -name '*.go' -o -name '*.rs' -o -name '*.java' \
            -o -name '*.css' -o -name '*.scss' -o -name '*.html' \
            -o -name '*.sql' -o -name '*.prisma' -o -name '*.graphql' \
            -o -name '*.yaml' -o -name '*.yml' \) \
            -not -path '*/node_modules/*' -not -path '*/.git/*' \
            -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/.next/*' \
            -not -name '*.min.js' -not -name '*.min.css' -not -name '*.d.ts' \
            -not -name 'package-lock.json' -not -name '*.lock' \
            -not -name 'tsconfig.json' -not -name 'package.json' \
            2>/dev/null | sort | while IFS= read -r file; do
                local rel="${file#$PROJECT_DIR/}"
                local lines
                lines=$(wc -l < "$file" 2>/dev/null || echo "0")
                if [ "$lines" -gt 1500 ]; then
                    echo "## FILE: $rel [${lines} lines — first 300 + last 100 shown]"
                    echo '```'
                    head -300 "$file"
                    echo "... [${lines} total lines — middle truncated for context window] ..."
                    tail -100 "$file"
                    echo '```'
                else
                    echo "## FILE: $rel"
                    echo '```'
                    cat "$file"
                    echo '```'
                fi
                echo ""
            done

    } > "$output_file" 2>/dev/null

    local size
    size=$(wc -c < "$output_file" | tr -d ' ')
    local tokens=$(( size / 4 ))
    success "Snapshot: $(format_bytes "$size") (~${tokens} tokens)"
}

# ── Call Claude API with retry and cost tracking ──────────────────────────────
call_claude_api() {
    local model="$1"
    local system_prompt="$2"
    local user_content="$3"
    local use_web_search="${4:-false}"
    local max_tokens="${5:-16000}"

    local tools_json="[]"
    if [ "$use_web_search" = "true" ] && [ "$SKIP_WEB_RESEARCH" != "true" ]; then
        tools_json='[{"type":"web_search_20250305","name":"web_search","max_uses":5}]'
    fi

    # Truncate if approaching context limit (~900K tokens)
    local max_chars=3600000
    if [ "${#user_content}" -gt "$max_chars" ]; then
        warn "  Content exceeds context window. Truncating to ${max_chars} chars."
        user_content="${user_content:0:$max_chars}
[TRUNCATED — above content represents the most important portions of the codebase]"
    fi

    local payload
    payload=$(jq -n \
        --arg model "$model" \
        --arg system "$system_prompt" \
        --arg content "$user_content" \
        --argjson tools "$tools_json" \
        --argjson max_tokens "$max_tokens" \
        '{model:$model,max_tokens:$max_tokens,system:$system,messages:[{role:"user",content:$content}],tools:$tools}')

    # Exponential backoff: 30s, 60s, 120s
    local wait_times=(30 60 120)
    local response="" attempt=0

    while [ $attempt -lt 3 ]; do
        response=$(curl -s --max-time 600 "https://api.anthropic.com/v1/messages" \
            -H "Content-Type: application/json" \
            -H "x-api-key: ${ANTHROPIC_API_KEY}" \
            -H "anthropic-version: 2023-06-01" \
            -d "$payload" 2>/dev/null)

        local err
        err=$(echo "$response" | jq -r '.error.type // empty' 2>/dev/null || echo "")

        if [ -z "$err" ]; then
            break
        elif [ "$err" = "overloaded_error" ] || [ "$err" = "rate_limit_error" ]; then
            local wait="${wait_times[$attempt]:-120}"
            warn "  ${err} (attempt $((attempt+1))/3). Waiting ${wait}s..."
            sleep "$wait"
        else
            error "  API error: $(echo "$response" | jq -r '.error.message // "unknown"' 2>/dev/null)"
            break
        fi
        attempt=$(( attempt + 1 ))
    done

    # Token tracking and cost calculation
    local in_tok out_tok cost
    in_tok=$(echo  "$response" | jq '.usage.input_tokens  // 0' 2>/dev/null || echo "0")
    out_tok=$(echo "$response" | jq '.usage.output_tokens // 0' 2>/dev/null || echo "0")
    TOTAL_INPUT_TOKENS=$(( TOTAL_INPUT_TOKENS + in_tok ))
    TOTAL_OUTPUT_TOKENS=$(( TOTAL_OUTPUT_TOKENS + out_tok ))

    if   [[ "$model" == *"opus"*   ]]; then cost=$(echo "scale=4; ($in_tok * $OPUS_INPUT_RATE)   + ($out_tok * $OPUS_OUTPUT_RATE)"   | bc)
    elif [[ "$model" == *"sonnet"* ]]; then cost=$(echo "scale=4; ($in_tok * $SONNET_INPUT_RATE) + ($out_tok * $SONNET_OUTPUT_RATE)" | bc)
    else                                    cost=$(echo "scale=4; ($in_tok * $HAIKU_INPUT_RATE)  + ($out_tok * $HAIKU_OUTPUT_RATE)"  | bc)
    fi

    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + $cost" | bc)
    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + $cost" | bc)

    log "    ${in_tok} in / ${out_tok} out | +\$${cost} | Total: \$${ESTIMATED_SPEND}"
    echo "$response"
}

# ── Decompose codebase into modules ───────────────────────────────────────────
decompose_modules() {
    local snapshot_file="$1"
    local output_file="$2"

    log "Decomposing codebase into modules (${DECOMP_MODEL})..."

    local sys='You are a principal software architect decomposing a construction PM SaaS platform into logical modules for independent deep auditing.

Rules:
- Every source file belongs to exactly ONE module
- Include a "ui-design-system" module if any frontend code exists
- Include an "infrastructure-config" module for CI/CD, Docker, config files
- Keep modules cohesive — group by domain and responsibility, not file type
- Priority 1 = most critical to the business (lower number = higher priority)

Output ONLY valid JSON (no markdown, no backticks, no explanation):
{"modules":[{"name":"kebab-case-name","files":["relative/path/file.ts"],"responsibilities":"one clear sentence describing what this module owns","dependencies":["other-module-name"],"priority":1}]}'

    # Only send first 500K chars for decomposition (saves cost)
    local content
    content=$(head -c 500000 "$snapshot_file")

    local resp text
    resp=$(call_claude_api "$DECOMP_MODEL" "$sys" "$content" "false" "8000")
    text=$(extract_text "$resp")

    # Robust JSON extraction with multiple fallback strategies
    if   echo "$text" | jq '.'               > "$output_file" 2>/dev/null; then true
    elif echo "$text" | grep -o '{.*}'       | head -1 | jq '.' > "$output_file" 2>/dev/null; then warn "  Used grep fallback for module JSON"
    else
        warn "  Module decomposition failed — using single full-codebase module"
        echo '{"modules":[{"name":"full-codebase","files":["*"],"responsibilities":"Entire SiteSyncAI codebase","dependencies":[],"priority":1}]}' > "$output_file"
    fi

    local count
    count=$(jq '.modules | length' "$output_file" 2>/dev/null || echo "1")
    success "Decomposed into ${count} modules (sorted by priority):"
    jq -r '.modules | sort_by(.priority) | .[] | "  [P\(.priority)] \(.name): \(.responsibilities)"' \
        "$output_file" 2>/dev/null | head -20 || true
}

# ── Deep audit one module ─────────────────────────────────────────────────────
audit_module() {
    local mod_name="$1" mod_files="$2" mod_desc="$3"
    local snapshot_file="$4" cycle_num="$5" prev_issues="${6:-none}" output_file="$7"

    log "  Auditing: ${BOLD}${mod_name}${NC}"

    local ui_dim=""
    [ "$INCLUDE_UI" = "true" ] && ui_dim='
13. UI/UX DESIGN — Apple-level simplicity? Zero learning curve? Intuitive for a superintendent on day 1? Makes Procore look like it was built in 2005? Design system consistency? Micro-interactions? Mobile-first? Accessible (WCAG 2.1 AA)? Does every screen have a clear purpose and a clear next action?'

    local prev_section=""
    [ "$prev_issues" != "none" ] && prev_section="
UNRESOLVED FROM LAST CYCLE — address these FIRST before identifying new issues:
${prev_issues}
"

    # Inject founder feedback as highest-priority context
    local feedback_section=""
    if [ -f "$FEEDBACK_FILE" ] && [ -s "$FEEDBACK_FILE" ]; then
        feedback_section="
FOUNDER PRIORITIES (Walker Benner, SiteSyncAI — treat as P0, address before anything else):
$(cat "$FEEDBACK_FILE")
"
    fi

    local sys='You are the most elite software architect alive. You have built production systems at Apple, Stripe, Linear, Vercel, and SpaceX. You are conducting a zero-compromise, brutally honest audit of SiteSyncAI — a construction project management platform.

SiteSyncAI MUST be categorically ahead of Procore, Autodesk Construction Cloud, PlanGrid, Buildertrend, CoConstruct, and Fieldwire in every single dimension. This platform must be enterprise-grade (10K+ concurrent users, 99.99% uptime, SOC2-ready), AI-native (agents woven into every workflow), real-time (live collaboration, offline-first), and so beautiful and simple that a $500M general contractor switches overnight.

MODULE: '"${mod_name}"' — '"${mod_desc}"'
CYCLE: '"${cycle_num}"'
'"${feedback_section}"'
'"${prev_section}"'

AUDIT DIMENSIONS (score each 1-100, be RUTHLESSLY honest — 60 means "embarrassing", 80 means "good", 95 means "world-class"):
1.  ARCHITECTURE & SCALABILITY      — Handles 10K+ users? Event-driven? CQRS? DDD? Horizontally scalable? No SPOFs?
2.  CODE QUALITY                    — Strict TypeScript? SOLID? DRY? Error handling? Self-documenting? Zero tech debt?
3.  SECURITY                        — OWASP Top 10? RBAC/ABAC? SOC2-ready? Encryption everywhere? No exposed secrets?
4.  PERFORMANCE                     — P99 < 200ms? Indexed queries? Redis caching? Code splitting? Zero N+1 queries?
5.  REAL-TIME & OFFLINE             — WebSocket/SSE? CRDTs? Optimistic UI? Conflict resolution? Works offline on a job site?
6.  AI INTEGRATION                  — Autonomous agents? Predictive scheduling? Digital twins? NLP? AI woven in, not bolted on?
7.  TESTING & RELIABILITY           — >80% coverage? Unit + integration + E2E? Error boundaries? Observability? Alerting?
8.  DEVELOPER EXPERIENCE            — API-first? OpenAPI docs? CI/CD? Migration strategy? Easy to onboard new engineers?
9.  CONSTRUCTION DOMAIN DEPTH       — RFIs? Submittals? Change orders? BIM/IFC? Safety logs? Daily logs? CPM scheduling? Lien waivers?
10. COMPETITIVE DIFFERENTIATION     — What is the one thing that makes a GC switch from Procore overnight? Is it here?
11. DATA & INTEGRATIONS             — Webhooks? Procore migration path? QuickBooks/Sage/Foundation? BIM (IFC/Revit/Navisworks)?
12. FINANCIAL ENGINE                — Job costing? Budget vs actual? AIA G702/G703 billing? Cash flow forecasting? Earned value?'"${ui_dim}"'

SEARCH THE WEB to benchmark against Procore, Autodesk Construction Cloud, Buildertrend, Fieldwire, and PlanGrid. Find what they do best. Find their gaps. Find what nobody does yet that SiteSyncAI can own.

OUTPUT ONLY VALID JSON (no markdown, no backticks, no explanation before or after):
{
  "module": "'"${mod_name}"'",
  "cycle": '"${cycle_num}"',
  "scores": {
    "architecture":          {"score": 0, "rationale": "specific evidence from the code"},
    "code_quality":          {"score": 0, "rationale": "specific evidence from the code"},
    "security":              {"score": 0, "rationale": "specific evidence from the code"},
    "performance":           {"score": 0, "rationale": "specific evidence from the code"},
    "realtime":              {"score": 0, "rationale": "specific evidence from the code"},
    "ai_integration":        {"score": 0, "rationale": "specific evidence from the code"},
    "testing":               {"score": 0, "rationale": "specific evidence from the code"},
    "developer_experience":  {"score": 0, "rationale": "specific evidence from the code"},
    "construction_domain":   {"score": 0, "rationale": "specific evidence from the code"},
    "competitive_diff":      {"score": 0, "rationale": "specific evidence from the code"},
    "data_integrations":     {"score": 0, "rationale": "specific evidence from the code"},
    "financial_engine":      {"score": 0, "rationale": "specific evidence from the code"}'"$([ "$INCLUDE_UI" = "true" ] && echo ', "ui_ux": {"score": 0, "rationale": "specific evidence from the code"}')"'
  },
  "overall_score": 0,
  "issues": [
    {
      "id": "'"${mod_name}"'-C'"${cycle_num}"'-001",
      "severity": "critical|high|medium",
      "dimension": "architecture|security|performance|realtime|ai_integration|testing|construction_domain|ui_ux|...",
      "title": "Short imperative title",
      "description": "Precise problem description with specific file names and line references from the actual code.",
      "files_affected": ["src/path/to/file.ts"],
      "prompt": "You are working on SiteSyncAI, an AI-native construction PM platform built with React 19 + TypeScript + Vite. [COMPLETE self-contained Claude Code prompt that includes: exact file paths, specific function or component names, what to build and why it matters for construction GCs, patterns from the existing codebase to follow, and concrete acceptance criteria that verify the fix is done correctly.]"
    }
  ],
  "competitive_intel": {
    "procore_advantage": "what Procore does better right now",
    "autodesk_advantage": "what Autodesk does better right now",
    "our_unique_opportunity": "what nobody does yet that we can own"
  },
  "technology_upgrades": [
    {
      "current": "what is being used now",
      "recommended": "what to upgrade to",
      "impact": "concrete measurable improvement",
      "why": "reason in context of construction PM",
      "prompt": "Complete self-contained Claude Code prompt for this upgrade"
    }
  ]
}'

    local content="Audit the ${mod_name} module. Relevant files: ${mod_files}.

$(cat "$snapshot_file")"

    local resp text
    resp=$(call_claude_api "$AUDIT_MODEL" "$sys" "$content" "true" "16000")
    echo "$resp" > "${output_file%.json}_raw.json"
    text=$(extract_text "$resp")

    # Robust JSON extraction
    if   echo "$text" | jq '.'               > "$output_file" 2>/dev/null; then true
    elif echo "$text" | sed -n '/^{/,/^}/p'  | jq '.' > "$output_file" 2>/dev/null; then warn "    Used sed fallback for audit JSON"
    else
        warn "    Could not parse audit JSON for ${mod_name}"
        echo "{\"module\":\"${mod_name}\",\"cycle\":${cycle_num},\"overall_score\":0,\"issues\":[],\"technology_upgrades\":[],\"parse_error\":true}" > "$output_file"
    fi

    local score issues techs
    score=$(jq  '.overall_score         // 0' "$output_file" 2>/dev/null || echo "0")
    issues=$(jq '.issues | length'           "$output_file" 2>/dev/null || echo "0")
    techs=$(jq  '.technology_upgrades | length' "$output_file" 2>/dev/null || echo "0")

    # Persist scores for trending (file-based, bash 3 compatible)
    local score_file="${SCORES_DIR}/${mod_name}.txt"
    if [ ! -f "$score_file" ]; then
        echo "${cycle_num}:${score}" > "$score_file"   # first score
    fi
    echo "latest:${score}" >> "$score_file"            # always update latest

    log "    Score: ${score}/100 | Issues: ${issues} | Tech upgrades: ${techs}"
}

# ── Execute prompts via Claude Code ───────────────────────────────────────────
execute_prompts() {
    local audit_file="$1" cycle_num="$2" log_dir="$3"
    mkdir -p "$log_dir"

    [ "$DRY_RUN" = "true" ] && { warn "  DRY RUN — skipping execution"; return 0; }

    local pf="${log_dir}/prompts.json"

    # Merge issues + tech upgrades, sort by severity, cap at MAX_ISSUES_PER_MODULE
    jq --argjson max "$MAX_ISSUES_PER_MODULE" '
        [
          (.issues           // [] | to_entries[] | {i:.key, type:"issue", id:.value.id,              sev:(.value.severity//"medium"), title:.value.title,               prompt:.value.prompt}),
          (.technology_upgrades // [] | to_entries[] | {i:.key, type:"tech",  id:("TECH-"+(.key|tostring)), sev:"high",                 title:(.value.recommended//"upgrade"), prompt:.value.prompt})
        ]
        | sort_by(if .sev=="critical" then 0 elif .sev=="high" then 1 else 2 end)
        | .[:$max]
    ' "$audit_file" > "$pf" 2>/dev/null || { echo "[]" > "$pf"; return 1; }

    local total
    total=$(jq 'length' "$pf")
    [ "$total" -eq 0 ] && { success "  Zero prompts — module is clean"; return 0; }

    log "  Executing ${total} prompts (cap: ${MAX_ISSUES_PER_MODULE}/module)..."
    local ok=0 fail=0 skip=0

    for i in $(seq 0 $(( total - 1 ))); do
        [ "$_INTERRUPTED" = true ] && { skip=$(( total - i )); break; }

        # Budget check
        if (( $(echo "$ESTIMATED_SPEND >= $MAX_SPEND" | bc -l 2>/dev/null || echo "0") )); then
            warn "  Budget limit reached (\$${ESTIMATED_SPEND}/\$${MAX_SPEND}). Stopping."
            skip=$(( total - i ))
            break
        fi

        local id title sev prompt plog
        id=$(jq -r    ".[$i].id"    "$pf")
        title=$(jq -r ".[$i].title" "$pf")
        sev=$(jq -r   ".[$i].sev"   "$pf")
        prompt=$(jq -r ".[$i].prompt" "$pf")
        plog="${log_dir}/exec_${i}_${id}.log"

        log "    [$(( i+1 ))/${total}] ${sev^^}: ${title}"

        if [ -z "$prompt" ] || [ "$prompt" = "null" ]; then
            warn "      No prompt — skipping"
            skip=$(( skip + 1 ))
            continue
        fi

        local attempt=0 done_ok=false
        while [ $attempt -lt 2 ] && [ "$done_ok" = false ]; do
            attempt=$(( attempt + 1 ))
            if cd "$PROJECT_DIR" && claude -p "$prompt" \
                --permission-mode auto \
                --model "$CODE_MODEL" \
                --max-turns 25 \
                > "$plog" 2>&1; then
                done_ok=true
                ok=$(( ok + 1 ))
                success "      Done"
                LAST_SNAPSHOT_HASH=""   # Force re-snapshot after any code change
            else
                if [ $attempt -lt 2 ]; then
                    warn "      Failed. Retrying in 5s..."
                    sleep 5
                else
                    error "      Failed after 2 attempts. Log: ${plog}"
                    fail=$(( fail + 1 ))
                fi
            fi
        done
        sleep 2   # Brief pause between prompts to avoid rate limits
    done

    log "  Results: ${ok} done | ${fail} failed | ${skip} skipped"
}

# ── Build and test verification ────────────────────────────────────────────────
verify_build() {
    local cdir="$1"

    # Build check
    if [ -n "$BUILD_CMD" ]; then
        log "  Verifying build: ${BUILD_CMD}"
        if cd "$PROJECT_DIR" && eval "$BUILD_CMD" > "${cdir}/build.log" 2>&1; then
            success "  Build passed"
        else
            warn "  Build failed after changes. Auto-fixing..."
            local build_errors
            build_errors=$(tail -80 "${cdir}/build.log" 2>/dev/null)
            local fix_prompt="You are working on SiteSyncAI, a React 19 + TypeScript + Vite construction PM platform.

The build is failing after recent automated changes. Diagnose and fix ALL build errors. Do not remove features — only fix compilation and type errors.

Build command: ${BUILD_CMD}
Build errors (last 80 lines):
${build_errors}

Fix all TypeScript errors, missing imports, type mismatches, and syntax errors. Verify the fix by noting what specifically was wrong and what you changed."

            if cd "$PROJECT_DIR" && claude -p "$fix_prompt" \
                --permission-mode auto \
                --model "$CODE_MODEL" \
                --max-turns 15 \
                > "${cdir}/build_fix.log" 2>&1; then
                if eval "$BUILD_CMD" > "${cdir}/build_verify.log" 2>&1; then
                    success "  Build fixed automatically"
                    LAST_SNAPSHOT_HASH=""   # Snapshot changed
                else
                    error "  Build still failing after auto-fix. See: ${cdir}/build_fix.log"
                fi
            fi
        fi
    fi

    # Test check
    if [ -n "$TEST_CMD" ]; then
        log "  Running tests: ${TEST_CMD}"
        if cd "$PROJECT_DIR" && eval "$TEST_CMD" > "${cdir}/test.log" 2>&1; then
            success "  Tests passed"
        else
            warn "  Some tests failed. See: ${cdir}/test.log"
        fi
    fi
}

# ── Verify changes after execution ────────────────────────────────────────────
verify_changes() {
    local audit_file="$1" verify_file="$2" snapshot_file="$3"
    log "  Verifying changes..."

    local sys='You are verifying that recent code changes correctly addressed the audit findings. Be precise and evidence-based — only mark "fixed" if the specific issue was actually resolved.

Output ONLY valid JSON:
{
  "results": [
    {"id":"ISSUE-ID","status":"fixed|partial|not_fixed","notes":"Specific evidence: what changed and whether it addresses the issue"}
  ],
  "regressions": [
    {"description":"New problem introduced by the changes","file":"src/...","prompt":"Complete self-contained Claude Code prompt to fix this regression without reintroducing the original issue"}
  ],
  "summary": {"fixed":0,"partial":0,"not_fixed":0,"regressions":0}
}'

    local content="ORIGINAL AUDIT FINDINGS:
$(cat "$audit_file")

CURRENT CODEBASE STATE (post-execution):
$(head -c 2000000 "$snapshot_file")"

    local resp text
    resp=$(call_claude_api "$AUDIT_MODEL" "$sys" "$content" "false" "8000")
    text=$(extract_text "$resp")

    echo "$text" | jq '.' > "$verify_file" 2>/dev/null || \
        echo '{"results":[],"regressions":[],"summary":{"fixed":0,"partial":0,"not_fixed":0,"regressions":0}}' > "$verify_file"

    local f p n r
    f=$(jq '.summary.fixed        // 0' "$verify_file" 2>/dev/null || echo "?")
    p=$(jq '.summary.partial      // 0' "$verify_file" 2>/dev/null || echo "?")
    n=$(jq '.summary.not_fixed    // 0' "$verify_file" 2>/dev/null || echo "?")
    r=$(jq '.summary.regressions  // 0' "$verify_file" 2>/dev/null || echo "?")
    log "    Fixed: ${f} | Partial: ${p} | Not fixed: ${n} | Regressions: ${r}"

    # Auto-fix regressions
    local rc
    rc=$(jq '.regressions | length' "$verify_file" 2>/dev/null || echo "0")
    if [ "$rc" -gt 0 ] && [ "$DRY_RUN" != "true" ]; then
        warn "    Auto-fixing ${rc} regression(s)..."
        for ri in $(seq 0 $(( rc - 1 ))); do
            local rp
            rp=$(jq -r ".regressions[$ri].prompt" "$verify_file" 2>/dev/null || echo "")
            if [ -n "$rp" ] && [ "$rp" != "null" ]; then
                cd "$PROJECT_DIR" && claude -p "$rp" \
                    --permission-mode auto \
                    --model "$CODE_MODEL" \
                    > /dev/null 2>&1 || true
                LAST_SNAPSHOT_HASH=""
            fi
        done
    fi
}

# ── Send completion webhook notification ──────────────────────────────────────
notify_completion() {
    local status="$1"
    [ -z "$NOTIFY_WEBHOOK" ] && return 0

    local result_text
    result_text=$([ "$ALL_CLEAN" = "true" ] && echo "Zero issues remaining" || echo "Stopped with remaining issues")

    local payload
    payload=$(jq -n \
        --arg status "$status" \
        --arg cycles "$CYCLE" \
        --arg spend "$ESTIMATED_SPEND" \
        --arg elapsed "$(elapsed)" \
        --arg result "$result_text" \
        --arg run_dir "$RUN_DIR" \
        '{
            text: "SiteSyncAI Engine \($status) | \($cycles) cycles | $\($spend) | \($elapsed) | \($result)",
            details: {status: $status, cycles: $cycles, spend: $spend, elapsed: $elapsed, run_dir: $run_dir}
        }')

    curl -s -X POST "$NOTIFY_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null 2>&1 || true
}

# ── Generate final report ─────────────────────────────────────────────────────
generate_report() {
    local report="${RUN_DIR}/REPORT.md"
    local result_label
    if   [ "$_INTERRUPTED" = "true" ]; then result_label="INTERRUPTED"
    elif [ "$ALL_CLEAN"    = "true" ]; then result_label="CLEAN — ZERO ISSUES"
    else                                    result_label="IN PROGRESS"
    fi

    {
        echo "# SiteSyncAI Autonomous Improvement Engine — Report"
        echo ""
        echo "**Run:** ${TIMESTAMP}  |  **Elapsed:** $(elapsed)"
        echo ""
        echo "| Metric | Value |"
        echo "|--------|-------|"
        echo "| Status | ${result_label} |"
        echo "| Cycles completed | ${CYCLE} of ${MAX_CYCLES} |"
        echo "| API spend | \$${ESTIMATED_SPEND} of \$${MAX_SPEND} |"
        echo "| Tokens | ${TOTAL_INPUT_TOKENS} input / ${TOTAL_OUTPUT_TOKENS} output |"
        echo "| Models | Audit: ${AUDIT_MODEL}, Code: ${CODE_MODEL}, Decomp: ${DECOMP_MODEL} |"
        echo ""

        # Score trending table
        if ls "${SCORES_DIR}"/*.txt &>/dev/null 2>/dev/null; then
            echo "## Score Trending"
            echo ""
            echo "| Module | Cycle 1 | Latest | Change |"
            echo "|--------|---------|--------|--------|"
            for score_file in "${SCORES_DIR}"/*.txt; do
                [ -f "$score_file" ] || continue
                local mod
                mod=$(basename "$score_file" .txt)
                local first_score latest_score delta=""
                first_score=$(grep -m1 '^[0-9]' "$score_file" | cut -d: -f2 || echo "N/A")
                latest_score=$(grep 'latest:' "$score_file" | tail -1 | cut -d: -f2 || echo "N/A")
                if [ "$first_score" != "N/A" ] && [ "$latest_score" != "N/A" ]; then
                    local diff=$(( latest_score - first_score ))
                    if   [ $diff -gt 0 ]; then delta="**+${diff}** ↑"
                    elif [ $diff -lt 0 ]; then delta="${diff} ↓"
                    else                       delta="—"
                    fi
                fi
                echo "| ${mod} | ${first_score} | ${latest_score} | ${delta} |"
            done
            echo ""
        fi

        # Per-cycle details
        for c in $(seq 1 "$CYCLE"); do
            echo "## Cycle ${c}"
            local cycle_issues=0
            for af in "${RUN_DIR}/cycle_${c}"/audit_*.json; do
                [ -f "$af" ] || continue
                local mname score issues
                mname=$(basename "$af" .json | sed 's/audit_//')
                score=$(jq  '.overall_score // 0'   "$af" 2>/dev/null || echo "?")
                issues=$(jq '.issues | length'       "$af" 2>/dev/null || echo "?")
                echo "- **${mname}**: ${score}/100 — ${issues} issues found"
                cycle_issues=$(( cycle_issues + issues ))
            done
            local vf="${RUN_DIR}/cycle_${c}/verify_summary.txt"
            [ -f "$vf" ] && echo "*$(cat "$vf")*"
            echo ""
        done

        # Next steps
        echo "## Next Steps"
        echo ""
        echo "1. Review this report: \`cat ${RUN_DIR}/REPORT.md\`"
        echo "2. What changed:       \`cd ${PROJECT_DIR} && git log --oneline -10\`"
        echo "3. Test the app:       \`npm run dev\`"
        echo "4. Push when ready:    \`git push\`"
        if [ "$result_label" != "CLEAN — ZERO ISSUES" ]; then
            echo "5. Continue engine:    \`./autonomous_loop.sh ${PROJECT_DIR}\`"
        fi
        echo ""
        if [ -f "$FEEDBACK_FILE" ] && [ -s "$FEEDBACK_FILE" ]; then
            echo "> Update FEEDBACK.md with new priorities before the next run."
        fi

    } > "$report"

    success "Report written: ${report}"
    echo ""
    cat "$report"
}

# ── Main loop ─────────────────────────────────────────────────────────────────
main() {
    preflight

    header "SITESYNC AI — AUTONOMOUS IMPROVEMENT ENGINE v3.0"
    log "Goal: Zero actionable issues | Budget: \$${MAX_SPEND} | Max cycles: ${MAX_CYCLES}"
    log "Elapsed: $(elapsed)"

    local snapshot="${RUN_DIR}/snapshot.md"
    snapshot_codebase "$snapshot"

    local modules="${RUN_DIR}/modules.json"
    decompose_modules "$snapshot" "$modules"

    while [ "$CYCLE" -lt "$MAX_CYCLES" ] && [ "$ALL_CLEAN" = false ]; do
        [ "$_INTERRUPTED" = true ] && break

        CYCLE=$(( CYCLE + 1 ))
        CYCLE_SPEND="0.00"
        local cdir="${RUN_DIR}/cycle_${CYCLE}"
        mkdir -p "$cdir"

        header "CYCLE ${CYCLE}/${MAX_CYCLES}  ·  \$${ESTIMATED_SPEND}/\$${MAX_SPEND}  ·  $(date +%H:%M)  ·  $(elapsed) elapsed"

        # Budget check
        if (( $(echo "$ESTIMATED_SPEND >= $MAX_SPEND" | bc -l 2>/dev/null || echo "0") )); then
            warn "Budget limit hit (\$${ESTIMATED_SPEND}/\$${MAX_SPEND}). Stopping."
            break
        fi

        # Re-snapshot at start of each cycle (after cycle 1)
        [ "$CYCLE" -gt 1 ] && snapshot_codebase "$snapshot"

        local mod_count
        mod_count=$(jq '.modules | length' "$modules" 2>/dev/null || echo "1")
        local total_issues=0
        ALL_CLEAN=true

        for m in $(seq 0 $(( mod_count - 1 ))); do
            [ "$_INTERRUPTED" = true ] && break

            if (( $(echo "$ESTIMATED_SPEND >= $MAX_SPEND" | bc -l 2>/dev/null || echo "0") )); then
                warn "Budget hit mid-cycle."
                ALL_CLEAN=false
                break
            fi

            local mn mf md
            mn=$(jq -r ".modules[$m].name"                 "$modules")
            mf=$(jq -r ".modules[$m].files | join(\", \")" "$modules")
            md=$(jq -r ".modules[$m].responsibilities"     "$modules")

            # Skip listed modules
            if [ -n "$SKIP_MODULES" ] && echo ",$SKIP_MODULES," | grep -q ",${mn},"; then
                warn "  Skipping: ${mn} (in SKIP_MODULES)"
                continue
            fi

            # Get unresolved issues from previous cycle for this module
            local prev="none"
            if [ "$CYCLE" -gt 1 ]; then
                local pvf="${RUN_DIR}/cycle_$(( CYCLE - 1 ))/verify_${mn}.json"
                if [ -f "$pvf" ]; then
                    prev=$(jq -r '
                        [.results // [] | .[] | select(.status != "fixed")]
                        | if length > 0
                          then map("  - " + .id + " (" + .status + "): " + .notes) | join("\n")
                          else "none"
                          end
                    ' "$pvf" 2>/dev/null || echo "none")
                fi
            fi

            local af="${cdir}/audit_${mn}.json"
            audit_module "$mn" "$mf" "$md" "$snapshot" "$CYCLE" "$prev" "$af"

            local mi
            mi=$(jq '(.issues | length) + (.technology_upgrades | length)' "$af" 2>/dev/null || echo "0")
            total_issues=$(( total_issues + mi ))

            if [ "$mi" -gt 0 ]; then
                ALL_CLEAN=false
                execute_prompts "$af" "$CYCLE" "${cdir}/exec_${mn}"
                snapshot_codebase "$snapshot"    # Re-snapshot to capture changes
                verify_changes "$af" "${cdir}/verify_${mn}.json" "$snapshot"

                # Write per-cycle verify summary for report
                jq -r '"Fixed: \(.summary.fixed) | Partial: \(.summary.partial) | Not fixed: \(.summary.not_fixed) | Regressions: \(.summary.regressions)"' \
                    "${cdir}/verify_${mn}.json" 2>/dev/null \
                    >> "${cdir}/verify_summary.txt" || true
            else
                success "  ${mn}: CLEAN"
            fi
            echo ""
        done

        # Build and test verification at end of each cycle
        verify_build "$cdir"

        # Auto-commit cycle changes
        if [ -d "$PROJECT_DIR/.git" ] && [ "$DRY_RUN" != "true" ]; then
            cd "$PROJECT_DIR"
            local changes
            changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
            if [ "$changes" -gt 0 ]; then
                git add -A
                git commit -m "feat(engine): cycle ${CYCLE} — ${total_issues} issues | \$${CYCLE_SPEND}" \
                    2>/dev/null || true
                local commit_hash
                commit_hash=$(git log -1 --format='%h' 2>/dev/null || echo "?")
                success "Cycle ${CYCLE} committed: ${commit_hash}"
                git diff HEAD~1 --stat 2>/dev/null | head -15 || true
            else
                log "No file changes this cycle."
            fi
        fi

        # Cycle summary
        log "${BOLD}Cycle ${CYCLE} complete: ${total_issues} total issues | \$${CYCLE_SPEND} this cycle | \$${ESTIMATED_SPEND} total | $(elapsed) elapsed${NC}"
        log "Module scores:"
        for af in "${cdir}"/audit_*.json; do
            [ -f "$af" ] && log "  $(basename "$af" .json | sed 's/audit_//') → $(jq '.overall_score // 0' "$af" 2>/dev/null)/100"
        done

        [ "$ALL_CLEAN" = true ] && {
            header "ALL MODULES CLEAN — ZERO ACTIONABLE ISSUES"
            success "Completed in ${CYCLE} cycles | \$${ESTIMATED_SPEND} total | $(elapsed)"
        }
    done

    generate_report

    # Final git commit for any remaining uncommitted changes
    if [ -d "$PROJECT_DIR/.git" ] && [ "$DRY_RUN" != "true" ]; then
        cd "$PROJECT_DIR"
        local final_changes
        final_changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        if [ "$final_changes" -gt 0 ]; then
            git add -A
            git commit -m "feat(engine): run complete — ${CYCLE} cycles, \$${ESTIMATED_SPEND}" \
                2>/dev/null || true
        fi
        success "Run 'git push' to deploy when ready."
    fi

    notify_completion "$([ "$ALL_CLEAN" = "true" ] && echo "COMPLETE" || echo "STOPPED")"

    echo ""
    if   [ "$ALL_CLEAN" = "true" ];     then header "ENGINE COMPLETE — SITESYNCAI IS WORLD-CLASS"
    elif [ "$_INTERRUPTED" = "true" ];  then header "INTERRUPTED — ALL PROGRESS SAVED"
    else
        header "STOPPED — RUN AGAIN TO CONTINUE"
        log "  ./autonomous_loop.sh ${PROJECT_DIR}"
    fi
}

main "$@"
