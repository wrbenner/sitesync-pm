# Codebase Patterns Reference

> **PURPOSE**: Quick reference for the engine when building new features.
> Shows the EXACT patterns to follow for new files, so code stays consistent.

---

## Existing Database Tables (56 migrations)

These tables already exist. Do NOT recreate them. Reference them in new migrations with foreign keys.

### Core
organizations, organization_members, organization_settings, project_members, audit_log, audit_trail, api_keys

### Documents & Drawings
drawing_markups, transmittals, closeout_items

### RFIs & Submittals
rfi_watchers (rfis, submittals, change_orders are in the core schema via types)

### Field Operations
equipment, equipment_logs, equipment_maintenance, incidents, safety_inspections, safety_inspection_templates, safety_observations, safety_certifications, toolbox_talks, toolbox_talk_attendees, corrective_actions, weather_records, crew_gps_locations, time_entries

### Financial
payment_applications, payment_line_items, purchase_orders, po_line_items, subcontractor_invoices, lien_waivers, certified_payroll_reports, certified_payroll_employees, prevailing_wage_rates, labor_forecasts

### Scheduling
weekly_commitments, workforce_members, workforce_assignments, task_templates

### Insurance & Permits
insurance_certificates, coi_requirements, coi_extractions, permits, permit_inspections

### Integrations
integrations, integration_field_mappings, integration_sync_log, webhook_endpoints, webhook_deliveries, webhooks

### AI
ai_agents, ai_agent_actions, ai_usage

### BIM
bim_models, bim_elements, bim_clashes, bim_markups, bim_4d_sequence, bim_element_progress, bim_rfi_elements, bim_safety_zones

### Reporting
custom_reports, report_templates, report_schedules, report_runs, executive_reports, owner_updates

### Portal
portal_users, portal_invitations, portal_access_tokens

### Photos & Progress
photo_pins, photo_pin_associations, photo_comparisons, progress_detection_results

### Sustainability
sustainability_metrics, waste_logs

### Other
deliveries, delivery_items, material_inventory, portfolios, portfolio_projects, warranties, warranty_claims, commissioning_items

---

## Edge Function Pattern

All edge functions use Deno and import from the shared auth module.

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  verifyProjectMembership,
  requireMinimumRole,
  requireUuid,
  parseJsonBody,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return handleCors(req)
  const corsHeaders = getCorsHeaders(req)

  try {
    // Auth
    const user = await authenticateRequest(req)
    const { projectId } = await parseJsonBody(req)
    requireUuid(projectId, 'project_id')
    await verifyProjectMembership(user.id, projectId)

    // Your logic here...

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return errorResponse(error, corsHeaders)
  }
})
```

Shared auth module location: `supabase/functions/shared/auth.ts`

---

## React Hook Pattern

All data hooks use the supabase client from `src/lib/supabase.ts` and types from `src/types/database.ts`.

```typescript
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Tables = Database['public']['Tables']
type MyEntity = Tables['my_table']['Row']
type MyEntityInsert = Tables['my_table']['Insert']

interface UseMyEntityState {
  data: MyEntity[]
  isLoading: boolean
  error: Error | null
}

export function useMyEntity(projectId: string) {
  const [state, setState] = useState<UseMyEntityState>({
    data: [], isLoading: true, error: null
  })

  const fetch = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true }))
    const { data, error } = await supabase
      .from('my_table')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    setState({ data: data || [], isLoading: false, error: error ? new Error(error.message) : null })
  }, [projectId])

  useEffect(() => { fetch() }, [fetch])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('my_table_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'my_table',
        filter: `project_id=eq.${projectId}`
      }, () => fetch())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetch])

  return { ...state, refetch: fetch }
}
```

---

## Service File Pattern

Services handle business logic and API calls. Located in `src/services/`.

```typescript
import { supabase } from '../lib/supabase'

export interface MyConfig {
  projectId: string
  // ...
}

export async function doSomething(config: MyConfig) {
  const { data, error } = await supabase
    .from('my_table')
    .insert({ project_id: config.projectId })
    .select()
    .single()

  if (error) throw new Error(`Failed: ${error.message}`)
  return data
}
```

---

## Page Component Pattern

Pages are in `src/pages/`. They use inline styles from `src/styles/theme.ts`.

```typescript
import React, { useState } from 'react'
import { theme } from '../styles/theme'
import { Card, MetricBox, Btn, Tag } from '../components/Primitives'

export default function MyPage() {
  return (
    <div style={{ padding: theme.spacing.lg, background: theme.colors.background }}>
      {/* Metric cards at top */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: theme.spacing.md }}>
        <MetricBox label="Total" value={42} icon="..." />
      </div>

      {/* Content below */}
      <Card style={{ marginTop: theme.spacing.lg }}>
        {/* Table or content */}
      </Card>
    </div>
  )
}
```

NEVER use CSS modules or styled-components. Always inline styles with theme tokens.
NEVER use hyphens in UI text. Use commas or periods instead.

---

## Migration Pattern

Migrations go in `supabase/migrations/` with sequential numbering.

```sql
-- Create table with RLS
create table my_new_table (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  -- columns here
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table my_new_table enable row level security;

-- RLS policy: project members only
create policy "Project members can view"
  on my_new_table for select
  using (
    project_id in (
      select pm.project_id from project_members pm
      where pm.user_id = auth.uid()
    )
  );

create policy "Project members can insert"
  on my_new_table for insert
  with check (
    project_id in (
      select pm.project_id from project_members pm
      where pm.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
create trigger set_updated_at
  before update on my_new_table
  for each row execute function update_updated_at();
```

---

## Key File Locations

| What | Where |
|------|-------|
| Supabase client | `src/lib/supabase.ts` |
| Database types | `src/types/database.ts` (6465 lines, auto-generated) |
| Auth hook | `src/hooks/useAuth.ts` |
| Permissions hook | `src/hooks/usePermissions.ts` |
| Real-time hook | `src/hooks/useRealtimeSubscription.ts` |
| Theme tokens | `src/styles/theme.ts` |
| Shared UI components | `src/components/Primitives.tsx` |
| Sidebar nav | `src/components/Sidebar.tsx` |
| App routes | `src/App.tsx` |
| Edge function shared auth | `supabase/functions/shared/auth.ts` |
