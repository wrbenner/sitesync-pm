# Persona Performance

Per-persona timing for each user-visible interaction. Captured by
`e2e/personas/__helpers__/timing.ts` while persona-day specs run.

- **Budget**: each persona-day spec must complete in **<= 90s**.
- **Per-interaction budget**: **<= 5000 ms**. Anything > 5000 ms is logged
  as a `> budget` row in the per-persona section.
- **P50 / P95**: computed across all samples in a single run; small
  sample sizes will be noisy.

## Raw samples

| Persona | Step | ms | Notes |
| --- | --- | --- | --- |

<!-- Rows are appended by timing.ts during test runs. -->

## Notes on what is *not* measured

- Frame drops: requires CDP `Performance.metrics`. Captured ad-hoc inside
  individual specs when meaningful; gap documented in
  [docs/PERSONA_AUDIT.md](../docs/PERSONA_AUDIT.md).
- 30-min memory growth: emulated only when SUPABASE_SERVICE_ROLE_KEY is
  present so seeded interactions can repeat. Chromium-only.
- Network-shaped P95: tests run against `localhost:5173`; latency is
  dominated by render time, not transport.
