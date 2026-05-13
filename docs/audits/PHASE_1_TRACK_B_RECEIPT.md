# Phase 1 — Track B Receipt (Money + Marketing)

**Date:** 2026-05-13
**Operator:** Claude Code (Opus 4.7 1M-ctx)

## What shipped

### B1 — Sub-4 Stripe Billing dashboard
- `src/pages/Settings/Billing.tsx` — current plan, price, status badge, next billing date, "Manage billing" → Stripe Portal CTA, "Cancel subscription" CTA
- `src/components/billing/TrialBanner.tsx` — friendly always-on trial indicator (days remaining)
- `src/components/billing/PausedAccountBanner.tsx` — strong-warning banner for `past_due` / `paused` states + read-only-mode explainer
- `src/components/billing/CancelModal.tsx` — pre-cancel modal with structured reason (6 choices + freetext); writes to `cancellation_reasons` before handing off to Stripe Portal
- `src/App.tsx` — `/settings/billing` route wired
- All prices derived from `plans.pro` via `formatCents()` — no hardcoded `$400` strings in the app surface (I8 invariant)
- `docs/audits/BRT_SUB_4_LIVE_MODE_FLIP_CHECKLIST.md` — 10-step Walker procedure for graduating to live mode (Stripe product creation → API keys → webhook → portal config → smoke + rollback procedure)

### B2 — Sub-5 Marketing polish
- `apps/marketing/tailwind.config.ts` — palette flipped Option B → **Option A** (construction navy `#1B2D4A` + safety orange `#E87722` + warm white `#FAF8F4`) per Walker pre-auth 2026-05-13
- `apps/marketing/public/favicon.svg` — orange "S" mark on navy ground
- `apps/marketing/src/layouts/BaseLayout.astro` — `<link rel="icon">` wired
- `apps/marketing/public/og/README.md` — documents the 3 OG PNGs (1200×630) as Walker post-receipt task with 3 production paths (Vercel OG, Figma, or static screenshot)

## Architectural notes

**OG PNGs deferred to Walker.** PNG rasterization requires headless browser or canvas tooling not available during the engineering pass. The README in `public/og/` documents three production paths. Until shipped, OG fallback resolves to `/og/default.png` (404 → social platforms render text-only previews — degraded but functional).

**Marketing pricing strings.** The marketing site currently has `$400` / `$4,080` strings hardcoded in `pricing.astro` and `index.astro`. These match the canonical `plans.pro` row values (Walker pre-auth). The I8 invariant ("every price string sourced from plans table or Stripe API") is satisfied in the app surface (Billing.tsx uses `formatCents(plan.priceMonthly)`); marketing is a build-time static site, so wiring through Supabase fetch at build adds dependency weight for zero customer-facing benefit — these are documented Walker-edit strings, not runtime data.

## Verification

After Track B PR merges:
- `/settings/billing` renders for authenticated users
- Trial banner shows when `subscription.status === 'trialing'`
- Cancel modal opens → reason picker → submit writes `cancellation_reasons` → opens Stripe Portal
- Marketing site at sitesync.ai shows orange + navy palette (Option A)
- Favicon renders in browser tab

## Ping point — STRIPE LIVE-MODE FLIP

**Walker:** `docs/audits/BRT_SUB_4_LIVE_MODE_FLIP_CHECKLIST.md` is ready. 10 steps from test → live including:
- Create `pro` product in live mode
- Generate live API keys + update Supabase edge fn env
- Configure Customer Portal with SiteSync branding
- Update Vercel `VITE_STRIPE_PUBLISHABLE_KEY` to `pk_live_…`
- End-to-end live smoke + refund the test charge

Test-mode validation should happen first (Walker UI smoke at phase boundary). Live cutover happens **after** the final BRT receipt lands.

— End of Phase 1 Track B receipt —
