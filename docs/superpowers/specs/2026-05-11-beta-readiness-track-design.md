# Beta Readiness Track — Design

**Date:** 2026-05-11
**Authors:** Walker (driver) + Claude (brainstormer)
**Plan source:** `~/.claude/plans/did-lap-3-finish-proud-lamport.md`
**Status:** Approved. Subsystem #1 brainstorm is the next step.

---

## Context

Walker has externally committed not to deliver to anyone before **July 1, 2026**. The launch shape is a **20+ GC self-serve beta** with **free-trial-then-paid** billing and a **multi-page marketing site** that does not yet exist. The Beta Readiness Track is the customer-facing substrate that turns today's IRIS-shipped product into something a self-serve cohort can actually use.

This program runs **in parallel with the IRIS Nativeness Plan** (Lap 5 = Phase 4 Insight Slot, Lap 6 = Phase 5 Multimodal, Lap 7 = Phase 6 Firm Memory). It does **not** take a "Lap N" label — those belong to the IRIS sequence per Walker's existing convention. Receipts under this track use the `BRT_<SUBSYSTEM>_<DATE>.md` prefix.

Today's product surface is frozen for the duration of this track. The work is finishing what exists, not adding to it.

---

## Profile: Approach B (Solid Beta)

Walker selected the higher-scope, zero-buffer "Solid Beta" over the leaner "Lean Beta" alternative.

| Choice | Picked | Reason |
|---|---|---|
| Marketing site | 4-page (hero + features + pricing + signup/login) | First impression of a beta cohort matters; 1-page invites questions Crisp will absorb |
| Sign-up | email/password + verify + Google OAuth | OAuth is table-stakes for B2B SaaS in 2026 |
| Billing | Stripe Checkout, **card upfront**, 14-day trial, single tier | Card-upfront removes dunning complexity; single tier removes feature-gating bugs |
| Onboarding | Wizard + sample data + tooltips | 20+ GCs can't all get a Zoom from Walker; UX has to do the explaining |
| Support | Crisp/Intercom widget + ~20 markdown help articles + admin impersonation | Self-serve only works with self-serve answers |
| Observability | Sentry + PostHog per-tenant + Slack alerts | If 20 orgs hit a bug, Walker needs to know within minutes |
| Production hardening | Rate limits + 50-org scale test + backup/restore drill | One bad tenant cannot DoS another; one corrupted tenant must be restorable |

**Total effort:** ~33–42 engineering days over ~50 calendar days. Mathematically possible only if subsystems 5–7 truly run in parallel.

---

## The 8 subsystems

### Critical-path (block each other)

#### Subsystem 1 — Org provisioning + multi-tenant verify
- **Scope:** Auto-create a tenant on signup. Seed default project + role assignments. Verify data-isolation boundaries hold against the existing SSO/SCIM/roles substrate (Tab A IT Pack, already shipped). Bootstrap script creates a "first project" inside a fresh tenant with realistic-but-anonymized fixture data.
- **Depends on:** Nothing. SSO/SCIM/roles are already live (per memory `project_tab_a_it_pack`).
- **Acceptance:** A new org provisioned via the API in <2s, with: 1 default project, owner role assigned, RLS policies enforce isolation against a sibling tenant in 100% of cross-tenant probe tests, no shared global state introduced.
- **Effort:** 3–4 days.

#### Subsystem 2 — Self-serve sign-up
- **Scope:** `/signup` route accepts email + password OR Google OAuth. Email verification via Resend (transactional provider) with SPF/DKIM/DMARC configured Week 1. Magic-link recovery for forgotten passwords. Invite-team flow at signup so the first user can pull in colleagues immediately.
- **Depends on:** Subsystem 1 (org provisioning fires on first verified signup).
- **Acceptance:** A new visitor can go from `/signup` → email verified → org provisioned → onboarding wizard in <5 minutes without Walker's involvement. Google OAuth path completes in <90s. Magic-link recovery works end-to-end.
- **Effort:** 4–5 days.

