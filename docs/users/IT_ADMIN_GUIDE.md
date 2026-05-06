# IT Admin Guide

You own identity, integrations, and tokens. This guide covers the surfaces you touch routinely.

## Identity

### SSO

See [admin/SSO_SETUP.md](../admin/SSO_SETUP.md) for the full setup. Quick reference:

| Protocol | Handler |
| --- | --- |
| SAML 2.0 | [supabase/functions/sso-saml-handler/index.ts](../../supabase/functions/sso-saml-handler/index.ts) |
| OIDC | [supabase/functions/sso-oidc-handler/index.ts](../../supabase/functions/sso-oidc-handler/index.ts) |

Configuration UI is at [src/pages/admin/sso/index.tsx](../../src/pages/admin/sso/index.tsx); persistence is [supabase/migrations/20260502100000_org_sso_config.sql](../../supabase/migrations/20260502100000_org_sso_config.sql).

### SCIM v2

The SCIM endpoint is [supabase/functions/scim-v2/index.ts](../../supabase/functions/scim-v2/index.ts). Provisioning is bearer-authenticated using a token issued via [src/pages/admin/api-tokens/index.tsx](../../src/pages/admin/api-tokens/index.tsx) with the `scim` scope. The verification logic is [src/lib/apiTokens/index.ts](../../src/lib/apiTokens/index.ts).

Operations supported:
- Users — create, replace, delete, search
- Group operations — limited to organization-level membership

### Custom roles

See [admin/CUSTOM_ROLES.md](../admin/CUSTOM_ROLES.md). The resolver is [src/lib/customRoles/index.ts](../../src/lib/customRoles/index.ts); per-project overrides are [supabase/migrations/20260502100002_per_project_role_overrides.sql](../../supabase/migrations/20260502100002_per_project_role_overrides.sql).

## API tokens

For machine-to-machine access:

1. Open [src/pages/admin/api-tokens/index.tsx](../../src/pages/admin/api-tokens/index.tsx).
2. Issue a token with the appropriate scopes. Token issuance, hashing, and verification: [src/lib/apiTokens/index.ts](../../src/lib/apiTokens/index.ts).
3. Persistence: [supabase/migrations/20260502100003_org_api_tokens.sql](../../supabase/migrations/20260502100003_org_api_tokens.sql).
4. The deployed REST contract is documented at [docs/API_V1_CONTRACT.md](../API_V1_CONTRACT.md). The endpoint shell is [supabase/functions/api-v1/index.ts](../../supabase/functions/api-v1/index.ts).

Tokens are stored as hashes; the plaintext is shown once at issuance. Rotate any token whose plaintext you cannot vault.

## Webhooks

Outbound webhooks notify your downstream systems on entity events:

- Configuration UI: [src/pages/admin/webhooks/index.tsx](../../src/pages/admin/webhooks/index.tsx)
- Pure dispatch helpers: [src/lib/webhooks/index.ts](../../src/lib/webhooks/index.ts)
- Dispatcher edge function: [supabase/functions/webhook-dispatch/index.ts](../../supabase/functions/webhook-dispatch/index.ts)
- Receiver (for inbound, e.g., Procore webhooks if you wire them): [supabase/functions/webhook-receiver/index.ts](../../supabase/functions/webhook-receiver/index.ts)
- Persistence: [supabase/migrations/20260502100004_outbound_webhooks.sql](../../supabase/migrations/20260502100004_outbound_webhooks.sql)

Webhook payloads are signed; verify the signature on your end using the shared secret you configured.

## Integrations

### Procore

If migrating from Procore, see the import pages under [src/pages/admin/procore-import](../../src/pages/admin/procore-import) and the live progress poller at [src/pages/admin/procore-import/JobProgressView.tsx](../../src/pages/admin/procore-import/JobProgressView.tsx). The pure client is [src/lib/integrations/procore](../../src/lib/integrations/procore).

The OAuth round-trip is handled by [supabase/functions/oauth-token-exchange/index.ts](../../supabase/functions/oauth-token-exchange/index.ts).

### P6, MS Project

- P6 import: [supabase/functions/p6-import/index.ts](../../supabase/functions/p6-import/index.ts) backed by [src/lib/integrations/p6Xer](../../src/lib/integrations/p6Xer)
- P6 export: [supabase/functions/p6-export/index.ts](../../supabase/functions/p6-export/index.ts)
- MS Project (MSPDI XML): [src/lib/integrations/msProjectXml](../../src/lib/integrations/msProjectXml)

### Accounting cost-code import

Six accounting systems supported via [src/lib/integrations/costCodeImporters](../../src/lib/integrations/costCodeImporters): Sage 100, Sage 300, Viewpoint Vista, Foundation, Yardi, Spectrum. Admin UI: [src/pages/admin/cost-code-library/index.tsx](../../src/pages/admin/cost-code-library/index.tsx) with the column-mapping modal [src/pages/admin/cost-code-library/ColumnMappingModal.tsx](../../src/pages/admin/cost-code-library/ColumnMappingModal.tsx).

## Branding

Set logo + accent color at [src/pages/admin/branding/index.tsx](../../src/pages/admin/branding/index.tsx). Schema: [supabase/migrations/20260502100005_org_branding.sql](../../supabase/migrations/20260502100005_org_branding.sql).

## Customer S3 export

If your data-residency or analytics policy requires a customer-managed copy, configure an S3 export using [supabase/functions/customer-s3-export/index.ts](../../supabase/functions/customer-s3-export/index.ts). The export does NOT remove data from SiteSync's primary store; it is a one-way replication into your bucket. Configuration table: [supabase/migrations/20260503110004_org_s3_export_config.sql](../../supabase/migrations/20260503110004_org_s3_export_config.sql).

## Account deletion

The account-deletion edge function is [supabase/functions/delete-account/index.ts](../../supabase/functions/delete-account/index.ts). It writes a tombstone row per [supabase/migrations/20260427000001_account_deletion_events.sql](../../supabase/migrations/20260427000001_account_deletion_events.sql) for the audit trail. See [compliance/GDPR_POSTURE.md](../compliance/GDPR_POSTURE.md) for the data-subject-rights story.

## Security audits

The most recent audit log is [docs/SECURITY_AUDIT_2026_04_24.md](../SECURITY_AUDIT_2026_04_24.md). Compliance posture controls map to [compliance/SOC2_EVIDENCE_PACK.md](../compliance/SOC2_EVIDENCE_PACK.md).
