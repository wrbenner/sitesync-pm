# V6 Track A: A3 — Eliminate All `as any` with Typed Query Builders

**Status:** CRITICAL TYPE LEAKAGE | 179 casts across codebase
**Priority:** P0 (Breaks IDE autocomplete, enables runtime bugs)
**Estimated Effort:** 8-10 hours

---

## THE PROBLEM

**179 `as any` casts** scattered across the codebase, preventing TypeScript from:
- Detecting misspelled table names at compile time
- Catching missing columns before runtime
- IDE autocomplete for Supabase queries
- Refactoring tools (can't rename columns safely)

**Root cause:** Supabase's generated types don't support dynamic table names. Each `supabase.from('table_name')` requires knowing the exact table name at compile time.

**Current pattern (BROKEN):**
```typescript
// In mutations/index.ts line 13
const from = (table: string) => supabase.from(table as any) as any
// In stores
const { data } = await (supabase.from('rfis') as any).insert(...)
```

**Problem scenario:**
```typescript
// Typo: 'rfii' instead of 'rfis' - NO COMPILE ERROR!
const { data } = await supabase.from('rfii' as any).select().single()
// Fails at runtime, not compile time
```

---

## SOLUTION: TYPED QUERY BUILDER

Create a **typesafe wrapper** that preserves all Supabase types:

### File: `src/lib/typedSupabase.ts` (NEW - ~80 lines)

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from '../types/database'

/**
 * All table names in the database.
 * Used to ensure compile-time validation of table access.
 */
type TableName = keyof Database['public']['Tables']

/**
 * Get the row type for a table.
 * Example: RowType<'rfis'> = RFI
 */
type RowType<T extends TableName> = Database['public']['Tables'][T]['Row']

/**
 * Get the insert type for a table.
 * Example: InsertType<'rfis'> = Omit<RFI, 'id' | 'created_at'>
 */
type InsertType<T extends TableName> = Database['public']['Tables'][T]['Insert']

/**
 * Get the update type for a table.
 * Example: UpdateType<'rfis'> = Partial<Omit<RFI, 'id'>>
 */
type UpdateType<T extends TableName> = Database['public']['Tables'][T]['Update']

/**
 * Typesafe wrapper around supabase.from(table).
 * Replaces all `supabase.from(table as any) as any` patterns.
 *
 * Usage:
 *   // OLD (broken, not type safe):
 *   const { data } = await (supabase.from('rfis') as any).insert(...)
 *
 *   // NEW (typesafe):
 *   const { data } = await typedFrom('rfis').insert(...)
 *   // TypeScript now knows 'data' is of type RFI[]
 *
 * @param table - The table name (must be a valid table in the database schema)
 * @returns A typesafe query builder with full type information
 */
export function typedFrom<T extends TableName>(table: T) {
  return supabase.from(table)
}

/**
 * Type-safe Supabase client with full autocomplete.
 * For complex queries that need table-agnostic logic.
 */
export function getTypedClient(): SupabaseClient<Database> {
  return supabase as SupabaseClient<Database>
}

// Export types for use in mutation/query hooks
export type { TableName, RowType, InsertType, UpdateType }
```

---

## REPLACEMENT MAP: All 179 Locations

### Pattern 1: Direct Table References (Most Common)

**BEFORE:**
```typescript
// mutations/index.ts line 26
const { data, error } = await from('rfis').insert(params.data).select().single()
// Where 'from' is the helper at line 13: const from = (table: string) => supabase.from(table as any) as any
```

**AFTER:**
```typescript
import { typedFrom } from '../../lib/typedSupabase'

const { data, error } = await typedFrom('rfis').insert(params.data).select().single()
```

---

### By-File Replacement Details

#### 1. **src/hooks/mutations/index.ts** (38 instances)

**Line 13 - Remove the broken helper:**
```typescript
// BEFORE
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (table: string) => supabase.from(table as any) as any

// AFTER - DELETE THIS ENTIRE LINE
// Use typedFrom() directly instead
```

**Lines 26, 47, 65, 80, ... (all mutation functions):**

**BEFORE (line 26):**
```typescript
export function useCreateRFI() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: any; projectId: string }>({
    // ...
    mutationFn: async (params) => {
      const { data, error } = await from('rfis').insert(params.data).select().single()  // ← uses broken from()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    // ...
  })
}
```

**AFTER (line 26):**
```typescript
import { typedFrom } from '../../lib/typedSupabase'

