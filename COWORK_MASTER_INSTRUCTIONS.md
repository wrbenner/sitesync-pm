# SITESYNCAI AUTONOMOUS IMPROVEMENT ENGINE v3.0
# MASTER SETUP AND OPERATIONS GUIDE

**For:** Walker Benner, Founder, SiteSyncAI
**Version:** 3.0 — March 2026
**Purpose:** Run a fully autonomous codebase improvement loop with zero human intervention required during execution

---

## WHAT THIS DOES

This engine creates an autonomous loop between Claude API (deep research and auditing) and Claude Code (code execution) that runs continuously — improving the SiteSyncAI platform until it reaches zero actionable issues across every dimension.

Start it before you go to sleep. Wake up to a categorically better platform.

The engine audits every module of the codebase against 13 dimensions — architecture, security, performance, AI integration, construction domain depth, UI/UX design, financial engine, and more — with competitive web research against Procore, Autodesk, and every other platform. It generates exact prompts for every issue, executes them via Claude Code one at a time, verifies build integrity, verifies each change, and loops until nothing is left to fix.

**What's new in v3.0:**
- Haiku model for module decomposition (10x cheaper decomposition step)
- FEEDBACK.md injection — your priorities become P0 in every audit
- Graceful Ctrl+C handling — always writes a report before exiting
- Build verification after every cycle — auto-fixes regressions
- Score trending in the final report — see improvement over time
- Git hash-based snapshot caching — avoids redundant snapshots
- Exponential backoff on API retries (30s, 60s, 120s)
- Per-cycle cost tracking alongside cumulative spend
- SKIP_MODULES support for targeting specific areas
- Completion webhook notification
- Full log tee to engine.log for post-run review
- macOS compatibility (no numfmt dependency)

---

## THE VISION

SiteSyncAI is an AI-powered construction project management platform with autonomous agents, digital twins, RFIs, submittals, financial reporting (AIA billing, earned value, job costing), and more. It must be:

- **Years ahead** of Procore, Autodesk Construction Cloud, PlanGrid, Buildertrend, CoConstruct
- **Enterprise-grade:** 10,000+ concurrent users, 99.99% uptime, SOC2-ready
- **AI-native:** autonomous agents woven into every workflow, not bolted on
- **Real-time:** live collaboration, instant sync, offline-first with conflict resolution
- **Beautiful:** Apple-level design that makes Procore look like it was built in 2005
- **The platform that makes a $500M general contractor switch overnight**

---

## SETUP (ONE TIME)

### 1. Get an Anthropic API Key

Go to https://console.anthropic.com, sign in, go to API Keys, create a key. Add a credit card. Set a spending limit if you want a hard cap (recommended: $500 for your first overnight run).

### 2. Install Prerequisites

```bash
# Claude Code CLI (required)
npm install -g @anthropic-ai/claude-code

# jq (JSON processor, required)
brew install jq          # macOS
sudo apt-get install -y jq   # Linux

# bc (calculator, usually pre-installed)
brew install bc          # macOS if missing
sudo apt-get install -y bc   # Linux if missing
```

### 3. Place the Script

Save `autonomous_loop.sh` somewhere accessible. Make it executable:

```bash
chmod +x autonomous_loop.sh
```

### 4. Set Your API Key

```bash
# Persistent (add to ~/.zshrc or ~/.bashrc):
echo 'export ANTHROPIC_API_KEY="sk-ant-YOUR-KEY-HERE"' >> ~/.zshrc
source ~/.zshrc

# Or just for this session:
export ANTHROPIC_API_KEY="sk-ant-YOUR-KEY-HERE"
```

### 5. Create a Clean Git Checkpoint

Always checkpoint before running:

```bash
cd /path/to/sitesyncai
git add -A
git commit -m "checkpoint: before engine run"
```

The engine also auto-commits a backup at startup, but having your own is safer.

---

## HOW TO RUN IT

### Quick Test (validate setup, ~$10-20)

```bash
MAX_CYCLES=1 MAX_SPEND=20 ./autonomous_loop.sh /path/to/sitesyncai
```

