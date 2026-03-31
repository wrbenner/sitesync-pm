# SITESYNC AI — AUTONOMOUS EVOLUTION ENGINE v4.0
### The Overnight Engine That Makes SiteSync Into Something Nobody Has Seen Before

**For:** Walker Benner, Founder
**Last updated:** March 2026

---

## WHAT THIS DOES

You set it up once. Every night you run it. While you sleep, it:

1. **Reads your vision and priorities** from VISION.md and FEEDBACK.md
2. **Audits every module** of the codebase across 14 dimensions with live competitive research against Procore, Autodesk, and Fieldwire
3. **Generates exact code changes** — not suggestions, actual Claude Code execution prompts
4. **Makes every change** via Claude Code in non-interactive mode
5. **Verifies the build passes** — auto-fixes any regressions
6. **Verifies every change** was correctly implemented — unresolved issues carry forward as P0
7. **Invents new features** once a module hits 90+ for two cycles — it stops fixing and starts building things nobody has
8. **Commits everything** with descriptive git messages
9. **Writes you a morning briefing** with score trending, what changed, what was invented, and what's next

Start it before bed. Wake up to a categorically better platform.

---

## ONE-TIME SETUP

### Step 1 — Install Prerequisites

```bash
# Claude Code CLI
npm install -g @anthropic-ai/claude-code

# jq (JSON processor)
brew install jq       # macOS
sudo apt-get install -y jq   # Linux

# bc (calculator, usually already installed)
brew install bc       # macOS only if missing
```

### Step 2 — Set Your API Key

```bash
# Add to ~/.zshrc so it persists:
echo 'export ANTHROPIC_API_KEY="YOUR_NEW_KEY_FROM_CONSOLE"' >> ~/.zshrc
source ~/.zshrc
```

> **IMPORTANT — Key Rotation Required:**
> The API key you shared earlier (`sk-ant-api03-ArJ45...`) was exposed in a conversation and must be rotated immediately.
> Go to https://console.anthropic.com/settings/keys, delete that key, and generate a new one.
> Paste the new key above in place of `YOUR_NEW_KEY_FROM_CONSOLE`.
>
> **Always set a spending limit:** https://console.anthropic.com/settings/billing
> Recommended first limit: $500

### Step 3 — Make the Script Executable

```bash
cd /path/to/sitesync-pm
chmod +x autonomous_loop.sh
```

### Step 4 — Create Your VISION.md

This is the most important file. The engine reads it before every audit and treats it as the north star for every decision.

Create `VISION.md` in your project root:

```markdown
# SiteSyncAI Product Vision

## What We Are Building

SiteSyncAI is the construction operating system that makes every other
platform look like it was built in 2005. We are not improving on Procore.
We are making Procore irrelevant.

## Who Uses It

The superintendent managing a $200M mixed-use tower. The PM at a 50-person
GC running 8 active jobs. The CFO of a national construction firm who
needs real cash flow visibility, not a spreadsheet. The owner who wants
to know the truth about their project, not a sanitized report.

## What It Must Feel Like

Walking into the best-run jobsite you've ever seen. Everything in its place.
Everyone knows what they need to know. Nothing falls through the cracks.
AI is everywhere but invisible — it just makes everything faster and smarter.

## What We Are NOT Building

Another feature-dumped enterprise app that requires a 3-day training.
A Procore clone with a fresh coat of paint.
Software that ignores how construction actually works in the field.

## The Three Things That Make a GC Switch Overnight

1. The AI that catches problems before they become delays
2. Financial visibility that goes from contract to cash in 3 clicks
3. Field capture so fast a super will actually use it

## Where We Want to Be in 12 Months

The platform that a $500M GC references in their board deck as a competitive
advantage. The platform their supers brag about on the job site. The platform
their CFO credits for a 2-point margin improvement.
```

### Step 5 — Create Your FEEDBACK.md

This file directs tonight's priorities. Update it every morning.

```markdown
# Engine Priorities

## This Week (P0)

## Construction Gaps I've Noticed

## UI Issues

## Features I Want Invented
```

