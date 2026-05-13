# Production Deploy Runbook

Owner: Walker. Audience: anyone shipping to SiteSync production.

SiteSync runs as a **Vite SPA on Vercel** with a **Supabase backend** (Postgres + Auth + Edge Functions + Storage). Deploys are CI-driven with explicit gates.

## Architecture in one paragraph

- **Frontend:** Vite SPA. Auto-deploys to Vercel on push to any branch (previews) and on merge to `main` (production).
- **Edge functions:** Supabase Edge Functions. Deployed via `supabase functions deploy` invoked from CI on merge to `main`.
- **Database:** Supabase Postgres. Migrations live in `supabase/migrations/`. Applied via the Supabase MCP per Standing Decisions §4 — never via raw `psql` or dashboard SQL editor.

## Branch protection on `main`

`main` is the only branch that auto-deploys to production. It has the following protections:

- Linear history (no merge commits; squash merge only).
- Required CI checks must pass — see [pre-deploy checklist](#pre-deploy-checklist) for the full list.
- At least one approving review (auto-approve allowed for Walker on routine commits; security-sensitive changes require a second pair of eyes when available).
- No force push, no branch deletion.
- Required signed commits.

Even Walker cannot push directly to `main`. Every change is a PR.

## What auto-deploys vs manual

| Surface | Trigger | Mechanism |
| --- | --- | --- |
| Vite SPA (production) | Merge to `main` | Vercel Git integration |
| Vite SPA (preview) | Any branch push | Vercel Git integration |
| Edge functions | Merge to `main` | GitHub Actions → `supabase functions deploy` |
| Migrations | **Manual** | Supabase MCP, by Walker, after PR merge |
| Stripe webhook URL | **Manual** | One-time setup; only changes if endpoint moves |

Migrations are the deliberate exception. We do not auto-apply schema changes — too many ways for an irreversible mistake to slip past CI.

## Migration apply procedure

Per Standing Decisions §4, migrations apply via the Supabase MCP, not raw SQL or `supabase db push`.

1. Create the migration locally: `npx supabase migration new <descriptive_name>`.
2. Write the migration SQL. Include a corresponding `down` migration commented at the bottom (used for rollback).
3. Test locally: `npx supabase db reset` rebuilds the local DB from migrations.
4. Run the adversarial RLS suite locally: `npm run test:rls-adversarial`.
5. PR the migration. CI runs the full migration suite against a clean Postgres + the adversarial RLS test.
6. On merge to `main`, the migration is **not** auto-applied.
7. Walker runs the migration manually via the Supabase MCP `apply_migration` tool. Capture the apply log in the PR comments.
8. Verify with `list_migrations` MCP tool that the migration is in the applied list.
9. Run `get_advisors` MCP tool — must report zero ERROR-level findings before declaring success.

### Why MCP and not `supabase db push`?

The MCP tool runs against the linked project with explicit confirmation, logs to the audit trail, and integrates with the get_advisors lint that catches RLS-impacting changes before they ship. `db push` is fine for local dev but bypasses these guards in production.

## Rollback procedure

### Vercel SPA rollback

If a frontend deploy breaks production:

1. Open the Vercel dashboard → SiteSync project → Deployments.
2. Find the last known-good deployment (green status, prior to the bad one).
3. Click the `...` menu → **Promote to Production**.
4. Confirm. Promotion is live in 30–60 seconds.
5. Notify Slack #ops with: bad deploy SHA, good deploy SHA, reason.

Alternatively from the CLI: `vercel rollback <deployment-url>` (see Vercel CLI skill).

### Edge function rollback

Edge functions don't have a Vercel-style rollback button. To roll back:

1. `git revert <sha>` the offending commit on a new branch.
2. PR, CI passes, merge to `main`.
3. GitHub Actions auto-deploys the reverted function within 2–3 minutes.

For an emergency revert when CI is slow: directly redeploy the previous version via `supabase functions deploy <name>` from a local checkout of the prior SHA. Document in Slack #incidents and follow up with the proper revert PR.

### Migration rollback

There is no automatic migration rollback in Supabase. Process:

1. Identify the offending migration in `supabase/migrations/`.
2. Write a new migration that is the *inverse* of the broken one (drop the column you added, recreate the table you dropped, etc.). Use the `down` migration commented in the original as the starting point.
3. Apply the inverse migration via the Supabase MCP `apply_migration` tool.
4. Verify with `get_advisors` — zero ERROR.
5. Verify with `npm run test:rls-adversarial` — green.

**Never delete the original migration file** even after writing an inverse. The forward + inverse pair is the audit record.

## Pre-deploy checklist

CI must show all green before merge to `main`. Verify locally too:

- [ ] `npm run typecheck` — zero errors (`tsc --noEmit`).
- [ ] `npm run lint` — zero errors. Warnings allowed if budgeted in `.quality-floor.json`.
- [ ] `npm run test` — all unit tests green.
- [ ] `npm run test:rls-adversarial` — adversarial RLS suite green.
- [ ] `npm run test:rls-baseline` — RLS baseline diff is empty (or matches expected change in this PR).
- [ ] `get_advisors` MCP tool — zero ERROR-level findings.
- [ ] Playwright polish-audit hasn't regressed (if frontend-touching).
- [ ] Bundle size in `.quality-floor.json` budget.

## Post-deploy smoke

Run within 5 minutes of every production deploy:

```bash
# 1. Health endpoint responds 200
curl -fsS https://sitesync.app/api/health
# Expect: {"status":"ok","commit":"<sha>","build_time":"..."}

# 2. Marketing site loads
curl -fsS -o /dev/null -w "%{http_code}\n" https://sitesync.app
# Expect: 200

# 3. App loads (no auth required for the loader)
curl -fsS -o /dev/null -w "%{http_code}\n" https://app.sitesync.app
# Expect: 200
```

Manual smoke (browser):

1. Open `https://app.sitesync.app` in incognito.
2. Sign up with a throwaway email. Should complete in < 30s.
3. Create a test project. Should land on The Day.
4. Create an RFI on the test project. Should auto-number `RFI-001`.
5. Verify the audit log entry appears in The Audit within 5s.

If any smoke step fails, follow rollback procedure above and page Walker.

## Communication template

For every production deploy that touches load-bearing surfaces (auth, billing, RLS, migrations), post to Slack #deploys:

```
Production deploy <sha>
What: <one-line summary>
Risk: low | medium | high
Smoke: pass | fail
Rollback: vercel rollback <prev-sha> | migration inverse: <file>
```
