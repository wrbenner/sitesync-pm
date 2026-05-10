# Langfuse self-host (SiteSync)

Self-hosted Langfuse instance for Iris trace observability. Per
**ADR-022** (`docs/audits/ADR_022_LANGFUSE_SELF_HOST_2026-05-08.md`),
self-host is required so soft-pilot trace data stays on SiteSync infra
(per **ADR-006** — pilot data isolation).

## Architecture

```
Browser ─┐
         │  iris-call SSE
         ▼
Supabase Edge Function (iris-call)
         │
         ├─ writes audit_log row (canonical, hash-chained)
         ├─ writes ai_cost_tracking row (cost rollup)
         └─ POST /api/public/ingestion ───▶ Langfuse self-host (Fly.io)
                                                     │
                                                     ▼
                                         Postgres (Fly Managed)
```

Langfuse runs on Fly.io as a single-region web app + tiny managed
Postgres for trace storage. Walker runs `flyctl deploy` manually for
the initial stand-up; from there, the `langfuse/langfuse:latest`
image pulls automatic security updates (per Fly's normal model).

## Prerequisites

```bash
brew install flyctl
flyctl auth signup    # or login
```

## Initial deploy

```bash
cd infra/langfuse
flyctl launch --no-deploy --copy-config           # creates app from fly.toml
flyctl postgres create --name sitesync-langfuse-pg --region <yours>
flyctl postgres attach sitesync-langfuse-pg --app sitesync-langfuse
flyctl secrets set \
  NEXTAUTH_SECRET=$(openssl rand -hex 32) \
  SALT=$(openssl rand -hex 32) \
  ENCRYPTION_KEY=$(openssl rand -hex 32) \
  --app sitesync-langfuse
flyctl deploy --app sitesync-langfuse
```

After first boot, navigate to the Langfuse UI to create a project +
issue an API keypair (public + secret). Save those into:

1. Supabase Function secrets (so iris-call can post traces):
   ```bash
   supabase secrets set LANGFUSE_HOST=https://sitesync-langfuse.fly.dev
   supabase secrets set LANGFUSE_PUBLIC_KEY=pk-lf-...
   supabase secrets set LANGFUSE_SECRET_KEY=sk-lf-...
   ```

2. GitHub Actions secrets (so the eval workflow can run live):
   ```bash
   gh secret set LANGFUSE_HOST
   gh secret set LANGFUSE_PUBLIC_KEY
   gh secret set LANGFUSE_SECRET_KEY
   gh secret set STAGING_SUPABASE_URL
   gh secret set STAGING_SUPABASE_SERVICE_ROLE_KEY
   ```

3. (Optional) `.env.local` for local dev runs of `npm run eval:iris`.

## Local development

For local iteration without the Fly instance, run Langfuse via Docker
Compose:

```bash
cd infra/langfuse
docker compose up -d
# UI at http://localhost:3000
```

Set:

```bash
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-local-...
LANGFUSE_SECRET_KEY=sk-lf-local-...
```

## Restore drill

The Postgres on Fly is managed, so backups happen automatically. Once
a month, run a manual restore drill:

1. `flyctl postgres backup list --app sitesync-langfuse-pg`
2. Pick a recent snapshot, fork to a `-restore` instance, point a test
   Langfuse app at it, verify traces are intact.
3. Document the wall-clock time in `docs/audits/RESTORE_DRILL_<date>.md`.

This matches the pattern in `.github/workflows/restore-drill.yml`.

## Pricing notes

Langfuse OSS is free; Fly.io `shared-cpu-1x` + `pg-tiny` runs ~$5/mo
for our trace volume (1k–10k traces/month during pilot). When traces
exceed 100k/month, upgrade to `shared-cpu-2x` + `pg-mini` (~$15/mo).

For SOC 2 evidence: this stack puts trace data in a Walker-controlled
infra surface, satisfying the "no third-party trace processor" line
in the soft-pilot agreement template.
