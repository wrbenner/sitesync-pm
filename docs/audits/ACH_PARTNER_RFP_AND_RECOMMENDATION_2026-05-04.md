# ACH Partner RFP + Recommendation

**Date:** 2026-05-04
**Status:** Spec ready. Walker takes Modern Treasury negotiation to first call this week. Backup negotiation with Increase runs in parallel.
**Includes ADR-011 inline:** Modern Treasury chosen with Alloy KYB + First-Citizens or Cross River bank partner.
**Companion:** `EMBEDDED_PAYMENTS_V0_ARCHITECTURE_SPEC` (forthcoming — built on the partner stack chosen here)
**Format reference:** `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`

---

## TL;DR

**Recommendation:** Sign with **Modern Treasury** as the orchestration layer + **Alloy** for KYB + **First-Citizens or Cross River** as the underlying bank partner. Total monthly run-rate at 50 GCs × 3 projects = ~$8-12K platform fees + ~$0.10-0.25 per ACH origination. Adaptive (construction back-office) is the most-relevant precedent.

**Backup:** **Increase** as a single-bank API alternative if MT contracting hits a wall (cost-sensitive, faster to launch, weaker reconciliation). Negotiate in parallel — not waste of time, leverage.

**Decision deadline:** Term sheet from MT by **June 1, 2026.** Bank partner onboarding starts June 15. First sandbox push by Sept 1. Production push capability by Dec 1. First real GC pay-app push: April 1, 2027 (target compresses to March 1 with discipline).

---

## Why Modern Treasury (the strategic case)

Construction GC-to-sub payment flow is **high-value, low-volume, reconciliation-heavy, audit-sensitive.** That description matches Modern Treasury's product better than any of the four candidates:

- **Average pay-app size**: $50K-$500K (vs. consumer ACH typically <$1K)
- **Volume**: a 100-GC customer base × 5 projects × 4 pay-apps/month = 2,000 transactions/month at year 2 scale (modest)
- **Reconciliation**: every bank transaction maps back to a specific pay app + a specific lien waiver state + a specific audit chain row. Penny-perfect reconciliation is a launch requirement, not a nice-to-have.
- **Audit-sensitive**: the hash-chain audit log records every money-movement event. Provenance must be inviolate.

Modern Treasury was built for exactly this shape. Their `expected_payments` engine + reconciliation tooling is the strongest in the embedded-finance category specifically because it was built for vertical SaaS that sees lumpy, large, audit-sensitive flows. That's the reason **Adaptive** (a construction back-office SaaS) chose them — and Adaptive is the most directly-comparable precedent.

The four-candidate research consensus:

| Candidate | Verdict | Reason |
|---|---|---|
| **Modern Treasury** | ✅ Chosen | Vertical-SaaS focus + reconciliation engine + multi-bank optionality + Adaptive precedent |
| **Increase** | 🟡 Backup | Cost-effective + clean API + fast to launch, but single-bank risk and you build the ledger yourself |
| **Stripe Treasury** | ❌ Rejected | Stripe risk team freezes accounts on construction-volume patterns (lumpy, large, slow). Adoption pulled back post-Evolve issues. |
| **Dwolla** | ❌ Rejected | KYB long-tail handling weakest of the four; messy LLC sub paperwork is exactly the edge case Dwolla mishandles |

---

## ADR-011 — The Stack Choice

**Decision:** Modern Treasury + Alloy + First-Citizens (primary) or Cross River (secondary). Reserve right to swap bank partner in year 2 without changing app code (multi-rail abstraction per `EMBEDDED_PAYMENTS_V0_ARCHITECTURE_SPEC`).

### Why each layer

**Modern Treasury (orchestration):**
- API surface for ACH (same-day + standard), wires, virtual accounts, ledgering
- `expected_payments` reconciliation engine — match bank statement entries back to invoices automatically
- Bank-partner-agnostic at the contract level (we can move banks without rewriting code)
- SOC 2 Type II + ISO 27001
- Direct precedent: Adaptive (construction back-office)