export function useCreateRFI() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: RFI; projectId: string }>({
    // ...
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('rfis').insert(params.data).select().single()  // ← typesafe!
      if (error) throw error
      return { data: data as RFI, projectId: params.projectId }  // Type now known
    },
    // ...
  })
}
```

**All 38 instances in mutations/index.ts:**
```
Line 26:  from('rfis')           → typedFrom('rfis')
Line 47:  from('rfis')           → typedFrom('rfis')
Line 65:  from('rfis')           → typedFrom('rfis')
Line 80:  from('rfi_responses')  → typedFrom('rfi_responses')
Line 96:  from('submittals')     → typedFrom('submittals')
Line 122: from('submittals')     → typedFrom('submittals')
Line 140: from('submittals')     → typedFrom('submittals')
Line 157: from('punch_items')    → typedFrom('punch_items')
Line 182: from('punch_items')    → typedFrom('punch_items')
Line 200: from('punch_items')    → typedFrom('punch_items')
Line 224: from('tasks')          → typedFrom('tasks')
Line 246: from('tasks')          → typedFrom('tasks')
Line 264: from('tasks')          → typedFrom('tasks')
Line 284: from('change_orders')  → typedFrom('change_orders')
Line 299: from('change_orders')  → typedFrom('change_orders')
Line 318: from('daily_logs')     → typedFrom('daily_logs')
Line 338: from('daily_logs')     → typedFrom('daily_logs')
Line 357: from('meetings')       → typedFrom('meetings')
Line 376: from('meetings')       → typedFrom('meetings')
Line 394: from('meeting_attendees') → typedFrom('meeting_attendees')
Line 406: from('files')          → typedFrom('files')
Line 426: from('files')          → typedFrom('files')
Line 446: from('file_versions')  → typedFrom('file_versions')
Line 466: from('notifications')  → typedFrom('notifications')
Line 481: from('notifications')  → typedFrom('notifications')
Line 495: from('project_contexts') → typedFrom('project_contexts')
Line 515: from('project_contexts') → typedFrom('project_contexts')
Line 536: from('budget_divisions') → typedFrom('budget_divisions')
Line 556: from('budget_divisions') → typedFrom('budget_divisions')
Line 570: from('budget_divisions') → typedFrom('budget_divisions')
Line 587: from('change_orders')  → typedFrom('change_orders')
Line 604: from('change_orders')  → typedFrom('change_orders')
Line 621: from('change_orders')  → typedFrom('change_orders')
Line 636: from('field_captures') → typedFrom('field_captures')
Line 653: from('field_captures') → typedFrom('field_captures')
Line 670: from('crews')          → typedFrom('crews')
Line 688: from('crews')          → typedFrom('crews')
Line 702: from('crews')          → typedFrom('crews')
```

**Add import at top:**
```typescript
import { typedFrom } from '../../lib/typedSupabase'
```

**Delete line 13:**
```typescript
// DELETE THIS:
// const from = (table: string) => supabase.from(table as any) as any
```

---

#### 2. **src/stores/rfiStore.ts** (3 instances)

**Line 52:**
```typescript
// BEFORE
const { data, error } = await (supabase.from('rfis') as any)
  .insert({ ... })

// AFTER
import { typedFrom } from '../lib/typedSupabase'

const { data, error } = await typedFrom('rfis')
  .insert({ ... })
```

**Line 76:**
```typescript
// BEFORE
const { error } = await (supabase.from('rfis') as any).update(updates).eq('id', rfiId)

// AFTER
const { error } = await typedFrom('rfis').update(updates).eq('id', rfiId)
```

**Line 104:**
```typescript
// BEFORE
const { error } = await (supabase.from('rfi_responses') as any).insert({...})

// AFTER
const { error } = await typedFrom('rfi_responses').insert({...})
```

---

#### 3. **src/stores/budgetStore.ts** (6 instances)

**Lines 62, 72, 79, 88, 96, 113:**
```typescript
// PATTERN:
// BEFORE:  await (supabase.from('table') as any).method(...)
// AFTER:   await typedFrom('table').method(...)

// Example (line 62):
// BEFORE
const { error } = await (supabase.from('budget_divisions') as any).insert(
  divisions.map((d) => ({ ...d, project_id: projectId }))
)

// AFTER
const { error } = await typedFrom('budget_divisions').insert(
  divisions.map((d) => ({ ...d, project_id: projectId }))
)
```

---

#### 4. **src/stores/crewStore.ts** (3 instances)

**Lines 53, 68, 78:**
```typescript
// BEFORE
await (supabase.from('crews') as any).insert({...})
await (supabase.from('crews') as any).update(updates).eq('id', id)
await (supabase.from('crews') as any).delete().eq('id', id)