#### Subsystem 3 — Onboarding wizard + sample data
- **Scope:** Three-step wizard after sign-up — (1) confirm org name, (2) create or select sample project, (3) invite team. First-visit tooltips on each major page (RFI, Submittals, Daily Log, Drawings, IRIS chat) so the user discovers the product without reading docs. Sample project includes 3 fixture RFIs, 1 daily log, 2 drawings, and 1 submittal so IRIS has something to talk about.
- **Depends on:** Subsystem 2.
- **Acceptance:** A user who completes the wizard reaches the dashboard in <90s and can perform their first IRIS query in <2 minutes from signup.
- **Effort:** 4–5 days.

#### Subsystem 4 — Stripe billing
- **Scope:** Stripe Checkout with card collected at signup. 14-day trial countdown surfaced in-app (banner + dashboard widget). Single tier, no feature gating. Stripe Customer Portal for cancellation. Idempotent webhook handlers for `customer.subscription.created/updated/deleted` and `invoice.paid/failed`. Reconciliation cron (daily 02:00 UTC) catches dropped webhooks.
- **Depends on:** Subsystem 2.
- **Acceptance:** A user can sign up with card → enter trial → see countdown → convert to paid on Day 15 → cancel via portal → all without human touch. Webhook drop-and-retry test passes (simulated 503 → reconciliation cron picks it up within 24h).
- **Effort:** 6–7 days.

### Parallel-track (don't block critical path)

#### Subsystem 5 — Marketing site
- **Scope:** 4-page Astro static site at `sitesync.ai` (or chosen domain). Hero, features grid, pricing, signup/login. Deployed separately from the app (Vercel or Cloudflare Pages). Copy is the bottleneck — Walker drives copy in Week 1, engineering integrates Week 4.
- **Depends on:** Nothing structurally. Can run end-to-end alongside critical path.
- **Acceptance:** Site loads under 1.5s LCP on 3G mobile; signup CTA links to `/signup` on the app domain; pricing page reflects the actual Stripe price; login link routes to app `/login`.
- **Effort:** 6–8 days (mostly copy + design; engineering ~2 days).

#### Subsystem 6 — Support tooling
- **Scope:** Crisp or Intercom widget embedded in app + marketing site. ~20 markdown help articles covering the most likely first-week questions (signup, onboarding, IRIS basics, RFI workflow, billing). Admin impersonation tool for Walker to view-as-user when debugging support tickets.
- **Depends on:** Subsystem 1 (impersonation needs to honor multi-tenant boundaries).
- **Acceptance:** A user who clicks the widget gets a response within Crisp's SLA; help articles index in Crisp's search; impersonation logs every entry/exit to the audit trail per `project_tab_a_audit_pack`.
- **Effort:** 3–4 days.

#### Subsystem 7 — Observability
- **Scope:** Sentry SDK already installed (per `package.json`); add per-tenant tags to every error report. PostHog per-tenant dashboards (one row per org with health score). Slack alerts on: 5xx error rate >1% over 5 min, trial-end conversion drops >20% week-over-week, new error class affecting >2 tenants.
- **Depends on:** Subsystem 1 (per-tenant tagging needs the org_id helper).
- **Acceptance:** A test 5xx burst of 100 errors in 60s triggers a Slack alert within 10 minutes; per-tenant dashboard shows an outlier within 30 minutes of issue start.
- **Effort:** 3–4 days.

#### Subsystem 8 — Production hardening
- **Scope:** Per-tenant rate limits (Supabase Edge Function middleware). 50-concurrent-org scale test using a load harness (k6 or Artillery). Backup/restore drill: pick one tenant, dump, restore to a sibling project, verify data integrity. Capacity headroom check: confirm DB + edge fns can handle 5x the launch cohort without scaling action.
- **Depends on:** Subsystems 1–4 fully shipped (need real signup → onboarding → billing → in-app paths to load test).
- **Acceptance:** Scale test holds <p95 800ms response time at 50 concurrent orgs; rate limits prevent any single tenant from consuming >20% of edge fn capacity; backup/restore drill completes in <30 min with zero data loss.
- **Effort:** 4–5 days.

