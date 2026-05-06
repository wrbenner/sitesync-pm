# Procore Importer Spec

**Date:** 2026-05-04
**Status:** Spec ready. Build kicks off Aug 2026 (Q3) once engineer #2 ramps. Live by Day 75 of Lap 3 / late Q3 2026 (~Sept 2026).
**Companion:** `INTEGRATION_FRAMEWORK_SPEC` (forthcoming — every connector follows this shape), `LAP_3_ACCEPTANCE_GATE_SPEC` (timing), `MSA_TEMPLATE_NOTES` (customer data handling)
**Format reference:** `MONEY_CENTS_AUDIT_2026-05-01.md`. Phased plan + field-mapping table + test plan.

---

## TL;DR

The Procore importer is the **#1 enterprise switching blocker** removed. UI for picking which Procore project; worker that pulls Procore API for projects + RFIs + submittals + daily logs + drawings + pay apps; field-by-field mapping table; verification report; idempotent re-import (incremental sync).

**Acceptance:** A 5K-RFI Procore project imports in < 2 hours with > 95% mapping accuracy. Customer-facing report names every unmapped field. Re-import only updates changed records.

This spec covers: the connector framework's "first instance" architecture, the entity-by-entity mapping tables (8 entities), the worker design with rate-limit handling, the verification report, idempotency, and the customer-facing UX.

---

## Architecture (one of N integration connectors)

The Procore importer is the first instance of the **integration framework** that every future connector follows. ADR-016 ratifies this framework.

```
┌──────────────────────────────────────────────────────────────────┐
│  Customer's Procore account (source of truth, until imported)     │
└────────────────────┬─────────────────────────────────────────────┘
                     │ Procore REST API (rate-limited)
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  IMPORT WORKER (Vercel/Cloudflare Cron job; runs hourly during    │
│  active import)                                                    │
│                                                                    │
│  1. Pull entity batches (projects, then RFIs, then daily logs...) │
│  2. Apply field mappings (per entity type)                         │
│  3. Validate (schema + business rules)                             │
│  4. Upsert into our DB (idempotent on Procore-ID)                  │
│  5. Log unmapped fields to verification report                     │
│  6. Track progress in `import_jobs` table                          │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Our DB                                                           │
│  - imported_procore_id column on each table                        │
│  - import_jobs tracking table                                      │
│  - import_field_mappings logged for unmapped fields                │
└──────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  VERIFICATION REPORT                                              │
│  Customer-facing PDF: what imported clean, what needs review      │
└──────────────────────────────────────────────────────────────────┘
```

---

## ADR-016 — Integration Framework Pattern

Every integration connector implements:

```typescript
interface IntegrationConnector<TConfig, TEntity, TInternalEntity> {
  name: string                 // 'procore', 'sage_300', 'foundation'
  supportedEntities: string[]  // ['projects', 'rfis', 'daily_logs', ...]
  
  // Auth
  authenticate(config: TConfig): Promise<AuthResult>
  
  // Rate-limit aware fetching
  fetchEntities<E extends string>(
    entityType: E,
    cursor: string | null,
    pageSize: number
  ): Promise<{
    entities: TEntity[]
    nextCursor: string | null
    rateLimit: { remaining: number; resetAt: ISODate }
  }>
  
  // Mapping
  mapEntity(entity: TEntity, entityType: string): TInternalEntity | { error: MappingError }
  
  // Idempotent upsert
  upsertInternal(internal: TInternalEntity): Promise<UpsertResult>
  
  // Re-import
  detectChanges(since: ISODate, entityType: string): Promise<ChangedEntityIds>
}
```

Each new connector (Sage 300, Foundation, QuickBooks, etc.) implements this same interface. Adding a connector = filling in the interface, not building from scratch.

---

## Procore-Specific Mapping (8 entities)

### Entity 1 — Projects

| Procore field | Our field | Mapping notes |
|---|---|---|
| `id` (Procore project ID) | `imported_procore_id` | Stored as integer |
| `name` | `name` | Direct |
| `display_name` | `name` (override if set) | Procore's "display_name" overrides if present |
| `address` | `address.street1` + `.city` + `.state` + `.zip` | Parsed out |
| `start_date` | `start_date` | ISO 8601 conversion |
| `completion_date` | `target_completion_date` | Procore "completion_date" → our "target_completion_date" |
| `status` | `status` | Mapped: "active" → "active"; "closed" → "completed"; etc. |
| `total_value` | `contract_value_cents` | Convert: float dollars → integer cents |
| `project_owner` | `owner_organization_id` | Looked up by name; created if not exists |
| `general_contractor` | `gc_organization_id` | Looked up by name |
| `program_manager` | `program_manager_user_id` | Looked up by email; created as guest user |

