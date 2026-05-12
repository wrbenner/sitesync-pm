# RLS Policy Matrix — Baseline (placeholder)

**Status:** PLACEHOLDER — must be regenerated against the live database before the drift detector can run.

## How to seed

```bash
# Local dev (requires SUPABASE_DB_URL in .env.local pointing at staging or a local clone)
SUPABASE_DB_URL="postgresql://..." npx tsx scripts/rls-matrix-audit.ts --baseline
git add docs/audits/RLS_POLICY_MATRIX_BASELINE.md
git commit -m "chore(rls): seed baseline policy matrix"
```

## How CI uses it

The drift detector (CI job + nightly cron, follow-up slice) runs:

```bash
SUPABASE_DB_URL=$STAGING_DB_URL npx tsx scripts/rls-matrix-audit.ts --check
```

A non-zero exit means the live policies have drifted from the committed baseline. The PR author resolves by either:

1. Reverting the unintentional policy change, or
2. Running `--baseline` again to update this file (only after a Founder-or-architect review of the diff)

## Why this is a baseline, not a generated artifact

Policy changes are deliberate. Letting them drift silently is exactly the failure mode that caused the I1 cross-tenant invariant to be a P0 ship-stopper in the BRT spec. The baseline-and-diff pattern forces every policy change through code review.
