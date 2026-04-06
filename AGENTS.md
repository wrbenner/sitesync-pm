# AGENTS.md — SiteSync PM Agent Coordination Protocol
<!-- Compliant with AAIF specification (Linux Foundation) -->
<!-- Read this before any autonomous action. -->

## Role Definitions

### Investigator
- **Access:** Read only. Analyzes gaps.
- **Never:** Writes production code.
- **Output:** Structured gap analysis document.
- **Model:** claude-opus-4-5 (deep reasoning needed)
- **Cost cap:** $2.00 per task

### Implementer
- **Access:** Read and write production code.
- **Never:** Writes tests. That's the Tester's job.
- **Output:** Working code changes committed to a feature branch.
- **Model:** claude-sonnet-4-5 (fast generation)
- **Cost cap:** $5.00 per task
- **Must read:** LEARNINGS.md before starting any implementation.

### Tester
- **Access:** Read production code. Write test files only.
- **Never:** Modifies production code.
- **Output:** Unit tests, property tests, edge case tests.
- **Model:** claude-sonnet-4-5 (pattern following)
- **Cost cap:** $3.00 per task
- **Rule:** Must write at least one test expected to FAIL before fixing.

### Critic
- **Access:** Read only of implementation. Writes defect reports.
- **Never:** Approves its own work.
- **Output:** Structured defect list with severity classification.
- **Model:** claude-opus-4-5 (adversarial depth)
- **Cost cap:** $2.00 per task

### Verifier
- **Access:** Runs quality gates. Updates SPEC.md and LEARNINGS.md.
- **Authority:** Final say on merge readiness.
- **Output:** MERGE READY or BLOCKED verdict with justification.
- **Model:** claude-sonnet-4-5 (structured checking)
- **Cost cap:** $1.50 per task

## Communication Protocol

Agents communicate via structured JSON in `.worktrees/messages/`:

```json
{
  "from": "critic-001",
  "to": "implementer-001",
  "type": "defect",
  "severity": "blocking",
  "gene": "Dashboard",
  "description": "Weather widget still uses mock data",
  "timestamp": "2026-04-05T02:15:00Z"
}
```

Valid message types: `gap-analysis`, `completion`, `defect`, `test-result`, `verdict`, `question`

## Sacred Files (NEVER modify autonomously)

These files require human review before any change:
- `supabase/migrations/*` — database migrations affect production data
- `SPEC.md` Strand 2 (Architecture Laws) — only modified with ADR in DECISIONS.md
- `.env`, `.env.production`, `.env.local` — never read, never write, never commit
- `DECISIONS.md` existing ADRs — decisions are immutable, add new ones to supersede
- `package.json` dependencies — new deps need human approval (bundle size impact)

## Files Agents CAN Modify

- `SPEC.md` Strand 3 (Feature Genome) checkboxes and expression percentages
- `SPEC.md` Strand 4 (Quality Invariants) table values
- `LEARNINGS.md` — append new entries
- `QUESTIONS.md` — add new questions
- `.quality-floor.json` — only to IMPROVE floors (never to lower them)
- `EVOLUTION_LEDGER.json` — append new evolution records
- `src/**/*.ts`, `src/**/*.tsx` — production code (Implementer only)
- `src/**/*.test.ts`, `src/**/*.test.tsx` — test files (Tester only)

## Escalation Protocol

If any agent encounters ambiguity not resolved by SPEC.md + LEARNINGS.md + DECISIONS.md:

1. Write to QUESTIONS.md with full context
2. Stop that task immediately (do not guess on architecture decisions)
3. Continue other independent tasks
4. Walker reviews QUESTIONS.md and answers
5. Agent reads answer before resuming

## Wave Execution Order

Standard gene implementation follows four waves:

```
Wave 1: [Investigator] ─────────────────────────────> Gap Analysis
Wave 2: [Implementer] + [Tester] ──────────────────> Code + Tests (parallel)
Wave 3: [Critic] ──────────────────────────────────> Defect Report
Wave 4: [Verifier] ────────────────────────────────> Merge Decision
```

Tasks within a wave run in parallel. Waves execute in sequence.
A wave does not start until the previous wave completes.

## Cost Controls

- Maximum spend per overnight run: $50
- Maximum spend per single gene: $15
- If total spend exceeds cap, the orchestrator halts and logs to QUESTIONS.md
- Model selection is based on cognitive requirement, not defaulting to the most expensive

