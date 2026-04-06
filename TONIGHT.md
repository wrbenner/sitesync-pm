# TONIGHT.md — Self-Advancing 9-Night Mission
# Walker returns April 15th. This file advances itself each night.
# Read this first. Execute tonight's mission. Update this file at the end.

---

## TONIGHT: Night 1 — April 7 (Security & Mock Data Foundation)
**Status:** PENDING
**Goal:** The app has zero mock data and hardened security before any UI work begins.

### Step 1: Apply the RLS fix first
Run this migration if not already applied:
```bash
supabase migration repair --status applied 20260407000001_fix_org_members_rls_recursion 2>/dev/null || true
```
Then verify Supabase is responsive:
```bash
curl -s "https://hypxrmcppjfbtlwuoafc.supabase.co/rest/v1/projects?select=id&limit=1" \
  -H "apikey: $(cat .env | grep VITE_SUPABASE_ANON_KEY | cut -d= -f2)" | head -20
```

### Step 2: Execute V5 Phase 0A — Surgical Mock Data Elimination
Read the full file: `cat archive/prompts-v5/Phase_0A_MOCK_DATA.md`
Execute every instruction in it. It has exact file paths and before/after code.
Verify: `grep -rn "Math.random()\|mockData\|MOCK_\|hardcoded" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | wc -l` must equal 0 before committing.

### Step 3: Execute V5 Phase 0E — Edge Function Security Hardening
Read the full file: `cat archive/prompts-v5/Phase_0E_EDGE_SECURITY.md`
Execute every security fix. JWT validation, rate limiting, HMAC verification, membership checks.
All 5 functions (send-notification, webhook-receiver, liveblocks-auth, voice-extract, agent-orchestrator) must have proper auth.

### Commit format for tonight:
`feat(security+data): night 1 — mock data eliminated, edge functions secured [auto]`

### After completion, update this file:
Change "TONIGHT: Night 1" to "COMPLETED: Night 1 ✅"
Change "TONIGHT: Night 2" (below) to "TONIGHT: Night 2"

---

## UPCOMING: Night 2 — April 8 (Permissions & Audit Completeness)
**Goal:** Every action button gated, every mutation creates an audit trail.

1. Read and execute: `archive/prompts-v5/Phase_1C_PERMISSION_GATES.md`
   - PermissionGate wrapping all 40+ action buttons across all pages
   - No Create/Edit/Delete visible to unauthorized users
   
2. Read and execute: `archive/prompts-v6/A5_AUDIT_MUTATIONS.md`
   - Migrate 13 plain useMutation() calls to createAuditedMutation()
   - Every mutation: permission → validate → execute → audit → toast

---

## UPCOMING: Night 3 — April 9 (Real-time + Animation Foundation)
**Goal:** The app feels alive — live data, smooth motion.

1. Read and execute: `archive/prompts-v5/Phase_1D_REALTIME.md`
   - 15 pages get Supabase real-time subscriptions
   - Cache auto-invalidates on remote changes
   
2. Read and execute: `v7-prompts/V7-01_ANIMATION_MICRO_INTERACTIONS.md`
   - Creates `src/styles/animations.ts` — the motion system
   - Every hover, press, focus state animated
   - Page transitions added to App.tsx

---

## UPCOMING: Night 4 — April 10 (Visual Foundation)
**Goal:** Every hardcoded color replaced, typography system perfect.

1. Read V7-00 context first: `cat v7-prompts/V7-00_SYSTEM_CONTEXT.md`
2. Execute: `v7-prompts/V7-02_THEME_TOKEN_CONSISTENCY.md` — zero hardcoded hex values
3. Execute: `v7-prompts/V7-09_TYPOGRAPHY_VISUAL_HIERARCHY.md` — type scale enforced everywhere

---

## UPCOMING: Night 5 — April 11 (Component Perfection)
**Goal:** Every shared component is world-class.

1. Execute: `v7-prompts/V7-05_PRIMITIVES_SPLIT_COMPONENT_POLISH.md` — 24 components polished, split into proper files
2. Execute: `v7-prompts/V7-08_LOADING_SKELETONS_EMPTY_STATES.md` — every skeleton matches layout, every empty state is beautiful and actionable

---

## UPCOMING: Night 6 — April 12 (Tables, Forms, Modals)
**Goal:** Data display and interaction patterns are exceptional.

1. Execute: `v7-prompts/V7-06_TABLE_LIST_DATA_DISPLAY.md` — tables lift on hover, Kanban is fluid
2. Execute: `v7-prompts/V7-07_FORMS_MODALS_INPUT_POLISH.md` — forms validate inline, modals glide

---

## UPCOMING: Night 7 — April 13 (Dashboard + Navigation)
**Goal:** The first screen a GC sees is breathtaking.

1. Execute: `v7-prompts/V7-03_DASHBOARD_REDESIGN.md` — command center reimagined
2. Execute: `v7-prompts/V7-04_SIDEBAR_NAVIGATION_POLISH.md` — navigation feels native

---

## UPCOMING: Night 8 — April 14 (Page Polish)
**Goal:** Every single page is polished, not just the demo pages.

1. Execute: `v7-prompts/V7-10_PAGE_POLISH_PART1.md` — first 24 pages perfected
2. Execute: `v7-prompts/V7-11_PAGE_POLISH_PART2.md` — remaining pages perfected

---

## UPCOMING: Night 9 — April 15 (Final Pass)
**Goal:** Dark mode perfect, dead code gone, Walker returns to a world-class product.

1. Execute: `v7-prompts/V7-12_DARK_MODE_SHADOWS_DEPTH.md` — dark mode flawless
2. Execute: `v7-prompts/V7-13_DEAD_CODE_CLEANUP_FINAL_QA.md` — eliminate dead code, final QA checklist

---

## Completed Nights
(The organism appends completed nights here)

---

## Rules for the Organism
1. Read THIS FILE first every night — it is your mission
2. Read `v7-prompts/V7-00_SYSTEM_CONTEXT.md` before executing any V7 prompt (it contains critical tech stack rules)
3. Read `LEARNINGS.md` before writing any code (especially migration safety rules)
4. Run quality gates before every commit: `npx tsc --noEmit && npm run lint && npx vitest run --passWithNoTests && npm run build`
5. If a prompt is too large to complete in one session, complete as much as possible and note where you stopped in this file
6. After completing each night, update this file: move the night from UPCOMING to COMPLETED, advance the next night to TONIGHT
7. Commit this file update: `chore: advance TONIGHT.md to night N+1 [auto]`
8. NEVER skip a night's foundation work to jump to visual polish — security and data integrity first
