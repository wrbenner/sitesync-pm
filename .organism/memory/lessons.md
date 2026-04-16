# Organism Lessons — Accumulated Wisdom

## PRIME DIRECTIVE (April 16, 2026)
PERFECT WHAT EXISTS. Do NOT invent new features.
Every cycle should make existing pages better — not add new ones.
The goal: every page enterprise-grade, better than any platform out there.
Only build infrastructure (service layers) when needed to support existing pages.


## Merge Conflicts — Auto-Rebase (April 16, 2026)
When multiple tiers run simultaneously, the first to merge changes main.
Later tiers' PRs become "dirty" (merge conflicts). NEVER just poll and timeout.
All tiers MUST call the GitHub update-branch API to auto-rebase:

```python
if state == "dirty":
    run_gh("gh", "api", f"repos/{owner}/{repo}/pulls/{pr_number}/update-branch",
        "--method", "PUT", "-f", "update_method=rebase")
    time.sleep(15)
    continue
```

This applies to ALL tiers: Strategic Experiments, Design Excellence, Feature Hardening,
Quality Swarm, and Test Coverage. If a new tier is created, it MUST include this pattern.
Without it, the tier builds successfully but wastes the entire cycle on a timeout.

> This file is the organism's long-term memory. It is updated automatically
> after every 3 cycles by the reflect phase. The organism reads this before
> every strategic decision.

## Architecture — The Kernel Pattern

- The gold standard service layer is `src/services/rfiService.ts` — ALL new services MUST follow its exact pattern
- Service layers enforce: server-resolved roles, lifecycle transitions via state machines, provenance columns (created_by, updated_by), soft-delete filtering (deleted_at IS NULL)
- Data flow: service layer → Zustand store → React component. Never skip the service layer.
- Never trust client-side role checks. Roles are resolved server-side only.
- State machines in `src/machines/` define valid lifecycle transitions. Services MUST enforce these.

## Code Quality — Hard-Won Rules

- `npm ci` is MANDATORY — never use `rm -f package-lock.json && npm install` (causes @react-pdf/svg 404)
- ESLint errors can only decrease. The quality floor in `.quality-floor.json` is a ratchet.
- Do NOT add `eslint-disable` comments — actually fix the code
- All TypeScript must be strict — no `any` types, no `@ts-ignore`
- Migrations must be idempotent: use `DROP IF EXISTS` before `CREATE POLICY`, `CREATE TRIGGER`, etc.
- `project_members.created_at` does NOT exist — use `invited_at` instead
- psql direct connections fail in CI — always use REST API (Supabase client) for database access
- After merging workflow changes, GitHub Actions takes up to 60 minutes to register new cron schedules

## UI Standards — Apple-Level Polish

- Every style MUST use tokens from `src/styles/theme.ts` — NEVER raw hex colors or hardcoded pixel values
- Mobile-first: 48px minimum touch targets on ALL interactive elements
- Every data-dependent view needs three states: loading skeleton, error boundary, empty state
- Animations: use framer-motion with subtle, purposeful transitions
- Typography must follow the scale in theme.ts — no arbitrary font sizes
- Color palette is construction-grade: deep navy, warm amber accents, clean whites
- Glass morphism effects for elevated surfaces (cards, modals)

## What Works (High Success Rate)

- Fixing ESLint errors in `src/stores/` — patterns are repetitive, low risk
- Creating service layers from the rfiService.ts template — well-defined pattern
- Single-page polish (one page per PR) — focused changes pass CI reliably
- Reducing unused imports — easy wins for ESLint count

## What Fails (Avoid These)

- Multi-page refactors in a single PR — too many changes, CI failures
- Broad hook refactors — cascade of breaking changes
- Adding new dependencies — risk of npm compatibility issues
- Touching `.agent/CONSTITUTION.md` — these are immutable safety rules
- Global AI rollout changes — out of approved scope
- Cleanup removals of existing code — may break unknown dependencies

## Priority Hierarchy

1. Quality emergencies (ESLint/TS regressions on main)
2. Missing kernel service layers (submittal, dailyLog, changeOrder, punchItem, schedule, inspection, drawing)
3. Page polish to enterprise quality
4. Test coverage for critical service paths
5. Performance and bundle size improvements
6. Accessibility improvements

## Approved Scope

YES: governance, kernel spec, schema migrations, eval harness, RFI vertical slice, organism infrastructure, service layers, page polish
NO: non-core pages, broad hook refactors, global AI rollout, cleanup removals, workflow rebuilds beyond RFI

## The 5 Moments (Product Vision)

1. Morning Briefing — personalized AI summary
2. Field Capture — voice/photo to structured data
3. Self-Writing Daily Log — continuous capture, 2-minute review
4. Coordination Engine — trade conflict detection
5. Owner Report — auto-generated dashboards

These moments define the product. Every change should move toward making them perfect.

## Pipeline Validation
- 2026-04-16T13:35:00Z: Merge pipeline validated end-to-end

## Efficiency Optimizations (April 16, 2026)

### GPT-4o Review Threshold
GPT-4o sometimes labels 7.8/10 code as "REJECT." A 7.8 is GOOD code.
Only skip experiments scoring below 5.5. Above that, always attempt to merge.

### Tier Coordination: Design → Harden Pipeline
Feature Hardening should always target the page Design Excellence MOST RECENTLY polished.
This creates a pipeline: Design makes it beautiful → Hardening makes it bulletproof.
Don't independently pick pages — follow Design Excellence's lead.

### Quality Swarm: Beyond ESLint Errors
When ESLint errors are at the floor, the swarm should also fix:
- ESLint warnings (currently 52)
- `any` types (replace with proper TypeScript interfaces from src/types/)
- `@ts-ignore` comments
- TypeScript strictness issues

### Never Create New Tiers Without These Patterns
Every new tier MUST include:
1. Auto-rebase on merge conflicts (update-branch API)
2. Check runs creation for branch protection
3. Shared memory write via Contents API (not git push)
4. FORBIDDEN instruction for .github/ and .organism/ files
5. git checkout -- .github/ before committing
