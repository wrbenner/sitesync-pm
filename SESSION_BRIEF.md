# SESSION_BRIEF — Wednesday April 08 at 2am CDT
*Pre-computed context. Read this INSTEAD of reading 6 separate files. Generated 08:00 UTC.*

---

## TONIGHT: Night 2 — April 8 (Validation + Error Handling + Permissions)

## TONIGHT: Night 2 — April 8 (Validation + Error Handling + Permissions)

**Goal:** Every form validates. Every error is caught. Every action is gated.

1. `cat archive/prompts-v5/Phase_1A_ZOD_SCHEMAS.md` — Zod schemas for all 8 entities, react-hook-form integration
2. `cat archive/prompts-v5/Phase_1B_ERROR_HANDLING.md` — Error boundaries on all pages, typed errors, retry logic
3. `cat archive/prompts-v5/Phase_1C_PERMISSION_GATES.md` — PermissionGate on every Create/Edit/Delete button

Commit: `feat(p1): night 2 — zod validation, error handling, permission gates [auto]`

---

## UPCOMING: Night 3 — April 9 (Real-time + Code Splitting)

**Goal:** The app feels alive. Data updates instantly. Loads fast.

1. `cat archive/prompts-v5/Phase_1D_REALTIME.md` — Supabase real-time subscriptions on 15 pages
2. `cat archive/prompts-v5/Phase_1E_COMPONENT_SPLITTING.md` — Code splitting, lazy loading heavy routes

3. Build AUTONOMIC CASCADES (THE NERVOUS SYSTEM — most critical gap):
   When a schedule task slips → downstream tasks recalculate → lookahead regenerates → PM gets alert
   When an RFI is unanswered 7 days → escalation notification fires
   When a cost code hits 80% → warning toast on all budget pages
   When a submittal returns "Revise and Resubmit" → procurement schedule adjusts → installation task shifts
   These are not features. This is the autonomic nervous system that makes SiteSync feel ALIVE vs. dead.
   Look for supabase/functions/send-notification and supabase/functions/weekly-digest — wire them to triggers.

4. `cat archive/prompts-v5/Phase_0E_EDGE_SECURITY.md` — 5 edge functions need JWT validation + rate limiting (deferred from Night 1)

Commit: `feat(p1): night 3 — real-time, autonomic cascades, code splitting, edge security [auto]`

---

## COGNITIVE OVERRIDE FOR TONIGHT

SECURITY & DATA INTEGRITY NIGHTS — Override Protocol:
    NETFLIX TEST: After every fix, simulate the failure mode. If you secured an edge function,
    try calling it without a JWT and verify it rejects. If you removed mock data, verify the
    page shows an empty state, not a crash. Prove it works, don't assume.
    STRIPE TEST: Every error message must say exactly what went wrong and how to fix it.
    Never: 'Error 500'. Always: 'The RFI could not be created because project_id is required.'
    AMAZON TEST: Before each fix, ask: what specific pain does this eliminate for a
    superintendent? If you cannot answer in one sentence, reconsider the approach.

---

## WHAT WAS BUILT RECENTLY
33ba380 chore: mark Night 1 COMPLETED, advance Night 2 to TONIGHT [auto]
ef9e167 fix(types): remove/guard remaining 'as any' casts across 33 files [auto]
7932246 fix(types): remove 67 'as any' casts from Tasks, offlineDb, PresenceBar, Meetings, hooks, client [auto]
7d0b34f fix(types): remove 84 'as any' casts from useReportData and DailyLog [auto]
4839919 fix(types): remove 51 unnecessary 'as any' casts across stores, API, pages [auto]
565ba27 fix(mock-data): replace getDemoUser with auth store, fix duplicate toastCounter [auto]
6e22936 chore: session brief for April 07 Night 1 [skip ci]

---

## QUALITY FLOOR (current state — only improve these)
| Metric | Now | Target |
|--------|-----|--------|
| Mock data | 7 | 0 |
| Unsafe casts | 260 | 0 |
| ESLint errors | 1379 | 0 |
| SPEC completion | 0
0 / 431 | 431/431 |

---

## NON-NEGOTIABLE RULES
1. Check PAUSE.md — if PAUSED, stop
2. V7 nights: read v7-prompts/V7-00_SYSTEM_CONTEXT.md first
3. Migration rule: ALWAYS CREATE TABLE IF NOT EXISTS + DO/EXCEPTION blocks
4. Quality gates before EVERY commit: npx tsc --noEmit && npm run lint && npx vitest run --passWithNoTests && npm run build
5. Never run supabase CLI in CI
6. After completing tonight, update TONIGHT.md: mark COMPLETED, advance next night to TONIGHT
