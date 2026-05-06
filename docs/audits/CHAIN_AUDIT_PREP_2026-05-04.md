# Hash Chain Audit Preparation Spec

**Date:** 2026-05-04
**Status:** Spec ready. Walker walks the chain end-to-end himself **THIS WEEK** before Trail of Bits engagement begins (target Aug-Oct 2026 attestation engagement).
**Companion:** `SOC_2_READINESS_SPEC_2026-05-04.md` (parallel track), `SECURITY_WHITE_PAPER_2026-05-04.md` (forthcoming, public-facing artifact)
**Format reference:** `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`

---

## TL;DR

The hash chain is the moat. Procore can replicate every other feature; replicating a deposition-grade audit chain takes 12+ months and a different architectural commitment. **Trail of Bits attestation by Oct 15, 2026** (per Reverse-Engineered Milestones T-195) is the moat-closing event.

But: **we don't engage Trail of Bits until we've walked the chain ourselves and found whatever they would have found.** Surprising the auditor is a 60-day rework risk. This spec is the internal audit checklist Walker runs in May-June 2026.

The output: a **chain audit memo** signed by Walker (`docs/audits/INTERNAL_CHAIN_AUDIT_2026-06-XX.md`) listing every check we ran, every finding, every fix. Trail of Bits gets that memo as part of engagement.

---

## What "Walking the Chain" Means

The audit chain construction is in `supabase/migrations/20260426000001_audit_log_hash_chain.sql`. Verifier function: `verify_audit_chain(start_after timestamptz)`. Returns rows of broken entries.

"Walking the chain" means: for every claim the chain makes, verify it actually holds in production data. The claims are:

1. **Append-only.** Once a row is written, it cannot be modified or deleted without detection.
2. **Sequential integrity.** Each row's `entry_hash` includes the previous row's hash; tampering with row N means N+1, N+2, … are detectably wrong.
3. **Tamper-evident.** Any modification — to data, to hash, to timestamp — produces a verification failure.
4. **Complete coverage.** Every state-changing action on regulated entities (RFIs, daily logs, pay apps, drafts, approvals) writes a chain row.
5. **Provenance.** Every chain row identifies: who (user_id), what (entity_type + action), when (created_at), with what (model fingerprint, prompt hash for AI rows).
6. **Cryptographic soundness.** SHA-256 is the right primitive; it's computed correctly; entropy is good.
7. **Performance.** Chain row write doesn't slow down the user-facing operation by > 50ms.

Each claim is a check. The audit verifies each one.

---

## The 12 Checks

### Check 1 — Append-only verification

**Claim:** UPDATE and DELETE on `audit_log` are blocked at the DB level.

**Test:** Connect to staging as `service_role`. Try:
```sql
UPDATE audit_log SET data = '{}'::jsonb WHERE id = '<some-id>';
DELETE FROM audit_log WHERE id = '<some-id>';
```

**Expected:** Both fail with policy/trigger violation.

**Failure mode:** If either succeeds, the chain is forge-able. CRITICAL finding; halt all other checks until fixed.

### Check 2 — Sequential integrity at production scale

**Claim:** `verify_audit_chain(NULL)` walks every row and returns no broken entries.

**Test:** On a staging snapshot with 100K+ chain rows, run:
```sql
SELECT COUNT(*) FROM verify_audit_chain(NULL);
```

**Expected:** 0.

**Performance check:** Time the run. Should complete in < 60 seconds for 100K rows. If > 5 minutes, there's an index issue; the 6-month observation window will accumulate enough rows to break this.

### Check 3 — Tamper detection

**Claim:** Modifying any field in any chain row produces a verification failure on subsequent rows.

**Test:** On staging only:
1. Pick a chain row (not the latest — pick row N that has rows N+1..N+100 after it)
2. Bypass the DB-level UPDATE block (drop the trigger temporarily on staging only)
3. Modify `data` field of row N
4. Run `verify_audit_chain(timestamp_of_row_N - INTERVAL '1 second')`
5. Expected: row N+1's hash mismatch (because N+1's hash was computed against the original N)

