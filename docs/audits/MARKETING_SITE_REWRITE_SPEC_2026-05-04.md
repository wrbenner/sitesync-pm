# Marketing Site Rewrite Spec

**Date:** 2026-05-04
**Status:** Spec ready. Build kicks off Aug 2026 with designer + content writer; live by Day 78 of Lap 3 (~July 1) skeleton + iterations through Q4 2026 → public launch March/April 2027.
**Companion specs:** `BRAND_VISUAL_IDENTITY_SPEC_2026-05-04.md` (forthcoming Wave 3, the visual language), `PRICING_DECISION_DOC_2026-05-04.md` (pricing page content), `BATTLECARDS_FRAMEWORK_2026-05-04.md` (vs-Procore comparison page derives from these), `SALES_DECK_v1_2026-05-04.md` (deck content informs site content)
**Format reference:** Standard SaaS marketing-site IA + content + tech stack. Lethal-calm aesthetic per Bugatti framing.

---

## TL;DR

Today's site (assume basic landing page + signup) gets rewritten as a category-defining presence with **9 core pages** + a **Procore Groundbreak response landing page** (drafted Sept 2026; finalized within 6 hours of Procore's announcement). Built in **Astro** (SSG, fast, modern); deployed on Vercel; ≤ 200 KB initial load.

The site IS the seed-deck public-facing version. Investor reading the homepage should land on the same narrative the deck delivers in the room.

This spec covers: information architecture, page-by-page content, technical stack, brand visual decisions (cross-references the visual identity spec), launch sequence, and post-launch growth.

---

## Information Architecture

### Top-level navigation

```
SiteSync
├── Product
│   ├── Iris (the AI agent)
│   ├── Audit Chain (the moat)
│   ├── Sub Portal (free for subs)
│   ├── Embedded Payments (April 2027)
│   └── Field App (mobile)
├── Solutions  
│   ├── For PMs (workflow + AI)
│   ├── For CFOs (audit + payments)
│   ├── For Field Supers (mobile-first)
│   └── For Subcontractors (free portal)
├── Compare
│   ├── vs Procore
│   ├── vs Trunk Tools
│   ├── vs Fieldwire
│   └── vs Buildots
├── Pricing
├── Customers
├── Resources
│   ├── Blog (Walker's posts)
│   ├── Documentation
│   ├── Trust Center (security, compliance)
│   ├── Audit Chain Whitepaper
│   ├── Demo Video
│   └── API Docs (Pro/Enterprise)
├── Company
│   ├── Founders + Team
│   ├── Manifesto / Eleven Nevers
│   ├── Press
│   └── Careers
└── [Get Started] [Talk to Sales]
```

### Public footer

- Copyright + version
- Trust badges (SOC 2 Type II ✓ once obtained; Hash Chain Attested ✓ Oct 2026)
- Status page link (status.sitesync.com)
- Sitemap
- Privacy + Terms + DPA

---

## Page-by-page Content

### Page 1 — Homepage

**Above-fold (the 5 second pitch):**

```
[HERO]
─────────────────────────────────────────────
The AI superintendent for construction.

Iris drafts the work — RFIs, daily logs, pay apps.
You approve. Subs use it free. Money moves the day
you approve.

[Talk to Sales →]   [See the demo →]
─────────────────────────────────────────────
[12-second demo loop, autoplays]
```

**Below-fold (4 sections):**

1. **The audit chain difference.** Mathematically tamper-proof. Trail of Bits attested. Side-by-side vs Procore.
2. **The free sub portal.** Network-effect wedge. "After two projects on SiteSync, your subs ask their next GC for it."
3. **The customer story.** [Carousel of 3 customer logos with one-line quotes — populated post-Oct 2026]
4. **The roadmap.** Timeline visual: today → Iris-as-actor → Embedded Payments April 30 2027 → category resets.

**Below the below-fold:**

- Trust badges (SOC 2, hash chain, $10M cyber insurance)
- "Talk to sales" form
- Footer

### Page 2 — Iris (the AI agent)

**Hero:**
> "Iris drafts. You approve. Every action audited."

