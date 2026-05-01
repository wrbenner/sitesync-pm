# Project Templates

Project templates capture the *structural* shape of a project (SOV layout, RFI categories, punch templates, role labels) so a new project of the same type can start with that scaffolding rather than an empty page.

The templates explicitly do NOT carry transactional data (RFIs, submittals, daily logs) or user identifiers. Templates are pure structure.

## What ships

| Layer | File |
| --- | --- |
| Pure builder | [src/lib/projectTemplates/index.ts](../../src/lib/projectTemplates/index.ts) |
| Materialize (instantiate template into project) | [src/lib/projectTemplates/materialize.ts](../../src/lib/projectTemplates/materialize.ts) |
| Strip (extract template from existing project) | [src/lib/projectTemplates/strip.ts](../../src/lib/projectTemplates/strip.ts) |
| Admin page | [src/pages/admin/project-templates/index.tsx](../../src/pages/admin/project-templates/index.tsx) |
| Persistence | [supabase/migrations/20260502120003_project_templates.sql](../../supabase/migrations/20260502120003_project_templates.sql) |

## What gets carried forward

The strip function in [src/lib/projectTemplates/strip.ts](../../src/lib/projectTemplates/strip.ts) defines the structural payload:

- Schedule of Values (SOV) line item names + cost codes (no amounts)
- RFI categories
- Submittal categories + spec sections
- Punch list templates (room types, finish checklists)
- Project-level role labels
- Default workflow assignments per entity type (see [PLATINUM_WORKFLOWS.md](../PLATINUM_WORKFLOWS.md) for the workflow engine)
- Cost-code subset relevant to this project type

## What gets stripped out

The strip function explicitly removes:

- Any user IDs (created_by, assigned_to)
- Any project IDs
- All transactional rows (rfis, submittals, change_orders, daily_logs, payment_applications)
- Any photos, drawings, or files
- Any audit log entries

## Materializing a template into a new project

1. Admin opens [src/pages/admin/project-templates/index.tsx](../../src/pages/admin/project-templates/index.tsx).
2. Picks a template from the org list.
3. Clicks "New project from template", supplies the project name + start date + address.
4. The materialize function in [src/lib/projectTemplates/materialize.ts](../../src/lib/projectTemplates/materialize.ts) walks the structural payload and creates rows in the new project's tables. The materializer is pure (`Result<T>`); the calling page handles the actual database writes.

## Stripping a template from an existing project

To capture an in-progress project's structure as a reusable template:

1. Admin opens the same admin page.
2. Picks "Capture from project" and selects the source project.
3. The strip function reads the project, drops transactional + identifying data, and writes a `project_templates` row.

## Persistence shape

Per [supabase/migrations/20260502120003_project_templates.sql](../../supabase/migrations/20260502120003_project_templates.sql):

- `project_templates(id, organization_id, name, description, structural_payload jsonb, created_by, created_at, archived_at)`
- The `structural_payload` is a JSON document; it is the entire content of the template.
- `archived_at` flags retired templates without deleting them.

## Failure modes

| Failure | Mitigation |
| --- | --- |
| Template references a workflow that no longer exists | Materializer falls back to default workflows from [src/lib/workflows/definitions.ts](../../src/lib/workflows/definitions.ts) |
| Template's cost-code subset is wider than the org's current library | Materializer creates only codes that exist in [supabase/migrations/20260502120002_cost_code_library.sql](../../supabase/migrations/20260502120002_cost_code_library.sql) |
| Template captured from a project on an older schema version | The structural payload is versioned at the top level; older payloads are migrated forward in code |

## Recommended template patterns

- One template per project type per market (e.g., "Tenant improvement — office", "Ground-up retail", "K-12 modernization"). Don't try to make one mega-template.
- Capture templates from your *best-run* projects, not the average ones.
- Re-strip a template whenever the project type evolves; templates should not be set-and-forget.
