# Session 7 (Wave 2 Tab C): Magic Link Backend + Audit Attribution

## Read First (in order)
1. `specs/homepage-redesign/PRODUCT-DIRECTION.md` — Subcontractor Identity section, Audit Attribution section
2. `specs/homepage-redesign/CONTRACT-WAVE-2.md` — your ownership boundaries
3. `src/contexts/ActorContext.tsx` — Wave 1 hydrated this; you wire it deeper
4. `src/components/MagicLinkSubRoute.tsx` — Wave 1 stub, you replace the validator
5. `supabase/functions/entity-magic-link/` — existing Edge Function; extend it
6. `docs/HASH_CHAIN_INVARIANTS.md` — audit-chain rules

## Objective
Wave 1 wired the route and ActorContext but left the validator as a stub. Wave 2 makes `/sub/:token` real:
1. Token validation against a real backing table (or extend `entity-magic-link`)
2. Sub-scoped session that exposes only the right company's items
3. Audit attribution: every action committed via magic link records `actor_kind: 'magic_link'` plus `magic_link_token_id`

## Files You Own (write only these)
- `supabase/functions/entity-magic-link/` (extend existing Edge Function — handle a `sub-scope` token kind alongside whatever it currently does)
- `src/components/MagicLinkSubRoute.tsx` (replace stub validator with a real fetch + error states)
- `src/lib/auditWriter.ts` (or whichever module performs hash-chain audit writes — wire `actor_kind` + `magic_link_token_id` from `ActorContext` into every event)
- `src/lib/__tests__/auditWriter.test.ts` (new — verify both `actor_kind: 'user'` and `actor_kind: 'magic_link'` paths are written)
- A migration in `supabase/migrations/` if the `magic_link_tokens` table needs a `scope` or `company_id` column it doesn't already have

## Token Validation
```ts
// MagicLinkSubRoute.tsx
useEffect(() => {
  fetch(`/api/magic-link-validate?token=${token}`)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then((data: { token_id: string, company_id: string, project_id: string, expires_at: string }) => {
      hydrateActorContext({ kind: 'magic_link', magicLinkTokenId: data.token_id, companyId: data.company_id })
      // Then render <DayPage> in the sub-scoped context
    })
    .catch(showLinkExpired)
}, [token])
```

Error states:
- Token not found → "This link is invalid."
- Token expired → "This link has expired. Ask the project manager to send a new one."
- Token revoked → "This link has been revoked."

## Audit Attribution Wiring
Find every audit-write call site (search for `audit_log.insert` or whatever the existing pattern is). At each one, read `ActorContext` and pass:
```ts
{
  actor_kind: ctx.kind,                                    // 'user' | 'magic_link'
  actor_id: ctx.kind === 'user' ? ctx.userId : ctx.magicLinkTokenId,
  magic_link_token_id: ctx.kind === 'magic_link' ? ctx.magicLinkTokenId : null,
  company_id: ctx.companyId ?? null,
}
```

If the `audit_events` (or equivalent) table doesn't already have these columns, write a migration to add them. The hash-chain invariants doc describes the existing shape — extend, don't break.

## Tests
- `auditWriter.test.ts`:
  - Authenticated user write → `actor_kind: 'user'`, `actor_id = userId`, `magic_link_token_id = null`
  - Magic-link write → `actor_kind: 'magic_link'`, `actor_id = token_id`, `company_id = ctx.companyId`
  - Hash-chain prev_hash continuity preserved across both kinds

## Do NOT
- Modify `src/types/stream.ts`
- Touch UI components beyond `MagicLinkSubRoute.tsx` (the rest of the stream renders unchanged for magic-link subs)
- Add new external dependencies
- Build a sub onboarding flow — magic link drops them straight into the stream, no profile/login step
- Modify any tab's owned files in Wave 2 (A, B, D)
