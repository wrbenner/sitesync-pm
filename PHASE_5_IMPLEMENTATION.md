# Phase 5: Production Launch — Deploy, Monitor, Polish

You are working on SiteSync PM, a construction project management platform built with React + TypeScript + Vite + Supabase.

---

## Task 1: Deploy to Vercel

### Steps
1. Push repo to GitHub (if not already)
2. Connect repo to Vercel:
   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```
3. Set environment variables in Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Any other `VITE_*` env vars from `.env`
4. Set up custom domain in Vercel Dashboard → Domains
5. Configure build command: `npm run build`
6. Configure output directory: `dist`

### Verify
- Visit https://your-domain.com → app loads → login works → data displays

---

## Task 2: Upgrade Supabase to Pro

### Steps (Manual — Supabase Dashboard)
1. Go to https://supabase.com/dashboard → Project → Settings → Billing
2. Upgrade to Pro ($25/mo)
3. Enable: daily backups, point-in-time recovery
4. Verify: project no longer pauses after inactivity

---

## Task 3: Sentry Error Tracking

### Setup
```bash
npm install @sentry/react
```

In `src/main.tsx` (or wherever the app initializes):
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN', // Get from sentry.io → Create Project → React
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions
  environment: import.meta.env.MODE,
});
```

Note: Check if Sentry is already partially configured (the audit found `Sentry.ErrorBoundary` already in App.tsx). If so, just ensure `Sentry.init()` is called with proper DSN and the source maps are uploaded on deploy.

Add source map upload to Vercel build:
```bash
npm install -D @sentry/vite-plugin
```

In `vite.config.ts`:
```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: { sourcemap: true },
  plugins: [
    sentryVitePlugin({
      org: 'your-org',
      project: 'sitesync-pm',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

### Verify
- Trigger a test error → appears in Sentry dashboard within 30 seconds
- Source maps resolve to original TypeScript line numbers

---

## Task 4: Performance Audit + Optimization

### Steps
1. Run Lighthouse audit:
   ```bash
   npx lighthouse https://your-domain.com --output html --output-path ./lighthouse-report.html
   ```

2. Identify and fix top issues. Common ones for this app:
   - **Code split heavy pages**: BIM viewer, Drawing viewer, and any page importing Three.js or pdf.js should be lazy-loaded (most already are via `React.lazy`)
   - **Image optimization**: Ensure thumbnails are served at appropriate sizes. Use Supabase image transforms if available.
   - **Bundle analysis**:
     ```bash
     npx vite-bundle-visualizer
     ```
     Look for oversized chunks. Common culprits: Three.js, pdf.js, xlsx library.
   - **Supabase query optimization**: Add indexes for common filter patterns:
     ```sql
     CREATE INDEX IF NOT EXISTS idx_rfis_project_status ON rfis(project_id, status);
     CREATE INDEX IF NOT EXISTS idx_submittals_project_status ON submittals(project_id, status);
     CREATE INDEX IF NOT EXISTS idx_change_orders_project_status ON change_orders(project_id, status);
     CREATE INDEX IF NOT EXISTS idx_punch_items_project_status ON punch_items(project_id, status);
     CREATE INDEX IF NOT EXISTS idx_daily_log_entries_project_date ON daily_log_entries(project_id, log_date);
     CREATE INDEX IF NOT EXISTS idx_time_entries_project_date ON time_entries(project_id, date);
     CREATE INDEX IF NOT EXISTS idx_budget_items_project ON budget_items(project_id);
     CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
     ```

3. Target metrics:
   - LCP (Largest Contentful Paint): under 2.5s
   - FID (First Input Delay): under 100ms
   - CLS (Cumulative Layout Shift): under 0.1

### Verify
- Lighthouse score: Performance > 80, Accessibility > 90
- No single JS chunk over 500KB (excluding vendor libraries)

---

## Task 5: Clean Up Duplicate Files

### Problem
macOS Finder copy operations created duplicate files throughout the codebase: "filename 2.tsx", "filename 2.ts", etc. These are dead code polluting the build.

### Steps
```bash
# Find all duplicates
find src/ -name "* 2.*" -o -name "* 2.tsx" -o -name "* 2.ts" | sort

# Review each one — they should be exact copies of the original
# If confirmed copies, delete them:
find src/ -name "* 2.*" -delete

# Also check for other patterns:
find src/ -name "*.old" -o -name "*.bak" -o -name "*.orig" | sort
# Delete if no longer needed
```

### Verify
- `npx tsc --noEmit` — still compiles after deletion
- `npx vite build --outDir /tmp/phase5-build` — builds successfully
- No import statements reference deleted files

---

## Final Verification Checklist

After all Phase 5 tasks:

- [ ] App deployed and accessible at custom domain
- [ ] HTTPS working (Vercel handles this automatically)
- [ ] Supabase on Pro tier, backups enabled
- [ ] Sentry receiving errors with source maps
- [ ] Lighthouse Performance > 80
- [ ] All duplicate "2.tsx" files removed
- [ ] `npx tsc --noEmit` — zero errors
- [ ] All 5 E2E tests from Phase 3 still passing
- [ ] Demo project data loads correctly on production
- [ ] Login/auth flow works end-to-end on production
- [ ] RLS policies active — cross-project data isolation confirmed
