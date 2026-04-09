# SESSION BRIEF — 2026-04-09
6 days until April 15 demo

## STATUS
Pause: RUNNING
Last night: No organism commits found in recent history
Quality trend: improving

## TONIGHT'S EXPERIMENTS (pending only)
Total in queue: 15 pending | 0 passed | 0 failed

### [P0] EXP-001: Remove `as any` casts from highest-density file
  Verify: `as any`
### [P0] EXP-002: Remove `as any` casts from second-highest file
  Verify: `as any`
### [P0] EXP-003: Remove `as any` casts from third-highest file
  Verify: `as any`
### [P0] EXP-004: Replace mock data pattern in highest-density file
  Verify: `grep -c "mockData\|MOCK_\|Math.random()\|faker\.\|sampleData" [target_file] || echo 0`
### [P0] EXP-005: Add loading skeleton to Dashboard page
  Verify: `grep -c "Skeleton\|Suspense\|loading" src/pages/Dashboard.tsx 2>/dev/null || echo 0`
### [P0] EXP-006: Add error boundary to app root
  Verify: `grep -c "ErrorBoundary" src/App.tsx 2>/dev/null || echo 0`
### [P0] EXP-007: Fix touch targets to 56px minimum
  Verify: `grep -c "56\|3.5rem" src/components/Button.tsx 2>/dev/null || echo 0`
### [P1] EXP-008: Write tests for most critical untested page
  Verify: `npx vitest run [test_file] 2>&1 | grep -c "pass\|✓" || echo 0`
### [P1] EXP-009: Write tests for second critical untested page
  Verify: `npx vitest run [test_file] 2>&1 | grep -c "pass\|✓" || echo 0`
### [P1] EXP-010: Remove @ts-ignore / @ts-expect-error from highest file
  Verify: `grep -c "@ts-ignore\|@ts-expect-error" [target_file] || echo 0`
### [P1] EXP-011: Add empty state to project list
  Verify: `grep -c "empty\|no.*project\|Create.*first\|getStarted" src/pages/Projects.tsx 2>/dev/null || echo 0`
### [P2] EXP-012: Remove hardcoded color values from highest file
  Verify: `grep -c "'#[0-9a-fA-F]\{6\}'" [target_file] || echo 0`
### [P2] EXP-013: Add aria-labels to navigation components
  Verify: `grep -c "aria-label\|role=" [target_file] 2>/dev/null || echo 0`
### [P1] EXP-014: Write test for most critical untested hook
  Verify: `npx vitest run [test_file] 2>&1 | grep -c "pass\|✓" || echo 0`
### [P1] EXP-015: Add Supabase connection health indicator
  Verify: `grep -rn "supabase.*status\|connection.*health\|StatusBar\|isOnline" src/ --include="*.tsx" | wc -l`

## RULES (non-negotiable)
1. **ALWAYS use `CREATE TABLE IF NOT EXISTS`** in every migration — never `CREATE TABLE` without it
2. **ALWAYS wrap triggers in DO/EXCEPTION blocks:**
3. **BEFORE creating any migration**: run `grep -r 'CREATE TABLE.*table_name' supabase/migrations/` to check if it already exists
4. **NEVER create a migration with the same timestamp prefix as an existing file** — check the last migration number first
5. Root cause of 2026-04-06 incident: 4 separate AI sessions created 4 migrations for notification_queue without checking history
6. **The CI runner uses Linux. `npm ci` with a Mac-generated lockfile will FAIL** on Vite 8+ because rolldown needs platform-specific native bindings not included in a Mac lockfile
7. **Always use `rm -f package-lock.json && npm install`** in all CI steps (never `npm ci`)
8. This is already fixed in homeostasis.yml and all other workflow files
9. Default RLS with `auth.uid()` causes **11-second queries** on large tables
10. Wrapping in `(select auth.uid())` drops to **7ms** — a 1,571x improvement
11. **ALWAYS** write RLS policies as:
12. The `(select ...)` wrapper prevents PostgreSQL from re-evaluating auth.uid() for every row
13. This applies to EVERY table with RLS. Audit all 48 migrations.
14. NEVER use hyphens in UI text, copy, or comments.
15. NEVER use hyphens in any text content, UI copy, or comments. Use commas, periods, or restructure sentences instead.

