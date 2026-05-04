# SOC 2 Evidence Pack

> SiteSync PM is **NOT SOC 2 certified**. This document describes controls aligned with SOC 2 (Trust Services Criteria) and the evidence available to support an auditor visit. A SOC 2 Type II attestation report requires an actual audit by a qualified firm; this pack is the artifact you bring to that audit, not a replacement for it.

## Purpose

When an auditor or a customer's CISO asks "show me your evidence for control X," this pack is the answer. Each control names the implementation file or migration that produces the evidence.

## Trust Services Criteria — controls coverage

### CC1 — Control Environment

The team's policy and governance documents:

- [SECURITY.md](../../SECURITY.md) — security policy
- [GOVERNANCE.md](../../GOVERNANCE.md) — governance
- [DECISIONS.md](../../DECISIONS.md) — architectural decision log

### CC2 — Communication and Information

- Customer communication during incidents follows [docs/operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md).
- Internal change communication is via PR descriptions; the link checker ([scripts/check-doc-links.ts](../../scripts/check-doc-links.ts)) and the docs-check workflow ([.github/workflows/docs-check.yml](../../.github/workflows/docs-check.yml)) enforce documentation accuracy on every PR.

### CC3 — Risk Assessment

- The risk engine for project-level risk: [src/lib/riskEngine.ts](../../src/lib/riskEngine.ts).
- Portfolio-level risk: [src/lib/portfolio/riskRanker.ts](../../src/lib/portfolio/riskRanker.ts).
- Security audit log: [docs/SECURITY_AUDIT_2026_04_24.md](../SECURITY_AUDIT_2026_04_24.md).

### CC4 — Monitoring Activities

| Activity | Evidence |
| --- | --- |
| Continuous monitoring | [docs/operations/MONITORING.md](../operations/MONITORING.md) |
| Frontend error tracking | [src/lib/sentry.ts](../../src/lib/sentry.ts) |
| AI cost / behavior tracking | [src/lib/aiObservability.ts](../../src/lib/aiObservability.ts) |
| Audit chain integrity (continuous) | [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql), verifier [src/lib/audit/hashChainVerifier.ts](../../src/lib/audit/hashChainVerifier.ts) |
| Performance regression | [src/lib/perf/queryRegression.ts](../../src/lib/perf/queryRegression.ts) |

### CC5 — Control Activities

| Activity | Evidence |
| --- | --- |
| Code review on every change | branch protection enforced in repo config; review evidence in PR history |
| Unit + integration tests | [.github/workflows/test.yml](../../.github/workflows/test.yml) |
| Documentation accuracy gate | [.github/workflows/docs-check.yml](../../.github/workflows/docs-check.yml) |
| Performance gate | [.github/workflows/perf.yml](../../.github/workflows/perf.yml) |

### CC6 — Logical and Physical Access Controls

- Authentication: Supabase Auth + optional SSO ([supabase/functions/sso-saml-handler/index.ts](../../supabase/functions/sso-saml-handler/index.ts), [supabase/functions/sso-oidc-handler/index.ts](../../supabase/functions/sso-oidc-handler/index.ts)).
- Authorization: per-table RLS — see migrations [00033](../../supabase/migrations/00033_rls_permission_enforcement.sql), [00043](../../supabase/migrations/00043_complete_rls_enforcement.sql), [00049](../../supabase/migrations/00049_project_membership_rls_select.sql), [00050](../../supabase/migrations/00050_projects_org_membership_rls.sql), [00052](../../supabase/migrations/00052_enable_rls.sql).
- Custom roles: [src/lib/customRoles/index.ts](../../src/lib/customRoles/index.ts), [supabase/migrations/20260502100001_org_custom_roles.sql](../../supabase/migrations/20260502100001_org_custom_roles.sql).
- API tokens (machine-to-machine): [src/lib/apiTokens/index.ts](../../src/lib/apiTokens/index.ts), [supabase/migrations/20260502100003_org_api_tokens.sql](../../supabase/migrations/20260502100003_org_api_tokens.sql).
- Production write access: limited to two engineers via quarterly-rotated short-lived tokens — see [docs/DR_RUNBOOK.md](../DR_RUNBOOK.md).

### CC7 — System Operations

- Deploy procedure: [docs/operations/DEPLOY.md](../operations/DEPLOY.md).
- Incident response: [docs/operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md).
- On-call: [docs/operations/ONCALL.md](../operations/ONCALL.md).
- DR: [docs/operations/DR.md](../operations/DR.md), [docs/DR_RUNBOOK.md](../DR_RUNBOOK.md).
- Monthly DR drill: [.github/workflows/restore-drill.yml](../../.github/workflows/restore-drill.yml).

