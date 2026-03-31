#!/bin/bash
###############################################################################
#
#  SITESYNC AI — AUTONOMOUS EVOLUTION ENGINE v4.0
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
#    9. Enter INVENTION MODE for any module scoring 90+ for 2+ cycles
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
#    SKIP_WEB_RESEARCH=false     Skip competitive research [false]
#    INCLUDE_UI=true             Include UI/UX in audits [true]
#    DRY_RUN=false               Audit without touching code [false]
#    BUILD_CMD=""                Build command (auto-detected from package.json)
#    TEST_CMD=""                 Test command (auto-detected from package.json)
#    SKIP_MODULES=""             Comma-separated module names to skip
#    FEEDBACK_FILE=""            Feedback file path [PROJECT_DIR/FEEDBACK.md]
#    VISION_FILE=""              Vision file path [PROJECT_DIR/VISION.md]
#    NOTIFY_WEBHOOK=""           Webhook for completion notification
#    MAX_ISSUES_PER_MODULE=20    Cap issues per module per cycle [20]
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
SKIP_WEB_RESEARCH="${SKIP_WEB_RESEARCH:-false}"
INCLUDE_UI="${INCLUDE_UI:-true}"
DRY_RUN="${DRY_RUN:-false}"
BUILD_CMD="${BUILD_CMD:-}"
TEST_CMD="${TEST_CMD:-}"
SKIP_MODULES="${SKIP_MODULES:-}"
FEEDBACK_FILE="${FEEDBACK_FILE:-$PROJECT_DIR/FEEDBACK.md}"
VISION_FILE="${VISION_FILE:-$PROJECT_DIR/VISION.md}"
NOTIFY_WEBHOOK="${NOTIFY_WEBHOOK:-}"
MAX_ISSUES_PER_MODULE="${MAX_ISSUES_PER_MODULE:-20}"
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