### Standard Overnight Run

```bash
# Start a tmux session so it keeps running after you close your laptop
tmux new -s engine

# Run the engine
MAX_CYCLES=30 MAX_SPEND=500 ./autonomous_loop.sh /path/to/sitesyncai

# Detach: Ctrl+B, then D
# Check in the morning: tmux attach -t engine

# Review the report:
cat engine-logs/run_*/REPORT.md
```

### Maximum Quality Run

```bash
MAX_CYCLES=50 MAX_SPEND=1000 ./autonomous_loop.sh /path/to/sitesyncai
```

### Budget-Conscious Run

```bash
MAX_CYCLES=10 MAX_SPEND=100 AUDIT_MODEL=claude-sonnet-4-6 ./autonomous_loop.sh /path/to/sitesyncai
```

### Audit Only (see what needs fixing without touching code)

```bash
DRY_RUN=true MAX_CYCLES=1 ./autonomous_loop.sh /path/to/sitesyncai
```

### Target a Specific Area

```bash
# Skip all modules EXCEPT what you care about today
SKIP_MODULES="infrastructure-config,developer-experience" ./autonomous_loop.sh /path/to/sitesyncai
```

### With Build Verification

```bash
BUILD_CMD="npm run build" MAX_CYCLES=20 ./autonomous_loop.sh /path/to/sitesyncai
```

---

## CONFIGURATION REFERENCE

| Variable | Default | What It Controls |
|----------|---------|-----------------|
| `MAX_CYCLES` | 20 | Maximum audit-execute-verify loops |
| `MAX_SPEND` | 500 | Maximum estimated API cost in USD |
| `AUDIT_MODEL` | claude-opus-4-6 | Model for deep audits (Opus = best quality) |
| `CODE_MODEL` | claude-sonnet-4-6 | Model for Claude Code execution (Sonnet = best value) |
| `DECOMP_MODEL` | claude-haiku-4-5-20251001 | Model for module decomposition (Haiku = cheapest, adequate) |
| `LOG_DIR` | ./engine-logs | Where logs and reports are saved |
| `SKIP_WEB_RESEARCH` | false | Skip competitive web research (saves ~20% cost) |
| `INCLUDE_UI` | true | Include UI/UX design in audits |
| `DRY_RUN` | false | Audit only, don't change code |
| `BUILD_CMD` | (auto-detected) | Build command verified after each cycle |
| `TEST_CMD` | (auto-detected) | Test command run after each cycle |
| `SKIP_MODULES` | (none) | Comma-separated module names to skip |
| `FEEDBACK_FILE` | PROJECT_DIR/FEEDBACK.md | Founder priorities injected into all audits |
| `NOTIFY_WEBHOOK` | (none) | Webhook URL for completion notification |
| `MAX_ISSUES_PER_MODULE` | 20 | Cap on issues processed per module per cycle |

---

## COST ESTIMATES (March 2026 Pricing)

Current API pricing:
- Claude Opus 4.6: $5 input / $25 output per million tokens
- Claude Sonnet 4.6: $3 input / $15 output per million tokens
- Claude Haiku 4.5: $1 input / $5 output per million tokens

### Per-Cycle Cost Breakdown

| Component | Model | Tokens | Est. Cost |
|-----------|-------|--------|-----------|
| Module decomposition | Haiku | ~50K in + ~5K out | **~$0.08** (vs $0.40 on Opus) |
| Deep audit per module (with web search) | Opus | ~200K in + ~15K out | $1.40-$4.00 |
| Claude Code execution per prompt | Sonnet | ~50K per prompt | $0.20-$1.00 |
| Verification per module | Opus | ~200K in + ~5K out | $1.15 |
| **Total per module per cycle** | | | **$3-$8** |
| **Total per full cycle (5-8 modules)** | | | **$20-$70** |

### Overnight Run Estimates

