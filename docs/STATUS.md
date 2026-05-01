# Status — What Is Shipped, What Is Wiring-Pending, What Is Stub

This is the canonical "what does the system actually do today" reference. It aggregates the per-wave engineering docs (the `PLATINUM_*` and `ENTERPRISE_*` docs in this directory), the team's own self-assessment in [HONEST_STATE.md](../HONEST_STATE.md), and a verified scan of the codebase.

The cite-or-omit rule applies: every entry below names a specific file. If you can't find a file in this list for a feature you remember reading about, the feature is not shipped.

## Three-tier status model

- **Shipped end-to-end** — visible in the deployed app, exercised by tests, no follow-up edits required to use
- **Shipped behind a wiring gate** — implementation is in the repo; a route registration in [src/App.tsx](../src/App.tsx) or a service-layer call in an existing file has not yet been made
- **Stubbed or absent** — UI mock or empty page; do not market or document as shipping

## Shipped end-to-end (representative)

### Core 9 entities (per HONEST_STATE.md)

The nine workflows below are the spine of the product. Each is functional and demo-ready.

| Entity | Primary file |
| --- | --- |
| RFIs | [src/services/rfiService.ts](../src/services/rfiService.ts) |
| Submittals | [src/services/submittalService.ts](../src/services/submittalService.ts) |
| Pay applications | [src/pages/payment-applications/index.tsx](../src/pages/payment-applications/index.tsx) |
| Daily log | [src/pages/daily-log/index.tsx](../src/pages/daily-log/index.tsx) |
| Punch list | [src/lib/walkthrough/index.ts](../src/lib/walkthrough/index.ts) |
| Schedule | [src/lib/schedule/integrityCheck.ts](../src/lib/schedule/integrityCheck.ts) |
| Change orders | [src/lib/coAutoDraft/index.ts](../src/lib/coAutoDraft/index.ts) |
| Tasks | [src/services/drawingService.ts](../src/services/drawingService.ts) |
| Closeout | [src/lib/documentGen/closeoutPackage.ts](../src/lib/documentGen/closeoutPackage.ts) |

### Auth, identity, and audit

- Hash-chained audit log: [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../supabase/migrations/20260426000001_audit_log_hash_chain.sql), verifier in [src/lib/audit/hashChainVerifier.ts](../src/lib/audit/hashChainVerifier.ts)
- Sealed entity export: [src/lib/audit/sealedExport.ts](../src/lib/audit/sealedExport.ts), edge function [supabase/functions/sealed-entity-export/index.ts](../supabase/functions/sealed-entity-export/index.ts)
- Magic-link tokens for share URLs: [supabase/migrations/20260501100000_magic_link_tokens.sql](../supabase/migrations/20260501100000_magic_link_tokens.sql)
- Drafted-actions audit table: [supabase/migrations/20260427000010_drafted_actions.sql](../supabase/migrations/20260427000010_drafted_actions.sql)

### Financial precision (Tab C wave)

- AIA G702/G703 audited calculator: [src/lib/payApp/g702Audited.ts](../src/lib/payApp/g702Audited.ts), [src/lib/payApp/g703Audited.ts](../src/lib/payApp/g703Audited.ts)
- Schedule-vs-pay-app reconciliation: [src/lib/reconciliation/scheduleVsPayApp.ts](../src/lib/reconciliation/scheduleVsPayApp.ts)
- Cost-code waterfall: [src/lib/costCodes/waterfall.ts](../src/lib/costCodes/waterfall.ts)
- Lien waiver renderer: [src/lib/lienWaiver/templateRenderer.ts](../src/lib/lienWaiver/templateRenderer.ts)
- Owner pay-app preview: [supabase/functions/owner-payapp-preview/index.ts](../supabase/functions/owner-payapp-preview/index.ts) + [src/pages/share/OwnerPayAppPreview.tsx](../src/pages/share/OwnerPayAppPreview.tsx)

### Walk-through mode

- Capture flow: [src/pages/walkthrough/index.tsx](../src/pages/walkthrough/index.tsx) and [src/pages/walkthrough/SessionView.tsx](../src/pages/walkthrough/SessionView.tsx)
- Voice + Whisper: [supabase/functions/transcribe-walkthrough/index.ts](../supabase/functions/transcribe-walkthrough/index.ts), [supabase/functions/parse-walkthrough-capture/index.ts](../supabase/functions/parse-walkthrough-capture/index.ts)
- PDF export: [supabase/functions/walkthrough-pdf/index.ts](../supabase/functions/walkthrough-pdf/index.ts)

### Compliance gate (pay-app pre-submission)

