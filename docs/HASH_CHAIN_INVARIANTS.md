# Audit Log Hash Chain — Invariants for Consumers

> Reference for Tab A's `EntityAuditViewer`, `HashChainBadge`,
> `sealedExport`, and `hashChainVerifier`. Read this BEFORE reimplementing
> verification logic — every quirk below is intentional and consumer code
> must not contradict it.

Source of truth: `supabase/migrations/20260426000001_audit_log_hash_chain.sql`.

---

## Invariant 1 — chain is project-global, not per-project

The hash chain runs across the **entire** `audit_log` table, ordered by
`(created_at ASC, id ASC)`. There is exactly one chain. `previous_hash`
is NULL only for the very first row ever inserted, not per project,
not per entity.

**Implication for Tab A's `EntityAuditViewer`:**

- Per-entity views filter `audit_log` by `entity_type + entity_id`.
- The `previous_hash` of an entity-scoped row points at the *last
  audit_log row before it in global order*, which may not be on the same
  entity. That's fine — verification is global, presentation is filtered.
- Don't try to recompute hashes from a filtered slice; you'll get
  "broken" because you're missing the rows in between.

**Correct verification path:** call `verify_audit_chain(start_after)`
(SECURITY DEFINER, service_role only) and surface its output. If it
returns 0 rows, chain is intact. If it returns a row, the
`broken_at_id` + `expected_hash` + `actual_hash` are your debug data.

---

## Invariant 2 — canonical payload format is fixed

Both the trigger (insert path) and the verifier compute the SHA-256 of
this exact concatenation, in this exact order, with `|` separators:

```
id          | created_at | user_id    | user_email | project_id |
organization_id | entity_type | entity_id  | action     |
before_state    | after_state | changed_fields | metadata | prev_hash
```

Specific encoding rules:

| Field | Encoding |
|---|---|
| `id`, `user_id`, `project_id`, `organization_id`, `entity_id` | `coalesce(::text, '')` (UUID lowercase with dashes) |
| `created_at` | `coalesce(::text, '')` — Postgres default `timestamptz` text format with timezone |
| `user_email`, `entity_type`, `action` | direct text; `coalesce(..., '')` for the email only |
| `before_state`, `after_state` | `coalesce(::text, '')` of the JSONB column (Postgres default JSONB text — sorted keys) |
| `changed_fields` | `coalesce(array_to_string(..., ','), '')` |
| `metadata` | `coalesce(::text, '{}')` — note the `'{}'` default, not `''` |
| `prev_hash` | `coalesce(prev_hash, '')` — empty string for the first row, NOT the literal `'NULL'` |

**Trap to avoid:** never re-format JSON before hashing. The Postgres-native
text representation IS the canonical form. If client-side code stringifies
JSON differently (key reordering, whitespace, escape style) the hash will
not match.

---

## Invariant 3 — append-only is enforced at the row level

`audit_log_block_update` and `audit_log_block_delete` triggers BLOCK
non-postgres roles from mutating audit_log rows. RLS supplements this.

**Implication:** consumer code must NEVER attempt to UPDATE
`previous_hash` or `entry_hash` after the fact. If you find a row with
the wrong hash, the chain is broken — file it as a finding, never
"correct" it.

The migration's backfill block (lines 117–160) is the only legitimate
path that mutates these columns, and it runs as `postgres` during
migration.

---

## Invariant 4 — verification is incremental via checkpoints

`audit_chain_checkpoints` is a single-row table (id=1) with
`last_verified` (timestamptz). The verify-audit-chain edge function (or
the equivalent verifier in Tab A's `hashChainVerifier.ts`) should:

1. Read `last_verified` from `audit_chain_checkpoints`.
2. Call `verify_audit_chain(last_verified)`.
3. If it returns 0 rows: update `last_verified = now()`, write
   `last_run_at = now()`, mark the chain `intact`.
4. If it returns 1 row: leave `last_verified` alone (so re-runs detect
   the same break), set `last_run_at = now()`, mark `broken_at_id`.

**Trap:** the verify function takes `start_after` as the EXCLUSIVE
lower bound (`created_at > start_after`). Don't add 1 millisecond or
similar — pass the timestamp verbatim.

---

## Invariant 5 — hash format is hex (lowercase)

`encode(digest(...), 'hex')` produces lowercase hex (no `0x` prefix,
no uppercase). 64 characters. If client code compares hashes, normalize
to lowercase first. The `audit_chain_intact` UI badge should treat the
strings as opaque — never display them in mixed case.

---

## Invariant 6 — sealed PDF must include the chain

For Tab A's sealed-entity-export:

The PDF's manifest page must include:

1. **Chain status at export time** — output of
   `verify_audit_chain(NULL)` (full verification).
2. **List of audit_log row IDs** included in the PDF (in chronological
   order, with their `entry_hash` values).
3. **The PDF's own content hash** computed AFTER assembling the body
   pages but BEFORE the manifest page (manifest is the last page).
4. **A re-verify URL** that points at a public endpoint:
   `/api/v1/verify-export?hash=<pdf_hash>` returning the original
   manifest.

This is the dispute-defense package: a third party can re-verify the
chain at any later time and prove the PDF wasn't altered.

---

## Invariant 7 — single-chain timing-tie-break

When two `audit_log` rows have identical `created_at` (e.g., two
columns updated in the same transaction), the trigger orders by
`(created_at DESC, id DESC)` — `id` is the tie-breaker. Both rows get
inserted in the order their statements ran; the trigger picks the
absolute last one as `prev_hash` for the next row.

**Implication for `EntityAuditViewer`:** when displaying events with
the same `created_at`, sort by `id` to match the chain order. Do not
sort by any other secondary field.

---

## Invariant 8 — cross-project events are intermixed

Because the chain is global, an entity-scoped view will show
`previous_hash` values that point at rows on completely different
projects. That's expected. Don't try to "filter out" cross-project
hashes — they are part of the integrity proof.

For an export that includes JUST one entity's events, the manifest
must explicitly note: "previous_hash references on these rows may
point to audit_log entries on other projects, which are intentionally
excluded from this export. Re-verifying via the global chain is the
authoritative path."

---

## What Tab A's `HashChainBadge` should display

Three states based on the most recent `audit_chain_checkpoints` row:

| State | Trigger | UI |
|---|---|---|
| `intact` | `last_run_at` < 24h AND no break recorded | Green check + "Audit chain intact (verified <relative time>)" |
| `stale` | `last_run_at` > 24h | Amber clock + "Verification stale — last checked <date>" + tap to re-verify (calls the edge function) |
| `broken` | A break was recorded (the verify result is non-empty) | Red flag + "Chain integrity issue at row <broken_at_id> — contact support" + the break details |

**Don't run verification client-side.** It's a service-role function.
The badge reads the checkpoint table; the verification runs on the
server (existing `verify-audit-chain` edge function).

---

## What Tab A's `hashChainVerifier.ts` is NOT

It is **not** a re-implementation of `verify_audit_chain`. The Postgres
function is the source of truth. `hashChainVerifier.ts` is a thin
client-side helper that:

1. Calls the existing `verify-audit-chain` edge function.
2. Handles network errors and rate limits.
3. Surfaces the result for the `HashChainBadge` UI.

If Tab A is tempted to recompute hashes in TypeScript, the encoding
rules above will trip them up — JSON canonicalization, timestamp
formatting, array-to-string with the right separator. Don't go there.
Just call the function.