**Re-test:** Restore the original data. Run verifier. Expected: clean.

### Check 4 — Cryptographic soundness

**Claim:** SHA-256 implementation is correct + uses good entropy.

**Test:** Walk through `compute_audit_hash()` (the function in the migration). Verify:
- Inputs concatenated in deterministic order
- All NULL inputs handled (NULL → empty string vs. NULL throws)
- Random salt (if any) sourced from cryptographically-secure RNG
- Output base16 lowercase hex (consistent across DB sessions)

**Expected:** No NULL-handling ambiguities; no arithmetic-vs-string-concat bugs.

### Check 5 — Coverage on every entity type

**Claim:** Every regulated state change writes a chain row.

**Test:** For each entity type that's regulated, exercise a state-change in staging:
- RFI: create, status change, attach, comment, void → 5 chain rows expected
- Daily log: create, edit, sign → 3 chain rows expected
- Pay app: create, edit, submit, approve, reject, payment_initiated, payment_settled → 7 rows
- Draft action: create, view, decision, withdraw → 4 rows
- Submittal: create, transmit, response, stamp → 4 rows
- Drawing: upload, classify, version → 3 rows
- Punch item: create, status change, assign → 3 rows
- Change order: create, edit, approve → 3 rows
- Schedule phase: edit, baseline → 2 rows
- Lien waiver: generate, sign (sub), countersign (GC), mark unconditional → 4 rows

For each: confirm a chain row exists with correct entity_type, action, before_state, after_state, user_id.

**Expected:** All transitions captured.

**Common gap:** Bulk operations (e.g., "approve 5 RFIs at once") sometimes write a single chain row for the user action but lose per-entity provenance. Each entity should get its own chain row.

### Check 6 — User attribution

**Claim:** Every chain row includes the actual user who performed the action — not a service account.

**Test:** Query `SELECT user_id, COUNT(*) FROM audit_log GROUP BY user_id;` on staging. Look for:
- Rows with NULL user_id (should be zero — every action has an actor)
- Rows attributed to `service_role` or `postgres` (should be zero outside of seed data)
- Rows attributed to "system" or similar (only for auto-withdraw and similar; should be specifically tagged in a separate column, not shoved into user_id)

**Expected:** Every row has a real user_id OR is correctly tagged as a system action with provenance.

### Check 7 — Model fingerprint on AI rows

**Claim:** Every Iris-generated chain row includes the model identifier + prompt hash.

**Test:** `SELECT data->>'model' FROM audit_log WHERE entity_type = 'drafted_action' AND action = 'create';` — every result should be a versioned model identifier (`claude-sonnet-4-6` etc.).

**Expected:** No nulls; no "unknown" placeholders.

### Check 8 — RLS enforcement on `audit_log`

**Claim:** A user can only see chain rows for projects they're a member of.

**Test:** Connect as a synthetic non-member user. Query `SELECT * FROM audit_log;`. Expected: only rows for that user's projects (or rows entirely scoped to other tenants → empty result).

### Check 9 — Performance budget

**Claim:** Adding a chain row to a state change adds < 50ms to the user-facing operation.

**Test:** With staging seed:
1. Time a "create RFI" mutation without chain (fork the migration; remove trigger on staging only)
2. Time same mutation with chain
3. Diff = chain overhead

**Expected:** < 50ms diff at p95.

**If exceeded:** Index `previous_hash`, `entry_hash`, `created_at` if not already indexed. Consider async chain-write (write via trigger to a queue, not synchronous; chain just lags by < 1 sec).

### Check 10 — Chain restoration after partial failure

**Claim:** If a transaction partially commits (rare but possible) and the chain row is missing, the system detects + recovers.

**Test:**
1. Simulate: in staging, manually delete one chain row (force-bypass the append-only trigger)
2. Run verifier
3. Expected: failure at row N+1 (hash mismatch)

