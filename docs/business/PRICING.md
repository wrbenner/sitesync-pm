# Pricing

> **Prices are TBD.** This document records the tier structure, the SKUs, and the feature mapping. The CFO sets the dollar figures; do not insert numbers here without their approval.

## Tier structure

Per the product spec, SiteSync ships in three tiers:

| Tier | Audience | Price | Status |
| --- | --- | --- | --- |
| Field | Subcontractor field team; read + capture only | TBD (free preferred per spec) | Not yet packaged |
| Pro | GC project teams; full functional surface | TBD | Default tier |
| Enterprise | Multi-org, IT-controlled, audit-ready | TBD | Available with sales contact |

## Feature mapping

What gates which tier:

### Field (free)

- Mobile capture (photo, voice, GPS)
- View RFIs and submittals where the user is a recipient or watcher
- Daily log entry for the user's own crew time
- Push notifications for items waiting on the user

Implementation surfaces: [src/lib/native](../../src/lib/native), [src/lib/voiceProcessor.ts](../../src/lib/voiceProcessor.ts), [src/pages/daily-log/index.tsx](../../src/pages/daily-log/index.tsx).

### Pro

Everything in Field, plus:

- Full RFI / submittal / change-order / pay-app workflows
- Daily log signing and revisions ([supabase/migrations/20260501110001_daily_log_revisions.sql](../../supabase/migrations/20260501110001_daily_log_revisions.sql))
- Pay-app pre-submission audit ([src/pages/payment-applications/auditChecks.ts](../../src/pages/payment-applications/auditChecks.ts))
- Schedule integrity checks ([src/lib/schedule/integrityCheck.ts](../../src/lib/schedule/integrityCheck.ts))
- Schedule-vs-pay-app reconciliation ([src/lib/reconciliation/scheduleVsPayApp.ts](../../src/lib/reconciliation/scheduleVsPayApp.ts))
- Lien waiver generator ([src/lib/lienWaiver/templateRenderer.ts](../../src/lib/lienWaiver/templateRenderer.ts))
- Iris drafted suggestions ([src/lib/iris/suggestPolicy.ts](../../src/lib/iris/suggestPolicy.ts))
- Walk-through mode ([src/pages/walkthrough/index.tsx](../../src/pages/walkthrough/index.tsx))
- Document generators (monthly report, owner digest, meeting minutes, closeout package) — see [src/lib/documentGen](../../src/lib/documentGen)

### Enterprise

Everything in Pro, plus:

- SSO + SCIM ([supabase/functions/sso-saml-handler/index.ts](../../supabase/functions/sso-saml-handler/index.ts), [supabase/functions/scim-v2/index.ts](../../supabase/functions/scim-v2/index.ts))
- Custom roles + per-project overrides ([src/lib/customRoles/index.ts](../../src/lib/customRoles/index.ts))
- API tokens + REST contract ([docs/API_V1_CONTRACT.md](../API_V1_CONTRACT.md))
- Outbound webhooks ([src/pages/admin/webhooks/index.tsx](../../src/pages/admin/webhooks/index.tsx))
- Org branding ([supabase/migrations/20260502100005_org_branding.sql](../../supabase/migrations/20260502100005_org_branding.sql))
- Procore + P6 + MS Project + Sage/Viewpoint/Foundation/Yardi/Spectrum import ([src/lib/integrations](../../src/lib/integrations))
- Portfolio rollup + cross-project search ([src/lib/portfolio](../../src/lib/portfolio), [supabase/functions/cross-project-search/index.ts](../../supabase/functions/cross-project-search/index.ts))
- Project templates ([src/lib/projectTemplates](../../src/lib/projectTemplates))
- Customer S3 export ([supabase/functions/customer-s3-export/index.ts](../../supabase/functions/customer-s3-export/index.ts))
- Sealed entity export ([src/lib/audit/sealedExport.ts](../../src/lib/audit/sealedExport.ts))
- Hash-chain attestation ([compliance/HASH_CHAIN_CERT.md](../compliance/HASH_CHAIN_CERT.md))
- Contractual SLAs ([SLA.md](SLA.md)) — only with an executed enterprise agreement

## SKUs

The CFO will fill these in. Suggested structure per [HONEST_STATE.md](../../HONEST_STATE.md) and the spec:

| SKU | Tier | Billing axis |
| --- | --- | --- |
| `field` | Field | Per active user per month — free |
| `pro` | Pro | Per active user per month |
| `pro-project` | Pro | Per project per month |
| `enterprise` | Enterprise | Per organization with seat tiers |
| `enterprise-add-on-byok` | Enterprise | Bring-your-own-key encryption |
| `enterprise-add-on-residency` | Enterprise | Customer-specified Supabase region |
| `enterprise-add-on-extended-pitr` | Enterprise | Extended PITR window beyond 28 days (see [DR_RUNBOOK.md](../DR_RUNBOOK.md)) |

## Billing infrastructure

The Stripe integration is wired but the workflows around it are not complete per [HONEST_STATE.md](../../HONEST_STATE.md). Edge functions present:

- [supabase/functions/billing-create-customer/index.ts](../../supabase/functions/billing-create-customer/index.ts)
- [supabase/functions/billing-create-invoice/index.ts](../../supabase/functions/billing-create-invoice/index.ts)
- [supabase/functions/billing-payment-method/index.ts](../../supabase/functions/billing-payment-method/index.ts)
- [supabase/functions/billing-process-payment/index.ts](../../supabase/functions/billing-process-payment/index.ts)
- [supabase/functions/stripe-webhook/index.ts](../../supabase/functions/stripe-webhook/index.ts)

Until billing workflows are tied to subscription state, prices charged to customers are negotiated manually per contract.

## What is NOT in pricing

- We do not charge for the API itself; rate-limited usage is included in Pro and Enterprise.
- We do not currently charge for AI usage. AI cost is bundled into the seat price. See [PLATINUM_AI_PRODUCTIVITY.md](../PLATINUM_AI_PRODUCTIVITY.md) for what triggers AI calls.
- We do not charge for the free Field tier even when it consumes mobile push and modest storage.

## Discounts

The pricing matrix above is for self-serve. Negotiated enterprise pricing is governed by the executed master service agreement.
