# Persona Audit (Tab C — User Flow Audit)

This is the **observational** wave. The persona-day specs in
[`e2e/personas/`](../e2e/personas/) walk through ten realistic
day-in-the-life flows for the five core SiteSync personas (super, PM,
compliance officer, owner, IT admin) and **catalog reality** without
fixing anything. Findings flow into three append-only audit files.

## How to read the three audit files

| File | What it answers |
| --- | --- |
| [`audit/persona-blockers.md`](../audit/persona-blockers.md) | Per-step friction. Each row tags `expected_unwired`, `regression_candidate`, `seed_unavailable`, or `cron_unavailable`. Citations link back to `docs/STATUS.md` so you can tell "missing wire" from "regressed flow". |
| [`audit/persona-perf.md`](../audit/persona-perf.md) | Per-interaction wall time + P50/P95 summary per persona. Anything > 5000 ms is flagged `> budget`. |
| [`audit/onboarding-friction.md`](../audit/onboarding-friction.md) | IT-admin steps > 90 s, with dominant blocker + proposed fix. |

## Finding kinds (in detail)

- **`expected_unwired`** — the feature is implemented (lib + edge fn +
  page component all exist) but a route registration, component mount,
  service-call site, or cron entry is missing. Cite the row in
  `docs/STATUS.md`'s "Wiring backlog" section. The spec marks the step
  `test.skip` with the citation. **CI does not fail** on these.
- **`regression_candidate`** — a flow that was previously working has
  broken. The spec **fails loudly** via `expect`. CI fails the job.
- **`seed_unavailable`** — `SUPABASE_SERVICE_ROLE_KEY` is not set in
  the test env, so the helper at
  `e2e/personas/__helpers__/seedPersonaProject.ts` cannot create the
  fixture project. The spec calls
  `requireServiceRoleOrSkip()` to skip cleanly.
- **`cron_unavailable`** — `CRON_SECRET` is not set, so cron-fed edge
  functions cannot be manually invoked from the test. The spec calls
  `requireCronSecretOrSkip()` to skip cleanly.

## Run instructions

The Tab C wave **does not modify `package.json`**. Run specs directly:

```sh
# All persona-day specs (writes to audit/*.md as it runs)
npx playwright test e2e/personas/

# Just the IT-admin onboarding persona
npx playwright test e2e/personas/it-admin-onboarding.spec.ts

# List all discovered persona specs (sanity check)
npx playwright test e2e/personas/ --list
```

Optional env vars:

| Variable | Effect |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Enables seeded persona projects via the `seed_persona_project` RPC. When unset, persona steps that need fresh DB state are tagged `seed_unavailable` and skipped. |
| `CRON_SECRET` | Enables manual invocation of cron-fed edge functions (digest-flusher, coi-expiration-watcher, daily-log auto-draft). When unset, those steps are tagged `cron_unavailable` and skipped. |
| `SUPABASE_URL` | Override the Supabase project URL the seed helper hits. |

## Mocking strategy

- **Email (Resend)**: mocked at the network boundary via `page.route()`
  matching the edge-function fetch. We assert the *payload* the
  edge-fn would send, never delivery. Mock setup is local to specs that
  need it (e.g., `owner-weekly.spec.ts`).
- **Push**: not yet exercised; persona-perf.md tracks the gap.
- **Cron**: `digest-flusher` and `coi-expiration-watcher` are invoked
  directly via fetch with the `X-Cron-Secret` header. Tests assert the
  post-condition (a fresh row in `digests` or a banner row), not the
  schedule itself.

## Two-context tests

Presence, conflict, and live-cursor flows use
[`__helpers__/twoContext.ts`](../e2e/personas/__helpers__/twoContext.ts).
Both contexts share the same auth state today; production presence
requires distinct accounts but the wire-format observability is the
same.

## What this wave intentionally does **not** do

- It does not modify any source code under `src/`.
- It does not add or modify any migration, edge function, or product
  feature.
- It does not edit `package.json` (run specs via `npx playwright test`
  per the table above).
- It does not "fix" any blocker it finds. Bug fixes happen in later
  waves once the backlog row in `docs/STATUS.md` is closed.

## CI

[`.github/workflows/persona-audit.yml`](../.github/workflows/persona-audit.yml)
runs nightly and on PRs labeled `persona-audit`. The job fails **only**
on a regression — `test.skip(true, "expected_unwired: ...")` rows do not
fail the job. The audit `*.md` files are uploaded as artifacts.
