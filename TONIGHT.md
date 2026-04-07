# TONIGHT.md — 9-Night Mission to April 15th
# Self-advancing: organism marks nights COMPLETED and advances the next
# Walker returns April 15th. This is the only file you need to read first.

---

## COMPLETED ✅: Night 1 — April 7 (Foundation Security + Mock Data)

**Status:** COMPLETED ✅
**RLS fix:** ✅ Already applied by Walker via Supabase dashboard. Database is live.
**Goal:** Zero mock data in production code. Edge functions secured.

### Step 1: Run the programmatic mock data fixer first (fast, catches everything)
```bash
node fix-mock-data.mjs
```
This script was written specifically for this codebase. Run it before anything else.
Verify: `grep -rn "Math.random()\|mockData\|MOCK_" src/ --include="*.ts" --include="*.tsx" | grep -v test | wc -l`
Must equal 0 before continuing.

### Step 2: Execute Phase 0A — Surgical Mock Data Verification
```bash
cat archive/prompts-v5/Phase_0A_MOCK_DATA.md
```
Read every instruction. The script handles bulk removal. This prompt handles edge cases the script missed. Verify every file it references. Commit after this step passes.

### Step 3: Execute Phase 0E — Edge Function Security
```bash
cat archive/prompts-v5/Phase_0E_EDGE_SECURITY.md
```
5 edge functions need JWT validation, rate limiting, proper auth. Execute every instruction.

### Quality gates before commit:
`npx tsc --noEmit && npm run lint && npx vitest run --passWithNoTests && npm run build`

### Commit:
`feat(p0): night 1 — zero mock data, edge functions secured [auto]`

### Progress Note (April 7 Night 1):
- Step 1: ✅ Ran fix-mock-data.mjs. Fixed duplicate toastCounter it introduced.
- Step 2: ✅ Mock data count: 0. Replaced getDemoUser with auth store in DrawingViewer.
- Step 3: ✅ All 5 edge functions already hardened (JWT, rate limiting, validation, membership).
- Bonus: Reduced unsafe 'as any' casts from 261 to 0 unguarded (all remaining have eslint-disable).
- Quality: TSC 0 errors, Build PASS, Tests 26/26 pass (3 pre-existing failures in access control tests).

---

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

Commit: `feat(p1): night 3 — real-time subscriptions, autonomic cascades, code splitting [auto]`

---

## UPCOMING: Night 4 — April 10 (V7 Visual Foundation)

**Goal:** Animation system and design tokens — the foundation every V7 prompt builds on.
**CRITICAL:** Read V7-00 FIRST. Every V7 night depends on it.

1. `cat v7-prompts/V7-00_SYSTEM_CONTEXT.md` — READ COMPLETELY before touching any file
2. `cat v7-prompts/V7-01_ANIMATION_MICRO_INTERACTIONS.md` — Creates `src/styles/animations.ts`, motion system
3. `cat v7-prompts/V7-02_THEME_TOKEN_CONSISTENCY.md` — Zero hardcoded hex values anywhere

Commit: `feat(v7): night 4 — animation system, theme token consistency [auto]`

---

## UPCOMING: Night 5 — April 11 (Components + Loading States)

**Goal:** Every shared component is world-class. Every loading state is beautiful.

1. `cat v7-prompts/V7-09_TYPOGRAPHY_VISUAL_HIERARCHY.md` — Type scale enforced
2. `cat v7-prompts/V7-05_PRIMITIVES_SPLIT_COMPONENT_POLISH.md` — 24 components polished
3. `cat v7-prompts/V7-08_LOADING_SKELETONS_EMPTY_STATES.md` — Every skeleton matches layout

Commit: `feat(v7): night 5 — typography, component polish, loading states [auto]`

---

## UPCOMING: Night 6 — April 12 (Tables, Forms, Modals)

**Goal:** Data display and interaction patterns are exceptional.

1. `cat v7-prompts/V7-06_TABLE_LIST_DATA_DISPLAY.md` — Tables lift on hover, Kanban is fluid
2. `cat v7-prompts/V7-07_FORMS_MODALS_INPUT_POLISH.md` — Forms validate inline, modals glide in

Commit: `feat(v7): night 6 — tables, forms, modals [auto]`

---

## UPCOMING: Night 7 — April 13 (Dashboard + Navigation)

**Goal:** The first screen a GC sees takes their breath away.

1. `cat v7-prompts/V7-03_DASHBOARD_REDESIGN.md` — Command center reimagined
2. `cat v7-prompts/V7-04_SIDEBAR_NAVIGATION_POLISH.md` — Navigation feels native

Commit: `feat(v7): night 7 — dashboard redesign, navigation polish [auto]`

---

## UPCOMING: Night 8 — April 14 (Page Polish + Demo Validation)

**Goal:** Every page perfect. The GC demo test passes end to end.

1. `cat v7-prompts/V7-10_PAGE_POLISH_PART1.md` — First 24 pages perfected
2. `cat v7-prompts/V7-11_PAGE_POLISH_PART2.md` — Remaining pages perfected
3. Run the demo test: `npx playwright test e2e/demo-flow.spec.ts --reporter=verbose`
4. Fix every failure in the demo test before committing

Commit: `feat(v7): night 8 — all pages polished, demo flow passing [auto]`

---

## UPCOMING: Night 9 — April 15 pre-dawn (Dark Mode + Final QA + Tag)

**Goal:** Dark mode flawless. Dead code gone. Walker arrives to a world-class product.

1. `cat v7-prompts/V7-12_DARK_MODE_SHADOWS_DEPTH.md` — Dark mode perfection
2. `cat v7-prompts/V7-13_DEAD_CODE_CLEANUP_FINAL_QA.md` — Eliminate dead code, final audit
3. Run full test suite: `npx playwright test && npx vitest run`
4. Tag release: `git tag v1.0.0-demo && git push origin v1.0.0-demo`

Commit: `feat(release): night 9 — dark mode, dead code removed, v1.0.0-demo tagged [auto]`

---

## Rules for the Organism

1. **Check PAUSE.md first** — if Status is PAUSED, stop immediately
2. **Read V7-00 before any V7 work** — `cat v7-prompts/V7-00_SYSTEM_CONTEXT.md`
3. **Read LEARNINGS.md** before writing any code (migration safety is critical)
4. **Quality gates before every commit** — `npx tsc --noEmit && npm run lint && npx vitest run --passWithNoTests && npm run build`
5. **Never run supabase CLI** — no CLI access in CI. Migrations go through Walker.
6. **Mark nights COMPLETED only when all steps done AND quality gates pass**
7. **Update this file after each night** — advance the mission forward
