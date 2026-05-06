# MSA + DPA + Order Form Template Notes

**Date:** 2026-05-04
**Status:** Spec ready. Walker engages outside counsel by Day 80 of Lap 3 (~July 2). MSA + DPA templates lawyer-finalized by Day 82 (~July 4). First contract uses these templates Day 87.
**Companion specs:** `PRICING_DECISION_DOC` (pricing terms in MSA reflect this), `FIRST_CONTRACT_PLAYBOOK` (the close mechanics), `SOC_2_READINESS_SPEC` (DPA references compliance posture), `EMBEDDED_PAYMENTS_V0_ARCHITECTURE_SPEC` (post-launch addendum)
**Format reference:** Standard SaaS MSA + DPA + Order Form three-document structure. Walker is NOT a lawyer; outside counsel drafts. This spec is the principles + priorities + redline strategy.

---

## TL;DR

**Three documents:**
1. **MSA (Master Services Agreement)** — the core contract. ~10 pages. Customer-friendly but with non-negotiables.
2. **DPA (Data Processing Addendum)** — privacy + security. ~5 pages. References our compliance posture.
3. **Order Form** — the per-customer commercial terms (tier, ACV, payment schedule). ~1 page.

**Outside counsel:** engage by July 2. Recommended: a SaaS-experienced firm at Cooley, Wilson Sonsini, Orrick, Goodwin, or Latham. Budget: $20-40K for templates + redline support through first 5 contracts.

**Default 14-day red-line cycle.** Long red-lines = 30+ day cycles = killing deals. Templates designed to be acceptable to most enterprise procurement without modification.