| Codebase Size | Cycles | Est. Cost | Duration |
|--------------|--------|-----------|----------|
| Small (10K lines) | 5-10 | $50-$150 | 1-3 hours |
| Medium (50K lines) | 10-15 | $150-$400 | 3-7 hours |
| Large (100K+ lines) | 15-25 | $300-$800 | 5-12 hours |

### Cost Optimization Options

- **Biggest savings:** Use Sonnet for audits instead of Opus — `AUDIT_MODEL=claude-sonnet-4-6` (cuts audit cost ~40%, still excellent)
- Skip competitive research: `SKIP_WEB_RESEARCH=true` (saves ~20%)
- Cap issues per module: `MAX_ISSUES_PER_MODULE=10` (faster, cheaper cycles)
- First run: `MAX_SPEND=50` to calibrate cost for your specific codebase
- Monitor live spend at https://console.anthropic.com/settings/billing

---

## THE FEEDBACK.MD WORKFLOW

This is the most important feature for directing the engine toward your priorities.

Create or edit `FEEDBACK.md` in the root of your project directory. The engine reads it before every audit and treats it as P0 — higher priority than everything else it finds.

**Example FEEDBACK.md:**
```markdown
# Engine Priorities

## This Week
- The RFI workflow needs to feel effortless. A superintendent should be able to create and send an RFI in under 30 seconds on mobile.
- The budget page needs real job costing — budget vs actual by CSI code, not just flat totals.
- The AI Copilot should proactively surface risks before they become problems, not wait to be asked.

## Construction Domain Gaps I've Noticed
- No lien waiver tracking yet. This is a big deal for GCs.
- Submittals workflow doesn't handle re-submissions well.
- Schedule needs a baseline vs actual comparison view.

## UI Issues
- The sidebar feels heavy. Study how Linear does navigation.
- Metric cards on every page are good — keep those.
```

Update this file any morning before starting the next night's run. The engine picks it up automatically — no other configuration needed.

---

## HOW THE ENGINE WORKS (DETAILED)

### Phase 1: Snapshot

Reads every source file in the project (excluding node_modules, dist, build, lock files, images, fonts). Creates a single comprehensive document with directory structure and all file contents. Large files are intelligently truncated. Uses git hash caching — if nothing changed since the last snapshot, it reuses the cached version instead of re-reading all files.

### Phase 2: Module Decomposition (Haiku)

Claude Haiku analyzes the architecture and groups files into logical modules — authentication, scheduling engine, API layer, UI design system, financial engine, etc. Each module is audited independently for maximum depth. Haiku is used here because decomposition is a straightforward categorization task that doesn't require deep reasoning, saving ~90% on this step.

### Phase 3: Deep Audit (Opus + Web Search, per module)

Each module is scored 1-100 across 13 dimensions. Opus searches the web to benchmark against Procore, Autodesk, Buildertrend, Fieldwire, and PlanGrid in real time. Your FEEDBACK.md priorities are injected as P0 context. Unresolved issues from the previous cycle are carried forward and addressed first.

The 13 dimensions:

1. **Architecture & Scalability** — Can it handle enterprise load?
2. **Code Quality** — Strict TypeScript, SOLID, zero tech debt
3. **Security** — OWASP Top 10, RBAC/ABAC, SOC2 readiness
4. **Performance** — Sub-200ms, indexed queries, caching, no N+1
5. **Real-Time and Offline** — WebSocket, CRDTs, offline-first
6. **AI Integration** — Agents, digital twins, predictive analytics
7. **Testing and Reliability** — 80%+ coverage, error boundaries, observability
8. **Developer Experience** — API design, docs, CI/CD, migration strategy
9. **Construction Domain Depth** — RFIs, submittals, BIM, CPM scheduling, AIA billing
10. **Competitive Differentiation** — What makes a GC switch overnight
11. **Data and Integrations** — Webhooks, Procore migration, QuickBooks/Sage, BIM
12. **Financial Engine** — Job costing, AIA G702/G703, cash flow, lien waivers
13. **UI/UX Design** — Apple-level simplicity, intuitive, construction-first

### Phase 4: Prompt Execution

