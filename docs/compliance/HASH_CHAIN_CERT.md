# Hash Chain Attestation

This document describes the tamper-evidence properties of the SiteSync PM audit log and the procedure to attest to its integrity at a point in time. It supplements [HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md) (the engineering reference) with the customer-facing language an auditor or CISO needs.

## Source of truth

The hash chain is implemented in [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql). The TypeScript-side verifier is [src/lib/audit/hashChainVerifier.ts](../../src/lib/audit/hashChainVerifier.ts).

The full engineering invariants are in [docs/HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md). Read it before relying on any of the properties below.

## Property summary

1. **Append-only.** Every audit log entry is written by a Postgres trigger and never mutated thereafter. The trigger computes the entry's hash on insert; there is no path to update an entry's hash without inserting a new row.
2. **Chained.** Each entry's `previous_hash` points at the previous entry's hash in global insertion order (`(created_at ASC, id ASC)`). The chain is project-global, not per-project — there is exactly one chain across the entire `audit_log` table.
3. **Canonical encoding.** The hash input is a fixed `|`-separated concatenation of fixed fields with explicit encoding rules (see [HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md), Invariant 2). The verifier computes the same encoding; drift is detected immediately.
4. **Tamper detection.** A single byte change to any historical row breaks the chain at that row and at every row that follows. The break is visible in `verify_audit_chain()`'s output.
5. **Restore aware.** Per [DR.md](../operations/DR.md), a PITR-restored database may legitimately end before the prior chain — that's an expected break, distinct from tampering. Document the restore in the postmortem.

## Attestation procedure

To produce an attestation that the audit log is intact at a point in time:

1. **Pick the time `T`.** Typically the moment of the customer's request.
2. **Run `verify_audit_chain(start_after)`** in the production database. The function is `SECURITY DEFINER, service_role only` — only an authorized engineer can run it. It returns zero rows on a clean chain; one or more rows if a break exists.
3. **Snapshot the result** alongside the current `audit_chain_checkpoints` head row.
4. **Sign the snapshot.** Either:
   - Use the sealed-entity-export flow at [src/lib/audit/sealedExport.ts](../../src/lib/audit/sealedExport.ts) and [supabase/functions/sealed-entity-export/index.ts](../../supabase/functions/sealed-entity-export/index.ts) — this writes an immutable export with the signer's identity and timestamp.
   - Or have the engineer's GPG key sign the snapshot text.
5. **Deliver to the requester.** PDF or signed JSON.

## What an attestation proves

- The audit log between the chain's first entry and `T` has not been tampered with.
- The entries the chain covers are the only entries that should exist for that period (i.e., no row has been deleted — deletion would break the chain at the gap).
- The signer at time `T` was the human or service identified by the sealed export's signer field.

## What an attestation does NOT prove

- That the *content* of any audit log entry is correct (only that it has not been altered since insertion).
- That every action in the application produced an audit log entry. Trigger coverage is enumerated by the audit-trigger migrations (e.g., [supabase/migrations/20260415000002_rfi_audit_trigger.sql](../../supabase/migrations/20260415000002_rfi_audit_trigger.sql)). If a future code path bypasses the triggers, that bypass is a bug, not a chain break.
- That the database schema or application code at the time of the action was the version currently running.

## Supplementary controls

- **Drafted-action audit trail** ([supabase/migrations/20260427000010_drafted_actions.sql](../../supabase/migrations/20260427000010_drafted_actions.sql)): every Iris-drafted action records the draft, the human approval, and the side-effect execution as separate timestamped rows.
- **Workflow run history** ([supabase/migrations/20260503120000_workflow_definitions.sql](../../supabase/migrations/20260503120000_workflow_definitions.sql)): every workflow transition appends to `workflow_runs.history` with the user, event, source state, and target state.
- **Lien waiver content hashes** ([supabase/migrations/20260501120001_lien_waiver_signatures.sql](../../supabase/migrations/20260501120001_lien_waiver_signatures.sql)): every signed waiver stores `content_hash` and `signed_body`. Recomputing the hash detects drift.
- **Daily log revisions** ([supabase/migrations/20260501110001_daily_log_revisions.sql](../../supabase/migrations/20260501110001_daily_log_revisions.sql)): post-signing edits create revisions; the original signed body is preserved.

## Customer-facing language (for a vendor risk register)

> SiteSync PM maintains a hash-chained, append-only audit log of all material entity changes. The chain is verifiable on demand by an authorized engineer; tampering with any historical row is detectable. Tamper-evidence is a property of the database trigger, not the application, and cannot be bypassed by application code.

## Engineering escalation

If `verify_audit_chain()` returns a non-restore break: page the security lead immediately. Treat as a Sev 1 per [INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md). Do not write further to the database until forensics are complete.
