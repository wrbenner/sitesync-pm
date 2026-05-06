# Persona Blockers

This file is **append-only**. It catalogs friction discovered while running
the persona-day audit specs in `e2e/personas/`. Tab C is observational;
nothing here is a bug to fix in this wave — fixes happen in later waves
once the wiring backlog in [docs/STATUS.md](../docs/STATUS.md) is closed.

## Finding kinds

- `expected_unwired` — feature exists in the repo but a wire is missing
  (route, component mount, service call, cron). Cites `docs/STATUS.md`.
- `regression_candidate` — a flow that previously worked breaks; needs
  triage.
- `seed_unavailable` — `SUPABASE_SERVICE_ROLE_KEY` not set; the persona
  test couldn't seed required state.
- `cron_unavailable` — `CRON_SECRET` not set; couldn't trigger an
  edge-fn cron handler.

## Findings

| Persona | Step | Kind | Citation | Notes |
| --- | --- | --- | --- | --- |
| super-morning | Iris suggestion strip on daily log | expected_unwired | docs/STATUS.md (Iris suggestion strip not yet mounted on entity detail pages) | src/components/iris/IrisSuggests.tsx exists but is not mounted on /daily-log |
| super-morning | crew check-in route + COI banner mount | expected_unwired | docs/STATUS.md (Pre-existing doc debt — check-in page under src/pages/site/ absent) | host route for COI banner missing |
| super-midday | Iris approval gate on RFI detail | expected_unwired | docs/STATUS.md (Iris suggestion strip not yet mounted on entity detail pages) | src/components/iris/IrisApprovalGate.tsx exists but no host page mounts it |
| super-midday | photo classify -> RFI auto-draft pipeline | expected_unwired | docs/PLATINUM_AI_PRODUCTIVITY.md | edge fns deployed; call-site missing in photo upload flow |
| super-evening | auto-draft daily log on cron | expected_unwired | docs/DAILY_LOG_AUTO_DRAFT.md | edge fn exists; no pg_cron entry triggers it nightly |
| pm-morning | Iris draft response on RFI detail | expected_unwired | docs/STATUS.md (Iris suggestion strip not yet mounted on entity detail pages) | |
| pm-morning | workflow runner on RFI status mutation | expected_unwired | docs/PLATINUM_WORKFLOWS.md | src/lib/workflows/runner.ts not invoked from src/services/rfiService.ts |
| pm-midday | PreSubmissionAudit on pay app detail | expected_unwired | docs/COMPLIANCE_GATE.md | src/pages/payment-applications/PreSubmissionAudit.tsx exists; not mounted in PayAppDetail.tsx |
| pm-midday | submit-to-owner share link | expected_unwired | docs/STATUS.md (Public route /share/owner-payapp pending registration) | OwnerPayAppPreview.tsx exists; route not registered |
| pm-afternoon | walkthrough capture review | expected_unwired | docs/WALKTHROUGH_MODE.md + docs/STATUS.md (no host /walkthrough route) | src/pages/walkthrough/index.tsx exists; route not registered |
| compliance-weekly | dedicated WH-347 host page | expected_unwired | docs/STATUS.md | src/lib/compliance/wh347 ready; no /admin/wh347 route |
| compliance-weekly | e-sign and archive WH-347 | expected_unwired | docs/STATUS.md | no e-sign UI in repo for WH-347 |
| compliance-monthly | OSHA 300 export host page | expected_unwired | docs/STATUS.md | OSHA 300/300A lib shipped; no UI host page |
| compliance-monthly | COI gap report dashboard | expected_unwired | docs/COMPLIANCE_GATE.md | COI banner mounts pending |
| compliance-monthly | preliminary notice deadlines | expected_unwired | docs/STATUS.md | state lien rules lib shipped; no UI host page |
| owner-weekly | public /share/owner-payapp route | expected_unwired | docs/STATUS.md | OwnerPayAppPreview.tsx exists; route not registered |
| owner-weekly | weekly digest email | expected_unwired | docs/STATUS.md | digest-flusher edge fn requires cron |
| it-admin-onboarding | /admin/bulk-invite route | expected_unwired | docs/STATUS.md (App.tsx route registrations) | |
| it-admin-onboarding | /admin/cost-code-library route | expected_unwired | docs/STATUS.md (App.tsx route registrations) | |
| it-admin-onboarding | /admin/project-templates route | expected_unwired | docs/STATUS.md (App.tsx route registrations) | |
| it-admin-onboarding | /admin/procore-import route | expected_unwired | docs/STATUS.md (App.tsx route registrations) | |
