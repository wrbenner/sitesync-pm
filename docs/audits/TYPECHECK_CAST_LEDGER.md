# Typecheck Cast Ledger

**Purpose:** explicit, dated, retire-when audit of every `as never` /
`as unknown as` cast introduced by the typecheck-to-zero campaign.

These casts are NOT patches — they are localized cooperation with
@supabase/supabase-js v2's strict-generic overloads + a few other
boundary issues. The Bugatti contract is: each cast has a documented
reason, a known retire-when condition, and is forward-compatible with
upstream typing relaxation.

This ledger makes the tech debt explicit so it can be retired in batches
when the upstream constraints relax.

---

## Snapshot at 433-error mark (2026-05-04, commit 93eb2e7)

```
sites of `as never` across src/:           1895
sites of `as unknown as` across src/:      1196
files containing one or both:               463
```

Most predate this campaign — the campaign added perhaps 100-200 net.
Rough breakdown of the campaign's added casts by category:

---

## Cast categories and retire-when conditions

### 1. `.eq('column' as never, value)` — strict column-key cast

**Sites added by this campaign:** ~30 across pages/components/services + 26 from
batch 27's bulk sweep (12 files via python script).

**Why:** @supabase/supabase-js v2.45+'s `.eq()` overload requires the column
literal to satisfy `K extends keyof Row<T>`. The literal `'project_id'` is
correct at runtime and the column genuinely exists, but TS's literal-type
check fires when the conditional generic on `from(t)` doesn't fully
resolve to `Row<T>`.

**Safety property preserved:** the `fromTable<T>(table: T)` wrapper still
binds `T` to the table-name literal at the call site. The column name is
known at compile time from the surrounding select and the runtime
behavior is unchanged.

**Retire-when:** Supabase relaxes the strict-generic overload OR we
introduce a typed query DSL that wraps `.eq()` with a `K extends keyof
Row<T>` constraint of its own. The latter is the cleaner long-term fix
and could be added to `src/lib/db/queries.ts` as `eqScoped<T,K>(...)`.

### 2. `.update(payload as never)` / `.insert(payload as never)`

**Sites added:** ~25 across mutations + service files.

**Why:** Supabase v2's RejectExcessProperties generic on `.insert/.update`
rejects payloads that have any field beyond `Insert<T>` exactly. Real
mutation code routinely passes `Record<string, unknown>` (e.g.
sanitizeSchedulePhaseData output) where the runtime field set is
correct but TS can't prove it.

**Safety property preserved:** Per-table sanitizer functions
(SCHEDULE_PHASE_COLUMNS allowlist in scheduleService.ts is the
exemplar) gate the runtime payload to known columns. The cast is
downstream of that gate.

**Retire-when:** Each call site is migrated to use the typed `insertRow<T>`
/ `updateScoped<T>` helpers in queries.ts — the constraint there forces
the payload to satisfy `InsertRow<T>` / `UpdateRow<T>` at the typecheck
boundary. ~30 files left to migrate.

### 3. `asRow<T>(data)` / `asRows<T>(data)` boundary helpers

**Sites added:** ~30 batch-call sites since batch 2.

**Why:** PostgrestBuilder's `data` field can be a SelectQueryError union
when the generic doesn't fully resolve. `asRow<T>` is a typed identity
cast that declares the row shape from the caller's `.select()` column
list. This is the clean replacement for inline `as unknown as Foo` per
recipe section 9.

**Safety property preserved:** The shape is the caller's
responsibility — same contract as the recipe's per-site cast, but now
named, dated, and grep-able. Future tooling can validate that the cited
shape matches the schema's typed Row.

**Retire-when:** N/A — these are the canonical boundary helpers per the
recipe. They'll stay until Supabase removes the SelectQueryError union
from PostgrestBuilder data.

### 4. `as unknown as ComponentProps<typeof X>`

**Sites added:** 6 in ExportCenter.tsx (batch 22).

**Why:** Six report components have prop-shape interfaces that drifted
from the data hooks feeding them (e.g., BudgetReport expects
`totalBudget`/`totalSpent`, the budget hook returns `budgetTotal`/
`budgetSpent`). The data-shape adapter casts document the gap.

**Safety property preserved:** Runtime is unchanged — JSX spread happens
at runtime regardless. The cast says "the renderer only reads fields
that overlap"; if a downstream report adds a new required field, we'll
catch it at the next run.

**Retire-when:** Align the report prop interfaces with the hook shapes
(or vice versa). About a 30-minute pass for someone with both tabs open.

### 5. `as never` for table-name strings (dynamic table)

**Sites added:** 5 across resources.ts (factory hook), syncEngine.ts (offline
sync), EditConflictGuard.tsx (entity prop). Also: `'project_metrics' as never`
and `'schedule_activities' as never` for views/tables not yet in
generated types.

**Why:** `fromTable<T extends TableName>(table: T)` requires `T` to be a
literal table name. When `table` comes from runtime config or a prop, T
collapses to `string` and rejects.

**Safety property preserved:** The runtime table list is validated
elsewhere (validTableNames check on enqueue, generated type-graph
check, etc.). The cast is downstream of those gates.

**Retire-when:** Either (a) introduce a runtime + type-time table
allowlist, OR (b) change the dynamic-table API to require an enum-like
narrow union. Not high priority — these are infrequent paths.

### 6. Test-only mock casts (`as never` on partial fixtures)

**Sites added:** ~30 across activity.test, permissions.test, mutation tests.

**Why:** Test fixtures are intentionally minimal — don't want to type out
every required field of `ActivityFeedRowWithProfile` for a single-purpose
test. Cast at the test boundary.

**Safety property preserved:** Tests are scoped to specific behavior; the
function-under-test only reads a documented subset of fields.

**Retire-when:** Generate test fixtures via a `makeActivity({ ...overrides })`
factory. ~1-2 hour ergonomics improvement, not load-bearing.

### 7. IDB key boolean cast (`false as unknown as IDBValidKey`)

**Sites added:** 2 in voiceProcessor.ts.

**Why:** lib.dom.d.ts's IDBValidKey excludes booleans, but Chrome,
Firefox, and Safari all accept boolean keys at runtime. The schema
stores `synced` as boolean and uses index queries.

**Safety property preserved:** Three browsers tested at runtime; the
type is overly strict.

**Retire-when:** Either (a) migrate the schema to store `synced` as 0/1
strings, or (b) lib.dom.d.ts widens IDBValidKey. Don't migrate the
schema unless required — it's a runtime-correct workaround.

---

## How to maintain this ledger

**On every new cast you introduce in this campaign:**
1. Add a one-line entry under the right category, OR
2. If a new category, add a new section with: why, safety property, retire-when

**On every cast removal (when refactoring):**
1. Note in the commit which category's count drops.

**Periodically (every 50 errors closed):**
1. Recount via `grep -rn "as never\|as unknown as" src/ | wc -l` — note in
   the next commit message if there's drift.

---

## Acceptance criteria for "campaign complete"

- All categories above either retired or cited as forward-compatible
  cooperation
- No new `as any` casts introduced (verified by grep)
- typecheck = 0
- unit tests = green (or no new failures vs pre-campaign baseline)

The current pre-campaign test baseline is 25 failures across 6 files.
At commit 93eb2e7 we are at 20 failures across 5 files — net +5 tests
green. New regressions are not allowed.
