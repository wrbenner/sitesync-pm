---
name: zustand-consolidation
description: >
  Audit a React/TypeScript codebase for dead or redundant Zustand stores, then
  execute a consolidation plan: merge stores, rename them with zero-downtime
  deprecation shims, batch-migrate all consumer files, clean barrel exports,
  and update test mocks. Use this skill whenever you need to reduce Zustand store
  count, merge overlapping state slices (e.g., merge orgStore → authStore),
  rename stores without breaking existing consumers, identify and delete stores
  with 0 active consumers, or clean up a messy stores/index.ts barrel file.
  Triggers on: "consolidate stores", "merge zustand stores", "rename this store",
  "clean up our state management", "reduce store count", "store has 0 consumers",
  "migrate off organizationStore", "rename projectContextStore", or any request
  to simplify, flatten, or refactor Zustand state architecture.
---

# Zustand Store Consolidation

This skill guides a systematic reduction of Zustand store sprawl in React/TypeScript
projects. It covers four operations — **audit**, **merge**, **rename**, and **clean** —
which can be used independently or as a coordinated multi-day plan.

---

## Phase 1 — Audit: find candidates

Before touching code, build a precise picture of what exists and who uses it.

### 1a. List all stores

```bash
ls src/stores/*.ts | grep -v index.ts
```

### 1b. Count active consumers per store (excluding shims and barrel)

```bash
for store in src/stores/*.ts; do
  name=$(basename "$store" .ts)
  hook=$(grep -o 'export const use[A-Za-z]*' "$store" | head -1 | awk '{print $3}')
  if [ -n "$hook" ]; then
    count=$(grep -r "$hook" --include="*.ts" --include="*.tsx" -l \
      | grep -v "src/stores/" | wc -l | tr -d ' ')
    echo "$count  $hook  ($name.ts)"
  fi
done | sort -n
```

Stores with **0 consumers** are dead and safe to delete via `git rm`.
Stores with **1–3 consumers** are merge/inline candidates.

### 1c. Identify conceptual overlaps

Look for stores that logically belong together:
- Auth + organization/tenant context → one `authStore`
- Multiple domain entity stores (rfi, submittal, crew) → one generic `entityStore`
- Multiple AI/copilot stores → one `aiStore`
- UI flags scattered across stores → one `uiStore`

Document the target state: "X stores → Y stores" with a mapping table.

---

## Phase 2 — Merge: fold one store into another

The safest merge pattern: add the source store's state/actions to the destination
store, replace the source file with a **deprecation shim**, and migrate consumers
in one batch.

### 2a. Expand the destination store

Open the destination store and add the source's fields and actions. Key decisions:
- **Field naming**: prefer the destination store's existing naming convention.
  If source has `currentOrg` and destination has `organization`, keep `organization`.
- **`signOut` / reset**: make sure the destination's sign-out action clears the
  merged fields too.
- **Don't add `persist`** if destination doesn't already use it — re-hydration
  from the server on mount is usually fine and avoids LocalStorage migration debt.

### 2b. Replace the source file with a shim

```typescript
/**
 * @deprecated sourceStore was merged into destinationStore on YYYY-MM-DD.
 *
 * Migration guide:
 *   - useSourceStore().field        → useDestStore().renamedField
 *   - useSourceStore().action()     → useDestStore().action()
 *
 * This shim exists only as a safety net. Delete once all consumers are updated.
 */
import { useDestStore } from './destStore'

/** @deprecated Use useDestStore instead */
export const useSourceStore = {
  getState: () => {
    const s = useDestStore.getState()
    return {
      // Map old field names → new ones
      currentOrg: s.organization,
      organizations: s.organizations,
      setCurrentOrg: s.setCurrentOrg,
      setLoading: () => { /* no-op */ },
    }
  },
}
```

The shim means *zero breakage* for any consumer you haven't migrated yet.

### 2c. Migrate consumers in batch

Write a Python script rather than editing files one by one:

```python
#!/usr/bin/env python3
"""Migrate consumers from useSourceStore to useDestStore."""
import re, sys
from pathlib import Path

SRC = Path('src')
OLD_IMPORT_RE = re.compile(r"from '([^']*/)sourceStore'")
OLD_HOOK = 'useSourceStore'
NEW_HOOK = 'useDestStore'
NEW_PATH_SUFFIX = 'destStore'

FIELD_MAP = {
    'currentOrg': 'organization',
    # add other renamed fields here
}

changed = []
for fpath in SRC.rglob('*.ts*'):
    if 'stores/' in str(fpath):
        continue
    text = fpath.read_text()
    if OLD_HOOK not in text:
        continue
    new_text = OLD_IMPORT_RE.sub(
        lambda m: f"from '{m.group(1)}{NEW_PATH_SUFFIX}'", text
    )
    new_text = new_text.replace(OLD_HOOK, NEW_HOOK)
    for old_field, new_field in FIELD_MAP.items():
        new_text = new_text.replace(old_field, new_field)
    if new_text != text:
        fpath.write_text(new_text)
        changed.append(str(fpath))

print(f"Updated {len(changed)} files:")
for f in changed:
    print(' ', f)
```

