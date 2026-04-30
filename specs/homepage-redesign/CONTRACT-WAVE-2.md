# Wave 2 — Parallel-Tab Contract

Wave 1 shipped (`0c3f561`). Wave 2 builds on the locked stream contract at `src/types/stream.ts` — still read-only. Four parallel tabs again, with zero file overlap.

## Pre-Flight (already on `main` after Wave 1 merge)

Nothing new to commit pre-flight. The Wave 1 surface — `src/types/stream.ts`, `useActionStream`, `streamStore`, `services/iris/*`, `components/stream/*`, role-filtered nav, `MagicLinkSubRoute`, `ActorContext` — is the foundation Wave 2 builds on.

## File-Ownership Map (zero overlap)

### Tab A — Commitment Tracker
**Goal:** Make `/commitments` real (the nav points there but the page doesn't exist).

**Owns (writes):**
- `src/pages/commitments/index.tsx` (new)
- `src/pages/commitments/CommitmentsTable.tsx` (new)
- `src/hooks/queries/commitments.ts` (new — derives Commitment[] from RFIs, submittals, punch dates, plus `weekly_commitments` table)
- `src/hooks/__tests__/commitments.test.ts` (new)

**Reads only:** `src/types/stream.ts` (`Commitment`, `CommitmentSource`), existing query hooks, `usePermissions`.

### Tab B — Source Trail Component + Record-Page Integration
**Goal:** Surface the source trail everywhere users see records, not just the stream.

**Owns (writes):**
- `src/components/source/SourceTrail.tsx` (new — reusable pill-row component)
- `src/components/source/SourceTrailPill.tsx` (new)
- Add `<SourceTrail />` to record-detail pages: `src/pages/rfis/RFIDetail.tsx`, `src/pages/submittals/SubmittalDetail.tsx`, `src/pages/punch-list/PunchItemDetail.tsx` — additive only, do not refactor surrounding code
- `src/components/source/__tests__/SourceTrail.test.tsx` (new)

**Reads only:** `src/types/stream.ts` (`SourceReference`).

### Tab C — Magic Link Backend + Audit Attribution
**Goal:** Make `/sub/:token` production-ready. The route exists but currently lacks a real validator; audit attribution for magic-link actions needs the `actor_kind` + `magic_link_token_id` plumbed through.

**Owns (writes):**
- `supabase/functions/entity-magic-link/` (extend existing Edge Function for sub-scoped tokens)
- `src/components/MagicLinkSubRoute.tsx` (replace stub validator with real call)
- `src/lib/auditWriter.ts` (or wherever the hash-chain audit writer lives — wire `actor_kind` + `magic_link_token_id` from `ActorContext` into every audit event)
- `src/lib/__tests__/auditWriter.test.ts` (verify both `actor_kind` paths)
- A migration if `magic_link_tokens` table doesn't already exist with the right shape

**Reads only:** `src/contexts/ActorContext.tsx`, existing audit infra.

### Tab D — Iris Wave 2 (Owner Update + Draft UI Wire-Up)
**Goal:** Close the loop on Iris drafts. Verify the Draft Card actually calls `generateIrisDraft` from `StreamItemExpanded`. Add the Owner Update flow.

**Owns (writes):**
- `src/components/stream/StreamItemExpanded.tsx` (verify generateDraft is called on expand for items with `irisEnhancement.draftAvailable`; add if missing)
- `src/services/iris/templates.ts` (extend with full `owner_update` template — currently a stub)
- `src/services/iris/drafts.ts` (verify the owner_update path returns sensible content)
- `src/components/reports/OwnerUpdateGenerator.tsx` (new — "Generate Owner Update" button + draft preview modal)
- `src/pages/Reports.tsx` (additive — add the new generator component to the page)
- `src/services/iris/__tests__/owner-update.test.ts` (new)

**Reads only:** project context hooks, schedule/budget data sources, `stream.ts`.

## Cross-Cutting Rules

1. **Locked contract still locked.** `src/types/stream.ts` does not change.
2. **No tab modifies another tab's owned files.** Tab D is the only one touching `StreamItemExpanded` in Wave 2 — Tab B's record-detail pages do not.
3. **No package.json changes** without explicit coordination.
4. **No new Iris models or providers.** Continue with `@ai-sdk/anthropic` + `claude-sonnet-4.6`. Vercel AI Gateway migration remains a separate post-Wave-2 initiative.
5. **Tests:** each tab tests its owned paths; do not extend tests in other tabs' territory.

## Completion Criteria per Tab

- ✅ Owned files compile (`pnpm typecheck` clean for owned paths)
- ✅ Tests for owned paths pass
- ✅ Zero edits outside the owned-files list
- ✅ Short PR description summarizing the diff

## Merge Order

1. **Tab C first** — audit attribution underpins everything else
2. **Tab A second** — commitments page becomes reachable
3. **Tab B third** — source-trail integration is purely additive
4. **Tab D last** — UI wire-up benefits from the others being stable

If conflicts arise during merge, the locked contract wins. Adjust callers, never the contract.
