# RUN.md — The Ignition Manual
*How to wake the organism and let it build while you sleep.*

## Method 1: Claude Code Scheduled Tasks (Recommended — No Setup)

This is the easiest. Claude Code v2.1.72+ has native cloud scheduled tasks that run on Anthropic's infrastructure. No server required.

### One-Time Setup
```bash
# Make sure you have the latest Claude Code
npm update -g @anthropic-ai/claude-code
claude --version  # Must be 2.1.72 or later

# Navigate to your repo
cd /path/to/sitesync-pm

# Set up the nightly build (runs 2am every night)
claude "/loop Read SPEC.md and FEEDBACK.md. Implement the highest-priority unchecked acceptance criterion. Run all quality gates (tsc, lint, vitest, build). If all pass, commit with [auto] tag. Repeat up to 3 features. Update LEARNINGS.md. every 1d"
```

### What Happens
- 2:00 AM: Organism wakes
- Reads FEEDBACK.md (your P0 priorities)
- Reads SPEC.md (finds next unchecked criterion)
- Reads LEARNINGS.md (avoids past mistakes)
- Implements, tests, commits
- Runs quality gates — if any fail, fixes before committing
- Repeats up to 3 features per night
- Morning: open Claude Code to see what was built

### Manual Run (Any Time)
```bash
claude "Read SPEC.md and FEEDBACK.md. Implement the next feature."
```

---

## Method 2: GitHub Actions Nightly Build (Automatic, Auditable)

This runs without any local machine. Every run is logged, every commit is tracked.

### One-Time Setup
1. Add `ANTHROPIC_API_KEY` to GitHub Secrets:
   - Go to: Settings → Secrets → Actions → New repository secret
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...`

2. The `.github/workflows/nightly-build.yml` is already in the repo.

3. The first run triggers automatically at 2am CDT. You can also trigger manually:
   - Go to Actions → Nightly Organism → Run workflow

### Cost Estimate
- Per run: ~$8-25 depending on task complexity (Opus 4.6)
- Per month: $240-750
- Per year: $2,880-9,000

This is the cheapest engineering team on earth.

### Review Morning Results
```bash
git pull origin main
git log --oneline --author="SiteSync Organism" -20
```

---

## Method 3: Overnight Local Run (Maximum Power)

For long runs when you have a laptop or server available:

```bash
# In tmux so it keeps running after you close the laptop
tmux new -s organism

cd /path/to/sitesync-pm
export ANTHROPIC_API_KEY="sk-ant-..."

# Run the original autonomous loop (maximum quality, highest cost)
MAX_CYCLES=20 MAX_SPEND=200 ./archive/autonomous_loop_v3.sh /path/to/sitesync-pm

# Detach: Ctrl+B, then D
# Check in the morning: tmux attach -t organism
```

---

## Before Every Run: Update FEEDBACK.md

1. Open FEEDBACK.md
2. Replace "Tonight's P0 Priorities" with what you want done
3. Be specific: name the file, the line, the exact behavior

Example:
```
Tonight's P0 Priorities:
1. The Submittals page shows mock review timelines. Connect to the real submittals table.
2. Add PermissionGate to every button on the Budget page.
3. The Daily Log page crashes when there are no entries. Add an empty state.
```

---

## Quality Ratchet Monitoring

After every run, check that quality metrics improved:
```bash
cat .quality-floor.json
```

The organism automatically updates this file when it improves a metric. Over time you'll see:
- `mockDataInstances` decreasing
- `anyTypeCasts` decreasing  
- `testCoverage` increasing
- `bundleSizeKB` decreasing or stable

---

## Troubleshooting

**Organism is making the same fix over and over:**
It's stuck in a loop. Update FEEDBACK.md to skip that feature and move on.

**CI is failing on every commit:**
The quality gates are catching regressions. Check the Actions log for details. The self-healing workflow should auto-create a repair issue.

**The organism went too wide (changed too many files):**
Add to AGENTS.md: "Keep each commit under 5 files. Large changes must be broken into multiple PRs."

**Running out of API budget:**
Reduce `MAX_CYCLES` or switch the Claude model from Opus to Sonnet. Update `nightly-build.yml` or the loop config.
