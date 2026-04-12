# SiteSync PM — Eval Harness

## Overview

The eval harness validates that SiteSync PM conforms to the Domain Kernel Spec
(`DOMAIN_KERNEL_SPEC.md`). Tests are organized in four layers, each targeting a
different boundary:

| Layer | Directory | What it tests | Status |
|-------|-----------|---------------|--------|
| 1 — Database | `layer1-database/` | RLS, tenant isolation, FK constraints, soft delete, state machines | **Active** (5 real tests, 1 placeholder) |
| 2 — API | `layer2-api/` | Auth enforcement, scope checks, input validation, output schema | **Active** (3 real tests, 1 placeholder) |
| 3 — E2E | `layer3-e2e/` | Full workflow lifecycles (RFI, Submittal, Daily Log, Punch Item) | **Placeholder** |
| 4 — AI | `layer4-ai/` | Grounding, citation, hallucination, trust tagging | **Placeholder** |

## Prerequisites

- **PostgreSQL 15+** with `pgTAP` extension (for Layer 1 SQL tests)
- **Node.js 18+** with `tsx` (for Layer 2/3/4 TypeScript tests)
- **A dedicated test database** — never the production database

## Configuration

1. **Copy the example config:**

   ```bash
   cp config.example.json config.json
   ```

2. **Set environment variables** (or edit `config.json` directly):

   | Variable | Description |
   |----------|-------------|
   | `SUPABASE_TEST_URL` | Supabase project URL for the **test** environment |
   | `SUPABASE_TEST_KEY` | Supabase `anon` key for the **test** environment |
   | `SUPABASE_TEST_SERVICE_KEY` | Supabase `service_role` key for the **test** environment |
   | `SUPABASE_TEST_DB_URL` | Direct PostgreSQL connection string for the **test** database |

   > **WARNING:** Never use production credentials. All Layer 1 tests create and
   > destroy their own test data. The `config.json` file is `.gitignore`d.

3. **Verify your config:**

   ```bash
   ./run-evals.sh --dry-run
   ```

## Running Tests

```bash
# Run all active layers (1 + 2), report placeholders as skipped
./run-evals.sh

# Run a single layer
./run-evals.sh --layer 1
./run-evals.sh --layer 2

# Dry run — validate config without executing tests
./run-evals.sh --dry-run
```

## Output

The runner reports:

```
=== SiteSync PM Eval Results ===
Layer 1 (Database):  5 passed, 0 failed, 1 skipped
Layer 2 (API):       3 passed, 0 failed, 1 skipped
Layer 3 (E2E):       0 passed, 0 failed, 4 skipped
Layer 4 (AI):        0 passed, 0 failed, 4 skipped
─────────────────────────────────
TOTAL:               8 passed, 0 failed, 10 skipped (placeholder)
```

## Gold-Standard Fixtures

Tests are derived from the 20 gold-standard scenario fixtures defined in
`DOMAIN_KERNEL_SPEC.md` Section 13. The mapping is:

| Fixture | Layer | Test File | Status |
|---------|-------|-----------|--------|
| 1 — Tenant Isolation | L1 | `test_tenant_isolation.sql` | Active |
| 2 — Viewer Cannot Create RFI | L1 | `test_permission_boundary.sql` | Active |
| 3 — Superintendent Cannot Approve CO | L1 | `test_permission_boundary.sql` | Active |
| 4 — RFI Lifecycle | L3 | `test_rfi_lifecycle.spec.ts` | Placeholder |
| 5 — RFI Void | L3 | `test_rfi_lifecycle.spec.ts` | Placeholder |
| 6 — Submittal Resubmission | L3 | `test_submittal_lifecycle.spec.ts` | Placeholder |
| 7 — Change Order Promotion | L3 | `test_rfi_lifecycle.spec.ts` | Placeholder |
| 8 — Daily Log Rejection | L3 | `test_daily_log_lifecycle.spec.ts` | Placeholder |
| 9 — Punch Item Verification | L3 | `test_punch_item_lifecycle.spec.ts` | Placeholder |
| 10 — Pay Application Lifecycle | L3 | `test_rfi_lifecycle.spec.ts` | Placeholder |
| 11 — Drawing Supersession | L3 | `test_submittal_lifecycle.spec.ts` | Placeholder |
| 12 — Subcontractor Scope Limitation | L1 | `test_permission_boundary.sql` | Active |
| 13 — Permit Lifecycle | L3 | `test_punch_item_lifecycle.spec.ts` | Placeholder |
| 14 — Concurrent Project Isolation | L1 | `test_tenant_isolation.sql` | Active |
| 15 — Audit Log Immutability | L1 | `test_referential_integrity.sql` | Active |
| 16 — Soft Delete Invisibility | L1 | `test_soft_delete.sql` | Active |
| 17 — AI Agent Requires Approval | L4 | `test_trust_tagging.ts` | Placeholder |
| 18 — Financial Integrity | L3 | `test_rfi_lifecycle.spec.ts` | Placeholder |
| 19 — Portal User Limited Access | L2 | `test_scope_enforcement.ts` | Active |
| 20 — Referential Integrity | L1 | `test_referential_integrity.sql` | Active |

## Adding New Tests

1. Determine the correct layer for your test.
2. If the test has all prerequisites satisfied, write executable logic.
3. If blocked on schema/feature work, create a placeholder with `test.todo()` or
   `-- PLACEHOLDER` comment and document what must exist first.
4. Update `run-evals.sh` if you add new test files.
5. Update this README's fixture mapping table.

## Security

- `config.json` is in `.gitignore` — never commit credentials.
- `config.example.json` uses `$VARIABLE` placeholders — safe to commit.
- Layer 1 tests create test data with known UUIDs and tear it down afterwards.
- No test connects to or modifies the production database.
