#!/bin/bash
###############################################################################
#
#  SITESYNC AI — AUTONOMOUS EVOLUTION ENGINE v5.0
#  ═══════════════════════════════════════════════════════════════════════════
#
#  This is not a linter. This is not a code formatter. This is not a script.
#
#  This is a living engine. It breathes overnight while you sleep. It reads
#  your vision, studies your competitors, audits every corner of the platform,
#  makes surgical improvements, invents features nobody has built yet, and
#  wakes up tomorrow morning with a report of everything it changed.
#
#  You wrote the vision. This engine builds it — relentlessly, autonomously,
#  night after night — until SiteSyncAI is something the construction industry
#  has never seen and will never forget.
#
#  THE LOOP:
#    1. Snapshot codebase (git-hash cached, skips if nothing changed)
#    2. Read VISION.md + FEEDBACK.md — founder priorities become P0
#    3. Decompose into modules via Haiku (10x cheaper than Opus)
#    4. Deep audit each module: 14 dimensions + live competitive research
#    5. Generate precise Claude Code prompts sorted by impact
#    6. Execute all prompts via Claude Code (non-interactive, auto-perms)
#    7. Verify build passes — auto-fix any regressions
#    8. Verify every change — unresolved issues carry forward as P0
#    9. Enter INVENTION MODE for any module scoring 85+ for 3+ cycles
#       (stop fixing, start building things nobody has)
#   10. Commit changes with descriptive message, update scores
#   11. Loop until zero actionable items remain or budget/cycle limit hit
#   12. Write morning briefing, send webhook notification
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
    echo -e "${BOLD}${CYAN}  │   SITESYNC AI — AUTONOMOUS EVOLUTION ENGINE  v5.0              │${NC}" >&2
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
    cc_ver=$(claude --version 2>/dev/null | head -1 || echo "installed")
    success "Claude Code CLI: ${cc_ver}"

    # Required tools
    for tool in jq bc curl git; do
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
             git commit -m "engine: backup checkpoint before run ${TIMESTAMP}" --allow-empty-message 2>/dev/null) || true
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
    current_hash=$(find "$PROJECT_DIR/src" -type f -name '*.ts' -o -name '*.tsx' -o -name '*.js' 2>/dev/null | sort | xargs cat 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1 || echo "nohash_${CYCLE}")

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
        "LEARNINGS.md:ENGINE LEARNINGS (what worked, what failed, fix rates, score trends from prior runs — use this to avoid repeating mistakes)"
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

    local snapshot_content
    snapshot_content=$(head -200 "$snapshot_file")

    local prompt
    prompt="Decompose this React TypeScript construction PM app into 8-10 modules. Return ONLY JSON, no other text.

Directory:
$(grep -A 100 '## Directory Structure' "$snapshot_file" | head -80)

