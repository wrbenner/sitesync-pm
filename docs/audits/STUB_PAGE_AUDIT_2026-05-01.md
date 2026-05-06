# Stub Page Audit — 2026-05-01

**Author:** Walker Benner  
**Governing rule:** Eleven Never #9 — _"If a route renders a placeholder, it is hidden by feature
flag, gated by role, or removed."_  
**Scope:** Every `.tsx` file under `src/pages/` and every route in `src/App.tsx`

---

## Summary

| Category | Count | Action |
|---|---|---|
| Orphaned page files (no active route) | 14 | Delete (Day 6) |
| Live-routed stub shells (< 200 LOC, no data hooks) | 10 | Feature-flagged (this PR) |
| Live-routed thin pages (200–500 LOC, localStorage-only) | 6 | Monitor; flag in Day 6–7 |
| **Total stub-class pages** | **30** | |

---

## Category A — Orphaned Page Files

These files exist in `src/pages/` but are **not imported anywhere** in the active codebase.
The router redirects their former paths to live pages via `<Navigate>`.  They are dead code.

All confirmed via `grep -r "<filename>" src/` → 0 results.

| File | LOC | Former purpose | Redirect in App.tsx |
|---|---|---|---|
| `src/pages/AIAgents.tsx` | 878 | AI agent management | Removed — no route |
| `src/pages/Activity.tsx` | 281 | Activity feed | Removed — no route |
| `src/pages/Deliveries.tsx` | 716 | Material delivery tracking | Removed — no route |
| `src/pages/LienWaivers.tsx` | 625 | Standalone lien waiver page | Removed — no route |
| `src/pages/Lookahead.tsx` | 626 | 3-week lookahead schedule | `/lookahead` → `/schedule` |
| `src/pages/OwnerPortal.tsx` | 438 | Owner-facing portal | Removed — no route |
| `src/pages/Preconstruction.tsx` | 1760 | Pre-construction dashboard | Removed — no route |
| `src/pages/ProjectHealth.tsx` | 625 | Project health scorecard | Removed — no route |
| `src/pages/Resources.tsx` | 490 | Resource planning | Removed — no route |
| `src/pages/SiteMap.tsx` | 1787 | Site map viewer | Removed — no route |
| `src/pages/Specifications.tsx` | 385 | Specification viewer | Removed — no route |
| `src/pages/Transmittals.tsx` | 478 | Document transmittals | Removed — no route |
| `src/pages/Vendors.tsx` | 1049 | Vendor management | `/vendors` → `/contracts` |
| `src/pages/Wiki.tsx` | 629 | Project wiki | Removed — no route |

**Total dead code:** ~10,767 lines across 14 files.  
**Next action:** Delete all 14 files in Day 6.

---

## Category B — Live-Routed Stub Shells (Feature-Flagged This Session)

These pages have active routes in `App.tsx` but render no real backend data — they are thin
shells, coming-soon wrappers, or minimal proof-of-concept scaffolding.  All 10 are now hidden
behind compile-time feature flags (all `false` in production).

| Route | Component | Flag | Fallback |
|---|---|---|---|
| `/bim` | `BIMViewerPage` | `VITE_FLAG_BIM_VIEWER` | `/dashboard` |
| `/iris/inbox` | `IrisInbox` | `VITE_FLAG_IRIS_INBOX` | `/ai` |
| `/reports/owner` | `OwnerReportPage` | `VITE_FLAG_OWNER_REPORT` | `/reports` |
| `/settings/workflows` | `WorkflowSettings` | `VITE_FLAG_APPROVAL_WORKFLOWS` | `/settings` |
| `/submittals/spec-parser` | `SpecParserPage` | `VITE_FLAG_SPEC_PARSER` | `/submittals` |
| `/admin/bulk-invite` | `BulkInvitePage` | `VITE_FLAG_BULK_INVITE` | `/settings/team` |
| `/admin/project-templates` | `ProjectTemplatesPage` | `VITE_FLAG_PROJECT_TEMPLATES` | `/dashboard` |
| `/admin/procore-import` | `ProcoreImportPage` | `VITE_FLAG_PROCORE_IMPORT` | `/integrations` |
| `/admin/compliance` | `ComplianceCockpit` | `VITE_FLAG_COMPLIANCE_COCKPIT` | `/dashboard` |
| `/walkthrough` | `WalkthroughPage` | `VITE_FLAG_WALKTHROUGH` | `/field-capture` |