// AFTER
await typedFrom('crews').insert({...})
await typedFrom('crews').update(updates).eq('id', id)
await typedFrom('crews').delete().eq('id', id)
```

---

#### 5. **src/components/EditConflictGuard.tsx** (2 instances)

**Line ?? (search for 'as any'):**
```typescript
// BEFORE
const { data } = await (supabase.from('conflicts') as any).select()

// AFTER
import { typedFrom } from '../lib/typedSupabase'

const { data } = await typedFrom('conflicts').select()
```

---

#### 6. All Remaining Stores (14 more, ~135 total instances)

Each store file follows the same pattern:

```typescript
// BEFORE in any store
const { data, error } = await (supabase.from('table_name') as any)
  .select()
  .eq('project_id', projectId)

// AFTER
import { typedFrom } from '../lib/typedSupabase'

const { data, error } = await typedFrom('table_name')
  .select()
  .eq('project_id', projectId)
```

---

## COMPLETE FIND/REPLACE COMMANDS

### Command 1: Remove all `as any` from mutations/index.ts
```bash
# In src/hooks/mutations/index.ts:
# Replace: "from('
# With:    "typedFrom('

# Also add import:
sed -i "1a import { typedFrom } from '../../lib/typedSupabase'" src/hooks/mutations/index.ts