JSON format (start with { end with }):
{\"modules\":[{\"name\":\"ui-design-system\",\"label\":\"UI Design System\",\"description\":\"Design tokens, primitives, shared components\",\"files\":[\"src/styles/theme.ts\",\"src/components/Primitives.tsx\"],\"priority\":1}]}

Use these modules: ui-design-system, core-workflows (RFIs/submittals/change-orders/punch-list), financial-engine (budget/pay-apps), scheduling (gantt/phases), field-operations (daily-log/field-capture/crews), project-intelligence (AI-copilot), document-management (drawings/files), collaboration (meetings/directory), infrastructure (App.tsx/routing/auth)."

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
    {"name":"core-workflows","label":"Core Workflows","description":"RFIs, submittals, change orders, punch list","files":[],"priority":1},
    {"name":"financial-engine","label":"Financial Engine","description":"Budget, financials, pay apps","files":[],"priority":1},
    {"name":"scheduling","label":"Scheduling","description":"Schedule, lookahead, gantt","files":[],"priority":2},
    {"name":"field-operations","label":"Field Operations","description":"Daily log, crews, safety","files":[],"priority":2},
    {"name":"project-intelligence","label":"Project Intelligence","description":"AI copilot, agents, insights","files":[],"priority":2},
    {"name":"infrastructure","label":"Infrastructure","description":"Routing, state, API, auth","files":[],"priority":3}
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
    local relevant_snapshot
    relevant_snapshot=$(grep -A 100 "### src/pages\|### src/components\|### src/styles\|### src/hooks\|### src/store\|### src/" "$snapshot_file" | head -800 || head -800 "$snapshot_file")

    local invention_section=""
    if [ "$invention_eligible" = "true" ] && [ "$INVENTION_MODE" = "true" ]; then
        invention_section="
## INVENTION MODE

This module has been scoring 90+ for multiple cycles. All known issues are resolved.
Your task shifts from fixing to INVENTING.

Study what Procore, Autodesk, Fieldwire, Buildertrend, and Finalsite cannot do.
Think about what a \$500M general contractor would pay extra for.
Think about what AI enables that was impossible in 2020.

Invent 2-4 bold new features for this module:
- Features that don't exist in any competing product
- Features that are uniquely enabled by AI
- Features that a field superintendent would talk about with other supers
- Features that would make a CFO approve the deal instantly

Rate each invention on: impact (1-10), buildability (1-10), differentiation (1-10).
Include a complete implementation prompt for each."
    fi

    local prompt
    prompt="You are auditing the \"${module_label}\" module of a React TypeScript construction PM app (SiteSyncAI).

TASK: Score 14 dimensions. Find the ${MAX_ISSUES_PER_MODULE} most impactful issues. Write surgical fix prompts.

CRITICAL PROMPT RULES (follow exactly or fixes will fail):
- Each issue prompt MUST target exactly ONE file. Never ask to change multiple files in one prompt.
- Each prompt MUST start with: \"In the file [exact path], make these specific changes:\"
- Each prompt MUST include the exact function/component name to modify.
- Each prompt MUST describe the BEFORE state (what the code currently does) and AFTER state (what it should do).
- Each prompt MUST end with: \"After changes, run: npm run build to verify no TypeScript errors.\"
- Do NOT generate prompts for features that require new backend APIs, databases, or external services.
- Do NOT generate prompts for \"add real-time collaboration\" or \"add offline sync\" — these are multi-sprint features, not single prompts.
- Focus on: fixing bugs, improving types, adding error/empty/loading states, improving UI polish, fixing calculations, adding ARIA attributes, improving mobile responsiveness.

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

    local response
    response=$(call_claude "$AUDIT_MODEL" "$prompt" 16384 "" "$tools_arg")

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

        # Count invented features
        local invented
        invented=$(echo "$audit_json" | jq '.invented_features // [] | length' 2>/dev/null || echo 0)
        FEATURES_INVENTED=$(( FEATURES_INVENTED + invented ))

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
        if ! (cd "$PROJECT_DIR" && eval "$BUILD_CMD" > /dev/null 2>&1); then
            warn "Build is broken BEFORE ${module_name} — fixing build first..."
            local build_errors
            build_errors=$(cd "$PROJECT_DIR" && eval "$BUILD_CMD" 2>&1 | tail -40)
            local gate_log="${exec_dir}/build_gate_fix.log"
            run_claude_code "The TypeScript build is broken. Fix ALL errors below. Do not change anything unrelated. Errors:
${build_errors}" "$gate_log" 180
            ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.50" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
            CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.50" | bc 2>/dev/null || echo "$CYCLE_SPEND")
            (cd "$PROJECT_DIR" && git add src/ 2>/dev/null && \
             git diff --cached --quiet 2>/dev/null || \
             git commit -m "engine: build gate fix before ${module_name}" --allow-empty-message 2>/dev/null) || true

            # If build still broken after fix, skip this module entirely
            if ! (cd "$PROJECT_DIR" && eval "$BUILD_CMD" > /dev/null 2>&1); then
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

        # BUDGET CHECK mid-execution: abort if we are running low
        local spend_int
        spend_int=$(echo "$ESTIMATED_SPEND" | cut -d'.' -f1)
        local budget_int
        budget_int=$(echo "$MAX_SPEND" | cut -d'.' -f1)
        if [ "${spend_int:-0}" -ge "${budget_int:-500}" ]; then
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
        local prompt="IMPORTANT RULES:
1. This is a React 19 + TypeScript + Vite app. Styles use inline styles from src/styles/theme.ts. Do NOT use CSS modules or styled-components.
2. Read the target file FIRST before making changes. Understand what exists before modifying.
3. Make the MINIMUM change needed. Do not refactor unrelated code.
4. After making changes, run: npm run build — if the build fails, fix the errors before finishing.
5. Never use hyphens in UI text. Use commas or periods instead.

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
                ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.50" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
                CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.50" | bc 2>/dev/null || echo "$CYCLE_SPEND")
            fi

            if [ "$exec_success" = "false" ]; then
                consecutive_failures=$(( consecutive_failures + 1 ))
                warn "  Prompt ${issue_id} failed — retrying with simplified version..."
                sleep "$PROMPT_COOLDOWN"
                local simple_prompt="You are editing a React TypeScript project. ${title}. Read the target file first. Make the minimal change needed. Only edit existing files. Run: npm run build after to verify."
                if run_claude_code "$simple_prompt" "${exec_log}.retry" 180; then
                    consecutive_failures=0
                    TOTAL_PROMPTS_EXECUTED=$(( TOTAL_PROMPTS_EXECUTED + 1 ))
                    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.30" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
                    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.30" | bc 2>/dev/null || echo "$CYCLE_SPEND")
                    success "  Simplified retry succeeded"
                else
                    warn "  Prompt ${issue_id} failed on retry too — skipping"
                fi
            fi

            # Quick build check after each prompt (catch regressions immediately)
            if [ -n "$BUILD_CMD" ]; then
                if ! (cd "$PROJECT_DIR" && eval "$BUILD_CMD" > /dev/null 2>&1); then
                    warn "  Build broken after ${issue_id} — auto-fixing..."
                    local build_errors
                    build_errors=$(cd "$PROJECT_DIR" && eval "$BUILD_CMD" 2>&1 | tail -30)
                    sleep "$PROMPT_COOLDOWN"
                    run_claude_code "The TypeScript build is broken. Fix these errors. Only fix the errors, do not change anything else. Errors: ${build_errors}" "${exec_log}.buildfix" 180
                    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.50" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
                    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.50" | bc 2>/dev/null || echo "$CYCLE_SPEND")

                    # If build STILL broken after fix, revert and move on
                    if ! (cd "$PROJECT_DIR" && eval "$BUILD_CMD" > /dev/null 2>&1); then
                        warn "  Build still broken — reverting last change to preserve stability"
                        (cd "$PROJECT_DIR" && git checkout -- src/ 2>/dev/null) || true
                    fi
                fi
            fi

            # Atomic commit: save every successful change immediately (never lose work)
            (cd "$PROJECT_DIR" && git add src/ 2>/dev/null && \
             git diff --cached --quiet 2>/dev/null || \
             git commit -m "engine: fix ${issue_id} — ${title}" --allow-empty-message 2>/dev/null) || true
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
                    ESTIMATED_SPEND=$(echo "scale=2; $ESTIMATED_SPEND + 0.50" | bc 2>/dev/null || echo "$ESTIMATED_SPEND")
                    CYCLE_SPEND=$(echo "scale=2; $CYCLE_SPEND + 0.50" | bc 2>/dev/null || echo "$CYCLE_SPEND")
                    # Atomic commit for invention
                    (cd "$PROJECT_DIR" && git add src/ 2>/dev/null && \
                     git diff --cached --quiet 2>/dev/null || \
                     git commit -m "engine: invent ${feat_title}" --allow-empty-message 2>/dev/null) || true
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

    if (cd "$PROJECT_DIR" && eval "$BUILD_CMD" > "$build_log" 2>&1); then
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

    (cd "$PROJECT_DIR" && claude \
        -p "$fix_prompt" \
        --model "$CODE_MODEL" \
        --dangerously-skip-permissions) \
    >> "${cycle_dir}/build_fix.log" 2>&1 || true

    # Re-verify
    if (cd "$PROJECT_DIR" && eval "$BUILD_CMD" >> "$build_log" 2>&1); then
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

    if (cd "$PROJECT_DIR" && eval "$TEST_CMD" > "$test_log" 2>&1); then
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

    (cd "$PROJECT_DIR" && claude \
        -p "$fix_prompt" \
        --model "$CODE_MODEL" \
        --dangerously-skip-permissions) \
    >> "${cycle_dir}/test_fix.log" 2>&1 || true

    # Re-verify
    if (cd "$PROJECT_DIR" && eval "$TEST_CMD" >> "$test_log" 2>&1); then
        success "Tests fixed and passing"
        return 0
    fi

    warn "Tests still failing after auto-fix — continuing (issues logged)"
    return 0
}

