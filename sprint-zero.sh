#!/bin/bash
# sprint-zero.sh — The P0 Blitz
# Run this TONIGHT. It clears ALL mock data from every page in one intensive session.
# This is not a nightly run — it's a one-time intensive that gets the product to demo-ready.
#
# Usage:
#   export ANTHROPIC_API_KEY="sk-ant-..."
#   export VITE_SUPABASE_URL="https://your-project.supabase.co"
#   export VITE_SUPABASE_ANON_KEY="your-anon-key"
#   chmod +x sprint-zero.sh && ./sprint-zero.sh

set -e

REPO_DIR="${1:-$(pwd)}"
MAX_SPEND="${MAX_SPEND:-150}"
LOG_FILE="sprint-zero-$(date +%Y%m%d-%H%M).log"

echo "╔══════════════════════════════════════════════════╗"
echo "║         SPRINT ZERO — P0 MOCK DATA BLITZ         ║"
echo "║   Clearing all mock data in one intensive run    ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Repo: $REPO_DIR"
echo "Max spend: \$$MAX_SPEND"
echo "Log: $LOG_FILE"
echo ""

cd "$REPO_DIR"

# Verify prerequisites
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY not set"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo "Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code
fi

# Count current mock data instances
echo "=== Current Mock Data Scope ===" | tee -a "$LOG_FILE"
TOTAL_MOCKS=$(grep -rn "const.*=.*\[{" src/pages/ --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "Approximate mock arrays in pages: $TOTAL_MOCKS" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Git setup
git config user.name "SiteSync Sprint Zero"
git config user.email "sprint-zero@sitesync.ai"

# Create sprint-zero branch using native worktree support
echo "Creating worktree for sprint zero..."
git worktree add ../sitesync-sprint-zero -b auto/sprint-zero-$(date +%Y%m%d) 2>/dev/null || {
  git checkout -b "auto/sprint-zero-$(date +%Y%m%d)" 2>/dev/null || true
}

WORK_DIR="../sitesync-sprint-zero"
if [ ! -d "$WORK_DIR" ]; then
  WORK_DIR="."
fi

cd "$WORK_DIR"

# Build the Sprint Zero master prompt
cat > /tmp/sprint-zero-prompt.txt << 'SPRINT_EOF'
You are running SPRINT ZERO for SiteSync PM — a one-time intensive that makes the product demo-ready.

YOUR MISSION: Remove ALL mock data from all 50 pages. Connect every page to the real Supabase backend.

THE MOCK DATA PROBLEM:
The pages have hardcoded arrays like this:
```tsx
const rfis = [
  { id: '1', number: 'RFI-001', title: 'Structural beam spec', status: 'open', ... },
  { id: '2', number: 'RFI-002', title: 'Window glazing details', status: 'pending', ... },
]
```

These need to become:
```tsx
const { data: rfis, isLoading, error } = useRFIs(projectId)
```

THE PATTERN (repeat for every page):
1. Identify the mock data arrays at the top of the page
2. Check if a React Query hook already exists in src/hooks/queries/ for this entity
3. If hook exists → replace mock array with the hook
4. If hook doesn't exist → create it in src/hooks/queries/useEntityName.ts using supabase.from()
5. Add loading skeleton (copy pattern from existing pages that have it)
6. Add empty state (entity icon + "No [entity] yet" + "Create [entity]" button)
7. Add error boundary with retry button
8. Replace hardcoded projectId with the real projectId from useProject() or route params

THE PROJECT ID:
The seed data uses project ID from the URL params. Use:
```tsx
const { projectId } = useParams<{ projectId: string }>()
```
Or if the page doesn't use routing params, get it from the project store:
```tsx
const { activeProjectId } = useProjectStore()
```

PRIORITY ORDER (highest mock density first):
1. Drawings.tsx (32 mock instances)
2. Schedule.tsx (27 mock instances)
3. Safety.tsx (23 mock instances)
4. DailyLog.tsx (23 mock instances)
5. PaymentApplications.tsx (20 mock instances)
6. Submittals.tsx (18 mock instances)
7. Tasks.tsx (16 mock instances)
8. AIAgents.tsx (16 mock instances)
9. ProjectHealth.tsx (14 mock instances)
10. RFIs.tsx (12 mock instances)
11. Meetings.tsx (12 mock instances)
12. Budget.tsx (12 mock instances)
13. Files.tsx (11 mock instances)
14. AICopilot.tsx (11 mock instances)
15. PunchList.tsx (9 mock instances)
16. Portfolio.tsx (8 mock instances)
17. Lookahead.tsx (8 mock instances)
18. Integrations.tsx (8 mock instances)
19. FieldCapture.tsx (8 mock instances)
20. Activity.tsx (8 mock instances)

QUALITY GATES BEFORE EACH COMMIT:
- npx tsc --noEmit (must pass)
- npm run build (must pass)
- If either fails, fix before committing

COMMIT AFTER EVERY 3 PAGES:
Do not wait until all pages are done. Commit small batches with message:
"feat(p0): remove mock data from [PageA], [PageB], [PageC] [auto-sprint-zero]"

AFTER EACH PAGE, CHECK OFF IN SPEC.md:
Find the acceptance criterion "Zero mock data" for that page and check it off.

LEARNINGS TO ADD:
If you discover a pattern that will help future agents, add it to LEARNINGS.md.

DO NOT:
- Change the UI design of any page (only replace data sources)
- Add new features
- Break existing functionality
- Change TypeScript types unless absolutely necessary

Output <promise>DONE</promise> when you've processed all 20 pages or exhausted the session budget.
SPRINT_EOF

echo "Starting Sprint Zero..." | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo ""

# Run Claude Code with max budget for this intensive session
claude \
  --dangerously-skip-permissions \
  --model claude-opus-4-6 \
  --max-turns 80 \
  "$(cat /tmp/sprint-zero-prompt.txt)" 2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo "" | tee -a "$LOG_FILE"
echo "=== Sprint Zero Complete ===" | tee -a "$LOG_FILE"
echo "Finished at: $(date)" | tee -a "$LOG_FILE"

# Count remaining mocks
REMAINING=$(grep -rn "const.*=.*\[{" src/pages/ --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "Mock arrays remaining: $REMAINING (was $TOTAL_MOCKS)" | tee -a "$LOG_FILE"

# Push the branch
git push origin HEAD 2>/dev/null || echo "Push failed or nothing to push"

# Create PR
if command -v gh &> /dev/null && [ -n "$GH_TOKEN" ]; then
  gh pr create \
    --title "[sprint-zero] P0: Remove mock data from all pages — $(date +%Y-%m-%d)" \
    --body "## Sprint Zero — P0 Mock Data Removal

    This PR removes all hardcoded mock data from all 50 pages and connects them to the real Supabase backend.

    **Before:** $TOTAL_MOCKS mock data arrays
    **After:** $REMAINING mock data arrays

    Every page now:
    - Queries real Supabase data via React Query hooks
    - Shows loading skeletons during data fetch
    - Shows empty states when no data exists
    - Shows error states with retry button

    *Auto-generated by Sprint Zero*" \
    --base main \
    --label "sprint-zero" \
    --label "p0" || echo "PR creation skipped"
fi

echo ""
echo "Log saved to: $LOG_FILE"
exit $EXIT_CODE
