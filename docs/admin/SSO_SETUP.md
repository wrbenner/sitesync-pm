# SSO Setup — SAML and OIDC

Enterprise-tier organizations can authenticate users through their existing identity provider via SAML 2.0 or OIDC. This doc describes the configuration, the data shape, and the failure modes.

## What ships

| Layer | File |
| --- | --- |
| SAML handler | [supabase/functions/sso-saml-handler/index.ts](../../supabase/functions/sso-saml-handler/index.ts) |
| OIDC handler | [supabase/functions/sso-oidc-handler/index.ts](../../supabase/functions/sso-oidc-handler/index.ts) |
| Pure helpers | [src/lib/sso/index.ts](../../src/lib/sso/index.ts) |
| SCIM v2 provisioning | [supabase/functions/scim-v2/index.ts](../../supabase/functions/scim-v2/index.ts) |
| Per-org config table | [supabase/migrations/20260502100000_org_sso_config.sql](../../supabase/migrations/20260502100000_org_sso_config.sql) |
| Admin UI | [src/pages/admin/sso/index.tsx](../../src/pages/admin/sso/index.tsx) |

## Configuration shape

The `org_sso_config` table holds one row per organization. Configurable fields are documented inline in [supabase/migrations/20260502100000_org_sso_config.sql](../../supabase/migrations/20260502100000_org_sso_config.sql). Fields cover:

- Protocol (`saml` or `oidc`)
- IdP entity ID, sign-in URL, issuer
- IdP signing certificate (SAML)
- Client ID and discovery URL (OIDC)
- Attribute mappings (email, given name, family name, role)

## Configuring SAML

1. In your IdP (Okta, Azure AD, Google Workspace, etc.), create a new SAML 2.0 application.
2. **ACS (Assertion Consumer Service) URL**: the deployed URL of [supabase/functions/sso-saml-handler/index.ts](../../supabase/functions/sso-saml-handler/index.ts).
3. **Audience / Entity ID**: provide a stable string for your organization; record it on both sides.
4. **Attribute statements**: map at minimum `email`, `givenName`, `familyName`. Optional: `groups` if you want IdP groups to drive SiteSync roles.
5. In SiteSync, open [src/pages/admin/sso/index.tsx](../../src/pages/admin/sso/index.tsx). Paste the IdP metadata (entity ID, sign-in URL, signing certificate). Map attributes to SiteSync's `email`, `display_name`, and `role`.
6. Test with a tester account that is NOT in the SiteSync org. Confirm a successful first login provisions the profile via [supabase/migrations/20260428000010_auto_create_profile.sql](../../supabase/migrations/20260428000010_auto_create_profile.sql).

## Configuring OIDC

1. In your IdP, register a new OIDC application.
2. **Redirect URI**: the deployed URL of [supabase/functions/sso-oidc-handler/index.ts](../../supabase/functions/sso-oidc-handler/index.ts).
3. **Required scopes**: `openid`, `profile`, `email`.
4. In SiteSync, open the SSO admin page and paste the OIDC discovery URL plus client ID.
5. Test the round trip.

## SCIM provisioning (optional)

If your IdP supports SCIM, SiteSync can accept user lifecycle events (create, update, deactivate) without manual invites. The SCIM endpoint is [supabase/functions/scim-v2/index.ts](../../supabase/functions/scim-v2/index.ts).

- **Base URL**: the deployed URL of the SCIM v2 function.
- **Authentication**: bearer token issued from [src/pages/admin/api-tokens/index.tsx](../../src/pages/admin/api-tokens/index.tsx) with the `scim` scope. Token verification logic lives in [src/lib/apiTokens/index.ts](../../src/lib/apiTokens/index.ts).
- **Supported operations**: `Users` create, replace, delete, search. Group operations are limited to organization-level membership.

## Failure modes

| Failure | Where it surfaces | Recovery |
| --- | --- | --- |
| IdP signing certificate rotated without notice | SAML assertion fails to verify in [supabase/functions/sso-saml-handler/index.ts](../../supabase/functions/sso-saml-handler/index.ts) | Update the cert via the SSO admin page |
| OIDC discovery doc temporarily unreachable | Login times out | Default fail-mode: surface a recoverable error and retry |
| User exists in IdP but not in SiteSync | First-login auto-provisions the profile | Confirm the IdP `email` attribute is mapped |
| User deactivated in IdP but session active in SiteSync | Browser session persists until next refresh | SCIM deactivate triggers session invalidation; without SCIM, session expires per Supabase auth defaults |
| Org migrating from password auth to SSO | Existing password users keep working | Schedule a cutover; do not flip a hard requirement until all users have signed in via SSO once |

## Testing checklist

- [ ] First-time SSO login provisions a profile row
- [ ] Existing-user SSO login does NOT duplicate the profile
- [ ] Email attribute maps to `email` (case-insensitive comparison)
- [ ] User without an org membership lands on a clear "ask your admin to add you" page (handled by [src/lib/ensureOrganizationMembership.ts](../../src/lib/ensureOrganizationMembership.ts))
- [ ] If SCIM is configured: an IdP-side disable triggers a SiteSync deactivation within 5 minutes
- [ ] Customer's CISO has reviewed the SAML assertion contents — IdP-side audit logs match SiteSync's [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql) entries

## What is NOT shipped

- IdP-initiated SLO (Single Logout) is not yet wired. Sessions terminate on Supabase JWT expiry only.
- Just-in-time group-to-role mapping is configurable via attribute mappings, but the role table is the SiteSync org's, not synced live from the IdP.
- Multi-IdP per organization (e.g., one for employees, one for contractors) is not modeled — `org_sso_config` is one row per organization.
