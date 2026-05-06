# Platinum Audit Pack

A 30-minute deposition prep collapses to two clicks. Tab A ships the universal audit-trail viewer, sealed PDF export, @-mentions + presence, magic-link share for non-app-users, and the compliance pack bulk export.

## What's in the pack

- **EntityAuditViewer** — drops onto any entity detail page. Renders the chronological state-change timeline (paginated 50/page) with a HashChainBadge at the top.
- **Sealed export per entity** — one button on the viewer. PDF (HTML when no rasterizer is available) with full state history + comments + media + escalation log + hash-chain proof + signed manifest.
- **@-mentions** — type `@` in any comment field; auto-complete pulls from `directory_contacts`. Mentioned users get a notification via the existing `notification_queue`.
- **Live presence + typing** — `PresenceAvatars` on the entity detail page. `TypingIndicator` shows "X is typing…" pills via the new `typing_indicators` table.
- **Magic-link share** — generate a per-entity, time-limited URL for an architect or owner counsel. Read-only or comment-only. JWT-signed, hashed in the DB, audit-logged on access.
- **Compliance Pack** — PM-level bulk export. Background job; PM gets an email with the download URL when ready.

## Architecture

```
                                      ┌──────────────────────────────────┐
                                      │  src/lib/audit/hashChainVerifier │
                                      │  (mirrors Postgres trigger)      │
                                      └──────────────────────────────────┘
                                                 │ used by
                ┌────────────────────────────────┼────────────────────────────────┐
                ▼                                ▼                                ▼
  ┌────────────────────────┐     ┌────────────────────────────┐    ┌──────────────────────────────┐
  │ EntityAuditViewer.tsx  │     │ AuditTimeline.tsx +        │    │ supabase/functions/          │
  │ HashChainBadge.tsx     │ ←── │ ChainGap rail              │    │   sealed-entity-export       │
  └────────────────────────┘     └────────────────────────────┘    │   compliance-pack            │
                                                                    │   entity-magic-link          │
                                                                    └──────────────────────────────┘
                                                                                 │
                                                                                 ▼
                                                                    ┌──────────────────────────────┐
                                                                    │ MagicLinkEntity.tsx (page)   │
                                                                    │ — read-only / comment-only   │
                                                                    └──────────────────────────────┘
```

## The five checks the spec calls out

| Failure mode                                | Implementation |
| ------------------------------------------- | -------------- |
| Hash chain has a gap                        | `verifyChain()` returns `gaps[]`; `HashChainBadge` flips red; `AuditTimeline` rails the affected rows; sealed export stamps `PARTIAL CHAIN — see manifest` |
| @-mention target no longer on project       | `rankMentions()` demotes `former_member` rows by 25 points and tags label with "(former member)". Notification still fires |
| Magic link expires mid-review               | URL embeds `exp` claim; magic-link page renders an "expired — request a fresh link" mailto button auto-addressed back to the GC |
| Architect tries cross-project access        | JWT `aud` claim is `"<entity_type>:<entity_id>"`; the validate endpoint rejects mismatches as 403 |
| PDF blow-up over Resend's 40 MB limit       | Sealed exports always go to Storage; magic-link emails carry the URL, not the PDF |
| 500+ comment thread                         | `AuditTimeline` paginates 50/page; sealed export paginates with running headers |
| Two PMs answer the same RFI simultaneously  | `TypingIndicator` shows "Walker is also typing…"; the existing `updated_at` lock in mutations prevents lost writes |
| Audit log slow on huge projects             | Pagination on the viewer; sealed export streams from `audit_log` ordered + chunked |
| Magic link forwarded to a sub               | Each access stamps `accessed_ua` + `accessed_ip`; mismatches set `forwarded=true`. Doesn't block — flags |
| GDPR deletion request                       | Sealed PDFs are immutable (legal requirement). The magic-link share UI must say so explicitly |

## Hash-chain payload formula

The verifier in `src/lib/audit/hashChainVerifier.ts` MUST match the trigger in `supabase/migrations/20260426000001_audit_log_hash_chain.sql` byte for byte. The pipe-separated payload is:

```
id | created_at | user_id | user_email | project_id | organization_id |
entity_type | entity_id | action | before_state(jsonb::text) |
after_state(jsonb::text) | changed_fields(comma-joined) | metadata(jsonb::text or '{}') |
prev_hash
```

If the SQL trigger changes, update both:
- `src/lib/audit/hashChainVerifier.ts` (browser + edge fn-shared)
- `supabase/functions/sealed-entity-export/index.ts` (Deno-inline duplicate)

## Magic-link JWT shape