Every issue generates a specific, self-contained Claude Code prompt. Prompts include exact file paths, function names, acceptance criteria, and construction industry context. They are sorted by severity (critical first) and capped at MAX_ISSUES_PER_MODULE. Each is fed to Claude Code in non-interactive mode with auto-permissions. Failed prompts retry once with a 5-second pause.

### Phase 5: Build Verification

After all prompts in a cycle are executed, the engine runs your build command. If it fails, Claude Code automatically diagnoses and fixes the build errors. This prevents a cycle from introducing syntax errors or TypeScript failures that would break the app.

### Phase 6: Change Verification

After execution, the engine re-snapshots the codebase and verifies every change was correctly implemented. Issues marked "partial" or "not fixed" carry forward to the next cycle as P0 context. Regressions (new bugs introduced by changes) are automatically fixed.

### Phase 7: Commit and Loop

All changes are committed with a descriptive message including cycle number and cost. If any module has remaining issues, the engine starts a new cycle. The loop stops when zero actionable issues remain across all modules, or the budget/cycle limit is hit.

---

## WHAT THE OUTPUT LOOKS LIKE

```
engine-logs/
└── run_20260401_220000/
    ├── engine.log                    # Full session log (everything that printed to terminal)
    ├── snapshot.md                   # Full codebase snapshot (updated each cycle)
    ├── modules.json                  # Module decomposition
    ├── scores/
    │   ├── ui-design-system.txt      # Score history for trending
    │   ├── financial-engine.txt
    │   └── ...
    ├── cycle_1/
    │   ├── audit_ui-design-system.json      # Audit: scores, issues, competitive intel
    │   ├── audit_ui-design-system_raw.json  # Raw API response (for debugging)
    │   ├── audit_financial-engine.json
    │   ├── exec_ui-design-system/
    │   │   ├── prompts.json                 # All prompts for this module
    │   │   ├── exec_0_ui-C1-001.log         # Claude Code execution log per prompt
    │   │   └── exec_1_ui-C1-002.log
    │   ├── verify_ui-design-system.json     # Verification: fixed/partial/not_fixed
    │   ├── build.log                        # Build output
    │   └── ...
    ├── cycle_2/
    │   └── ...
    └── REPORT.md                     # Final summary with score trending
```

---

## THE TWO-WEEK PLAN

Walker's approach for maximum results:

**Every night before bed (~2 minutes):**

```bash
# Update FEEDBACK.md with anything you noticed that day
nano /path/to/sitesyncai/FEEDBACK.md

# Start the engine
tmux new -s engine
MAX_CYCLES=25 MAX_SPEND=400 BUILD_CMD="npm run build" ./autonomous_loop.sh /path/to/sitesyncai
# Ctrl+B, D to detach
```

**Every morning (~30 minutes):**

1. `tmux attach -t engine` — see where it stopped
2. `cat engine-logs/run_*/REPORT.md` — read the score trending and what changed
3. `cd /path/to/sitesyncai && git log --oneline -10` — see all committed changes
4. `npm run dev` — click through key flows, especially anything the engine touched
5. Note anything that feels off or anything you want prioritized → add to FEEDBACK.md
6. `git push` if satisfied with the changes

**What to expect:**

- **Night 1:** Architecture, security, code quality improvements. Big commits. Probably $150-300 spend.
- **Nights 2-5:** Performance, real-time, construction domain gaps. Feature additions. Spend decreases as issues get resolved.
- **Nights 6-10:** AI integration, competitive differentiation, UI polish. Refinement work.
- **Nights 11-14:** Edge cases, testing, final polish. Diminishing spend per night.
- **After 2 weeks:** A platform categorically ahead of anything in construction PM.

---

## MODEL SELECTION GUIDE

| Scenario | AUDIT_MODEL | CODE_MODEL | Est. Nightly Cost |
|----------|-------------|------------|-------------------|
| Maximum quality | claude-opus-4-6 | claude-sonnet-4-6 | $200-400 |
| Balanced | claude-sonnet-4-6 | claude-sonnet-4-6 | $100-200 |
| Budget | claude-sonnet-4-6 | claude-haiku-4-5-20251001 | $50-100 |
| Quick pass | claude-haiku-4-5-20251001 | claude-haiku-4-5-20251001 | $20-50 |