### Entity 2 — RFIs

| Procore field | Our field | Mapping notes |
|---|---|---|
| `id` | `imported_procore_id` | |
| `number` | `number` | RFI number (e.g., "RFI-001") |
| `subject` / `title` | `title` | |
| `question` | `question` | Markdown converted from Procore HTML |
| `priority` | `priority` | Mapped: low/medium/high/critical |
| `discipline` | `discipline` | |
| `created_at` | `created_at` | Preserved |
| `responded_at` | `responded_at` | Optional |
| `due_date` | `due_date` | |
| `status` | `status` | Mapped: open/responded/voided/etc. |
| `assigned_to` | `assigned_to_user_id` | Lookup by email |
| `created_by` | `created_by_user_id` | Lookup by email |
| `attachments` | `attachments` | Files re-uploaded to our S3 |
| `responses` | (sub-entity) | Each response → audit_log row + RFI message |

### Entity 3 — Daily Logs

| Procore field | Our field | Mapping notes |
|---|---|---|
| `id` | `imported_procore_id` | |
| `date` | `date` | |
| `crew_count` | `manpower_count` | |
| `weather` (object) | `weather` (jsonb) | Restructure |
| `notes` | `notes` | Markdown from HTML |
| `attachments` | `attachments` | Re-upload |

### Entity 4 — Pay Apps

| Procore field | Our field | Mapping notes |
|---|---|---|
| `id` | `imported_procore_id` | |
| `application_number` | `application_number` | |
| `period_to`, `period_from` | `period_to`, `period_from` | |
| `total_completed_and_stored` | `total_completed_and_stored_cents` | Float → integer cents |
| `retainage` | `retainage_cents` | Same |
| `amount_due` | `amount_due_cents` | Same |
| `line_items` | `line_items` (array) | Each line item: scheduled_value, work_completed, materials_stored — all converted to cents |
| `status` | `status` | |

### Entity 5 — Drawings

| Procore field | Our field | Mapping notes |
|---|---|---|
| `id` | `imported_procore_id` | |
| `name` | `name` | |
| `version` | `revision_number` | |
| `pdf_url` | `pdf_url` | Procore-hosted; we ingest by downloading + re-uploading to our S3 |
| `discipline` | `discipline` | |
| `set_id` | `drawing_set_id` | Procore's "set" → our "drawing_set" |
| `pages` | (sub-entity) | Each Procore drawing page → our `drawing_pages` row |

### Entity 6 — Submittals

| Procore field | Our field | Mapping notes |
|---|---|---|
| `id` | `imported_procore_id` | |
| `number` | `number` | |
| `name` | `title` | |
| `description` | `description` | Markdown |
| `status` | `status` | Mapped to our submittal lifecycle |
| `responsible_contractor` | `responsible_organization_id` | Lookup |
| `attachments` | `attachments` | |

### Entity 7 — Punch Items

| Procore field | Our field | Mapping notes |
|---|---|---|
| `id` | `imported_procore_id` | |
| `number` | `number` | |
| `description` | `description` | |
| `priority` | `priority` | |
| `status` | `status` | |
| `assignee` | `assigned_to_user_id` | |
| `location` | `location_data` (jsonb) | |
| `attachments` | `attachments` | |

### Entity 8 — Change Orders

| Procore field | Our field | Mapping notes |
|---|---|---|
| `id` | `imported_procore_id` | |
| `number` | `number` | |
| `description` | `description` | |
| `amount` | `amount_cents` | Float → cents |
| `reason_code` | `reason_code` | |
| `status` | `status` | Mapped lifecycle |

---

## What's Out of Scope for v1

These Procore data types are **not** imported in v1:
- Procore Pay (their embedded payments) — they own; we don't migrate
- Custom forms (their form-builder output)
- T&M tickets (their time-and-materials workflow)
- Photos / videos (separate import — heavy; v1.5)
- Owner reports (different audience)
- Custom dashboards (we rebuild from raw data, not import)

We document these gaps in the verification report so the customer knows.

---

## Worker Architecture