### CC8 — Change Management

- Migrations are timestamp-prefixed and idempotent (every wave's doc enforces this; see e.g., [docs/PLATINUM_FINANCIAL.md](../PLATINUM_FINANCIAL.md)).
- Workflow definitions are versioned per [supabase/migrations/20260503120000_workflow_definitions.sql](../../supabase/migrations/20260503120000_workflow_definitions.sql); editing creates a new version, never mutates the old one. In-flight items pin the version they started under.
- Code changes pass through PR review and CI gates documented in [DEPLOY.md](../operations/DEPLOY.md).

### CC9 — Risk Mitigation

- Backups: Supabase-managed nightly snapshots + WAL archive — see [DR.md](../operations/DR.md).
- Customer-controlled export option: [supabase/functions/customer-s3-export/index.ts](../../supabase/functions/customer-s3-export/index.ts), [supabase/migrations/20260503110004_org_s3_export_config.sql](../../supabase/migrations/20260503110004_org_s3_export_config.sql).
- Sealed entity export for legal hold: [src/lib/audit/sealedExport.ts](../../src/lib/audit/sealedExport.ts), [supabase/functions/sealed-entity-export/index.ts](../../supabase/functions/sealed-entity-export/index.ts).

## Evidence catalog

The auditor will ask for these artifacts. Each is reproducible on demand from the cited file.

| Evidence | How to produce |
| --- | --- |
| Audit log hash-chain integrity report for a date range | Call `verify_audit_chain(start_after)` per [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql) |
| RLS policy enumeration | `SELECT * FROM pg_policies` in Supabase SQL editor |
| Active workflow definitions and versions | `SELECT * FROM workflow_definitions` per [supabase/migrations/20260503120000_workflow_definitions.sql](../../supabase/migrations/20260503120000_workflow_definitions.sql) |
| Pay-app override audit | `SELECT * FROM payapp_audit_overrides` per [supabase/migrations/20260429020000_payapp_audit_overrides.sql](../../supabase/migrations/20260429020000_payapp_audit_overrides.sql) |
| COI expiration alert log | `SELECT * FROM coi_expiration_alerts` per [supabase/migrations/20260429020001_coi_check_in_block.sql](../../supabase/migrations/20260429020001_coi_check_in_block.sql) |
| Account deletion tombstones | [supabase/migrations/20260427000001_account_deletion_events.sql](../../supabase/migrations/20260427000001_account_deletion_events.sql) |
| Drafted-action approvals (Iris audit trail) | [supabase/migrations/20260427000010_drafted_actions.sql](../../supabase/migrations/20260427000010_drafted_actions.sql) |
| Sealed entity export with timestamp + signer | [src/lib/audit/sealedExport.ts](../../src/lib/audit/sealedExport.ts) |
| Per-user notification preferences (proves consent for digest) | [supabase/migrations/20260503120001_notification_preferences.sql](../../supabase/migrations/20260503120001_notification_preferences.sql) |
| Lien waiver content hashes (proves the signed body has not drifted) | [supabase/migrations/20260501120001_lien_waiver_signatures.sql](../../supabase/migrations/20260501120001_lien_waiver_signatures.sql) |

## What is NOT in this pack

- **A SOC 2 Type I or Type II attestation letter.** That is issued by an audit firm, not by the engineering team.
- **Penetration test reports.** Schedule with a third-party firm; the most recent self-audit is at [docs/SECURITY_AUDIT_2026_04_24.md](../SECURITY_AUDIT_2026_04_24.md).
- **Vendor / sub-processor list.** Maintain separately. The primary sub-processors are Supabase (Postgres, Storage, Auth) and the deployment host.
- **Encryption-at-rest attestation.** Inherited from Supabase platform; refer the auditor to Supabase's published attestation.

## How to use this pack with an auditor

1. Send them this document plus [GDPR_POSTURE.md](GDPR_POSTURE.md) and [HASH_CHAIN_CERT.md](HASH_CHAIN_CERT.md) ahead of the audit.
2. Pre-pull the evidence artifacts in the catalog table.
3. Show them the audit chain verifier output for a non-trivial window.
4. Walk them through the deploy + incident-response runbooks ([DEPLOY.md](../operations/DEPLOY.md), [INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md)).
5. Demonstrate the override-write flow (PM bypassing the pay-app audit) so the auditor sees the override is recorded with a reason and the user.
