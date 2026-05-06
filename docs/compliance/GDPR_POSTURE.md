# GDPR Posture

This document describes SiteSync PM's posture toward the General Data Protection Regulation (GDPR) and analogous regimes (CCPA, etc.). It is the artifact a customer's data protection officer (DPO) will request.

## Roles

- **SiteSync PM operates as a data processor** on behalf of each customer organization. The customer is the data controller for their project data.
- The customer is responsible for lawful basis (typically contract or legitimate interest for a construction project).
- SiteSync PM is responsible for the technical and organizational measures (TOMs) below.

## Lawful basis support

SiteSync does not collect personal data beyond what is necessary for project management:

- Authentication identifiers (email, optional SSO subject)
- Profile fields (name, role, avatar)
- Business activity (RFIs authored, daily logs signed, photos captured with location)

The schema is fully migration-cited; see the migrations in [supabase/migrations](../../supabase/migrations).

## Data subject rights (DSRs)

### Right to access

A user can export their profile + activity via the customer S3 export at [supabase/functions/customer-s3-export/index.ts](../../supabase/functions/customer-s3-export/index.ts) (org-scoped) or via the sealed entity export at [src/lib/audit/sealedExport.ts](../../src/lib/audit/sealedExport.ts) (entity-scoped, for legal hold).

For self-service: a user reads their data through the standard app UI; admins can produce a per-user export by querying their authored rows.

### Right to erasure

The account-deletion edge function is [supabase/functions/delete-account/index.ts](../../supabase/functions/delete-account/index.ts). It writes a tombstone per [supabase/migrations/20260427000001_account_deletion_events.sql](../../supabase/migrations/20260427000001_account_deletion_events.sql), preserving the audit trail of *what* was deleted while not retaining the personal data itself.

Caveats:

- Construction projects have legal recordkeeping requirements (RFIs, change orders, certified payroll) that often outlive a user's tenure. Personal identifiers are pseudonymized rather than deleted in those rows; the user's authored content remains, attributed to a tombstone.
- The hash-chained audit log per [docs/HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md) is append-only by construction. A retroactive deletion would break the chain. The legal-hold balance: deletion writes a tombstone row; the prior history is preserved.

### Right to rectification

User-editable fields are correctable in the standard UI. Corrections to immutable rows (signed daily logs, signed waivers) create revision rows per [supabase/migrations/20260501110001_daily_log_revisions.sql](../../supabase/migrations/20260501110001_daily_log_revisions.sql) — preserving the original.

### Right to data portability

The customer S3 export ([supabase/functions/customer-s3-export/index.ts](../../supabase/functions/customer-s3-export/index.ts)) writes an org's data to a customer-controlled bucket in a structured format suitable for migration to another platform.

### Right to object

User notification preferences ([src/pages/notifications/PreferencesPage.tsx](../../src/pages/notifications/PreferencesPage.tsx); [src/lib/notifications/preferences.ts](../../src/lib/notifications/preferences.ts)) let a user opt out of any non-critical communication. Critical alerts default to bypass DND but the user can opt out per [docs/PLATINUM_NOTIFICATIONS.md](../PLATINUM_NOTIFICATIONS.md).

## Data residency

Default: `us-west-2`. Configurable per organization. The DR runbook ([docs/DR_RUNBOOK.md](../DR_RUNBOOK.md)) lists the supported Supabase regions, including EU (`eu-west-1`, `eu-central-1`).

If a customer requires EU residency, the entire Supabase project (Postgres, Storage, edge functions) lives in the chosen region.

## Sub-processors

| Sub-processor | Purpose |
| --- | --- |
| Supabase | Postgres, Storage, Auth, edge function runtime |
| The deployment host | Static web app + functions runtime |
| Anthropic (or chosen LLM provider) | AI inference for Iris drafts and document generation. AI calls are scoped per [src/lib/aiService.ts](../../src/lib/aiService.ts) and observability per [src/lib/aiObservability.ts](../../src/lib/aiObservability.ts). |
| Resend (or chosen email provider) | Outbound transactional email via [supabase/functions/send-email/index.ts](../../supabase/functions/send-email/index.ts) |
| Stripe | Payment processing (only for billing flows; not exposed to customers' construction data) — see [supabase/functions/stripe-webhook/index.ts](../../supabase/functions/stripe-webhook/index.ts) |
| Whisper / OpenAI (transcription) | Audio transcription via [supabase/functions/transcribe-audio/index.ts](../../supabase/functions/transcribe-audio/index.ts) and [supabase/functions/transcribe-walkthrough/index.ts](../../supabase/functions/transcribe-walkthrough/index.ts) |

A Data Processing Addendum (DPA) is available on request.

## Retention

- Active project data: retained for the duration of the project plus the customer's chosen retention window (default 7 years post-completion to satisfy typical construction recordkeeping).
- Backups: per the PITR window in [DR.md](../operations/DR.md).
- Account deletion tombstones: retained indefinitely for audit-chain integrity.

## Breach notification

Per [operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md), security events are escalated immediately. Customer notification is per the executed contract, typically within 72 hours of discovery (matching GDPR Art. 33).

## Technical and organizational measures

- Encryption in transit: TLS 1.2+ on all customer-facing endpoints.
- Encryption at rest: inherited from Supabase platform.
- Authentication: Supabase Auth, optional SSO + SCIM (see [admin/SSO_SETUP.md](../admin/SSO_SETUP.md)).
- Authorization: row-level security on every customer-facing table — see migrations [00033](../../supabase/migrations/00033_rls_permission_enforcement.sql), [00043](../../supabase/migrations/00043_complete_rls_enforcement.sql), [00050](../../supabase/migrations/00050_projects_org_membership_rls.sql).
- Audit logging: hash-chained per [HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md).
- Backup + DR: see [DR.md](../operations/DR.md) and [DR_RUNBOOK.md](../DR_RUNBOOK.md).
- Production access controls: see [DR_RUNBOOK.md](../DR_RUNBOOK.md) ("Who has access").
- Vulnerability management: dependency updates flagged via the team's Dependabot equivalent; security audit log at [docs/SECURITY_AUDIT_2026_04_24.md](../SECURITY_AUDIT_2026_04_24.md).

## What is NOT supported (yet)

- **BYOK (bring-your-own-key) encryption**: roadmap item; current keys are Supabase platform keys.
- **Customer-managed key rotation cadence**: tied to BYOK above.
- **DSR auto-fulfillment portal**: today, DSRs are fulfilled by the customer admin via the existing tooling (S3 export + account deletion). A self-serve user portal is a roadmap item.
- **Per-field PII redaction in the customer S3 export**: the export is verbatim; if your downstream warehouse must redact PII, do it on the warehouse side.