log()      { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
success()  { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
warn()     { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; }
error()    { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }
invent()   { echo -e "${MAGENTA}[$(date +%H:%M:%S)] ✦ INVENTING:${NC} $1"; }
header()   {
    echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════════════${NC}\n"
}
subheader() {
    echo -e "\n${BOLD}  ── $1 ──${NC}"
}

# Startup manifesto — printed once, sets the tone for everything that follows
print_manifesto() {
    echo ""
    echo -e "${BOLD}${CYAN}  ┌─────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${CYAN}  │                                                                 │${NC}"
    echo -e "${BOLD}${CYAN}  │   SITESYNC AI — AUTONOMOUS EVOLUTION ENGINE  v4.0              │${NC}"
    echo -e "${BOLD}${CYAN}  │                                                                 │${NC}"
    echo -e "${BOLD}${CYAN}  │   This engine does not rest. It does not compromise.           │${NC}"
    echo -e "${BOLD}${CYAN}  │   It reads your vision. It studies your competitors.           │${NC}"
    echo -e "${BOLD}${CYAN}  │   It finds every weakness and eliminates it.                   │${NC}"
    echo -e "${BOLD}${CYAN}  │   And when there is nothing left to fix, it invents.           │${NC}"
    echo -e "${BOLD}${CYAN}  │                                                                 │${NC}"
    echo -e "${BOLD}${CYAN}  │   Go to sleep, Walker. We have work to do.                    │${NC}"
    echo -e "${BOLD}${CYAN}  │                                                                 │${NC}"
    echo -e "${BOLD}${CYAN}  └─────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
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

# Extract JSON object from text that might contain markdown fences
extract_json() {
    local text="$1"
    # Try direct parse first
    echo "$text" | jq '.' 2>/dev/null && return
    # Strip markdown fences
    echo "$text" | sed 's/```json//g' | sed 's/```//g' | jq '.' 2>/dev/null || echo '{}'
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

    echo -e "${DIM}  Project:  ${NC}${BOLD}${PROJECT_DIR}${NC}"
    echo -e "${DIM}  Run dir:  ${NC}${RUN_DIR}"
    echo -e "${DIM}  Models:   ${NC}Audit=${AUDIT_MODEL} | Code=${CODE_MODEL} | Decomp=${DECOMP_MODEL}"
    echo -e "${DIM}  Budget:   ${NC}${MAX_CYCLES} cycles max, \$${MAX_SPEND} spend limit"
    echo -e "${DIM}  Mode:     ${NC}$([ "$DRY_RUN" = "true" ] && echo "DRY RUN (no code changes)" || echo "LIVE (will modify code)")"
    echo ""

    # API key
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        error "ANTHROPIC_API_KEY not set."
        echo "  Run: export ANTHROPIC_API_KEY='sk-ant-...'"
        echo "  Get one at: https://console.anthropic.com/settings/keys"
        exit 1
    fi
    success "API key configured"

    # Claude Code CLI
    if ! command -v claude &>/dev/null; then
        error "Claude Code CLI not found."
        echo "  Run: npm install -g @anthropic-ai/claude-code"
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

    # Git status
    if git -C "$PROJECT_DIR" rev-parse --git-dir &>/dev/null; then
        local git_branch
        git_branch=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
        success "Git branch: ${git_branch}"

        # Create backup commit if there are uncommitted changes
        local git_status
        git_status=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null || true)
        if [ -n "$git_status" ]; then
            log "Committing working state before engine run..."
            git -C "$PROJECT_DIR" add -A
            git -C "$PROJECT_DIR" commit -m "engine: backup checkpoint before run ${TIMESTAMP}" --allow-empty-message 2>/dev/null || true
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
    local snapshot_file="${RUN_DIR}/snapshot.md"

    # Git hash caching — skip if nothing changed since last snapshot
    local current_hash
    current_hash=$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo "no-git")
    if [ "$current_hash" = "$LAST_SNAPSHOT_HASH" ] && [ -f "$snapshot_file" ]; then
        log "Snapshot cached (git hash unchanged)"
        echo "$snapshot_file"
        return 0
    fi

    log "Taking codebase snapshot..."
    local tmp="${snapshot_file}.tmp"
    echo "# SITESYNC AI — CODEBASE SNAPSHOT" > "$tmp"
    echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$tmp"
    echo "Git: $(git -C "$PROJECT_DIR" log --oneline -1 2>/dev/null || echo 'no git')" >> "$tmp"
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

# ── Read founder context ───────────────────────────────────────────────────────
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
    prompt="You are analyzing a React TypeScript construction project management platform called SiteSyncAI.

Based on this directory structure and code overview, decompose the codebase into 6-10 logical modules for independent auditing.

Each module should group related files by domain/concern. Return ONLY valid JSON, no markdown fences.

Directory structure:
\`\`\`
$(grep -A 100 '## Directory Structure' "$snapshot_file" | head -80)
\`\`\`

Return this exact JSON format:
{
  \"modules\": [
    {
      \"name\": \"ui-design-system\",
      \"label\": \"UI Design System\",
      \"description\": \"Design tokens, primitives, shared components\",
      \"files\": [\"src/styles/theme.ts\", \"src/components/Primitives.tsx\"],
      \"priority\": 1
    }
  ]
}

Module ideas for a construction PM app:
- ui-design-system (theme, primitives, layout)
- core-workflows (RFIs, submittals, change orders, punch list)
- financial-engine (budget, financials, pay apps, estimating)
- scheduling (schedule, lookahead, gantt, phases)
- field-operations (daily log, field capture, crews, safety)
- project-intelligence (AI copilot, agents, insights, project health)
- document-management (drawings, files, BIM viewer)
- collaboration (activity, meetings, directory, presence)
- enterprise-portfolio (portfolio, benchmarks, integrations, admin)
- infrastructure (App.tsx, routing, state, queries, auth)

Return only the JSON object."

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
    prompt="You are the world's best software architect and construction industry expert. Your only job is to make SiteSyncAI the most advanced construction project management platform ever built.

## YOUR MISSION

Audit the \"${module_label}\" module of SiteSyncAI against the 14 dimensions below. Study competitors. Find everything that is wrong, missing, shallow, or could be world-class. Generate precise, self-contained Claude Code implementation prompts for every issue.

## CONTEXT

${founder_context}

## PRIOR UNRESOLVED ISSUES (MUST ADDRESS FIRST — P0)

${prior_issues}

## CODEBASE SNAPSHOT

${relevant_snapshot}

## 14 AUDIT DIMENSIONS

Score each 0-100. Generate actionable issues for anything below 95.

1. **Visual Polish** — Is this Apple/Linear/Stripe level? Zero compromises. Every pixel.
2. **Construction Domain Depth** — Does this match how actual supers, PMs, and owners work?
3. **Data Richness** — Real calculated metrics, not placeholders. Charts that tell stories.
4. **Interaction Quality** — Keyboard shortcuts, drag-drop, bulk actions, inline editing.
5. **AI Integration** — AI woven into the workflow, not a sidebar feature.
6. **Mobile and Field-First** — Works perfectly on an iPhone on a dusty jobsite.
7. **Performance** — Instant renders. Zero unnecessary re-renders. Virtual lists where needed.
8. **TypeScript Quality** — Strict types, no any, no eslint-disable, proper generics.
9. **Error Handling** — Every edge case handled. Skeleton loaders. Empty states. Error boundaries.
10. **Real-Time and Collaboration** — Live updates, presence, conflict resolution.
11. **Accessibility** — WCAG 2.1 AA. Keyboard navigable. Screen reader tested.
12. **Security and Permissions** — RBAC checks, no data leaks, XSS safe.
13. **Competitive Differentiation** — What makes a GC choose SiteSync over Procore today?
14. **Enterprise Readiness** — Audit trail, export, SSO hooks, multi-tenant isolation.

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown fences):

{
  \"module\": \"${module_name}\",
  \"scores\": {
    \"visual_polish\": 0,
    \"domain_depth\": 0,
    \"data_richness\": 0,
    \"interaction_quality\": 0,
    \"ai_integration\": 0,
    \"mobile_first\": 0,
    \"performance\": 0,
    \"typescript_quality\": 0,
    \"error_handling\": 0,
    \"realtime\": 0,
    \"accessibility\": 0,
    \"security\": 0,
    \"differentiation\": 0,
    \"enterprise_readiness\": 0
  },
  \"overall_score\": 0,
  \"issues\": [
    {
      \"id\": \"${module_name}-C${CYCLE}-001\",
      \"severity\": \"critical|high|medium|low\",
      \"dimension\": \"visual_polish\",
      \"title\": \"Short issue title\",
      \"description\": \"What is wrong and why it matters\",
      \"prompt\": \"Complete self-contained Claude Code prompt — include exact file paths, function names, full implementation instructions, acceptance criteria, and construction industry context. This must be executable standalone with zero additional context.\"
    }
  ],
  \"invented_features\": [],
  \"competitive_intel\": \"What competitors do here and how SiteSync compares\",
  \"summary\": \"One paragraph: current state, key wins, key gaps\"
}

Generate issues sorted by severity descending. Cap at ${MAX_ISSUES_PER_MODULE} issues.
${invention_section}"

    local tools_arg=""
    if [ "$SKIP_WEB_RESEARCH" != "true" ]; then
        tools_arg="$WEB_SEARCH_TOOLS"
    fi

    local response
    response=$(call_claude "$AUDIT_MODEL" "$prompt" 8192 "" "$tools_arg")

    # Save raw response for debugging
    echo "$response" > "${cycle_dir}/audit_${module_name}_raw.json"

    local text
    text=$(extract_text "$response")
    local audit_json
    audit_json=$(extract_json "$text")

    if echo "$audit_json" | jq '.issues' &>/dev/null; then
        echo "$audit_json" > "$audit_file"

        local score
        score=$(echo "$audit_json" | jq -r '.overall_score // 0')
        local issue_count
        issue_count=$(echo "$audit_json" | jq '.issues | length')
        local critical_count
        critical_count=$(echo "$audit_json" | jq '[.issues[] | select(.severity=="critical")] | length')

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
execute_prompts() {
    local module_name="$1"
    local audit_file="$2"
    local cycle_dir="$3"
    local exec_dir="${cycle_dir}/exec_${module_name}"
    mkdir -p "$exec_dir"

    local issues
    issues=$(jq -r '.issues // []' "$audit_file")
    local count
    count=$(echo "$issues" | jq 'length')

    if [ "$count" -eq 0 ]; then
        log "No issues to execute for ${module_name}"
        return 0
    fi

    log "Executing ${count} prompts for ${module_name}..."

    local i=0
    while [ $i -lt "$count" ]; do
        local issue
        issue=$(echo "$issues" | jq ".[$i]")
        local issue_id
        issue_id=$(echo "$issue" | jq -r '.id // "unknown"')
        local severity
        severity=$(echo "$issue" | jq -r '.severity // "medium"')
        local title
        title=$(echo "$issue" | jq -r '.title // "Untitled"')
        local prompt
        prompt=$(echo "$issue" | jq -r '.prompt // ""')

        if [ -z "$prompt" ] || [ "$prompt" = "null" ]; then
            i=$(( i + 1 ))
            continue
        fi

        log "  [$(( i + 1 ))/${count}] ${severity} — ${title}"

        local exec_log="${exec_dir}/exec_${i}_${issue_id}.log"

        if [ "$DRY_RUN" = "true" ]; then
            echo "[DRY RUN] Would execute: ${title}" > "$exec_log"
            echo "PROMPT:" >> "$exec_log"
            echo "$prompt" >> "$exec_log"
        else
            # Execute with retry
            local attempt=0
            local exec_success=false
            while [ $attempt -lt 2 ]; do
                if (cd "$PROJECT_DIR" && claude \
                        -p "$prompt" \
                        --model "$CODE_MODEL" \
                        --dangerously-skip-permissions) \
                    >> "$exec_log" 2>&1; then
                    exec_success=true
                    TOTAL_PROMPTS_EXECUTED=$(( TOTAL_PROMPTS_EXECUTED + 1 ))
                    break
                fi
                attempt=$(( attempt + 1 ))
                if [ $attempt -lt 2 ]; then
                    warn "  Prompt failed, retrying in 5s..."
                    sleep 5
                fi
            done

            if [ "$exec_success" = "false" ]; then
                warn "  Prompt ${issue_id} failed after 2 attempts"
            fi
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
                local feat_log="${exec_dir}/invention_${j}_${module_name}.log"
                (cd "$PROJECT_DIR" && claude \
                    -p "$feat_prompt" \
                    --model "$CODE_MODEL" \
                    --dangerously-skip-permissions) \
                >> "$feat_log" 2>&1 || warn "  Invention failed: ${feat_title}"
            fi
            j=$(( j + 1 ))
        done
    fi
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

# ── Change verification ────────────────────────────────────────────────────────
verify_changes() {
    local module_name="$1"
    local audit_file="$2"
    local snapshot_file="$3"
    local cycle_dir="$4"

    local verify_file="${cycle_dir}/verify_${module_name}.json"

    log "Verifying changes for ${module_name}..."

    local issues_summary
    issues_summary=$(jq '[.issues[] | {id:.id,title:.title,severity:.severity}]' "$audit_file")

    # Check git diff for this cycle
    local diff_summary
    diff_summary=$(git -C "$PROJECT_DIR" diff HEAD~1 --stat 2>/dev/null | head -30 || echo "No git diff available")

    local prompt
    prompt="You are verifying that code changes were correctly implemented for the \"${module_name}\" module.

Issues that should have been fixed:
$(echo "$issues_summary")

Git diff summary showing what actually changed:
\`\`\`
${diff_summary}
\`\`\`

For each issue, assess if it was: fixed, partial, not_fixed.

Return ONLY valid JSON:
{
  \"verifications\": [
    {\"id\": \"issue-id\", \"status\": \"fixed|partial|not_fixed\", \"note\": \"brief note\"}
  ],
  \"files_changed\": 0,
  \"regression_detected\": false,
  \"regression_description\": \"\"
}"

    local response
    response=$(call_claude "$AUDIT_MODEL" "$prompt" 2048)

    local text
    text=$(extract_text "$response")
    local verify_json
    verify_json=$(extract_json "$text")

    echo "$verify_json" > "$verify_file"

    local fixed_count
    fixed_count=$(echo "$verify_json" | jq '[.verifications[]? | select(.status=="fixed")] | length' 2>/dev/null || echo 0)
    local partial_count
    partial_count=$(echo "$verify_json" | jq '[.verifications[]? | select(.status=="partial")] | length' 2>/dev/null || echo 0)
    local unfixed_count
    unfixed_count=$(echo "$verify_json" | jq '[.verifications[]? | select(.status=="not_fixed")] | length' 2>/dev/null || echo 0)
    local files_changed
    files_changed=$(echo "$verify_json" | jq -r '.files_changed // 0' 2>/dev/null || echo 0)

    TOTAL_FILES_CHANGED=$(( TOTAL_FILES_CHANGED + files_changed ))

    success "${module_name} verification: ${fixed_count} fixed, ${partial_count} partial, ${unfixed_count} not fixed"

    echo "$verify_file"
}

# ── Git commit changes ─────────────────────────────────────────────────────────
commit_cycle() {
    local cycle_num="$1"
    local modules_processed="$2"
    local cycle_cost="$3"

    if [ "$DRY_RUN" = "true" ]; then return 0; fi

    local git_status
    git_status=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null || true)

    if [ -z "$git_status" ]; then
        log "No changes to commit in cycle ${cycle_num}"
        return 0
    fi

    git -C "$PROJECT_DIR" add -A
    git -C "$PROJECT_DIR" commit -m "engine: cycle ${cycle_num} — ${modules_processed} modules, \$${cycle_cost} spend" \
        --allow-empty-message 2>/dev/null || true

    # Auto-tag major milestones
    if [ "$AUTO_GIT_TAG" = "true" ] && [ $(( cycle_num % 5 )) -eq 0 ]; then
        local tag_name="engine-milestone-${TIMESTAMP}-c${cycle_num}"
        git -C "$PROJECT_DIR" tag "$tag_name" 2>/dev/null || true
        log "Tagged milestone: ${tag_name}"
    fi

    success "Committed cycle ${cycle_num} changes"
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
        issue_count=$(jq '[.issues[] | select(.severity=="critical" or .severity=="high")] | length' "$audit_file" 2>/dev/null || echo 1)
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

# ── Generate morning briefing ─────────────────────────────────────────────────
generate_report() {
    local status="${1:-COMPLETE}"
    local report_file="${RUN_DIR}/MORNING_BRIEFING.md"

    log "Writing morning briefing..."

    {
        echo "# SiteSyncAI — Morning Briefing"
        echo ""
        echo "> The engine ran while you slept. Here is what changed."
        echo ""
        echo "| | |"
        echo "|---|---|"
        echo "| **Status** | ${status} |"
        echo "| **Run** | \`${TIMESTAMP}\` |"
        echo "| **Duration** | $(elapsed) |"
        echo "| **Cycles completed** | ${CYCLE} |"
        echo "| **API spend** | \$${ESTIMATED_SPEND} |"
        echo "| **Prompts executed** | ${TOTAL_PROMPTS_EXECUTED} |"
        echo "| **Features invented** | ${FEATURES_INVENTED} |"
        echo ""
        echo "---"
        echo ""
        echo "## Module Score Trending"
        echo ""
        echo "| Module | History | Latest |"
        echo "|--------|---------|--------|"

        for score_file in "${SCORES_DIR}"/*.txt; do
            [ -f "$score_file" ] || continue
            local mod
            mod=$(basename "$score_file" .txt)
            local scores
            scores=$(tr '\n' '→' < "$score_file" | sed 's/→$//')
            local latest
            latest=$(tail -1 "$score_file" 2>/dev/null || echo "N/A")
            echo "| ${mod} | ${scores} | **${latest}** |"
        done

        echo ""
        echo "---"
        echo ""
        echo "## What Changed (Last Cycle)"
        echo ""
        if git -C "$PROJECT_DIR" log --oneline -10 2>/dev/null; then
            echo ""
        fi

        echo ""
        echo "---"
        echo ""
        echo "## Unresolved Issues Carried Forward"
        echo ""
        local last_cycle_dir="${RUN_DIR}/cycle_${CYCLE}"
        if [ -d "$last_cycle_dir" ]; then
            for audit_file in "${last_cycle_dir}"/audit_*.json; do
                [ -f "$audit_file" ] || continue
                local mod_label
                mod_label=$(jq -r '.module // "unknown"' "$audit_file")
                local high_issues
                high_issues=$(jq -r '.issues[] | select(.severity=="critical" or .severity=="high") | "- [\(.severity)] \(.title)"' "$audit_file" 2>/dev/null | head -5)
                if [ -n "$high_issues" ]; then
                    echo "### ${mod_label}"
                    echo "$high_issues"
                    echo ""
                fi
            done
        fi

        if [ "$FEATURES_INVENTED" -gt 0 ]; then
            echo ""
            echo "---"
            echo ""
            echo "## Features Invented This Run"
            echo ""
            echo "> These did not exist in any construction software before last night."
            echo ""
            if [ -d "$last_cycle_dir" ]; then
                for audit_file in "${last_cycle_dir}"/audit_*.json; do
                    [ -f "$audit_file" ] || continue
                    local inv_features
                    inv_features=$(jq -r '.invented_features[]? | "- **\(.title)**: \(.description // "")"' "$audit_file" 2>/dev/null)
                    if [ -n "$inv_features" ]; then
                        echo "$inv_features"
                    fi
                done
            fi
        fi

        echo ""
        echo "---"
        echo ""
        echo "## Tomorrow Night"
        echo ""
        echo "\`\`\`bash"
        echo "# 1. See every change the engine made"
        echo "git log --oneline -20"
        echo ""
        echo "# 2. Run the platform"
        echo "npm run dev"
        echo ""
        echo "# 3. Update your priorities"
        echo "nano FEEDBACK.md"
        echo ""
        echo "# 4. Run again"
        echo "MAX_CYCLES=25 MAX_SPEND=400 ./autonomous_loop.sh ."
        echo "\`\`\`"
        echo ""
        echo "---"
        echo ""
        if [ "$status" = "COMPLETE" ]; then
            echo "> Zero actionable issues remain across all modules."
            echo "> The engine is now in Invention Mode — building things that don't exist yet."
            echo "> Keep going. The gap between SiteSync and every other platform is widening."
        else
            echo "> The engine stopped early (budget or cycle limit)."
            echo "> Every change it made is committed. Run it again tomorrow night to keep going."
            echo "> The platform is better than it was yesterday. That is enough for today."
        fi
        echo ""
        echo "---"
        echo ""
        echo "*The construction industry runs \$2 trillion of projects per year on software*"
        echo "*that treats the people building it as an afterthought. That ends here.*"
        echo ""
        echo "*— Built for Walker Benner. Go build something they will never forget.*"
    } > "$report_file"

    success "Morning briefing written: ${report_file}"
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

        header "CYCLE ${CYCLE} / ${MAX_CYCLES} | Spent: \$${ESTIMATED_SPEND} / \$${MAX_SPEND} | $(elapsed)"

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

            # Check if this module is invention-eligible (score >= 90 for 2+ cycles)
            local invention_eligible="false"
            if [ "$INVENTION_MODE" = "true" ] && [ -f "${SCORES_DIR}/${mod_name}.txt" ]; then
                local score_count
                score_count=$(wc -l < "${SCORES_DIR}/${mod_name}.txt" | tr -d ' ')
                if [ "${score_count:-0}" -ge 2 ]; then
                    local recent_scores
                    recent_scores=$(tail -2 "${SCORES_DIR}/${mod_name}.txt" | tr '\n' ' ')
                    local all_high=true
                    for s in $recent_scores; do
                        s="${s//[^0-9]/}"   # strip non-numeric chars (newlines, spaces)
                        if [ -n "$s" ] && [ "$s" -lt 90 ] 2>/dev/null; then all_high=false; break; fi
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
            open_issues=$(jq '[.issues[] | select(.severity=="critical" or .severity=="high")] | length' "$audit_file" 2>/dev/null || echo 1)
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

        # Save state for resume support
        echo '{"last_completed_cycle":'"$CYCLE"',"estimated_spend":"'"$ESTIMATED_SPEND"'","prompts_executed":'"$TOTAL_PROMPTS_EXECUTED"'}' > "$STATE_FILE"

        # Status summary
        echo ""
        echo -e "${BOLD}  Cycle ${CYCLE} complete:${NC} ${modules_processed} modules, \$${CYCLE_SPEND} this cycle, \$${ESTIMATED_SPEND} total, $(elapsed)"
        echo ""

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

    echo ""
    echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${GREEN}  SITESYNC AI ENGINE DONE${NC}"
    echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${DIM}Cycles:${NC}          ${CYCLE}"
    echo -e "  ${DIM}Spend:${NC}           \$${ESTIMATED_SPEND}"
    echo -e "  ${DIM}Duration:${NC}        $(elapsed)"
    echo -e "  ${DIM}Prompts run:${NC}     ${TOTAL_PROMPTS_EXECUTED}"
    echo -e "  ${DIM}Features invented:${NC} ${FEATURES_INVENTED}"
    echo -e "  ${DIM}Report:${NC}          ${RUN_DIR}/MORNING_BRIEFING.md"
    echo ""
    echo -e "  ${CYAN}git log --oneline -20${NC}   — see every change"
    echo -e "  ${CYAN}npm run dev${NC}             — run the app"
    echo ""
}

main "$@"