Recommendation: Run Opus for the first few nights when there are the most high-impact issues to find. Switch to Sonnet once the major architectural issues are resolved and you're doing polish work.

---

## NOTIFICATIONS

To receive a message when the engine finishes overnight, set up a webhook. Works with Slack, Discord, or any HTTP endpoint.

**Slack incoming webhook:**
```bash
export NOTIFY_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
MAX_CYCLES=30 MAX_SPEND=500 ./autonomous_loop.sh /path/to/sitesyncai
```

**Discord webhook:**
```bash
export NOTIFY_WEBHOOK="https://discord.com/api/webhooks/YOUR/WEBHOOK"
```

You will get a message like: `SiteSyncAI Engine COMPLETE | 12 cycles | $287.40 | 6h 23m 11s | Zero issues remaining`

---

## TROUBLESHOOTING

**"ANTHROPIC_API_KEY not set"**
Run: `export ANTHROPIC_API_KEY="sk-ant-YOUR-KEY-HERE"`

**"Claude Code CLI not found"**
Run: `npm install -g @anthropic-ai/claude-code`

**"jq not found" or "bc not found"**
macOS: `brew install jq bc`
Linux: `sudo apt-get install -y jq bc`

**Script stops mid-run**
Safe to restart — all changes are preserved in git and logs. Run the command again. It will pick up where it left off (prior cycle audit files remain, new cycle starts fresh).

**Build keeps failing after auto-fix**
Run with `DRY_RUN=true` first to see what the engine plans to change. Check if the codebase has unusual TypeScript configuration. Add build-specific context to FEEDBACK.md.

**API rate limits or overloaded errors**
The engine retries automatically with exponential backoff (30s, 60s, 120s). If you're hitting sustained rate limits, your account may need a higher tier. Check: https://console.anthropic.com/settings/limits

**Codebase too large for context window**
The engine auto-truncates at ~900K tokens and uses module decomposition to audit each area independently. If a single module is still too large, the engine will truncate intelligently. Add very large generated files to a `.engineignore` (not yet implemented) or move them to dist.

**Claude Code prompt fails twice**
The failure log is in `engine-logs/run_*/cycle_*/exec_*/exec_N_ID.log`. You can run the failed prompt manually: `claude -p "$(jq -r '.issues[0].prompt' audit_module.json)" --permission-mode auto`

**Want to undo everything from a run**
```bash
cd /path/to/sitesyncai
git log --oneline -10          # Find the pre-engine backup commit
git reset --hard <commit-hash> # Reset to that exact state
```

---

## IMPORTANT RULES

1. **Always commit before running.** The engine modifies your actual codebase.
2. **Start with a test run.** `MAX_CYCLES=1 MAX_SPEND=20` to validate everything works.
3. **Monitor your spend.** https://console.anthropic.com/settings/billing
4. **The engine auto-commits.** A backup commit is created at startup; changes are committed after each cycle.
5. **Git is your safety net.** You can always `git reset --hard` to any previous commit.
6. **Each run creates fresh logs.** Previous run logs are never deleted.
7. **The engine is idempotent.** Running it multiple times is safe and expected — it just keeps improving.
8. **Update FEEDBACK.md daily.** This is the single highest-leverage thing you can do to direct the engine.

---

## WHAT "DONE" LOOKS LIKE

The engine declares zero actionable issues when:

- Every dimension scores 90+ across all modules
- Security scores 95+
- Zero critical or high severity issues remain
- Build passes cleanly after all changes
- All changes verified as correctly implemented
- Competitive research confirms feature parity or superiority vs Procore and Autodesk
- UI is clean, intuitive, and field-first
- A superintendent could use it on a job site with zero training

This is the bar for a world-class construction platform.

---

*Built for Walker Benner. Go build something nobody has ever seen before.*
