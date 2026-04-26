# Security

SiteSync PM takes the protection of customer project data seriously. This document describes how to report a vulnerability and gives a high-level summary of our security posture.

## Reporting a vulnerability

**Please do NOT open a public GitHub issue for security findings.**

Email **security@sitesync.app** with:

- A description of the vulnerability
- Steps to reproduce (or a proof-of-concept)
- Your assessment of impact
- Whether you've disclosed it elsewhere

We acknowledge within **24 hours**. For high-severity findings (auth bypass, RCE, data exposure across tenants), we aim to ship a fix or mitigation within **14 days**. Lower-severity findings within 30 days.

We do not currently run a paid bug bounty, but we do publicly credit researchers who responsibly disclose, and we'll work with you on coordinated disclosure timing.

## Out of scope

- Findings on third-party services we depend on (Supabase, Stripe, Anthropic, Vercel) — please report to those vendors directly.
- Issues that require physical access to a user's device.
- Self-XSS, missing best-practice headers we already document as accepted (none currently), missing rate-limits on cosmetic endpoints.
- Social engineering of SiteSync employees.

## What we protect

### Identity & authentication
- Email + password with bcrypt (managed by Supabase Auth)
- TOTP MFA available; soft-forced for owner / admin / project_manager roles
- 30-minute idle session timeout
- Server-side rate limiting on sign-in attempts

### Tenant isolation
- PostgreSQL Row-Level Security (RLS) enforces per-organization and per-project scoping at the database layer
- `FORCE ROW LEVEL SECURITY` enabled on every table holding tenant data — even superuser-equivalent service-role queries cannot bypass policies without explicitly disabling them per-statement

### Audit trail
- Every privileged mutation is captured (who, when, what changed)
- Audit log entries form a tamper-evident SHA-256 hash chain
- A scheduled verifier walks the chain nightly and alerts on integrity break
- UPDATE/DELETE on `audit_log` is blocked at the database layer for non-superuser roles

### Encryption
- TLS 1.2+ in transit, HSTS preloaded
- AES-256 at rest (managed by AWS via Supabase)
- Field-level encryption via Supabase Vault for SSN, tax ID, contract terms

### Application security
- HTTP security headers at the edge: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`
- DOMPurify-sanitized markdown rendering with explicit tag/attribute allowlist
- No `eval` / `new Function` in our application code
- Dependabot weekly; high-severity merge SLA 7 days

### Edge functions
- Every privileged endpoint validates the caller's JWT via GoTrue's `/auth/v1/user` endpoint and resolves project membership before service-role writes
- Cron-only endpoints authenticate via a separate `CRON_SECRET`
- No anonymous endpoints that can write data

### Backup & recovery
- Daily full backups (Supabase managed)
- Point-in-time recovery for trailing 7 days
- RPO 24 hours / RTO 4 hours
- Quarterly DR drill

## Compliance posture

| Framework | Status |
|---|---|
| SOC 2 Type I | In progress |
| SOC 2 Type II | Roadmap (post Type I + 6-month observation) |
| HIPAA BAA | On request, year 2 |
| GDPR | Data export + deletion endpoints in place; DPA available on request |
| Davis-Bacon / WH-347 certified payroll | Computation + PDF export shipped |

For a longer-form security questionnaire response, completed CAIQ-Lite, or a copy of our DPA, email security@sitesync.app.

## Supported versions

SiteSync PM is delivered as continuously-deployed SaaS. There is no "version" to support; the production deployment at https://sitesync-pm.vercel.app is always the latest reviewed code on `main`.

For self-hosted deployments (enterprise tier only), we support the most recent two minor releases. Older releases get high-severity security patches for 12 months after release.
