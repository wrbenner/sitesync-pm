#!/bin/bash
###############################################################################
#
#  SITESYNC AI — AUTONOMOUS EVOLUTION ENGINE v6.0 "THE FOUNDER"
#  ═══════════════════════════════════════════════════════════════════════════
#
#  This engine doesn't think like a linter. It thinks like a founder who
#  just raised $50M and has one weekend to ship a demo that makes investors
#  cry. It doesn't fix bugs. It builds a company.
#
#  THREE MODES OF THINKING:
#
#  MODE 1: SURGEON (cycles 1-3)
#    Fix what's broken. TypeScript errors, missing states, bad UX. Fast,
#    surgical, build-verified. Get the house in order.
#
#  MODE 2: ARCHITECT (cycles 4-10)
#    Now think bigger. Redesign components for Google-level polish.
#    Add the data richness that makes PMs say "this is real software."
#    Wire up interactions that feel alive.
#
#  MODE 3: VISIONARY (cycles 11+)
#    Build features that don't exist anywhere. AI conflict detection.
#    One-tap RFIs. Cash flow dashboards. Things that make Procore look
#    like it was built in 2015. Because it was.
#
#  THE LOOP:
#    1. Snapshot codebase (git-hash cached, skips if nothing changed)
#    2. Read VISION.md + FEEDBACK.md — founder priorities become P0
#    3. Decompose into modules via Haiku (10x cheaper)
#    4. Determine thinking mode based on cycle + module maturity
#    5. Deep audit: 14 dimensions, sorted by what moves the needle most
#    6. Generate surgical Claude Code prompts (one file, BEFORE/AFTER)
#    7. Execute with timeout, rate limiting, circuit breaker
#    8. Build gate before AND after each module (never waste money)
#    9. Verify changes via git diff (not LLM — faster, cheaper, accurate)
#   10. Self-learn: track fix rates, adapt prompts, remember mistakes
#   11. Atomic commits after every successful change (never lose work)
#   12. HTML morning briefing with score trending and visual dashboard
#
#  USAGE:
#    chmod +x autonomous_loop.sh
#    export ANTHROPIC_API_KEY="sk-ant-..."
#    ./autonomous_loop.sh /path/to/sitesyncai
#
#  OVERNIGHT RUN (recommended):
#    tmux new -s engine
#    MAX_CYCLES=30 MAX_SPEND=500 ./autonomous_loop.sh /path/to/sitesyncai
#    # Ctrl+B, D — detach. Check morning: tmux attach -t engine
#
#  ENVIRONMENT VARIABLES (all optional):
#    MAX_CYCLES=20               Max audit-execute-verify cycles [20]
#    MAX_SPEND=500               Max estimated API spend in USD [500]
#    AUDIT_MODEL=claude-opus-4-6          Model for deep audits [opus]
#    CODE_MODEL=claude-sonnet-4-6         Model for Claude Code [sonnet]
#    DECOMP_MODEL=claude-haiku-4-5-20251001  Model for decomp [haiku]
#    LOG_DIR=./engine-logs       Where logs and reports are saved
#    SKIP_WEB_RESEARCH=true      Skip competitive research [true]
#    INCLUDE_UI=true             Include UI/UX in audits [true]
#    DRY_RUN=false               Audit without touching code [false]
#    BUILD_CMD=""                Build command (auto-detected from package.json)
#    TEST_CMD=""                 Test command (auto-detected from package.json)
#    SKIP_MODULES=""             Comma-separated module names to skip
#    FEEDBACK_FILE=""            Feedback file path [PROJECT_DIR/FEEDBACK.md]
#    VISION_FILE=""              Vision file path [PROJECT_DIR/VISION.md]
#    NOTIFY_WEBHOOK=""           Webhook for completion notification
#    MAX_ISSUES_PER_MODULE=5     Cap issues per module per cycle [5]
#    PROMPT_COOLDOWN=5           Seconds between Claude Code calls [5]
#    PROMPT_TIMEOUT=300          Timeout per Claude Code call in seconds [300]
#    INVENTION_MODE=true         Enable new feature invention in late cycles [true]
#    RESUME=false                Resume last incomplete run [false]
#    AUTO_GIT_TAG=true           Auto-tag major milestones in git [true]
#
###############################################################################

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_DIR="${1:?Usage: ./autonomous_loop.sh /path/to/project}"
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

MAX_CYCLES="${MAX_CYCLES:-20}"
[ "${MAX_CYCLES:-0}" -lt 1 ] && MAX_CYCLES=1
MAX_SPEND="${MAX_SPEND:-500}"
AUDIT_MODEL="${AUDIT_MODEL:-claude-opus-4-6}"
CODE_MODEL="${CODE_MODEL:-claude-sonnet-4-6}"
DECOMP_MODEL="${DECOMP_MODEL:-claude-haiku-4-5-20251001}"
LOG_DIR="${LOG_DIR:-./engine-logs}"
SKIP_WEB_RESEARCH="${SKIP_WEB_RESEARCH:-true}"
INCLUDE_UI="${INCLUDE_UI:-true}"
DRY_RUN="${DRY_RUN:-false}"
BUILD_CMD="${BUILD_CMD:-}"
TEST_CMD="${TEST_CMD:-}"
SKIP_MODULES="${SKIP_MODULES:-}"
FEEDBACK_FILE="${FEEDBACK_FILE:-$PROJECT_DIR/FEEDBACK.md}"
VISION_FILE="${VISION_FILE:-$PROJECT_DIR/VISION.md}"
NOTIFY_WEBHOOK="${NOTIFY_WEBHOOK:-}"
MAX_ISSUES_PER_MODULE="${MAX_ISSUES_PER_MODULE:-5}"
INVENTION_MODE="${INVENTION_MODE:-true}"
RESUME="${RESUME:-false}"
AUTO_GIT_TAG="${AUTO_GIT_TAG:-true}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$LOG_DIR"

# Resume: find last incomplete run if requested
if [ "$RESUME" = "true" ]; then
    LAST_RUN=$(ls -1d "${LOG_DIR}"/run_* 2>/dev/null | tail -1 || true)
    if [ -n "$LAST_RUN" ] && [ -f "${LAST_RUN}/state.json" ]; then
        RESUME_CYCLE=$(jq -r '.last_completed_cycle // 0' "${LAST_RUN}/state.json" 2>/dev/null || echo "0")
        RUN_DIR="$LAST_RUN"
        echo "Resuming from ${RUN_DIR} at cycle ${RESUME_CYCLE}"
    else
        RESUME_CYCLE=0
        RUN_DIR="${LOG_DIR}/run_${TIMESTAMP}"
        mkdir -p "$RUN_DIR"
    fi
else
    RESUME_CYCLE=0
    RUN_DIR="${LOG_DIR}/run_${TIMESTAMP}"
    mkdir -p "$RUN_DIR"
fi

# Tee all output to engine.log for post-run review
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
TOTAL_FILES_CHANGED=0
TOTAL_PROMPTS_EXECUTED=0
FEATURES_INVENTED=0

# Score tracking (file-based, bash 3 compatible)
SCORES_DIR="${RUN_DIR}/scores"
mkdir -p "$SCORES_DIR"

# State file for resume support
STATE_FILE="${RUN_DIR}/state.json"
echo '{"last_completed_cycle":0,"start_time":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$STATE_FILE"

# ── Signal handling — graceful Ctrl+C ─────────────────────────────────────────
_handle_interrupt() {
    _INTERRUPTED=true
    echo ""
    warn "Interrupted after cycle ${CYCLE}. Writing morning briefing..."
    generate_report "INTERRUPTED" 2>/dev/null || true
    notify_completion "INTERRUPTED" 2>/dev/null || true
    exit 130
}
trap '_handle_interrupt' INT TERM

# ── Pricing constants (March 2026) ────────────────────────────────────────────
# Opus 4.6:   $5  input / $25 output per 1M tokens
# Sonnet 4.6: $3  input / $15 output per 1M tokens
# Haiku 4.5:  $1  input / $5  output per 1M tokens
OPUS_INPUT_RATE="0.000005"
OPUS_OUTPUT_RATE="0.000025"
SONNET_INPUT_RATE="0.000003"
SONNET_OUTPUT_RATE="0.000015"
HAIKU_INPUT_RATE="0.000001"
HAIKU_OUTPUT_RATE="0.000005"

# ── Terminal colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

