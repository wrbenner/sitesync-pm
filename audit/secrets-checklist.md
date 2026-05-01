# Secrets Checklist

> Generated 2026-04-29T19:27:44Z.
> Re-run with: `grep -rhEo 'Deno\.env\.get\(...\)' supabase/functions/ | sort -u`

40 distinct `Deno.env.get(...)` keys referenced across edge functions.

## Required (set or build fails)

| Secret | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | every edge function | auto-provisioned by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | most edge functions | auto-provisioned |
| `SUPABASE_ANON_KEY` | a few public-facing functions | auto-provisioned |
| `SUPABASE_JWT_SECRET` | auth verification helpers | auto-provisioned |
| `ANTHROPIC_API_KEY` | AI router (claude path) | required for any AI feature using anthropic |
| `OPENAI_API_KEY` | AI router (openai path) | required for embeddings + classification |
| `GEMINI_API_KEY` (or `GEMINI_API_KEYS`) | classify-drawing, vision tasks | comma-separated list supported |
| `RESEND_API_KEY` | send-email + every function that emails | required for inbound + outbound mail |
| `RESEND_FROM_ADDRESS` | send-email | "noreply@<domain>" |
| `STRIPE_SECRET_KEY` | stripe-webhook + billing-* | required for any billing flow |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | distinct from secret key |
| `LIVEBLOCKS_SECRET_KEY` | liveblocks-auth | realtime collab — required if Liveblocks is enabled |

## Optional / feature-flagged

| Secret | Used by | Notes |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | weather-sync, weather-multi-source | required when multi-source weather is enabled |
| `PERPLEXITY_API_KEY` | (rare) AI router fallback | optional |
| `ROBOFLOW_API_KEY`, `ROBOFLOW_DATASET_ID`, `ROBOFLOW_MODEL_ID` | analyze-safety-photo | required only for vision-PPE feature |
| `GOOGLE_API_KEY` | (separate from `GEMINI_API_KEY`) | maps / geocoding TBD |
| `GITHUB_PAT`, `GITHUB_OWNER`, `GITHUB_REPO` | (likely) procore-import test harness | confirm scope before setting |

## Internal (set yourself — not a third-party API)

| Secret | Used by | Purpose |
| --- | --- | --- |
| `CRON_SECRET` | cron-driven functions | shared bearer to authenticate self-invocations |
| `INVITE_JWT_SECRET` | send-invite, entity-magic-link | signs short-lived invite tokens |
| `MAGIC_LINK_SECRET` | entity-magic-link | distinct from invite token secret |
| `OAUTH_ENCRYPTION_KEY` | oauth-token-exchange | encrypts third-party OAuth tokens at rest |
| `ORGANISM_SECRET` | organism-cycle | guards the organism endpoint |
| `WEBHOOK_DEFAULT_SECRET` | webhook-receiver | signature verification for external webhooks |
| `MESSAGE_ID_DOMAIN` | inbound-email | domain used in our outbound Message-ID headers |
| `REPLY_DOMAIN` | inbound-email | the domain we accept inbound mail at |
| `SENDER_EMAIL` | outbound mailers | "from" address; alternate to RESEND_FROM_ADDRESS |
| `APP_URL` / `APP_ORIGIN` / `SHARE_BASE_URL` / `ALLOWED_ORIGIN` | various | the user-facing app URL — sometimes redundantly named |

## Tunables (numeric / boolean)

| Secret | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `NOTIFICATION_BATCH_SIZE` | notification-queue-worker | 50 | how many to drain per tick |
| `AI_CONFIDENCE` | (rare) AI router | 0.7 | threshold for auto-execute paths |
| `AI_OVERLAP` | (rare) | — | feature flag |
| `GEMINI_MODEL_NAME`, `GEMINI_FALLBACK_MODEL_NAME` | classify-drawing | gemini-2.5-flash | override the model name without redeploy |

## Audit findings

- **40 distinct keys** across all edge functions. That's a lot of
  surface area. Consolidation candidates:
  - `APP_URL` vs `APP_ORIGIN` vs `SHARE_BASE_URL` vs `ALLOWED_ORIGIN` — pick one canonical name and migrate the others.
  - `SENDER_EMAIL` vs `RESEND_FROM_ADDRESS` — same.
  - `GEMINI_API_KEY` vs `GEMINI_API_KEYS` (plural) — one supports rotation; doc the difference.
- **No undocumented secrets** found — every key referenced in code
  appears in this checklist.
- **Auto-provisioned vs customer-provided** is the most useful axis
  for the deployment runbook. The "Required" group above must be
  set per-environment via `supabase secrets set` or the Vercel
  env-vars dashboard for any non-cloud deployments.

## Setting secrets

```bash
# Per-secret:
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref hypxrmcppjfbtlwuoafc

# From a .env file:
supabase secrets set --env-file ./.env.production --project-ref hypxrmcppjfbtlwuoafc

# List currently set:
supabase secrets list --project-ref hypxrmcppjfbtlwuoafc
```

## Action items

1. Run `supabase secrets list --project-ref hypxrmcppjfbtlwuoafc` and
   compare against the "Required" table above. Any missing required
   secret is a deployment hazard.
2. Pick canonical names for the 4 redundant URL/origin secrets and
   refactor over the next sprint.
3. The `platform-health` endpoint (this stream) attempts a no-op
   call to each secret-dependent service and reports which ones fail.