### Step 6 — Git Checkpoint

```bash
cd /path/to/sitesync-pm
git add -A
git commit -m "checkpoint: before engine run"
```

---

## RUNNING IT TONIGHT

### The Standard Overnight Run

```bash
# 1. Open a tmux session so it keeps running after you close your laptop
tmux new -s engine

# 2. Navigate to the project
cd /path/to/sitesync-pm

# 3. Fire it up
MAX_CYCLES=25 MAX_SPEND=400 ./autonomous_loop.sh .

# 4. Detach: Ctrl+B then D
# 5. Go to sleep
```

### Check In The Morning

```bash
# Reattach to see where it stopped
tmux attach -t engine

# Read the morning briefing
cat engine-logs/run_*/MORNING_BRIEFING.md

# See every change that was made
git log --oneline -20

# Run the app and click through it
npm run dev
```

---

## RUN CONFIGURATIONS

### First Test Run (~$20, validates everything works)
```bash
MAX_CYCLES=1 MAX_SPEND=20 ./autonomous_loop.sh .
```

### Standard Overnight (best balance)
```bash
MAX_CYCLES=25 MAX_SPEND=400 ./autonomous_loop.sh .
```

### Maximum Quality (when you want the deepest possible audit)
```bash
MAX_CYCLES=40 MAX_SPEND=800 ./autonomous_loop.sh .
```

### Budget Run (Sonnet instead of Opus, still excellent)
```bash
MAX_CYCLES=20 MAX_SPEND=150 AUDIT_MODEL=claude-sonnet-4-6 ./autonomous_loop.sh .
```

### Audit Only — See What Needs Fixing Without Touching Code
```bash
DRY_RUN=true MAX_CYCLES=1 ./autonomous_loop.sh .
```

### Target a Specific Module
```bash
# Only audit/fix the financial engine tonight
SKIP_MODULES="ui-design-system,scheduling,field-operations,collaboration,enterprise-portfolio" \
MAX_CYCLES=10 MAX_SPEND=100 ./autonomous_loop.sh .
```

### Resume an Interrupted Run
```bash
RESUME=true MAX_CYCLES=30 MAX_SPEND=500 ./autonomous_loop.sh .
```

### With Slack Notifications (know when it's done)
```bash
export NOTIFY_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
MAX_CYCLES=25 MAX_SPEND=400 ./autonomous_loop.sh .
```

---

## CONFIGURATION REFERENCE

| Variable | Default | What It Does |
|----------|---------|--------------|
| `MAX_CYCLES` | 20 | Maximum audit-execute-verify loops |
| `MAX_SPEND` | 500 | Hard stop at this USD API spend |
| `AUDIT_MODEL` | claude-opus-4-6 | Model for deep audits — Opus = highest quality |
| `CODE_MODEL` | claude-sonnet-4-6 | Model for Claude Code execution |
| `DECOMP_MODEL` | claude-haiku-4-5-20251001 | Model for module decomposition (cheapest, adequate) |
| `LOG_DIR` | ./engine-logs | Where all logs and reports are saved |
| `SKIP_WEB_RESEARCH` | false | Set true to skip competitive research (saves ~20%) |
| `DRY_RUN` | false | Audit without making any code changes |
| `BUILD_CMD` | (auto-detected) | Build command verified after each cycle |
| `TEST_CMD` | (auto-detected) | Test command run after changes |
| `SKIP_MODULES` | (none) | Comma-separated module names to skip |
| `FEEDBACK_FILE` | ./FEEDBACK.md | Your founder priorities file |
| `VISION_FILE` | ./VISION.md | Your product vision file |
| `NOTIFY_WEBHOOK` | (none) | Slack/Discord webhook for completion message |
| `MAX_ISSUES_PER_MODULE` | 20 | Cap on issues per module per cycle |
| `INVENTION_MODE` | true | Invent new features when modules hit 90+ score |
| `RESUME` | false | Resume from last incomplete run |
| `AUTO_GIT_TAG` | true | Tag git milestones every 5 cycles |