- Five audit checks: [src/pages/payment-applications/auditChecks.ts](../src/pages/payment-applications/auditChecks.ts)
- Pre-submission UI: [src/pages/payment-applications/PreSubmissionAudit.tsx](../src/pages/payment-applications/PreSubmissionAudit.tsx)
- Server-side mirror: [supabase/functions/payapp-audit/index.ts](../supabase/functions/payapp-audit/index.ts)
- Override migration: [supabase/migrations/20260429020000_payapp_audit_overrides.sql](../supabase/migrations/20260429020000_payapp_audit_overrides.sql)

### COI gate

- Pure helper: [src/lib/coi/expirationGate.ts](../src/lib/coi/expirationGate.ts)
- Banner: [src/components/insurance/CoiBlockBanner.tsx](../src/components/insurance/CoiBlockBanner.tsx)
- Daily watcher: [supabase/functions/coi-expiration-watcher/index.ts](../supabase/functions/coi-expiration-watcher/index.ts)
- Migration: [supabase/migrations/20260429020001_coi_check_in_block.sql](../supabase/migrations/20260429020001_coi_check_in_block.sql)

### Notifications

- Per-user preferences: [src/lib/notifications/preferences.ts](../src/lib/notifications/preferences.ts)
- Digest rollup: [src/lib/notifications/digest.ts](../src/lib/notifications/digest.ts)
- Inbox + preferences pages: [src/pages/notifications/InboxPage.tsx](../src/pages/notifications/InboxPage.tsx), [src/pages/notifications/PreferencesPage.tsx](../src/pages/notifications/PreferencesPage.tsx)
- Migration: [supabase/migrations/20260503120001_notification_preferences.sql](../supabase/migrations/20260503120001_notification_preferences.sql)

### Iris (AI suggestion + draft)

- Suggest policy: [src/lib/iris/suggestPolicy.ts](../src/lib/iris/suggestPolicy.ts)
- Approval gate component: [src/components/iris/IrisApprovalGate.tsx](../src/components/iris/IrisApprovalGate.tsx)
- Suggestion mount component: [src/components/iris/IrisSuggests.tsx](../src/components/iris/IrisSuggests.tsx)
- Edge functions: [supabase/functions/iris-suggest/index.ts](../supabase/functions/iris-suggest/index.ts), [supabase/functions/iris-rfi-response-draft/index.ts](../supabase/functions/iris-rfi-response-draft/index.ts)

### Workflows engine (configurable state machines)

- Pure runner: [src/lib/workflows/runner.ts](../src/lib/workflows/runner.ts)
- Validators: [src/lib/workflows/validators.ts](../src/lib/workflows/validators.ts)
- Default templates: [src/lib/workflows/definitions.ts](../src/lib/workflows/definitions.ts)
- Admin builder: [src/pages/admin/workflows/index.tsx](../src/pages/admin/workflows/index.tsx)
- Migration: [supabase/migrations/20260503120000_workflow_definitions.sql](../supabase/migrations/20260503120000_workflow_definitions.sql)

### Enterprise IT (SSO, custom roles, tokens, webhooks, branding)

- SSO config table: [supabase/migrations/20260502100000_org_sso_config.sql](../supabase/migrations/20260502100000_org_sso_config.sql)
- SSO admin page: [src/pages/admin/sso/index.tsx](../src/pages/admin/sso/index.tsx)
- SCIM v2 endpoint: [supabase/functions/scim-v2/index.ts](../supabase/functions/scim-v2/index.ts)
- SAML / OIDC handlers: [supabase/functions/sso-saml-handler/index.ts](../supabase/functions/sso-saml-handler/index.ts), [supabase/functions/sso-oidc-handler/index.ts](../supabase/functions/sso-oidc-handler/index.ts)
- Custom roles: [src/lib/customRoles/index.ts](../src/lib/customRoles/index.ts), [src/pages/admin/custom-roles](../src/pages/admin/custom-roles)
- API tokens: [src/lib/apiTokens/index.ts](../src/lib/apiTokens/index.ts), [src/pages/admin/api-tokens/index.tsx](../src/pages/admin/api-tokens/index.tsx)
- Outbound webhooks: [src/lib/webhooks/index.ts](../src/lib/webhooks/index.ts), [src/pages/admin/webhooks/index.tsx](../src/pages/admin/webhooks/index.tsx)
- Org branding: [supabase/migrations/20260502100005_org_branding.sql](../supabase/migrations/20260502100005_org_branding.sql), [src/pages/admin/branding/index.tsx](../src/pages/admin/branding/index.tsx)

### Enterprise adoption (Procore import, P6, portfolio)

