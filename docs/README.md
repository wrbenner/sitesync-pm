# SiteSync PM — Documentation

This directory holds the operational, onboarding, and compliance docs for SiteSync PM. Earlier waves added focused engineering docs (financial precision, workflows, notifications, AI productivity); this wave adds the runbook layer that ties the codebase to humans — admins onboarding their org, end-users by role, on-call engineers keeping the service up, and compliance officers preparing for an audit.

Every functional claim in every doc cites a real file in this repository. The script [scripts/check-doc-links.ts](../scripts/check-doc-links.ts) enforces that rule on every PR via [.github/workflows/docs-check.yml](../.github/workflows/docs-check.yml).

## How to navigate

- New here? Start with [STATUS.md](STATUS.md) for the honest state of the system.
- Onboarding a new SiteSync customer? Start with [admin/ONBOARDING.md](admin/ONBOARDING.md).
- Looking for the user guide for your role? See [Users](#users).
- On-call this week? See [operations/ONCALL.md](operations/ONCALL.md) and [operations/INCIDENT_RESPONSE.md](operations/INCIDENT_RESPONSE.md).
- Auditor visit? See [compliance/SOC2_EVIDENCE_PACK.md](compliance/SOC2_EVIDENCE_PACK.md).

## Top-level docs

- [STATUS.md](STATUS.md) — what is shipped, what is wiring-pending, what is stub
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to add and update docs

## Admin onboarding

- [admin/ONBOARDING.md](admin/ONBOARDING.md) — first-day playbook for a new organization
- [admin/SSO_SETUP.md](admin/SSO_SETUP.md) — SAML and OIDC configuration
- [admin/PROJECT_TEMPLATES.md](admin/PROJECT_TEMPLATES.md) — capture and re-use a project's structural shape
- [admin/CUSTOM_ROLES.md](admin/CUSTOM_ROLES.md) — define roles and per-project overrides

## Users

- [users/USER_GUIDE.md](users/USER_GUIDE.md) — index for all role guides
- [users/SUPER_GUIDE.md](users/SUPER_GUIDE.md) — site superintendent
- [users/PM_GUIDE.md](users/PM_GUIDE.md) — project manager
- [users/COMPLIANCE_OFFICER_GUIDE.md](users/COMPLIANCE_OFFICER_GUIDE.md) — risk and insurance officer
- [users/EXEC_GUIDE.md](users/EXEC_GUIDE.md) — portfolio executive
- [users/IT_ADMIN_GUIDE.md](users/IT_ADMIN_GUIDE.md) — IT and identity admin

## Business

- [business/PRICING.md](business/PRICING.md) — tier structure (prices TBD)
- [business/SLA.md](business/SLA.md) — target service-level commitments
- [business/DEMO_SCRIPT.md](business/DEMO_SCRIPT.md) — guided demo flow
- [business/COMPETITIVE.md](business/COMPETITIVE.md) — positioning vs Procore

## Operations

- [operations/DEPLOY.md](operations/DEPLOY.md) — release process
- [operations/MONITORING.md](operations/MONITORING.md) — what to watch
- [operations/DR.md](operations/DR.md) — disaster recovery
- [operations/ONCALL.md](operations/ONCALL.md) — on-call rotation duties
- [operations/INCIDENT_RESPONSE.md](operations/INCIDENT_RESPONSE.md) — sev classification and runbooks

## Compliance

- [compliance/SOC2_EVIDENCE_PACK.md](compliance/SOC2_EVIDENCE_PACK.md) — controls and evidence
- [compliance/GDPR_POSTURE.md](compliance/GDPR_POSTURE.md) — data subject rights, processors, retention
- [compliance/HASH_CHAIN_CERT.md](compliance/HASH_CHAIN_CERT.md) — audit-log tamper-evidence properties

## Engineering reference

The reference below is auto-generated from the source tree. Run `npx tsx scripts/generate-doc-index.ts` to regenerate it. Also see prior-wave engineering docs in this directory:

- [THE_FIVE.md](THE_FIVE.md) — navigation thesis (verbs over nouns)
- [COMPLIANCE_GATE.md](COMPLIANCE_GATE.md) — pay-app pre-submission audit + COI gate
- [PLATINUM_FINANCIAL.md](PLATINUM_FINANCIAL.md) — money discipline and AIA precision
- [PLATINUM_WORKFLOWS.md](PLATINUM_WORKFLOWS.md) — configurable state machines
- [PLATINUM_NOTIFICATIONS.md](PLATINUM_NOTIFICATIONS.md) — preferences, DND, digest
- [PLATINUM_AI_PRODUCTIVITY.md](PLATINUM_AI_PRODUCTIVITY.md) — Iris suggestions, doc gen, confidence gate
- [WALKTHROUGH_MODE.md](WALKTHROUGH_MODE.md) — voice-driven punch capture
- [ENTERPRISE_ADOPTION_PACK.md](ENTERPRISE_ADOPTION_PACK.md) — Procore import, P6, portfolio
- [HASH_CHAIN_INVARIANTS.md](HASH_CHAIN_INVARIANTS.md) — audit-log invariants
- [DAILY_LOG_AUTO_DRAFT.md](DAILY_LOG_AUTO_DRAFT.md)
- [RFI_TO_CO_AUTO_DRAFT.md](RFI_TO_CO_AUTO_DRAFT.md)
- [LINKAGE_ENGINE.md](LINKAGE_ENGINE.md)
- [SEARCH_ARCHITECTURE.md](SEARCH_ARCHITECTURE.md)
- [SLA_ESCALATION.md](SLA_ESCALATION.md)
- [API_V1_CONTRACT.md](API_V1_CONTRACT.md)
- [EMAIL_IN.md](EMAIL_IN.md)

<!-- AUTO:engineering-reference:start -->
<!-- Run `npx tsx scripts/generate-doc-index.ts` to populate this section. -->
<!-- AUTO:engineering-reference:end -->