---

## COST ESTIMATES (March 2026 Pricing)

| Model | Input | Output |
|-------|-------|--------|
| Claude Opus 4.6 | $5 / 1M tokens | $25 / 1M tokens |
| Claude Sonnet 4.6 | $3 / 1M tokens | $15 / 1M tokens |
| Claude Haiku 4.5 | $1 / 1M tokens | $5 / 1M tokens |

### Per-Cycle Estimates

| Component | Model | Est. Cost |
|-----------|-------|-----------|
| Module decomposition | Haiku | ~$0.08 |
| Deep audit per module (with web) | Opus | $2-5 |
| Claude Code execution per issue | Sonnet | $0.20-1.00 |
| Change verification per module | Opus | $0.50-1.50 |
| **Full cycle (7 modules)** | Mixed | **$25-70** |

### Nightly Run Estimates

| Config | Cycles | Est. Cost | Duration |
|--------|--------|-----------|----------|
| Maximum quality | 25 | $300-500 | 6-10 hrs |
| Balanced | 25 | $150-300 | 4-7 hrs |
| Budget | 15 | $75-150 | 2-4 hrs |
| Quick pass | 3 | $20-50 | 45 min |

**Tip:** Run Opus the first few nights when there are the most high-impact issues. Switch to Sonnet after night 5 for polish work.

---

## HOW THE 14 AUDIT DIMENSIONS WORK

Every module gets scored 0-100 on each of these. Issues are generated for anything below 95.

1. **Visual Polish** — Apple/Linear/Stripe level execution. Every pixel intentional.
2. **Construction Domain Depth** — Matches how actual supers, PMs, and owners work. Not software-PM logic.
3. **Data Richness** — Real calculated metrics, not placeholders. Charts that tell a story.
4. **Interaction Quality** — Keyboard shortcuts, drag-drop, bulk actions, inline editing.
5. **AI Integration** — AI woven into every workflow. Not a sidebar. Not an afterthought.
6. **Mobile and Field-First** — Works perfectly on an iPhone on a dusty jobsite.
7. **Performance** — Instant renders. Virtual lists. Zero unnecessary re-renders.
8. **TypeScript Quality** — Strict types, no `any`, no `eslint-disable`, proper generics.
9. **Error Handling** — Every edge case handled. Skeletons. Empty states. Error boundaries.
10. **Real-Time and Collaboration** — Live updates, presence indicators, conflict resolution.
11. **Accessibility** — WCAG 2.1 AA compliant. Keyboard navigable.
12. **Security and Permissions** — RBAC checks, no data leaks, XSS-safe, SOC2 patterns.
13. **Competitive Differentiation** — What makes a GC choose SiteSync over Procore right now.
14. **Enterprise Readiness** — Audit trail, CSV export, SSO hooks, multi-tenant isolation.

---

## INVENTION MODE

When a module scores 90+ for two consecutive cycles and all known issues are resolved, the engine automatically enters **Invention Mode** for that module.

In Invention Mode, the engine:
- Searches for features that don't exist in any competing product
- Looks for what AI uniquely enables that was impossible in 2020
- Thinks about what a CFO would pay for that no current platform offers
- Generates and executes complete implementations, not just suggestions

This is how SiteSync becomes something nobody has ever seen. The engine does not stop at "parity with Procore." It pushes past it into territory no construction software has explored.

---

## THE DAILY HABIT (5 minutes, maximum results)

### Every Night Before Bed

```bash
# 1. Update your priorities
nano /path/to/sitesync-pm/FEEDBACK.md

# 2. Open tmux
tmux new -s engine

# 3. Run
cd /path/to/sitesync-pm
MAX_CYCLES=25 MAX_SPEND=400 ./autonomous_loop.sh .

# 4. Ctrl+B, D — go to sleep
```

### Every Morning (30 minutes)

