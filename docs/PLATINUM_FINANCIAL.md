# Platinum Financial — Reconciled to the Penny (Tab C)

This is the financial-precision spine of SiteSync. AIA G702/G703 to the cent,
schedule-vs-pay-app reconciliation, cost-code waterfall, lien-waiver
generation with tamper-detection, and an owner-preview portal driven by a
signed magic link. Everything in this tab must be auditor-defensible.

## Money discipline (non-negotiable)

- **Postgres**: every dollar column is `numeric(15,2)`. No floats; numeric
  is exact decimal arithmetic by design.
- **TypeScript**: amounts cross the I/O boundary as `number` (dollars), but
  the audited calculator immediately bank-rounds to integer cents via
  `roundHalfEvenCents` in `src/lib/payApp/g702Audited.ts`. All internal
  arithmetic is in integer cents.
- **Round-half-to-even** (banker's rounding) is used everywhere:
  - `roundHalfEvenCents(0.005) === 0`
  - `roundHalfEvenCents(0.015) === 0.02`
  - `roundHalfEvenCents(0.025) === 0.02`
  - `roundHalfEvenCents(0.035) === 0.04`
- **Round once per line, then sum.** Never sum floats and round at the end —
  that produces drift between G702 line 4 and Σ G703 col G.

## AIA formula contract

Each formula is annotated in `src/lib/payApp/__tests__/aiaFormulas.test.ts`
with the spec line it implements (G702-2017 / G703-2017). The full
synthetic Application No. 5 worksheet is documented inline as a defensible
example, and the test-file header explicitly cites the spec source.

## Schedule-vs-Pay-App Reconciliation

Pure function `reconcileScheduleVsPayApp` in
`src/lib/reconciliation/scheduleVsPayApp.ts` joins SOV lines and schedule
activities by `costCode` (case-insensitive, trimmed). Default thresholds:

- `< 5pp` variance → ok
- `5pp ≤ x < 10pp` → minor (warning)
- `10pp ≤ x < 20pp` → material (blocks pay-app submission)
- `≥ 20pp` → critical (blocks always)

Persisted snapshot lives in `pay_app_reconciliations` (one row per pay app)
with a per-line projection in `pay_app_reconciliation_lines`. The compute
function is invoked by `supabase/functions/payapp-reconciliation/index.ts`,
which upserts on `pay_app_id` so re-runs are idempotent.

## Cost-Code Waterfall

`src/lib/costCodes/waterfall.ts` walks each cost code through the canonical
seven-stage lineage:

```
Original budget → Approved CO → Revised budget → Committed → Invoiced → Paid → Balance to pay
```

Each stage is exact integer cents. Flags `isOverCommitted` when committed >
revised, and `isOverBilled` when invoiced > committed.

## Schedule integrity check

`src/lib/schedule/integrityCheck.ts` returns `{ issues, score, status }`.
Status semantics — note these:

- `unanalyzed` when no activity has any predecessor/successor metadata.
  The Schedule "Logic quality" pill must NOT render red on unanalyzed
  schedules — that's punitive before we've seen the logic.
- `healthy` ≥ 90, `watch` 70–89, `broken` < 70.

Issue types: `open_start`, `open_finish`, `negative_float`,
`constraint_conflict`, `orphan`. Each carries severity, message, and a
`suggestedFix` string.

## Lien Waivers — tamper-detection contract

The `lien_waiver_signatures` row records `content_hash` (SHA-256 of the
rendered body at signing time) and `signed_body` (the verbatim text). At
audit time, recompute the hash of `signed_body`; compare. Drift implies
tampering and the auditor can prove it.

### Templates

Five templates live in `src/lib/lienWaiver/templates/`:

- `aia-g706-conditional-progress.ts` (default fallback)
- `aia-g706-unconditional-progress.ts`
- `ca-conditional-progress.ts` — Cal. Civ. Code § 8132
- `tx-conditional-progress.ts` — Tex. Prop. Code § 53.281
- `fl-conditional-progress.ts` — Fla. Stat. § 713.20

**Legal review deferred:** Each template's body contains a
`[TODO_LEGAL_REVIEW]` placeholder. The mechanical fields (sub name,
project, period, amount, signature block) ARE rendered correctly — the
prose is not. Counsel must approve verbatim statutory text BEFORE these
documents are exchanged with subs in production. The templates also embed
a `version` string; once counsel approves a body, bump the version and
keep prior versions intact (do not edit) so previously signed waivers
verify against the body they were signed against.

The edge function `supabase/functions/lien-waiver-generator/index.ts`
mirrors the renderer to Deno. When the bodies are finalized, both sides
must update in lockstep.

## Owner Pay App Preview portal

Magic-link pattern — token in URL, hash in DB. Validation:

1. Client opens `/share/owner-payapp?id=<id>&t=<token>`.
2. The page POSTs to `owner-payapp-preview` edge function.
3. Function SHA-256s the URL token, compares to `magic_token_hash` row.
4. Function checks `expires_at > now`; rotates expiry +24h on first access.
5. Returns read-only pay app + comments + reconciliation snapshot.

The token is the auth — no Supabase session needed. The edge function
uses a service-role client to read across RLS boundaries safely (the
token validation is the gate).

## Wiring required in existing files

- `src/App.tsx` (NOT modified by Tab C): add a public route for
  `/share/owner-payapp` pointing to
  `src/pages/share/OwnerPayAppPreview.tsx`. The route should NOT require
  Supabase auth.
- `src/pages/payment-applications/PayAppDetail.tsx`: add a "Reconciliation"
  tab that mounts `<ReconciliationTab>` from
  `src/components/payapp/ReconciliationTab.tsx`. Inputs are derived from
  the pay app + line items + schedule activities + budget rollup the page
  already loads.
- `src/pages/schedule/*`: render `<IntegrityIssueList>` from
  `src/components/schedule/IntegrityIssueList.tsx` underneath the activity
  table. The "Logic quality" pill in the page header should key off
  `report.status`. Render `unanalyzed` neutral, never red.

These edits stay out of Tab C's scope by mandate — the components are
new files, dropped in as additive surface area. The wiring is a one-line
import + render where the existing page chooses to mount it.

## Conventions adopted (future tabs should match)

- **Pure libs first.** Anything financially load-bearing is a pure
  function with cents-exact tests before any UI or I/O wraps it.
- **Idempotency requirement.** Every reconciliation/audit calculator must
  be deterministic and replay-stable. Tests assert "same input twice ⇒
  identical output" explicitly.
- **Provenance columns.** All audit-trail tables carry `created_via` and
  `source_drafted_action_id` (mirroring the punch-item executor pattern).
- **Tamper-detection columns.** `content_hash` + `signed_body` on every
  signed legal artifact.
- **Migration timestamps.** Strictly greater than the latest existing.
  The three new migrations are `20260501120000`, `20260501120001`,
  `20260501120002`, all greater than the prior latest `20260501110002`.

## Known limitations / spec failure-modes deferred

- **Legal prose**: bodies are `[TODO_LEGAL_REVIEW]` placeholders pending
  counsel review. Templates render structure + mechanical fields
  correctly. Do NOT ship to a third party with placeholder text.
- **Multi-currency**: every amount is treated as USD. Adding currency
  is a column addition + a unit on `roundHalfEvenCents` (most other
  currencies use the same minor-unit math, but JPY etc. need work).
- **Storage of intermediate G703 audit snapshots**: only the latest pay-app
  reconciliation is stored. Per-revision audit snapshots are deferred —
  pair with the existing `payapp-audit` machinery for that.
- **Owner preview: signed-link revocation**: there's no explicit revoke
  endpoint yet. Workaround: rotate the token on the server (same row,
  new hash). Add an explicit `/revoke` subroute when ops needs it.
- **Per-line retainage rates from ALA contracts**: supported (set
  `lineRetainagePct` on `G703InputLine`). When any line specifies its
  own rate, the G702 retainage rolls up by summing per-line. Otherwise
  a flat rate is applied at the rollup level.