# ── Change verification (automated — no LLM needed, saves money and is more reliable) ──
verify_changes() {
    local module_name="$1"
    local audit_file="$2"
    local snapshot_file="$3"
    local cycle_dir="$4"

    local verify_file="${cycle_dir}/verify_${module_name}.json"

    log "Verifying changes for ${module_name}..."

    # Get list of files this module should have touched
    local module_files
    module_files=$(jq -r '[(.issues // [])[] | .file // ""] | map(select(. != "")) | unique[]' "$audit_file" 2>/dev/null)

    # Check git log for recent commits by the engine for this module
    local recent_commits
    recent_commits=$(cd "$PROJECT_DIR" && git log --oneline --since="2 hours ago" --grep="engine: fix ${module_name}" 2>/dev/null | wc -l | tr -d ' ')

    # Check actual file changes (committed or uncommitted)
    local changed_files
    changed_files=$(cd "$PROJECT_DIR" && git diff --name-only HEAD~${recent_commits:-1} 2>/dev/null | head -30 || echo "")
    if [ -z "$changed_files" ]; then
        changed_files=$(cd "$PROJECT_DIR" && git diff --name-only 2>/dev/null | head -30 || echo "")
    fi
    local files_changed_count
    files_changed_count=$(echo "$changed_files" | grep -c '[a-z]' 2>/dev/null || echo 0)

    # Check build status
    local build_ok="true"
    if [ -n "$BUILD_CMD" ]; then
        if ! (cd "$PROJECT_DIR" && eval "$BUILD_CMD" > /dev/null 2>&1); then
            build_ok="false"
        fi
    fi

    # For each issue, check if the target file was modified
    local verifications="[]"
    local fixed_count=0
    local partial_count=0
    local unfixed_count=0

    local issue_count
    issue_count=$(jq '(.issues // []) | length' "$audit_file" 2>/dev/null || echo 0)
    local idx=0
    while [ $idx -lt "$issue_count" ]; do
        local issue_id
        issue_id=$(jq -r "(.issues // [])[$idx].id // \"unknown\"" "$audit_file" 2>/dev/null)
        local issue_file
        issue_file=$(jq -r "(.issues // [])[$idx].file // \"\"" "$audit_file" 2>/dev/null)

        local status="not_fixed"
        local note="No file change detected"

        if [ -n "$issue_file" ] && echo "$changed_files" | grep -q "$issue_file" 2>/dev/null; then
            # File was modified — check if a commit exists for this issue
            local has_commit
            has_commit=$(cd "$PROJECT_DIR" && git log --oneline --since="6 hours ago" --grep="${issue_id}" 2>/dev/null | wc -l | tr -d ' ')
            if [ "${has_commit:-0}" -gt 0 ]; then
                status="fixed"
                note="File modified and committed"
                fixed_count=$(( fixed_count + 1 ))
            else
                status="partial"
                note="File modified but not committed"
                partial_count=$(( partial_count + 1 ))
            fi
        else
            unfixed_count=$(( unfixed_count + 1 ))
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
        '{verifications:$verifications,files_changed:$files_changed,regression_detected:(if $build_ok == "false" then true else false end),regression_description:(if $build_ok == "false" then "Build failing" else "" end)}' \
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

        # Add all source files explicitly (avoid git add -A which can fail on mounted FS)
        git add src/ package.json tsconfig.json vite.config.ts 2>/dev/null || true
        git add *.md *.json 2>/dev/null || true
        git add supabase/ public/ 2>/dev/null || true

        # Verify something is staged
        local staged
        staged=$(git diff --cached --name-only 2>/dev/null)
        if [ -z "$staged" ]; then
            echo "[commit_cycle] Nothing staged after git add — trying git add -A" >&2
            git add -A 2>/dev/null || true
        fi

        git commit -m "engine: cycle ${cycle_num} — ${modules_processed} modules, \$${cycle_cost} spend" \
            --allow-empty-message 2>/dev/null || echo "[commit_cycle] Commit failed" >&2
    )

    # Auto-tag major milestones
    if [ "$AUTO_GIT_TAG" = "true" ] && [ $(( cycle_num % 5 )) -eq 0 ]; then
        local tag_name="engine-milestone-${TIMESTAMP}-c${cycle_num}"
        (cd "$PROJECT_DIR" && git tag "$tag_name" 2>/dev/null) || true
        log "Tagged milestone: ${tag_name}"
    fi

    success "Committed cycle ${cycle_num} changes"
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

    # Append to learnings
    {
        echo ""
        echo "## Cycle ${CYCLE} — $(date +%Y-%m-%d\ %H:%M)"
        echo ""
        echo "Spend: \$${CYCLE_SPEND} | Fix rate: ${fix_rate}% (${total_fixed}/${total_attempted})"
        echo ""
        echo -e "${module_scores}"
        if [ "$total_unfixed" -gt 0 ]; then
            echo "Unfixed issues carried forward. The engine should prioritize these next cycle."
        fi
        if [ "$fix_rate" != "N/A" ] && [ "$fix_rate" -lt 50 ] 2>/dev/null; then
            echo "Low fix rate this cycle. Prompts may need to be more specific or broken into smaller steps."
        fi
    } >> "$learnings_file"

    log "Learnings updated: ${learnings_file}"
}