```json
{
  "iss": "sitesync-magic-link",
  "sub": "architect@example.com",
  "aud": "rfi:<uuid>",
  "pid": "<project_uuid>",
  "scope": "view" | "comment",
  "exp": 1830000000,
  "iat": 1828800000,
  "nonce": "<uuid>"
}
```

Signed with `MAGIC_LINK_SECRET` (HS256). The `aud` claim is checked verbatim on validation; cross-entity access is 403.

The original token is emitted **once** in the response and never persisted. We store SHA-256(token) in `magic_link_tokens.token_hash` for lookup; comparison is constant-time at the validate endpoint.

## Files

```
src/components/audit/EntityAuditViewer.tsx                — top-level viewer
src/components/audit/AuditTimeline.tsx                    — paginated timeline
src/components/audit/HashChainBadge.tsx                   — chain integrity pill
src/components/conversation/MentionInput.tsx              — textarea + popover
src/components/conversation/MentionAutocomplete.tsx       — popover renderer
src/components/conversation/TypingIndicator.tsx           — typing pills
src/lib/audit/hashChainVerifier.ts                        — pure verifier
src/lib/audit/sealedExport.ts                             — pure HTML/manifest builder
src/lib/audit/__tests__/hashChainVerifier.test.ts         — 16 vitest cases
src/lib/mentions/autocomplete.ts                          — pure ranker + trigger detector
src/lib/mentions/__tests__/autocomplete.test.ts           — 16 vitest cases
src/pages/share/MagicLinkEntity.tsx                       — non-app-user read view
supabase/functions/sealed-entity-export/index.ts          — sealed export
supabase/functions/entity-magic-link/index.ts             — mint + validate
supabase/functions/compliance-pack/index.ts               — bulk export job
supabase/migrations/20260501100000_magic_link_tokens.sql  — token storage + RLS
supabase/migrations/20260501100001_typing_indicators.sql  — presence backbone
docs/PLATINUM_AUDIT_PACK.md                               — this file
```

## Wiring required (deferred to user)

1. **Mount the viewer.** In each entity detail page (`RFIDetail.tsx`, `SubmittalDetail.tsx`, `ChangeOrderDetail.tsx`, `PunchItemDetail.tsx`), import `EntityAuditViewer` and render it under the existing detail body:
   ```tsx
   <EntityAuditViewer entityType="rfi" entityId={rfi.id} projectId={rfi.project_id} />
   ```
2. **Mount the share route.** In `src/App.tsx`'s router, add:
   ```tsx
   <Route path="/share/:entity_type/:entity_id" element={<MagicLinkEntity />} />
   ```
   The route is intentionally outside the `ProjectGate` so non-app-users can land on it.
3. **Sealed-export storage bucket.** Create the `sealed-exports` bucket in the Supabase dashboard (or a follow-up migration). Make it private; the function returns 1-hour signed URLs.
4. **`MAGIC_LINK_SECRET`** function secret in the Supabase dashboard. Falls back to `SUPABASE_JWT_SECRET` when unset.
5. **`RESEND_API_KEY`** for the email delivery branch (the magic-link function works without it; just no email).
6. **`compliance_pack_jobs`** table — see suggested DDL below; safe to add lazily because the function gracefully no-ops on missing table.
7. **Compliance-pack worker** — the function only enqueues. The worker that streams sealed exports into a ZIP and signs the URL is a follow-up; leave a `pg_cron` job calling a future `compliance-pack-worker` function.
8. **`comments` + `attachments` tables.** The sealed export reads from both; if your codebase uses different table names (e.g. `entity_comments`, `entity_files`), update the queries in `supabase/functions/sealed-entity-export/index.ts` accordingly.
9. **Mount `<MentionInput>`** in the comment-thread surface of each entity detail page.
10. **Mount `<TypingIndicator>`** above each comment thread + `<PresenceAvatars>` in each detail-page header (already-existing component).

### Suggested `compliance_pack_jobs` table

```sql
CREATE TABLE IF NOT EXISTS compliance_pack_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by    uuid REFERENCES auth.users(id),
  entity_types    text[] NOT NULL,
  from_date       date,
  to_date         date,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed')),
  estimated_count int,
  signed_url      text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz
);
```

## Pure-lib test coverage

- `hashChainVerifier.test.ts` — 16 tests: empty chain, clean chain, tampered row, forged row, missing entry/previous hash, gap order, payload formula, SHA-256 stability
- `autocomplete.test.ts` — 16 tests: prefix match, last-name fallback, aux-field substring, former-member demotion, limit cap, empty-query alphabetical, case-insensitive, all detect-trigger edge cases
