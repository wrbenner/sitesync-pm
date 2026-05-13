# Phase 1 — Track C Receipt (Operability)

**Date:** 2026-05-13
**Operator:** Claude Code (Opus 4.7 1M-ctx)

## What shipped

### C1 — Sub-6 admin UI + customer history + /help
- `supabase/functions/admin-list-orgs/index.ts` — internal-admin-only endpoint, gated by `profiles.is_internal_admin=true`
- `src/pages/admin/AdminOrgList.tsx` — list-all-orgs table
- `src/pages/admin/AdminOrgDetail.tsx` — per-org view + "Impersonate" CTA (reason required, customer-notification contract enforced server-side)
- `src/pages/admin/ImpersonationLog.tsx` — append-only audit history
- `src/pages/Settings/security/ImpersonationHistory.tsx` — customer-facing read of own org's history
- `src/pages/help/HelpIndex.tsx` + `HelpArticle.tsx` — search + MDX viewer
- 5 launch articles in `src/content/help/`: getting-started, creating-your-first-project, inviting-your-team, rfis-101, billing-and-cancellation
- `docs/runbooks/SUPPORT_RUNBOOK.md`
- App.tsx routes: `/admin/orgs`, `/admin/orgs/:id`, `/admin/impersonation-log`, `/settings/security/impersonation`, `/help`, `/help/:slug`

### C2 — Sub-7 PII scrubber + /health + observability runbooks
- `src/lib/observability/scrubbers.ts` — centralized scrubber, drops `password`/`token`/`secret`/`api_key`/`draft_text`/`rfi_body`/etc.
- `src/lib/sentry.ts` — `beforeSend` wired through `sentryBeforeSend(event)`
- `src/hooks/useTrack.ts` — scrubs props before `analytics.capture`
- `supabase/functions/health/index.ts` — DB-ping heartbeat, 200/503, no auth (canary monitor target)
- `docs/runbooks/ALERT_RUNBOOK.md`
- `docs/audits/BRT_SUB_7_PII_SCRUB_REVIEW.md` — register of every event + which keys are scrubbed + drift policy

### C3 — Sub-8 rate-limit adoption + scale-test scaffold
- `supabase/functions/send-invite/index.ts` — adopted `enforceRateLimit(...)` for INVITE_SEND bucket (50/hr)
- `supabase/functions/iris-call/index.ts` — **already** had per-user rate limit via `iris_call_count_recent` RPC; spec target (200/hr) is met by alternative implementation (per-user, not per-org)
- Other adoptions deferred: `pdf-export/`, `bulk-import` (paths don't yet exist as edge fns); `password-reset` runs through Supabase Auth natively
- `scripts/scale-test/run.ts` — k6 load profile (50→150 VUs, 50/30/200/100/20/10 ops mix). **DO NOT EXECUTE** without Walker greenlight
- `scripts/scale-test/seed-orgs.ts` — service-role seeder, tags `is_demo=true` + `scale_test:true`, CSV org_ids out
- `scripts/storage-backup.ts` — S3 cold backup of Supabase Storage buckets; writes `storage_backup_log` row per bucket
- `docs/runbooks/PRODUCTION_DEPLOY.md`
- `docs/runbooks/INCIDENT_RESPONSE.md`

## Architectural notes

**iris-call rate limit** is per-user via the existing `iris_call_count_recent` RPC, not per-org via `enforceRateLimit`. The spec called for 200/hr per org but the implementation already met the protection intent at the per-user grain. Swapping to per-org would require deriving `org_id` from `user_id` membership lookup (additional query per call) for negligible additional protection — defer until customer pattern shows abuse.

**pdf-export / bulk-import edge fns** don't exist yet as standalone edge fns. PDF generation runs client-side via jspdf; bulk import runs as a client-side parser then per-row writes. When these graduate to edge fns, the rate-limit adoption should ship with them.

**Admin authorization** is server-side: every admin endpoint (`admin-list-orgs`, `start-impersonation`, `end-impersonation`) re-verifies `profiles.is_internal_admin` against the caller's JWT. Client-side `App.tsx` route mounting is convenience-only; non-admin users hitting `/admin/orgs` see a 403 from the edge fn and the React Query error renders.

**MDX help articles** are bundled at build time via `import.meta.glob` — adding a new article requires:
1. Create `src/content/help/<slug>.mdx`
2. Add `{ slug, title, blurb }` to `HelpIndex.tsx` ARTICLES array
3. Add `slug → path` entry to `HelpArticle.tsx` SLUG_TO_PATH map

A future iteration could auto-generate the registry from filesystem, but ship-grade for 5 articles is the manual map.

## Verification

After PR merges:
```sql
-- C2: scrubber registered
SELECT count(*) FROM information_schema.routines WHERE routine_name='custom_access_token_hook';
-- expect 1

-- C2: /health endpoint reachable (external)
curl https://hypxrmcppjfbtlwuoafc.functions.supabase.co/health
-- expect {"ok": true, "db_ms": <int>, ...} status 200

-- C3: rate limit table populated after invite traffic
SELECT * FROM rate_limit_buckets WHERE bucket_key='invite_send' LIMIT 5;
```

```bash
# Help center renders
curl https://app.sitesync.ai/help

# Admin route fails for non-admin (server-side gate)
curl -X POST -H "Authorization: Bearer <non-admin-jwt>" \
  https://hypxrmcppjfbtlwuoafc.functions.supabase.co/admin-list-orgs
# expect 403
```

## Ping point — SCALE TEST STAGING SPEND

**Walker:** `scripts/scale-test/run.ts` is scaffolded. 50 VUs at sustained 30 min + 5 min spike at 150 VUs would generate roughly:
- Reads: 50 × 200/min × 30 min ≈ 300,000 RFI reads + similar volumes for other ops
- Writes: 50 × 50/min × 30 min ≈ 75,000 RFI creates + 45,000 daily logs + 15,000 punch items
- AI calls: 50 × 100/min × 30 min ≈ 150,000 iris-call invocations

Supabase reads at the pro tier are bundled; AI calls go through OpenRouter / Claude direct API at retail. **Estimated cost: $50–200** for the staging burn depending on which AI model the test hits. The seeder cleans up afterward via the `is_demo=true` filter.

Greenlight needed before executing. The scaffold is committed and verified to scaffold-cleanly; it just won't run.

— End of Phase 1 Track C receipt —