**Sections:**
1. **What Iris does:** the 5 detector kinds (cascade, aging, variance, staffing, weather) with example use cases per kind
2. **How Iris works:** 3-step diagram (Watch → Draft → Approve)
3. **Confidence + citations:** every draft cites sources; threshold ≥ 0.92 for auto-execute
4. **The 60-second cancel window:** trust mechanism explained
5. **Voice:** "Iris speaks construction." Examples of before/after voice editing
6. **The roadmap:** "Today Iris drafts. Tomorrow Iris executes. Always with human approval."

### Page 3 — Audit Chain

**Hero:**
> "Mathematically tamper-proof. Court-defensible. Trail of Bits attested."

**Sections:**
1. **The problem:** policy-enforced audit logs (Procore) can be modified by admins. Cryptographically-enforced audit logs cannot.
2. **The construction:** SHA-256 hash chain; every row's hash includes previous row's hash. Tamper detection is mathematical certainty, not policy.
3. **External attestation:** Trail of Bits cryptographic audit Oct 2026; report public.
4. **Why CFOs care:** insurance carriers + bonding companies + arbitrators. Audit chain as evidence, not promise.
5. **Why subs care:** lien waiver auto-attach with chain provenance.
6. **Read the whitepaper:** [Download PDF — populated Oct 2026]

### Page 4 — Sub Portal

**Hero:**
> "Free for subs. Forever. The network-effect wedge."

**Sections:**
1. **What subs get:** projects view, pay-app submission, COI upload + AM Best validation, lien waiver download, multi-GC dashboard
2. **What's free:** everything. Always.
3. **How magic-link onboarding works:** 60-second activation; QR on contract page
4. **The network effect:** "After 2 projects, your subs ask their next GC for SiteSync."
5. **Vs Procore:** Procore charges subs $30K/year. We don't.

### Page 5 — Embedded Payments

**Hero:**
> "Approve a pay app. Money moves the same business day."

**Sections:**
1. **The problem:** pay apps approved Tuesday → check Friday → sub paid Monday. 7-day delay norm.
2. **The fix:** GC approves → ACH push same day → sub paid → lien waiver auto-attached
3. **The architecture:** Modern Treasury rails + multi-bank failover + audit-chain provenance
4. **Pricing:** transaction fees published transparently
5. **Available April 30, 2027** — large countdown timer
6. **Sign up for early access** form

### Page 6 — Field App

**Hero:**
> "Mobile-first. Field-tested in 95° heat with gloved thumbs."

**Sections:**
1. **What works in the field:** camera + voice + GPS + barcode + offline queue
2. **App Store + Play Store badges** (live Sept 2026)
3. **Field-test rig:** show the test scenarios (sun, glove, drop, dead zone, port-a-potty)
4. **TestFlight signup** (pre-launch)

### Page 7 — Pricing

(Per `PRICING_DECISION_DOC` — live transparent pricing)

### Page 8 — Compare

Three pages: vs Procore, vs Trunk Tools, vs Fieldwire (and Buildots, Newforma as supplementary).

Each page is the **public-facing version** of the battlecard (per `BATTLECARDS_FRAMEWORK`):
- Less internal frame
- More objective
- Acknowledge competitor strengths
- Show clear differentiators
- Pricing comparison side-by-side

### Page 9 — Customers (Day 78+)

Empty until Oct 2026 when reference customers commit. Populated with:
- 3+ customer logos
- 1 named case study with dollars-saved numbers
- 3 quote cards with attribution
- 1 video testimonial (post-Q4 2026)

### Page 10 — Procore Groundbreak Response (special)

This page lives on a separate URL (`sitesync.com/groundbreak-2026`). Drafted Sept 1, 2026. Walker fills in placeholders within 6 hours of Procore's keynote (Oct 6-8).

**Template:**

```
[Procore announces X at Groundbreak.] What it means.

[Walker's 90-second video response]

How SiteSync compares:
- We've had hash-chain audit since Day 1
- Subs use it free
- Embedded payments live April 30, 2027

Side-by-side feature comparison: [refreshed within 24 hours of announcement]

Talk to sales → [link]
```

