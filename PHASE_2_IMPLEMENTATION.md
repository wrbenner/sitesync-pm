# Phase 2: Connect the Financial Backbone

You are working on SiteSync PM, a construction project management platform built with React + TypeScript + Supabase + @tanstack/react-query.

## Context
The financial modules (Contracts, Change Orders, Budget, Pay Apps) currently exist as isolated islands. This phase makes them talk to each other — the way Procore works.

## Project Conventions
- Mutations: `createAuditedMutation` from `src/hooks/mutations/createAuditedMutation.ts`
- Queries: `@tanstack/react-query` with invalidation on success
- Supabase client: `src/lib/supabase.ts`
- Generic table: `fromTable()` from `src/api/helpers`
- Financial engine: `src/lib/financialEngine.ts` — has `computeProjectFinancials()`, `getBudgetSummaryMetrics()`, `detectBudgetAnomalies()`
- After every task, run `npx tsc --noEmit`

---

## Task 1: Change Order Line Items Table + CRUD

### Problem
Change orders have a single flat `amount` field. Procore breaks COs into line items by cost code. `src/pages/ChangeOrders.tsx` line ~313: `getLinkedEntities()` returns `[]`.

### Migration
```sql
CREATE TABLE IF NOT EXISTS change_order_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id uuid REFERENCES change_orders(id) ON DELETE CASCADE NOT NULL,
  cost_code text,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  scope_type text DEFAULT 'in_scope' CHECK (scope_type IN ('in_scope','out_of_scope','disputed')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_co_line_items_co ON change_order_line_items(change_order_id);
```

### Hooks
Create in `src/hooks/queries/change-orders.ts` (or a new file):
```typescript
export function useChangeOrderLineItems(changeOrderId: string | undefined) {
  return useQuery({
    queryKey: ['change-order-line-items', changeOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_order_line_items')
        .select('*')
        .eq('change_order_id', changeOrderId!)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!changeOrderId,
  });
}

export function useCreateCOLineItem() { /* standard insert mutation */ }
export function useUpdateCOLineItem() { /* standard update mutation */ }
export function useDeleteCOLineItem() { /* standard delete mutation */ }
```

### UI Changes in ChangeOrders.tsx
In the change order detail panel, add a "Line Items" section below the amount field:
- Editable table: Cost Code | Description | Amount | Scope Type | Actions
- "Add Line Item" button
- Total row that auto-sums
- The CO's total `amount` should be the sum of line items (or the flat amount if no line items exist)

### Verify
- Open a change order → add 3 line items → total updates → save → reload → items persist

---

## Task 2: CO Approval → Budget Auto-Update

### Problem
When a change order moves to "approved" status, nothing happens to the budget. `src/hooks/mutations/change-orders.ts` line ~119-142: `useApproveChangeOrder` sets `approved_amount` but never touches `budget_items` or `projects.contract_value`.

### Solution
In the approve mutation (after the status update succeeds), add:

```typescript
// After CO status → approved:

// 1. Update project contract value
const { data: project } = await supabase
  .from('projects')
  .select('contract_value')
  .eq('id', projectId)
  .single();

await supabase
  .from('projects')
  .update({ contract_value: (project.contract_value || 0) + approvedAmount })
  .eq('id', projectId);

// 2. If CO has line items, update budget_items for each cost code
const { data: lineItems } = await supabase
  .from('change_order_line_items')
  .select('cost_code, amount')
  .eq('change_order_id', changeOrderId);

for (const item of lineItems || []) {
  if (!item.cost_code) continue;
  // Upsert budget adjustment
  const { data: budgetItem } = await supabase
    .from('budget_items')
    .select('id, revised_amount, committed')
    .eq('project_id', projectId)
    .eq('cost_code', item.cost_code)
    .single();

  if (budgetItem) {
    await supabase
      .from('budget_items')
      .update({
        revised_amount: (budgetItem.revised_amount || 0) + item.amount,
        committed: (budgetItem.committed || 0) + item.amount,
      })
      .eq('id', budgetItem.id);
  }
}

// 3. Invalidate budget queries
queryClient.invalidateQueries({ queryKey: ['budget'] });
queryClient.invalidateQueries({ queryKey: ['project-financials'] });
```

### Verify
- Approve a $50,000 CO with cost code "03-Concrete" → budget page shows Concrete revised budget increased by $50K → project contract value increased by $50K

---

## Task 3: Fix CO Promotion Logic

### Problem
`src/hooks/mutations/change-orders.ts` lines 57-93: `usePromoteChangeOrder` creates a NEW change order record with `promoted_from_id` instead of mutating the original's `type` field. This violates single-source-of-truth.

### Solution
Change the mutation to update the existing record's type instead of inserting a new one:

```typescript
// OLD: creates duplicate
const { data } = await supabase.from('change_orders').insert({ ...copiedFields, type: 'cor', promoted_from_id: originalId });

// NEW: mutates original
const { data, error } = await supabase
  .from('change_orders')
  .update({
    type: 'cor',
    promoted_at: new Date().toISOString(),
    promoted_by: userId,
  })
  .eq('id', originalId)
  .select()
  .single();
```

Add `promoted_at` and `promoted_by` columns if they don't exist:
```sql
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS promoted_at timestamptz;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS promoted_by uuid REFERENCES auth.users(id);
```

### Verify
- Promote a PCO → same record, type changes from 'pco' to 'cor' → no duplicate created

---

## Task 4: Pay Apps — Link Billing to Contract SOV Line Items

### Problem
Pay app line items exist but don't reference contract SOV items. Billing should track "completed to date" per SOV line.

### Context
The Contracts page (`src/pages/Contracts.tsx`) already has a full SOV system with `useSovItems()` hooks. Pay apps need to bill against those SOV lines.