log()      { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1" >&2; }
success()  { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1" >&2; }
warn()     { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1" >&2; }
error()    { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1" >&2; }
invent()   { echo -e "${MAGENTA}[$(date +%H:%M:%S)] ✦ INVENTING:${NC} $1" >&2; }
header()   {
    echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════════════════════════════${NC}" >&2
    echo -e "${BOLD}${CYAN}  $1${NC}" >&2
    echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════════════${NC}\n" >&2
}
subheader() {
    echo -e "\n${BOLD}  ── $1 ──${NC}" >&2
}

# Startup manifesto — printed once, sets the tone for everything that follows
print_manifesto() {
    echo "" >&2
    echo -e "${BOLD}${CYAN}  ┌─────────────────────────────────────────────────────────────────┐${NC}" >&2
    echo -e "${BOLD}${CYAN}  │                                                                 │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │   SITESYNC AI — EVOLUTION ENGINE v6.0 "THE FOUNDER"            │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │                                                                 │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │   This engine does not rest. It does not compromise.           │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │   It reads your vision. It studies your competitors.           │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │   It finds every weakness and eliminates it.                   │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │   And when there is nothing left to fix, it invents.           │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │                                                                 │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │   Go to sleep, Walker. We have work to do.                    │${NC}" >&2
    echo -e "${BOLD}${CYAN}  │                                                                 │${NC}" >&2
    echo -e "${BOLD}${CYAN}  └─────────────────────────────────────────────────────────────────┘${NC}" >&2
    echo "" >&2
}

# ── Utility functions ─────────────────────────────────────────────────────────

# macOS-compatible byte formatter (no numfmt required)
format_bytes() {
    local bytes="$1"
    if   [ "$bytes" -gt 1073741824 ]; then echo "$(( bytes / 1073741824 ))G"
    elif [ "$bytes" -gt    1048576 ]; then echo "$(( bytes / 1048576 ))M"
    elif [ "$bytes" -gt       1024 ]; then echo "$(( bytes / 1024 ))K"
    else echo "${bytes}B"
    fi
}

# Human-readable elapsed time
elapsed() {
    local secs=$(( $(date +%s) - START_TIME ))
    printf "%dh %02dm %02ds" $(( secs / 3600 )) $(( secs % 3600 / 60 )) $(( secs % 60 ))
}

# Run a command with a timeout (seconds). Returns the command's exit code,
# or 124 on timeout. Usage: run_with_timeout 120 eval "$BUILD_CMD"
# Prevents any single build/test/deploy from hanging the entire engine.
BUILD_TIMEOUT="${BUILD_TIMEOUT:-120}"
TEST_TIMEOUT="${TEST_TIMEOUT:-180}"
DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-300}"

run_build() {
    # Runs BUILD_CMD with timeout. Args: extra flags to eval (optional)
    timeout "$BUILD_TIMEOUT" bash -c "cd \"$PROJECT_DIR\" && eval \"$BUILD_CMD\" $*"
}

run_tests() {
    # Runs TEST_CMD with timeout.
    timeout "$TEST_TIMEOUT" bash -c "cd \"$PROJECT_DIR\" && eval \"$TEST_CMD\" $*"
}

# Extract text from Claude API response (handles mixed content blocks)
extract_text() {
    echo "$1" | jq -r '[.content[] | select(.type=="text") | .text] | join("")' 2>/dev/null || echo ""
}

# Extract JSON object from text that might contain markdown fences or prose
# Uses awk for brace-depth tracking — handles nested objects, works without python/perl
extract_json() {
    local text="$1"
    local result

    # 1. Try direct parse first (ideal case: Claude returned raw JSON)
    result=$(printf '%s' "$text" | jq '.' 2>/dev/null) && printf '%s' "$result" && return 0

    # 2. Strip markdown fences and try again
    local stripped
    stripped=$(printf '%s' "$text" | sed 's/```json[[:space:]]*/\n/g; s/```[[:space:]]*/\n/g')
    result=$(printf '%s' "$stripped" | jq '.' 2>/dev/null) && printf '%s' "$result" && return 0

    # 3. Use awk to extract the outermost {...} block by tracking brace depth
    #    This handles cases where Claude adds preamble/postamble around the JSON
    local extracted
    extracted=$(printf '%s' "$text" | awk '
        BEGIN { found=0; depth=0; buf="" }
        {
            n = length($0)
            for (i = 1; i <= n; i++) {
                c = substr($0, i, 1)
                if (!found && c == "{") { found = 1; depth = 1; buf = c; continue }
                if (found) {
                    buf = buf c
                    if (c == "{") depth++
                    else if (c == "}") {
                        depth--
                        if (depth == 0) { print buf; exit }
                    }
                }
            }
            if (found) buf = buf "\n"
        }
    ')
    result=$(printf '%s' "$extracted" | jq '.' 2>/dev/null) && printf '%s' "$result" && return 0

    # 4. Nothing worked — return empty object
    printf '{}'
}

# Add spend from API response to running totals
accumulate_cost() {
    local response="$1"
    local model="$2"
    local in_tokens out_tokens input_rate output_rate cost

    in_tokens=$(echo "$response" | jq -r '.usage.input_tokens // 0' 2>/dev/null || echo "0")
    out_tokens=$(echo "$response" | jq -r '.usage.output_tokens // 0' 2>/dev/null || echo "0")

    if [[ "$model" == *"haiku"* ]]; then
        input_rate="$HAIKU_INPUT_RATE"; output_rate="$HAIKU_OUTPUT_RATE"
    elif [[ "$model" == *"sonnet"* ]]; then
        input_rate="$SONNET_INPUT_RATE"; output_rate="$SONNET_OUTPUT_RATE"
    else
        input_rate="$OPUS_INPUT_RATE"; output_rate="$OPUS_OUTPUT_RATE"
    fi

    cost=$(echo "scale=4; ($in_tokens * $input_rate) + ($out_tokens * $output_rate)" | bc 2>/dev/null || echo "0")

    TOTAL_INPUT_TOKENS=$(( TOTAL_INPUT_TOKENS + in_tokens ))
    TOTAL_OUTPUT_TOKENS=$(( TOTAL_OUTPUT_TOKENS + out_tokens ))
    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + $cost" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + $cost" | bc 2>/dev/null || echo "$CYCLE_SPEND")
}

# Call Claude API (with exponential backoff on rate limit / overload)
call_claude() {
    local model="$1"
    local prompt="$2"
    local max_tokens="${3:-8192}"
    local system_prompt="${4:-}"
    local tools_json="${5:-}"
    local attempt=0
    local max_attempts=4
    local backoff=30

    while [ $attempt -lt $max_attempts ]; do
        local payload
        if [ -n "$system_prompt" ]; then
            payload=$(jq -n \
                --arg model "$model" \
                --arg system "$system_prompt" \
                --arg prompt "$prompt" \
                --argjson max_tokens "$max_tokens" \
                '{model:$model,max_tokens:$max_tokens,system:$system,messages:[{role:"user",content:$prompt}]}')
        else
            payload=$(jq -n \
                --arg model "$model" \
                --arg prompt "$prompt" \
                --argjson max_tokens "$max_tokens" \
                '{model:$model,max_tokens:$max_tokens,messages:[{role:"user",content:$prompt}]}')
        fi

        # Add web search tool if requested
        if [ "$SKIP_WEB_RESEARCH" != "true" ] && [ -n "$tools_json" ]; then
            payload=$(echo "$payload" | jq --argjson tools "$tools_json" '. + {tools:$tools}')
        fi

        local response
        local http_code
        response=$(curl -s -w "\n__HTTP_CODE__%{http_code}" \
            https://api.anthropic.com/v1/messages \
            -H "x-api-key: ${ANTHROPIC_API_KEY}" \
            -H "anthropic-version: 2023-06-01" \
            -H "anthropic-beta: web-search-2025-03-05" \
            -H "content-type: application/json" \
            -d "$payload" 2>/dev/null)

        http_code=$(echo "$response" | tail -1 | sed 's/__HTTP_CODE__//')
        response=$(echo "$response" | sed '$d')

        if [ "$http_code" = "200" ]; then
            accumulate_cost "$response" "$model"
            echo "$response"
            return 0
        fi

        local err_type
        err_type=$(echo "$response" | jq -r '.error.type // "unknown"' 2>/dev/null || echo "unknown")

        if [ "$err_type" = "rate_limit_error" ] || [ "$err_type" = "overloaded_error" ] || [ "$http_code" = "529" ] || [ "$http_code" = "503" ]; then
            attempt=$(( attempt + 1 ))
            warn "API ${err_type} (attempt ${attempt}/${max_attempts}). Waiting ${backoff}s..."
            sleep "$backoff"
            backoff=$(( backoff * 2 ))
        else
            error "API error (HTTP ${http_code}): $(echo "$response" | jq -r '.error.message // "unknown"' 2>/dev/null)"
            return 1
        fi
    done

    error "API call failed after ${max_attempts} attempts"
    return 1
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────
preflight() {
    print_manifesto

    echo -e "${DIM}  Project:  ${NC}${BOLD}${PROJECT_DIR}${NC}" >&2
    echo -e "${DIM}  Run dir:  ${NC}${RUN_DIR}" >&2
    echo -e "${DIM}  Models:   ${NC}Audit=${AUDIT_MODEL} | Code=${CODE_MODEL} | Decomp=${DECOMP_MODEL}" >&2
    echo -e "${DIM}  Budget:   ${NC}${MAX_CYCLES} cycles max, \$${MAX_SPEND} spend limit" >&2
    echo -e "${DIM}  Mode:     ${NC}$([ "$DRY_RUN" = "true" ] && echo "DRY RUN (no code changes)" || echo "LIVE (will modify code)")" >&2
    echo "" >&2

    # API key
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        error "ANTHROPIC_API_KEY not set."
        echo "  Run: export ANTHROPIC_API_KEY='sk-ant-...'" >&2
        echo "  Get one at: https://console.anthropic.com/settings/keys" >&2
        exit 1
    fi
    success "API key configured"

    # Claude Code CLI
    if ! command -v claude &>/dev/null; then
        error "Claude Code CLI not found."
        echo "  Run: npm install -g @anthropic-ai/claude-code" >&2
        exit 1
    fi
    local cc_ver
    cc_ver=$(claude --version 2>/dev/null || echo "installed")
    cc_ver="${cc_ver%%$'\n'*}"
    success "Claude Code CLI: ${cc_ver}"

    # Required tools
    for tool in jq bc curl git python3; do
        if ! command -v "$tool" &>/dev/null; then
            error "${tool} not found. Install: brew install ${tool} (macOS) | apt-get install ${tool} (Linux)"
            exit 1
        fi
    done
    success "Required tools: jq, bc, curl, git"

    # Project directory
    if [ ! -d "$PROJECT_DIR" ]; then
        error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi

    # Auto-detect build/test commands from package.json
    if [ -z "$BUILD_CMD" ] && [ -f "$PROJECT_DIR/package.json" ]; then
        if jq -e '.scripts.build' "$PROJECT_DIR/package.json" &>/dev/null; then
            BUILD_CMD="npm run build"
            log "Auto-detected build command: ${BUILD_CMD}"
        fi
    fi
    if [ -z "$TEST_CMD" ] && [ -f "$PROJECT_DIR/package.json" ]; then
        if jq -e '.scripts.test' "$PROJECT_DIR/package.json" &>/dev/null; then
            TEST_CMD="npm test -- --watchAll=false"
            log "Auto-detected test command: ${TEST_CMD}"
        fi
    fi

    # Git health check
    if (cd "$PROJECT_DIR" && git rev-parse --git-dir &>/dev/null); then
        # Verify git isn't corrupted
        if ! (cd "$PROJECT_DIR" && git status &>/dev/null); then
            warn "Git index may be corrupted. Attempting repair..."
            (cd "$PROJECT_DIR" && rm -f .git/index.lock 2>/dev/null; git reset 2>/dev/null) || true
        fi
        local git_branch
        git_branch=$(cd "$PROJECT_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
        success "Git branch: ${git_branch}"

        # Create backup commit if there are uncommitted changes
        local git_status
        git_status=$(cd "$PROJECT_DIR" && git status --porcelain 2>/dev/null || true)
        if [ -n "$git_status" ]; then
            log "Committing working state before engine run..."
            (cd "$PROJECT_DIR" && git add src/ *.md *.json *.ts supabase/ public/ 2>/dev/null; \
             git add -A 2>/dev/null; \
             if ! git diff --cached --quiet 2>/dev/null; then \
                 git commit -m "engine: backup checkpoint before run ${TIMESTAMP}" 2>/dev/null; \
             fi) || true
            success "Backup commit created"
        fi
    fi

    # Load VISION.md
    if [ -f "$VISION_FILE" ]; then
        success "VISION.md found — product vision injected into all audits"
    else
        warn "VISION.md not found. Create it to direct the engine's invention work."
        warn "See COWORK_MASTER_INSTRUCTIONS.md for the template."
    fi

    # Load FEEDBACK.md
    if [ -f "$FEEDBACK_FILE" ]; then
        success "FEEDBACK.md found — founder priorities injected as P0"
    else
        warn "FEEDBACK.md not found. Create it to set your priorities."
    fi

    echo ""
}

# ── Codebase snapshot ─────────────────────────────────────────────────────────
take_snapshot() {
    local snapshot_file="${RUN_DIR}/snapshot_cycle${CYCLE:-0}.md"

    # Cache snapshot within a cycle — only re-snapshot at start of new cycle
    if [ -f "$snapshot_file" ]; then
        log "Snapshot cached for cycle ${CYCLE}"
        echo "$snapshot_file"
        return 0
    fi

    log "Taking codebase snapshot..."

    # Compute hash of source files to detect changes
    local current_hash
    current_hash=$(find "$PROJECT_DIR/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) 2>/dev/null | sort | xargs cat 2>/dev/null | (md5sum 2>/dev/null || md5 -q 2>/dev/null || echo "nohash") | head -1 | cut -d' ' -f1)

    # Skip if nothing changed since last snapshot
    if [ -n "$LAST_SNAPSHOT_HASH" ] && [ "$current_hash" = "$LAST_SNAPSHOT_HASH" ] && [ -f "${RUN_DIR}/snapshot_cycle$(( CYCLE - 1 )).md" ]; then
        log "Codebase unchanged since last snapshot — reusing"
        cp "${RUN_DIR}/snapshot_cycle$(( CYCLE - 1 )).md" "$snapshot_file"
        echo "$snapshot_file"
        return 0
    fi

    local tmp="${snapshot_file}.tmp"
    echo "# SITESYNC AI — CODEBASE SNAPSHOT" > "$tmp"
    echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$tmp"
    echo "Git: $(cd "$PROJECT_DIR" && git log --oneline -1 2>/dev/null || echo 'no git')" >> "$tmp"
    echo "" >> "$tmp"

    # Directory tree
    echo "## Directory Structure" >> "$tmp"
    echo '```' >> "$tmp"
    find "$PROJECT_DIR/src" -type f | \
        grep -E '\.(tsx|ts|js|json|css|md|sh)$' | \
        grep -v 'node_modules\|dist\|build\|\.next\|coverage' | \
        sort | sed "s|$PROJECT_DIR/||" >> "$tmp" 2>/dev/null || true
    echo '```' >> "$tmp"
    echo "" >> "$tmp"

    # File contents
    echo "## Source Files" >> "$tmp"
    local total_size=0
    local file_count=0

    while IFS= read -r file; do
        local rel_path="${file#$PROJECT_DIR/}"
        local file_size
        file_size=$(wc -c < "$file" 2>/dev/null || echo 0)
        total_size=$(( total_size + file_size ))
        file_count=$(( file_count + 1 ))

        echo "" >> "$tmp"
        echo "### ${rel_path}" >> "$tmp"
        echo '```'"${file##*.}" >> "$tmp"

        # Smart truncation: large files get first + last 200 lines
        local line_count
        line_count=$(wc -l < "$file" 2>/dev/null || echo 0)
        if [ "$line_count" -gt 600 ]; then
            head -300 "$file" >> "$tmp"
            echo "" >> "$tmp"
            echo "... [TRUNCATED: ${line_count} lines total] ..." >> "$tmp"
            echo "" >> "$tmp"
            tail -100 "$file" >> "$tmp"
        else
            cat "$file" >> "$tmp"
        fi
        echo '```' >> "$tmp"
    done < <(find "$PROJECT_DIR/src" -type f | \
        grep -E '\.(tsx|ts|js)$' | \
        grep -v 'node_modules\|dist\|build\|\.test\.\|\.spec\.' | \
        sort 2>/dev/null)

    # Also include key config files
    for cfg in package.json tsconfig.json vite.config.ts tailwind.config.js; do
        local cfg_path="${PROJECT_DIR}/${cfg}"
        if [ -f "$cfg_path" ]; then
            echo "" >> "$tmp"
            echo "### ${cfg}" >> "$tmp"
            echo '```json' >> "$tmp"
            cat "$cfg_path" >> "$tmp"
            echo '```' >> "$tmp"
        fi
    done

    mv "$tmp" "$snapshot_file"
    LAST_SNAPSHOT_HASH="$current_hash"

    local snap_size
    snap_size=$(wc -c < "$snapshot_file" 2>/dev/null || echo 0)
    success "Snapshot: ${file_count} files, $(format_bytes $snap_size)"
    echo "$snapshot_file"
}

# ── Read founder context + brain files ─────────────────────────────────────────
# The "brain": VISION.md, FEEDBACK.md, plus domain knowledge, competitive intel,
# design standards, module specs, and industry reference. All injected into every audit.
read_founder_context() {
    local context=""

    if [ -f "$VISION_FILE" ]; then
        context+="## PRODUCT VISION (Walker's north star — honor this above everything)\n\n"
        context+="$(cat "$VISION_FILE")\n\n"
    fi

    if [ -f "$FEEDBACK_FILE" ]; then
        context+="## FOUNDER PRIORITIES (P0 — address these first in every audit)\n\n"
        context+="$(cat "$FEEDBACK_FILE")\n\n"
    fi

    # Brain files — deep context the engine needs to make world-class decisions
    local brain_files=(
        "COMPETITORS.md:COMPETITIVE INTELLIGENCE (know the enemy)"
        "CONSTRUCTION_DOMAIN.md:CONSTRUCTION DOMAIN KNOWLEDGE (how the industry actually works)"
        "DESIGN_STANDARDS.md:DESIGN STANDARDS (what world-class UI looks like, enforce these rules)"
        "MODULE_SPECS.md:MODULE SPECIFICATIONS (what done looks like for each feature)"
        "INDUSTRY_REFERENCE.md:INDUSTRY REFERENCE (CSI codes, AIA forms, financial formulas, KPIs)"
        "BACKEND_ARCHITECTURE.md:BACKEND ARCHITECTURE (Supabase schema, RLS, edge functions, storage, real-time subscriptions)"
        "AUTH_SPECS.md:AUTHENTICATION SPECIFICATIONS (roles, permissions, RLS policies, auth flows, session management)"
        "API_SPECS.md:API SPECIFICATIONS (query patterns, React hooks, edge function endpoints, error handling)"
        "INTEGRATIONS.md:INTEGRATION SPECIFICATIONS (weather, Procore, calendar, email, SMS, AI providers)"
        "LEARNINGS.md:ENGINE LEARNINGS (what worked, what failed, fix rates, score trends from prior runs — use this to avoid repeating mistakes)"
        "PAGE_ACCEPTANCE_CRITERIA.md:PAGE ACCEPTANCE CRITERIA (GOSPEL — explicit definition of done for every page. Each numbered criterion is a test case. Violations are bugs. Score against these BEFORE the 14 dimensions.)"
        "VERIFICATION_TESTS.md:VERIFICATION TESTS (executable test specs for auth flows, RLS security, data integrity, and permission gates. After fixing auth/security/data issues, GENERATE and RUN the relevant test. A fix that compiles but fails verification is NOT fixed. RLS failures are P0 — stop everything.)"
        "PRODUCTION_ROADMAP.md:PRODUCTION ROADMAP (what to BUILD to reach shippable product. P0 items are dealbreakers — GCs will not sign without them. In ARCHITECT mode, pick the highest-priority unfinished P0 item for this module and implement it. In VISIONARY mode, build P1/P2 items. Each item has exact database schemas, edge function specs, file paths, and acceptance tests. Follow them precisely.)"
    )

    for entry in "${brain_files[@]}"; do
        local file="${entry%%:*}"
        local label="${entry#*:}"
        local filepath="${PROJECT_DIR}/${file}"

        if [ -f "$filepath" ]; then
            context+="## ${label}\n\n"
            context+="$(cat "$filepath")\n\n"
            success "Brain loaded: ${file}"
        fi
    done

    echo -e "$context"
}

# ── Module decomposition (Haiku — cost optimized) ─────────────────────────────
decompose_modules() {
    local snapshot_file="$1"
    local modules_file="${RUN_DIR}/modules.json"

    # Cache modules.json across cycles — only re-decompose if snapshot changed
    if [ -f "$modules_file" ]; then
        log "Module decomposition cached"
        echo "$modules_file"
        return 0
    fi

    log "Decomposing codebase into modules..."

    local prompt
    prompt="Decompose this React TypeScript construction PM app into 8-10 modules. Return ONLY JSON, no other text.

Directory:
$(grep -A 100 '## Directory Structure' "$snapshot_file" | head -80)

JSON format (start with { end with }):
{\"modules\":[{\"name\":\"ui-design-system\",\"label\":\"UI Design System\",\"description\":\"Design tokens, primitives, shared components\",\"files\":[\"src/styles/theme.ts\",\"src/components/Primitives.tsx\"],\"priority\":1}]}

Use these modules: ui-design-system, core-workflows (RFIs/submittals/change-orders/punch-list), financial-engine (budget/pay-apps), scheduling (gantt/phases), field-operations (daily-log/field-capture/crews), project-intelligence (AI-copilot), document-management (drawings/files), collaboration (meetings/directory), infrastructure (App.tsx/routing), auth-rbac (Supabase auth, roles, RLS, login/signup), database-api (Supabase client, hooks, real-time subscriptions), ai-features (edge functions for AI copilot, RFI drafter, schedule risk, conflict detection), integrations (weather API, file storage, PDF export, calendar sync, notifications)."

    local response
    response=$(call_claude "$DECOMP_MODEL" "$prompt" 4096)

    local text
    text=$(extract_text "$response")
    local modules_json
    modules_json=$(extract_json "$text")

    if echo "$modules_json" | jq '.modules' &>/dev/null; then
        echo "$modules_json" > "$modules_file"
        local count
        count=$(echo "$modules_json" | jq '.modules | length')
        success "Decomposed into ${count} modules"
    else
        warn "Decomposition failed, using fallback modules"
        cat > "$modules_file" << 'EOF'
{
  "modules": [
    {"name":"ui-design-system","label":"UI Design System","description":"Theme, primitives, shared components","files":[],"priority":1},
    {"name":"core-workflows","label":"Core Workflows","description":"RFIs, submittals, change orders, punch list. PAGE_ACCEPTANCE_CRITERIA pages: RFIs, Submittals, Change Orders, Punch List","files":[],"priority":1},
    {"name":"financial-engine","label":"Financial Engine","description":"Budget, financials, pay apps. PAGE_ACCEPTANCE_CRITERIA pages: Budget, Payment Applications","files":[],"priority":1},
    {"name":"task-management","label":"Task Management","description":"Tasks kanban board. PAGE_ACCEPTANCE_CRITERIA pages: Tasks","files":[],"priority":1},
    {"name":"scheduling","label":"Scheduling","description":"Schedule, lookahead, gantt. PAGE_ACCEPTANCE_CRITERIA pages: Schedule","files":[],"priority":2},
    {"name":"field-operations","label":"Field Operations","description":"Daily log, field capture, crews, safety. PAGE_ACCEPTANCE_CRITERIA pages: Daily Log, Field Capture, Safety","files":[],"priority":2},
    {"name":"documents-drawings","label":"Documents & Drawings","description":"Drawings, files, markup. PAGE_ACCEPTANCE_CRITERIA pages: Drawings","files":[],"priority":2},
    {"name":"people-collaboration","label":"People & Collaboration","description":"Directory, meetings, crews. PAGE_ACCEPTANCE_CRITERIA pages: Directory, Meetings","files":[],"priority":2},
    {"name":"project-intelligence","label":"Project Intelligence","description":"Dashboard, AI copilot, agents, insights. PAGE_ACCEPTANCE_CRITERIA pages: Dashboard","files":[],"priority":2},
    {"name":"infrastructure","label":"Infrastructure","description":"Routing, state, API, auth","files":[],"priority":3},
    {"name":"auth-rbac","label":"Authentication & RBAC","description":"Supabase Auth, profiles, roles, RLS, login/signup flows","files":["src/lib/supabase.ts","src/stores/authStore.ts"],"priority":1},
    {"name":"database-api","label":"Database & API Layer","description":"Supabase client, typed hooks, real-time subscriptions, optimistic updates","files":["src/lib/supabase.ts","src/types/database.ts","src/hooks/useSupabase.ts"],"priority":1},
    {"name":"ai-features","label":"AI Features","description":"Edge functions for copilot, RFI drafter, schedule risk, conflict detection","files":[],"priority":2},
    {"name":"integrations","label":"Integrations & Storage","description":"Weather API, file storage, PDF export, calendar sync, notifications","files":[],"priority":3}
  ]
}
EOF
    fi

    echo "$modules_file"
}

# ── Check if a module should be skipped ───────────────────────────────────────
should_skip_module() {
    local mod_name="$1"
    if [ -z "$SKIP_MODULES" ]; then return 1; fi
    IFS=',' read -ra skip_list <<< "$SKIP_MODULES"
    for s in "${skip_list[@]}"; do
        if [ "$(echo "$s" | tr -d '[:space:]')" = "$mod_name" ]; then return 0; fi
    done
    return 1
}

# ── Web search tool definition for Claude API ─────────────────────────────────
WEB_SEARCH_TOOLS='[{"type":"web_search_20250305","name":"web_search","max_uses":3}]'

# ── Deep audit of a module ────────────────────────────────────────────────────
audit_module() {
    local module_name="$1"
    local module_label="$2"
    local module_description="$3"
    local snapshot_file="$4"
    local cycle_dir="$5"
    local prior_issues="${6:-}"
    local founder_context="$7"
    local invention_eligible="${8:-false}"

    local audit_file="${cycle_dir}/audit_${module_name}.json"

    log "Auditing: ${module_label}..."

    # Get dynamic strategy context for this module (self-awareness)
    local strategy_context
    strategy_context=$(get_strategy_context "$module_name")

    # Build the snapshot section relevant to this module
    # Look up module's declared files from modules.json for targeted extraction
    local relevant_snapshot=""
    local modules_file="${RUN_DIR}/modules.json"
    if [ -f "$modules_file" ]; then
        local mod_files
        mod_files=$(jq -r --arg name "$module_name" '.modules[] | select(.name==$name) | .files[]? // empty' "$modules_file" 2>/dev/null)
        if [ -n "$mod_files" ]; then
            while IFS= read -r mf; do
                [ -z "$mf" ] && continue
                local section
                section=$(grep -A 80 "### ${mf}" "$snapshot_file" 2>/dev/null | head -80)
                if [ -n "$section" ]; then
                    relevant_snapshot+="${section}\n\n"
                fi
            done <<< "$mod_files"
        fi
    fi
    # Fall back: if module files didn't match, use module description keywords to find relevant sections
    if [ -z "$relevant_snapshot" ]; then
        relevant_snapshot=$(grep -A 100 "### src/" "$snapshot_file" 2>/dev/null | head -800 || head -800 "$snapshot_file")
    fi

    # v6.0: THINKING MODE — the engine adapts its mindset based on cycle and maturity
    local thinking_mode="surgeon"
    local mode_instructions=""
    if [ "$CYCLE" -le 3 ]; then
        thinking_mode="surgeon"
        mode_instructions="
## MODE: SURGEON (cycles 1-3)
You are a surgeon. Your job is to fix what is broken with minimal, precise cuts.
Focus ONLY on: TypeScript errors, missing loading/error/empty states, broken layouts,
incorrect calculations, missing ARIA attributes, mobile responsiveness gaps.
Do NOT add new features. Do NOT redesign anything. Fix and verify."
    elif [ "$CYCLE" -le 10 ]; then
        thinking_mode="architect"
        mode_instructions="
## MODE: ARCHITECT (cycles 4-10)
You are a world-class product architect. The bugs are fixed. Now BUILD real features.
TWO PRIORITIES in this mode:
1. PRODUCTION ROADMAP: Read PRODUCTION_ROADMAP.md. Pick the highest-priority unfinished P0 item
   relevant to this module and implement it. This means creating new files, installing npm packages,
   writing new edge functions, and creating database migrations. One P0 feature per cycle per module.
2. POLISH: After addressing any roadmap item, continue with Google-level visual polish, rich data,
   smooth interactions, and data richness.
You ARE allowed to create new files, new components, new services, new edge functions, and new
database migrations. You ARE allowed to install npm packages. The PRODUCTION_ROADMAP.md file has
exact specs including database schemas, file paths, and acceptance tests. Follow them precisely.
Make this feel like \$100M software that a GC would trust with a \$50M project."
    else
        thinking_mode="visionary"
        mode_instructions="
## MODE: VISIONARY (cycles 11+)
You are a visionary founder. P0 features are built. Now build the future.
FIRST: Check PRODUCTION_ROADMAP.md for any remaining P0 or P1 items. Build those first.
THEN: Study what Procore, Autodesk, Fieldwire, Buildertrend CANNOT do.
Build features that would make a \$500M GC write a check on the spot:

VISIONARY FEATURES TO CONSIDER (pick what fits this module):
- AI Conflict Detection: 'Excavation is 3 days behind. This pushes foundation into rain week.'
- One-Tap RFI: Photo + circle + send. No forms. AI extracts the details.
- Cash Flow Dashboard: Burn rate, invoice tracking, 30-day forecast with AI prediction.
- Smart Daily Standup: Three buttons (Passed/Ready/Behind) + photo + voice. 2 minutes.
- AI Schedule Risk: '47% chance of delay if weather hits Week 8'
- Crew Velocity: 'Your excavation crew is 2.3x faster than your average project'
- Meeting Intelligence: Auto-extract decisions, assign owners, suggest next attendees.
- Document Freshness: Auto-flag plans that are stale or need review.

Each invention must include a complete implementation prompt targeting ONE file.
Rate each: impact (1-10), buildability (1-10), wow-factor (1-10)."
    fi

    local invention_section=""
    if [ "$invention_eligible" = "true" ] && [ "$INVENTION_MODE" = "true" ]; then
        thinking_mode="visionary"
        invention_section="$mode_instructions"
    fi

    local prompt
    prompt="You are auditing the \"${module_label}\" module of a React TypeScript construction PM app (SiteSyncAI).

THINKING MODE: $(echo "$thinking_mode" | tr '[:lower:]' '[:upper:]')
${mode_instructions}

TASK: Score 14 dimensions. Find the ${MAX_ISSUES_PER_MODULE} most impactful issues. Write surgical fix prompts.

CRITICAL PROMPT RULES (follow exactly or fixes will fail):
- Each issue prompt MUST target exactly ONE file. Never ask to change multiple files in one prompt.
- Each prompt MUST start with: \"In the file [exact path], make these specific changes:\"
- Each prompt MUST include the exact function/component name to modify.
- Each prompt MUST describe the BEFORE state (what the code currently does) and AFTER state (what it should do).
- Each prompt MUST end with: \"After changes, run: npm run build to verify no TypeScript errors.\"
- In SURGEON mode ONLY: Do NOT generate prompts for new features. Focus on fixing bugs, improving types, adding states, improving UI polish, fixing calculations, adding ARIA attributes, improving mobile responsiveness.
- In ARCHITECT and VISIONARY modes: You ARE allowed to generate prompts that create new files, new components, new services, install npm packages, write edge functions, and create database migrations. Read PRODUCTION_ROADMAP.md for exact specs. Each prompt should still target ONE file, but you can generate multiple prompts that together implement a feature (e.g. prompt 1: create service file, prompt 2: create UI component, prompt 3: create edge function).
- In ALL modes: Do NOT generate prompts for \"add real-time collaboration\" or \"add offline sync\" — these already exist in the codebase.
- PAGE_ACCEPTANCE_CRITERIA.md is the source of truth for what 'done' means. It defines criteria per PAGE, not per engine module. When auditing a composite module (e.g. 'core-workflows' covers RFIs + submittals + change orders + punch list), find ALL matching page sections in the criteria doc and validate each one. Module-to-page mapping: core-workflows → RFIs, Submittals, Change Orders, Punch List | financial-engine → Budget, Payment Applications | scheduling → Schedule | field-operations → Daily Log, Field Capture, Safety | project-intelligence → Dashboard, AI Copilot | ui-design-system → Global Standards. Every numbered criterion is a P0 test case. Violations are bugs. Score against acceptance criteria FIRST, then the 14 dimensions.

CONTEXT:
${founder_context}

PRIOR UNRESOLVED (P0, fix first):
${prior_issues}

STRATEGY:
${strategy_context}

CODE:
${relevant_snapshot}

DIMENSIONS (score 0-100):
1. Visual Polish  2. Domain Depth  3. Data Richness  4. Interaction Quality
5. AI Integration  6. Mobile/Field-First  7. Performance  8. TypeScript Quality
9. Error Handling  10. Real-Time  11. Accessibility  12. Security
13. Differentiation  14. Enterprise Readiness

Start with { end with }. No other text. JSON only:
{
  \"module\": \"${module_name}\",
  \"scores\": {
    \"visual_polish\": 0, \"domain_depth\": 0, \"data_richness\": 0,
    \"interaction_quality\": 0, \"ai_integration\": 0, \"mobile_first\": 0,
    \"performance\": 0, \"typescript_quality\": 0, \"error_handling\": 0,
    \"realtime\": 0, \"accessibility\": 0, \"security\": 0,
    \"differentiation\": 0, \"enterprise_readiness\": 0
  },
  \"overall_score\": 0,
  \"issues\": [
    {
      \"id\": \"${module_name}-C${CYCLE}-001\",
      \"severity\": \"critical\",
      \"dimension\": \"visual_polish\",
      \"title\": \"Short title\",
      \"file\": \"src/pages/Example.tsx\",
      \"description\": \"What is wrong in under 50 words\",
      \"prompt\": \"In the file src/pages/Example.tsx, in the ExampleComponent function: [exact changes]. BEFORE: [current behavior]. AFTER: [desired behavior]. Run npm run build to verify.\"
    }
  ],
  \"invented_features\": [],
  \"competitive_intel\": \"Brief comparison\",
  \"summary\": \"One paragraph\"
}
${invention_section}"

    local tools_arg=""
    if [ "$SKIP_WEB_RESEARCH" != "true" ]; then
        tools_arg="$WEB_SEARCH_TOOLS"
    fi

    # ── STRIPE INTELLIGENCE: Multi-model routing ──
    # Route audit to the RIGHT model based on module maturity.
    # Low-scoring modules (<60) get Opus for deep architectural thinking.
    # Mid-scoring modules (60-85) get Sonnet for balanced analysis.
    # High-scoring modules (>85) get Haiku for fast polish checks (saves 10x cost).
    local audit_model_for_module="$AUDIT_MODEL"
    local latest_mod_score=50
    if [ -f "${SCORES_DIR}/${module_name}.txt" ]; then
        latest_mod_score=$(tail -1 "${SCORES_DIR}/${module_name}.txt" | tr -dc '0-9')
        [ -z "$latest_mod_score" ] && latest_mod_score=50
    fi
    if [ "$latest_mod_score" -lt 60 ] 2>/dev/null; then
        audit_model_for_module="claude-opus-4-6"
        log "  Model routing: Opus (score ${latest_mod_score} < 60, needs deep analysis)"
    elif [ "$latest_mod_score" -gt 85 ] 2>/dev/null; then
        audit_model_for_module="$DECOMP_MODEL"
        log "  Model routing: Haiku (score ${latest_mod_score} > 85, just needs polish)"
    else
        audit_model_for_module="${AUDIT_MODEL}"
        log "  Model routing: ${AUDIT_MODEL} (score ${latest_mod_score}, standard audit)"
    fi

    local response
    response=$(call_claude "$audit_model_for_module" "$prompt" 16384 "" "$tools_arg")

    # Save raw response for debugging
    echo "$response" > "${cycle_dir}/audit_${module_name}_raw.json"

    # Check for truncation (stop_reason: max_tokens)
    local stop_reason
    stop_reason=$(echo "$response" | jq -r '.stop_reason // "end_turn"' 2>/dev/null)
    if [ "$stop_reason" = "max_tokens" ]; then
        warn "${module_label}: response truncated (hit max_tokens) — attempting repair"
    fi

    local text
    text=$(extract_text "$response")
    local audit_json
    audit_json=$(extract_json "$text")

    # If extract_json returned {} and we were truncated, try to repair by closing the JSON
    if [ "$audit_json" = "{}" ] && [ "$stop_reason" = "max_tokens" ]; then
        log "Attempting truncated JSON repair..."
        local repaired
        repaired=$(printf '%s' "$text" | python3 -c '
import sys, json

text = sys.stdin.read()
idx = text.find("{")
if idx < 0:
    print("{}")
    sys.exit(0)

partial = text[idx:]

# Progressive cutback: strip chars from end until JSON parses
for cutback in range(0, 30000, 50):
    trimmed = partial[:len(partial)-cutback] if cutback > 0 else partial
    trimmed = trimmed.rstrip().rstrip(",")

    # Detect open string
    in_string = False
    escaped = False
    for c in trimmed:
        if escaped: escaped = False; continue
        if c == "\\": escaped = True; continue
        if c == "\"": in_string = not in_string

    suffix = ""
    if in_string:
        suffix += "\""
    suffix += "]" * max(0, trimmed.count("[") - trimmed.count("]"))
    suffix += "}" * max(0, trimmed.count("{") - trimmed.count("}"))

    try:
        result = json.loads(trimmed + suffix)
        print(json.dumps(result))
        sys.exit(0)
    except json.JSONDecodeError:
        continue

print("{}")
' 2>/dev/null)
        if [ -n "$repaired" ] && [ "$repaired" != "{}" ]; then
            audit_json="$repaired"
            success "Truncated JSON repaired successfully"
        else
            warn "JSON repair failed — response was too truncated"
        fi
    fi

    # Validate: must have .issues as an array (not null) and a non-empty .module field
    if echo "$audit_json" | jq -e '.issues | type == "array"' &>/dev/null; then
        echo "$audit_json" > "$audit_file"

        local score
        score=$(echo "$audit_json" | jq -r '.overall_score // 0')
        local issue_count
        issue_count=$(echo "$audit_json" | jq '(.issues // []) | length')
        local critical_count
        critical_count=$(echo "$audit_json" | jq '[(.issues // [])[] | select(.severity=="critical")] | length')

        # Persist score for trending
        echo "$score" >> "${SCORES_DIR}/${module_name}.txt"

        # Note: invented feature candidates are counted here for audit logging only.
        # FEATURES_INVENTED is incremented in execute_prompts() on successful execution.

        success "${module_label}: score ${score}/100 | ${issue_count} issues (${critical_count} critical)"
    else
        warn "${module_label}: audit parse failed — saving raw response"
        echo '{"module":"'"$module_name"'","scores":{},"overall_score":50,"issues":[],"summary":"Parse failed"}' > "$audit_file"
    fi

    echo "$audit_file"
}

# ── Execute Claude Code prompts ────────────────────────────────────────────────
# Rate limit config: seconds between Claude Code CLI calls (prevents 429/529)
PROMPT_COOLDOWN="${PROMPT_COOLDOWN:-5}"
# Timeout per Claude Code CLI call in seconds (kills hung prompts)
PROMPT_TIMEOUT="${PROMPT_TIMEOUT:-300}"

# Run Claude Code with timeout protection
run_claude_code() {
    local prompt="$1"
    local log_file="$2"
    local timeout_secs="${3:-$PROMPT_TIMEOUT}"

    # Use timeout command (coreutils on Linux, gtimeout on macOS)
    local timeout_cmd="timeout"
    if ! command -v timeout &>/dev/null; then
        if command -v gtimeout &>/dev/null; then
            timeout_cmd="gtimeout"
        else
            # No timeout available — run without protection
            (cd "$PROJECT_DIR" && claude \
                -p "$prompt" \
                --model "$CODE_MODEL" \
                --dangerously-skip-permissions) \
            >> "$log_file" 2>&1
            return $?
        fi
    fi

    (cd "$PROJECT_DIR" && $timeout_cmd "${timeout_secs}s" claude \
        -p "$prompt" \
        --model "$CODE_MODEL" \
        --dangerously-skip-permissions) \
    >> "$log_file" 2>&1
    local exit_code=$?

    if [ $exit_code -eq 124 ]; then
        warn "  Claude Code timed out after ${timeout_secs}s — killing and moving on"
        return 1
    fi
    return $exit_code
}

execute_prompts() {
    local module_name="$1"
    local audit_file="$2"
    local cycle_dir="$3"
    local exec_dir="${cycle_dir}/exec_${module_name}"
    mkdir -p "$exec_dir"

    # PRE-MODULE BUILD GATE: Don't waste money executing prompts if build is already broken
    if [ -n "$BUILD_CMD" ]; then
        if ! (run_build > /dev/null 2>&1); then
            warn "Build is broken BEFORE ${module_name} — fixing build first..."
            local build_errors
            build_errors=$(run_build 2>&1 | tail -40)
            local gate_log="${exec_dir}/build_gate_fix.log"
            run_claude_code "The TypeScript build is broken. Fix ALL errors below. Do not change anything unrelated. Errors:
${build_errors}" "$gate_log" 180
            ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.08" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
            CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.08" | bc 2>/dev/null || echo "$CYCLE_SPEND")
            (cd "$PROJECT_DIR" && \
             git add src/ supabase/ package.json package-lock.json tsconfig.json 2>/dev/null; \
             if ! git diff --cached --quiet 2>/dev/null; then \
                 git commit -m "engine: build gate fix before ${module_name}" 2>/dev/null; \
             fi) || true

            # If build still broken after fix, skip this module entirely
            if ! (run_build > /dev/null 2>&1); then
                error "Build still broken after repair — skipping ${module_name} to save budget"
                return 1
            fi
            success "Build gate passed — proceeding with ${module_name}"
        fi
    fi

    # SMART ORDERING: Sort issues by severity (critical > high > medium > low)
    local issues
    issues=$(jq -r '(.issues // []) | sort_by(
        if .severity == "critical" then 0
        elif .severity == "high" then 1
        elif .severity == "medium" then 2
        else 3 end
    )' "$audit_file")
    local count
    count=$(echo "$issues" | jq 'length')

    if [ "$count" -eq 0 ]; then
        log "No issues to execute for ${module_name}"
        return 0
    fi

    log "Executing ${count} prompts for ${module_name} (sorted by severity)..."

    local consecutive_failures=0
    local i=0
    while [ $i -lt "$count" ]; do
        # CIRCUIT BREAKER: If 3 prompts in a row fail, stop wasting money on this module
        if [ "$consecutive_failures" -ge 3 ]; then
            warn "  3 consecutive failures — circuit breaker tripped, skipping remaining prompts for ${module_name}"
            break
        fi

        # BUDGET CHECK mid-execution: abort if we are running low (decimal-safe)
        if [ "$(echo "${ESTIMATED_SPEND:-0} >= ${MAX_SPEND:-500}" | bc 2>/dev/null)" = "1" ]; then
            warn "  Budget limit hit mid-module — stopping execution"
            break
        fi

        local issue
        issue=$(echo "$issues" | jq ".[$i]")
        local issue_id
        issue_id=$(echo "$issue" | jq -r '.id // "unknown"')
        local severity
        severity=$(echo "$issue" | jq -r '.severity // "medium"')
        local title
        title=$(echo "$issue" | jq -r '.title // "Untitled"')
        local raw_prompt
        raw_prompt=$(echo "$issue" | jq -r '.prompt // ""')

        if [ -z "$raw_prompt" ] || [ "$raw_prompt" = "null" ]; then
            i=$(( i + 1 ))
            continue
        fi

        # Wrap every prompt with project context so Claude Code understands the codebase
        local mode_rules=""
        if [ "$CYCLE" -gt 3 ]; then
            mode_rules="
8. FEATURE BUILDING (ARCHITECT/VISIONARY MODE): You ARE allowed to create new files, new components, new services, and new directories. You ARE allowed to run 'npm install <package>' to add dependencies. You ARE allowed to create new Supabase edge functions in supabase/functions/ and new migrations in supabase/migrations/. When building a feature from PRODUCTION_ROADMAP.md, follow the exact database schemas, file paths, and acceptance tests specified there.
9. For new edge functions: Create the function directory and index.ts file. Use Deno/TypeScript. Import from supabase-js. Follow the pattern of existing functions in supabase/functions/.
10. For new migrations: Create a new .sql file in supabase/migrations/ with the next sequential number. Include RLS policies for any new tables."
        fi
        local prompt="IMPORTANT RULES:
1. This is a React 19 + TypeScript + Vite app. Styles use inline styles from src/styles/theme.ts. Do NOT use CSS modules or styled-components.
2. Read the target file FIRST before making changes. Understand what exists before modifying.
3. Make the MINIMUM change needed. Do not refactor unrelated code. Exception: if building a new feature from PRODUCTION_ROADMAP.md, create all necessary files.
4. After making changes, run: npm run build — if the build fails, fix the errors before finishing.
5. Never use hyphens in UI text. Use commas or periods instead.
6. For Supabase/backend code: Use the client from src/lib/supabase.ts. Type all queries against the Database interface in src/types/database.ts. Use hooks from src/hooks/useSupabase.ts. Follow RLS patterns (all tables filtered by project_id). Add real-time subscriptions for rfis, daily_logs, punch_list_items, notifications. Implement optimistic updates on all mutations. Edge functions go in supabase/functions/.
7. VERIFICATION: If this fix touches auth (useAuth, Login, Signup, ProtectedRoute), RLS (rls.ts, migrations), permissions (usePermissions, PermissionGate), or data seeding (seed.sql, mockData), you MUST also generate and run the relevant verification test from VERIFICATION_TESTS.md. A fix that compiles but fails verification is NOT fixed. Write the test file, run it with 'npx vitest run' or 'npx playwright test', and include the result. RLS test failures are P0.${mode_rules}

TASK:
${raw_prompt}"

        log "  [$(( i + 1 ))/${count}] ${severity} — ${title}"

        local exec_log="${exec_dir}/exec_${i}_${issue_id}.log"

        if [ "$DRY_RUN" = "true" ]; then
            echo "[DRY RUN] Would execute: ${title}" > "$exec_log"
            echo "PROMPT:" >> "$exec_log"
            echo "$prompt" >> "$exec_log"
        else
            # RATE LIMIT: cooldown between Claude Code calls to prevent 429/529
            if [ $i -gt 0 ]; then
                sleep "$PROMPT_COOLDOWN"
            fi

            # Execute the prompt with timeout protection
            local exec_success=false
            if run_claude_code "$prompt" "$exec_log"; then
                exec_success=true
                consecutive_failures=0
                TOTAL_PROMPTS_EXECUTED=$(( TOTAL_PROMPTS_EXECUTED + 1 ))
                ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.08" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
                CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.08" | bc 2>/dev/null || echo "$CYCLE_SPEND")
            fi

            if [ "$exec_success" = "false" ]; then
                consecutive_failures=$(( consecutive_failures + 1 ))
                warn "  Prompt ${issue_id} failed — retrying with simplified version..."
                sleep "$PROMPT_COOLDOWN"
                local simple_prompt="You are editing a React TypeScript project. ${title}. Read the target file first. Make the minimal change needed. Only edit existing files. Run: npm run build after to verify."
                if run_claude_code "$simple_prompt" "${exec_log}.retry" 180; then
                    consecutive_failures=0
                    TOTAL_PROMPTS_EXECUTED=$(( TOTAL_PROMPTS_EXECUTED + 1 ))
                    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.05" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
                    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.05" | bc 2>/dev/null || echo "$CYCLE_SPEND")
                    success "  Simplified retry succeeded"
                else
                    warn "  Prompt ${issue_id} failed on retry too — skipping"
                fi
            fi

            # Quick build check after each prompt (catch regressions immediately)
            if [ -n "$BUILD_CMD" ]; then
                if ! (run_build > /dev/null 2>&1); then
                    warn "  Build broken after ${issue_id} — auto-fixing..."
                    local build_errors
                    build_errors=$(run_build 2>&1 | tail -30)
                    sleep "$PROMPT_COOLDOWN"
                    run_claude_code "The TypeScript build is broken. Fix these errors. Only fix the errors, do not change anything else. Errors: ${build_errors}" "${exec_log}.buildfix" 180
                    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.08" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
                    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.08" | bc 2>/dev/null || echo "$CYCLE_SPEND")

                    # If build STILL broken after fix, revert ONLY uncommitted changes and move on
                    if ! (run_build > /dev/null 2>&1); then
                        warn "  Build still broken — reverting uncommitted changes to last good commit"
                        # Save what we're reverting for debugging
                        (cd "$PROJECT_DIR" && git diff src/ > "${exec_dir}/reverted_${issue_id}.patch" 2>/dev/null) || true
                        # Stash uncommitted changes (safer than checkout -- which nukes everything)
                        (cd "$PROJECT_DIR" && git stash push -m "engine: reverted broken fix ${issue_id}" -- src/ 2>/dev/null) || \
                        (cd "$PROJECT_DIR" && git checkout -- src/ 2>/dev/null) || true
                        consecutive_failures=$(( consecutive_failures + 1 ))
                    fi
                fi
            fi

            # Atomic commit: save every successful change immediately (never lose work)
            # v6.0: Only commit if there are actual staged changes (no empty commits)
            (cd "$PROJECT_DIR" && \
             git add src/ supabase/ package.json package-lock.json tsconfig.json 2>/dev/null; \
             if ! git diff --cached --quiet 2>/dev/null; then \
                 git commit -m "engine: fix ${issue_id} — ${title}" 2>/dev/null; \
             fi) || true
        fi

        i=$(( i + 1 ))
    done

    # Execute invented features if any
    local invented
    invented=$(jq -r '.invented_features // []' "$audit_file")
    local inv_count
    inv_count=$(echo "$invented" | jq 'length')

    if [ "$inv_count" -gt 0 ] && [ "$INVENTION_MODE" = "true" ] && [ "$DRY_RUN" != "true" ]; then
        invent "Executing ${inv_count} invented features for ${module_name}..."
        local j=0
        while [ $j -lt "$inv_count" ]; do
            local feature
            feature=$(echo "$invented" | jq ".[$j]")
            local feat_title
            feat_title=$(echo "$feature" | jq -r '.title // "New Feature"')
            local feat_prompt
            feat_prompt=$(echo "$feature" | jq -r '.prompt // ""')

            if [ -n "$feat_prompt" ] && [ "$feat_prompt" != "null" ]; then
                invent "  Inventing: ${feat_title}"
                sleep "$PROMPT_COOLDOWN"
                local feat_log="${exec_dir}/invention_${j}_${module_name}.log"
                if run_claude_code "$feat_prompt" "$feat_log"; then
                    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.08" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
                    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.08" | bc 2>/dev/null || echo "$CYCLE_SPEND")
                    # Only count inventions that actually executed successfully
                    FEATURES_INVENTED=$(( FEATURES_INVENTED + 1 ))
                    # Atomic commit for invention
                    (cd "$PROJECT_DIR" && \
                     git add src/ supabase/ package.json package-lock.json tsconfig.json 2>/dev/null; \
                     if ! git diff --cached --quiet 2>/dev/null; then \
                         git commit -m "engine: invent ${feat_title}" 2>/dev/null; \
                     fi) || true
                else
                    warn "  Invention failed: ${feat_title}"
                fi
            fi
            j=$(( j + 1 ))
        done
    fi

    # Return success
    return 0
}

# ── Build verification ─────────────────────────────────────────────────────────
verify_build() {
    local cycle_dir="$1"

    if [ -z "$BUILD_CMD" ]; then
        log "No build command configured — skipping build verification"
        return 0
    fi

    log "Verifying build..."
    local build_log="${cycle_dir}/build.log"

    if (run_build > "$build_log" 2>&1); then
        success "Build passed"
        return 0
    fi

    warn "Build failed. Asking Claude Code to fix..."
    local build_errors
    build_errors=$(tail -50 "$build_log")

    local fix_prompt
    fix_prompt="The SiteSyncAI React TypeScript build is failing after recent changes. Fix all TypeScript and build errors.

Build command: ${BUILD_CMD}
Working directory: ${PROJECT_DIR}

Build errors:
\`\`\`
${build_errors}
\`\`\`

Fix every error. Do not introduce any new errors. After fixing, confirm that \`${BUILD_CMD}\` would succeed."

    run_claude_code "$fix_prompt" "${cycle_dir}/build_fix.log" 180 || true
    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.08" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.08" | bc 2>/dev/null || echo "$CYCLE_SPEND")

    # Re-verify
    if (run_build >> "$build_log" 2>&1); then
        success "Build fixed and passing"
        return 0
    fi

    warn "Build still failing after auto-fix — continuing anyway (issues logged)"
    return 0
}

# ── Test verification ─────────────────────────────────────────────────────────
verify_tests() {
    local cycle_dir="$1"

    if [ -z "$TEST_CMD" ]; then
        log "No test command configured — skipping test verification"
        return 0
    fi

    log "Running tests..."
    local test_log="${cycle_dir}/test.log"

    if (run_tests > "$test_log" 2>&1); then
        success "Tests passed"
        return 0
    fi

    warn "Tests failing. Asking Claude Code to fix..."
    local test_errors
    test_errors=$(tail -50 "$test_log")

    local fix_prompt
    fix_prompt="The SiteSyncAI test suite is failing after recent changes. Fix the failing tests without breaking any existing functionality.

Working directory: ${PROJECT_DIR}
Test command: ${TEST_CMD}

Test output:
\`\`\`
${test_errors}
\`\`\`

Fix every failing test. Do not delete or skip tests. If the test expectations are wrong because the code was intentionally changed, update the test expectations to match the new behavior."

    run_claude_code "$fix_prompt" "${cycle_dir}/test_fix.log" 180 || true
    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.08" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.08" | bc 2>/dev/null || echo "$CYCLE_SPEND")

    # Re-verify
    if (run_tests >> "$test_log" 2>&1); then
        success "Tests fixed and passing"
        return 0
    fi

    warn "Tests still failing after auto-fix — continuing (issues logged)"
    return 0
}

# ── NETFLIX: Visual verification via dev server + screenshot ─────────────────
# Start the dev server, capture a screenshot, and ask Claude vision to evaluate.
# This catches UI regressions that TypeScript can't see: layout breaks, color
# errors, missing content, overlapping elements.
verify_visual() {
    local cycle_dir="$1"

    # Only run visual verification every 3 cycles (expensive) or on final cycle
    if [ $(( CYCLE % 3 )) -ne 0 ] && [ "$CYCLE" -lt "$MAX_CYCLES" ]; then
        return 0
    fi

    # Check if we can take screenshots (need npx or playwright installed)
    if ! command -v npx &>/dev/null; then
        log "Visual verification skipped (npx not available)"
        return 0
    fi

    log "VISUAL VERIFICATION: Starting dev server for screenshot..."

    # Start dev server in background
    local dev_pid=""
    local dev_log="${cycle_dir}/dev_server.log"
    (cd "$PROJECT_DIR" && npx vite --port 5199 > "$dev_log" 2>&1) &
    dev_pid=$!

    # Wait for server to be ready (up to 30 seconds)
    local wait_count=0
    while [ $wait_count -lt 30 ]; do
        if curl -s -o /dev/null http://localhost:5199 2>/dev/null; then
            break
        fi
        sleep 1
        wait_count=$(( wait_count + 1 ))
    done

    if [ $wait_count -ge 30 ]; then
        warn "Dev server did not start in 30s — skipping visual verification"
        kill "$dev_pid" 2>/dev/null; wait "$dev_pid" 2>/dev/null || true
        return 0
    fi

    # Take screenshot using Claude Code (it can use a headless browser)
    local screenshot_file="${cycle_dir}/ui_screenshot.png"
    local vis_log="${cycle_dir}/visual_verification.log"

    # Use Claude Code to take a screenshot and evaluate the UI
    local vis_prompt="VISUAL QA TASK:
1. First, install playwright if needed: npx playwright install chromium --with-deps 2>/dev/null || true
2. Take a screenshot of http://localhost:5199 and save it to ${screenshot_file}. Use this Node.js script:
   const { chromium } = require('playwright');
   (async () => {
     const browser = await chromium.launch();
     const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
     await page.goto('http://localhost:5199', { waitUntil: 'networkidle', timeout: 15000 });
     await page.screenshot({ path: '${screenshot_file}', fullPage: false });
     await browser.close();
   })();
3. If the screenshot was taken successfully, report: VISUAL_CHECK=PASS
4. If the page shows errors, blank content, or failed to render, report: VISUAL_CHECK=FAIL and describe what you see."

    run_claude_code "$vis_prompt" "$vis_log" 120 || true
    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.08" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")

    # Kill the dev server
    kill "$dev_pid" 2>/dev/null; wait "$dev_pid" 2>/dev/null || true

    if [ -f "$screenshot_file" ]; then
        success "Visual verification: screenshot captured (${screenshot_file})"
    else
        warn "Visual verification: screenshot capture failed (check ${vis_log})"
    fi
}

# ── AMAZON: Quality gates beyond build ────────────────────────────────────────
# Track bundle size, TypeScript error count, and other health metrics.
# Prevents silent regressions the build can't catch.
verify_quality_gates() {
    local cycle_dir="$1"
    local quality_file="${cycle_dir}/quality_gates.json"

    log "Running quality gates..."

    # Bundle size tracking
    local bundle_size=0
    local dist_dir="${PROJECT_DIR}/dist"
    if [ -d "$dist_dir" ]; then
        bundle_size=$(find "$dist_dir" -type f \( -name '*.js' -o -name '*.css' \) -exec wc -c {} + 2>/dev/null | tail -1 | awk '{print $1}')
    fi
    bundle_size=$(echo "${bundle_size:-0}" | tr -cd '0-9')
    [ -z "$bundle_size" ] && bundle_size=0

    # TypeScript strict error count (count unique errors, don't fail)
    local ts_errors=0
    if [ -n "$BUILD_CMD" ]; then
        ts_errors=$(cd "$PROJECT_DIR" && timeout 60 npx tsc --noEmit 2>&1 | grep -c "error TS" 2>/dev/null || echo 0)
    fi
    ts_errors=$(echo "${ts_errors:-0}" | tr -cd '0-9')
    [ -z "$ts_errors" ] && ts_errors=0

    # Source file count and total lines
    local src_files
    src_files=$(find "$PROJECT_DIR/src" -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | wc -l | tr -d ' ')
    src_files=$(echo "${src_files:-0}" | tr -cd '0-9')
    [ -z "$src_files" ] && src_files=0
    local src_lines
    src_lines=$(find "$PROJECT_DIR/src" -type f \( -name '*.ts' -o -name '*.tsx' \) -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
    src_lines=$(echo "${src_lines:-0}" | tr -cd '0-9')
    [ -z "$src_lines" ] && src_lines=0

    # Track in quality file
    jq -n \
        --argjson bundle_size "${bundle_size:-0}" \
        --argjson ts_errors "${ts_errors:-0}" \
        --argjson src_files "${src_files:-0}" \
        --argjson src_lines "${src_lines:-0}" \
        --argjson cycle "$CYCLE" \
        '{cycle:$cycle, bundle_size_bytes:$bundle_size, typescript_errors:$ts_errors, source_files:$src_files, source_lines:$src_lines}' \
        > "$quality_file"

    # Append to trending file
    local trending_file="${RUN_DIR}/quality_trend.jsonl"
    cat "$quality_file" >> "$trending_file"

    # Alert on regression
    if [ -f "$trending_file" ]; then
        local prev_bundle
        prev_bundle=$(tail -2 "$trending_file" | head -1 | jq '.bundle_size_bytes // 0' 2>/dev/null || echo 0)
        if [ "$bundle_size" -gt 0 ] && [ "$prev_bundle" -gt 0 ]; then
            local growth_pct=$(( (bundle_size - prev_bundle) * 100 / prev_bundle ))
            if [ "$growth_pct" -gt 15 ]; then
                warn "BUNDLE BLOAT: Size grew ${growth_pct}% this cycle (${prev_bundle} → ${bundle_size}). Consider code splitting."
            fi
        fi
    fi

    success "Quality gates: ${src_files} files, ${src_lines} lines, ${ts_errors} TS errors, $(format_bytes ${bundle_size:-0}) bundle"
}

# ── TESLA: Self-improving prompt patterns ─────────────────────────────────────
# Track which prompt patterns lead to highest fix rates. Evolve strategy.
# Writes prompt_patterns.json each cycle; the engine reads it next cycle
# to weight prompt construction toward patterns that historically work.
evolve_prompt_strategy() {
    local cycle_dir="$1"
    local patterns_file="${RUN_DIR}/prompt_patterns.json"

    log "TESLA: Analyzing prompt effectiveness..."

    # Collect per-module results this cycle
    local pattern_data="[]"
    for verify_file in "${cycle_dir}"/verify_*.json; do
        [ -f "$verify_file" ] || continue
        local mod
        mod=$(basename "$verify_file" | sed 's/verify_//; s/\.json//')

        local fixed
        fixed=$(jq '[.verifications[]? | select(.status=="fixed")] | length' "$verify_file" 2>/dev/null || echo 0)
        local total
        total=$(jq '[.verifications[]?] | length' "$verify_file" 2>/dev/null || echo 0)

        [ "$total" -eq 0 ] && continue

        local rate=$(( fixed * 100 / total ))

        # Check what model was used (from audit file)
        local audit_file="${cycle_dir}/audit_${mod}.json"
        local model_used="sonnet"
        if [ -f "$audit_file" ]; then
            model_used=$(jq -r '.model // "sonnet"' "$audit_file" 2>/dev/null || echo "sonnet")
        fi

        # Check thinking mode
        local tmode="surgeon"
        if [ "$CYCLE" -le 3 ]; then tmode="surgeon"
        elif [ "$CYCLE" -le 10 ]; then tmode="architect"
        else tmode="visionary"; fi

        pattern_data=$(echo "$pattern_data" | jq \
            --arg mod "$mod" \
            --argjson rate "$rate" \
            --argjson fixed "$fixed" \
            --argjson total "$total" \
            --arg model "$model_used" \
            --arg mode "$tmode" \
            --argjson cycle "$CYCLE" \
            '. + [{"module":$mod,"fix_rate":$rate,"fixed":$fixed,"total":$total,"model":$model,"mode":$mode,"cycle":$cycle}]')
    done

    # Write this cycle's patterns
    echo "$pattern_data" | jq '.' > "${cycle_dir}/prompt_patterns.json" 2>/dev/null || true

    # Append to running patterns log
    echo "$pattern_data" | jq -c '.[]' >> "${RUN_DIR}/prompt_patterns.jsonl" 2>/dev/null || true

    # Analyze trends: which model + mode combos work best?
    if [ -f "${RUN_DIR}/prompt_patterns.jsonl" ]; then
        local line_count
        line_count=$(wc -l < "${RUN_DIR}/prompt_patterns.jsonl" | tr -d ' ')

        if [ "${line_count:-0}" -ge 5 ]; then
            # Calculate average fix rate per model
            local model_stats
            model_stats=$(cat "${RUN_DIR}/prompt_patterns.jsonl" | jq -s '
                group_by(.model) | map({
                    model: .[0].model,
                    avg_fix_rate: ([.[].fix_rate] | add / length | floor),
                    total_prompts: ([.[].total] | add),
                    total_fixed: ([.[].fixed] | add)
                }) | sort_by(-.avg_fix_rate)
            ' 2>/dev/null || echo "[]")
            [ -z "$model_stats" ] || ! echo "$model_stats" | jq '.' >/dev/null 2>&1 && model_stats="[]"

            # Write strategy recommendations
            local strategy_file="${RUN_DIR}/prompt_strategy.json"
            jq -n \
                --argjson model_stats "$model_stats" \
                --argjson cycle "$CYCLE" \
                --argjson total_patterns "$line_count" \
                '{
                    cycle: $cycle,
                    total_data_points: $total_patterns,
                    model_effectiveness: $model_stats,
                    recommendation: (
                        if ($model_stats | length) > 0 then
                            "Best performing model: " + $model_stats[0].model + " at " + ($model_stats[0].avg_fix_rate | tostring) + "% fix rate"
                        else "Insufficient data" end
                    )
                }' > "$strategy_file" 2>/dev/null || true

            # Log insights
            local best_model
            best_model=$(echo "$model_stats" | jq -r '.[0].model // "unknown"' 2>/dev/null || echo "unknown")
            local best_rate
            best_rate=$(echo "$model_stats" | jq -r '.[0].avg_fix_rate // 0' 2>/dev/null || echo 0)
            log "TESLA: Best model: ${best_model} (${best_rate}% avg fix rate over ${line_count} data points)"

            # Adaptive threshold: if overall fix rate is dropping, lower the Opus threshold
            local recent_avg
            recent_avg=$(tail -10 "${RUN_DIR}/prompt_patterns.jsonl" | jq -s '[.[].fix_rate] | add / length | floor' 2>/dev/null || echo 50)
            if [ "${recent_avg:-50}" -lt 40 ]; then
                log "TESLA: Fix rates declining. Recommend more Opus usage next cycle."
            fi
        fi
    fi

    success "TESLA: Prompt pattern analysis complete"
}

# ── META: Cycle planning phase ────────────────────────────────────────────────
# Before diving into audits, take a step back: review scores, identify focus
# areas, and create a strategic plan. This turns the engine from a bug fixer
# into a strategic builder that thinks before it acts.
plan_cycle() {
    local cycle_dir="$1"
    local cycle_num="$2"
    local plan_file="${cycle_dir}/cycle_plan.json"

    log "META: Strategic planning for cycle ${cycle_num}..."

    # Gather all module scores
    local score_summary="[]"
    if [ -d "$SCORES_DIR" ]; then
        for score_file in "${SCORES_DIR}"/*.txt; do
            [ -f "$score_file" ] || continue
            local mod_name
            mod_name=$(basename "$score_file" .txt)
            local latest_score
            latest_score=$(tail -1 "$score_file" 2>/dev/null | tr -dc '0-9')
            [ -z "$latest_score" ] && latest_score=0

            local score_count
            score_count=$(wc -l < "$score_file" | tr -d ' ')
            local trend="stable"
            if [ "${score_count:-0}" -ge 2 ]; then
                local prev
                prev=$(sed -n "$(( score_count - 1 ))p" "$score_file" 2>/dev/null | tr -dc '0-9')
                if [ -n "$prev" ] && [ -n "$latest_score" ]; then
                    local delta=$(( latest_score - prev ))
                    if [ "$delta" -gt 3 ]; then trend="improving"
                    elif [ "$delta" -lt -3 ]; then trend="declining"
                    fi
                fi
            fi

            local safe_score
            safe_score=$(echo "${latest_score:-0}" | tr -cd '0-9')
            [ -z "$safe_score" ] && safe_score=0
            local safe_cycles
            safe_cycles=$(echo "${score_count:-0}" | tr -cd '0-9')
            [ -z "$safe_cycles" ] && safe_cycles=0
            score_summary=$(echo "$score_summary" | jq \
                --arg mod "$mod_name" \
                --argjson score "$safe_score" \
                --arg trend "$trend" \
                --argjson cycles "$safe_cycles" \
                '. + [{"module":$mod,"score":$score,"trend":$trend,"cycles_tracked":$cycles}]')
        done
    fi

    # Determine thinking mode
    local thinking_mode="surgeon"
    if [ "$cycle_num" -le 3 ]; then thinking_mode="surgeon"
    elif [ "$cycle_num" -le 10 ]; then thinking_mode="architect"
    else thinking_mode="visionary"; fi

    # Identify priority areas
    local weakest_modules
    weakest_modules=$(echo "$score_summary" | jq '[sort_by(.score)[:3] | .[].module] // []' 2>/dev/null || echo "[]")
    [ -z "$weakest_modules" ] || ! echo "$weakest_modules" | jq '.' >/dev/null 2>&1 && weakest_modules="[]"
    local declining_modules
    declining_modules=$(echo "$score_summary" | jq '[.[] | select(.trend=="declining") | .module] // []' 2>/dev/null || echo "[]")
    [ -z "$declining_modules" ] || ! echo "$declining_modules" | jq '.' >/dev/null 2>&1 && declining_modules="[]"
    local avg_score
    avg_score=$(echo "$score_summary" | jq '[.[].score] | if length > 0 then add / length | floor else 0 end' 2>/dev/null || echo 0)
    avg_score=$(echo "${avg_score:-0}" | tr -cd '0-9')
    [ -z "$avg_score" ] && avg_score=0

    # Check prompt strategy from TESLA
    local prompt_recommendation="No data yet"
    local strategy_file="${RUN_DIR}/prompt_strategy.json"
    if [ -f "$strategy_file" ]; then
        prompt_recommendation=$(jq -r '.recommendation // "No data yet"' "$strategy_file" 2>/dev/null || echo "No data yet")
    fi

    # Check quality gates trend
    local quality_trend="stable"
    local trending_file="${RUN_DIR}/quality_trend.jsonl"
    if [ -f "$trending_file" ]; then
        local trend_count
        trend_count=$(wc -l < "$trending_file" | tr -d ' ')
        if [ "${trend_count:-0}" -ge 2 ]; then
            local prev_errors
            prev_errors=$(tail -2 "$trending_file" | head -1 | jq '.typescript_errors // 0' 2>/dev/null || echo 0)
            local curr_errors
            curr_errors=$(tail -1 "$trending_file" | jq '.typescript_errors // 0' 2>/dev/null || echo 0)
            if [ "${curr_errors:-0}" -gt "${prev_errors:-0}" ]; then
                quality_trend="degrading"
            elif [ "${curr_errors:-0}" -lt "${prev_errors:-0}" ]; then
                quality_trend="improving"
            fi
        fi
    fi

    # Validate JSON objects before passing to jq
    [ -z "$score_summary" ] || ! echo "$score_summary" | jq '.' >/dev/null 2>&1 && score_summary="[]"

    # Build the plan
    jq -n \
        --argjson cycle "$cycle_num" \
        --arg mode "$thinking_mode" \
        --argjson avg_score "${avg_score:-0}" \
        --argjson weakest "$weakest_modules" \
        --argjson declining "$declining_modules" \
        --arg quality_trend "$quality_trend" \
        --arg prompt_strategy "$prompt_recommendation" \
        --argjson scores "$score_summary" \
        '{
            cycle: $cycle,
            thinking_mode: $mode,
            average_score: $avg_score,
            focus_modules: $weakest,
            declining_modules: $declining,
            quality_trend: $quality_trend,
            prompt_strategy: $prompt_strategy,
            plan: (
                if $avg_score < 50 then "TRIAGE: Focus exclusively on critical bugs and build failures. Skip cosmetic issues."
                elif $avg_score < 70 then "STABILIZE: Fix high-severity issues first. Start improving architecture in top modules."
                elif $avg_score < 85 then "POLISH: All modules functional. Focus on UX, performance, and edge cases."
                else "INNOVATE: Platform is strong. Invent new features, push for world-class quality."
                end
            ),
            module_scores: $scores
        }' > "$plan_file" 2>/dev/null || true

    # Log the plan
    local plan_summary
    plan_summary=$(jq -r '.plan // "No plan"' "$plan_file" 2>/dev/null || echo "No plan")
    log "META: Avg score: ${avg_score} | Mode: $(echo "$thinking_mode" | tr '[:lower:]' '[:upper:]') | Strategy: ${plan_summary}"

    if [ "$(echo "$declining_modules" | jq 'length')" -gt 0 ] 2>/dev/null; then
        local declining_list
        declining_list=$(echo "$declining_modules" | jq -r 'join(", ")' 2>/dev/null || echo "")
        warn "META: Declining modules detected: ${declining_list} — will receive extra attention"
    fi

    success "META: Cycle ${cycle_num} plan ready"
}

# ── APPLE: UI polish verification ─────────────────────────────────────────────
# Checks for design consistency: spacing, color token usage, alignment, and
# visual hierarchy. Runs via static analysis (grep/ast), not screenshots.
verify_ui_polish() {
    local cycle_dir="$1"
    local polish_file="${cycle_dir}/ui_polish.json"

    log "APPLE: Checking UI polish..."

    local issues=0
    local warnings=""

    # Check 1: Hardcoded colors (should use theme tokens)
    local hardcoded_colors
    hardcoded_colors=$(grep -rn "color:\s*['\"]#" "$PROJECT_DIR/src/" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "theme\." | grep -v "styles/" | grep -v "node_modules" | head -20 || true)
    local hc_count
    hc_count=$(echo "$hardcoded_colors" | grep -c '#' 2>/dev/null || echo 0)
    if [ "${hc_count:-0}" -gt 0 ]; then
        issues=$(( issues + hc_count ))
        warnings="${warnings}Hardcoded colors found (${hc_count} instances) — should use theme tokens\n"
    fi

    # Check 2: Inline px values that should be spacing tokens
    local hardcoded_px
    hardcoded_px=$(grep -rn ":\s*['\"][0-9]\+px" "$PROJECT_DIR/src/" --include="*.tsx" 2>/dev/null | grep -v "theme\." | grep -v "styles/" | grep -v "node_modules" | grep -v "1px\|2px" | head -20 || true)
    local px_count
    px_count=$(echo "$hardcoded_px" | grep -c 'px' 2>/dev/null || echo 0)
    if [ "${px_count:-0}" -gt 5 ]; then
        issues=$(( issues + px_count ))
        warnings="${warnings}Hardcoded pixel values (${px_count} instances) — should use spacing tokens\n"
    fi

    # Check 3: Inconsistent border radius
    local radius_values
    radius_values=$(grep -roh "borderRadius:\s*['\"]\\?[0-9]\\+" "$PROJECT_DIR/src/" --include="*.tsx" 2>/dev/null | sort | uniq -c | sort -rn | head -10 || true)
    local unique_radii
    unique_radii=$(echo "$radius_values" | grep -c '[0-9]' 2>/dev/null || echo 0)
    if [ "${unique_radii:-0}" -gt 4 ]; then
        warnings="${warnings}Too many unique border radius values (${unique_radii}) — standardize to 2 or 3 sizes\n"
    fi

    # Check 4: Missing hover/focus states on interactive elements
    local buttons_without_hover
    buttons_without_hover=$(grep -rn "onClick=" "$PROJECT_DIR/src/" --include="*.tsx" 2>/dev/null | grep -v "cursor:\s*['\"]pointer" | grep -v "Btn\|Button\|button" | head -10 || true)
    local no_cursor_count
    no_cursor_count=$(echo "$buttons_without_hover" | grep -c 'onClick' 2>/dev/null || echo 0)
    if [ "${no_cursor_count:-0}" -gt 3 ]; then
        issues=$(( issues + no_cursor_count ))
        warnings="${warnings}Clickable elements without cursor:pointer (${no_cursor_count}) — add pointer cursor\n"
    fi

    # Check 5: Console.log left in production code
    local console_logs
    console_logs=$(grep -rn "console\.log\|console\.warn\|console\.error" "$PROJECT_DIR/src/" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -v "//.*console" | head -20 || true)
    local log_count
    log_count=$(echo "$console_logs" | grep -c 'console\.' 2>/dev/null || echo 0)
    if [ "${log_count:-0}" -gt 3 ]; then
        warnings="${warnings}Console statements in production code (${log_count}) — clean up before ship\n"
    fi

    # Check 6: Brand color consistency (primary orange usage)
    local orange_usage
    orange_usage=$(grep -rn "F47820\|#f47820" "$PROJECT_DIR/src/" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "theme\." | grep -v "styles/" | head -10 || true)
    local direct_orange
    direct_orange=$(echo "$orange_usage" | grep -c 'F47820\|f47820' 2>/dev/null || echo 0)
    if [ "${direct_orange:-0}" -gt 2 ]; then
        warnings="${warnings}Direct orange hex usage (${direct_orange}) — use theme.colors.primary instead\n"
    fi

    # Check 7: Hyphens in UI text (violates brand rules)
    local hyphen_text
    hyphen_text=$(grep -rn ">[^<]*-[^<]*<" "$PROJECT_DIR/src/" --include="*.tsx" 2>/dev/null | grep -v "node_modules\|aria-\|data-\|class-\|font-\|x-\|re-\|pre-\|sub-\|en-\|de-\|co-" | head -10 || true)
    local hyphen_count
    hyphen_count=$(echo "$hyphen_text" | grep -c '\-' 2>/dev/null || echo 0)
    if [ "${hyphen_count:-0}" -gt 0 ]; then
        issues=$(( issues + hyphen_count ))
        warnings="${warnings}Hyphens in UI text (${hyphen_count}) — use commas or periods instead\n"
    fi

    # Write polish report
    jq -n \
        --argjson issues "${issues:-0}" \
        --argjson cycle "$CYCLE" \
        --arg warnings "$(printf '%b' "$warnings")" \
        --argjson hardcoded_colors "${hc_count:-0}" \
        --argjson hardcoded_px "${px_count:-0}" \
        --argjson console_logs "${log_count:-0}" \
        '{
            cycle: $cycle,
            total_polish_issues: $issues,
            hardcoded_colors: $hardcoded_colors,
            hardcoded_pixels: $hardcoded_px,
            console_logs: $console_logs,
            warnings: ($warnings | split("\n") | map(select(length > 0))),
            grade: (
                if $issues == 0 then "A+"
                elif $issues < 5 then "A"
                elif $issues < 15 then "B"
                elif $issues < 30 then "C"
                else "D" end
            )
        }' > "$polish_file" 2>/dev/null || true

    # Append to trending
    jq -c '.' "$polish_file" >> "${RUN_DIR}/polish_trend.jsonl" 2>/dev/null || true

    local grade
    grade=$(jq -r '.grade // "?"' "$polish_file" 2>/dev/null || echo "?")
    success "APPLE: Polish grade: ${grade} (${issues} issues found)"

    if [ "${issues:-0}" -gt 15 ]; then
        warn "APPLE: UI polish needs work. ${issues} issues flagged."
    fi
}

# ── Change verification (git-based — fast, accurate, no LLM needed) ──────────
# v6.0: Completely rewritten. Old version grepped for commit messages that didn't
# match the actual commit format, so EVERY verification returned 0% fixed.
# New version: check git log for ALL engine commits since cycle start, match
# changed files against audit targets. Simple, correct, fast.
verify_changes() {
    local module_name="$1"
    local audit_file="$2"
    local snapshot_file="$3"
    local cycle_dir="$4"

    local verify_file="${cycle_dir}/verify_${module_name}.json"

    log "Verifying changes for ${module_name}..."

    # Get ALL files changed by engine commits today (use run start date, not cycle dir mtime
    # which gets updated as files are written and ends up AFTER the commits it should find)
    local run_start_date
    run_start_date=$(date -d "@${START_TIME}" "+%Y-%m-%d" 2>/dev/null || date "+%Y-%m-%d")

    local all_engine_changes
    all_engine_changes=$(cd "$PROJECT_DIR" && git log --name-only --since="${run_start_date}" --grep="engine:" --pretty=format:"" 2>/dev/null | sort -u | grep -v '^$' || echo "")

    # Also include uncommitted changes (work in progress)
    local uncommitted
    uncommitted=$(cd "$PROJECT_DIR" && git diff --name-only 2>/dev/null || echo "")
    local staged
    staged=$(cd "$PROJECT_DIR" && git diff --cached --name-only 2>/dev/null || echo "")

    # Merge all changed files into one list
    local all_changes
    all_changes=$(printf '%s\n%s\n%s' "$all_engine_changes" "$uncommitted" "$staged" | sort -u | grep -v '^$' || echo "")

    local files_changed_count
    files_changed_count=$(echo "$all_changes" | grep -c '.' 2>/dev/null || echo 0)

    # Check build status
    local build_ok="true"
    if [ -n "$BUILD_CMD" ]; then
        if ! (run_build > /dev/null 2>&1); then
            build_ok="false"
        fi
    fi

    # For each issue, check if a commit exists with that issue ID in the message
    # This is far more accurate than filename matching — the engine tags every
    # commit with the exact issue ID (e.g. "engine: fix ui-design-system-C1-002")
    local all_commit_messages
    all_commit_messages=$(cd "$PROJECT_DIR" && git log --oneline --since="${run_start_date}" --grep="engine:" 2>/dev/null || echo "")

    local verifications="[]"
    local fixed_count=0
    local partial_count=0
    local unfixed_count=0

    local issue_count
    issue_count=$(jq '(.issues // []) | length' "$audit_file" 2>/dev/null || echo 0)
    local idx=0
    while [ $idx -lt "$issue_count" ]; do
        local issue_id
        issue_id=$(jq -r --argjson i "$idx" '(.issues // [])[$i].id // "unknown"' "$audit_file" 2>/dev/null)
        local issue_file
        issue_file=$(jq -r --argjson i "$idx" '(.issues // [])[$i].file // ""' "$audit_file" 2>/dev/null)

        local status="not_fixed"
        local note="No matching commit found"

        # Primary check: does a commit message contain this issue ID?
        if echo "$all_commit_messages" | grep -qF "$issue_id" 2>/dev/null; then
            status="fixed"
            note="Commit found matching issue ID"
            fixed_count=$(( fixed_count + 1 ))
        # Secondary check: was the target file directly modified?
        elif [ -n "$issue_file" ] && [ "$issue_file" != "null" ] && echo "$all_changes" | grep -qF "$issue_file" 2>/dev/null; then
            status="fixed"
            note="Target file was modified"
            fixed_count=$(( fixed_count + 1 ))
        # Tertiary: was any file in the same directory modified? (genuine partial)
        elif [ -n "$issue_file" ] && [ "$issue_file" != "null" ]; then
            local issue_dir
            issue_dir=$(dirname "$issue_file")
            if echo "$all_changes" | grep -qF "$issue_dir/" 2>/dev/null; then
                status="partial"
                note="Related file in same directory modified but no direct commit for this issue"
                partial_count=$(( partial_count + 1 ))
            else
                unfixed_count=$(( unfixed_count + 1 ))
            fi
        else
            unfixed_count=$(( unfixed_count + 1 ))
            note="No target file specified in audit"
        fi

        verifications=$(echo "$verifications" | jq --arg id "$issue_id" --arg status "$status" --arg note "$note" \
            '. + [{"id":$id,"status":$status,"note":$note}]')
        idx=$(( idx + 1 ))
    done

    # Write verification result
    jq -n \
        --argjson verifications "$verifications" \
        --argjson files_changed "$files_changed_count" \
        --arg build_ok "$build_ok" \
        --argjson fixed "$fixed_count" \
        --argjson partial "$partial_count" \
        --argjson unfixed "$unfixed_count" \
        '{verifications:$verifications,files_changed:$files_changed,fixed:$fixed,partial:$partial,unfixed:$unfixed,regression_detected:(if $build_ok == "false" then true else false end)}' \
        > "$verify_file"

    TOTAL_FILES_CHANGED=$(( TOTAL_FILES_CHANGED + files_changed_count ))

    success "${module_name} verification: ${fixed_count} fixed, ${partial_count} partial, ${unfixed_count} not fixed"

    echo "$verify_file"
}

# ── Git commit changes ─────────────────────────────────────────────────────────
commit_cycle() {
    local cycle_num="$1"
    local modules_processed="$2"
    local cycle_cost="$3"

    if [ "$DRY_RUN" = "true" ]; then return 0; fi

    # Must cd into the project dir — git -C has issues with mounted filesystems
    (
        cd "$PROJECT_DIR" || return 1

        # Check if there are actual changes
        local changed_files
        changed_files=$(git diff --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
        if [ -z "$changed_files" ]; then
            echo "[commit_cycle] No changes to commit in cycle ${cycle_num}" >&2
            return 0
        fi

        # Add source and config files explicitly (avoid git add -A which can stage sensitive files)
        git add src/ supabase/ package.json package-lock.json tsconfig.json vite.config.ts 2>/dev/null || true
        git add supabase/ public/ 2>/dev/null || true
        # Only add known safe markdown files, not all *.md (avoids staging engine logs)
        for md_file in LEARNINGS.md VISION.md FEEDBACK.md README.md; do
            [ -f "$md_file" ] && git add "$md_file" 2>/dev/null || true
        done

        # Only commit if there are actual staged changes
        if git diff --cached --quiet 2>/dev/null; then
            echo "[commit_cycle] No staged changes in cycle ${cycle_num} — skipping commit" >&2
            return 0
        fi

        if ! git commit -m "engine: cycle ${cycle_num} — ${modules_processed} modules, \$${cycle_cost} spend" 2>/dev/null; then
            echo "[commit_cycle] Commit failed for cycle ${cycle_num}" >&2
            return 1
        fi

        # Verify commit actually landed
        if ! git diff --cached --quiet 2>/dev/null; then
            echo "[commit_cycle] WARNING: staged changes remain after commit — commit may have failed" >&2
        fi
    )
    local commit_exit=$?

    # Auto-tag major milestones
    if [ "$AUTO_GIT_TAG" = "true" ] && [ $(( cycle_num % 5 )) -eq 0 ]; then
        local tag_name="engine-milestone-${TIMESTAMP}-c${cycle_num}"
        (cd "$PROJECT_DIR" && git tag "$tag_name" 2>/dev/null) || true
        log "Tagged milestone: ${tag_name}"
    fi

    if [ "$commit_exit" -eq 0 ]; then
        success "Committed cycle ${cycle_num} changes"
    else
        warn "Cycle ${cycle_num} commit may have failed — changes preserved in working tree"
    fi
}

# ── Self-learning: update LEARNINGS.md after each cycle ──────────────────────
# The engine tracks what it learns across cycles so it gets smarter over time.
# This file persists across runs — the engine reads it back on subsequent nights.
update_learnings() {
    local cycle_dir="$1"
    local learnings_file="${PROJECT_DIR}/LEARNINGS.md"

    # Initialize if first time
    if [ ! -f "$learnings_file" ]; then
        {
            echo "# Engine Learnings"
            echo ""
            echo "Auto-generated by the evolution engine. Tracks patterns, wins, and mistakes across runs."
            echo "The engine reads this before every audit to avoid repeating mistakes and amplify what works."
            echo ""
        } > "$learnings_file"
    fi

    # Collect this cycle's results
    local cycle_summary=""
    local total_fixed=0
    local total_unfixed=0
    local module_scores=""

    for audit_file in "${cycle_dir}"/audit_*.json; do
        [ -f "$audit_file" ] || continue
        local mod
        mod=$(jq -r '.module // "unknown"' "$audit_file" 2>/dev/null)
        local score
        score=$(jq -r '.overall_score // 0' "$audit_file" 2>/dev/null)
        local issues
        issues=$(jq '(.issues // []) | length' "$audit_file" 2>/dev/null || echo 0)
        module_scores+="  ${mod}: ${score}/100 (${issues} issues)\n"

        # Count verification results
        local verify_file="${cycle_dir}/verify_${mod}.json"
        if [ -f "$verify_file" ]; then
            local fixed
            fixed=$(jq '[.verifications[]? | select(.status=="fixed")] | length' "$verify_file" 2>/dev/null || echo 0)
            local unfixed
            unfixed=$(jq '[.verifications[]? | select(.status=="not_fixed")] | length' "$verify_file" 2>/dev/null || echo 0)
            total_fixed=$(( total_fixed + fixed ))
            total_unfixed=$(( total_unfixed + unfixed ))
        fi
    done

    # Calculate fix rate
    local total_attempted=$(( total_fixed + total_unfixed ))
    local fix_rate="N/A"
    if [ "$total_attempted" -gt 0 ]; then
        fix_rate=$(( total_fixed * 100 / total_attempted ))
    fi

    # Determine thinking mode for this cycle
    local thinking_mode="surgeon"
    if [ "$CYCLE" -le 3 ]; then thinking_mode="surgeon"
    elif [ "$CYCLE" -le 10 ]; then thinking_mode="architect"
    else thinking_mode="visionary"; fi

    # Append to learnings
    {
        echo ""
        echo "## Cycle ${CYCLE} — $(date +%Y-%m-%d\ %H:%M) — MODE: $(echo "$thinking_mode" | tr '[:lower:]' '[:upper:]')"
        echo ""
        echo "Spend: \$${CYCLE_SPEND} | Fix rate: ${fix_rate}% (${total_fixed}/${total_attempted})"
        echo ""
        echo -e "${module_scores}"
        if [ "$total_unfixed" -gt 0 ]; then
            echo "Unfixed issues carried forward. The engine should prioritize these next cycle."
        fi
        if [ "$fix_rate" != "N/A" ] && [ "$fix_rate" -lt 50 ] 2>/dev/null; then
            echo "ADAPT: Low fix rate. Generate simpler, more targeted prompts next cycle."
        fi
        if [ "$fix_rate" != "N/A" ] && [ "$fix_rate" -gt 80 ] 2>/dev/null; then
            echo "MOMENTUM: High fix rate. Current prompt strategy is working well."
        fi
    } >> "$learnings_file"

    # Prune learnings file if too long (keep last 30 cycles worth)
    if [ -f "$learnings_file" ]; then
        local line_count
        line_count=$(wc -l < "$learnings_file" 2>/dev/null || echo 0)
        if [ "$line_count" -gt 500 ]; then
            log "Pruning LEARNINGS.md (${line_count} lines → keeping last 300)"
            tail -300 "$learnings_file" > "${learnings_file}.tmp" && mv "${learnings_file}.tmp" "$learnings_file"
        fi
    fi

    log "Learnings updated: ${learnings_file}"
}

# ── Dynamic strategy: adjust approach based on score trends ──────────────────
# v6.0: Now also computes score variance to detect erratic modules
get_strategy_context() {
    local mod_name="$1"
    local strategy=""

    # Check score trend for this module
    local score_file="${SCORES_DIR}/${mod_name}.txt"
    if [ -f "$score_file" ]; then
        local score_count
        score_count=$(wc -l < "$score_file" | tr -d ' ')

        if [ "$score_count" -ge 2 ]; then
            local prev_line=$(( score_count - 1 ))
            local prev
            prev=$(sed -n "${prev_line}p" "$score_file" 2>/dev/null | tr -dc '0-9')
            local curr
            curr=$(tail -1 "$score_file" 2>/dev/null | tr -dc '0-9')

            if [ -n "$prev" ] && [ -n "$curr" ]; then
                local delta=$(( curr - prev ))
                if [ "$delta" -gt 5 ]; then
                    strategy+="MOMENTUM: Score improved by ${delta} points last cycle. Keep this approach.\n"
                elif [ "$delta" -lt -5 ]; then
                    strategy+="REGRESSION: Score dropped by $(( delta * -1 )) points. Something broke. Prioritize fixing regressions over new work.\n"
                elif [ "$delta" -ge -2 ] && [ "$delta" -le 2 ]; then
                    strategy+="PLATEAU: Score is flat. Try different dimensions. Focus on the 3 lowest-scoring dimensions.\n"
                fi
            fi

            # Detect erratic scores (high variance = unstable module)
            if [ "$score_count" -ge 3 ]; then
                local all_scores
                all_scores=$(tail -5 "$score_file" | grep -v '^$' | tr '\n' ' ')
                local min=100 max=0
                for s in $all_scores; do
                    s=$(echo "$s" | tr -dc '0-9')
                    [ -z "$s" ] && continue
                    [ "$s" -lt "$min" ] 2>/dev/null && min="$s"
                    [ "$s" -gt "$max" ] 2>/dev/null && max="$s"
                done
                local spread=$(( max - min ))
                if [ "$spread" -gt 20 ]; then
                    strategy+="ERRATIC: Scores swing wildly (${min} to ${max}). Fixes may be causing regressions elsewhere. Make smaller, safer changes.\n"
                fi
            fi
        fi

        # Show score history in strategy
        if [ "$score_count" -ge 1 ]; then
            local history
            history=$(tail -5 "$score_file" | grep -v '^$' | tr '\n' ' → ' | sed 's/ → $//')
            strategy+="SCORE HISTORY: ${history}\n"
        fi
    fi

    # Check learnings file for relevant patterns
    local learnings_file="${PROJECT_DIR}/LEARNINGS.md"
    if [ -f "$learnings_file" ]; then
        local recent_learnings
        recent_learnings=$(tail -30 "$learnings_file" 2>/dev/null)
        if echo "$recent_learnings" | grep -q "ADAPT:"; then
            strategy+="ADAPTATION: Recent cycles had low fix rates. Generate simpler, more targeted prompts.\n"
        fi
        if echo "$recent_learnings" | grep -q "MOMENTUM:"; then
            strategy+="PROVEN: Recent prompts are landing. Continue with similar specificity.\n"
        fi
    fi

    echo -e "$strategy"
}

# ── Check if all modules are clean ────────────────────────────────────────────
check_all_clean() {
    local cycle_dir="$1"
    local all_clean=true

    for audit_file in "${cycle_dir}"/audit_*.json; do
        [ -f "$audit_file" ] || continue
        local mod_name
        mod_name=$(jq -r '.module // "unknown"' "$audit_file")
        local issue_count
        issue_count=$(jq '[(.issues // [])[] | select(.severity=="critical" or .severity=="high")] | length' "$audit_file" 2>/dev/null || echo 1)
        if [ "$issue_count" -gt 0 ]; then
            all_clean=false
            break
        fi
    done

    echo "$all_clean"
}

# ── Completion notification ────────────────────────────────────────────────────
notify_completion() {
    local status="$1"
    if [ -z "$NOTIFY_WEBHOOK" ]; then return 0; fi

    local message
    message="SiteSyncAI Engine ${status} | Cycle ${CYCLE}/${MAX_CYCLES} | \$${ESTIMATED_SPEND} spend | $(elapsed) elapsed | ${TOTAL_PROMPTS_EXECUTED} prompts executed | ${FEATURES_INVENTED} features invented"

    local json_payload
    json_payload=$(jq -n --arg msg "$message" '{text: $msg}')
    curl -s -X POST "$NOTIFY_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        > /dev/null 2>&1 || true
}

# ── Generate morning briefing (HTML + Markdown) ──────────────────────────────
generate_report() {
    local status="${1:-COMPLETE}"
    local report_md="${RUN_DIR}/MORNING_BRIEFING.md"
    local report_html="${RUN_DIR}/MORNING_BRIEFING.html"

    log "Writing morning briefing..."

    # ── Collect data for both reports ──
    local score_rows=""
    local score_rows_html=""
    for score_file in "${SCORES_DIR}"/*.txt; do
        [ -f "$score_file" ] || continue
        local mod
        mod=$(basename "$score_file" .txt)
        local scores
        scores=$(tr '\n' ' → ' < "$score_file" | sed 's/ → $//')
        local latest
        latest=$(tail -1 "$score_file" 2>/dev/null || echo "N/A")
        score_rows+="| ${mod} | ${scores} | **${latest}** |\n"
        # Color code the latest score for HTML
        local color="#F47820"
        if [ "${latest:-0}" -ge 80 ] 2>/dev/null; then color="#4EC896"
        elif [ "${latest:-0}" -ge 60 ] 2>/dev/null; then color="#F4A420"
        elif [ "${latest:-0}" -ge 40 ] 2>/dev/null; then color="#E74C3C"; fi
        score_rows_html+="<tr><td>${mod}</td><td class='dim'>${scores}</td><td style='color:${color};font-weight:700'>${latest}</td></tr>"
    done

    local git_log_text=""
    git_log_text=$(cd "$PROJECT_DIR" && git log --oneline -15 2>/dev/null || echo "No git history")
    # HTML-escape git log to prevent XSS from commit messages containing HTML/script tags
    local git_log_html
    git_log_html=$(printf '%s' "$git_log_text" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g')

    local unresolved_md=""
    local unresolved_html=""
    local last_cycle_dir="${RUN_DIR}/cycle_${CYCLE}"
    if [ -d "$last_cycle_dir" ]; then
        for audit_file in "${last_cycle_dir}"/audit_*.json; do
            [ -f "$audit_file" ] || continue
            local mod_label
            mod_label=$(jq -r '.module // "unknown"' "$audit_file")
            local high_issues
            high_issues=$(jq -r '(.issues // [])[] | select(.severity=="critical" or .severity=="high") | "[\(.severity)] \(.title)"' "$audit_file" 2>/dev/null | head -5)
            if [ -n "$high_issues" ]; then
                unresolved_md+="### ${mod_label}\n"
                while IFS= read -r line; do
                    unresolved_md+="- ${line}\n"
                    local sev_class="tag-warn"
                    echo "$line" | grep -q "critical" && sev_class="tag-crit"
                    unresolved_html+="<div class='issue'><span class='${sev_class}'>${line%%]*}]</span> ${line#*] }</div>"
                done <<< "$high_issues"
            fi
        done
    fi

    local invented_md=""
    local invented_html=""
    if [ "$FEATURES_INVENTED" -gt 0 ] && [ -d "$last_cycle_dir" ]; then
        for audit_file in "${last_cycle_dir}"/audit_*.json; do
            [ -f "$audit_file" ] || continue
            local inv_data
            inv_data=$(jq -r '.invented_features[]? | "\(.title)||||\(.description // "")"' "$audit_file" 2>/dev/null)
            while IFS= read -r line; do
                [ -z "$line" ] && continue
                local inv_title="${line%%%%||||*}"
                local inv_desc="${line#*||||}"
                invented_md+="- **${inv_title}**: ${inv_desc}\n"
                invented_html+="<div class='invention'><strong>${inv_title}</strong><br/><span class='dim'>${inv_desc}</span></div>"
            done <<< "$inv_data"
        done
    fi

    # ── Markdown report ──
    {
        echo "# SiteSyncAI — Morning Briefing"
        echo ""
        echo "> The engine ran while you slept. Here is what changed."
        echo ""
        echo "| Metric | Value |"
        echo "|---|---|"
        echo "| Status | ${status} |"
        echo "| Run | ${TIMESTAMP} |"
        echo "| Duration | $(elapsed) |"
        echo "| Cycles | ${CYCLE} |"
        echo "| Spend | \$${ESTIMATED_SPEND} |"
        echo "| Prompts | ${TOTAL_PROMPTS_EXECUTED} |"
        echo "| Inventions | ${FEATURES_INVENTED} |"
        echo ""
        echo "## Module Scores"
        echo ""
        echo "| Module | History | Latest |"
        echo "|--------|---------|--------|"
        echo -e "$score_rows"
        echo ""
        echo "## Recent Commits"
        echo ""
        echo '```'
        echo "$git_log_text"
        echo '```'
        echo ""
        if [ -n "$unresolved_md" ]; then
            echo "## Unresolved Issues"
            echo ""
            echo -e "$unresolved_md"
        fi
        if [ -n "$invented_md" ]; then
            echo "## Features Invented"
            echo ""
            echo -e "$invented_md"
        fi
    } > "$report_md"

    # ── HTML report (beautiful, open in browser) ──
    cat > "$report_html" << HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SiteSync AI — Morning Briefing</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0F1629;color:#E8E9ED;padding:2rem}
.container{max-width:960px;margin:0 auto}
h1{font-size:1.8rem;color:#F47820;margin-bottom:.2rem}
.subtitle{color:#8B8FA3;font-size:.9rem;margin-bottom:2rem}
.status-badge{display:inline-block;padding:.3rem .8rem;border-radius:4px;font-weight:700;font-size:.85rem;
  background:$([ "$status" = "COMPLETE" ] && echo "#4EC896" || echo "#F4A420");color:#0F1629}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin:1.5rem 0}
.metric{background:#1A2035;border-radius:8px;padding:1rem;text-align:center}
.metric .value{font-size:1.6rem;font-weight:700;color:#F47820}
.metric .label{font-size:.75rem;color:#8B8FA3;margin-top:.3rem}
h2{font-size:1.1rem;color:#CBD0DC;margin:2rem 0 1rem;border-bottom:1px solid #2A3050;padding-bottom:.5rem}
table{width:100%;border-collapse:collapse;margin:.5rem 0}
th{text-align:left;padding:.5rem;color:#8B8FA3;font-size:.75rem;text-transform:uppercase;border-bottom:1px solid #2A3050}
td{padding:.5rem;font-size:.85rem;border-bottom:1px solid #1A2035}
.dim{color:#6B7080}
pre{background:#1A2035;border-radius:6px;padding:1rem;overflow-x:auto;font-size:.8rem;color:#CBD0DC;margin:.5rem 0}
.issue{padding:.4rem 0;font-size:.85rem}
.tag-crit{background:#E74C3C22;color:#E74C3C;padding:.15rem .4rem;border-radius:3px;font-size:.75rem;font-weight:600}
.tag-warn{background:#F4A42022;color:#F4A420;padding:.15rem .4rem;border-radius:3px;font-size:.75rem;font-weight:600}
.invention{background:#1A2035;border-left:3px solid #F47820;padding:.6rem 1rem;margin:.5rem 0;border-radius:0 6px 6px 0}
.footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid #2A3050;color:#6B7080;font-size:.8rem;text-align:center}
.footer em{color:#8B8FA3}
</style>
</head>
<body>
<div class="container">
<h1>SiteSync AI — Morning Briefing</h1>
<p class="subtitle"><span class="status-badge">${status}</span> &nbsp; Run ${TIMESTAMP} &nbsp;|&nbsp; $(elapsed)</p>

<div class="grid">
<div class="metric"><div class="value">${CYCLE}</div><div class="label">Cycles</div></div>
<div class="metric"><div class="value">\$${ESTIMATED_SPEND}</div><div class="label">API Spend</div></div>
<div class="metric"><div class="value">${TOTAL_PROMPTS_EXECUTED}</div><div class="label">Prompts Run</div></div>
<div class="metric"><div class="value">${TOTAL_FILES_CHANGED}</div><div class="label">Files Changed</div></div>
<div class="metric"><div class="value">${FEATURES_INVENTED}</div><div class="label">Inventions</div></div>
</div>

<h2>Module Score Trending</h2>
<table>
<thead><tr><th>Module</th><th>History</th><th>Latest</th></tr></thead>
<tbody>${score_rows_html}</tbody>
</table>

<h2>Recent Commits</h2>
<pre>${git_log_html}</pre>

$([ -n "$unresolved_html" ] && echo "<h2>Unresolved Issues</h2>${unresolved_html}")

$([ -n "$invented_html" ] && echo "<h2>Features Invented</h2><p class='dim'>These did not exist in any construction software before last night.</p>${invented_html}")

<div class="footer">
<p>The construction industry runs \$2 trillion of projects per year on software that treats the people building it as an afterthought.</p>
<p><em>That ends here. — Built for Walker Benner.</em></p>
</div>
</div>
</body>
</html>
HTMLEOF

    success "Morning briefing: ${report_html}"
    success "Morning briefing: ${report_md}"
}

# ── Main loop ─────────────────────────────────────────────────────────────────

# ── INFRASTRUCTURE: Supabase provisioning and edge function deployment ────────
# Runs once at engine start. Checks if Supabase CLI is available, migrations
# have been pushed, and edge functions are deployed. Fixes what it can.
provision_infrastructure() {
    log "INFRA: Checking infrastructure status..."

    local infra_status="${RUN_DIR}/infra_status.json"
    local supabase_ok=false
    local migrations_ok=false
    local functions_ok=false
    local env_ok=false

    # Check .env.local exists with required keys
    local env_file="${PROJECT_DIR}/.env.local"
    if [ -f "$env_file" ]; then
        if grep -q 'VITE_SUPABASE_URL' "$env_file" 2>/dev/null && \
           grep -q 'VITE_SUPABASE_ANON_KEY' "$env_file" 2>/dev/null && \
           grep -q 'SUPABASE_SERVICE_ROLE_KEY' "$env_file" 2>/dev/null; then
            env_ok=true
            success "INFRA: .env.local configured with Supabase credentials"
        else
            warn "INFRA: .env.local exists but missing some keys"
        fi
    else
        warn "INFRA: No .env.local found — Supabase integration will use fallback values"
    fi

    # Check if Supabase CLI is installed
    if command -v supabase >/dev/null 2>&1; then
        supabase_ok=true
        local sb_version
        sb_version=$(supabase --version 2>&1 || true)
        sb_version="${sb_version%%$'\n'*}"
        success "INFRA: Supabase CLI found (${sb_version})"

        # Check if project is linked
        # NOTE: supabase link requires interactive auth (browser/token).
        # We NEVER try to auto-link because it hangs in non-interactive shells.
        # The user must run: supabase link --project-ref REF manually (or via setup.sh).
        local linked=false
        if [ -f "${PROJECT_DIR}/supabase/.temp/project-ref" ]; then
            linked=true
            success "INFRA: Supabase project linked (ref: $(cat "${PROJECT_DIR}/supabase/.temp/project-ref" 2>/dev/null))"
        else
            local project_ref
            project_ref=$(grep 'SUPABASE_PROJECT_REF' "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d ' "'"'"'')
            warn "INFRA: Supabase project NOT linked. Run this first:"
            warn "  cd ${PROJECT_DIR} && supabase link --project-ref ${project_ref:-YOUR_REF}"
            log "INFRA: Skipping migrations and function deploy (project not linked)"
        fi

        # Push migrations if linked
        if [ "$linked" = "true" ]; then
            log "INFRA: Pushing database migrations..."
            local push_output
            push_output=$(cd "$PROJECT_DIR" && supabase db push 2>&1) || true
            if echo "$push_output" | grep -qi "error\|fatal" 2>/dev/null; then
                warn "INFRA: Some migrations may have failed. Check: supabase db push"
                log "INFRA: Output: $(echo "$push_output" | tail -5)"
            else
                migrations_ok=true
                success "INFRA: Database migrations pushed"
            fi

            # Deploy edge functions
            local functions_dir="${PROJECT_DIR}/supabase/functions"
            if [ -d "$functions_dir" ]; then
                local func_count=0
                local func_ok=0
                for func_dir in "$functions_dir"/*/; do
                    [ -d "$func_dir" ] || continue
                    local func_name
                    func_name=$(basename "$func_dir")
                    # Skip directories without an index.ts
                    [ -f "${func_dir}/index.ts" ] || continue
                    func_count=$(( func_count + 1 ))
                    log "INFRA: Deploying edge function: ${func_name}..."
                    if (cd "$PROJECT_DIR" && supabase functions deploy "$func_name" --no-verify-jwt 2>/dev/null); then
                        func_ok=$(( func_ok + 1 ))
                    else
                        warn "INFRA: Failed to deploy ${func_name}"
                    fi
                done
                if [ "$func_count" -gt 0 ]; then
                    if [ "$func_ok" -eq "$func_count" ]; then
                        functions_ok=true
                        success "INFRA: All ${func_count} edge functions deployed"
                    else
                        warn "INFRA: ${func_ok}/${func_count} edge functions deployed"
                    fi
                fi
            fi
        fi
    else
        warn "INFRA: Supabase CLI not installed. Install with: brew install supabase/tap/supabase"
        log "INFRA: Engine will still work — it will generate code for Supabase, just won't auto-push migrations"
    fi

    # Check if Vercel CLI is available (for deploy phase)
    local vercel_ok=false
    if command -v vercel >/dev/null 2>&1; then
        vercel_ok=true
        success "INFRA: Vercel CLI found"
    else
        log "INFRA: Vercel CLI not installed. Auto-deploy disabled. Install with: npm i -g vercel && vercel link"
    fi

    # Check if Playwright is available (for E2E tests)
    # NOTE: npx playwright can hang on first run. Use timeout to prevent blocking.
    local playwright_ok=false
    if timeout 10 npx playwright --version >/dev/null 2>&1; then
        playwright_ok=true
        success "INFRA: Playwright available for E2E tests"
    else
        warn "INFRA: Playwright not available or timed out. E2E tests will be skipped."
        log "INFRA: To install manually: cd ${PROJECT_DIR} && npx playwright install chromium"
    fi

    # Write status file
    jq -n \
        --argjson env_ok "$( [ "$env_ok" = "true" ] && echo true || echo false )" \
        --argjson supabase_cli "$( [ "$supabase_ok" = "true" ] && echo true || echo false )" \
        --argjson migrations "$( [ "$migrations_ok" = "true" ] && echo true || echo false )" \
        --argjson functions "$( [ "$functions_ok" = "true" ] && echo true || echo false )" \
        --argjson vercel "$( [ "$vercel_ok" = "true" ] && echo true || echo false )" \
        --argjson playwright "$( [ "$playwright_ok" = "true" ] && echo true || echo false )" \
        '{
            env_configured: $env_ok,
            supabase_cli: $supabase_cli,
            migrations_pushed: $migrations,
            functions_deployed: $functions,
            vercel_available: $vercel,
            playwright_available: $playwright
        }' > "$infra_status" 2>/dev/null || true

    success "INFRA: Infrastructure check complete"
}

# ── E2E TESTING: Playwright browser tests against the running app ─────────────
# Spins up the dev server, runs real user flows (navigate, click, fill forms),
# and reports pass/fail. This catches issues that build + unit tests miss.
run_e2e_tests() {
    local cycle_dir="$1"
    local e2e_results="${cycle_dir}/e2e_results.json"

    # Only run every 3 cycles to save time
    if [ $(( CYCLE % 3 )) -ne 0 ] && [ "$CYCLE" -ne 1 ]; then
        log "E2E: Skipping (runs every 3 cycles, next at cycle $(( CYCLE + 3 - CYCLE % 3 )))"
        return 0
    fi

    # Check if Playwright is available
    local infra_status="${RUN_DIR}/infra_status.json"
    if [ -f "$infra_status" ]; then
        local pw_ok
        pw_ok=$(jq -r '.playwright_available // false' "$infra_status" 2>/dev/null)
        if [ "$pw_ok" != "true" ]; then
            log "E2E: Playwright not available, skipping"
            return 0
        fi
    fi

    log "E2E: Starting browser tests..."

    # Check if test file exists, create if not
    local test_dir="${PROJECT_DIR}/e2e"
    local test_file="${test_dir}/smoke.spec.ts"
    if [ ! -f "$test_file" ]; then
        log "E2E: Generating smoke test suite via Claude Code..."
        local e2e_prompt="Create a Playwright E2E smoke test file at e2e/smoke.spec.ts for this React + Vite construction management app.

The app runs on http://localhost:5173 and uses HashRouter.

Write tests that:
1. Navigate to the app and verify it loads (check for the sidebar)
2. Click each main nav item (Dashboard, RFIs, Submittals, Schedule, Budget, Daily Log, Punch List) and verify the page loads
3. Check that metric cards render on the Dashboard
4. Verify the AI Copilot page loads with a chat interface
5. Check that tables render with data rows on list pages

Use page.waitForSelector with reasonable timeouts (10s).
Do NOT test auth flows (there is no login page yet in the prototype).
Create the e2e/ directory if it doesn't exist.
Also create playwright.config.ts at the project root with:
  - baseURL: http://localhost:5173
  - webServer that runs 'npm run dev' on port 5173
  - chromium only
  - screenshot on failure"

        if run_claude_code "$e2e_prompt" "${cycle_dir}/e2e_generate.log" 180; then
            ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.08" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
            CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.08" | bc 2>/dev/null || echo "$CYCLE_SPEND")
            success "E2E: Test suite generated"
        else
            warn "E2E: Could not generate test suite"
            return 0
        fi
    fi

    # Run the tests
    log "E2E: Running Playwright tests..."
    local e2e_output
    e2e_output=$(cd "$PROJECT_DIR" && timeout 120 npx playwright test --reporter=json 2>&1 | tail -100) || true

    # Parse results
    local passed=0
    local failed=0
    local total=0
    passed=$(echo "$e2e_output" | jq -r '.stats.expected // 0' 2>/dev/null || echo 0)
    failed=$(echo "$e2e_output" | jq -r '.stats.unexpected // 0' 2>/dev/null || echo 0)
    total=$(( passed + failed ))

    # Write results
    jq -n \
        --argjson cycle "$CYCLE" \
        --argjson passed "${passed:-0}" \
        --argjson failed "${failed:-0}" \
        --argjson total "${total:-0}" \
        '{cycle: $cycle, passed: $passed, failed: $failed, total: $total, pass_rate: (if $total > 0 then ($passed * 100 / $total) else 0 end)}' \
        > "$e2e_results" 2>/dev/null || true

    # Append to trending
    jq -c '.' "$e2e_results" >> "${RUN_DIR}/e2e_trend.jsonl" 2>/dev/null || true

    if [ "${failed:-0}" -gt 0 ]; then
        warn "E2E: ${passed}/${total} passed, ${failed} FAILED"
        # Feed failures back to Claude Code to fix
        log "E2E: Feeding failures to Claude Code for auto-fix..."
        local fix_prompt="Playwright E2E tests failed. Here are the results:

${e2e_output}

Fix the issues in the source code (NOT the test file) so these tests pass.
The app is a React + TypeScript + Vite construction management platform.
Run 'npm run build' after fixing to verify the build still works."

        if run_claude_code "$fix_prompt" "${cycle_dir}/e2e_fix.log" 240; then
            ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.12" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
            CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.12" | bc 2>/dev/null || echo "$CYCLE_SPEND")
            success "E2E: Auto-fix applied for ${failed} failing tests"
        fi
    else
        success "E2E: All ${total} tests passed"
    fi
}

# ── DEPLOY: Auto-deploy to Vercel after successful cycles ─────────────────────
# Only deploys if: build passes, quality gates are green, and Vercel CLI is
# available. Preview deploys on every cycle, production only on final.
deploy_cycle() {
    local cycle_dir="$1"
    local is_final="${2:-false}"
    local deploy_file="${cycle_dir}/deploy.json"

    # Check if Vercel is available
    local infra_status="${RUN_DIR}/infra_status.json"
    if [ -f "$infra_status" ]; then
        local vercel_ok
        vercel_ok=$(jq -r '.vercel_available // false' "$infra_status" 2>/dev/null)
        if [ "$vercel_ok" != "true" ]; then
            log "DEPLOY: Vercel not available, skipping"
            return 0
        fi
    else
        return 0
    fi

    # Check if Vercel project is actually linked (not just CLI installed)
    if [ ! -f "${PROJECT_DIR}/.vercel/project.json" ]; then
        log "DEPLOY: Vercel project not linked, skipping. Run: cd ${PROJECT_DIR} && vercel link"
        return 0
    fi

    # Only deploy every 5 cycles (or final cycle) to avoid spamming
    if [ "$is_final" != "true" ] && [ $(( CYCLE % 5 )) -ne 0 ]; then
        log "DEPLOY: Skipping (deploys every 5 cycles, next at cycle $(( CYCLE + 5 - CYCLE % 5 )))"
        return 0
    fi

    # Check build passes first
    if [ -n "$BUILD_CMD" ]; then
        if ! (run_build > /dev/null 2>&1); then
            warn "DEPLOY: Build failing, skipping deploy"
            return 0
        fi
    fi

    log "DEPLOY: Deploying to Vercel..."

    local deploy_output
    local deploy_url=""

    if [ "$is_final" = "true" ]; then
        log "DEPLOY: PRODUCTION deploy (final cycle)"
        deploy_output=$(cd "$PROJECT_DIR" && timeout "$DEPLOY_TIMEOUT" vercel --prod --yes 2>&1) || true
    else
        deploy_output=$(cd "$PROJECT_DIR" && timeout "$DEPLOY_TIMEOUT" vercel --yes 2>&1) || true
    fi

    # Extract deploy URL
    deploy_url=$(echo "$deploy_output" | grep -oE 'https://[^ ]+\.vercel\.app' | head -1 || echo "")

    # Write results
    jq -n \
        --argjson cycle "$CYCLE" \
        --arg url "$deploy_url" \
        --arg type "$([ "$is_final" = "true" ] && echo "production" || echo "preview")" \
        '{cycle: $cycle, deploy_url: $url, deploy_type: $type, timestamp: now | todate}' \
        > "$deploy_file" 2>/dev/null || true

    if [ -n "$deploy_url" ]; then
        success "DEPLOY: Live at ${deploy_url}"
    else
        warn "DEPLOY: Deploy may have failed. Check: vercel ls"
        log "DEPLOY: Output: $(echo "$deploy_output" | tail -5)"
    fi
}

# ── RE-PUSH MIGRATIONS: After engine modifies Supabase files ──────────────────
# If the engine created or modified migration files, push them.
sync_supabase() {
    local cycle_dir="$1"

    # Check if Supabase CLI is linked
    if ! command -v supabase >/dev/null 2>&1; then return 0; fi
    if [ ! -f "${PROJECT_DIR}/supabase/.temp/project-ref" ]; then return 0; fi

    # Check if any migration files were modified this cycle
    local migration_changes
    migration_changes=$(cd "$PROJECT_DIR" && git diff --name-only HEAD~1 2>/dev/null | grep "supabase/migrations\|supabase/functions" || echo "")

    if [ -n "$migration_changes" ]; then
        log "SYNC: Supabase files changed this cycle, pushing..."

        # Push new migrations
        if echo "$migration_changes" | grep -q "migrations"; then
            local push_out
            push_out=$(cd "$PROJECT_DIR" && supabase db push 2>&1) || true
            if echo "$push_out" | grep -qi "error"; then
                warn "SYNC: Migration push had errors: $(echo "$push_out" | tail -3)"
            else
                success "SYNC: Migrations pushed"
            fi
        fi

        # Deploy modified functions
        if echo "$migration_changes" | grep -q "functions"; then
            for changed_func in $(echo "$migration_changes" | grep "functions/" | sed 's|supabase/functions/||; s|/.*||' | sort -u); do
                if [ -f "${PROJECT_DIR}/supabase/functions/${changed_func}/index.ts" ]; then
                    log "SYNC: Deploying updated function: ${changed_func}"
                    (cd "$PROJECT_DIR" && supabase functions deploy "$changed_func" --no-verify-jwt 2>/dev/null) || true
                fi
            done
            success "SYNC: Edge functions redeployed"
        fi
    fi
}

main() {
    preflight

    # INFRASTRUCTURE: One-time setup check
    provision_infrastructure

    # Take initial snapshot
    local snapshot_file
    snapshot_file=$(take_snapshot)

    # Decompose into modules
    local modules_file
    modules_file=$(decompose_modules "$snapshot_file")

    local modules
    modules=$(jq -r '.modules | sort_by(.priority)' "$modules_file")
    local module_count
    module_count=$(echo "$modules" | jq 'length')

    # Read founder context once (used in every audit)
    local founder_context
    founder_context=$(read_founder_context)

    header "STARTING EVOLUTION LOOP: ${module_count} modules, ${MAX_CYCLES} cycles max, \$${MAX_SPEND} budget"

    # Per-module unresolved issues are tracked via prior_*.txt files (bash 3 compatible)

    CYCLE=$RESUME_CYCLE

    while true; do
        CYCLE=$(( CYCLE + 1 ))
        CYCLE_SPEND="0.00"

        # Check cycle limit
        if [ "$CYCLE" -gt "$MAX_CYCLES" ]; then
            warn "Max cycles (${MAX_CYCLES}) reached"
            break
        fi

        # Check budget (decimal-safe comparison via bc)
        if [ "$(echo "${ESTIMATED_SPEND:-0} >= ${MAX_SPEND:-500}" | bc 2>/dev/null)" = "1" ]; then
            warn "Budget limit \$${MAX_SPEND} reached (spent \$${ESTIMATED_SPEND})"
            break
        fi

        # Progress calculation with ETA
        local progress_pct=$(( CYCLE * 100 / MAX_CYCLES ))
        local elapsed_secs=$(( $(date +%s) - START_TIME ))
        local eta_str="calculating..."
        if [ "$CYCLE" -gt 1 ] && [ "$elapsed_secs" -gt 0 ]; then
            local secs_per_cycle=$(( elapsed_secs / (CYCLE - 1) ))
            local remaining_cycles=$(( MAX_CYCLES - CYCLE ))
            local eta_secs=$(( secs_per_cycle * remaining_cycles ))
            eta_str=$(printf "%dh %02dm" $(( eta_secs / 3600 )) $(( eta_secs % 3600 / 60 )))
        fi

        header "CYCLE ${CYCLE} / ${MAX_CYCLES} (${progress_pct}%) | Spent: \$${ESTIMATED_SPEND} / \$${MAX_SPEND} | $(elapsed) | ETA: ${eta_str}"

        local cycle_dir="${RUN_DIR}/cycle_${CYCLE}"
        mkdir -p "$cycle_dir"

        # Re-snapshot if codebase changed
        snapshot_file=$(take_snapshot)

        # ── META: Strategic planning phase ──
        # Before diving into audits, review scores and create a plan.
        plan_cycle "$cycle_dir" "$CYCLE"

        # ── GOOGLE INTELLIGENCE: Data-driven module ordering ──
        # Sort modules by score ascending so the WORST modules get attention first.
        # Modules scoring >90 for 3+ consecutive cycles are auto-skipped (mastered).
        # This prevents wasting tokens polishing perfect modules while bad ones rot.
        local sorted_modules="$modules"
        if [ -d "$SCORES_DIR" ] && [ "$(ls -A "$SCORES_DIR" 2>/dev/null)" ]; then
            sorted_modules=$(echo "$modules" | jq --arg dir "$SCORES_DIR" '
                [.[] | . as $mod |
                    {mod: ., score: (
                        ($dir + "/" + .name + ".txt") as $f |
                        try (input | tonumber) catch 50
                    )}
                ] | sort_by(.score) | [.[].mod]
            ' 2>/dev/null || echo "$modules")
            # Fallback if jq file reading fails (likely) — use shell to build order
            local order_file="${cycle_dir}/module_order.txt"
            : > "$order_file"
            local mod_idx=0
            while [ $mod_idx -lt "$module_count" ]; do
                local mn
                mn=$(echo "$modules" | jq -r ".[$mod_idx].name")
                local sf="${SCORES_DIR}/${mn}.txt"
                local latest_score=50
                if [ -f "$sf" ]; then
                    latest_score=$(tail -1 "$sf" | tr -dc '0-9')
                    [ -z "$latest_score" ] && latest_score=50
                fi
                echo "${latest_score} ${mod_idx}" >> "$order_file"
                mod_idx=$(( mod_idx + 1 ))
            done
            # Sort by score ascending (worst first)
            local sorted_order
            sorted_order=$(sort -n "$order_file" | awk '{print $2}')
            log "Module processing order (worst-first): $(sort -n "$order_file" | awk '{printf "%s(%s) ", $2, $1}')"
        fi

        local any_issues=false
        local modules_processed=0
        local modules_failed=0
        local cycle_total_fixed=0
        local cycle_total_attempted=0

        # Process each module (in score-sorted order if available)
        local process_order=""
        if [ -n "${sorted_order:-}" ]; then
            process_order="$sorted_order"
        else
            local seq_idx=0
            while [ $seq_idx -lt "$module_count" ]; do
                process_order="${process_order}${seq_idx}
"
                seq_idx=$(( seq_idx + 1 ))
            done
        fi

        local _mod_loop_counter=0
        for i in $process_order; do
            local module
            module=$(echo "$modules" | jq ".[$i]")
            local mod_name
            mod_name=$(echo "$module" | jq -r '.name')
            local mod_label
            mod_label=$(echo "$module" | jq -r '.label')
            local mod_desc
            mod_desc=$(echo "$module" | jq -r '.description')

            # Skip if requested
            if should_skip_module "$mod_name"; then
                log "Skipping module: ${mod_name}"
                continue
            fi

            # ── ADAPTIVE SKIPPING: Mastered modules get skipped ──
            # If a module scored >90 for 3+ consecutive cycles, skip it.
            # This frees budget for modules that actually need work.
            local score_file="${SCORES_DIR}/${mod_name}.txt"
            if [ -f "$score_file" ]; then
                local sc_count
                sc_count=$(wc -l < "$score_file" | tr -d ' ')
                if [ "${sc_count:-0}" -ge 3 ]; then
                    local all_above_90=true
                    local recent
                    recent=$(tail -3 "$score_file")
                    while IFS= read -r sc_line; do
                        local sc_val
                        sc_val=$(echo "$sc_line" | tr -dc '0-9')
                        if [ -n "$sc_val" ] && [ "$sc_val" -lt 90 ] 2>/dev/null; then
                            all_above_90=false
                            break
                        fi
                    done <<< "$recent"
                    if [ "$all_above_90" = "true" ]; then
                        log "MASTERED: ${mod_label} scored >90 for 3+ cycles — skipping to invest tokens elsewhere"
                        continue
                    fi
                fi
            fi

            # Cooldown between modules to prevent API rate limits on audit calls
            if [ "$_mod_loop_counter" -gt 0 ]; then
                sleep "$PROMPT_COOLDOWN"
            fi
            _mod_loop_counter=$(( _mod_loop_counter + 1 ))

            subheader "${mod_label}"

            # Check if this module is invention-eligible (score >= 85 for 3+ consecutive cycles)
            local invention_eligible="false"
            if [ "$INVENTION_MODE" = "true" ] && [ -f "${SCORES_DIR}/${mod_name}.txt" ]; then
                local score_count
                score_count=$(wc -l < "${SCORES_DIR}/${mod_name}.txt" | tr -d ' ')
                if [ "${score_count:-0}" -ge 3 ]; then
                    local recent_scores
                    recent_scores=$(tail -3 "${SCORES_DIR}/${mod_name}.txt" | tr '\n' ' ')
                    local all_high=true
                    for s in $recent_scores; do
                        s=$(echo "$s" | tr -dc '0-9')
                        if [ -n "$s" ] && [ "$s" -lt 85 ] 2>/dev/null; then all_high=false; break; fi
                    done
                    if [ "$all_high" = "true" ]; then
                        invention_eligible="true"
                        invent "Module ${mod_label} is in INVENTION MODE — pushing beyond known limits"
                    fi
                fi
            fi

            # Get prior unresolved issues for this module (file-based carry-forward)
            local prior=""
            local prior_file="${RUN_DIR}/prior_${mod_name}.txt"
            if [ -f "$prior_file" ]; then
                prior=$(cat "$prior_file")
            fi

            # Audit
            local audit_file
            audit_file=$(audit_module \
                "$mod_name" "$mod_label" "$mod_desc" \
                "$snapshot_file" "$cycle_dir" \
                "$prior" "$founder_context" "$invention_eligible")

            # Execute (skip if dry run)
            local exec_failed=false
            if [ "$DRY_RUN" != "true" ]; then
                if ! execute_prompts "$mod_name" "$audit_file" "$cycle_dir"; then
                    exec_failed=true
                    modules_failed=$(( modules_failed + 1 ))
                fi
            fi

            # Verify
            local verify_file
            verify_file=$(verify_changes "$mod_name" "$audit_file" "$snapshot_file" "$cycle_dir")

            # Track fix rates for cycle-level intelligence
            local mod_fixed
            mod_fixed=$(jq '.fixed // 0' "$verify_file" 2>/dev/null || echo 0)
            local mod_attempted
            mod_attempted=$(jq '(.fixed // 0) + (.partial // 0) + (.unfixed // 0)' "$verify_file" 2>/dev/null || echo 0)
            cycle_total_fixed=$(( cycle_total_fixed + mod_fixed ))
            cycle_total_attempted=$(( cycle_total_attempted + mod_attempted ))

            # Carry forward unresolved issues as P0 for next cycle
            local unresolved
            unresolved=$(jq -r '
                .verifications[]? |
                select(.status=="not_fixed" or .status=="partial") |
                "- [" + .status + "] " + .id + ": " + .note
            ' "$verify_file" 2>/dev/null | head -10 || true)

            if [ -n "$unresolved" ]; then
                echo "UNRESOLVED FROM CYCLE ${CYCLE}:" > "$prior_file"
                echo "$unresolved" >> "$prior_file"
                any_issues=true
            else
                rm -f "$prior_file"
            fi

            # Check if this module still has critical/high issues
            local open_issues
            open_issues=$(jq '[(.issues // [])[] | select(.severity=="critical" or .severity=="high")] | length' "$audit_file" 2>/dev/null || echo 1)
            if [ "$open_issues" -gt 0 ]; then
                any_issues=true
            fi

            # Track failed modules based on verification results (not $? which checks last command)
            local mod_fix_rate=0
            if [ "$mod_attempted" -gt 0 ]; then
                mod_fix_rate=$(( mod_fixed * 100 / mod_attempted ))
            fi
            if [ "$mod_attempted" -gt 0 ] && [ "$mod_fix_rate" -lt 20 ]; then
                modules_failed=$(( modules_failed + 1 ))
            fi

            modules_processed=$(( modules_processed + 1 ))
        done

        # CYCLE-LEVEL CIRCUIT BREAKER: If most modules failed, something is deeply wrong
        if [ "$modules_failed" -ge $(( module_count / 2 )) ] && [ "$modules_failed" -gt 2 ]; then
            error "Circuit breaker: ${modules_failed}/${module_count} modules failed this cycle"
            error "Likely cause: persistent build failure or API issues. Stopping to preserve budget."
            break
        fi

        # Build and test verification after all modules
        if [ "$DRY_RUN" != "true" ]; then
            verify_build "$cycle_dir"
            verify_tests "$cycle_dir"
            verify_quality_gates "$cycle_dir"
            verify_ui_polish "$cycle_dir"
            verify_visual "$cycle_dir"
            run_e2e_tests "$cycle_dir"
        fi

        # Commit this cycle
        commit_cycle "$CYCLE" "$modules_processed" "$CYCLE_SPEND"

        # Sync Supabase if migration/function files changed
        sync_supabase "$cycle_dir"

        # Update learnings (self-awareness: track what worked, what didn't)
        update_learnings "$cycle_dir"

        # TESLA: Evolve prompt strategy based on what worked
        evolve_prompt_strategy "$cycle_dir"

        # DEPLOY: Auto-deploy preview every 5 cycles
        deploy_cycle "$cycle_dir" "false"

        # Save state for resume support (use jq for safe JSON construction)
        jq -n \
            --argjson cycle "${CYCLE:-0}" \
            --arg spend "${ESTIMATED_SPEND:-0.00}" \
            --argjson prompts "${TOTAL_PROMPTS_EXECUTED:-0}" \
            --argjson inventions "${FEATURES_INVENTED:-0}" \
            '{last_completed_cycle:$cycle, estimated_spend:$spend, prompts_executed:$prompts, features_invented:$inventions}' \
            > "$STATE_FILE" 2>/dev/null || \
        echo '{"last_completed_cycle":'"${CYCLE:-0}"',"estimated_spend":"'"${ESTIMATED_SPEND:-0.00}"'","prompts_executed":'"${TOTAL_PROMPTS_EXECUTED:-0}"'}' > "$STATE_FILE"

        # Status summary with fix rate
        local cycle_fix_rate="N/A"
        if [ "$cycle_total_attempted" -gt 0 ]; then
            cycle_fix_rate=$(( cycle_total_fixed * 100 / cycle_total_attempted ))
        fi
        echo "" >&2
        echo -e "${BOLD}  Cycle ${CYCLE} complete:${NC} ${modules_processed} modules | Fix rate: ${cycle_fix_rate}% (${cycle_total_fixed}/${cycle_total_attempted}) | \$${CYCLE_SPEND} this cycle | \$${ESTIMATED_SPEND} total | $(elapsed)" >&2
        echo "" >&2

        # Check if we are done
        if [ "$any_issues" = "false" ]; then
            ALL_CLEAN=true
            header "ZERO ACTIONABLE ISSUES REMAINING — EVOLUTION COMPLETE"
            # Final production deploy
            deploy_cycle "$cycle_dir" "true"
            break
        fi
    done

    # Final report
    generate_report "$([ "$ALL_CLEAN" = "true" ] && echo "COMPLETE" || echo "STOPPED")"
    notify_completion "$([ "$ALL_CLEAN" = "true" ] && echo "COMPLETE" || echo "STOPPED")"

    echo "" >&2
    echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}" >&2
    echo -e "${BOLD}${GREEN}  SITESYNC AI ENGINE DONE${NC}" >&2
    echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}" >&2
    echo "" >&2
    echo -e "  ${DIM}Cycles:${NC}          ${CYCLE}" >&2
    echo -e "  ${DIM}Spend:${NC}           \$${ESTIMATED_SPEND}" >&2
    echo -e "  ${DIM}Duration:${NC}        $(elapsed)" >&2
    echo -e "  ${DIM}Prompts run:${NC}     ${TOTAL_PROMPTS_EXECUTED}" >&2
    echo -e "  ${DIM}Features invented:${NC} ${FEATURES_INVENTED}" >&2
    echo -e "  ${DIM}Report:${NC}          ${RUN_DIR}/MORNING_BRIEFING.md" >&2
    echo "" >&2
    echo -e "  ${CYAN}git log --oneline -20${NC}   — see every change" >&2
    echo -e "  ${CYAN}npm run dev${NC}             — run the app" >&2
    echo "" >&2
}

main "$@"