### Page 11 — Resources

- Blog
- Documentation
- Trust Center
- Audit Chain Whitepaper
- Demo Video (90-second viral cut + 5-min product walk)
- API Docs

### Page 12 — Company

- Founders + Team (Walker bio + engineer #2 + GTM lead etc. as hires happen)
- Manifesto (one-page version of Eleven Nevers — adapted for public)
- Press (kit + recent coverage)
- Careers (open roles)

---

## Technical Stack

**Decision: Astro + Vercel** (or Cloudflare Pages — basically equivalent).

### Why Astro

- Static site generation with islands of interactivity (JS only where needed)
- TypeScript-first
- 50% smaller initial bundle than Next.js
- Excellent SEO (server-rendered)
- Component reuse with React/Vue/Svelte support

### Why Vercel

- Best DX for SSG + edge functions
- Preview deploys on every PR
- Edge runtime for the dynamic bits

### Stack

```
Astro 4.x (latest stable Q3 2026)
TypeScript strict
Tailwind CSS (matches design system)
React (for interactive widgets — pricing calculator, demo embed)
Headless CMS: Notion or Sanity
   - Walker writes blog in Notion → CMS pulls → Astro renders
Email: Klaviyo (per existing connector at start of session)
Analytics: PostHog (matches product) + Plausible
Forms: Formspree or built-in API routes
Search: Algolia (Resources/Docs)
Hosting: Vercel (or Cloudflare)
Domain: sitesync.com (need to verify owned; if not, secure now)
```

### Performance budget

- Initial page load: ≤ 200 KB
- Time to interactive: ≤ 1.5s
- Lighthouse score: ≥ 95 on all pages
- Mobile-friendly: 100/100 Mobile-Friendly
- Accessibility (WCAG 2.1 AA): 100/100 axe-core
- No tracking scripts on first page load (Klaviyo loads on email submit)

---

## Brand Visual Decisions (cross-reference visual-identity spec)

**Per `BRAND_VISUAL_IDENTITY_SPEC` (forthcoming Wave 3):**

- **Typography:** Inter (workhorse) for body; Söhne (display) for headlines
- **Colors:** deep slate (#1a1f2e), iris gold (#FFB347), construction safety orange (#FF6B35) for warnings only, slate gray (#6c757d), white space generous
- **Photography:** real construction sites, real PMs (with permission, not stock)
- **Charts/diagrams:** flat, geometric, no 3D, no gradient
- **Animation:** sparingly used; transitions ≤ 200ms; no carousel auto-play unless paused on hover
- **Voice:** lethal calm — no SaaS jargon, no "we believe," no exclamation points
- **Imagery:** lots of white space; photos full-bleed; subtle on-brand color accents
- **Logo:** small, footer, simple monogram

---

## Launch Sequence

| Date | Activity |
|---|---|
| **June 2026** | Designer hired (contract initially); IA + brand visual identity finalized |
| **July 2026** | Astro skeleton built; static homepage live (skeleton with placeholder content) |
| **Aug 2026** | All 9 core pages live with v0.1 content; iterate weekly |
| **Sept 1, 2026** | Procore Groundbreak response page DRAFTED (placeholder for what Procore announces) |
| **Sept 30, 2026** | Demo video v1 produced + embedded |
| **Oct 6-8, 2026** | **Procore Groundbreak event** — within 6 hours of keynote, response page finalized + announced via LinkedIn + Twitter + email |
| **Oct 31, 2026** | First case study live (3 reference customers committed) |
| **Dec 2026** | Site v1.0 — full launch-ready state |
| **Jan 2027** | SEO + content marketing motion in flight (Walker's blog 12+ posts) |
| **Mar/Apr 2027** | Embedded Payments page goes live with countdown timer |
| **Apr 30, 2027** | Launch day — front page rewrite to "Embedded Payments live" |

---

## Content writing strategy

Walker writes the **homepage hero, manifesto, blog**. Designer + content writer + PR firm produce the rest.

### Founder's blog

Walker commits to 1 post/week starting Aug 2026 (per ADR commitment from BUGATTI roadmap). Topics:
- Story of building SiteSync
- AI in construction (industry POV)
- Lessons from soft pilot
- Lessons from first paid contract
- The audit-chain story (not just feature, but why it matters)
- Hiring stories (engineer #2, etc.)
- Industry critique (carefully — no Procore-trashing)

Goal by April 2027: 25+ posts. Ranks on construction-tech-AI search terms. Builds personal brand for fundraising + recruiting.

### Customer case studies (post-Oct 2026)

Each case study is ~1500 words + 1 hero photo + 2 supporting visuals + 3 quotes. Format:

```
# [Customer Name] saved [N] hours per PM per week with SiteSync

## The challenge
[1 paragraph — context for the GC]

## The pilot
[1 paragraph — what they did]

## The numbers
[bullet list — hours saved, dollars caught, drafts approved]

## What changed
[1 paragraph — operational impact]

## What's next
[1 paragraph — their roadmap]

## Quote box
"..." — [Name], [Title]
```

---

## SEO + content marketing

Target keywords (post-launch):
- Tier 1 (high-intent): "Procore alternative", "construction PM software", "AI for construction PM"
- Tier 2 (mid-intent): "construction RFI software", "construction daily log software", "free sub portal"
- Tier 3 (educational): "what is hash-chain audit log", "construction software vs Procore", "construction tech 2027"

Content produced:
- Walker's blog (1/week)
- Industry guides (1/quarter — long-form: "Complete guide to construction RFI workflow")
- Case studies (1/month post-Oct 2026)
- Comparison pages (live; refreshed quarterly)
- Procore Groundbreak response (special)
- Whitepapers (audit chain — 1; Iris confidence calibration — 1; embedded payments — 1)

---

## What Walker Does With This Spec This Week

1. Confirm domain: sitesync.com is owned + accessible
2. Read the IA + content outline; flag any pages that don't match the strategy
3. Identify designer (contractor → contract → FT by Q2 2027)
4. Identify content writer (likely contractor)
5. Approve Astro + Vercel stack

---

## What Claude Code Does With This Spec

- Build Astro skeleton (Aug 2026 — 1 week)
- Build all 9 core pages with v0.1 content (Aug 2026 — 2 weeks)
- Maintain Procore Groundbreak response page draft (Sept 2026)
- Build pricing calculator interactive widget (Aug 2026 — 1 week)
- Build customer logo wall + case study layouts (Oct 2026)
- Build Trust Center page with SOC 2 + audit-chain badge (Aug 2026)
- Maintain content updates through launch
- Set up analytics + email capture infrastructure

Total Claude Code work: ~6 weeks of focused work spread across Aug-Dec 2026.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| MS-1 | Designer hire slips past July | Medium | Medium | Engage contract designer immediately; FT later |
| MS-2 | Site looks generic / not category-defining | Medium | High | Brand visual identity spec is the defense; designer with real opinion is the protection |
| MS-3 | Procore Groundbreak response slow / weak | Low | High | Page DRAFTED Sept 1; rehearse the fill-in; Walker on standby Oct 6-8 |
| MS-4 | Performance budget regresses | Medium | Medium | CI Lighthouse check; ≤ 200 KB initial load enforced |
| MS-5 | Customer logos / case studies don't materialize Oct 2026 | Medium | Medium | Multiple customers in pipeline by then; loss of one doesn't kill it |
| MS-6 | SEO doesn't take off | Low-Medium | Medium | Multi-channel: blog + comparison pages + paid LinkedIn ads + AGC convention; not solely SEO-dependent |

---

## What this spec deliberately does NOT cover

- Visual brand identity language (covered by `BRAND_VISUAL_IDENTITY_SPEC`)
- Demo video production (covered by `DEMO_VIDEO_SCRIPT_SPEC`)
- Documentation site / API docs (covered by `DOCUMENTATION_PLATFORM_ADR`)
- Customer support tooling (covered by `CUSTOMER_SUPPORT_TOOLING_ADR`)
- Onboarding flow (covered by `ONBOARDING_FLOW_SPEC`)
- Press kit (covered by `PRESS_KIT_SPEC`)
