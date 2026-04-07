# SESSION_BRIEF — Tuesday April 07 at 2am CDT
*Pre-computed context. Read this INSTEAD of reading 6 separate files. Generated 07:57 UTC.*

---

## TONIGHT: Night 1 — April 7 (Foundation Security + Mock Data)

## TONIGHT: Night 1 — April 7 (Foundation Security + Mock Data)

**Status:** PENDING
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