This spec covers: principles, non-negotiables (what we won't change), should-haves (negotiate hard), nice-to-haves (concede gracefully), and a section-by-section redline priorities list.

---

## Principles (the philosophy)

### 1. Procurement-friendly is a feature

Most enterprise procurement teams reject contracts they find adversarial. Our templates are written to be **fair-to-customer first**, with our protections built in via clear boundaries rather than legalese. **Goal: 80% of customers sign without redline; 90% with < 1 round of redline.**

### 2. Short and clear beats long and clever

The MSA is **8-10 pages.** Procore's MSA is 30+ pages. Customers' counsel notice. A short MSA is a credibility signal — "this company is confident enough in their model that they don't need a 30-page contract."

### 3. The audit chain IS our protection — leverage it

We don't need indemnification clauses for "what if we modify the audit log." We have hash-chain attestation. The contract acknowledges the chain's integrity and customer's right to audit.

### 4. Standard SaaS terms; no exotic stuff

We use **the SaaS standard** — Section 230 limitation, mutual indemnity, standard IP carve-outs. We don't invent contract patterns. Customer counsel sees familiar shape and approves faster.

### 5. Annual contract, NET-30, auto-renewal with 30-day opt-out window

Standard. Predictable. Procurement-friendly.

---

## MSA Structure (10 pages)

### Section 1 — Definitions (1 page)

Standard SaaS definitions: "Service," "Customer Data," "Authorized Users," "Subscription Term," "Confidential Information," etc. Mostly standard language with our specific defined terms for: "Iris" (the AI agent), "Hash Chain Audit Log," "Drafted Action," "Approved Action."

### Section 2 — Service Description (1 page)

What SiteSync does, what's included at the customer's tier (refers to Order Form), what's not included. References the Service Description on our marketing site (which we keep current).

### Section 3 — Customer Obligations (1 page)

Standard. Customer responsible for:
- Authorized User credentials
- Compliance with applicable laws
- Accurate information when configuring (this is where we put: "construction volume reported accurately for pricing")
- Not using SiteSync for prohibited purposes (illegal activity, infringement)

### Section 4 — Fees + Payment + True-up (1 page)

Refers to Order Form for ACV. Specifies:
- Annual prepay default (NET-30 from invoice)
- Quarterly volume true-up: customer reports actual construction volume; we adjust at next renewal
- Late fee: 1.5%/month or max allowed by law
- Payment method: ACH, wire, or check; PO supported

### Section 5 — Intellectual Property (1 page)

- SiteSync owns: the Service, all underlying technology, AI models, design.
- Customer owns: their data ("Customer Data") — drawings, RFIs, daily logs, photos, financials.
- Mutual: customer can use our product; we can use anonymized aggregated usage data for product improvement (NOT customer-specific data; NOT our identifiable customer data).
- Iris drafts: customer owns the drafted output once approved (it's incorporated into Customer Data); SiteSync retains rights to anonymized model improvement.

### Section 6 — Confidentiality (1 page)

Standard mutual confidentiality. 5-year tail post-termination. Standard exceptions (publicly available, independently developed, court order with notice).

### Section 7 — Term + Termination (1 page)

- Initial term: 12 months from Order Form date
- Auto-renew: 12 months unless 30-day notice
- Termination for cause: 30-day cure period; either party
- Termination for convenience: customer can terminate anytime with 30-day notice; we can only terminate for material breach
- **Customer keeps data:** on termination, customer gets full export of their data within 30 days; we delete or anonymize within 90 days (per DPA)
- **Wind-down:** customer keeps read-only access to historical data for 12 months post-termination at no extra charge (matches the audit chain retention story)

### Section 8 — Warranties + Disclaimers (1 page)

- We warrant: the Service will function materially as described
- We disclaim: AS-IS for AI-generated content (Iris drafts); customer remains responsible for final approval
- Standard disclaimers for indirect damages, lost profits

### Section 9 — Indemnification (1 page)

- We indemnify customer against: third-party IP infringement claims (cap = annual fees)
- Customer indemnifies us against: customer's misuse of the Service, customer's violation of laws, customer's content (Customer Data)
- Mutual, capped, with carve-outs

### Section 10 — Limitation of Liability + General Terms (1 page)

- LoL cap: greater of (a) total fees paid in last 12 months, or (b) $1M for paid contracts
- Carve-outs: indemnification, IP claims, data breach (uncapped)
- Governing law: Delaware (standard SaaS)
- Dispute resolution: first 30-day mediation; then arbitration; class-action waiver
- Notice requirements
- Force majeure
- Severability + integration clause

---

## Non-negotiables (we don't change these)

If customer counsel asks to change these, escalate to outside counsel + Walker. Default position: politely refuse.

1. **Hash chain audit log integrity language.** We mathematically prove tamper-evidence; we won't dilute that to "best effort."
2. **Single AI chokepoint.** All AI calls through `iris-call`; no client-side keys; no exception.
3. **AI as "AS-IS" with customer responsibility for final approval.** This is non-negotiable for liability. Iris drafts; customer approves. If Iris drafted wrong and customer approved, customer's responsibility.
4. **Mutual indemnification with caps.** Symmetric. We're not signing "we indemnify you for X without your indemnifying us for Y."
5. **Limitation of liability.** Cap at 12-month fees or $1M (whichever greater); standard SaaS.
6. **Data ownership.** Customer Data is customer's; SiteSync IP is ours. Clear lines.
7. **Termination for convenience by customer (30 days), not by us.** We don't get to unilaterally terminate without cause.
8. **Standard SaaS warranty disclaimer.** No "specific performance" guarantees beyond Service description.
9. **Auto-renewal with 30-day notice.** If customer pushes for "no auto-renew," we add a 60-day pre-renewal notification email + manual renewal sign — but not literal "must opt-in" each year.
10. **Pre-existing dispute resolution language.** Mediation → arbitration → class waiver.

---

## Should-haves (negotiate hard for)

Customer counsel may push back on these; we negotiate but lean toward keeping:

1. **Net-30 payment terms** (some procurement teams want NET-60 or NET-90 — concede if needed for Enterprise; not for Pro)
2. **Quarterly volume true-up** (some customers prefer annual; concede annual for Enterprise customers)
3. **Auto-renew 12 months** (concede to month-to-month at Pro tier with 25% surcharge; default annual)
4. **Initial 12-month term** (some want 24 or 36; we'll accept with 10-15% discount)
5. **Data deletion within 90 days post-termination** (some want 30; we'll do 60 with caveats)
6. **Service Level Agreement** (we offer 99.9% with credit at Enterprise; some want 99.99% or higher penalties; concede at customer-pay-extra premium)

---

## Nice-to-haves (concede gracefully)

These don't materially change our position; concede if they help close the deal:

1. **Customer-specific addendum** (e.g., specific compliance riders) — we accommodate
2. **Customer's procurement form** (e.g., their internal "Vendor Onboarding Form") — we fill out
3. **NDA before MSA** — we sign their NDA
4. **Customer-specific contract template** — we'll review; if substantive, push back; if cosmetic, accept
5. **Insurance certificates from us** — we provide (we have $10M cyber + E&O + fidelity bond per `SOC_2_READINESS_SPEC`)
6. **W-9, COI, security certifications** — we share (Trust Center has them)

---

## DPA (Data Processing Addendum) — 5 pages

The DPA is GDPR-style language for any customer that has European subs uploading data. References:

### Section 1 — Definitions

GDPR-aligned: "Data Controller," "Data Processor," "Personal Data," "Sub-Processor."

### Section 2 — Subject Matter + Duration

References MSA Term.

### Section 3 — Categories of Personal Data + Subjects

Lists what we process: user names + emails (Authorized Users); employee names + roles (in daily logs, RFI signatures); sub contact info (Sub Portal users).

### Section 4 — Security Measures

References our Trust Center + SOC 2 Type II report + Hash chain attestation. Customer agrees these are sufficient.

### Section 5 — Sub-Processors

Lists our sub-processors with names + jurisdictions:
- AWS / Supabase (US-east, US-west) — hosting
- Anthropic (US) — Iris LLM
- OpenAI (US) — backup LLM (multi-model fallback per ADR-016)
- Modern Treasury (US) — payments orchestration (post-April 2027)
- Alloy (US) — KYB
- First-Citizens (US) — bank partner (post-April 2027)
- Sentry (US) — error monitoring
- Twilio (US) — SMS
- SendGrid / Postmark (US) — email
- Vanta (US) — compliance evidence

Customer right to object to new sub-processors with 30-day notice.

### Section 6 — Cross-border Data Transfers

US-only hosting unless customer requests EU. SCCs incorporated for EU subs.

### Section 7 — Right of Access / Erasure / Portability

DSAR workflow: customer can request data; we respond within 45 days. Erasure preserves audit chain integrity (per ADR-008).

### Section 8 — Breach Notification

We notify customer within 72 hours of confirmed breach. Joint cooperation on response.

### Section 9 — Audit Rights

Customer can audit our compliance once per 12 months with 30-day notice; or rely on our Trust Center + SOC 2 report.

---

## Order Form (1 page)

```
SITESYNC ORDER FORM

Effective Date: _______________
Customer: _______________________
Subscription Term: 12 months from Effective Date

TIER:                    [ ] Starter   [ ] Pro   [ ] Enterprise

PRICING:
  Annual Subscription Fee:                    $___________
  Construction volume basis (Pro/Enterprise): $_______________ M/yr
  Embedded Payments add-on (post-April 2027): [ ] Included [ ] Add-on $___
  
PAYMENT TERMS:                NET-30 from invoice
PAYMENT METHOD:                [ ] ACH [ ] Wire [ ] Check
PURCHASE ORDER NUMBER:        _______________

PRIMARY CONTACT:
  Name: __________________
  Email: __________________
  Phone: __________________

AUTHORIZED USERS (initial):    Up to ___________ users (Starter)
                                Unlimited (Pro/Enterprise)

EXECUTED:

____________________     ____________________
[Customer Sign]          Walker Benner, SiteSync
[Customer Title]         CEO + Founder
Date:                    Date:
```

---

## Outside counsel engagement scope

**Recommended firm:** A SaaS-specialized firm — Cooley, Wilson Sonsini, Orrick, Goodwin, Latham. Walker has outside counsel from formation; might already be Cooley.

**Engagement scope:**

1. **Template drafting (Day 80-84 of Lap 3, ~July 2-6, 2026):** outside counsel drafts MSA + DPA based on this spec. ~10 hours of attorney time. Budget: $5-10K.
2. **Templates lawyer-finalized (Day 82, ~July 4):** Walker reviews; templates land in `docs/legal/`.
3. **Customer-by-customer redline support** (post-Day 82; ongoing): outside counsel reviews customer redlines on first 5 contracts. Budget: $2-5K per contract for first 5; bring in-house for subsequent.
4. **Annual template review** (each January): outside counsel updates templates as laws/standards shift. ~$5K/year.
5. **DPA-specific scenarios** (e.g., new EU customer, new sub-processor): outside counsel reviews. Ad-hoc.

**Total counsel budget through April 2027:** ~$20-40K. Critical investment.

---

## What Walker Does With This Spec This Week

1. Read this spec; flag any non-negotiable that conflicts with his risk tolerance
2. Identify outside counsel firm (likely existing relationship from formation)
3. Schedule kickoff call for ~July 1 (Day 80 of Lap 3)
4. Begin collecting customer-side standard MSA forms — when prospects share their template, we file in `docs/legal/customer-redlines/`

---

## What Claude Code Does With This Spec

- Convert this spec into MSA + DPA + Order Form drafts (text format) for outside counsel review (~3 days)
- Maintain the templates as `docs/legal/MSA_TEMPLATE_v1.md`, `docs/legal/DPA_TEMPLATE_v1.md`, `docs/legal/ORDER_FORM_TEMPLATE_v1.md` (planned)
- Track customer-specific redlines in `docs/legal/customer-redlines/<customer-slug>.md`
- Sync executed agreements to `docs/legal/executed/<customer-slug>-MSA-<date>.pdf`

Total Claude Code work: ~5 days through July.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| MSA-1 | First customer's counsel pushes for 30+ days of redline | Medium | High | Engage outside counsel early; default templates designed to need < 1 round redline |
| MSA-2 | Customer requires their MSA template instead of ours | Low-Medium | Medium | Outside counsel reviews; if substantive misalignment, escalate; if cosmetic, accept |
| MSA-3 | Embedded Payments adds new contract language post-launch | High | Low | Plan for an addendum to existing contracts (post-April 2027); existing customers grandfathered into the integrated v2 |
| MSA-4 | Customer requires SOC 2 Type II in MSA before signing | High | Low | Note that observation window is in progress; report by Feb 2027; mitigation: 30-day pilot first |
| MSA-5 | Customer requires unlimited liability or specific guarantees | Medium | High | Hard non-negotiable on liability; may lose deal but can't accept |
| MSA-6 | Customer wants source-code escrow | Low | Low (we offer to anyone) | Implementation cost $5K/year; charge customer if they want it as add-on |
| MSA-7 | Outside counsel slow on redline turnaround | Medium | Medium | Backup attorney pre-identified; SLA expectations set in engagement |

---

## What this spec deliberately does NOT cover

- The actual legal language (outside counsel drafts)
- The first contract close motion (`FIRST_CONTRACT_PLAYBOOK`)
- Customer-specific compliance addenda (e.g., FedRAMP rider, Davis-Bacon rider)
- Channel partner / reseller agreements (year 2)
- Embedded Payments terms (separate addendum post-April 2027)
- International contracts (US-only at GA; international Q4 2027+)
- Source-code escrow standard terms (offer ad-hoc)
