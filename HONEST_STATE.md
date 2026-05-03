# SiteSync PM — Honest State

> Last updated: April 16, 2026

## What This Is

A React 19 + TypeScript + Supabase construction project management platform.
482 files, ~145K LOC, 43 pages, 130+ database tables, 28 edge functions.

## What Works

- **Core 9 workflows** (RFIs, Submittals, Budget, DailyLog, PunchItems, Schedule,
  ChangeOrders, Tasks, Closeout): ~70% complete each. Usable for demos, not contracts.
- **Auth & permissions**: 6 roles × 32 permissions. Supabase RLS on 48 tables.
- **Offline-first**: Dexie-based sync with conflict detection (not LWW).
- **Design system**: 150 theme tokens, inline styles, consistent application.
- **Accessibility**: 635 ARIA annotations, keyboard nav, screen reader support.
- **AI infrastructure**: Claude via edge functions, multi-agent hooks, copilot UI.

## Canonical AI path (added 2026-05-01)

Every browser-originated AI call now flows through ONE chokepoint:

```
src/lib/ai/callIris.ts
   → POST supabase/functions/iris-call (SSE stream)
       → authenticateRequest()                 (Bearer JWT → GoTrue)
       → verifyProjectMembership()             (RLS-scoped if project_id given)
       → checkRateLimit()                      (sliding window over audit_log)
       → readIdempotencyCache()                (24h, hash-of-inputs key)
       → routeAIStream()                       (Anthropic + OpenAI native SSE;
                                                Perplexity + Gemini buffered)
       → SSE deltas back to browser
       → writeAuditEntry()                     (action='iris_call.generate' →
                                                hash-chained into audit_log)
       → writeIdempotencyCache()
```

Why this matters:
1. **Zero LLM keys in the browser bundle.** `grep -r "@ai-sdk/anthropic" dist/`
   returns nothing. Confirmed via build output.
2. **Every AI call is in the deposition-grade hash chain.** `entity_type` +
   `entity_id` link calls to RFI / Submittal / CO history; the existing
   `EntityAuditViewer` surfaces them automatically.
3. **Per-user rate limit + idempotency** are server-enforced. A retry double-
   click hits cache, doesn't double-bill. A console-open user can't drain
   the API key.
4. **One pattern.** New AI features call `callIris(...)` from the browser.
   No exceptions. No browser-direct Anthropic SDK ever again.

Tables: `iris_call_idempotency`, plus `iris_call_count_recent(user, secs)`
RPC over `audit_log`. Migration: `20260501000001_iris_call_infrastructure.sql`.
Tests: `src/test/lib/callIris.test.ts` (SSE consumer + error paths).

## What Doesn't Work Yet

- **AI is infrastructure, not UX.** The copilot chats without project context.
  Dashboard insights exist but aren't wired. Conflict detection built but uncalled.
  ~15% of the AI claim is delivered.
- **Bundle is 1.87 MB** against a 250 KB target (7.5× over). PDF and Three.js
  loaded on routes that don't use them.
- **Billing uses floating-point dollars** while the PDF uses integer cents.
  The codebase disagrees with itself about money.
- **PermissionGate exists but isn't used on action buttons.** Any member can
  click Create on anything.
- **~25 stub pages** (Vision, TimeMachine, Marketplace, Sustainability, etc.)
  have UI without logic. They dilute the product.
- **State machines are modeled but not enforced.** Mutations bypass transitions.
- **22 Zustand stores** with overlapping concerns. Should be 5.

## What We Claimed But Haven't Built

- Bitemporal data (valid_time / transaction_time): not present
- Causal graphs: foreign keys only
- Event sourcing: audit_trail as afterthought table
- Shadow mode / data flywheel: deleted (wrote to non-existent tables)
- Procore migration tool: zero code
- Sub portal with free tier: not built
- Embedded fintech: Stripe wired, workflows absent
- MCP server: not built
- WebGPU BIM: Three.js present, no GPU path

## The Path Forward

Not "build more." Subtract and wire:
1. Wire the AI that already exists (highest ROI)
2. Delete 8-10 stub pages
3. Fix billing to integer cents
4. Enforce state machines on all mutations
5. Consolidate 22 stores to 5
6. Cut bundle to 500 KB (then 250 KB)
7. Ship Procore migration tool (the #1 enterprise switching cost blocker)
8. Ship free sub portal (the viral distribution mechanism)

Two weeks of subtraction turns a C+ codebase into a credible A– Procore alternative.
