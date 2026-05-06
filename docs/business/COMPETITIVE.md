# Competitive Positioning

This doc is sales enablement, not engineering. Every claim about SiteSync's behavior cites the file that implements it. Claims about competitors are based on publicly documented behavior; do not extrapolate.

## The headline difference

SiteSync's navigation is built around verbs ("what am I doing right now?"), not the legacy noun list (RFI / Submittal / CO / Drawing / Schedule / ...). The thesis is documented in [docs/THE_FIVE.md](../THE_FIVE.md). Procore's nav has 30+ top-level nouns; SiteSync's has 5 verbs. The contractual artifacts (RFIs, submittals) keep their dedicated routes and numbering — they are filters inside the verbs, not replacements.

## Where SiteSync is differentiated

### 1. Pay app pre-submission audit (vs Procore)

The five deterministic checks in [src/pages/payment-applications/auditChecks.ts](../../src/pages/payment-applications/auditChecks.ts) prevent the pay-app rejection failure mode. Procore has individual modules for invoicing, lien waivers, and insurance, but does not gate submission on a deterministic cross-module audit. SiteSync's gate is mirrored server-side at [supabase/functions/payapp-audit/index.ts](../../supabase/functions/payapp-audit/index.ts), so a forged UI cannot bypass it.

### 2. Hash-chained audit log (vs everyone)

The audit log is hash-chained per [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql) and the invariants in [docs/HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md). A tampered row is provably altered without external attestation. The verifier is [src/lib/audit/hashChainVerifier.ts](../../src/lib/audit/hashChainVerifier.ts). Procore's audit trail is event-logged but not chain-verified.

### 3. Walk-through mode (vs the recorder you use today)

[src/pages/walkthrough/index.tsx](../../src/pages/walkthrough/index.tsx) collapses 4 hours walking + 2 days of cleanup into 4 hours + 30 minutes per [docs/WALKTHROUGH_MODE.md](../WALKTHROUGH_MODE.md). Voice + photo + GPS at the press of one button; Whisper transcribes; Sonnet structures; PM batch-reviews. Procore doesn't have a punch-walk-specific capture mode; supers use the camera plus a paper notebook.

### 4. Reconciled-to-the-penny financial discipline

Round-half-to-even on integer cents per [docs/PLATINUM_FINANCIAL.md](../PLATINUM_FINANCIAL.md). The audited calculator is [src/lib/payApp/g702Audited.ts](../../src/lib/payApp/g702Audited.ts). G703 line totals reconcile to the G702 header to ≤ $1 by construction. Float drift between modules is explicitly named in [HONEST_STATE.md](../../HONEST_STATE.md) and gated by the audited calculator on the dispute path.

### 5. Iris (drafts, never acts)

Iris's policy is [src/lib/iris/suggestPolicy.ts](../../src/lib/iris/suggestPolicy.ts). Up to three drafts per entity, frequency-throttled per user, 24h dedup. Every draft routes through the approval gate at [src/components/iris/IrisApprovalGate.tsx](../../src/components/iris/IrisApprovalGate.tsx) and writes to the drafted_actions audit table per [supabase/migrations/20260427000010_drafted_actions.sql](../../supabase/migrations/20260427000010_drafted_actions.sql) before any side effect. Procore's "Construction Intelligence" is a chat layer; SiteSync's Iris is an action-drafter inside the workflows people are already in.

### 6. Procore migration tool (vs Procore lock-in)

[src/lib/integrations/procore](../../src/lib/integrations/procore) plus [src/pages/admin/procore-import](../../src/pages/admin/procore-import) lets a customer move off Procore in days, not quarters. Provenance is preserved on every imported row via `external_ids` ([supabase/migrations/20260502120000_external_ids.sql](../../supabase/migrations/20260502120000_external_ids.sql)) and `legacy_payload` ([supabase/migrations/20260502120001_legacy_payload.sql](../../supabase/migrations/20260502120001_legacy_payload.sql)).

The Procore worker is scaffolded but not wired end-to-end (see [STATUS.md](../STATUS.md) wiring backlog). Pure mappers and HTTP client are complete and tested.

### 7. Configurable workflows (vs hardcoded state machines)

[src/lib/workflows/runner.ts](../../src/lib/workflows/runner.ts) is a pure, deterministic state-machine runner. Org admins author workflows in [src/pages/admin/workflows/index.tsx](../../src/pages/admin/workflows/index.tsx). Versioning is enforced; in-flight items pin the version they started under. Procore's RFI/submittal workflows are configurable to a degree but not version-pinned per item.

### 8. Custom roles + per-project overrides (vs flat role table)

[src/lib/customRoles/index.ts](../../src/lib/customRoles/index.ts) and [supabase/migrations/20260502100002_per_project_role_overrides.sql](../../supabase/migrations/20260502100002_per_project_role_overrides.sql) let an org carve out roles like "Compliance Officer reads everything but writes only insurance and waivers."

### 9. Owner pay-app preview by magic link (vs the owner needing an account)

[src/pages/share/OwnerPayAppPreview.tsx](../../src/pages/share/OwnerPayAppPreview.tsx) and [supabase/functions/owner-payapp-preview/index.ts](../../supabase/functions/owner-payapp-preview/index.ts) — magic-link tokens with hash-in-DB validation. The owner reviews; the GC closes faster.

## Where SiteSync is honestly behind

These are documented in [HONEST_STATE.md](../../HONEST_STATE.md) and reflected in [STATUS.md](../STATUS.md):

- **Bundle size** is 1.87 MB (target: 500 KB en route to 250 KB). First-load is slower than Procore on a thin connection.
- **Some action buttons aren't role-gated in the UI.** RLS at the database stops actual writes, but the buttons render. PermissionGate is the design pattern; uniform application is in progress.
- **Several pages are stubs** (Vision, TimeMachine, Marketplace, Sustainability) — UI without backend logic. We're shipping subtraction not addition.
- **AI is infrastructure, not UX.** Iris drafts work, but cross-project AI insights and the proactive insight surface aren't widely deployed yet.
- **Mobile native** runs via Capacitor. iOS submission is in progress per the team's notes; Android is similar status.

## What we will NOT promise in a pitch

- SOC 2 Type II certification (we have controls; certification requires an audit — see [compliance/SOC2_EVIDENCE_PACK.md](../compliance/SOC2_EVIDENCE_PACK.md))
- 99.999% availability (target is 99.95% on Enterprise; see [SLA.md](SLA.md))
- Dollar prices (TBD; see [PRICING.md](PRICING.md))
- Specific volume of AI suggestions per day (depends on data shape)
- Free tier with full functionality (Field tier is intentionally read + capture only)

## What kills a deal we should walk

- They require live consolidation across multiple SiteSync orgs — not modeled.
- They require BIM with WebGPU — Three.js is wired but the GPU path isn't.
- They want SiteSync to be a fintech (originate loans / hold escrow). Stripe primitives are wired; full embedded fintech is not.

## Anchors and proof points

- The Conversation inbox: see [PM_GUIDE.md](../users/PM_GUIDE.md)
- The Pre-submission audit: see [COMPLIANCE_OFFICER_GUIDE.md](../users/COMPLIANCE_OFFICER_GUIDE.md)
- The Walk-through mode: see [SUPER_GUIDE.md](../users/SUPER_GUIDE.md)
- The Portfolio rollup: see [EXEC_GUIDE.md](../users/EXEC_GUIDE.md)
- The Procore import: see [admin/ONBOARDING.md](../admin/ONBOARDING.md)
