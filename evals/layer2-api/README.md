# Layer 2 — API / Edge Function Tests

## Purpose

Layer 2 tests validate the Supabase REST API and Edge Functions: authentication
enforcement, scope-based access control, input validation, and response schema
compliance. Tests use `fetch()` against the Supabase REST API.

## How It Works

Tests authenticate via Supabase JWT tokens. The test harness creates short-lived
tokens for test users (defined in Layer 1 `setup.sql`) using the service role key.

## Test Files

| File | What it tests | Status |
|------|---------------|--------|
| `test_auth_enforcement.ts` | Unauthenticated request → 401 | **Active** |
| `test_scope_enforcement.ts` | Wrong project/role → 403 or empty | **Active** |
| `test_input_validation.ts` | Malformed request body → 400 | **Active** |
| `test_output_schema.ts` | Response matches expected schema | Placeholder |

## Running

```bash
# Via the runner:
../run-evals.sh --layer 2

# Manually:
npx tsx test_auth_enforcement.ts
npx tsx test_scope_enforcement.ts
npx tsx test_input_validation.ts
```

## Prerequisites

- Node.js 18+ with `tsx` installed
- `config.json` populated with test environment credentials
- Layer 1 `setup.sql` must have been run (test users must exist)
