# Security and privacy

We take your data seriously. The short version: encrypted in transit + at rest, multi-tenant isolation enforced at the database, every AI call is audit-logged.

## Encryption

- TLS 1.3 in transit
- AES-256 at rest (database + storage)
- Stripe handles payment data — we never see card numbers

## Multi-tenant isolation

Every database query is scoped by your organization id at the row level (Postgres RLS). Adversarial cross-tenant tests run in CI on every change. A single cross-tenant data exposure incident triggers production rollback per our incident playbook.

## Authentication

- Password minimum 12 characters
- Breach-list check (we reject passwords seen in known breaches)
- Optional MFA (TOTP)
- Single-sign-on via SAML 2.0 + OIDC for enterprise plans

## AI providers

Your data is processed by Anthropic, OpenAI, Perplexity, and Gemini per call. **None of these providers train on your data.** No fine-tuning, no model retention. Each provider's data-processing addendum is in our subprocessor list.

## Subprocessors

Supabase, Vercel, Stripe, Sentry, PostHog, Crisp, Anthropic, OpenAI, Perplexity, Gemini, Resend. Full list with DPA links at [legal/dpa](https://sitesyncai.com/legal/dpa).

## Reporting a vulnerability

Email **security@sitesyncai.com** (or **walker@sitesyncai.com** during the Beta). We respond within 24 hours.
