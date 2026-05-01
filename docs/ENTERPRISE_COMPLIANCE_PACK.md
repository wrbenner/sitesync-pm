# Enterprise Compliance Pack

> Whiting-Turner's compliance officer has a $42M federal courthouse job.
> Davis-Bacon applies. Every week she has to file certified payroll for
> every sub. She has to track EEO-1 utilization, file OSHA 300 annually,
> maintain DBE/MWBE participation reports. Today she does this in Excel
> + paper. If we ship this correctly — to the DOL's spec — she becomes
> our internal champion.

This doc covers the **flagship cut** that shipped this turn. The full spec
called for 70+ files; the cut prioritizes correctness of the marquee
modules over breadth. Deferred items are explicitly listed below — they
are not silently dropped.

## What shipped

### 6 migrations (all applied clean)

| File | Purpose |
| --- | --- |
| `20260502110000_prevailing_wage_decisions.sql` | DOL Davis-Bacon rates, effective-dated, seeded with 1 county / 3 trades for tests |
| `20260502110001_payment_performance_bonds.sql` | Bonds parallel to insurance_certificates, with expiration-watcher index |
| `20260502110002_state_lien_rules.sql` | Single table; 50 states accommodated, 10 seeded (CA/TX/FL/NY/IL/PA/OH/GA/NC/WA), 40 deferred |
| `20260502110003_eeo1_demographics.sql` | Schema only; export logic deferred pending privacy/legal review |
| `20260502110004_cost_code_tax_flags.sql` | tax_treatment + labor_class + prevailing_wage_required columns; tax engine deferred |
| `20260502110005_closeout_deliverables.sql` | Extends closeout_items with required_by + signoff + escalation status |

### 4 pure-logic libs (46 unit tests, all passing)

```
src/lib/compliance/
  prevailingWage/                 12 tests — county-vs-state-wide, effective-date, apprentice
  wh347/                          10 tests — gross/fringe/OT math, gap detection, deterministic hash
  osha300/                        12 tests — 300/300A/301 build, ITA CSV, classify_case
  lienRights/                     12 tests — pickRule, computeDeadlines, alertTier
  bonds/                                    expiration tier + cross-project aggregation
```

### WH-347 marquee module

`src/lib/compliance/wh347/`:
- `types.ts` — Wh347Header, Wh347WorkerWeek, Wh347Statement, Wh347Generated
- `index.ts` — `generateWh347()`: pure logic. Resolves prevailing wage decision per worker, computes gross / fringe / deductions / net, flags every gap before submission.
- `render.ts` — `renderText()` for legal-review and tests; `renderPdf()` via pdf-lib matching the DOL form layout 1:1 (page 1 landscape with 13-column payroll table; page 2 portrait Statement of Compliance with checkboxes + signature block).
- `__tests__/generate.test.ts` — 10 tests, every gap kind covered.

**Gap detection is the heart of the marquee.** The DOL form is a sworn certification — the Statement of Compliance carries criminal penalty language. Our generator refuses to certify silently:
- Day-totals not matching classified hours → flag
- Hours worked but no prevailing wage decision available → flag
- Hourly rate paid below the determination's base rate → flag (with cents-precision short-by)
- Interior missing days (zero-hour day between worked days) → flag, requires explicit acceptance
- Per-worker fringe allocation contradicting the Statement-level fringe declaration → flag
- Statement-level "no fringes paid" while any worker has non-zero fringes → flag

Content hash is deterministic — re-running with identical inputs produces identical PDF + JSON, useful for "is this the same form I generated last Tuesday" checks and audit re-verification.

### 5 edge functions

| Function | Purpose |
| --- | --- |
| `wh347-generator` | POST {project_id, week_ending, signer_user_id} → text + PDF + gaps |
| `osha300-csv-export` | POST {project_id, year} → ITA portal CSV + 300A summary |
| `preliminary-notice-watcher` | Cron sweep across active projects + crews; computes lien deadlines + emits alert tiers |
| `insurance-bond-watcher` | Cross-project rollup of bond + COI expiration |
| `prevailing-wage-sync` | DOL API pull (stub — fires when SAM.gov key is configured) |

## Top 10 states seeded for lien rules

CA · TX · FL · NY · IL · PA · OH · GA · NC · WA

Each state has rows for `general_contractor` + `first_tier_sub`. The framework is data-driven — the deadline calculator never branches per state. **State-specific exceptions live as data on the row** (statute_citation + notes).

## DEFERRED THIS TURN (explicit list — nothing silently dropped)

### Modules deferred

- **EEO-1 export logic.** Schema is in (`eeo1_demographics`). The export logic is deferred pending policy decisions:
  - Voluntary vs mandatory self-reporting
  - Retention policy (DOL minimum 1 year; longer for litigation hold)
  - Federal contractor reporting threshold ($50k)
  - EEO-1 Component 1 vs Component 2 obligations
  - "Decline to answer" flow (must not be coercive)
  - These are policy/legal calls, not engineering ones.

