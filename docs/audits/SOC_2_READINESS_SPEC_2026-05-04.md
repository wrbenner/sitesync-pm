# SOC 2 Type II Readiness Spec

**Date:** 2026-05-04
**Status:** Spec ready. A-LIGN engagement starts week of May 11. Vanta procurement same week.
**Includes ADR-013 inline:** A-LIGN as audit firm; Vanta as evidence-collection tooling.
**Companion specs:** `SECURITY_WHITE_PAPER_2026-05-04.md` (forthcoming, this wave) + `CHAIN_AUDIT_PREP_2026-05-04.md` (forthcoming, this wave) — Trail of Bits chain attestation runs in parallel as Q4 2026 work
**Format reference:** `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`

---

## TL;DR

Engage **A-LIGN by May 20, 2026** for a SOC 2 Type II audit; pair with **Vanta** for evidence collection. Total cash through GA: **~$130K** (plan $150K with overrun buffer). Observation window starts **August 1, 2026**; Type II report by **February 28, 2027**; available for the **March 1, 2027 GA target** (or April 30, 2027 baseline).

The single failure mode that pushes GA right: gap remediation slipping past July 31 contaminates the observation window and pushes the report past February.

This spec covers: vendor selection rationale (ADR-013), readiness phase (May–July 2026), evidence-collection automation, the 5 critical control families, observation-window discipline, and pre-flight prep work that should start THIS WEEK.

---

## ADR-013 — A-LIGN + Vanta

**Decision:** A-LIGN as the audit firm; Vanta as the readiness/evidence tooling.

### Why A-LIGN over the alternatives

The candidate pool the research surveyed:

| Firm | Verdict | Reason |
|---|---|---|
| **A-LIGN** | ✅ Chosen | Largest SaaS-focused SOC 2 firm in the US. Strong Vanta integration. Reasonable pricing for our stage ($30-50K Type II audit). Auditor-fluency in modern SaaS architecture (Supabase, edge functions, AI agents). |
| Schellman | 🟡 Acceptable backup | Higher prestige; ~30-50% more expensive. Brand boost real but marginal at our stage. Choose if A-LIGN can't accommodate timeline. |
| BARR Advisory | 🟡 Mid-market alternative | Solid; less SaaS-specific. Skip unless A-LIGN/Schellman both decline. |
| KirkpatrickPrice | 🟡 Boutique | Smaller; thorough; slow. Skip for timeline reasons. |
| PwC, Deloitte, EY, Grant Thornton, Crowe, KPMG | ❌ Disqualified | Big-4 / mid-market public-accounting firms. Pricing 3-5x higher; turn-around 2-3x slower; oriented to $100M+ ARR clients. We come back to one of these post-Series A if a major prospect requires it. |

A-LIGN is the dominant SaaS SOC 2 firm by audit volume. Their auditor pool is fluent in the SaaS architecture patterns we use (Supabase + edge functions + RLS + JWT auth). Cost-wise: $30-50K for the Type II audit + ~$10-20K readiness prep if engaged separately (Vanta can handle most of readiness).

### Why Vanta over Drata + Secureframe

| Tool | Verdict | Reason |
|---|---|---|
| **Vanta** | ✅ Chosen | Highest integration count (500+ — including Supabase, Stripe Treasury, GitHub, Linear, etc.). Best A-LIGN auditor fluency (most A-LIGN audits are run through Vanta evidence). Cleanest customer-facing Trust Center. |
| Drata | 🟡 Strong alternative | Slightly cheaper. Strong UI. Less integration coverage at the long tail. Choose if Vanta pricing comes back outside budget. |
| Secureframe | 🟡 Mid-market alternative | Smaller ecosystem. Skip. |

**Vanta pricing:** ~$10K-25K/year depending on stage and integration count. We're at the lower end of the range.

**Total cash investment May 2026 → first Type II report:**