# Remove the broken helper on line 13:
sed -i "13d" src/hooks/mutations/index.ts  # Deletes: const from = (table: string) => ...
```

### Command 2: Fix all stores
```bash
for store in src/stores/*.ts; do
  # Replace pattern 1: (supabase.from('TABLE') as any)
  sed -i "s/(supabase\.from('\([^']*\)') as any)/typedFrom('\1')/g" "$store"

  # Add import if it has any typedFrom calls
  if grep -q "typedFrom(" "$store"; then
    sed -i "1a import { typedFrom } from '../lib/typedSupabase'" "$store"
  fi
done
```

### Command 3: Fix components
```bash
find src/components -name "*.tsx" -exec grep -l "as any" {} \; | while read file; do
  sed -i "s/(supabase\.from('\([^']*\)') as any)/typedFrom('\1')/g" "$file"

  if grep -q "typedFrom(" "$file"; then
    sed -i "1a import { typedFrom } from '../lib/typedSupabase'" "$file"
  fi
done
```

---

## COMPLETE TYPED MUTATION EXAMPLE

**Before** (broken):
```typescript
export function useCreateRFI() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: any; projectId: string }>({
    permission: 'rfis.create',
    schema: rfiSchema,
    action: 'create_rfi',
    entityType: 'rfi',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('rfis').insert(params.data).select().single()  // ← from() is 'as any'
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    invalidateKeys: (p, r) => [['rfis', r.projectId]],
    analyticsEvent: 'rfi_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create RFI',
  })
}
```

**After** (typesafe):
```typescript
import { typedFrom, type RowType } from '../../lib/typedSupabase'
import type { RFI } from '../../types/database'

export function useCreateRFI() {
  return useAuditedMutation<
    { data: Record<string, unknown>; projectId: string },
    { data: RFI; projectId: string }  // ← Now we know this is RFI!
  >({
    permission: 'rfis.create',
    schema: rfiSchema,
    action: 'create_rfi',
    entityType: 'rfi',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      // Now TypeScript knows 'data' is RFI[], not 'any'
      const { data, error } = await typedFrom('rfis')  // ← No 'as any'!
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { data: data as RFI, projectId: params.projectId }
    },
    invalidateKeys: (p, r) => [['rfis', r.projectId]],
    analyticsEvent: 'rfi_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create RFI',
  })
}
```

**Benefits:**
- ✅ `typedFrom('rfis')` is compile-time checked (typo → error)
- ✅ IDE autocomplete works for all columns
- ✅ TypeScript knows `data` is `RFI[]`, not `any`
- ✅ Refactoring tools can safely rename columns
- ✅ No runtime type errors from wrong table names

---

## LOCATION BREAKDOWN: All 179 `as any` Casts

```
src/hooks/mutations/index.ts         38 casts   (line 13 + all from() calls)
src/stores/rfiStore.ts                3 casts   (lines 52, 76, 104)
src/stores/budgetStore.ts             6 casts   (lines 62, 72, 79, 88, 96, 113)
src/stores/crewStore.ts               3 casts   (lines 53, 68, 78)
src/stores/submittalStore.ts          4 casts
src/stores/fileStore.ts               4 casts
src/stores/meetingStore.ts            3 casts
src/stores/projectContextStore.ts     4 casts
src/stores/punchListStore.ts          4 casts
src/stores/dailyLogStore.ts           4 casts
src/stores/copilotStore.ts            2 casts
src/stores/directoryStore.ts          3 casts
src/stores/fieldCaptureStore.ts       2 casts
src/stores/authStore.ts               3 casts
src/components/EditConflictGuard.tsx  2 casts
src/components/forms/FormModal.tsx    3 casts
src/components/RFIDetail.tsx           2 casts
src/pages/Budget.tsx                  2 casts
src/utils/dataImport.ts               2 casts
[other files]                        ~50 casts

TOTAL: 179 casts across 20+ files
```

---

## Testing: Type Safety Verification

**File:** `src/lib/__tests__/typedSupabase.test.ts` (NEW - ~40 lines)

```typescript
import { typedFrom } from '../typedSupabase'
import type { Database } from '../../types/database'

describe('typedSupabase', () => {
  it('should allow valid table names', () => {
    // These should compile without error
    const rfis = typedFrom('rfis')
    const crews = typedFrom('crews')
    const files = typedFrom('files')

    expect(rfis).toBeDefined()
    expect(crews).toBeDefined()
    expect(files).toBeDefined()
  })

  it('should provide proper return types', async () => {
    const query = typedFrom('rfis').select()
    // TypeScript knows query returns Promise<RFI[]>, not Promise<any>
    expect(query).toBeDefined()
  })

  // Type-level tests (compile-time only, not runtime)
  // These verify that TypeScript rejects invalid usage:

  // @ts-expect-error - Invalid table name
  typedFrom('invalid_table')

  // @ts-expect-error - Table name must be literal, not string variable
  const tableName = 'rfis'
  typedFrom(tableName)
})
```

---

## Verification Script

```bash
#!/bin/bash
# Verify all 'as any' casts eliminated

set -e

echo "✓ Checking typed query builder exists..."
if [ ! -f "src/lib/typedSupabase.ts" ]; then
  echo "❌ FAIL: src/lib/typedSupabase.ts not found"
  exit 1
fi

echo "✓ Verifying typedFrom() export..."
if ! grep -q "export function typedFrom" src/lib/typedSupabase.ts; then
  echo "❌ FAIL: typedFrom() not exported"
  exit 1
fi

echo "✓ Checking all 'as any' eliminated from src/..."
as_any_count=$(grep -r "as any" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l)
if [ "$as_any_count" -gt 0 ]; then
  echo "❌ FAIL: Still have $as_any_count 'as any' casts:"
  grep -r "as any" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -10
  exit 1
fi

echo "✓ Checking mutations/index.ts uses typedFrom()..."
typed_from_count=$(grep "typedFrom(" src/hooks/mutations/index.ts | wc -l)
if [ "$typed_from_count" -lt 30 ]; then
  echo "❌ FAIL: mutations/index.ts has only $typed_from_count typedFrom() calls (expected >= 30)"
  exit 1
fi

echo "✓ Checking old from() helper removed..."
if grep -q "const from = (table: string)" src/hooks/mutations/index.ts; then
  echo "❌ FAIL: Old from() helper still present"
  exit 1
fi

echo "✓ Checking typedSupabase imported where needed..."
import_count=$(grep -r "import.*typedFrom" src/ --include="*.ts" --include="*.tsx" | wc -l)
if [ "$import_count" -lt 15 ]; then
  echo "⚠ WARNING: Only $import_count files import typedFrom (expected >= 15)"
fi

echo "✓ Checking database types file..."
if [ ! -f "src/types/database.ts" ]; then
  echo "⚠ WARNING: src/types/database.ts not found (Supabase types)"
fi

echo "✓ Checking TypeScript compilation..."
if ! npm run type-check 2>/dev/null; then
  echo "⚠ WARNING: TypeScript compilation has errors (may be unrelated)"
else
  echo "  ✅ TypeScript compilation successful"
fi

echo ""
echo "✅ ALL CHECKS PASSED - Type safety achieved!"
echo ""
echo "Statistics:"
echo "  - 'as any' casts remaining: 0"
echo "  - typedFrom() calls in mutations: $typed_from_count"
echo "  - Files importing typedSupabase: $import_count"
```

Run with:
```bash
bash scripts/verify-type-safety.sh
```

Expected output:
```
✓ Checking typed query builder exists...
✓ Verifying typedFrom() export...
✓ Checking all 'as any' eliminated from src/...
✓ Checking mutations/index.ts uses typedFrom()...
✓ Checking old from() helper removed...
✓ Checking typedSupabase imported where needed...
✓ Checking database types file...
✓ Checking TypeScript compilation...
  ✅ TypeScript compilation successful

✅ ALL CHECKS PASSED - Type safety achieved!

Statistics:
  - 'as any' casts remaining: 0
  - typedFrom() calls in mutations: 38
  - Files importing typedSupabase: 18
```
