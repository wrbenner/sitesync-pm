# Phase 1: Wire Every Fake Toast Stub to a Real Mutation

You are working on SiteSync PM, a construction project management platform built with React + TypeScript + Supabase + @tanstack/react-query.

## Project Conventions
- All mutations use `createAuditedMutation` factory from `src/hooks/mutations/createAuditedMutation.ts`
- All queries use `@tanstack/react-query` with `useQueryClient().invalidateQueries()` on success
- Toast feedback via `import { toast } from 'sonner'`
- Supabase client at `src/lib/supabase.ts`
- Generic table helper: `import { fromTable } from 'src/api/helpers'`
- Notification queue: `import { queueNotification } from 'src/api/invalidation.ts'` — already used in 6 places
- State machines in `src/machines/` with validation in `src/lib/state-machine-validation-helpers.ts`
- After every task, run `npx tsc --noEmit` to verify zero type errors

---

## Task 1: Submittals — Wire approve/reject/revise

### Problem
`src/pages/submittals/SubmittalDetail.tsx` lines 48-61: `handleApprove()`, `handleReject()`, `handleRequestRevision()` only show a toast and close the panel. They never call any mutation.

### Solution
The service layer already exists at `src/services/submittalService.ts`:
- `addApproval()` at ~line 204
- `createRevision()` at ~line 263

Wire these into the handlers:

```
// In SubmittalDetail.tsx, replace lines 48-61:

// OLD (toast-only):
const handleApprove = () => {
  addToast('success', `${submittalNumber} approved successfully`);
  onClose();
};

// NEW (real mutation):
const handleApprove = async () => {
  try {
    await submittalService.addApproval(submittal.id, {
      status: 'approved',
      reviewer_id: user?.id,
      reviewed_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['submittals'] });
    addToast('success', `${submittalNumber} approved`);
    onClose();
  } catch (err) {
    addToast('error', `Failed to approve: ${(err as Error).message}`);
  }
};
```

Apply the same pattern for `handleReject` (status: 'rejected') and `handleRequestRevision` (calls `submittalService.createRevision()`).