**Recovery procedure:** Document. Likely: re-derive the missing row from `pg_audit` extension if available, or accept the gap with a "chain-break" annotation row. CANNOT silently move on.

### Check 11 — External attestation readiness

**Claim:** Trail of Bits can attest the chain without finding a real flaw.

**Test:** Walker reviews the migration code line-by-line, the verifier line-by-line, the test suite, the RLS policies. Walker is the first auditor. Document every observation in the internal chain audit memo.

**Expected:** Walker finds at most low-severity findings; criticals already addressed; auditor sees mature controls.

### Check 12 — Cross-tenant isolation

**Claim:** Chain rows from tenant A cannot be read or referenced by tenant B even via the audit_log table.

**Test:** Synthetic user B queries chain rows for tenant A's projects. Should return zero results.

**Why this matters:** A bug bounty bounty hunter will try this immediately. If tenant A's audit history leaks to tenant B, the chain's privacy property is broken — and Trail of Bits will find it.

---

## Schedule

| Date | Activity | Owner |
|---|---|---|
| **May 11-15** | Walker runs Checks 1, 2, 4, 6, 7, 8 (5 hours total) | Walker |
| **May 18-22** | Walker runs Checks 3, 5, 9, 10, 12 (10 hours total) | Walker |
| **May 25-29** | Document findings; fix any critical issues; re-run | Walker + Eng |
| **June 1** | Internal chain audit memo committed: `docs/audits/INTERNAL_CHAIN_AUDIT_2026-06-01.md` | Walker (planned) |
| **June 1** | Trail of Bits initial outreach (with the memo + reference to migration files) | Walker |
| **June 15** | Trail of Bits scoping call | Walker |
| **July 1** | Trail of Bits engagement signed | Walker |
| **August 1** | Trail of Bits attestation fieldwork begins | Trail of Bits |
| **September 30** | Trail of Bits draft report | Trail of Bits |
| **October 15** | Trail of Bits final attestation; published | Walker |

---

## Trail of Bits Engagement Scoping

**Why Trail of Bits specifically:** they're the dominant cryptographic auditor in the US. Have done attestations for blockchain projects, HSM implementations, voting systems, cryptocurrency exchanges. They'll see hash-chain bugs we wouldn't.

**Cost:** $60K-$120K depending on scope. Recommend **mid-scope at ~$80K** — covers the chain construction, the RLS, the verifier, the application-level discipline (does every action actually call the chain-write function).

**Out of scope:** general pen test (handled separately for SOC 2). Application-level vulnerabilities outside the chain (covered by general pen test).

**Deliverables:**
1. Public attestation document (signed PDF) covering the chain construction
2. Findings report (private; for our remediation)
3. Recommendations for ongoing chain-integrity monitoring
4. Optional: re-attestation after major architectural changes

**Public usability:** the attestation document goes on `trust.sitesync.com/audit-chain-attestation.pdf`. Goes in every enterprise sales conversation. Goes in the Procore Groundbreak response.

---

## What Goes in the Internal Chain Audit Memo

`docs/audits/INTERNAL_CHAIN_AUDIT_2026-06-01.md` should contain: (planned)