- Procore client + mappers: [src/lib/integrations/procore](../src/lib/integrations/procore)
- P6 XER parser/exporter: [src/lib/integrations/p6Xer](../src/lib/integrations/p6Xer)
- MS Project XML: [src/lib/integrations/msProjectXml](../src/lib/integrations/msProjectXml)
- Cost-code importers (Sage, Viewpoint, Foundation, Yardi, Spectrum): [src/lib/integrations/costCodeImporters](../src/lib/integrations/costCodeImporters)
- Portfolio rollup: [src/lib/portfolio/healthRollup.ts](../src/lib/portfolio/healthRollup.ts), [src/lib/portfolio/riskRanker.ts](../src/lib/portfolio/riskRanker.ts)
- Portfolio dashboard: [src/pages/portfolio/PortfolioDashboard.tsx](../src/pages/portfolio/PortfolioDashboard.tsx)
- Cross-project search: [src/pages/portfolio/CrossProjectSearch.tsx](../src/pages/portfolio/CrossProjectSearch.tsx), [supabase/functions/cross-project-search/index.ts](../supabase/functions/cross-project-search/index.ts)
- Project templates: [src/lib/projectTemplates](../src/lib/projectTemplates), [src/pages/admin/project-templates/index.tsx](../src/pages/admin/project-templates/index.tsx)

### Compliance computation packs

- Prevailing wage decisions: [src/lib/compliance/prevailingWage](../src/lib/compliance/prevailingWage), [supabase/migrations/20260502110000_prevailing_wage_decisions.sql](../supabase/migrations/20260502110000_prevailing_wage_decisions.sql)
- Payment / performance bonds: [src/lib/compliance/bonds](../src/lib/compliance/bonds), [supabase/migrations/20260502110001_payment_performance_bonds.sql](../supabase/migrations/20260502110001_payment_performance_bonds.sql)
- State lien rights: [src/lib/compliance/lienRights](../src/lib/compliance/lienRights), [supabase/migrations/20260502110002_state_lien_rules.sql](../supabase/migrations/20260502110002_state_lien_rules.sql)
- OSHA 300/300A: [src/lib/compliance/osha300](../src/lib/compliance/osha300)
- WH-347 generator: [src/lib/compliance/wh347](../src/lib/compliance/wh347), [src/lib/reports/wh347Pdf.ts](../src/lib/reports/wh347Pdf.ts)
- EEO-1 demographics: [supabase/migrations/20260502110003_eeo1_demographics.sql](../supabase/migrations/20260502110003_eeo1_demographics.sql)

## Wiring backlog

The earlier waves shipped pure libraries and edge functions but explicitly left certain integration points unwired so the wave was strictly additive. The following items are aggregated from each wave's "Wiring required" or "Failure modes deferred" section. Each line cites both the source doc and the file that needs to be edited.

### App.tsx route registrations

Source docs: [PLATINUM_AI_PRODUCTIVITY.md](PLATINUM_AI_PRODUCTIVITY.md), [PLATINUM_NOTIFICATIONS.md](PLATINUM_NOTIFICATIONS.md), [PLATINUM_FINANCIAL.md](PLATINUM_FINANCIAL.md), [PLATINUM_WORKFLOWS.md](PLATINUM_WORKFLOWS.md), [ENTERPRISE_ADOPTION_PACK.md](ENTERPRISE_ADOPTION_PACK.md).

Routes pending registration in [src/App.tsx](../src/App.tsx):

- `/admin/workflows` → [src/pages/admin/workflows/index.tsx](../src/pages/admin/workflows/index.tsx)
- `/notifications/inbox` → [src/pages/notifications/InboxPage.tsx](../src/pages/notifications/InboxPage.tsx)
- `/notifications/preferences` → [src/pages/notifications/PreferencesPage.tsx](../src/pages/notifications/PreferencesPage.tsx)
- `/admin/procore-import` → [src/pages/admin/procore-import](../src/pages/admin/procore-import)
- `/admin/cost-code-library` → [src/pages/admin/cost-code-library/index.tsx](../src/pages/admin/cost-code-library/index.tsx)
- `/admin/bulk-invite` → [src/pages/admin/bulk-invite](../src/pages/admin/bulk-invite)
- `/admin/project-templates` → [src/pages/admin/project-templates/index.tsx](../src/pages/admin/project-templates/index.tsx)
- `/portfolio/dashboard` → [src/pages/portfolio/PortfolioDashboard.tsx](../src/pages/portfolio/PortfolioDashboard.tsx)
- `/portfolio/search` → [src/pages/portfolio/CrossProjectSearch.tsx](../src/pages/portfolio/CrossProjectSearch.tsx)
- Public route `/share/owner-payapp` → [src/pages/share/OwnerPayAppPreview.tsx](../src/pages/share/OwnerPayAppPreview.tsx) (must NOT require Supabase auth)

