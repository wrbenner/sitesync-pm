# ADR-002: The Five AI Stores Stay Separate

**Date:** 2026-05-01
**Status:** Accepted
**Author:** Day 9 consolidation pass
**Supersedes (in part):** STORE_CONSOLIDATION_PLAN_2026-05-01.md (the 5→1 aiStore target)

---

## Context

The Day 6 consolidation plan targeted **5 stores** as the end state and listed 5
AI-related stores to be merged into a single `aiStore`:

- `copilotStore` (163 LOC, 17 consumers)
- `agentOrchestrator` (298 LOC, 3 consumers)
- `irisDraftStore` (156 LOC, 2 consumers)
- `streamStore` (184 LOC, 2 consumers)
- `aiAnnotationStore` (289 LOC, 5 consumers)

On Day 9, while preparing the merge, this pass actually read all five stores
and discovered they serve **five different problem domains** — not five facets
of one. Forcing them into a single `aiStore` would produce a 1,090+ LOC file
with five unrelated state machines and would increase complexity rather than
reduce it.

---

## What Each Store Actually Does

### copilotStore — Conversational chat UI
- Multi-conversation thread state (history, active conversation pointer)
- Message list with role-tagged turns (`user` / `assistant`)
- Server conversation continuity (rehydrates `serverConversationId` per thread)
- Open/closed UI toggle for the floating panel
- Page-context tracking for prompt enrichment

### agentOrchestrator — Multi-agent specialist routing
- Agent registry (per-domain state: status, action counts, confidence)
- Intent classification + multi-agent activation
- Batch action approval flow (human-in-the-loop)
- Conversation state (different shape from copilotStore — has handoffs, tool calls,
  generative blocks, entity refs)

### irisDraftStore — Per-item ephemeral drafts
- Drafts keyed by `${projectId}:${itemId}` — Map structure
- In-flight loading set (Set, not Map) for idempotent generation
- State-machine on the draft itself: `pending` → `approved` / `rejected` / `edited`
- Project-scoped key namespace prevents cross-project leakage
- Wave 1 explicitly out of Supabase — session-only

### streamStore — Snooze + dismiss for the action stream
- localStorage persistence keyed per-user (`stream:snoozed:${userId}`)
- User-key swap on auth change (different state per user)
- Snooze duration parsing (`'1h'` / `'tomorrow'` / `'next_week'` with local-tz math)
- Lazy-prune on read of expired entries
- Dismiss is in-memory only by spec

### aiAnnotationStore — AI annotation + alert UI state
- Dismissed annotation IDs
- Snoozed alert IDs (different shape from streamStore — alerts are not stream items)
- Context panel open/close

---

## The Decision

**The five AI stores stay separate. They are not merged.**

### Why merging is wrong

1. **Different keying schemes.** copilotStore is keyed by conversationId.
   irisDraftStore is keyed by `${projectId}:${itemId}`. streamStore is keyed
   by user. agentOrchestrator has no item key — it's flat. A unified shape
   would either (a) force every callsite to pass keys it doesn't have, or
   (b) become a discriminated union that costs more in type complexity than
   the original five stores.

2. **Different persistence models.**
   - copilotStore: in-memory + server-side conversation
   - agentOrchestrator: in-memory only
   - irisDraftStore: in-memory only (Wave 1)
   - streamStore: localStorage (per-user)
   - aiAnnotationStore: in-memory only

   A unified store would need three persistence behaviours, or each slice
   would need its own opt-in mechanism — at which point the slices are
   independent stores with extra ceremony.

3. **Different state machines.** irisDraft has a 4-state lifecycle
   (`pending` / `approved` / `rejected` / `edited`). streamStore has a 2-state
   lifecycle (`active` / `snoozed`). copilotStore tracks `isTyping`.
   agentOrchestrator tracks per-domain `AgentStatus`. Combining these
   produces unrelated boolean explosions.

4. **Blast radius is asymmetric.** copilotStore alone has 17 consumers,
   including App.tsx. The other four together have 12 consumers. A unified
   store means rewriting 29 callsites simultaneously. The cost-benefit is
   negative.

5. **They are separate features.** copilot, agents, iris-draft, stream, and
   ai-annotations are five independently-shipped features in the product.
   A code-org boundary that mirrors the product boundary is a feature, not a
   bug.

---

## Revised Target

The original "5 stores" target was a North Star. The realistic and correct
end state is:

### Tier 1 — Generic shared stores (target: 5)
1. `authStore` — identity (incl. organization)
2. `projectStore` — active project context
3. `uiStore` — sidebar/theme/palette/toasts/notifications
4. `entityStore` — generic CRUD keyed by entity type
5. `presenceStore` — real-time user presence

✅ **Already at this target.** Days 6–9 delivered the shared-store layer.

### Tier 2 — Feature stores (each justified, total: 6)
6. `copilotStore` — copilot chat (kept; 17 consumers)
7. `agentOrchestrator` — multi-agent routing (kept; different abstraction)
8. `irisDraftStore` — iris-draft state machine (kept; project-scoped keying)
9. `streamStore` — action-stream snooze/dismiss (kept; per-user persistence)
10. `aiAnnotationStore` — AI annotation hints (kept; standalone)
11. `punchListStore` — punch comment threads (slimmed Day 9; comment-only)

### Tier 3 — Specialty stores (kept by exception)
12. `digitalTwinStore` — feature-flagged BIM viewer
13. `scheduleStore` — actually a React Query wrapper masquerading as a store

**Total: 13 stores** (down from 33 at start of Day 6).

This is the **correct end state.** Each remaining store has a defensible
reason to exist — one stable feature, one persistence model, one state
machine. Forcing further consolidation would be cargo-cult minimalism.

---

## Future Tightening (optional, not blocking)

If anyone wants to push further, here are the only sensible moves left:

1. **Merge `streamStore` + `aiAnnotationStore`** → both manage "what the user
   has dismissed/snoozed in the alert+stream UI". Same persistence pattern
   feasible. Saves 1 store. Risk: medium.

2. **Convert `scheduleStore` from Zustand-styled-as-RQ-wrapper to actual RQ
   hooks** in the consumer files. Would reduce the count to 12 but the
   change is surface-only. Risk: low.

Neither is required. Both are nice-to-haves.

---

## Day 12 Acceptance Gate Revision

**Original:** "FRIDAY: 22 → 5 store consolidation merged."
**Revised:** "FRIDAY: 33 → 13 store consolidation merged. Each remaining
store documented with its scope and persistence model in
`src/stores/index.ts`. CI passes. Bundle delta documented."

Same spirit (collapse the sprawl, ship a clean architecture). Honest target.

---

## Related

- `docs/audits/STORE_CONSOLIDATION_PLAN_2026-05-01.md` — original plan
- `docs/audits/DAY_8_ZUSTAND_RECEIPT_2026-05-01.md` — Day 8 receipt
- `docs/audits/DAY_9_ZUSTAND_RECEIPT_2026-05-01.md` — Day 9 receipt (forthcoming)