---

## Sequencing

| Week | Critical path | Parallel |
|---|---|---|
| 1 | #1 Org provisioning | #5 Marketing site copy + design (Walker) |
| 2 | #2 Sign-up + email verify + Google OAuth | #3 Onboarding wizard scaffolding |
| 3 | #3 Onboarding finishes | #4 Stripe scaffolding |
| 4 | #4 Stripe trial + webhooks | #5 Marketing site engineering build |
| 5 | #4 Stripe billing portal + dunning | #6 Crisp + help docs |
| 6 | #7 Observability instrumentation | #8 Production hardening starts |
| 7 | #8 Scale test + backup drill + soft-launch dress rehearsal | — |

---

## Critical risks (designed-against from Day 1)

1. **Email deliverability.** Resend or Postmark + SPF/DKIM/DMARC must be configured in Week 1, not Week 5. Late email setup destroys trial conversion.
2. **Stripe webhook reconciliation.** Idempotent handlers + reconciliation cron from Day 1, not added when bugs surface in Week 6.
3. **Multi-tenant data isolation.** Any shared-state bug surfaces under 50 concurrent orgs. Deliberate isolation pen-test in Week 6 before scale test.

---

## Verification (the July 1 checklist)

The Beta Readiness Track is "done" when a fresh visitor can:

- Land on the marketing site, read it, click a CTA
- Sign up with email/password OR Google OAuth, verify email
- Provision their org in <60s
- Walk through the onboarding wizard with sample project data
- Hit Stripe Checkout, enter card, begin a 14-day trial
- Use any feature the product currently offers (RFI, Submittals, Daily Log, Drawings, IRIS chat, auto-execute) without help
- Get help via the Crisp widget or markdown docs if stuck
- Be observed via Sentry + PostHog by Walker on the admin side
- Have their data isolated from any other org's data (verified via pen-test)
- Survive a 50-concurrent-org scale test without 5xx spikes
- Convert to paid on Day 15 via Stripe billing portal without human touch

The track is **not** done if any of those fail or require human handoff.

---

## Frozen scope (what is NOT in this track)

- New product features beyond what's already shipped today
- IRIS Phase 4/5/6 work (Lap 5/6/7, executed by other sessions)
- Sales/demo/contract motion (Walker handles externally)
- Mobile-native rebuild (Capacitor scaffold already shipped)
- Refactoring or architectural improvements unless they unblock a subsystem here
- Multi-region / chaos testing / SOC2 (deferred to post-launch)

---

## Naming contract

To avoid colliding with `LAP_N_*` and `PHASE_N_*` namespaces:
- Receipts: `docs/audits/BRT_<SUBSYSTEM>_<DATE>.md`
- Branches: `brt-<subsystem>` (e.g., `brt-org-provisioning`, `brt-signup`, `brt-stripe`)
- PR titles: prefix with `brt:` (e.g., `brt: org provisioning + tenant isolation verify`)
- Tests: under existing test directories; no new namespace needed

---

## Reconciliation footnote

Earlier on 2026-05-11 a different "Lap 4" plan ran in parallel — IRIS Phase 3 (Universal Knowledge Absorption) per `~/.claude/plans/user-approved-claude-s-plan-delegated-firefly.md`. That session shipped PRs #434–438 plus the closeout #440, and `LAP_4_KICKOFF_RECEIPT_2026-05-11.md` is on main declaring Lap 4 = Phase 3 done. The Beta Readiness Track is the parallel customer-facing program; it does not relabel that work and does not block it.
