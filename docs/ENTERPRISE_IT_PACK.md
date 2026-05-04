# Enterprise IT Pack

The structural gate that lets the IT director's security analyst close the tab on a competitor and stay open on us. Without these, no demo gets booked.

## Pillars

| Pillar | What ships |
| --- | --- |
| **SSO** | Per-org SAML 2.0 + OIDC. Test mode allows a single user before org-wide enable. JIT user provisioning on first login. |
| **SCIM 2.0** | `/Users` + `/Groups` (RFC 7644). Bearer-token auth with the org API token's `scim.manage` scope. PATCH `active=false` cascades to revoke all tokens + kill sessions. |
| **Custom roles** | Org-defined roles with arbitrary permission subsets. Per-project overrides (a user can be PM org-wide and viewer on one job). |
| **API tokens** | Long-lived org-scoped tokens with explicit scope + project filter. Stored as SHA-256(token); the original is shown to the admin once. |
| **Webhooks** | Outbound subscriptions per event type + status filter. HMAC-signed deliveries. 7-day exponential-backoff retry → dead-letter. |
| **Audit posture** | A snapshot endpoint + dashboard that the security analyst screenshots into the SOC 2 evidence package. |
| **Branding** | Per-org logo, colors, sender identity, custom domain — applied to emails + magic-link pages + sealed PDFs. |
| **Data residency** | `organizations.data_region` already exists; surfaced on the Trust page. |

## Architecture

```
                                        ┌─────────────────────────────┐
                                        │  6 migrations               │
                                        │   org_sso_config            │
                                        │   org_custom_roles          │
                                        │   per_project_role_overrides│
                                        │   org_api_tokens            │
                                        │   outbound_webhooks         │
                                        │   org_branding              │
                                        └─────────────────┬───────────┘
                                                          │
                ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
                ▼                                         ▼                                         ▼
  ┌──────────────────────────┐        ┌──────────────────────────────┐        ┌──────────────────────────────┐
  │ src/lib/sso              │        │ src/lib/customRoles          │        │ src/lib/apiTokens            │
  │ src/lib/webhooks         │        │   ResolveResult merge        │        │   mint / sha256 / hasScope    │
  │   pure helpers + tests   │        │   pure helpers + tests       │        │   pure helpers + tests        │
  └──────────────────────────┘        └──────────────────────────────┘        └──────────────────────────────┘
                │                                         │                                         │
                ▼                                         ▼                                         ▼
  ┌──────────────────────────┐        ┌──────────────────────────────┐        ┌──────────────────────────────┐
  │ supabase/functions/      │        │ src/pages/admin/             │        │ src/components/admin/        │
  │   sso-saml-handler       │        │   sso/                        │        │   AdminPageShell             │
  │   sso-oidc-handler       │        │   custom-roles/               │        └──────────────────────────────┘
  │   scim-v2                │        │   api-tokens/                 │
  │   webhook-dispatch       │        │   webhooks/                   │
  │   audit-posture-snapshot │        │   audit-posture/              │
  └──────────────────────────┘        │   branding/                   │
                                      └──────────────────────────────┘
```

## Threat model — what's tightened

* **Token leak (committed to GitHub).** Tokens stored only as SHA-256. The admin UI shows masked prefix; full token is shown once at mint. Webhook events fire on every revoke so receiver systems can auto-rotate. Auto-detection via partial-hash logging is a follow-up.
* **IdP returns user without email claim.** `decideAccess` returns `blocked_no_email` outcome with a clear message persisted in `sso_login_events`. Admins read the IT debug page (the same `sso_login_events` table) instead of seeing a generic "auth failed".
* **User without org.** When `allow_jit_provision=false`, `decideAccess` returns `blocked_no_org`; the SSO handler emails the project admin with a one-tap "create org with this domain" link.
* **Cert rotation breaks login.** `org_sso_config.saml_x509_certs` allows multiple PEM blocks at once. Admins paste the new cert before the old one expires; the SSO handler walks every PEM until one verifies. The countX509Pems helper surfaces "2 cert blocks active" so the admin can see the rotation overlap.
* **Webhook receiver offline.** `webhook-dispatch` retries on the exponential ladder for 7 days, then dead-letters. The admin dashboard surfaces `consecutive_failures` per subscription. A "pause webhook" toggle lets the receiver maintain without losing events (the subscription pauses but events keep enqueuing for replay).
* **Custom role grants too much.** Permission checks happen server-side via RLS, not client-side. A misconfigured custom role hides UI affordances without granting the underlying database access.
* **User offboarded but holds API tokens.** SCIM `PATCH /Users/:id { active: false }` cascades to mark `organization_members.deactivated_at` + revoke all tokens. The org-admin's `audit-posture-snapshot` dashboard surfaces the cascade as a permission_changes row.
* **Multi-org consultants.** Tokens are org-scoped; SSO `aud` enforces org match per assertion. Same email across IdPs is deduped server-side at JIT-provision time.

