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

### Q-001: Bug in assertProjectAccess (Agent API territory)
**Date:** 2026-04-13
**Agent:** echo
**Context:** Tests in `src/test/api/projects.test.ts` verify that `assertProjectAccess` enforces cross-org access control (throws 403 when the project's org differs from the caller's active org, and when no active org exists). The tests mock `useOrganizationStore.getState` to supply org context.
**Bug:** `src/api/middleware/projectScope.ts` `assertProjectAccess` only checks project membership. It does NOT check that the project belongs to the caller's active organization from `useOrganizationStore`. Two tests fail: "throws 403 when project.organization_id does not match caller active org" and "throws 403 when no active organization context".
**Fix:** After the membership check passes, import `useOrganizationStore` and call `assertProjectBelongsToActiveOrg(projectId, currentOrg.id)`. If `currentOrg` is null, throw `ApiError('Forbidden', 403, 'FORBIDDEN')`.
**Answer:**
**Answered Date:**

### Q-002: Bug in getDrawings/getFiles cross-org guard (Agent API territory)
**Date:** 2026-04-13
**Agent:** echo
**Context:** Tests in `src/test/integration/lifecycles.test.ts` verify that `getDrawings` and `getFiles` return 403 when the project belongs to a different org or when no active org context exists.
**Bug:** `src/api/endpoints/documents.ts` `getDrawings` and `getFiles` only call `assertProjectAccess` (membership check). They do NOT call `assertProjectBelongsToOrg` to verify the active org context. Three tests fail: "returns 403 when project belongs to a different org", "returns 403 when there is no active organization context" (getDrawings), and "returns 403 when project belongs to a different org" (getFiles).
**Fix:** After `assertProjectAccess`, get `currentOrg` from `useOrganizationStore.getState()`. If null, throw 403. Then call `assertProjectBelongsToOrg(projectId, currentOrg.id)`.
**Answer:**
**Answered Date:**

## Answered Questions

| Date | Question | Decision |
|------|---------|----------|
| 2026-04-05 | Initial setup | Proceed with organism infrastructure |