**Alloy (KYB):**
- Sub-side KYB is qualitatively different from consumer KYC. Subs are LLCs with messy paperwork; the long-tail handling matters.
- Alloy's policy-engine approach lets us configure escalation paths (auto-approve clean → manual review borderline → reject high-risk) instead of binary pass/fail.
- BYO from Modern Treasury's perspective; we own the configuration.

**First-Citizens (primary bank partner):**
- Acquired SVB's commercial banking operation in 2023; depth in B2B vertical SaaS
- Known to work cleanly with Modern Treasury (one of MT's main bank partners)
- Reasonable balance requirements ($250K-$500K typical, may be lower for an early-stage startup)

**Cross River (secondary / failover):**
- Banking-as-a-service specialist
- Stronger fintech credentials (works with Affirm, Coinbase, MoneyLion historically)
- Higher cost than First-Citizens but better tooling for novel use cases

**Why two banks?** SVB-failure protection. The whole point of going through Modern Treasury (rather than direct-to-bank) is the optionality. We sign with First-Citizens primary; have Cross River as documented secondary failover; can hot-swap in <30 days if needed.

---

## RFP Scoring Framework

For Walker's calls with Modern Treasury (and parallel call with Increase), score each on 0-5 across these dimensions.

### Pricing (target: low-mid range)

| Item | MT Expected | Increase Expected | Walker Target |
|---|---|---|---|
| Platform monthly fee | $5K-$15K | $0 (per-transaction only) | < $10K |
| ACH origination | $0.10-0.25 | $0.50 | < $0.20 |
| Same-day ACH | Bank-passthrough (varies) | Bank-passthrough | Confirm < $1.50 |
| Bank-partner balance requirement | $250K-$1M | N/A (Increase is the bank) | < $500K |
| Setup / onboarding fee | Often waived for vertical SaaS | None | $0 |
| Reserve requirement | 1-3% of monthly volume | None | < 2% |
| Annual contract minimum | Typical $50K-$150K | None | < $100K |

**Walker's negotiation lever:** SiteSync is a high-velocity vertical SaaS with hash-chain audit (rare provenance signal). Pre-pilot, pre-revenue. Concession-friendly path: **6-month free trial + waived setup + month-to-month contract first 12 months in exchange for case-study usage** of Adaptive-style.

### KYB capabilities (target: 5/5)

- Can Alloy + MT handle: LLC, sole prop, S-corp, C-corp, partnership, joint-venture entities? (All required for sub long-tail.)
- Beneficial-owner waterfall — when an LLC is owned by another LLC owned by a trust?
- International sub support? (Mexico-based subs are common in TX/CA construction; not a launch requirement but year-2.)
- Manual-review queue UI for borderline cases?
- KYB document re-request automation (when an EIN doesn't match)?

### Same-day ACH support (target: 5/5)

- Confirm same-day ACH origination on all bank partners
- 3 NACHA windows daily: 10:30 AM, 2:45 PM, 4:45 PM ET (cutoff times)
- $1M per-transaction cap (raised from $100K in 2022)
- Confirm: what happens when sub bank doesn't accept same-day? Standard ACH fallback?

### Reconciliation tooling (target: 5/5)

- `expected_payments` engine (MT's killer feature) — model pay-app expected outflow + match to bank entry automatically
- Bank-statement parsing (CAMT.053 / BAI2)
- Per-tenant ledger views
- Discrepancy alerts (over/under match, late settlement, returns)
- Custom reconciliation rules (we'll need: pay-app settles with retainage held back; reconciler must understand)

### Compliance + audit support (target: 4/5)

- SOC 2 Type II report shareable
- BSA / KYC / KYB program shared (we inherit their compliance posture)
- 1099-K reporting (if structured as TPSO)
- MTL shielding — written legal opinion that we operate as agent-of-payee, not as money transmitter

### Speed-to-launch (target: 4/5)

- Contract-to-first-sandbox-push: 30-60 days
- Sandbox-to-production: 30-60 days (depends on bank partner KYC-on-us)
- Total: 60-120 days realistic

### Risk management (target: 4/5)

- Returns handling (R02 insufficient funds, R03 no account, R10 unauthorized — each has different operational responses)
- Fraud monitoring (anomaly detection on transaction patterns)
- Account freeze policy (when MT freezes us — this is the risk; Stripe Treasury notorious for this; MT historically reasonable)

### Construction-vertical references (target: 3/5)

- Direct precedents in construction (Adaptive ✅; ask MT for 1-2 more)
- Competitive precedents (does MT serve any of: Procore Pay alternatives? PayApps? sub-payment SaaS?)

### Fine-print red flags (target: 0)

- Exclusive bank-partner clauses (we want the ability to swap)
- Volume commitments (we want flexibility year 1)
- Termination penalties (we want < 90-day exit)
- Data ownership (our customer data should be ours)
- IP ownership of integration (custom logic we build is ours)

---

## The Negotiation Script

### Opening message to Modern Treasury (today, May 4)

> "Hi [name] — I'm Walker, founder of SiteSync. We're a construction PM SaaS competing with Procore. We have hash-chain audit on every action, AI agent that drafts pay apps before humans approve. Soft pilot kicks off late May with a Dallas GC; first paid GC by August. Embedded ACH (GC-to-sub pay-app push, same-day, with auto-attached lien waivers) is our v1.5 launch in March-April 2027. I want to start the partnership conversation now so we have a sandbox push tested by September. 30 minutes to walk through what we're building and what your stack would look like for us?"

Ground rules:
- Don't mention competitors in first call (they'll ask; say "we're talking to one other partner")
- Don't lead with pricing concerns (lead with use case fit)
- Lead with the Adaptive precedent ("you already serve a construction back-office")

### First-call discovery questions

1. "What's the standard contract structure for a pre-revenue vertical SaaS?"
2. "What's the realistic timeline from contract signature to first sandbox push, then to production push?"
3. "What bank partners would you recommend for our profile? We're looking at $5-50M GC contract values, 100 paying customers by year 2, $200M annual ACH volume by year 2."
4. "Can we run reconciliation in our own ledger and use your `expected_payments` engine for confirmation, or do we have to use yours as primary?"
5. "How does your KYB stack handle subs with messy paperwork — owner-waterfall LLCs, recently-formed entities, prior bankruptcies?"
6. "What's your support tier for a customer at our stage and projected scale?"
7. "What happens if our pilot reveals we need to swap bank partners — what's the process and timeline?"
8. "Can we share Adaptive as a reference customer? Anyone else in construction or construction-adjacent we should talk to?"

### What to listen for (good signals)

- Willingness to talk pricing in first call
- Specific reference customer offer (not just "we have references")
- Bank partner recommendation that matches our scale (First-Citizens or Cross River — see above)
- Comfort with multi-bank failover discussion
- Acknowledgment that pre-revenue requires concessions

### What to listen for (red flags)

- Long onboarding timeline ("90-120 days minimum to first sandbox push" → push back; should be 30-45)
- Required minimum balances mentioned upfront in first call
- Reluctance to discuss bank-partner flexibility
- Pricing model that doesn't scale down (e.g., flat $50K/year regardless of volume)
- "We don't really do construction" — would be a red flag

### Backup-track parallel: Increase

Send a parallel email to Increase **today** with a similar pitch but different framing:

> "Hi [name] — I'm Walker, founder of SiteSync. We're a construction PM SaaS launching embedded ACH for pay-app pushes Q1 2027. We're talking to Modern Treasury but want to evaluate Increase given the cost differential and direct-bank-API simplicity. Could we chat for 30 minutes about what your stack would look like for us — particularly how you'd handle multi-counterparty B2B reconciliation when we're doing 50K-500K pay-apps to LLCs with messy paperwork?"

The parallel call is **leverage**, not commitment. Walker negotiates MT down knowing Increase exists.

---

## Term Sheet Review Checklist (when MT comes back with terms)

Walker reviews the term sheet against this list before signing. Anything red-flagged → renegotiate or walk.

### Must-haves (cannot sign without)

- [ ] Multi-bank optionality (not exclusive to one bank partner)
- [ ] Month-to-month or quarterly termination after year 1 (no 3-year lock-in)
- [ ] SOC 2 Type II report deliverable upon contract signature
- [ ] BSA/AML program documentation deliverable
- [ ] MTL shielding language (we operate as agent-of-payee or processor of MT's bank partner)
- [ ] Data ownership — our customer data is ours; we can export at any time
- [ ] IP ownership — integration code we write is ours
- [ ] Sandbox access at no charge during build phase
- [ ] Same-day ACH support with all NACHA windows
- [ ] Returns handling included in base pricing (not nickel-and-dimed)

### Should-haves (negotiate hard for)

- [ ] First 12 months: month-to-month + 6-month free trial + waived setup
- [ ] Volume-based pricing tiers (not flat-rate)
- [ ] Reserve requirement < 2% of volume (or zero for first 12 months)
- [ ] Beneficial-owner waterfall handled (not surcharged per layer)
- [ ] Manual KYB review queue at no extra cost (Alloy SLA included)
- [ ] Custom reconciliation rules supported (retainage holdback, partial settlements)

### Walk-aways (deal-breakers)

- [ ] Exclusive lock-in to one bank partner
- [ ] Multi-year contract minimum
- [ ] Per-customer KYB charges (must be per-volume, not per-counterparty)
- [ ] Termination penalty > $50K
- [ ] No SOC 2 report or BSA documentation available
- [ ] Refusal to discuss reference customer access

---

## Timeline (if MT signs)

| Date | Milestone |
|---|---|
| **May 4 (today)** | Initial outreach to MT + parallel to Increase |
| **May 11** | First call with MT (confirm 30-min slot) |
| **May 18** | First call with Increase (parallel leverage) |
| **May 25** | Term sheet from MT |
| **June 1** | Term sheet redline complete; Walker engages outside counsel for legal review |
| **June 15** | Contract signed (MT + bank partner) |
| **June 16** | Bank partner KYC-on-us begins; Walker provides corporate docs, beneficial-owner info, financial projections |
| **July 31** | KYC complete; sandbox account provisioned |
| **Aug 15** | First test ACH push in sandbox (synthetic GC + sub) |
| **Sep 30** | Production push capability (sandbox-passing tests + bank approval) |
| **Oct 30** | First real soft-pilot ACH push (with Brad's pilot — payment to one sub on test pay-app) |
| **Dec 1** | First paid customer's pay-app push goes through (post-Lap-3 first-paid-GC milestone) |
| **Mar 1, 2027** | Embedded Payments v0 publicly launched (compressed Bugatti target) |

---

## What Walker Does With This Spec This Week

1. **Today (May 4)** — Send the opening message to Modern Treasury (template above). Send parallel message to Increase. Schedule 30-min calls for May 11.
2. **May 5-10** — Read the full RFP scoring framework. Customize the discovery questions for the call. Lock the negotiation script.
3. **May 11** — First call with Modern Treasury. Take notes against the scoring framework. Don't commit anything.
4. **May 18** — First call with Increase. Compare scoring.
5. **May 18-25** — Side-by-side comparison written up; communicate to MT we're talking to Increase if needed for leverage.
6. **May 25** — Term sheet from MT.
7. **June 1** — Term sheet redline + outside counsel engagement.
8. **June 15** — Contract signed.

---

## What Claude Code Does With This Spec This Week

Nothing yet — this spec drives Walker's outreach. Once MT term sheet is in hand (~June 1), the EMBEDDED_PAYMENTS_V0_ARCHITECTURE_SPEC begins. That spec uses MT's API contract as the integration target.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| ACH-1 | MT contracts but bank partner KYC fails (e.g., First-Citizens declines because of pre-revenue stage) | Medium | High | Have 2 bank partners specified in MT contract; failover takes 30 days |
| ACH-2 | MT term sheet lands at $20K/month flat — too expensive | Low-Medium | Medium | Counter with volume-tier; if no movement, switch to Increase |
| ACH-3 | Increase term comes back better than MT | Medium | Medium | Genuinely the right call for cost-sensitive. We'd be giving up reconciliation engine + multi-bank. Document trade-off; Walker decides. |
| ACH-4 | Modern Treasury account-freeze incident occurs to a peer customer publicly | Low | Strategic | Multi-rail abstraction in app code so we can hot-swap. Already specced. |
| ACH-5 | Negotiation drags past June 15; bank partner onboarding starts late | Medium | High (slips Mar 1 launch toward Apr 30) | Hard-stop: by June 1, if no term sheet movement, escalate or switch to backup |

---

## Negotiation Outcome Reporting

After each call (MT + Increase), Walker writes a 1-page receipt to `docs/audits/payment-partner-call-notes/<partner>-<date>.md`. Format:

```markdown
# Call Notes — <partner> — <date>

## Attendees
- Walker (SiteSync)
- [name + title] (partner)

## Key takeaways
- [3-5 bullets]

## RFP scoring (0-5 across each dimension)
- Pricing: X/5
- KYB: X/5
- Same-day ACH: X/5
- Reconciliation: X/5
- Compliance: X/5
- Speed-to-launch: X/5
- Risk management: X/5
- Vertical references: X/5

## Red flags
- [any deal-breakers or watch-outs]

## Walker's read
- [gut: yes / maybe / no]

## Next steps
- [follow-up requests, materials needed, decision deadlines]
```

This builds the audit trail for the decision. When the seed deck investor asks "why MT vs alternatives" we have a written record.

---

## Appendix A — Construction-Vertical Embedded Payments Landscape

| Provider | Status | Notes |
|---|---|---|
| Modern Treasury | Best vertical-SaaS fit | Adaptive precedent. Recommended. |
| Increase | Cost alternative | Single-bank, cleaner API, less reconciliation horsepower |
| Stripe Treasury | Rejected | Risk team freezes lumpy B2B accounts |
| Dwolla | Rejected | KYB weakest on long-tail |
| **Procore Pay** (Goldman Sachs Transaction Banking) | Competitor | They own the lien-waiver-on-payment story today. We compete on free + open + multi-bank. |
| **Levelset** (Procore-acquired) | Adjacent | Waiver SaaS, not a payments rail. We compete; not a partnership target. |
| **Built Technologies** | Construction draw mgmt + payments | Could white-label, but they want the customer relationship. Not a fit for us. |
| **Briq** | Financial automation | Different category. Skip. |
| **Routable** / **Bill.com** | B2B rails with check fallback | Alternatives if MT/Increase don't pan out. Worth documenting as fall-back-fallback. |
| **Ramp Bill Pay** | Newer entrant | Worth a watching brief. Not first choice. |

---

## Appendix B — Why The Multi-Rail Abstraction Matters

The architecture spec (`EMBEDDED_PAYMENTS_V0_ARCHITECTURE_SPEC` — forthcoming) commits to a payments interface in our app code that is partner-agnostic. This means:

```typescript
// All app code calls this interface, never a specific partner SDK
interface PaymentsRail {
  initiatePayment(input: PaymentInput): Promise<PaymentInitiated>
  getStatus(paymentId: string): Promise<PaymentStatus>
  retryReturn(originalId: string, reason: ReturnReason): Promise<RetryResult>
  reconcileBankStatement(statement: BankStatement): Promise<ReconciledLines>
}

class ModernTreasuryRail implements PaymentsRail { /* ... */ }
class IncreaseRail implements PaymentsRail { /* if we ever swap */ }
```

A swap from MT to Increase (or vice versa) would be a 2-week refactor — implementation-only, no app-level changes. This is the architectural insurance against partner failure or pricing escalation.

---

## Appendix C — Why MT + Alloy + First-Citizens vs MT + MT-default

Modern Treasury's "default stack" includes their pre-integrated KYB and a Goldman or Evolve bank partner. We're explicitly choosing **not** the default because:

1. **Alloy over MT-default KYB:** Alloy's policy-engine approach gives us configurable handling for sub long-tail. MT's default KYB is more black-box.
2. **First-Citizens (or Cross River) over Goldman/Evolve:** post-SVB consolidation, First-Citizens has the depth + capacity for our scale; Cross River is fintech-specialized. Goldman Transaction Banking is fine but their construction-vertical exposure is via Procore Pay (competitor); we don't want strategic awkwardness.

This means more upfront contract complexity (Walker negotiates with 3 entities: MT + Alloy + bank partner) but more flexibility long-term. Worth the friction.

---

## Decision Pending Walker Signoff

- [x] ADR-011: Modern Treasury + Alloy + First-Citizens (or Cross River) — **default**
- [ ] Walker reads, optionally overrides
- [ ] Walker confirms outreach starts this week