Run from the repo root. Spot-check 2–3 files manually before committing.

### 2d. Update test mocks

Tests that mock the source store need to mock the destination store instead.
The batch script handles import paths and hook names. Also rename the mock's
return value fields to match the destination store's naming:

```typescript
// Before
vi.mock('../stores/sourceStore', () => ({
  useSourceStore: vi.fn().mockReturnValue({ currentOrg: { id: 'org-1' } }),
}))

// After
vi.mock('../stores/destStore', () => ({
  useDestStore: vi.fn().mockReturnValue({ organization: { id: 'org-1' } }),
}))
```

---

## Phase 3 — Rename: move a store to a new name

Use this when the store name is wrong/misleading but the logic is staying the same.

### Pattern

1. Create the new file (`newName.ts`) with the actual implementation.
   - Preserve the Zustand `persist` key if the store uses `persist()` — changing
     the key silently drops all users' persisted state.
2. Replace the old file (`oldName.ts`) with a one-liner shim:
   ```typescript
   /** @deprecated Renamed to newName on YYYY-MM-DD */
   export { useNewStore as useOldHook } from './newName'
   ```
3. Run the batch consumer migration script from Phase 2 with the appropriate
   old/new hook and path names.

---

## Phase 4 — Clean: update the barrel

After merging/renaming, the `stores/index.ts` barrel is likely stale. Rewrite it
cleanly rather than patching it.

### Identify what to keep

```bash
grep "^export" src/stores/index.ts | while read line; do
  hook=$(echo "$line" | grep -o 'use[A-Za-z]*')
  count=$(grep -r "$hook" --include="*.ts" --include="*.tsx" -l \
    | grep -v "src/stores/" | wc -l | tr -d ' ')
  echo "$count  $hook"
done | sort -n
```

Anything with 0 consumers that isn't a known shim can be dropped from the barrel.

### Write the clean barrel, grouped by lifecycle status:

```typescript
// ─── Primary stores ───────────────────────────────────────────────────────
export { useAuthStore } from './authStore';
export { useProjectStore } from './projectStore';
export { useUiStore } from './uiStore';

// ─── Domain stores (migration targets) ───────────────────────────────────
export { useSubmittalStore } from './submittalStore';
export { usePunchListStore } from './punchListStore';

// ─── Infrastructure / shared ──────────────────────────────────────────────
export { useEntityStoreRoot, useEntityStore, useEntityActions } from './entityStore';
export { usePresenceStore } from './presenceStore';
```

Verify no duplicates:

```bash
node -e "
const fs = require('fs');
const c = fs.readFileSync('src/stores/index.ts', 'utf8');
const names = [];
(c.match(/export \{ [^}]+ \}/g) || []).forEach(e => {
  e.match(/\{([^}]+)\}/)[1].split(',').forEach(n => {
    const name = n.trim().split(' ')[0];
    if (names.includes(name)) console.log('DUPLICATE:', name);
    else names.push(name);
  });
});
console.log('Total exports:', names.length);
"
```

---

## Execution checklist

Before committing, verify:

- [ ] Dead stores (0 consumers) replaced with shims or removed
- [ ] Destination store compiles — check for TypeScript type errors
- [ ] All consumer files updated (re-run consumer audit script from Phase 1b)
- [ ] Test mocks updated (check for `vi.mock` references to old store path)
- [ ] Barrel has no duplicate exports
- [ ] `persist` key is unchanged on any store that used it
- [ ] `signOut` / session clear properly resets merged state

---

## Common pitfalls

**Type mismatches after merge**: The source and destination stores may use
different types (e.g., a lean interface vs a full database row type). Check import
paths and pick the more complete type; fill optional extra columns with `null`.

**Batch script clobbers field names**: Field renames (e.g., `currentOrg` →
`organization`) can match inside unrelated identifiers. Use word-boundary patterns
or be conservative — rename only in destructuring contexts if needed.

**Lock file during commit**: If `git commit` fails with "index.lock exists",
remove the lock file: `rm .git/index.lock`

**Shim cleanup**: Don't delete shims until you've confirmed (via grep) that zero
non-shim files import the old name. Once consumers are fully migrated, the shim
adds confusion and should be deleted.
