# Crystalline Standard Roadmap

**Authored:** 2026-05-15
**Status:** Active — Tier 1 begins this PR (B18 money math audit)
**Scope:** The path from soft-pilot (Day 60, ~Jun 9) to public GA (~Jan 2027)

---

## Why this exists

The functional-frog mission delivered breadth-first coverage: every (route × persona × viewport) tuple smoke-tests cleanly, every RLS policy fires, every edge fn rejects bad payloads. That is a **contract-enforcement layer** — it proves the surface is reachable. It does not prove the platform is shippable to the public.

This roadmap defines the 28 sub-suites (B16–B43) that close the gap from "surface verified" to "platform deserves real users." Together with the existing breadth matrix (B1–B14), they form the **Crystalline Standard**: every surface, every persona, every device, every locale, every dependency, every dollar, every byte, has a generator, a fixture, a CI gate, and a verification command.

---

## The six tiers

| Tier | Proves | Sub-suites | Gate range |
|---|---|---|---|
| **1 Correctness** | Code does what it claims | B16–B23 | gate-28 – gate-35 |
| **2 Security & Privacy** | Nothing leaks; no takeovers | B24–B27 | gate-36 – gate-39 |
| **3 Reliability & Ops** | When it breaks, we recover | B28–B32 | gate-40 – gate-44 |
| **4 Compliance & Commercial** | Billing, law, support work | B33–B36 | gate-45 – gate-48 |
| **5 Quality & Polish** | Every user, every device | B37–B40 | gate-49 – gate-52 |
| **6 Continuous Quality** | Stays good as it grows | B41–B43 | gate-53 – gate-55 |

> **Note on gate numbering:** existing repo gates run gate-7 through gate-27. New gates start at gate-28. The B-suite identifier and gate number are decoupled (existing precedent: B.3 → gate-8, B.5 → gate-11, B.11 → gate-15).

---

## Sub-suite index

| # | Sub-suite | Gate | Status |
|---|---|---|---|
| B16 | Workflow depth matrix | gate-28-workflow-depth | planned |
| B17 | Button behavior matrix | gate-29-button-behavior | planned |
| B18 | Money math audit + property closure | gate-30-money-math | **shipping (this PR)** |
| B19 | Cross-feature invariants matrix | gate-31-invariants | planned |
| B20 | IRIS quality matrix | gate-32-iris-quality | planned |
| B21 | Realtime behavior matrix | gate-33-realtime-behavior | planned |
| B22 | Integration fidelity (cassettes) | gate-34-integration-fidelity | planned |
| B23 | Performance tier matrix | gate-35-performance | planned |
| B24 | Application security (OWASP) | gate-36-app-security | planned |
| B25 | Cross-tenant isolation | gate-37-tenant-isolation | planned |
| B26 | Auth lifecycle matrix | gate-38-auth-lifecycle | planned |
| B27 | Privacy compliance | gate-39-privacy | planned |
| B28 | Disaster recovery matrix | gate-40-disaster-recovery | planned |
| B29 | Observability matrix | gate-41-observability | planned |
| B30 | Incident readiness | gate-42-incident-readiness | planned |
| B31 | Migration safety | gate-43-migration-safety | planned |
| B32 | Referential integrity | gate-44-referential-integrity | planned |
| B33 | Billing & subscription | gate-45-billing | planned |
| B34 | Notification delivery | gate-46-notification-delivery | planned |
| B35 | Legal & licensing | gate-47-legal | planned |
| B36 | Customer support readiness | gate-48-support-readiness | planned |
| B37 | Accessibility deep | gate-49-a11y-deep | planned |
| B38 | Internationalization | gate-50-i18n | planned |
| B39 | Mobile / field-readiness | gate-51-mobile-field | planned |
| B40 | Browser/device compat | gate-52-browser-compat | planned |
| B41 | Supply chain | gate-53-supply-chain | planned |
| B42 | Code quality ratchet | gate-54-code-quality | planned |
| B43 | Search & retrieval | gate-55-search | planned |

---

## Pattern (every sub-suite follows this skeleton)