## METRICS (current state)
| Metric | Value | Target | Worst files |
|--------|-------|--------|-------------|
| Unsafe casts (as any + ts-ignore) | 13 as-any, 1 ts-ignore | 260 → 0 | src/components/collaboration/EditConflictGuard.tsx, src/lib/rls.ts, src/lib/supabase.ts, src/components/files/UploadZone.tsx, src/stores/fileStore.ts |
| Quality issues (colors + mock data) | 570 hardcoded colors, 0 mock data | mock floor 7 → 0 | src/types/enums.ts, src/pages/Submittals.tsx, src/pages/Safety.tsx, src/components/schedule/GanttChart.tsx, src/pages/Schedule.tsx |
| Test coverage | 5.7% (23 tested, 378 untested) | 80%+ | — |
| ESLint | 1063 errors, 52 warnings | floor 1379 → 0 | src/pages/Drawings.tsx, src/pages/Files.tsx, src/pages/Safety.tsx, src/pages/Submittals.tsx, src/pages/RFIs.tsx |

## QUALITY FLOOR (never regress below)
| Metric | Current floor | Target |
|--------|--------------|--------|
| Mock data        | 7 | 0 |
| Unsafe casts     | 260 | 0 |
| ESLint errors    | 1379 | 0 |

## PATTERNS (use these)
- PAT-001: Always use cursor-based pagination for lists. Never offset-based. Cursor: use the last item's created_at + id as the cursor. This avoids the 'page drift' problem when items are added while paginating.
- PAT-002: For mutations: 1) save previousData with queryClient.getQueryData, 2) optimistically update with queryClient.setQueryData, 3) onError: restore previousData and show toast, 4) onSettled: invalidate to get server truth. Never skip the rollback.
- PAT-003: Use the fromTable<T>('tableName') helper from src/lib/supabase.ts for all database queries. It returns typed data without 'as any' casts. Never call supabase.from() directly without type generics.
- PAT-004: Wrap each route in an ErrorBoundary component that catches render errors and shows a user-friendly fallback UI. One ErrorBoundary per route, not per component.
- PAT-005: All RLS policies MUST wrap auth.uid() in a subselect: USING (user_id = (select auth.uid())). This prevents per-row re-evaluation and gives a 1,571x performance improvement on large tables.

## KILLED APPROACHES (avoid these)
- 
- 
- 

## AVAILABLE SKILLS
  (SKILL_REGISTRY.json not found — skills not tracked yet)

## SPEC P0 UNCHECKED (demo-critical)
- [ ] `grep -r "Math.random\|faker\|mockData\|MOCK\|hardcoded" src/ --include="*.ts" --include="*.tsx"` returns 0 results in production code paths
- [ ] RFIs page fetches all RFI records from `rfis` Supabase table with proper project_id filter and displays real data
- [ ] Submittals page fetches from `submittals` table; submittal list renders real rows with actual status, ball-in-court, and due date
- [ ] PunchList page fetches from `punch_items` table; items display real location, assignee, and photo attachments from Supabase Storage
- [ ] DailyLog page fetches from `daily_logs` table; entries show real manpower, weather (from API or stored value), and activity descriptions
- [ ] FieldCapture page uploads photos to Supabase Storage bucket `field-captures` and inserts record into `field_captures` table; gallery renders from real URLs
- [ ] AICopilot page sends user messages to a real Supabase Edge Function (`/functions/v1/ai-copilot`); responses come from actual LLM, not static strings
- [ ] Each page that previously used mock data now shows an empty state component (not a blank screen) when no real data exists
- [ ] Loading skeletons display during data fetch on all 6 pages
- [ ] Unit: `RFIs.test.tsx` — mock Supabase client, assert `from('rfis').select()` is called with correct project_id on mount

---
*Compressed brief — for details on any section, read the full source file.*
*Read CLAUDE.md | EXPERIMENTS.md | LEARNINGS.md | EVOLUTION_LEDGER.json as needed.*