```bash
# 1. See what happened
tmux attach -t engine
cat engine-logs/run_*/MORNING_BRIEFING.md

# 2. See every change
git log --oneline -20

# 3. Run the app
npm run dev

# 4. Click through any pages the engine touched
# 5. Note anything off — add to FEEDBACK.md
# 6. Push if satisfied
git push
```

### What to Expect

| Night | What Happens |
|-------|-------------|
| 1 | Architecture, TypeScript, security. Large commits. $150-300 spend. |
| 2-3 | Performance, real-time, state management. Feature depth added. |
| 4-5 | Construction domain depth. RFI workflows, financial engine, scheduling. |
| 6-8 | AI integration gets woven deeper. More predictive, more autonomous. |
| 9-11 | Invention Mode activates. New features nobody has. |
| 12-14 | Polish, edge cases, accessibility, testing. Diminishing spend. |
| 14+ | A construction platform that makes Procore look like legacy software. |

---

## OUTPUT STRUCTURE

```
engine-logs/
└── run_20260401_220000/
    ├── engine.log                        # Everything that printed to terminal
    ├── snapshot.md                       # Full codebase snapshot (cached)
    ├── modules.json                      # Module decomposition
    ├── state.json                        # Resume state
    ├── scores/
    │   ├── ui-design-system.txt          # Score history per module
    │   ├── financial-engine.txt
    │   └── ...
    ├── prior_[module].txt                # Unresolved issues carried forward
    ├── cycle_1/
    │   ├── audit_[module].json           # Scores, issues, competitive intel
    │   ├── audit_[module]_raw.json       # Raw API response
    │   ├── exec_[module]/
    │   │   ├── exec_0_[id].log           # Claude Code execution log
    │   │   ├── invention_0_[module].log  # Invented feature execution log
    │   │   └── ...
    │   ├── verify_[module].json          # fixed / partial / not_fixed
    │   └── build.log                     # Build output
    ├── cycle_2/
    │   └── ...
    └── MORNING_BRIEFING.md               # Your morning report
```

---

## TROUBLESHOOTING

**"ANTHROPIC_API_KEY not set"**
Run: `export ANTHROPIC_API_KEY="sk-ant-..."`

**"Claude Code CLI not found"**
Run: `npm install -g @anthropic-ai/claude-code`

**"jq not found"**
macOS: `brew install jq` | Linux: `sudo apt-get install -y jq`

**Script stops mid-run**
Run with `RESUME=true` to pick up where it left off.

**Build failing repeatedly after auto-fix**
Run with `DRY_RUN=true MAX_CYCLES=1` first to see what the engine plans to change. Add context to FEEDBACK.md about any unusual TypeScript config.

**Rate limits or overloaded errors**
The engine retries automatically with 30s, 60s, 120s backoff. If sustained, check: https://console.anthropic.com/settings/limits

**Want to undo a run completely**
```bash
git log --oneline -10          # Find the "backup checkpoint" commit
git reset --hard <hash>        # Reset to exactly that state
```

**Costs more than expected**
Add `SKIP_WEB_RESEARCH=true` to save ~20%. Or switch to `AUDIT_MODEL=claude-sonnet-4-6`.

---

## SAFETY RULES

1. **Always git commit before running.** The engine modifies your actual files.
2. **Always do a test run first.** `MAX_CYCLES=1 MAX_SPEND=20 ./autonomous_loop.sh .`
3. **Watch your spend.** https://console.anthropic.com/settings/billing
4. **Git is your undo button.** Every change is committed. `git reset --hard` brings you back.
5. **The engine is safe to restart.** All state is preserved. Just run it again.
6. **Update FEEDBACK.md daily.** This is the single highest-leverage thing you do.

---

## WHAT "DONE" MEANS

The engine declares zero actionable issues when every module scores 90+ across all 14 dimensions, the build is clean, all changes have been verified, and competitive research confirms SiteSync is ahead of every competitor in every area it has audited.

That is not the goal. The goal is something no construction platform has ever been.

The engine does not stop at "done." In Invention Mode, it keeps pushing.

---

*Built for Walker Benner. Go build something the industry has never seen.*