### Files changed

- **`src/lib/featureFlags.ts`** — NEW. Single source of truth for all `VITE_FLAG_*` env vars.
- **`src/components/auth/FeatureGate.tsx`** — NEW. React gate component (for future declarative use).
- **`src/App.tsx`** — Added `import { FLAGS }` and wrapped 10 routes with `FLAGS.xxx ? <page> : <Navigate>` ternary.
- **`.env.example`** — Documented all 10 flags with default `false` values.

### Enabling a flag for local development

```bash
# .env.local (never committed)
VITE_FLAG_BIM_VIEWER=true
```

---

## Category C — Live-Routed Thin Pages (Monitor)

These pages have active routes and some real data integration, but are thinly implemented.
Not feature-flagged yet — they ship working read-only views even if sparse.

| Route | Component | Notes |
|---|---|---|
| `/closeout` | `Closeout` | Read-only checklist, no write mutations yet |
| `/estimating` | `Estimating` | Line-item entry; no bid integration |
| `/procurement` | `Procurement` | PO list; create flow incomplete |
| `/crews` | `Crews` | Reads from DB; assignment flow sparse |
| `/meetings` | `Meetings` | Basic CRUD works; no attendee notifications |
| `/permits` | `Permits` | Document upload only; no inspector workflow |

**Next action:** Review in Day 7–10 as part of the thin-shell pass. Flag individually if the
read path is genuinely broken, otherwise leave visible with a roadmap note.

---

## Feature Flag Infrastructure

### `src/lib/featureFlags.ts`

```ts
function flag(envKey: string, defaultValue = false): boolean {
  const raw = import.meta.env[envKey]
  if (raw === undefined || raw === '') return defaultValue
  return raw === 'true' || raw === '1'
}

export const FLAGS = {
  bimViewer:         flag('VITE_FLAG_BIM_VIEWER'),
  irisInbox:         flag('VITE_FLAG_IRIS_INBOX'),
  approvalWorkflows: flag('VITE_FLAG_APPROVAL_WORKFLOWS'),
  ownerReport:       flag('VITE_FLAG_OWNER_REPORT'),
  specParser:        flag('VITE_FLAG_SPEC_PARSER'),
  procoreImport:     flag('VITE_FLAG_PROCORE_IMPORT'),
  projectTemplates:  flag('VITE_FLAG_PROJECT_TEMPLATES'),
  bulkInvite:        flag('VITE_FLAG_BULK_INVITE'),
  walkthrough:       flag('VITE_FLAG_WALKTHROUGH'),
  complianceCockpit: flag('VITE_FLAG_COMPLIANCE_COCKPIT'),
} as const

export type FlagKey = keyof typeof FLAGS
```

All flags are evaluated once at module load time (compile-time constant for the build).
In production (`VITE_FLAG_*` unset) every flag is `false` → every stub route redirects.

### `src/components/auth/FeatureGate.tsx`

Declarative gate for future use in non-route contexts (sidebar links, feature banners, etc.):

```tsx
<FeatureGate flag="bimViewer" fallback={<Navigate to="/dashboard" replace />}>
  <BIMViewerPage />
</FeatureGate>
```

---

## Day 5 Checklist

- [x] Enumerate all placeholder/stub pages (30 identified)
- [x] Categorize: orphaned files vs live-routed shells vs thin pages
- [x] Create `src/lib/featureFlags.ts`
- [x] Create `src/components/auth/FeatureGate.tsx`
- [x] Feature-flag first 10 stub routes in `App.tsx`
- [x] Update `.env.example` with flag documentation
- [x] Write this audit document
- [ ] Update `SiteSync_90_Day_Tracker.xlsx` (Day 6 — tracker update pass)

## Day 6 Preview

1. Delete the 14 orphaned page files (Category A)
2. Begin Zustand store consolidation (22 → 5 stores)
