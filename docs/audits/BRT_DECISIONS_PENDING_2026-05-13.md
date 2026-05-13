# BRT — Decisions Pending Walker Initials

Four small decisions where the spec defaults are already drafted into the BRT subsystem docs but need Walker's explicit lock-in before downstream work depends on them. Each ships immediately with the default value; signing flips it from "implicit assumption" to "committed contract."

The pricing decision is filed separately at [`BRT_PRICING_DECISION_2026-05-13.md`](./BRT_PRICING_DECISION_2026-05-13.md) because it requires a downstream live-DB update.

---

## Decision 1 — CAPTCHA provider for self-serve signup

**Spec reference:** `BRT_SUBSYSTEM_2_SELF_SERVE_SIGNUP.md` §3 line 69, §4 (`Turnstile.tsx` component), §6 (risk register row 2)
**Default:** **Cloudflare Turnstile** (free tier, privacy-friendly, no GDPR cookie banner)
**Why default:** $0 marginal cost; CDN-fronted (low latency); no Google-tracking concerns; trivial widget swap if we ever outgrow it.
**Alternatives considered:** hCaptcha (also free; less popular UX), reCAPTCHA v3 (Google-tracking baggage; not GDPR-clean by default)

```
[ ] Lock in Turnstile (recommended)
[ ] Other: ____________

Initials:  __________
```

When signed, Claude Code adds a `CAPTCHA` row to the Sub-2 frontmatter table reading `Cloudflare Turnstile (locked 2026-05-__)`.

---

## Decision 2 — Marketing site color palette

**Spec reference:** `BRT_SUBSYSTEM_5_MARKETING_SITE.md` §6 (palette options)
**Default:** **Option A — construction navy** per `SiteSync_Board_Master_Brief.md` §13.2 brand reference
**Why default:** brand consistency with the in-app theme; navy reads as serious/trustworthy to GC + owner personas; high contrast for accessibility.
**Alternatives considered:** Option B (lighter / consumer-y); Option C (bolder construction-yellow accent)

```
[ ] Lock in Option A — construction navy (recommended)
[ ] Option B
[ ] Option C
[ ] Other: ____________

Initials:  __________
```

When signed, Sub-5 frontmatter gets `Palette` row locked + the spec's §6 alternatives section trimmed to the chosen option.

---

## Decision 3 — Stripe Tax

**Spec reference:** `BRT_SUBSYSTEM_4_STRIPE_BILLING.md` §4.1
**Default:** **Enable Stripe Tax** (automatic calculation + remittance)
**Why default:** ~10 min wiring (one flag in product/price creation); zero marginal SaaS cost at our volume; eliminates a manual sales-tax bookkeeping burden that would otherwise become a Phase-3 SOC-2 audit finding around financial-data accuracy.
**Alternatives considered:** Avalara (overkill at sub-$1M ARR); manual tax (compliance risk).

```
[ ] Enable Stripe Tax (recommended)
[ ] Defer — pick when first taxable customer signs up
[ ] Other: ____________

Initials:  __________
```

When signed, Sub-4 frontmatter gets `Tax provider` row locked.

---

## Decision 4 — CAPTCHA (above), Palette (above), Tax (above) all confirmed?

Once you've initialled the three rows above, sign here to confirm Claude Code can update the three spec frontmatters in one PR:

```
All three locked in:  __________   Date: 2026-05-__
```

Claude Code response after signature:
1. Adds the 3 locked rows to the respective Sub-2/4/5 frontmatter tables.
2. Trims any "Option B / Option C" or "Alternatives considered" sections to a single line referencing this doc.
3. Single PR `chore(brt): lock pending decisions (CAPTCHA / palette / tax)`.
4. Files a one-line confirmation back here.

---

**Standing rule:** Decisions deferred past Subsystem 1 (Org Provisioning) execution block downstream subsystems. Sub-2 needs CAPTCHA locked before the signup form ships. Sub-4 needs Tax locked before the Stripe product wiring lands. Sub-5 needs palette locked before the marketing-site repo is generated.
