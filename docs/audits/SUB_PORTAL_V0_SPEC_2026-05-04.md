# Sub Portal v0 Spec

**Date:** 2026-05-04
**Status:** Spec ready. Build Q3 2026 (Aug-Sept). Live by Oct 2026 per Reverse-Engineered T-180.
**Companion specs:** `SUB_PORTAL_V1_SPEC` (forthcoming Q4 2026 — multi-GC view, signed-waiver auto-attach, notifications), `COI_INGESTION_SPEC_2026-05-04.md` (the wedge differentiator inside the portal), `MAGIC_LINK_AUTH_ADR` (forthcoming, sister)
**Format reference:** Standard product feature spec.

---

## TL;DR

The sub portal is the network-effect wedge per Field Manual Part IV. **v0 ships:**

- Magic-link onboarding (60 sec from QR scan to in-app)
- Three tabs: My Projects, My Pay Apps, My Documents
- Pay-app draw submission (integrates with GC's pay-app workflow)
- COI upload + AM Best validation (per `COI_INGESTION_SPEC` — the moat)
- Lien waiver download (state-specific templates)

**Free for subs forever.** No tier; no upgrade. Same product for everyone.

After v0: subs across 2+ GCs ask their next GC, "can you put this on SiteSync?" → bottom-up adoption.

This spec covers: subdomain routing, the 3 tabs, magic-link mechanics, Spanish localization (essential for sub demographics), and the v0 → v1 upgrade path.

---

## Architecture

### Subdomain routing

```
[GC's primary domain] → app.sitesync.com (the GC product)
[Subs use:] sub.sitesync.com (the sub portal)
```

Same Supabase backend, RLS-enforced isolation. Subs never see GC's internal data; GCs never see other GCs' subs.

### Magic-link landing

```
sub.sitesync.com/onboard?token=<JWT>

→ JWT validated → if valid → landing page
→ if expired → "Link expired" + new-link request flow
```

### Three tabs (responsive web; mobile-friendly; later iOS/Android via the same RN codebase)

- **/my-projects** — list of projects this sub is on (across all GCs they've worked with)
- **/my-pay-apps** — pay-app submissions across projects
- **/my-documents** — COIs, waivers, certs

---

## Magic Link Onboarding (the 60-second flow)

### Step 1 — GC adds sub to project (5 sec from GC side)

GC opens project → Subs tab → "Add sub" → enters sub's name + email + phone + trade.

System generates: a JWT token containing (sub_user_id, organization_id, project_id, expires_at). Token expires 30 days from creation.

### Step 2 — Sub receives QR/link (varies — typically email)

GC sends contract page with QR code (printed) OR email with link OR text message.

```
Subject: You're on the [GC Name]'s [Project Name] team

Hi [Sub Name],

You've been added to [Project Name] by [GC Name]. To get started, scan this 
QR code or click the link below — it takes 60 seconds.

[QR CODE]

[Link: sub.sitesync.com/onboard?token=eyJh...]

You'll be able to:
- Submit pay-app draws
- Upload your COI
- Download lien waivers
- Track your retainage

This is free for you. Always.

— [GC Name] via SiteSync
```

### Step 3 — Sub clicks link / scans QR (10 sec)

Lands on `sub.sitesync.com/onboard?token=...`. Token validates server-side.

### Step 4 — Sub creates magic-link auth (20 sec)

```
Welcome [Sub Name].

You've been added to [Project Name] by [GC Name].

To get in:

[Email me a sign-in link]   [or use Apple Sign-In]

(One-time setup — after this, you'll just stay signed in.)
```

Email arrives in seconds; sub clicks; signed in.

### Step 5 — Sub lands on dashboard (5 sec)

```
Welcome [Sub Name].

[Project Name] - [GC Name]
Status: Active

What you can do:
[Submit pay-app draw]   [Upload COI]   [Browse docs]

What's pending:
- COI expiring 2026-06-15 — please update
- Pay app due 2026-04-30
```

Total time from QR scan to landing on dashboard: **~60 seconds.**

---

## Tab 1 — My Projects

```
┌────────────────────────────────────────────────────┐
│  My Projects                                        │
│                                                      │
│  Active (2)                                          │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  [Project A] - [GC Name]                    │    │
│  │  Started: 2026-03-15                        │    │
│  │  Phase: Drywall installation                 │    │
│  │  My contract: $245,000                       │    │
│  │  Pay app to date: $189,000 (78%)             │    │
│  │  Retainage held: $9,450                      │    │
│  │                                              │    │
│  │  [View Details]                              │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Closed (3)                                          │
│  ...                                                 │
└────────────────────────────────────────────────────┘
```

Per-project details:
- Project name + GC name
- Sub's contract (read-only)
- Schedule visibility (sub's activities only — RLS enforced)
- Pay-app history
- RFI activity related to this sub
- Documents on file

What sub does NOT see: other subs' contracts, GC's internal docs, GC's sub list, other project details.

---

## Tab 2 — My Pay Apps

```
┌────────────────────────────────────────────────────┐
│  My Pay Apps                                        │
│                                                      │
│  Submit a new pay-app draw                          │
│  [Submit Pay App]                                    │
│                                                      │
│  Open (1)                                            │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  Pay App #4 - [Project A]                   │    │
│  │  Period: 2026-04-01 → 2026-04-30            │    │
│  │  Submitted: 2026-04-30                       │    │
│  │  Status: Pending GC review                   │    │
│  │  Amount: $42,000                              │    │
│  │  ⏰ Awaiting [GC Name]'s approval            │    │
│  │                                              │    │
│  │  [View Submitted]                            │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Approved (Last 5)                                  │
│  - Pay App #3 - $38,000 - approved 2026-03-30       │
│  - ...                                               │
└────────────────────────────────────────────────────┘
```

### The pay-app submission flow

```
Step 1: Pick the project
Step 2: Pay App Number (auto-suggested; sub confirms)
Step 3: Period dates
Step 4: Schedule of values (line items)
        - Pre-populated from contract; sub fills in % complete
        - Calculates: completed-this-period, total-completed, retainage
        - All money in integer cents
Step 5: Materials stored (optional)
Step 6: Less retainage (calculated; sub confirms)
Step 7: Lien waiver (auto-generated, state-specific)
        - Conditional waiver pre-prepared (state-correct statutory text)
        - Sub e-signs (DocuSign-style native flow)
Step 8: Submit
```

What sub gets after submitting:
- PDF receipt with everything they signed
- Status notification when GC reviews
- Audit-chain provenance of the submission
- Email + SMS when payment clears (post-Embedded Payments April 2027)

---

## Tab 3 — My Documents

```
┌────────────────────────────────────────────────────┐
│  My Documents                                        │
│                                                      │
│  Active across all my GCs                           │
│                                                      │
│  📄 COI (Insurance)                                 │
│      [GC Name 1] - expires 2026-06-15 (60 days)     │
│      [GC Name 2] - expires 2027-01-30                │
│      [Upload new]                                    │
│                                                      │
│  📄 W-9                                              │
│      [Upload current]                                │
│                                                      │
│  📄 Lien Waivers (signed)                           │
│      Project A - 4 waivers signed                   │
│      Project B - 2 waivers signed                   │
│                                                      │
│  📄 Bonding Documents                               │
│      [Upload]                                        │
└────────────────────────────────────────────────────┘
```

The COI workflow is the killer feature (per `COI_INGESTION_SPEC` — separate document).

---

## Localization

**English + Spanish at GA.** Construction subs are disproportionately Spanish-speaking, especially in TX/CA/FL/AZ.

All UI translated. Critical translations:
- "Submit pay app" → "Enviar solicitud de pago"
- "Upload COI" → "Subir certificado de seguro"
- "Lien waiver" → "Renuncia de gravamen"
- "Retainage" → "Retención" (or "Garantía retenida" depending on region)

Spanish reviewed by bilingual super in Walker's network (per `BUGATTI_LAUNCH_ROADMAP` Program 3.7).

---

## v0 → v1 Upgrade Path

### v0 (Q3 2026)

- Single-GC view per session
- Submit pay-app, upload COI, download waivers
- Email-based notifications
- Web only (mobile-friendly responsive)

### v1 (Q4 2026)

- Multi-GC view (sub on multiple GCs sees unified dashboard)
- Push notifications for pay-app status, COI expiry
- iOS/Android native app (same RN codebase + Sub Portal screens)
- Signed-waiver auto-attach to GC's payment workflow
- Sub-side analytics (which GCs pay fastest? Performance metrics)

### v2 (Q2 2027 post-launch)

- Embedded Payments — sub gets paid same business day GC approves
- Sub-to-GC referral mechanic ("recommend SiteSync to your other GCs")
- Multi-language: Spanish + English (EN/ES at GA per v0); v2 may add others

---

## Free Forever — and Why

The sub portal is **never paid.** This is the wedge per Field Manual Part IV.

We will hear: "Could we charge subs a small fee, $5/month?" The answer is no. The math is asymmetric:

- $5/sub/month × 1000 subs = $60K/year
- Network-effect-driven distribution → if 50% of subs ask their next GC for SiteSync = ~250 new GCs at average $50K ACV = $12.5M ARR

The free model multiplies: paid sub portal would 2x our revenue from existing subs but 100x decrease our distribution.

Documented as immutable in `docs/audits/SUB_PORTAL_V0_SPEC` and embedded in pricing decision (`PRICING_DECISION_DOC` ADR-012).

---

## Acceptance Criteria for v0 to Be "Shipped"

1. Magic-link onboarding works end-to-end in < 60 sec (verified)
2. 5 subs onboarded via magic-link in < 2 min each on day 1 of pilot
3. Each sub successfully completes:
   - 1 pay-app submission
   - 1 COI upload
   - 1 lien waiver download
4. RLS audit confirms zero cross-tenant data exposure
5. Spanish UI complete + verified by bilingual super
6. AM Best validation working on 100 test COIs with < 1% false positive
7. Sub portal LIVE at sub.sitesync.com

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| SP-1 | Subs don't onboard via magic-link (technical issue, language barrier) | Medium | High (kills wedge) | Pilot v0 with Brad's pilot's top 5 subs; iterate on magic-link copy + Spanish UI |
| SP-2 | Subs see other GC's data (RLS bypass) | Low | Critical | Adversarial testing pre-launch; bug bounty live by Q4 |
| SP-3 | Pay-app submission flow too complex; subs abandon | Medium | High | A/B test with real subs; iterate |
| SP-4 | COI upload AM Best validation has false positives (rejects valid carriers) | Medium | Medium | Manual override path; ongoing learning |
| SP-5 | GC tries to charge subs (against policy) | Low | Critical | Pricing locked in MSA; backed by Eleven Nevers reframe |
| SP-6 | Sub multi-GC view (v1) breaks performance at scale | Low | Medium | Performance-test pre-v1; architecture supports this |

---

## What Walker Does With This Spec

1. Confirm v0 scope; flag any tab that's wrong
2. Identify 5 subs (across Brad's pilot + Carleton if active) for v0 pilot
3. Identify bilingual super for Spanish review

---

## What Claude Code Does

- Build the magic-link auth flow + JWT signing (~3 days)
- Build the three tabs UI (~5 days)
- Build the pay-app submission flow (~5 days, complex form)
- Build the lien waiver generation + download (~3 days)
- Spanish translations + i18next setup (~3 days)
- Build subdomain routing + RLS for sub-only views (~2 days)
- Pilot with 5 subs + iterate (~3 days)

Total: ~24 days through Aug-Sept 2026.

---

## What this spec deliberately does NOT cover

- COI ingestion + AM Best validation (covered by `COI_INGESTION_SPEC`)
- Multi-GC view (v1 — Q4 2026)
- Sub-to-Sub messaging (year 2+)
- iOS/Android sub portal (v1 — Q4 2026, same RN codebase)
- Sub-side analytics dashboard (v1+)
- Embedded payments to sub bank account (v2 — April 2027)
