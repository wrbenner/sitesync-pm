# User Guide — Index

SiteSync PM is structured around five top-level verbs ("The Day", "The Field", "The Conversation", "The Set", "The Site") rather than a flat noun list. The thesis is documented in [docs/THE_FIVE.md](../THE_FIVE.md).

This index points you at the role-specific guide for what you do day-to-day. Pick yours:

- [SUPER_GUIDE.md](SUPER_GUIDE.md) — site superintendent or foreman; you live in The Day and The Field
- [PM_GUIDE.md](PM_GUIDE.md) — project manager; you orchestrate The Conversation and The Site
- [COMPLIANCE_OFFICER_GUIDE.md](COMPLIANCE_OFFICER_GUIDE.md) — risk and insurance owner; you live in COIs, lien waivers, and pay-app gates
- [EXEC_GUIDE.md](EXEC_GUIDE.md) — portfolio executive; you read the rollup
- [IT_ADMIN_GUIDE.md](IT_ADMIN_GUIDE.md) — IT and identity admin; you keep SSO, SCIM, and tokens healthy

If you are an organization admin standing up SiteSync for the first time, start with [admin/ONBOARDING.md](../admin/ONBOARDING.md) instead.

## The five verbs (cheat sheet)

Per [docs/THE_FIVE.md](../THE_FIVE.md), every legacy noun page maps into one of:

| Verb | What it answers |
| --- | --- |
| The Day | What do I need to do right now? |
| The Field | What happened on site? |
| The Conversation | What is waiting on a person? |
| The Set | What does the building look like? |
| The Site | What is the state of the project? |

RFIs, submittals, change orders, and other contractual artifacts retain their dedicated routes (e.g., `/rfis`) and numbering — they are filtered views inside The Conversation, not replacements.

## Iris (the AI assistant)

Iris is not a tab; it is a layer over every page. The suggestion mount is [src/components/iris/IrisSuggests.tsx](../../src/components/iris/IrisSuggests.tsx); the approval flow is [src/components/iris/IrisApprovalGate.tsx](../../src/components/iris/IrisApprovalGate.tsx). Iris drafts; humans approve. Nothing moves on Iris's authority alone — see the audit-trail design in [docs/HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md).

## Mobile and offline

SiteSync runs as a web app, an iOS app, and an Android app via Capacitor. The native shortcuts and deep links are in [src/lib/native](../../src/lib/native). The offline queue is in [src/lib/offlineQueue.ts](../../src/lib/offlineQueue.ts) and [src/lib/offlineDb.ts](../../src/lib/offlineDb.ts).