1. **Manifest** at `ops/coverage/<sub-suite>.json` — declarative inventory of cells
2. **Generator** at `tests/codegen/gen-<sub-suite>-matrix.ts` — reads manifest, emits parametric spec
3. **Generated spec** at `tests/<domain>/codegen/B<NN>-<sub-suite>.generated.spec.ts` (or `e2e/<domain>/codegen/...`)
4. **Fixture corpus** at `tests/fixtures/<sub-suite>/` or `tests/cassettes/<sub-suite>/`
5. **CI gate** at `.github/workflows/gate-NN-<sub-suite>.yml`
6. **Package script** `frog:B<NN>` in `package.json`
7. **MASTER_MATRIX.md row** under "Phase 2 (Crystalline) sub-suites"

---

## Gate promotion path

Every new gate progresses through three phases before becoming required-blocking on `main`:

1. **Informational** (`continue-on-error: true`) — lands in CI, doesn't block, collects noise baseline for 14 days.
2. **Required, non-blocking on main** — required PR check with `[skip-gate-NN]` commit-tag escape hatch.
3. **Required, blocking** — required, no skip, no exceptions. Promoted after 30 days at phase 2 with zero false-positives.

Public GA = all 43 gates at phase 3.

---

## Cross-cutting invariants

These apply across every tier:

1. **One voice across the platform** — `scripts/lint-ui-voice.ts` applies `src/lib/iris/style.ts` rules to every UI string.
2. **Audit chain on every mutation** — enforced by `createAuditedMutation.ts`; raw mutations forbidden.
3. **Feature flag kill switch** — every feature shipped in the last 30 days behind GrowthBook with documented rollback.
4. **Telemetry every action** — PostHog event with `{event, props, persona, route}` per IRIS_TELEMETRY_SPEC.
5. **Empty + Error + Loading on every route** — asserted in B17, B36, B37.
6. **Type-safety floor** — zero `any` in `src/`; Zod at every untrusted boundary; `fromTable<T>()` for Supabase.
7. **Route error boundary** — every route wrapped per `route-error-boundary` skill.

---

## Sequencing (9-month roadmap)

| Month | Tier focus | Milestone |
|---|---|---|
| 1 (May) | Tier 1 begin: B18, B19, B16 | Money + invariants + workflows shippable |
| 2 (Jun) | Tier 1 finish: B17, B20, B21, B22, B23 | All correctness gates green; **soft pilot opens (Day 60)** |
| 3 (Jul) | Tier 2: B24, B25, B26, B27 | Security audit green; **external pen test ordered** |
| 4 (Aug) | Tier 3: B28, B29, B30, B31, B32 | DR drill passed; observability live; runbooks game-dayed |
| 5 (Sep) | Tier 4: B33, B34, B35, B36 | Billing covered; legal artifacts ratified |
| 6 (Oct) | Tier 5: B37, B38, B39 | A11y certified; i18n shipped; mobile field-tested |
| 7 (Nov) | Tier 5 finish: B40 + Tier 6: B41, B42, B43 | Browser compat green; supply chain hardened |
| 8 (Dec) | Bug bash + GA dress rehearsal | All gates required-blocking |
| 9 (Jan 2027) | **Public GA** | Status page live; on-call live; 43 gates green |

---

## Honest limits (what the matrix does NOT produce)

1. **The pilot "I don't want to go back" signal** — human judgment artifact; Brad Cameron + Carleton PM.
2. **External penetration test** — required, performed by humans (Cure53 / NCC / Doyensec).
3. **SOC 2 Type II** — 6 months of evidence post-Type I; clock-time gate, not code gate.
4. **Customer behavior in the wild** — until real users at scale exercise the platform.
5. **The voice corpus itself** — the 150-draft hand-edit set in `IRIS_VOICE_GUIDE_SPEC` defines "good"; the matrix tests the linter, not the corpus.

---

## This PR (foundation)

Ships:
- This roadmap doc
- B18 sub-suite: money math audit script + allowlist + gate-30 workflow
- MASTER_MATRIX.md extended with Phase 2 (Crystalline) sub-suites section
- `frog:B18` and `frog:crystalline` package scripts

Future PRs will land one sub-suite at a time following the sequencing above.