- **Sales/use tax engine.** Schema columns landed (`cost_codes.tax_treatment`, `labor_class`, `prevailing_wage_required`). Multi-state nexus rules are a multi-month business problem; ship when there's a customer running a real cross-state workflow.

- **6 compliance pages.** UI work that wraps the libs. Better to ship the libs first, see them work in dev, then design the pages around real outputs instead of assumptions.

- **40 of 50 state lien rules.** The framework is in; adding a state is data entry against `state_lien_rules`. Counsel-reviewed CSV import lands as a follow-up migration. The 40 are: AK AZ AR CO CT DE HI ID IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM ND OK OR RI SC SD TN UT VT VA WV WI WY.

### WH-347 deferrals (the marquee module — explicit because they matter)

- **Org-settings-driven contractor name + address + signer name.** Today the edge function uses placeholder strings. Wire to org_settings.contractor_legal_name + signature_block once that schema is settled.
- **County resolution from project address.** Today hardcoded to "Travis" in the edge function. Real impl: geocode project address → US Census county FIPS lookup → join.
- **Multi-page payroll overflow.** v1 caps the worker table to one page (~30 workers). >30 workers needs a second page; pdf-lib pagination is straightforward but I want to confirm the DOL accepts continuation sheets in our format.
- **Apprentice ratio enforcement.** The schema has `apprentice_level`; the WH-347 generator computes per-worker rates correctly. The *ratio* rule (e.g. 1 apprentice per 5 journeymen on most determinations) needs the program-registration data. Land when the customer's apprenticeship program data is available.
- **Fringe contribution provenance.** v1 takes per-worker fringePerHourCash + fringePerHourPlan as inputs; doesn't yet pull from the customer's benefit plan registry. The `decisions[].fringe_rate` is the DOL minimum; the *paid* fringes can exceed that. Wiring this to the actual payroll module's fringe data is one query change away once that data has a stable shape.

### OSHA deferrals

- **Form 301 detail capture flow.** `buildForm301()` is implemented; the UI prompt for the per-incident detail (whatHappened / injuryNature / bodyPart / treatment / source) is not. Today we enrich from `incidents.description`; v2 pulls from a structured form on the incident detail page.
- **OSHA's electronic-filing direct submission.** The CSV export is the format OSHA expects on their ITA portal. We generate it; the customer uploads. Direct API submission ships when OSHA opens the ITA portal API to third parties (currently it's a manual upload).

### Lien deferrals

- **Property-type per project.** The deadline calculator accepts a `propertyType` (residential/commercial). The project schema doesn't yet expose this; defaults to commercial.
- **Notification write path.** `preliminary-notice-watcher` computes deadlines + reports counts; the actual notifications-table write lands when the cross-project inbox model is settled (see also the SLA escalator from a prior round).

### Closeout deferrals

- **Bound PDF aggregator.** Schema is in (signoff_required, document_size_bytes); the aggregator that walks closeout_items and produces a single bound PDF for owner handoff is deferred. Uses the same pdf-lib pattern as WH-347.

## Tests

```bash
npx vitest run src/lib/compliance
```

**46 tests, all passing**:
- 12 prevailing wage (county vs state-wide, effective-date, apprentice level)
- 10 WH-347 (math, gap kinds, determinism)
- 12 OSHA 300/300A/301 (case classification, ITA CSV, escaping)
- 12 lien rights (rule lookup, deadline math, alert tiers, expiry)

## Operations

### Connecting WH-347 generation to a real week

```ts
fetch('/functions/v1/wh347-generator', {
  method: 'POST',
  headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    project_id: projectId,
    week_ending: '2026-04-25',  // Saturday
    signer_user_id: complianceOfficerId,
  }),
}).then(r => r.json()).then(({ pdf_base64, gaps, content_hash }) => {
  if (gaps.length > 0) showGapReview(gaps)
  else openPdf(base64ToBlob(pdf_base64, 'application/pdf'))
})
```

Re-running with the same inputs reproduces the same `content_hash` byte-for-byte — that's the property the DOL's auditor will rely on if a year-later question arises.

### Adding a state to the lien rules

1. Counsel reviews the state's mechanic's lien statute.
2. Insert two rows into `state_lien_rules` (one per claimant_role typical for that state).
3. The deadline calculator picks the new rule on its next call. No code changes.

## What this stream did NOT touch

- Existing `TimeTracking` page — read from, didn't modify
- Existing `Closeout` page — extended via the `closeout_items` columns; the existing UI continues to work
- Tab A admin/, Tab C portfolio/ — out of scope per the spec
