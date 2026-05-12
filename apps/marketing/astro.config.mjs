import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// BRT subsystem 5 — public marketing site for sitesyncai.com (apex).
// The app proper lives at app.sitesyncai.com (separate Vercel project).
// Static-only; no SSR; ships ≤ 50 KB JS on the homepage per Lighthouse gate.

export default defineConfig({
  site: 'https://sitesyncai.com',
  integrations: [
    tailwind(),
    sitemap(),
  ],
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  trailingSlash: 'never',
});