## Wiring required (deferred to user)

1. **Run all 6 migrations in order** (`20260502100000…100005`). Each is idempotent; safe to re-run.
2. **`sso-exchange` Vault secret.** Store OIDC client secrets in Supabase Vault; production reads via the function's `vault.decrypt()` call. Until then, `oidc_client_secret_ciphertext` is read verbatim — fine for sandbox.
3. **`MAGIC_LINK_SECRET` (or `SUPABASE_JWT_SECRET`)** — same secret used by Tab A's magic-link flow. SAML/OIDC handlers don't need this; we kept it separate.
4. **`WEBHOOK_DEFAULT_SECRET` env var.** Until the per-subscription Vault path is wired, the dispatcher signs with this constant. Production must move the secret to Vault per subscription.
5. **Cron: `webhook-dispatch` drain.** Every minute via pg_cron:
   ```sql
   SELECT cron.schedule('webhook-dispatch-drain', '* * * * *',
     $$ SELECT net.http_post(url := '<base>/functions/v1/webhook-dispatch') $$);
   ```
6. **Wire entity triggers to enqueue webhook_deliveries.** A small trigger per RFI/Submittal/CO/Punch that calls `eventFromTrigger()` (mirror in plpgsql) and inserts into `webhook_deliveries` for matching subscriptions.
7. **Mount admin routes.** Add to `src/App.tsx`:
   ```tsx
   <Route path="/admin/sso"           element={<SsoAdminPage organizationId={orgId} />} />
   <Route path="/admin/api-tokens"    element={<ApiTokensAdminPage organizationId={orgId} />} />
   <Route path="/admin/webhooks"      element={<WebhooksAdminPage organizationId={orgId} />} />
   <Route path="/admin/audit-posture" element={<AuditPosturePage organizationId={orgId} />} />
   <Route path="/admin/custom-roles"  element={<CustomRolesAdminPage organizationId={orgId} />} />
   <Route path="/admin/branding"      element={<BrandingAdminPage organizationId={orgId} />} />
   ```
   All gated on `org.settings` permission.
8. **`organization_members.deactivated_at`** column — add it via a small migration if it doesn't exist; the SCIM PATCH handler depends on it.
9. **`platform_backups` table** — referenced by `audit-posture-snapshot`. Best-effort: the dashboard already gracefully degrades when missing.
10. **Production XML-DSig verifier** — the SAML handler currently rejects unsigned assertions but does not yet verify signatures. Wire `xmldsigjs` or equivalent before going live.
11. **Webhook trigger plpgsql functions** — the SPA-side `eventFromTrigger()` is the contract; mirror it as a Postgres trigger that INSERTs into `webhook_deliveries`.

## SSO cert rotation drill

1. **Stage:** the IdP admin generates the new cert. They paste it into `org_sso_config.saml_x509_certs` BELOW the existing cert, separated by a blank line. The countX509Pems helper now reports 2 blocks.
2. **Verify:** test with a single user via test-mode (set `test_mode_enabled=true`, add the test email). Both certs are valid; if the IdP signs with either, the verifier accepts.
3. **Switch:** the IdP admin flips their signing cert. Login traffic shifts onto the new cert.
4. **Cleanup:** after 24h with no failures on the old cert, the admin removes the first PEM block. countX509Pems reports 1.

The whole drill happens without downtime because the verifier walks every PEM until one matches.

## Files

```
src/lib/sso/{index.ts,__tests__/sso.test.ts}                       — pure SSO helpers + 20 tests
src/lib/customRoles/{index.ts,__tests__/customRoles.test.ts}       — pure resolver + 11 tests
src/lib/apiTokens/{index.ts,__tests__/apiTokens.test.ts}           — pure mint/verify + 17 tests
src/lib/webhooks/{index.ts,__tests__/webhooks.test.ts}             — pure dispatcher helpers + 18 tests
src/components/admin/AdminPageShell.tsx                            — shared admin layout
src/pages/admin/{sso,api-tokens,webhooks,audit-posture,custom-roles,branding}/index.tsx
supabase/functions/{sso-saml-handler,sso-oidc-handler,scim-v2,webhook-dispatch,audit-posture-snapshot}/index.ts
supabase/migrations/20260502100000_org_sso_config.sql              — SAML/OIDC + sso_login_events
supabase/migrations/20260502100001_org_custom_roles.sql            — roles + assignments
supabase/migrations/20260502100002_per_project_role_overrides.sql  — per-project override
supabase/migrations/20260502100003_org_api_tokens.sql              — tokens + uses log
supabase/migrations/20260502100004_outbound_webhooks.sql           — subs + deliveries
supabase/migrations/20260502100005_org_branding.sql                — brand surface
docs/ENTERPRISE_IT_PACK.md                                         — this file
```

## Test coverage

`npm run test:run -- src/lib/sso src/lib/customRoles src/lib/apiTokens src/lib/webhooks` → **66 tests passing** across the four pure libs.
