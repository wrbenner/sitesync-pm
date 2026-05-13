# OG Images — Walker post-receipt task

Social-preview images go here as **1200 × 630 PNGs**. Required for:
- `og/index.png` — homepage
- `og/features.png` — features page
- `og/pricing.png` — pricing page

## Why this isn't in the receipt

PNG generation requires image-rendering tooling (canvas API or headless
browser) that wasn't available during the Track B engineering pass.
Three quick paths to producing them:

1. **Vercel OG image generation** at `@vercel/og` — render Astro components
   to PNG at build time. Adds a build dep; works well with Astro.
2. **Figma export** — design templates once at 1200×630; export 3 PNGs.
3. **Static screenshot** — run the marketing site locally with each page
   styled for OG (large heading + brand mark), screenshot at 1200×630.

## Reference palette (Option A — Walker pre-auth)

- Construction navy: `#1B2D4A`
- Safety orange: `#E87722`
- Warm white: `#FAF8F4`
- Body ink: `#1A1A1A`

## Required content per image

Each PNG must include:
- SiteSync logomark (orange "S" on navy)
- Page-appropriate headline (≤ 12 words)
- "sitesync.ai" footer mark
- Mobile-readable contrast (4.5:1 minimum)

When the PNGs land, update `BaseLayout.astro` to point `<meta property="og:image">` at the per-page file.

— Walker dashboard task —