```typescript
// supabase/functions/procore-import-worker/index.ts

interface ProcoreImportJob {
  id: string
  customer_id: string
  procore_project_id: number
  procore_oauth_tokens: { access: string; refresh: string }
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused'
  current_entity: string
  entity_progress: Record<string, { fetched: number; mapped: number; unmapped_fields: number; errors: number }>
  started_at: ISODate
  completed_at: ISODate | null
  rate_limit_at: ISODate | null  // when last rate-limited
  total_rfis_imported: number
  // ... other counters
}

Deno.serve(async (req) => {
  const job = await getActiveImportJob()
  if (!job) return new Response('no job')
  
  try {
    // Each entity type imported in sequence (faster + simpler than parallel)
    for (const entity of ['projects', 'rfis', 'daily_logs', 'pay_apps', 'drawings', 'submittals', 'punch_items', 'change_orders']) {
      await importEntityType(job, entity)
    }
    
    await markJobCompleted(job.id)
  } catch (error) {
    await markJobFailed(job.id, error)
  }
})

async function importEntityType(job: ProcoreImportJob, entityType: string) {
  let cursor: string | null = null
  do {
    // Procore API rate limit: 1000 req/hour per user. 100 entities/page.
    const { entities, nextCursor, rateLimit } = await procoreFetch(entityType, cursor, 100)
    
    if (rateLimit.remaining < 10) {
      // Pause until reset
      await sleep(rateLimit.resetAt - Date.now())
    }
    
    for (const entity of entities) {
      const internal = mapEntity(entity, entityType)
      if ('error' in internal) {
        await logUnmappedField(job.id, entityType, entity.id, internal.error)
        continue
      }
      
      await upsertInternal(internal, entityType)
      job.entity_progress[entityType].mapped++
    }
    
    cursor = nextCursor
    await persistProgress(job)
  } while (cursor !== null)
}
```

### Rate-limit handling

Procore API rate limits are **1,000 requests/hour per user.** With 100 entities/page, that's 100K entities/hour.

For a 5K-RFI project (RFIs alone), that's 50 API requests = ~3 minutes. Add submittals + daily logs + drawings + pay apps + punch items: ~30 minutes total. Within the 1,000 req/hour limit.

For a 50K-RFI project (large enterprise GC), that's 500 requests = ~30 minutes for RFIs. Plus other entities → ~3 hours total. Still within limit.

If we hit the rate limit: pause until reset; resume from cursor. No data loss.

### Idempotency

Re-imports are detected by `imported_procore_id` matching:

```sql
INSERT INTO rfis (...)
VALUES (...)
ON CONFLICT (imported_procore_id) DO UPDATE SET
  status = EXCLUDED.status,
  responded_at = EXCLUDED.responded_at,
  -- ... only fields that change in Procore are overridden
WHERE rfis.last_imported_at < EXCLUDED.last_imported_at;
```

Re-import is safe to run anytime; only changed records are updated. Customer can re-import after any Procore data update.

---

## Verification Report

Customer-facing PDF generated post-import:

```markdown
# Procore Import Verification Report

**Date:** 2026-09-XX
**Customer:** [GC Name]
**Procore Project:** [Project Name] (ID: [Procore Project ID])

## Summary

✅ **Successfully imported:** 4,847 entities
⚠️  **Imported with warnings:** 23 entities (see details below)
❌ **Could not import:** 4 entities (see details below)

## By entity

| Entity | Imported | Failed | Notes |
|---|---|---|---|
| Projects | 1 | 0 | All fields mapped cleanly |
| RFIs | 4,832 | 4 | 4 RFIs missing required fields |
| Daily logs | 487 | 0 | |
| Pay apps | 36 | 0 | All money math reconciles to penny |
| Drawings | 234 | 0 | All re-uploaded to SiteSync S3 |
| Submittals | 156 | 0 | |
| Punch items | 89 | 0 | |
| Change orders | 14 | 0 | |

## Unmapped fields (logged for review)

23 RFI fields had non-standard values. Examples:
- RFI-1234: priority field "EMERGENCY" (mapped to our "critical")
- RFI-5678: discipline field "M.E.P." (mapped to "MEP")

These were mapped automatically but are logged here for audit.

## Failed imports (require manual attention)

4 RFIs could not be imported:
- RFI-9001: missing required field "subject" (Procore data anomaly)
- RFI-9002: assignee email not found (please add user manually)
- RFI-9003: same as 9002
- RFI-9004: corrupted attachment

## What's not imported (Procore-specific data we don't migrate)

- 1,234 Procore-Pay records (Procore's embedded payments — not migrated; will not appear in our system)
- 56 custom forms (Procore form-builder; we don't migrate; you can rebuild as needed)
- 89 T&M tickets (Procore-specific workflow; not migrated)
- All photos and videos (heavy data; v1.5 of importer will handle)
- Owner reports (you'll regenerate from your imported data)

## Re-import

To re-import (sync changes from Procore to SiteSync), use:
- Web: Settings → Integrations → Procore → "Re-import"
- Or via API: POST /v1/integrations/procore/reimport

Re-imports are incremental and safe.

## Questions?

Reply to this email or contact [email protected]
```