## Git Hygiene

- Each agent works in its own git worktree (isolated copy)
- Branch naming: `organism/[role]-[gene-slug]-[timestamp]`
- Commits tagged with `[organism]` prefix
- No two agents modify the same file simultaneously
- Verifier is the only agent that can approve a merge

## Commands

| Task | Command |
|------|---------|
| Build | `npm run build` |
| Dev server | `npm run dev` |
| Test all | `npx vitest run` |
| Test single | `npx vitest run src/test/path.test.ts` |
| E2E (all) | `npx playwright test` |
| E2E single | `npx playwright test e2e/name.spec.ts` |
| Lint | `npm run lint` |
| Type check | `npx tsc --noEmit` |
| Coverage | `npx vitest run --coverage` |
| Bundle check | `node scripts/check-bundle-size.js` |

## Architecture

```
src/pages/          — Page-level components (one per route)
src/components/     — Reusable UI components
src/hooks/          — Custom React hooks
src/stores/         — Zustand state stores
src/machines/       — XState state machines for workflows
src/lib/            — Utility libraries
src/api/            — API client and endpoint definitions
src/types/          — TypeScript type definitions
src/services/       — External service integrations
supabase/migrations/ — Database schema migrations
supabase/functions/ — Edge functions
e2e/                — Playwright E2E tests
```

## Workflows

### Implementing a New Feature

1. Read `SPEC.md` — find the highest priority unchecked acceptance criterion
2. Read `LEARNINGS.md` — check if similar work has been done before
3. Plan the implementation (do NOT write code yet)
4. Create/update Supabase migration if needed
5. Implement the feature
6. Write unit tests (vitest) + property tests (fast-check) if applicable
7. Write E2E test (playwright) if it's a user-facing feature
8. Run all quality gates: build, lint, tsc, vitest, bundle check
9. Check off the acceptance criterion in `SPEC.md`
10. Add any learnings to `LEARNINGS.md`
11. Commit with message format: `feat(scope): description` or `fix(scope): description`

### Fixing a Bug

1. Write a failing test that reproduces the bug
2. Fix the bug
3. Verify the test passes
4. Run full quality gates
5. Commit with: `fix(scope): description`

## Coding Standards

- All styles from `theme.ts` tokens. ZERO hardcoded hex values.
- All types from `entities.ts`. ZERO `as any`.
- State machines govern all workflows (XState 5).
- Every mutation: permission check → Zod validate → execute → invalidate cache → audit trail → toast.
- Every page: loading skeleton → error boundary → empty state → data → real-time subscription.
- Every form: Zod validation, field-level errors, auto-save drafts, submit loading state.
- Every list: search, filter, sort, cursor-based pagination, virtualization at 100+ items.
- Every button wrapped in `<PermissionGate>`.

## Domain Terminology

| Term | Definition |
|------|-----------|
| RFI | Request for Information — formal question from one party to another |
| Submittal | Document submitted by contractor for architect/engineer approval |
| Change Order | Modification to the original contract scope/cost/schedule |
| Punch List | List of items that need to be completed or corrected before final payment |
| Daily Log | Daily record of work performed, weather, visitors, deliveries |
| AIA G702/G703 | Standard billing forms (Application for Payment / Continuation Sheet) |
| Lien Waiver | Legal document releasing right to file a lien against property |
| CPM Schedule | Critical Path Method — the standard for construction scheduling |
| GC | General Contractor |
| Sub | Subcontractor |
| CO | Change Order |
| PCO | Potential Change Order |
| SOV | Schedule of Values |
| Earned Value | Comparison of planned vs actual work completed vs cost |

## Three-Tier Boundaries

### Always (do without asking)
- Run lint before committing
- Run type check before committing
- Follow existing patterns in the codebase
- Use existing components from `Primitives.tsx`
- Write tests for new functionality
- Check `SPEC.md` acceptance criteria match what you're building

### Ask First
- Database schema changes (new migrations)
- Adding new npm dependencies
- Modifying CI/CD configuration
- Changing authentication or permission logic
- Modifying state machine transitions

### Never
- Commit secrets, API keys, or `.env` files
- Use `as any` type casts
- Add mock/fake/placeholder data to production code
- Force push to main
- Delete or modify existing tests without explanation
- Remove a failing test instead of fixing the code
- Use `// @ts-ignore` or `// @ts-expect-error`
- Hardcode hex colors, pixel values, or magic numbers (use `theme.ts`)
