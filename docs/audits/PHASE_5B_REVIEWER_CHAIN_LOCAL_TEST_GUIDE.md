# Local Test Guide — Multi-Reviewer Submittal Workflow

**For Walker.** Step-by-step to see the whole multi-reviewer flow on your laptop.

## What you'll see

- A new "Reviewer chain" UI inside the Create Submittal modal where you add reviewers in order, mark parallel reviewers, and set due dates
- After Send, the submittal materializes with a real chain — step 1 is "in court", later steps are pending
- The chain table on the (still-on-feature-branch) detail page shows it sequentially

## Prerequisites

- You're on the `sitesync-pm` repo at `/Users/walkerbenner/Desktop/sitesync-pm`
- Local Supabase running at `127.0.0.1:54322` (the typical `supabase start` setup)

## Three commands

```bash
# 1. Pull the latest branch
git fetch origin
git checkout feat/p5b-reviewer-chain
git pull

# 2. Apply the new migrations to your local Supabase
#    (this includes Phase 7c-1's multi-approval RPCs PLUS Phase 5b's
#    initialize-chain RPC, both required for the chain to work)
supabase db push --local
#    OR if you prefer reset-from-zero:
#    supabase db reset

# 3. Start the dev server
npm install   # if you haven't already
npm run dev
```

That's it. Open `http://localhost:5173/submittals` in a browser.

## What to try

1. **Create with a chain template.** Click `+ New Submittal` → `+ Add details` → scroll to the "People" section. You'll see "Iris suggests" with three preset chains. Pick "Standard 3-step (GC PE → Architect → Owner)".

2. **Add a custom step.** Click `+ Add reviewer` → type a role + name → set due-in-days.

3. **Mark a parallel branch.** Add a 4th reviewer ("Structural Engineer") → check "Parallel with previous". The step number badge turns yellow to signal parallel.

4. **Reorder.** Use the up/down arrows on the right side of any step.

5. **Validation.** If you mark only ONE reviewer as parallel, you'll see "Parallel group X only has 1 step" — needs at least 2 to form a parallel branch.

6. **Send.** ⌘+Enter. You'll see two toasts:
   - "Submittal created" (the row landed)
   - "Submittal created with 3-step reviewer chain. Step 1 is now in court." (the chain materialized)

7. **Verify in the DB.**
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
     -c "SELECT sequence, reviewer_role, reviewer_email, parallel_group, due_date, is_open
         FROM submittal_reviewers
         WHERE submittal_id = (SELECT id FROM submittals ORDER BY created_at DESC LIMIT 1);"
   ```
   You'll see your chain with `is_open = true` on row 1.

## What's NOT live yet on `feat/p5b-reviewer-chain` (because they're in stacked PRs)

These features exist as code on other branches but aren't in `main` (or this branch) yet:

- **Detail page V2 with 7 tabs + Iris co-pilot panel** (PR #359 — was JUST merged to main; if your `git checkout main` is fresh, you have it)
- **Workflow Chain dense table on the detail page** (PR #360 — open, stacked)
- **Citations side panel** (PR #360)
- **Voice review codes (A/R/V keyboard)** (PR #360)
- **Native markup canvas + rev-diff + distribute action** (PR #366 — open)
- **Multi-approval threaded comments + send-back action + auto-advance RPCs** (PR #373 — open) — the **comment thread per step** and **send-back-to-prior-reviewer** features

## To get those too (full end-to-end)

If you want everything on one branch including the Phase 7c-1 multi-approval thread + send-back:

```bash
git checkout submittals/p7c-multi-approval
supabase db push --local
npm run dev
```

Note: this branch was created before Phase 5 merged, so the Unified Create Modal won't appear. **`feat/p5b-reviewer-chain` is the right branch to test the create-time chain builder.**

## If anything breaks

- **"submittal_initialize_chain function does not exist"** — you skipped step 2. Run `supabase db push --local`.
- **"submittal_reviewers does not exist"** — your local DB doesn't have the canonical Submittals migration applied. Run `supabase db reset` to apply all migrations from scratch.
- **"Parallel group X only has 1 step"** — you marked exactly one step as parallel. Either add a sibling to that group or uncheck the parallel box.
- **`db push --local` fails partway through on an old historical migration** — fixed in commit `db3c00b` (2026-05-09). 13 historical migrations are now schema-version-tolerant (column existence guards, dual view/materialized-view drops, both-extensions-required cron checks). If you're on an even older snapshot, `supabase db reset` is always safe and re-applies the chain end-to-end.

## What I'm working on next

Once these PRs merge to main, I'll fold everything into one place so `git pull main` gets the whole feature. Right now we're in the awkward middle state where features are spread across PRs.
