Read SPEC.md and identify the highest-priority feature with unchecked acceptance criteria.

Before writing any code:
1. Read LEARNINGS.md for relevant patterns
2. Read DECISIONS.md for architectural constraints
3. Plan the implementation and show me the plan

Implementation order:
1. Database migration (if needed) in supabase/migrations/
2. Type definitions in src/types/entities.ts
3. API endpoint in src/api/endpoints/
4. React Query hook in src/hooks/queries/ or mutation in src/hooks/mutations/
5. State machine (if entity has workflow) in src/machines/
6. Components in src/components/
7. Page integration in src/pages/
8. Unit tests in src/test/
9. E2E test in e2e/
10. Update SPEC.md — check off completed acceptance criteria
11. Update LEARNINGS.md if you discovered a new pattern

Quality gates before committing:
- `npx tsc --noEmit` passes
- `npm run lint` has no new warnings
- `npx vitest run` passes
- `npm run build` succeeds
- `node scripts/check-bundle-size.js` passes

Commit with: `feat(scope): description [auto]`

The [auto] tag marks this as an AI-generated commit for the self-healing CI to recognize.
