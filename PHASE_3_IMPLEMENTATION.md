# Phase 3: Bulletproof Quality — Error Boundaries, E2E Tests, Email, RLS

You are working on SiteSync PM, a construction project management platform built with React + TypeScript + Supabase + @tanstack/react-query.

## Project Conventions
- Error boundary component exists at `src/components/ErrorBoundary.tsx`
- Sentry already integrated (see App.tsx outer boundary)
- `src/api/errors.ts` has full typed error hierarchy (ApiError, NetworkError, etc.)
- After every task, run `npx tsc --noEmit`

---

## Task 1: Add ErrorBoundary to All 35+ Unprotected Pages

### Problem
Only 5 of 40+ pages have ErrorBoundary wraps (Dashboard, RFIs, Budget, Schedule, Submittals). Every other page crashes with a white screen on any uncaught error.

### Solution
In `src/App.tsx` (or wherever routes are defined), wrap every `<Route>` element's component in the existing ErrorBoundary:

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

// For every lazy-loaded route, wrap the component:
<Route path="/change-orders" element={
  <ErrorBoundary>
    <Suspense fallback={<PageLoadingFallback />}>
      <ChangeOrders />
    </Suspense>
  </ErrorBoundary>
} />
```

Do this for EVERY route. The pages that already have it won't break — ErrorBoundary is idempotent.

Alternatively, create a wrapper component:

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Then use everywhere:
<Route path="/change-orders" element={<ProtectedRoute><ChangeOrders /></ProtectedRoute>} />
```

### List of pages to check/wrap
Look at every `<Route>` in App.tsx. Every one needs ErrorBoundary. Check these specifically:
- ChangeOrders, Contracts, PaymentApplications, Meetings, TimeTracking
- Workforce, Crews, Equipment, Vendors, Deliveries
- Safety (all sub-routes), Closeout, Files, Wiki, Directory
- Estimating, Preconstruction, CostManagement, Budget
- SiteMap, BIMViewerPage, CarbonDashboard
- Drawings (all sub-routes), Punch List (all sub-routes)
- Daily Log (all sub-routes), Submittals (all sub-routes)
- RFIs (all sub-routes), Reports, LienWaivers
- Integrations, AuditTrail, Settings

### Verify
- Temporarily throw an error in a previously unprotected page → should see error UI, not white screen
- Remove the test error

---

## Task 2: E2E Tests for 5 Critical Workflows

### Setup
```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
});
```

Create `e2e/` directory. Each test file below:

### Test 1: `e2e/rfi-workflow.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test('RFI: create → assign → respond → close', async ({ page }) => {
  // Login (use test credentials or mock auth)
  await page.goto('/rfis');
  
  // Create
  await page.click('button:has-text("New RFI")');
  await page.fill('input[placeholder*="subject"], input[placeholder*="title"]', 'Test RFI - Foundation issue');
  await page.fill('textarea', 'Clarification needed on footing depth');
  await page.click('button:has-text("Create"), button:has-text("Save")');
  await expect(page.locator('text=Test RFI - Foundation issue')).toBeVisible();
  
  // Open detail
  await page.click('text=Test RFI - Foundation issue');
  
  // Verify status transitions exist
  await expect(page.locator('text=Open, text=open')).toBeVisible();
  
  // Close test - verify close button works
  // (adapt selectors based on actual UI)
});
```

### Test 2: `e2e/submittal-workflow.spec.ts`
Test: Create submittal → Approve (verify mutation fires, not just toast) → Verify status changes in the list

### Test 3: `e2e/change-order-budget.spec.ts`
Test: Create CO with line items → Approve → Navigate to Budget → Verify budget updated

### Test 4: `e2e/pay-app-workflow.spec.ts`
Test: Create pay app → Fill SOV lines → Submit → Verify status = submitted in DB

### Test 5: `e2e/punch-item-workflow.spec.ts`
Test: Create punch item → Mark sub-complete → GC verify → Item closes

### Verify
```bash
npx playwright test
# All 5 tests pass
```

---

## Task 3: Wire Email Delivery via Resend + Supabase Edge Function

### Problem
`src/services/emailNotificationService.ts` defines `processNotificationQueue()` but it's never called. Notifications are queued to the `notifications` table but never sent as emails.

### Solution
Create a Supabase Edge Function that processes the notification queue.

`supabase/functions/process-notifications/index.ts`:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get unprocessed notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*, profiles:user_id(email, full_name)')
    .eq('email_sent', false)
    .limit(50);

  if (!notifications?.length) {
    return new Response(JSON.stringify({ processed: 0 }));
  }

  let sent = 0;
  for (const notif of notifications) {
    const email = notif.profiles?.email;
    if (!email) continue;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SiteSync PM <notifications@sitesyncpm.com>',
          to: email,
          subject: `[SiteSync] ${notif.title || notif.message}`,
          html: `<p>${notif.message}</p><p><a href="https://sitesyncpm.com/${notif.entity_type}s/${notif.entity_id}">View in SiteSync</a></p>`,
        }),
      });

      await supabase
        .from('notifications')
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq('id', notif.id);

      sent++;
    } catch (err) {
      console.error('Email send failed:', err);
    }
  }

  return new Response(JSON.stringify({ processed: sent }));
});
```

