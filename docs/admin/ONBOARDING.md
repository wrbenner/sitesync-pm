# Admin Onboarding

This is the playbook for an organization admin standing up SiteSync PM for the first time. Each step cites the file that implements the feature.

## Day 0 — accounts and identity

1. **Create the organization.** A new organization is created when the first user signs up; subsequent users join via invite. The `auto_create_profile` trigger seeds a profile row from the auth user — see [supabase/migrations/20260428000010_auto_create_profile.sql](../../supabase/migrations/20260428000010_auto_create_profile.sql). Membership is enforced by [src/lib/ensureOrganizationMembership.ts](../../src/lib/ensureOrganizationMembership.ts).
2. **Decide on identity strategy.**
   - **Direct sign-up** (default): users join via email + password.
   - **SSO** (Enterprise tier): SAML or OIDC against your identity provider. See [admin/SSO_SETUP.md](SSO_SETUP.md).
   - **SCIM provisioning**: lifecycle managed by your IdP. The endpoint is [supabase/functions/scim-v2/index.ts](../../supabase/functions/scim-v2/index.ts).
3. **Invite the first round of users.** For one-at-a-time invites, use the standard invite flow backed by [supabase/functions/send-invite/index.ts](../../supabase/functions/send-invite/index.ts). For bulk invites, use the bulk-invite admin page at [src/pages/admin/bulk-invite](../../src/pages/admin/bulk-invite). It accepts a CSV of `(email, role)` and validates per row before fan-out.

## Day 1 — roles and permissions

1. **Decide whether the seven default roles are sufficient** or whether you need custom roles. The default role system is the canonical six roles documented in [HONEST_STATE.md](../../HONEST_STATE.md): Owner, Admin, PM, Super, Member, Viewer.
2. **Create custom roles** if needed via [src/pages/admin/custom-roles](../../src/pages/admin/custom-roles). The pure permission resolver lives at [src/lib/customRoles/index.ts](../../src/lib/customRoles/index.ts).
3. **Per-project role overrides** are supported by [supabase/migrations/20260502100002_per_project_role_overrides.sql](../../supabase/migrations/20260502100002_per_project_role_overrides.sql). Use these sparingly — the default model is one role per organization member.
4. See [admin/CUSTOM_ROLES.md](CUSTOM_ROLES.md) for the design pattern and edge cases.

## Day 2 — first project

1. **Create a project from scratch** via the standard project creation flow, OR
2. **Materialize from a template.** If your organization has uploaded a project template (see [admin/PROJECT_TEMPLATES.md](PROJECT_TEMPLATES.md)), the new project carries forward the SOV structure, RFI categories, punch templates, and role labels. The template materializer is [src/lib/projectTemplates/materialize.ts](../../src/lib/projectTemplates/materialize.ts).
3. **Add project members.** A user must be a project member to see project data; RLS is enforced at the `project_members` join.

## Day 3 — accounting integration

1. **Pick the accounting source.** SiteSync PM supports Sage 100, Sage 300, Viewpoint Vista, Foundation, Yardi, and Spectrum cost-code imports. Each importer is in [src/lib/integrations/costCodeImporters](../../src/lib/integrations/costCodeImporters).
2. **Open the cost-code library admin page** at [src/pages/admin/cost-code-library/index.tsx](../../src/pages/admin/cost-code-library/index.tsx).
3. **Drop a CSV.** The page surfaces a column-mapping modal at [src/pages/admin/cost-code-library/ColumnMappingModal.tsx](../../src/pages/admin/cost-code-library/ColumnMappingModal.tsx) — your accounting export's column names rarely match SiteSync's, so you map them once.
4. **Upsert.** The library has a `UNIQUE(organization_id, code)` constraint per [supabase/migrations/20260502120002_cost_code_library.sql](../../supabase/migrations/20260502120002_cost_code_library.sql), so re-importing the same export is safe.

## Day 4 — Procore migration (if applicable)

If you are switching from Procore, run the Procore importer:

1. Open [src/pages/admin/procore-import](../../src/pages/admin/procore-import).
2. Authenticate against Procore using your OAuth credentials (handled by [supabase/functions/oauth-token-exchange/index.ts](../../supabase/functions/oauth-token-exchange/index.ts)).
3. Start the import. Progress is polled live by [src/pages/admin/procore-import/JobProgressView.tsx](../../src/pages/admin/procore-import/JobProgressView.tsx).
4. The importer covers the ten most-used Procore endpoints (RFIs, submittals, change orders, daily logs, drawings, photos, contacts, schedule, budget, projects). Other endpoints (T&M tickets, observations, meeting minutes) are not yet covered — see the "Wiring backlog" in [STATUS.md](../STATUS.md).

The Procore-import worker has a known scaffold gap; see [STATUS.md](../STATUS.md) for the wiring backlog detail.

## Day 5 — branding, tokens, webhooks

1. **Org branding** (logo + accent color) is configured at [src/pages/admin/branding/index.tsx](../../src/pages/admin/branding/index.tsx). The schema is [supabase/migrations/20260502100005_org_branding.sql](../../supabase/migrations/20260502100005_org_branding.sql).
2. **API tokens** for programmatic access are managed at [src/pages/admin/api-tokens/index.tsx](../../src/pages/admin/api-tokens/index.tsx). The token issuance + verification is in [src/lib/apiTokens/index.ts](../../src/lib/apiTokens/index.ts). API contract is [docs/API_V1_CONTRACT.md](../API_V1_CONTRACT.md).
3. **Outbound webhooks** notify your downstream systems on RFI/submittal/CO events. Configured at [src/pages/admin/webhooks/index.tsx](../../src/pages/admin/webhooks/index.tsx). Dispatcher is [supabase/functions/webhook-dispatch/index.ts](../../supabase/functions/webhook-dispatch/index.ts).

## Day 7 — go-live checklist

- [ ] At least one project created with a real SOV
- [ ] Cost-code library populated
- [ ] All field users (supers, foremen) added to projects
- [ ] At least one COI per active subcontractor uploaded
- [ ] Daily log workflow exercised on a real day
- [ ] Pay-app pre-submission audit run successfully (see [COMPLIANCE_GATE.md](../COMPLIANCE_GATE.md))
- [ ] Notification preferences set for the executive sponsor (see [src/pages/notifications/PreferencesPage.tsx](../../src/pages/notifications/PreferencesPage.tsx))
- [ ] If Enterprise: SSO live and tested by an out-of-org tester
- [ ] If Enterprise: SCIM provisioning verified end-to-end
- [ ] Customer S3 export configured (if required) — see [supabase/functions/customer-s3-export/index.ts](../../supabase/functions/customer-s3-export/index.ts)

## Common pitfalls

- **"Why can't this user see anything?"** — They are an organization member but not a project member. Add them via the project member list.
- **"Cost-code import created duplicates."** — Confirm the column mapping picked the right code column. The unique constraint is on `(organization_id, code)`, so identical codes deduplicate, but typos like leading whitespace can sneak through.
- **"Procore import stalled."** — Re-invoke [supabase/functions/procore-import-extended/index.ts](../../supabase/functions/procore-import-extended/index.ts) with `resume_job_id` from the `import_jobs` row.
- **"Owner pay-app preview link returned 401."** — Magic-link tokens expire 24h after first access ([supabase/migrations/20260501100000_magic_link_tokens.sql](../../supabase/migrations/20260501100000_magic_link_tokens.sql)). Re-issue from the pay app share dialog.