# ── Dynamic strategy: adjust approach based on score trends ──────────────────
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
                    strategy+="REGRESSION: Score dropped by $(( delta * -1 )) points. Something broke. Prioritize fixing regressions.\n"
                elif [ "$delta" -ge -2 ] && [ "$delta" -le 2 ]; then
                    strategy+="PLATEAU: Score is flat. Try different approaches. Look at dimensions that have not been addressed.\n"
                fi
            fi
        fi
    fi

    # Check learnings file for relevant patterns
    local learnings_file="${PROJECT_DIR}/LEARNINGS.md"
    if [ -f "$learnings_file" ]; then
        local recent_learnings
        recent_learnings=$(tail -20 "$learnings_file" 2>/dev/null)
        if echo "$recent_learnings" | grep -q "Low fix rate"; then
            strategy+="ADAPTATION: Recent cycles had low fix rates. Generate simpler, more targeted prompts.\n"
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

    curl -s -X POST "$NOTIFY_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"${message}\"}" \
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
<pre>${git_log_text}</pre>

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
main() {
    preflight

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

        # Check budget
        local spend_int
        spend_int=$(echo "$ESTIMATED_SPEND" | cut -d'.' -f1)
        local budget_int
        budget_int=$(echo "$MAX_SPEND" | cut -d'.' -f1)
        if [ "${spend_int:-0}" -ge "${budget_int:-500}" ]; then
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

        local any_issues=false
        local modules_processed=0

        # Process each module
        local i=0
        while [ $i -lt "$module_count" ]; do
            local module
            module=$(echo "$modules" | jq ".[$i]")
            local mod_name
            mod_name=$(echo "$module" | jq -r '.name')
            local mod_label
            mod_label=$(echo "$module" | jq -r '.label')
            local mod_desc
            mod_desc=$(echo "$module" | jq -r '.description')

            i=$(( i + 1 ))

            # Skip if requested
            if should_skip_module "$mod_name"; then
                log "Skipping module: ${mod_name}"
                continue
            fi

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
                        s="${s//[^0-9]/}"   # strip non-numeric chars (newlines, spaces)
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
            if [ "$DRY_RUN" != "true" ]; then
                execute_prompts "$mod_name" "$audit_file" "$cycle_dir"
            fi

            # Verify
            local verify_file
            verify_file=$(verify_changes "$mod_name" "$audit_file" "$snapshot_file" "$cycle_dir")

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

            modules_processed=$(( modules_processed + 1 ))
        done

        # Build and test verification after all modules
        if [ "$DRY_RUN" != "true" ]; then
            verify_build "$cycle_dir"
            verify_tests "$cycle_dir"
        fi

        # Commit this cycle
        commit_cycle "$CYCLE" "$modules_processed" "$CYCLE_SPEND"

        # Update learnings (self-awareness: track what worked, what didn't)
        update_learnings "$cycle_dir"

        # Save state for resume support
        echo '{"last_completed_cycle":'"$CYCLE"',"estimated_spend":"'"$ESTIMATED_SPEND"'","prompts_executed":'"$TOTAL_PROMPTS_EXECUTED"'}' > "$STATE_FILE"

        # Status summary
        echo "" >&2
        echo -e "${BOLD}  Cycle ${CYCLE} complete:${NC} ${modules_processed} modules, \$${CYCLE_SPEND} this cycle, \$${ESTIMATED_SPEND} total, $(elapsed)" >&2
        echo "" >&2

        # Check if we are done
        if [ "$any_issues" = "false" ]; then
            ALL_CLEAN=true
            header "ZERO ACTIONABLE ISSUES REMAINING — EVOLUTION COMPLETE"
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
