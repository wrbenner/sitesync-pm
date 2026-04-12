# Layer 1 — Database / RLS / Invariant Tests

## Purpose

Layer 1 tests validate the database layer directly: RLS policies, foreign key
constraints, scope enforcement, soft delete behaviour, and state machine
transitions. These tests run as raw SQL against a **test** Supabase/PostgreSQL
database.

## How It Works

1. **`setup.sql`** creates a known test environment: two organizations, two
   projects, and several test users with specific roles. All entities use
   deterministic UUIDs so tests can reference them by known IDs.
2. Each `test_*.sql` file runs assertions against the test data.
3. **`teardown.sql`** removes all test data after the suite completes.

## Test Files

| File | Fixtures Covered | Status |
|------|-----------------|--------|
| `test_tenant_isolation.sql` | #1, #14 | **Active** |
| `test_permission_boundary.sql` | #2, #3, #12 | **Active** |
| `test_scope_enforcement.sql` | Kernel §2 scope rules | **Active** |
| `test_state_machine.sql` | #4–#10, #13 (state transitions) | Placeholder |
| `test_referential_integrity.sql` | #15, #20 | **Active** |
| `test_soft_delete.sql` | #16 | **Active** |

## Running

```bash
# Via the runner:
../run-evals.sh --layer 1

# Manually:
psql "$SUPABASE_TEST_DB_URL" -f setup.sql
psql "$SUPABASE_TEST_DB_URL" -f test_tenant_isolation.sql
# ... run other tests ...
psql "$SUPABASE_TEST_DB_URL" -f teardown.sql
```

## Key Principle

Every test creates its own data and cleans it up. Tests never depend on
pre-existing rows in the database. The `setup.sql`/`teardown.sql` pair provides
shared fixtures; individual tests may create additional rows as needed.
