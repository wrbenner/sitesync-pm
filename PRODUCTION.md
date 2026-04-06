# PRODUCTION.md — From Prototype to Live Product

*The autonomous build system will make the code excellent. This guide takes the code from GitHub Pages to a product real customers pay for. Do this before running the nightly builds.*

---

## The Brutal Truth

Right now, SiteSync runs on GitHub Pages with no live Supabase instance. Every page shows empty states or mock data because there's no database connected. The autonomous build system will make the code better — but if there's no real backend, you can't show it to customers.

**30 days of work will move SiteSync from "impressive prototype" to "product I can sell."**

---

## Step 1: Create the Supabase Project (Day 1, 2 hours)

1. Go to supabase.com → New Project
2. Name: `sitesync-production`
3. Region: `us-east-1` (closest to Dallas)
4. Password: generate strong password, store in 1Password
5. Copy the project URL and anon key → add to your `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Only for server-side
```

---

## Step 2: Run the Migrations (Day 1, 1 hour)

```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Link to your project
supabase link --project-ref your-project-ref

# Run all 48 migrations in order
supabase db push

# Seed with demo data
supabase db reset --linked  # This runs seed.sql automatically
```

The `supabase/seed.sql` already has a complete Riverside Commercial Tower ($52M project in Dallas) with realistic RFIs, submittals, daily logs, budget data, crew assignments, and team members.

---

## Step 3: Configure Authentication (Day 1, 1 hour)

In Supabase Dashboard → Authentication → Settings:

1. **Site URL:** `https://your-sitesync-domain.com`
2. **Redirect URLs:** Add your domain
3. **Email templates:** Update from "Supabase" to "SiteSync AI"
4. **Disable email confirmations for demo:** Auth → Settings → Disable email confirmation (dev only)

Create demo accounts:
```sql
-- In Supabase SQL editor
INSERT INTO auth.users (email, encrypted_password, role) VALUES
  ('demo@sitesync.ai', crypt('SiteSync2026!', gen_salt('bf')), 'authenticated'),
  ('gc@example.com', crypt('Demo1234!', gen_salt('bf')), 'authenticated');
```

---

## Step 4: Deploy to Vercel (Day 2, 2 hours)

GitHub Pages is not suitable for production (no SSR, no env variables, no custom domain).

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Project Settings → Environment Variables → Add:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
# VITE_SENTRY_DSN
# VITE_ANTHROPIC_API_KEY (for AI features)
# VITE_LIVEBLOCKS_PUBLIC_KEY
# VITE_POSTHOG_KEY
```

**Why Vercel over GitHub Pages:**
- Custom domain (sitesync.ai or app.sitesync.ai)
- Automatic HTTPS
- Preview deployments for every PR
- Environment variables
- Edge functions support

---

## Step 5: Deploy Supabase Edge Functions (Day 2, 2 hours)

```bash
# Deploy all 14 edge functions
supabase functions deploy ai-chat
supabase functions deploy ai-insights
supabase functions deploy agent-orchestrator
supabase functions deploy generate-report
supabase functions deploy stripe-webhook
supabase functions deploy send-notification
supabase functions deploy voice-extract
supabase functions deploy weekly-digest
# ... deploy all 14 functions

# Set secrets for edge functions
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SENTRY_DSN=https://...
supabase secrets set LIVEBLOCKS_SECRET_KEY=sk_prod_...
```

---

## Step 6: Configure Stripe (Day 3, 2 hours)

1. Create Stripe account at stripe.com
2. Enable Stripe Connect (for subcontractor payments)
3. Set up webhooks:
   - Endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Events: `payment_intent.succeeded`, `transfer.created`, `account.updated`
4. Add Stripe keys to Supabase secrets (done in Step 5)

---

## Step 7: Custom Domain (Day 3, 1 hour)

1. Register `sitesync.ai` or `sitesyncpm.com` at Cloudflare ($10/year)
2. In Vercel: Project Settings → Domains → Add your domain
3. In Cloudflare: Add the Vercel DNS records
4. HTTPS is automatic via Vercel

---

## Step 8: Monitoring (Day 4, 1 hour)

1. **Sentry** — error tracking. The code already imports `@sentry/react`. Just add your DSN.
2. **PostHog** — product analytics. Already in `src/lib/analytics.ts`. Add your key.
3. **Supabase Dashboard** — monitor database performance, slow queries, RLS policy hits

```env
VITE_SENTRY_DSN=https://your-key@sentry.io/your-project
VITE_POSTHOG_KEY=phc_your_key
```

---

## Step 9: SOC2 Preparation (Month 2-4)

Enterprise GCs (>$50M revenue) will require SOC2 Type II before signing. Start this immediately in parallel with customer development.

**Quick wins (do these now — free, takes 1 week):**
- [ ] Enable MFA for all Supabase admin accounts
- [ ] Enable RLS on all Supabase tables (already in migrations)
- [ ] Enable point-in-time recovery in Supabase (Settings → Database)
- [ ] Set up backup schedule (daily, 30-day retention)
- [ ] Create a Security Policy document (use Vanta's free template)
- [ ] Enable audit logging in Supabase

**SOC2 Type I (3-4 months, ~$15K with Vanta):**
- Use Vanta (vanta.com) — automated evidence collection, connects to Supabase, GitHub, Vercel
- Audit: ~$15K for a SOC2 Type I report from a CPA firm
- Result: "We have SOC2 Type I" — enough for most mid-size GCs

**SOC2 Type II (9-12 months, ~$30K total):**
- Requires 6+ months of evidence collection
- Unlocks enterprise GCs and government projects
- Required for FedRAMP (government market)

---

## Step 10: The Demo Environment (Day 5, 2 hours)

Create a demo Supabase project (separate from production) that:
- Is pre-seeded with the Riverside Commercial Tower project
- Has realistic RFIs, submittals, budget data, daily logs, crew data
- Never gets cleared (demo data is sacrosanct)
- Has a demo user: `demo@sitesync.ai` / `SiteSync2026!`

Share this with:
- Potential investors: "Try the product at demo.sitesync.ai"
- Potential customers: "Play with your own demo project"
- Press/media: "Here's a live demo"

---

## Production Launch Checklist

**Day 1:**
- [ ] Supabase project created
- [ ] All 48 migrations run
- [ ] Seed data loaded (Riverside Tower project)
- [ ] Auth configured

**Day 2:**
- [ ] Deployed to Vercel
- [ ] All 14 edge functions deployed with secrets
- [ ] App loads at Vercel URL with real data

**Day 3:**
- [ ] Stripe configured (even if just test mode)
- [ ] Custom domain (app.sitesync.ai)
- [ ] Sentry error tracking live

**Day 4:**
- [ ] PostHog analytics live
- [ ] Performance baseline captured
- [ ] Mobile (Capacitor): test on real device

**Day 5:**
- [ ] Demo environment created and polished
- [ ] 3-minute demo video recorded
- [ ] First 5 potential customers contacted

**After Launch:**
- [ ] SOC2 preparation started (Vanta)
- [ ] First paying customer within 30 days
- [ ] Series of 30-minute customer calls to understand pain points
- [ ] Procore migration tool started (highest-priority GTM feature)

---

## The Cost of Production

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25/mo |
| Vercel Pro | $20/mo |
| Sentry Team | $26/mo |
| PostHog Cloud | $0 (free tier) |
| Stripe | 0.75% of transactions |
| Cloudflare | $0 (free tier) |
| **Total** | **~$71/mo** |

At $71/month, you have a production-grade infrastructure. Procore spends millions on infrastructure. This is the startup advantage.
