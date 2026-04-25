# Phase 4: Demo-Ready Seed Data — "Parkview Tower"

You are working on SiteSync PM, a construction project management platform built with React + TypeScript + Supabase.

## Context
The platform needs a realistic demo project so it feels alive on first load. This seed data tells a story: a $28M mixed-use building, 60% through construction, with realistic problems (one division over budget, pending change orders, open RFIs, active punch list).

---

## Task 1: Create the Seed SQL Script

Create `supabase/seed/parkview-tower.sql`. This is a single SQL file that inserts all demo data. It should be idempotent (use `ON CONFLICT DO NOTHING` or check for existence).

### Project
```sql
INSERT INTO projects (id, name, number, address, city, state, status, contract_value, start_date, estimated_completion, owner_name, architect_name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Parkview Tower',
  'PKV-2026-001',
  '1200 Parkview Blvd',
  'San Francisco',
  'CA',
  'active',
  28500000,
  '2025-06-15',
  '2027-03-30',
  'Parkview Development LLC',
  'Foster + Partners'
) ON CONFLICT (id) DO NOTHING;
```

### Team Members (6-8 people)
Insert into `project_members`:
- Project Manager (PM role)
- Superintendent
- Project Engineer
- Safety Manager
- 2 Subcontractor reps
- Owner rep
- Architect rep

### Cost Codes (15 divisions)
Insert into `budget_items` or `cost_codes`:
```
01 - General Conditions: $2,400,000
02 - Site Work: $1,850,000
03 - Concrete: $4,200,000 (OVER BUDGET - spent $4,536,000 = 108%)
04 - Masonry: $980,000
05 - Structural Steel: $3,100,000
06 - Carpentry: $1,200,000
07 - Waterproofing: $650,000
08 - Doors & Windows: $1,800,000
09 - Finishes: $2,900,000
10 - Specialties: $450,000
14 - Elevators: $1,600,000
15 - Mechanical: $3,200,000
16 - Electrical: $2,800,000 (UNDER BUDGET - spent $2,016,000 = 72%)
21 - Fire Protection: $800,000
99 - Contingency: $3,800,000 (40% consumed = $1,520,000)
```

### Contracts (6 subcontracts)
```
1. Bay Area Concrete Co. — $4,200,000 — Concrete — Active
2. Pacific Steel Erectors — $3,100,000 — Structural Steel — Active
3. Golden Gate Mechanical — $3,200,000 — HVAC/Plumbing — Active
4. Bayshore Electric — $2,800,000 — Electrical — Active
5. Summit Elevator Co. — $1,600,000 — Elevators — Pending Signature
6. Westcoast Finishing — $2,900,000 — Interior Finishes — Active
```

Each contract should have 5-8 SOV line items.

### RFIs (12, various states)
```
RFI-001: "Footing depth at grid line C-4" — Closed — Answered by architect
RFI-002: "Waterproofing detail at parking transition" — Open — Assigned to architect, 3 days overdue
RFI-003: "Steel connection detail at level 8 cantilever" — Answered — Pending review
RFI-004: "Elevator pit depth clarification" — Open — Due in 2 days
RFI-005: "MEP routing conflict at level 5 corridor" — Under Review
RFI-006: "Window mullion color for south elevation" — Closed
RFI-007: "Fire rating at stair enclosure B" — Open — Due today
RFI-008: "Concrete mix design for exposed columns" — Draft
RFI-009: "Structural slab opening for HVAC chase" — Answered
RFI-010: "Finish schedule change — lobby tile" — Open — 5 days overdue
RFI-011: "Handrail mounting detail — ADA compliance" — Closed
RFI-012: "Generator pad location conflict with site plan" — Under Review
```

### Submittals (8, various states)
```
SUB-001: "Concrete mix design — 5000 PSI" — Approved — Rev 1
SUB-002: "Structural steel shop drawings" — Approved with comments — Rev 2
SUB-003: "HVAC equipment cut sheets" — Under Review — Due in 5 days
SUB-004: "Elevator cab finishes" — Pending — Rev 1
SUB-005: "Waterproofing membrane samples" — Rejected — Needs Rev 2
SUB-006: "Electrical panel schedule" — Approved — Rev 1
SUB-007: "Interior door hardware" — Draft
SUB-008: "Fire sprinkler shop drawings" — Under Review — Due in 3 days
```