Add `email_sent` column if missing:
```sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
```

Set up a cron trigger (Supabase Dashboard → Edge Functions → Cron) to run every 5 minutes, or use `pg_cron`:
```sql
SELECT cron.schedule('process-notifications', '*/5 * * * *',
  $$ SELECT net.http_post(
    'https://<project-ref>.supabase.co/functions/v1/process-notifications',
    '{}',
    'application/json',
    ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))]
  ) $$
);
```

### Verify
- Queue a notification (e.g., assign an RFI) → within 5 minutes → email arrives at assignee
- Check notifications table: email_sent = true

---

## Task 4: RLS Policies Audit + Enforcement

### Problem
Most tables likely have permissive RLS or no RLS at all. Users can see other projects' data.

### Solution
For every table that has a `project_id` column, add RLS:

```sql
-- Enable RLS
ALTER TABLE rfis ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see rows for projects they're members of
CREATE POLICY "Users see own project rfis" ON rfis
  FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );
```

Apply this pattern to ALL tables with project_id:
- rfis, submittals, change_orders, punch_items, daily_log_entries
- contracts, pay_applications, budget_items, sov_items
- deliveries, purchase_orders, material_inventory
- meetings, tasks, files, drawings, wiki_pages
- time_entries, workforce_members, incidents
- notifications, audit_trail, entity_links

For tables WITHOUT project_id (like profiles), use user-scoped policies:
```sql
CREATE POLICY "Users see own profile" ON profiles
  FOR ALL USING (id = auth.uid());
```

### Verify
- Log in as User A (member of Project 1) → cannot see Project 2's RFIs
- Log in as User B (member of Project 2) → cannot see Project 1's data
- Supabase Dashboard → Auth → check RLS is enabled on all tables

---

## Task 5: Drawing Linkage for RFIs + Punch Items

### Problem
RFI drawing reference is text-only (no picker). Punch items store location as a string with no drawing FK.

### Solution
Create a reusable `<DrawingPicker>` component:

```tsx
// src/components/shared/DrawingPicker.tsx
interface DrawingPickerProps {
  projectId: string;
  value: string | null;
  onChange: (drawingId: string | null) => void;
}

export function DrawingPicker({ projectId, value, onChange }: DrawingPickerProps) {
  const { data: drawings } = useDrawings(projectId);
  const selected = drawings?.find(d => d.id === value);

  return (
    <div>
      <label>Linked Drawing</label>
      <select value={value || ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">None</option>
        {(drawings || []).map(d => (
          <option key={d.id} value={d.id}>{d.number} — {d.title}</option>
        ))}
      </select>
      {selected && (
        <div style={{ marginTop: 8 }}>
          <img src={selected.thumbnail_url} alt={selected.title} style={{ width: 120, borderRadius: 4 }} />
        </div>
      )}
    </div>
  );
}
```

Add to:
1. RFI create/edit form — replace text `drawing_reference` field with DrawingPicker. Store `linked_drawing_id` FK.
2. Punch Item create wizard — add DrawingPicker step/field. Store `drawing_id` FK.

Add FK columns if missing:
```sql
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS linked_drawing_id uuid REFERENCES drawings(id);
ALTER TABLE punch_items ADD COLUMN IF NOT EXISTS drawing_id uuid REFERENCES drawings(id);
```

### Verify
- Create an RFI → select a drawing from picker → drawing thumbnail shows → save → reload → drawing still linked
- Create a punch item → link a drawing → visible in detail view

---

## Final Verification
1. `npx tsc --noEmit` — zero errors
2. `npx vite build --outDir /tmp/phase3-build` — builds
3. `npx playwright test` — all 5 E2E tests pass
4. Verify no white-screen crashes on any page (navigate all routes)
5. Verify RLS: log in as different users, confirm data isolation
