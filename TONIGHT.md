## TONIGHT: Night 2 — Auth & Permissions hardening

---

# 9-Night Sprint to April 15th Demo

## Night 1 — April 7 ✅ COMPLETED
**Mission: Mock Data Elimination + Edge Security**

Steps completed:
1. ~~RLS fix via supabase CLI~~ — SKIPPED. Walker will apply RLS fix from Supabase dashboard (Issue #16). Do NOT attempt supabase CLI commands.
2. Verified working tables: `curl -s "https://hypxrmcppjfbtlwuoafc.supabase.co/rest/v1/rfis?select=id&limit=1" -H "apikey: [from .env]"` — rfis, tasks, submittals return [] not errors ✅
3. Executed V5 Phase 0A: `cat archive/prompts-v5/Phase_0A_MOCK_DATA.md` — surgical mock data elimination ✅
4. Executed V5 Phase 0E: `cat archive/prompts-v5/Phase_0E_EDGE_SECURITY.md` — edge function security ✅
5. Commit: `feat(security+data): night 1 — mock data eliminated, edge functions secured [auto]` ✅

---

## Night 2 — April 8 (TONIGHT)
**Mission: Auth & Permissions Hardening**

Steps:
1. Read LEARNINGS.md and DECISIONS.md before touching anything
2. Execute V5 Phase 1A: `cat archive/prompts-v5/Phase_1A_AUTH_HARDENING.md`
3. Execute V5 Phase 1B: `cat archive/prompts-v5/Phase_1B_ROLE_PERMISSIONS.md`
4. Verify RLS is applied (Walker should have done Issue #16 by now) — if not, note in LEARNINGS.md
5. Run quality gates: `npx tsc --noEmit && npm run lint && npx vitest run --passWithNoTests && npm run build`
6. Commit: `feat(auth): night 2 — auth hardened, role permissions locked [auto]`
7. Update TONIGHT.md: mark Night 2 as COMPLETED ✅, advance Night 3 to TONIGHT

---

## Night 3 — April 9
**Mission: RFI Module — Full Lifecycle**

Steps:
1. Read LEARNINGS.md first
2. Execute V5 Phase 2A: `cat archive/prompts-v5/Phase_2A_RFI_LIFECYCLE.md`
3. Ensure RFI create/respond/close flow works end to end with real Supabase data
4. Add Vitest unit tests for RFI state machine
5. Run quality gates
6. Commit: `feat(rfis): night 3 — RFI full lifecycle wired to Supabase [auto]`
7. Update TONIGHT.md: mark Night 3 as COMPLETED ✅, advance Night 4 to TONIGHT

---

## Night 4 — April 10
**Mission: Submittals Module — Full Lifecycle**

Steps:
1. Read LEARNINGS.md first
2. Execute V5 Phase 2B: `cat archive/prompts-v5/Phase_2B_SUBMITTALS_LIFECYCLE.md`
3. Ensure submittal create/review/approve flow works with real data
4. Add Vitest unit tests for submittal state machine
5. Run quality gates
6. Commit: `feat(submittals): night 4 — submittals full lifecycle wired to Supabase [auto]`
7. Update TONIGHT.md: mark Night 4 as COMPLETED ✅, advance Night 5 to TONIGHT

---

## Night 5 — April 11
**Mission: Daily Log + Tasks**

Steps:
1. Read LEARNINGS.md first
2. Execute V5 Phase 3A: `cat archive/prompts-v5/Phase_3A_DAILY_LOG.md`
3. Execute V5 Phase 3B: `cat archive/prompts-v5/Phase_3B_TASKS.md`
4. Ensure daily log entries persist, tasks CRUD works with real data
5. Run quality gates
6. Commit: `feat(daily-log+tasks): night 5 — daily log and tasks wired to Supabase [auto]`
7. Update TONIGHT.md: mark Night 5 as COMPLETED ✅, advance Night 6 to TONIGHT

---

## Night 6 — April 12
**Mission: AI Copilot — Real Responses**

Steps:
1. Read LEARNINGS.md first
2. Execute V5 Phase 4A: `cat archive/prompts-v5/Phase_4A_AI_COPILOT.md`
3. Ensure AI Copilot calls real edge function (not mock), returns real Anthropic response
4. Verify no mock response fallbacks remain in production path
5. Run quality gates
6. Commit: `feat(ai-copilot): night 6 — AI Copilot wired to real Anthropic edge function [auto]`
7. Update TONIGHT.md: mark Night 6 as COMPLETED ✅, advance Night 7 to TONIGHT

---

## Night 7 — April 13
**Mission: Budget Module + Dashboard Widgets**

Steps:
1. Read LEARNINGS.md first
2. Execute V5 Phase 5A: `cat archive/prompts-v5/Phase_5A_BUDGET.md`
3. Execute V5 Phase 5B: `cat archive/prompts-v5/Phase_5B_DASHBOARD.md`
4. Ensure budget line items persist, dashboard widgets show real aggregated data
5. Run quality gates
6. Commit: `feat(budget+dashboard): night 7 — budget and dashboard wired to Supabase [auto]`
7. Update TONIGHT.md: mark Night 7 as COMPLETED ✅, advance Night 8 to TONIGHT

---

## Night 8 — April 14
**Mission: Demo Flow Polish + E2E Tests**

Steps:
1. Read LEARNINGS.md first
2. Run `npx playwright test e2e/demo-flow.spec.ts` — fix every failing step
3. Fix any accessibility issues found by axe-core
4. Fix any mobile/tablet layout issues (iPad 1024px viewport)
5. Ensure all 6 demo pages load under 3 seconds
6. Run quality gates + E2E: `npx playwright test e2e/demo-flow.spec.ts`
7. Commit: `feat(demo): night 8 — demo flow fully green, E2E passing [auto]`
8. Update TONIGHT.md: mark Night 8 as COMPLETED ✅, advance Night 9 to TONIGHT

---

## Night 9 — April 15 (DEMO DAY)
**Mission: Final Hardening + Freeze**

Steps:
1. Run full E2E suite one final time: `npx playwright test`
2. Run Lighthouse on all 6 demo pages — Performance score must be ≥ 80
3. Fix any last-minute issues found
4. Tag the release: `git tag v1.0.0-demo && git push origin v1.0.0-demo`
5. Run quality gates one final time
6. Commit: `feat(release): night 9 — demo freeze, v1.0.0-demo tagged [auto]`
7. DO NOT merge any new features after this commit — freeze is in effect

---

## Rules for the Organism
- Always read LEARNINGS.md before writing code
- Always read DECISIONS.md for architecture constraints
- Never run `supabase` CLI commands (no CLI access in CI) — all DB changes go through Walker or migration files
- Never commit broken code — quality gates must pass
- Never touch files outside your MODULE_ASSIGNMENTS.md scope (swarm agents)
- Mark nights COMPLETED only when quality gates pass and commit is on main