### Change Orders (5)
```
CO-001: "Additional footing at grid C-4" — $85,000 — Approved — Cost code 03
CO-002: "Upgraded lobby finishes (owner request)" — $220,000 — Approved — Cost code 09
CO-003: "MEP reroute at level 5" — $145,000 — Pending Review — Cost code 15
CO-004: "Added fire-rated partition at stair B" — $38,000 — Approved — Cost code 21
CO-005: "Generator relocation" — $92,000 — Draft — Cost code 16
```

Approved COs should have already updated the budget (from Phase 2's logic).

### Punch Items (25)
Mix of: 8 open, 5 in-progress, 7 sub-complete (awaiting verification), 5 closed
Locations: "Level 3 — Unit 301", "Lobby", "Parking Level B1", "Roof", "Level 8 — Penthouse"
Trades: Concrete, Finishes, Electrical, Mechanical, Elevator

### Daily Logs (30 days)
Last 30 calendar days. Each log should have:
- Weather (realistic SF weather: 58-68°F, mix of clear/cloudy/fog)
- Workforce: 45-80 workers per day, varying by trade
- At least 3 activity entries per day
- Status: most submitted+approved, last 2-3 days in draft

### Pay Applications (3)
```
PA-001: Period ending 2026-01-31 — $4,200,000 — Approved + Paid
PA-002: Period ending 2026-02-28 — $3,850,000 — Approved — Pending payment
PA-003: Period ending 2026-03-31 — $4,100,000 — Submitted — Pending approval
```

Each should have line items against contract SOV.

### Time Entries (for WH-347 demo)
2 weeks of time entries for 8 workforce members across 4 trades. Realistic hours (8-10/day, some overtime on Saturdays).

### Entity Links
Wire cross-references:
- CO-001 linked to RFI-001 (footing depth)
- CO-003 linked to RFI-005 (MEP conflict)
- SUB-001 linked to RFI-008 (concrete mix)
- Several punch items linked to relevant submittals

### Verify
Run the seed: `psql $DATABASE_URL < supabase/seed/parkview-tower.sql`
- Dashboard should show project metrics immediately
- Budget page should show one division red (Concrete 108%), one green (Electrical 72%)
- RFI list should show mix of statuses with overdue items highlighted
- Change orders should show budget impact
- Punch list should have items in all states

---

## Task 2: Demo Reset Capability

### Problem
After a demo, the data gets messy. Need one-click reset.

### Solution
Add a "Reset Demo Project" button in the Settings page.

Create a Supabase Edge Function `supabase/functions/reset-demo/index.ts`:
```typescript
serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const projectId = '00000000-0000-0000-0000-000000000001';
  
  // Delete all data for demo project (cascade handles FKs)
  await supabase.from('entity_links').delete().eq('project_id', projectId);
  await supabase.from('punch_items').delete().eq('project_id', projectId);
  await supabase.from('daily_log_entries').delete().eq('project_id', projectId);
  // ... delete all entity tables for this project ...
  await supabase.from('projects').delete().eq('id', projectId);
  
  // Re-run seed
  // (Execute the seed SQL or call each insert)
  
  return new Response(JSON.stringify({ success: true }));
});
```

In Settings page, add:
```tsx
<Btn variant="secondary" onClick={async () => {
  if (!confirm('Reset demo project? All changes will be lost.')) return;
  const { error } = await supabase.functions.invoke('reset-demo');
  if (error) toast.error('Reset failed');
  else { toast.success('Demo project reset'); queryClient.invalidateQueries(); }
}}>
  Reset Demo Project
</Btn>
```

### Verify
- Make changes to demo project (create an RFI, approve a CO)
- Click "Reset Demo Project"
- All data returns to original seed state