| Item | Cost |
|---|---|
| Vanta (12-month subscription May 2026 - May 2027) | $15K |
| A-LIGN readiness assessment (gap analysis pre-observation) | $10K |
| A-LIGN Type II audit | $40K |
| Internal counsel review of policies | $5K |
| External pen test (required for SOC 2 Type II — ~Sept 2026) | $30K |
| Bug bounty program setup (HackerOne) | $5K |
| Internal time (Walker + eng #2 ~10 hr/week × 30 weeks) | "free" but real cost ~$40K equivalent |
| Buffer for overruns | $20K |
| **Total** | **~$165K** (cash) |

Cash range: **$120K best case (no overruns) — $165K plan — $200K worst case**.

---

## The Three Phases

### Phase 1 — Readiness (May 11 – July 31, 2026)

The 12-week sprint to get every control in place BEFORE the observation window starts.

#### Week 1 (May 11 – May 17): Engagement + scoping

- **Walker calls A-LIGN** (intro from existing network if possible; cold email otherwise)
- Kickoff call: scope the audit (Trust Service Categories — at minimum **Security**; we add **Availability** and **Confidentiality** at GA; **Processing Integrity** post-Embedded Payments; **Privacy** when first European customer signs)
- Scope = **Security + Availability + Confidentiality** for the v1 audit. Privacy and Processing Integrity deferred to year 2.
- Vanta provisioned; Walker connects integrations: Supabase, GitHub, Linear (or whatever PM tool), Slack, Sentry, AWS / Vercel
- A-LIGN delivers gap-analysis questionnaire (~200 controls)

#### Week 2-3 (May 18 – May 31): Gap analysis + policy writing

- Walker + Claude Code answer the gap-analysis questionnaire
- Identify gaps; categorize as: documentation-only (write a policy) vs. process-only (implement and document) vs. tooling (buy or build)
- A-LIGN delivers gap-remediation plan with priority rankings
- Policy-writing sprint: information security policy, access control policy, change management policy, incident response policy, business continuity policy, vendor management policy, data classification policy, acceptable use policy, employee onboarding/offboarding policy. (~10 policies. Vanta has templates; A-LIGN reviews.)

#### Week 4-7 (June 1 – June 28): Implementation

The 5 critical control families that need the most implementation work:

##### CC6 — Access Control (already strong)

- ✅ MFA on all production systems (verify across Supabase, GitHub, AWS, Vercel)
- ✅ Single AI chokepoint (CC6.1)
- ✅ PermissionGate enforcement (CC6.3)
- 🟡 Quarterly access review (Walker reviews who has prod access; document)
- 🟡 Just-in-time prod access (BetterStack or similar; not for Lap 2 — defer)
- 🟡 Privileged Access Management (PAM) — defer to year 2

##### CC7 — System Operations (medium effort)

- ✅ Hash chain audit log → CC7.2 (system monitoring)
- ✅ Iris draft logging → CC7.1 (boundary protection)
- ✅ Sentry alerting (CC7.3)
- 🔴 Incident response runbook → write per `INCIDENT_RESPONSE_RUNBOOK_SPEC.md` (forthcoming, Wave 3)
- 🔴 Disaster recovery plan → write per `MULTI_REGION_FAILOVER_SPEC.md` (forthcoming, Wave 3)
- 🔴 Vulnerability management — engage pen tester for Sept 2026 round
- 🔴 Backup verification — daily automated test of restore procedure

##### CC8 — Change Management (light effort — already disciplined)

- ✅ Pull request review on every change (GitHub branch protection)
- ✅ Typecheck + tests on every PR
- ✅ Lap 1 acceptance gate, Lap 2 acceptance gate (CI gates)
- 🟡 Document the SDLC (formalize what we already do)

##### CC9 — Risk Management (medium effort)

- 🔴 Quarterly risk assessment process (write the process; do the first one)
- 🔴 Vendor risk reviews (we'll need: Modern Treasury, Vanta, A-LIGN, Sentry, Supabase, AWS, etc. — ~10 vendors)
- ✅ Risk register exists (`SiteSync_90_Day_Tracker.xlsx` Risk Register + Bugatti roadmap risks)

##### A1 — Availability (medium-heavy effort)

- 🔴 SLA published (target: 99.9% — verify with Walker; 99.99% is the weapon-grade target but hard pre-launch)
- 🔴 Status page live (`STATUS_PAGE_SPEC_2026-05-04.md` forthcoming Wave 3)
- 🔴 Capacity planning (per `LOAD_TEST_SPEC.md` forthcoming)
- 🔴 BCP / DR plan (per `MULTI_REGION_FAILOVER_SPEC.md`)

#### Week 8-9 (June 29 – July 12): Pen test + remediation

- Engage pen-test firm (Walker shortlist: Cobalt, NetSPI, Bishop Fox, Trail of Bits if also doing chain attestation)
- 1-week pen test
- Triage findings: critical/high → fix in 1 week; medium → fix in 2; low → fix or document acceptance
- Re-test critical fixes

#### Week 10-12 (July 13 – July 31): Final readiness review + bug bounty launch

- A-LIGN runs gap-analysis-revisited
- All controls pass; observation window ready
- Bug bounty program goes live on HackerOne (per Bugatti roadmap Program 2)
- Trust Center published at trust.sitesync.com (Vanta's TrustHub feature)

### Phase 2 — Observation Window (August 1 – January 31, 2027)

**6 months of evidence collection.** Every control must be operating effectively across the entire window.

Critical disciplines during observation:

- **Don't break controls.** A failed access review in October = restart November = report slips 3 months.
- **Keep evidence current.** Vanta auto-collects; we manually upload anything Vanta doesn't see.
- **Quarterly internal audits.** Walker runs Sept + Dec; surfaces drift before A-LIGN does.
- **Incident response.** If anything happens, follow the runbook — Walker writes the postmortem regardless of severity.
- **Onboarding/offboarding.** Engineer #2 starts June; engineer #3 starts Jan; document offboarding for any leaver.
- **Vendor reviews.** When Modern Treasury contract signs (June), vendor review on file.

### Phase 3 — Audit + Report (February 1 – February 28, 2027)

- A-LIGN auditors review ~30 days of fieldwork + remote evidence
- Walker available for clarifying questions
- Report drafted by mid-February
- Final report by **Feb 28, 2027** at latest
- **Available for prospect consumption on Day 1 of GA (Mar 1, 2027)**

---

## What Happens If Things Slip

| What slips | Consequence | Mitigation |
|---|---|---|
| A-LIGN engagement past June 1 | Readiness phase compresses; gap remediation rushed; observation window delayed | Walker calls A-LIGN today; backup plan: Schellman if A-LIGN unavailable |
| Gap remediation past July 31 | Observation window contaminated; report slips to March 31 | Cap remediation at 12 weeks; if gaps remain, they become observation-window action items not readiness blockers |
| Pen-test findings critical past Sept 30 | Report drafted with caveats | Re-test within 30 days; report supplemented |
| Engineer leaves during observation | Offboarding triggers control review; if deficient, restart that control | Document offboarding in advance; have second person verify access removal |
| Customer reports incident | Postmortem published; if shows control failure, restart that control's window | Incident response runbook prevents this from being chaotic |

---

## ADR-014 (sister to ADR-013) — Trust Center Public

**Decision:** Publish a real-time Trust Center at **trust.sitesync.com** (powered by Vanta TrustHub). Visible to: anyone with the link, not gated. Shows: control status, certifications, incident history, vendor list, security policies (redacted).

**Why public:** Procore doesn't have one. We do. Differentiator on the first call with any enterprise CIO.

**What's NOT public:** customer-specific access logs, detailed incident root-causes (anonymized OK), audit findings (NDA-only).

---

## Pre-flight Prep — What Walker Does THIS WEEK

The single most-important controls SiteSync already has — codify them in policy form so they're audit-ready:

- [ ] **Hash chain audit log** → document as **CC7.2 control** (system-monitoring substantive control). Reference the migration `20260426000001_audit_log_hash_chain.sql`. Document: integrity property, frequency of verification, procedure if a break is detected.
- [ ] **PermissionGate enforcement** → document as **CC6.1 + CC6.3 control** (logical access). Reference `scripts/audit-permission-gate.mjs` + the CI workflow. Document: scope (all action buttons), validation cadence (every PR), procedure when the gate is bypassed.
- [ ] **Iris draft logging** → document as **CC7.1 control** (boundary protection). Reference `drafted_actions` table + `iris-call` chokepoint. Document: every AI call recorded, every state transition audit-logged.
- [ ] **Supabase RLS** → document as **CC6.7 control** (data classification + access). Reference RLS policies in migrations. Document: tenant isolation property, testing methodology.
- [ ] **Single AI chokepoint** (`callIris.ts` + `iris-call`) → document as **CC6.1 + CC8.1 control** (logical access + change management).

These five are SiteSync's strongest existing controls; documenting them well = ~50% of the readiness phase done before A-LIGN even shows up.

---

## What's Out of Scope for V1

- **ISO 27001** — pursue Q3 2027 post-Series-A. Adds ~$35-60K. Reuses ~80% of SOC 2 controls. Add when first international customer or large-enterprise customer asks.
- **HITRUST** — never (we're not healthcare).
- **FedRAMP** — never v1; Q4 2027+ when first federal-direct customer (rare for our ICP).
- **CSA STAR / CCM** — skip; construction ICP doesn't ask.
- **NIST CSF** — already mapped via SOC 2; document the mapping as a customer-facing trust artifact (~1 day of work).

---

## Acceptance Criteria for This Spec to Be "Shipped"

1. ADR-013 + ADR-014 committed
2. A-LIGN engaged with signed contract by **May 20, 2026**
3. Vanta provisioned and integrations connected by **May 18**
4. Gap-analysis questionnaire completed by **May 31**
5. Policy library committed to `docs/policies/` by **June 14** (10 policies)
6. All 5 critical-control documentation entries written by **June 21**
7. Pen-test contract signed for **Sept 2026** date
8. Trust Center live at trust.sitesync.com by **August 1**
9. Observation window starts **August 1**; first internal quarterly audit **Sept 30**

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| SOC2-1 | A-LIGN can't accommodate May 20 engagement | Low | Medium | Backup: Schellman; same engagement structure 30 days later |
| SOC2-2 | Vanta integrations don't cover Supabase fully | Low | Low | Manual evidence upload acceptable; ~5 hr/month |
| SOC2-3 | Pen test reveals critical zero-day pre-launch | Medium | High | Triage process; budget $20K for emergency remediation |
| SOC2-4 | Engineer #2 hire slips → readiness work falls on Walker | Medium | Medium | Cap Walker's readiness time at 10 hr/week; if more, hire security contractor for Sept push |
| SOC2-5 | Customer asks for SOC 2 Type II in pilot phase | Medium | Low (we point at readiness in progress) | Trust Center shows "Type II in progress; observation window ends Jan 2027"; pilot customers accept |
| SOC2-6 | A-LIGN auditor changes mid-engagement | Low | Low | A-LIGN handles internally; minor disruption |
| SOC2-7 | Vanta auto-collected evidence is wrong / incomplete | Low | Medium | Quarterly Walker review of evidence quality |

---

## What Claude Code Does With This Spec

This spec is mostly Walker-driven (vendor calls + policy reviews + scope decisions). Claude Code role:

- Document the 5 critical controls as `docs/policies/CC*-*.md` files (one-time, ~3 days work)
- Maintain integration with Vanta (auto-sync evidence; ~2 hours/quarter)
- Write incident response runbook + DR plan (separate specs Wave 3)
- Implement status page + Trust Center scaffold (~3 days work)
- Document SDLC process (~1 day)

Total Claude Code spec/implementation work: ~10 author-days spread across May-August 2026.

---

## File-by-file Changelog

| Path | Change |
|---|---|
| `docs/audits/SOC_2_READINESS_SPEC_2026-05-04.md` | This file |
| `docs/audits/ADR_013_AUDIT_FIRM_TOOLING_2026-05-04.md` | Cross-reference (this file inline) |
| `docs/audits/ADR_014_TRUST_CENTER_PUBLIC_2026-05-04.md` | Cross-reference (this file inline) |
| `docs/policies/CC6.1-LOGICAL_ACCESS.md` | NEW — single AI chokepoint + PermissionGate |
| `docs/policies/CC6.3-ROLE_BASED_ACCESS.md` | NEW — RBAC + RLS |
| `docs/policies/CC6.7-DATA_CLASSIFICATION.md` | NEW |
| `docs/policies/CC7.1-BOUNDARY_PROTECTION.md` | NEW — Iris drafted_actions logging |
| `docs/policies/CC7.2-MONITORING.md` | NEW — hash chain audit log |
| `docs/policies/CC8.1-CHANGE_MANAGEMENT.md` | NEW — PR review + CI gates |
| `docs/policies/INFORMATION_SECURITY.md` | NEW — overarching policy |
| `docs/policies/INCIDENT_RESPONSE.md` | NEW (cross-ref `INCIDENT_RESPONSE_RUNBOOK` Wave 3) |
| `docs/policies/BUSINESS_CONTINUITY.md` | NEW (cross-ref `MULTI_REGION_FAILOVER_SPEC` Wave 3) |
| `docs/policies/VENDOR_MANAGEMENT.md` | NEW |
| `docs/policies/EMPLOYEE_ONBOARDING.md` | NEW |
| `docs/policies/EMPLOYEE_OFFBOARDING.md` | NEW |
| `docs/policies/ACCEPTABLE_USE.md` | NEW |
| `trust.sitesync.com` (subdomain) | NEW — Vanta TrustHub-powered |

---

## Appendix A — Why Pen Test Belongs to SOC 2 Readiness

Pen test is technically a separate engagement, but SOC 2 Type II audit firms expect a recent (within 6 months) pen test report. We engage pen test 1 month before observation window starts (Sept 2026); report available for entire window. Re-test annually thereafter.

Pen-test firm shortlist:
- **Cobalt** — best for SaaS startups; PtaaS model; ~$25-40K
- **NetSPI** — bigger; ~$40-80K
- **Bishop Fox** — boutique; ~$50-100K
- **Trail of Bits** — if also doing hash chain attestation, bundle for discount

Recommend Cobalt for first round; level up to NetSPI/Bishop Fox if customer demands.

---

## Appendix B — Walker's "Don't" List During Observation Window

These are the patterns that destroy SOC 2 evidence — avoid them:

- ❌ Bypassing 2FA "just this once" on a personal account that has prod access
- ❌ Adding a new vendor without documenting the vendor review (even small things — a new monitoring tool counts)
- ❌ Sharing passwords (1Password is mandatory)
- ❌ Letting an offboarded employee retain access for "a few extra days"
- ❌ Skipping a quarterly access review because it's busy
- ❌ Closing an incident without a postmortem
- ❌ Approving your own pull request (CC8 violation)
- ❌ Disabling a CI gate "for the demo" without documented exception

Each of these = restart the control's observation window for that control. Discipline matters.
