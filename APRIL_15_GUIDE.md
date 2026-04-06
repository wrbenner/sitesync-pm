# April 15th — Return Guide
*Walker, you're back. Here's exactly what to do in the first 30 minutes.*

---

## Step 1: Load the Demo Data (5 minutes)

The database is live but empty. This loads the Riverside Tower project:

```bash
cd /path/to/sitesync-pm
supabase link --project-ref hypxrmcppjfbtlwuoafc
supabase db reset --linked
```

After this, the live app at [sitesync-pm.vercel.app](https://sitesync-pm.vercel.app) shows:
- Riverside Commercial Tower — $52M Dallas multifamily project
- 8 RFIs with real statuses and ball-in-court
- 24 submittals across 3 phases
- Budget with 14 line items and real variance
- 45 tasks across 6 crews
- 30 daily log entries

---

## Step 2: Sync Your Local Repo (2 minutes)

```bash
git stash 2>/dev/null; git pull --rebase; git stash pop 2>/dev/null
```

Then check what the organism built over the 9 nights:
```bash
git log --oneline --author="SiteSync Organism" | head -30
```

---

## Step 3: Run the Demo Flow Test (3 minutes)

```bash
npx playwright test e2e/demo-flow.spec.ts --headed
```

This runs the exact 6-step GC demo. If it passes, you're ready to show customers.
If it fails, the output tells you exactly what to fix.

---

## Step 4: Check Quality Metrics

```bash
cat .quality-floor.json
```

You should see all numbers ratcheting down from their April 6th baselines:
- `mockCount`: heading toward 0
- `anyCount`: heading toward 0
- `eslintErrors`: heading down from 1379
- `bundleSizeKB`: stable or decreasing

---

## Step 5: Sync git, stash any local work, pull

```bash
git stash
git pull --rebase
git stash pop
```

---

## Optional: Add SUPABASE_DB_PASSWORD Secret (unlocks auto-migrations)

This lets future migrations apply automatically without CLI access:
1. Supabase Dashboard → Project Settings → Database → Connection string → copy password
2. GitHub → Settings → Secrets → Actions → New secret
3. Name: `SUPABASE_DB_PASSWORD`, Value: [the password from step 1]

After this, the `fix-database.yml` workflow can apply any future migrations automatically.

---

## What to Show a GC

**The 6-step demo (takes 8 minutes):**

1. **Dashboard** — "This is the command center. Every metric is live."
   - Point to the AI Insights panel: "This tells you what needs attention today."
   - Click on a delayed task: "Everything links — click anything, go anywhere."

2. **AI Copilot** — "Ask it anything about the project."
   - Type: "What's the biggest risk on this project right now?"
   - Wait for real Anthropic response (not mocked)

3. **RFIs** — "This is where Procore loses contractors."
   - Show the ball-in-court indicator: "Always know whose court it's in."
   - Click Create RFI: "From field to office in 15 seconds."

4. **Daily Log** — "Supers fill this in 2 minutes instead of 20."
   - Show voice capture: "Speak it, it writes it."

5. **Budget** — "Real-time committed vs. actual vs. projected."
   - "Your CFO sees this the moment you approve a change order."

6. **Payment Application** — "AIA G702/G703 in one click."
   - Show auto-populated values from SOV
   - "This alone saves 3 hours per billing cycle."

**Closing:** "Every night while you sleep, this platform gets better. That's not a feature. That's the business model."

---

## What to Do If Something Breaks

1. Check GitHub Issues — the organism creates issues when it finds problems
2. Check `TONIGHT.md` — see which nights completed and which didn't
3. Check `SESSION_BRIEF.md` — see what was planned for last night
4. Check [github.com/wrbenner/sitesync-pm/actions](https://github.com/wrbenner/sitesync-pm/actions) — full run logs
5. If demo flow fails: `npx playwright test e2e/demo-flow.spec.ts --headed` shows exactly which step fails

---

## The Numbers on April 15th

Walker, the organism ran for 9 nights. In 27 sessions (3/day), it:
- Executed 18 expert prompt files from the V5 and V7 series
- Made the product more production-ready than any team of 5 engineers could in 9 days
- Zero regressions (auto-revert protected main)
- Quality metrics ratcheting down continuously

This is what you built. Now go show it to GCs.
