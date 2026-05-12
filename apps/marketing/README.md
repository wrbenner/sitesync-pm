# SiteSync Marketing Site

Astro static site for `sitesyncai.com` (apex). The product app lives at `app.sitesyncai.com` (separate Vercel project).

**Spec:** `BRT_SUBSYSTEM_5_MARKETING_SITE.md`

## Develop

```bash
cd apps/marketing
npm install
npm run dev   # http://localhost:4321
```

## Build

```bash
npm run build
npm run preview
```

Static output goes to `dist/`.

## Deploy

Configured to deploy as its own Vercel project pointed at this directory. The root `sitesync-pm` Vercel project deploys the React app to `app.sitesyncai.com`. **Do not merge marketing and app deploys** — they have different uptime profiles and the marketing site is heavily cached at the edge.

## Pages

| Route | Source |
|---|---|
| `/` | `src/pages/index.astro` — hero + 3 features + bottom CTA |
| `/features` | `src/pages/features.astro` — the Nine + Iris explainer |
| `/pricing` | `src/pages/pricing.astro` — single tier + competitors + FAQ |
| `/about` | `src/pages/about.astro` |
| `/signup` | redirects to `app.sitesyncai.com/signup` (UTM-preserving) |
| `/login` | redirects to `app.sitesyncai.com/login` |
| `/legal/terms` | placeholder pending counsel |
| `/legal/privacy` | placeholder pending counsel |
| `/legal/dpa` | placeholder pending counsel |

## Design

Per BRT_FOUNDER_DEFAULTS: Option B "Modern SaaS" palette (`#0F172A` slate primary, `#0066FF` electric blue accent), Inter font family.

## Performance gates

Per spec §4.1:

- Lighthouse Performance ≥ 95 on `/` mobile
- Lighthouse a11y ≥ 95 on every page
- Lighthouse SEO ≥ 95
- Total JS shipped on `/` ≤ 50 KB

CI Lighthouse job to be added in a follow-up slice.

## What's NOT in this scaffold

- Real OG images (defaults will 404 until generated; placeholder in `public/og/default.png` to be added)
- Logo SVG (placeholder)
- Counsel-drafted ToS / Privacy / DPA (placeholders with banners)
- Lighthouse CI workflow
- Sitemap submission to Google Search Console (manual one-time step)
- Analytics (PostHog from the app shares the project ID; marketing will fire `marketing_page_view` events from a small client-side script in a follow-up slice)