```markdown
# Internal Chain Audit Memo

**Date:** 2026-06-01
**Auditor:** Walker (founder)
**Scope:** Hash chain audit log construction, verification, and application discipline.

## Methodology
- 12 checks per CHAIN_AUDIT_PREP spec
- 100K-row staging snapshot
- Production read-only access for spot-checks

## Findings (12 checks)

### Check 1 — Append-only
- Tested: PASS / FAIL
- Notes: ...

### Check 2 — Sequential integrity
- ...

[12 sections, one per check]

## Severity summary
- Critical: 0 (or list)
- High: 0
- Medium: ___
- Low: ___

## Remediation status
- All criticals fixed: yes/no + commits
- Highs fixed within 7 days: yes/no
- Mediums tracked: yes/no
- Lows accepted: yes/no

## Conclusion
- The chain holds at staging-equivalent production scale
- Trail of Bits engagement appropriate for external attestation
- Annual re-audit cadence recommended

## Trail of Bits provided:
- This memo
- Migration `20260426000001_audit_log_hash_chain.sql`
- Verifier function `verify_audit_chain`
- All chain-related migrations (audit_action_normalize, fix_audit_log_insert_rls, audit_action_widen_for_all_triggers, payapp_audit_overrides)
- The 12 check scripts

Signed: Walker
Date: 2026-06-01
```

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| CHAIN-1 | Walker's audit finds a critical flaw | Low-Medium | High | Fix before Trail of Bits; chain has been internal-audited before; we'd have found this |
| CHAIN-2 | Trail of Bits finds something Walker missed | Medium | High | This is acceptable — the point of external attestation is to catch what we missed |
| CHAIN-3 | Performance check (50ms budget) fails | Low | Medium | Async chain write; queue-based with < 1s lag |
| CHAIN-4 | RLS check fails for cross-tenant isolation | Low | Critical | Halt all other work; fix RLS; re-test |
| CHAIN-5 | Trail of Bits engagement timeline slips past Oct 15 | Low | Medium | Pre-scope in May; signed by July; fieldwork Aug-Sep |
| CHAIN-6 | Trail of Bits engagement budget overrun | Medium | Low | Budget $100K with $20K buffer; mid-scope is the sweet spot |

---

## What Walker Does With This Spec This Week

1. Block 5 hours next week for Checks 1, 2, 4, 6, 7, 8
2. Read the 12 checks; understand each one before running them
3. Reach out to Trail of Bits with intro: "We have a hash chain audit log on every state change in our SaaS; want to engage you for cryptographic attestation Q3-Q4 2026; here's the migration that establishes it."
4. After completing the 12 checks, commit the memo + send to Trail of Bits

---

## What Claude Code Does With This Spec

- Write a script (`scripts/chain-audit-checks.ts`) that automates Checks 2, 5, 6, 7, 8, 9, 12 (the SQL-driven ones). ~1 day work. (planned)
- Document the remediation pattern for any check that fails. ~1 day work.
- Generate the 100K-row staging snapshot for performance testing. ~0.5 day.

Total Claude Code work: ~2.5 days. Done by mid-May.

---

## Appendix A — Why The Chain Is The Moat

Procore Pay (launched 2023) has audit logs. Procore's audit logs are append-only-by-policy, not by cryptographic construction. A Procore admin with DB access can modify or delete history. Their compliance posture explains this away (SOC 2 Type II, ISO 27001), but the property is policy-enforced, not cryptographically-enforced.

SiteSync's chain is **mathematically-enforced**. Every modification produces detectable failure. This is the difference between "we promise we won't tamper with your records" and "you can prove we didn't."

In a deposition or arbitration, that difference matters. The hash chain is a different kind of evidence than a SOC 2 report. Both are valuable. The chain is the unique one.

The Trail of Bits attestation makes this property externally-defensible. **That's what makes it the moat.**

---

## Appendix B — What Happens If The Chain Breaks Post-Launch

Real catastrophic scenarios + responses:

| Scenario | Response |
|---|---|
| Verifier finds 1 broken row in production | Critical incident. Walker pages on-call (himself initially). Investigate within 1 hour. Postmortem within 24 hours. Public disclosure if customer data integrity is affected. |
| Verifier finds 100+ broken rows | Likely intentional or systemic. Treat as security incident. Engage Trail of Bits for forensics within 24 hours. |
| Trail of Bits revokes attestation | Immediate customer notification. Path back to attestation: fix → re-audit → re-publish. Could take 30-90 days. Customer SLA breach in some contracts. |
| External hacker claims to have broken the chain | Investigate immediately; verify; if confirmed, see "100+ broken rows" path; bug bounty payout if responsibly disclosed. |
| Internal employee modifies chain | Termination + legal + immediate audit + customer notification. |

These scenarios are very rare but each has a documented response. **Discipline now = trust later.**