This report is the **trust artifact** — customer sees exactly what migrated, what didn't, and why.

---

## Customer-Facing UX

### Step 1 — Connect Procore (1 minute)

```
SiteSync Settings → Integrations → Procore

[Connect with Procore]  ← OAuth flow

After authorization:
"Connected to [Customer's Procore Account]"
[Choose a project to import]
```

### Step 2 — Pick a project (1 minute)

```
Available Procore projects:
[ ] Project A (started 2024-03-15) — 4,832 RFIs, 487 daily logs, $40M value
[ ] Project B (started 2025-01-20) — 1,200 RFIs, 234 daily logs, $20M value
[ ] Project C (closed 2024-12-31) — 8,400 RFIs (archived) — large; takes 4+ hours

Select a project to import. You can import more later.

[Start Import]
```

### Step 3 — Watch progress (15-180 minutes typical)

```
Import in progress: [Project A]

Entities imported:
[████████████████████████████░░░░] 87% complete

Phase: Daily Logs (374 of 487)
Estimated completion: 12 minutes

Last update: 30 seconds ago
```

### Step 4 — Verification report

```
Import complete!

✅ 4,847 entities imported
⚠️ 23 with warnings
❌ 4 require attention

[Open Verification Report PDF]
[View Imported Data]
[Set Up Re-Import Schedule]
```

### Step 5 — Optional: schedule re-import

```
How often should SiteSync sync from Procore?

(○) One-time (default — no re-import)
(○) Weekly
(●) Daily
(○) Hourly (high cost; not recommended)

[Save]
```

---

## Acceptance Criteria for Spec to Be "Shipped"

1. Connector framework + this connector implemented per ADR-016
2. All 8 entity types map correctly (verified against test fixture)
3. 5K-RFI test project imports in < 2 hours
4. > 95% field mapping accuracy
5. Verification report PDF generates correctly + reads cleanly
6. Re-import is idempotent (verified test)
7. Rate limiting handled (verified)
8. Customer UX: 5-step flow tested with Walker as proxy customer

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| PROCORE-1 | Procore API rate limit hits during peak | Medium | Medium | Backoff + cursor-resume |
| PROCORE-2 | Procore deprecates API endpoint mid-build | Low | High | Build retry + monitoring; OAuth refresh path tested |
| PROCORE-3 | Procore changes data format (new field, removed field) | Medium | Medium | Field-mapping table version-controlled; new fields surface as "unmapped" |
| PROCORE-4 | Customer's Procore data has corrupted records | Medium | Low | Verification report flags; customer can decide |
| PROCORE-5 | Customer Procore account has 50K+ RFIs | Low (top-100 GC only) | Medium | Run during off-hours; communicate timeline |
| PROCORE-6 | Procore introduces stricter API access control | Medium (hostile competitor possibility) | High | Customer's OAuth grants access; we go through them |
| PROCORE-7 | Customer abandons import mid-flight | Low | Low | Resume from cursor on next run |
| PROCORE-8 | Re-import causes data inconsistency | Low | Medium | Idempotent upserts + audit chain rows |

---

## What Walker Does With This Spec

1. Read the field mapping tables; flag any field that's wrong
2. Confirm Procore API access (we need a partner-level OAuth app or just standard customer OAuth)
3. Identify a Procore-using GC who'd let us test on real data (Brad's Nexus ideally)

---

## What Claude Code Does With This Spec

- Build the integration framework (~3 days)
- Build the Procore-specific connector (~6 days)
- Build the verification report PDF generator (~2 days)
- Build the customer-facing UX flow (~3 days)
- Build the import_jobs DB schema + worker scheduler (~2 days)
- Test fixtures for 5K-RFI synthetic project (~1 day)

Total Claude Code work: ~17 days (matches my earlier 5-day spec estimate; includes implementation).

---

## What this spec deliberately does NOT cover

- The integration framework details (covered by `INTEGRATION_FRAMEWORK_SPEC` forthcoming)
- Sage 300 / Foundation / Vista / CMiC connectors (next instances of the framework)
- Procore Pay migration (we don't migrate; customer continues using Procore Pay if desired)
- Photos/videos import (v1.5 — heavy data)
- Two-way sync (one-way Procore→Us only; v1)