### Migration
```sql
-- Add FK from pay app line items to SOV items
ALTER TABLE pay_application_line_items
  ADD COLUMN IF NOT EXISTS sov_item_id uuid REFERENCES sov_items(id);

-- Add billing tracking columns if missing
ALTER TABLE pay_application_line_items
  ADD COLUMN IF NOT EXISTS previous_completed numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS this_period numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS materials_stored numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_completed numeric GENERATED ALWAYS AS (previous_completed + this_period + materials_stored) STORED,
  ADD COLUMN IF NOT EXISTS retainage numeric DEFAULT 0;
```

### UI Changes in PaymentApplications.tsx
When creating/editing a pay app for a contract:
1. Auto-populate line items from the contract's SOV
2. For each line: show Scheduled Value (from SOV), Previous Completed (from prior pay apps), This Period (editable), Materials Stored (editable)
3. Auto-calculate: Total Completed, % Complete, Balance to Finish, Retainage

This is the G703 continuation sheet — the math already works in `computeCurrentPaymentDue()`.

### Verify
- Create a pay app against a contract → SOV lines auto-populate → edit "This Period" amounts → G702 summary updates → save → next pay app shows updated "Previous Completed"

---

## Task 5: Budget — Dynamic Contingency + CO-Driven Revisions

### Problem
`src/pages/Budget.tsx` line ~356: contingency is hardcoded as `3800000 - consumed`. It should come from a real contingency cost code.

### Solution
1. Find the contingency-related hardcoded values in Budget.tsx and replace with real data:

```typescript
// OLD (hardcoded):
const contingencyBudget = 3800000;
const contingencyConsumed = /* some hardcoded calc */;

// NEW (from real budget data):
const contingencyItem = budgetItems?.find(b =>
  b.cost_code?.toLowerCase().includes('contingency') ||
  b.division?.toLowerCase().includes('contingency')
);
const contingencyBudget = contingencyItem?.original_amount || 0;
const contingencyConsumed = contingencyItem?.spent || 0;
```

2. The "Contingency Drawdown" visualization (lines ~480-491) should pull from this real data.

3. When COs are approved (from Task 2), contingency should be consumed. Add logic: if a CO draws from contingency, subtract from the contingency budget item.

### Verify
- Budget page contingency section reflects real budget data
- Approve a CO → contingency consumed amount increases

---

## Task 6: Contract Amendments

### Problem
Contracts page has no amendment workflow. Procore supports: create amendment → track history → impact on contract value.

### Migration
```sql
CREATE TABLE IF NOT EXISTS contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  amendment_number integer NOT NULL,
  title text NOT NULL,
  description text,
  amount_change numeric DEFAULT 0,
  effective_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected')),
  linked_change_order_id uuid REFERENCES change_orders(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

### Hooks
Create `useContractAmendments(contractId)`, `useCreateAmendment()`, `useApproveAmendment()`.

When an amendment is approved:
- Update contract's `current_value` = original + sum of approved amendment amounts
- If linked to a CO, show the connection in both views

### UI
In Contracts.tsx, add an "Amendments" tab/section to the contract detail view:
- Table: # | Title | Amount Change | Status | Effective Date | Linked CO
- "New Amendment" button → modal form
- Approve/Reject buttons with real mutations

### Verify
- Create an amendment for +$100K → approve it → contract value updates → see it in contract detail

---

## Task 7: Entity Linking — CO ↔ RFI ↔ Submittal ↔ Drawing

### Problem
`src/pages/ChangeOrders.tsx` line ~313: `getLinkedEntities()` returns `[]`. Cross-module relationships don't exist anywhere.

### Migration
```sql
CREATE TABLE IF NOT EXISTS entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) NOT NULL,
  source_type text NOT NULL, -- 'change_order', 'rfi', 'submittal', 'punch_item', 'drawing'
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_type, source_id, target_type, target_id)
);

CREATE INDEX idx_entity_links_source ON entity_links(source_type, source_id);
CREATE INDEX idx_entity_links_target ON entity_links(target_type, target_id);
```

### Hooks
```typescript
export function useEntityLinks(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity-links', entityType, entityId],
    queryFn: async () => {
      // Get links where this entity is either source or target
      const { data: asSource } = await supabase
        .from('entity_links')
        .select('*')
        .eq('source_type', entityType)
        .eq('source_id', entityId!);
      const { data: asTarget } = await supabase
        .from('entity_links')
        .select('*')
        .eq('target_type', entityType)
        .eq('target_id', entityId!);
      return [...(asSource || []), ...(asTarget || [])];
    },
    enabled: !!entityId,
  });
}

export function useCreateEntityLink() { /* insert mutation */ }
export function useDeleteEntityLink() { /* delete mutation */ }
```

### UI: "Linked Items" component
Create a reusable `<LinkedItems entityType="change_order" entityId={co.id} />` component that:
- Shows linked RFIs, submittals, drawings, etc.
- Has an "Add Link" button → search/select modal
- Displays linked item title, type badge, status

Add this component to: ChangeOrders detail, RFI detail, Submittal detail, Punch Item detail.

Replace `getLinkedEntities()` in ChangeOrders.tsx with the real hook.

### Verify
- Open a CO → click "Link RFI" → select an RFI → link appears in both CO and RFI detail views
- Links persist across page reloads

---

## Final Verification
After all 7 tasks:
1. `npx tsc --noEmit` — zero errors
2. `npx vite build --outDir /tmp/phase2-build` — builds successfully
3. Test the full financial flow: Create CO with line items → Approve → Budget updates → Create Pay App against contract → Bill against SOV → Submit → Approve
