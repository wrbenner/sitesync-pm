# QUESTIONS.md — Agent Escalations Awaiting Human Input
<!-- When an agent encounters ambiguity not resolved by SPEC.md + LEARNINGS.md + DECISIONS.md, -->
<!-- it writes here and stops that task (does not guess on architecture decisions). -->
<!-- Walker reviews and answers. Agents read answers before resuming. -->

## Template

### Q-XXX: [Brief Question Title]
**Date:** YYYY-MM-DD
**Agent:** [role]-[id]
**Context:** [What the agent was trying to do]
**Question:** [The specific decision needed]
**Options Considered:**
1. [Option A] — [trade-off]
2. [Option B] — [trade-off]
**Answer:** [Filled in by Walker]
**Answered Date:** [Filled in by Walker]

---

## Open Questions

### Q-001: Bug in resolveConflict (src/lib/conflictResolver.ts)
**Date:** 2026-04-12
**Agent:** echo (architecture)
**Context:** Writing tests for conflictResolver.ts revealed that the `fieldResolutions` parameter of `resolveConflict` is dead code. The function returns early when `resolution` is `'local'` or `'server'`, so per-field overrides are never applied.
**Bug:** In `resolveConflict(conflict, 'server', { title: 'local' })`, the caller expects `title` to come from the local version, but the function ignores `fieldResolutions` and returns the full server version unchanged. The per-field merge block (lines after the two early returns) is unreachable with the current `'local' | 'server'` type constraint.
**Failing test documented in:** `src/test/lib/conflictResolver.test.ts > resolveConflict > should return full server version when resolution is server, ignoring fieldResolutions`
**Fix suggestion:** Either remove the `fieldResolutions` parameter (if intentionally unused), or change the early returns to check whether `fieldResolutions` is provided and process them before returning.
**Answer:** [Filled in by Walker]
**Answered Date:** [Filled in by Walker]

## Answered Questions

| Date | Question | Decision |
|------|---------|----------|
| 2026-04-05 | Initial setup | Proceed with organism infrastructure |