Also fix: `src/pages/submittals/SubmittalDetailPage.tsx` line ~250-258 — "Upload documents" button needs to persist file metadata to the submittals attachments after upload to storage. Use the existing `uploadProjectFile()` from `src/lib/storage.ts` and then insert a row into a submittal_attachments join (or update the submittal's `attachment_urls` JSON array).

### Verify
- Click Approve on a submittal → status changes in DB → page reflects new status
- Click Reject → status changes → rejection reason saved
- Click Request Revision → new revision created → revision number increments

---

## Task 2: Pay Applications — Wire submit + mark-as-paid + process payment

### Problem
`src/pages/PaymentApplications.tsx` has 5 toast stubs:
- Line 139: `toast.success('Payment flow initiated')` — no mutation
- Line 153: `toast.success('Application submitted for review')` — no mutation
- Line 1038: `toast.success('Opening payment flow...')` — no mutation
- Line 1058: `toast.info('Load SOV data to export G702 PDF')` — no action
- Line 1084: `toast.info('Load SOV data to export G703')` — no action

### Solution
The pay app API exists at `src/api/endpoints/payApplications.ts`:
- `submitPayApplication()` likely exists or create it
- Status transitions: draft → submitted → approved → paid

For line 153 ("submitted for review"):
```typescript
// Replace toast stub with real mutation:
const handleSubmit = async (payAppId: string) => {
  const { error } = await supabase
    .from('pay_applications')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', payAppId);
  if (error) { toast.error('Failed to submit: ' + error.message); return; }
  queryClient.invalidateQueries({ queryKey: ['pay-applications'] });
  toast.success('Application submitted for review');
};
```

For line 139 ("Payment flow initiated" / mark as paid):
```typescript
const handleMarkPaid = async (payAppId: string) => {
  const { error } = await supabase
    .from('pay_applications')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payAppId);
  if (error) { toast.error('Failed: ' + error.message); return; }
  queryClient.invalidateQueries({ queryKey: ['pay-applications'] });
  toast.success('Payment recorded');
};
```

For lines 1058/1084 (G702/G703 export fallbacks): These fire when SOV data isn't loaded. Instead of a toast, trigger the SOV data load first, then proceed with export.

### Verify
- Create a pay app → click Submit → status changes to "submitted" in DB
- Click "Mark as Paid" on an approved pay app → status changes to "paid"
- G702/G703 export buttons work even when SOV data needs loading first

---

## Task 3: Time Tracking — Build WH-347 PDF generation

### Problem
`src/pages/TimeTracking.tsx`:
- Line 552: `toast.success('WH-347 report generated (PDF). Check your downloads.')` — no PDF generated
- Line 734: `toast.success('Payroll exported in ${format}...')` — no file exported

### Solution
The WH-347 data is already computed from real `time_entries` + `workforce_members` data (the `wh347Employees` useMemo). Use `pdf-lib` (already in the project — used in Reports.tsx) to generate the actual PDF.

Create a new function `generateWH347PDF()` in `src/lib/reports/` or inline:

```typescript
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function generateWH347PDF(header: WH347Header, employees: WH347Employee[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([792, 612]); // Landscape letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  
  // Draw WH-347 header fields
  let y = 580;
  page.drawText('U.S. Department of Labor — Payroll (WH-347)', { x: 50, y, font: fontBold, size: 14 });
  y -= 25;
  page.drawText(`Contractor: ${header.contractor}`, { x: 50, y, font, size: 10 });
  page.drawText(`Project: ${header.projectName}`, { x: 300, y, font, size: 10 });
  y -= 15;
  page.drawText(`Week Ending: ${header.weekEnding}`, { x: 50, y, font, size: 10 });
  y -= 25;
  
  // Column headers
  const cols = ['Name', 'Trade', 'M', 'T', 'W', 'Th', 'F', 'S', 'Su', 'Total', 'Rate', 'Gross'];
  const colX = [50, 150, 230, 260, 290, 320, 350, 380, 410, 440, 490, 545];
  cols.forEach((c, i) => page.drawText(c, { x: colX[i], y, font: fontBold, size: 9 }));
  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: 600, y }, thickness: 0.5 });
  y -= 15;
  
  // Employee rows
  for (const emp of employees) {
    page.drawText(emp.name, { x: 50, y, font, size: 8 });
    page.drawText(emp.trade, { x: 150, y, font, size: 8 });
    emp.hours.forEach((h, i) => page.drawText(String(h), { x: colX[i + 2], y, font, size: 8 }));
    page.drawText(String(emp.totalHours), { x: 440, y, font, size: 8 });
    page.drawText(`$${emp.rate.toFixed(2)}`, { x: 490, y, font, size: 8 });
    page.drawText(`$${emp.gross.toFixed(2)}`, { x: 545, y, font, size: 8 });
    y -= 14;
  }
  
  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `WH-347_${header.weekEnding}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

For payroll export (line 734): Generate a real CSV with columns: Employee, Trade, Mon-Sun hours, Total, Rate, Gross, FICA, Withholding, Net. Use the same wh347Employees data.

### Verify
- Click "Generate WH-347" → actual PDF downloads with real employee data
- Click "Export Payroll" → actual CSV/XLSX downloads

---

## Task 4: Time Tracking — Build T&M ticket creation form

### Problem
Line 567: `toast.info('T&M ticket creation form would open here.')` — form doesn't exist.

### Solution
Create a modal form for Time & Materials tickets. If no `time_material_tickets` table exists, create a migration:

```sql
CREATE TABLE IF NOT EXISTS time_material_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) NOT NULL,
  ticket_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  labor_hours numeric DEFAULT 0,
  labor_rate numeric DEFAULT 0,
  material_cost numeric DEFAULT 0,
  equipment_cost numeric DEFAULT 0,
  markup_pct numeric DEFAULT 10,
  total numeric GENERATED ALWAYS AS (
    (labor_hours * labor_rate + material_cost + equipment_cost) * (1 + markup_pct / 100)
  ) STORED,
  status text DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Build a simple modal with fields: Ticket #, Date, Description, Labor Hours, Labor Rate, Material Cost, Equipment Cost, Markup %. Wire create mutation. Replace the toast with `setTmModalOpen(true)`.

### Verify
- Click "New T&M Ticket" → modal opens → fill in fields → save → record appears in Supabase

---

## Task 5: Workforce — Wire certification renewal to real notifications

### Problem
`src/pages/Workforce.tsx` line 563: "Renewal reminder sent" toast does nothing. Also, certifications use `credentialDemoData` (hardcoded demo array, lines 34-82) instead of Supabase data.

### Solution
1. Replace `credentialDemoData` with a query to `workforce_certifications` or `workforce_members` certifications field (check which table stores certs).
2. Replace the toast with a real `queueNotification()` call:

```typescript
import { queueNotification } from '../api/invalidation';

// Replace toast stub:
onClick={async () => {
  await queueNotification({
    type: 'cert_renewal',
    entity_type: 'workforce_member',
    entity_id: member.id,
    project_id: projectId,
    message: `Renewal reminder for ${cert.certName} - expires ${cert.expiryDate}`,
  });
  toast.success(`Renewal reminder sent for ${cert.certName}`);
}}
```

### Verify
- Click "Remind" on an expiring cert → notification appears in NotificationCenter bell icon
- Certification data comes from Supabase, not hardcoded array

---

## Task 6: Meetings — Wire action item reminder to notifications

### Problem
`src/pages/Meetings.tsx` line 1618: `toast.success('Reminder sent to ${item.assignee}')` — no notification sent.

### Solution
Same pattern as Task 5:
```typescript
onClick={async () => {
  await queueNotification({
    type: 'meeting_action_reminder',
    entity_type: 'meeting',
    entity_id: meeting.id,
    project_id: projectId,
    message: `Reminder: "${item.title}" is due ${item.dueDate} (assigned by ${user?.email})`,
  });
  toast.success(`Reminder sent to ${item.assignee}`);
}}
```

### Verify
- Click reminder icon on a meeting action item → notification queued → appears in bell

---

## Final Verification
After all 6 tasks:
1. `npx tsc --noEmit` — zero errors
2. `npx vite build --outDir /tmp/phase1-build` — builds successfully
3. `grep -rn "toast\.\(info\|success\)(" src/pages/ | grep -iE "coming soon|would|placeholder|stub|flow initiated|form would"` — should return ZERO results
4. Manually test each workflow in the browser