### Component mounts

- Pre-submission audit not yet mounted in [src/pages/payment-applications/PayAppDetail.tsx](../src/pages/payment-applications/PayAppDetail.tsx). Source: [COMPLIANCE_GATE.md](COMPLIANCE_GATE.md).
- COI block banner not yet mounted in the crew check-in route. Source: [COMPLIANCE_GATE.md](COMPLIANCE_GATE.md).
- Iris suggestion strip not yet mounted on entity detail pages (RFI, submittal, change order, punch item, daily log). Source: [PLATINUM_AI_PRODUCTIVITY.md](PLATINUM_AI_PRODUCTIVITY.md).
- Schedule integrity issue list not yet mounted under the activity table. Source: [PLATINUM_FINANCIAL.md](PLATINUM_FINANCIAL.md).

### Service-layer integrations

- Workflow runner not yet called from entity service mutations (e.g., [src/services/rfiService.ts](../src/services/rfiService.ts), [src/services/submittalService.ts](../src/services/submittalService.ts)). Source: [PLATINUM_WORKFLOWS.md](PLATINUM_WORKFLOWS.md).
- `shouldDeliver()` not yet called before inserting into the notification queue. Source: [PLATINUM_NOTIFICATIONS.md](PLATINUM_NOTIFICATIONS.md).

### Cron schedules

The following edge functions exist but require a cron entry in `supabase/config.toml` or a pg_cron migration to run on schedule:

- [supabase/functions/coi-expiration-watcher/index.ts](../supabase/functions/coi-expiration-watcher/index.ts) — daily at 06:00 UTC. Source: [COMPLIANCE_GATE.md](COMPLIANCE_GATE.md).
- [supabase/functions/digest-flusher/index.ts](../supabase/functions/digest-flusher/index.ts) — every 5 minutes. Source: [PLATINUM_NOTIFICATIONS.md](PLATINUM_NOTIFICATIONS.md).
- [supabase/functions/portfolio-summary-refresh/index.ts](../supabase/functions/portfolio-summary-refresh/index.ts) — every 5 minutes. Cron migration already shipped at [supabase/migrations/20260502130000_portfolio_summary_refresh_cron.sql](../supabase/migrations/20260502130000_portfolio_summary_refresh_cron.sql); confirm `CRON_SECRET` is set in production.

### Procore import worker

The per-entity Procore migration worker is scaffolded but the inline ProcoreClient inside Deno isn't fully wired — the pure mappers in [src/lib/integrations/procore](../src/lib/integrations/procore) need to be vendored under `supabase/functions/shared/`. Source: [ENTERPRISE_ADOPTION_PACK.md](ENTERPRISE_ADOPTION_PACK.md).

### Lien waiver legal review

All five lien-waiver template bodies in [src/lib/lienWaiver/templates](../src/lib/lienWaiver/templates) contain a `[TODO_LEGAL_REVIEW]` placeholder. Counsel must approve verbatim statutory text before exchange with subs in production. Mechanical fields (sub name, project, period, amount, signature block) are correct. Source: [PLATINUM_FINANCIAL.md](PLATINUM_FINANCIAL.md).

## Stubbed or absent

Per [HONEST_STATE.md](../HONEST_STATE.md):

- Bitemporal data (valid_time / transaction_time): not present
- Causal graphs: foreign keys only
- Event sourcing: `audit_log` table is the closest approximation, not a true event store
- Sub portal with free tier: not built
- Embedded fintech beyond Stripe primitive wiring: workflows absent
- MCP server: not built
- WebGPU BIM: Three.js present, no GPU path

## Pre-existing doc debt

The link checker [scripts/check-doc-links.ts](../scripts/check-doc-links.ts) flags four citations in earlier-wave docs that point at files that have not yet been added:

- A check-in page under src/pages/site/ — referenced from [COMPLIANCE_GATE.md](COMPLIANCE_GATE.md). The COI banner has no host route yet.
- A restore-sanity script under scripts/ — referenced from [DR_RUNBOOK.md](DR_RUNBOOK.md) and PLATINUM_PERFORMANCE.md. The DR drill workflow is configured but the sanity-check script is a TODO.
- A shared snapshotLoader under supabase/functions/shared/ — referenced from [PLATINUM_AI_PRODUCTIVITY.md](PLATINUM_AI_PRODUCTIVITY.md). The shared snapshot loader is a future refactor when multiple edge functions need the same snapshot bundle.

These pre-date this wave and are flagged here so the link checker's CI run is not surprising.
