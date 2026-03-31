# Phase 0A — Eliminate All Mock Data from SiteSync AI

## Pre-Requisite
Paste `00_SYSTEM_CONTEXT.md` before executing this prompt.

## Objective
Remove ALL hardcoded mock arrays, fake person names, placeholder text, and simulated data from the SiteSync AI codebase. Replace with either React Query hooks that fetch from Supabase OR EmptyState components when data is unavailable. Zero mock data will remain.

## Why This Matters
Mock data is a production blocker. It masks missing APIs, hides data flow issues, and prevents real field testing. The codebase must be audit-ready: every single hardcoded array, fake name, and placeholder value must be eliminated. Pages should show intelligent empty states, loading skeletons, and error handlers instead of fake data.

---

## Step 1: src/pages/Lookahead.tsx — Remove hardcoded crews and initialTasks arrays

**File Path:** `src/pages/Lookahead.tsx`

**What to Delete:**
- Lines 26–27: `const crews = ['Steel Crew A', 'MEP Crew B', 'Concrete Crew C', 'Framing Crew D', 'Finishing Crew E', 'Safety Crew F']`
- Lines 28–41: `const initialTasks = [...]` (entire 12-item mock LookaheadTask array)

**Before Code:**
```typescript
const crews = ['Steel Crew A', 'MEP Crew B', 'Concrete Crew C', 'Framing Crew D', 'Finishing Crew E', 'Safety Crew F'];

const initialTasks: LookaheadTask[] = [
  { id: 1, taskName: 'Foundation Prep', crew: 'Concrete Crew C', startDate: '2026-04-01', endDate: '2026-04-10', status: 'in-progress', constraints: [] },
  { id: 2, taskName: 'Steel Erection', crew: 'Steel Crew A', startDate: '2026-04-08', endDate: '2026-04-25', status: 'scheduled', constraints: ['Foundation Prep'] },
  // ... 10 more items
];
```

**After Code:**
Replace the two lines above with:

```typescript
// Fetch crews from API
const { data: crews = [], isLoading: crewsLoading } = useCrews(projectId);

// Fetch lookahead tasks from API
const { data: lookaheadTasks = [], isLoading: tasksLoading, error: tasksError, refetch } = useLookaheadTasks(projectId);

// State for creating new task
const [isCreating, setIsCreating] = useState(false);
```

**What This Does:**
- Removes hardcoded crew names array
- Removes 12 mock task objects
- Introduces two React Query hooks: `useCrews()` and `useLookaheadTasks()`
- Prepares state for creating tasks

---

## Step 2: src/pages/Lookahead.tsx — Add loading, error, and empty states in the component render

**File Path:** `src/pages/Lookahead.tsx`

**Location:** Inside the Lookahead functional component, at the start of the JSX return (before any table or list rendering)

**Before Code:**
```typescript
return (
  <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
    <h1>Lookahead Schedule</h1>
    {/* Renders initialTasks directly without checking state */}
  </div>
);
```

**After Code:**
```typescript
// Show loading skeleton
if (crewsLoading || tasksLoading) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Lookahead Schedule</h1>
      <Skeleton lines={8} />
    </div>
  );
}

// Show error state
if (tasksError) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Lookahead Schedule</h1>
      <ErrorState
        icon="AlertTriangle"
        title="Failed to load lookahead"
        message={tasksError.message || 'Unable to fetch schedule data'}
        actionLabel="Try Again"
        onAction={refetch}
      />
    </div>
  );
}

// Show empty state
if (!lookaheadTasks.length) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Lookahead Schedule</h1>
      <EmptyState
        icon="Calendar"
        title="No tasks planned"
        description="Start planning by creating the first lookahead task or importing from your schedule."
        actionLabel="Create Task"
        onAction={() => setIsCreating(true)}
      />
    </div>
  );
}

// Render actual data
return (
  <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
    <h1>Lookahead Schedule</h1>
    {/* Use lookaheadTasks and crews instead of initialTasks and crews */}
  </div>
);
```

**Update All References:**
- Replace `initialTasks` with `lookaheadTasks` throughout the component
- Replace hardcoded `crews` array references with the fetched `crews` variable

---

## Step 3: src/pages/PunchList.tsx — Remove expandedPunchList array and fake names

**File Path:** `src/pages/PunchList.tsx`

**What to Delete:**
- Lines 113–140: `const expandedPunchList: PunchItem[] = [...]` (entire 15-item mock array with fake names: Mike Torres, David Lee, James Wilson, Sarah Johnson, Maria Garcia, Karen Williams, Tom Anderson, Robert Chen, John Smith)

**Before Code:**
```typescript
const expandedPunchList: PunchItem[] = [
  { id: 6, title: 'Loose drywall corner', area: 'Unit 201', assignedTo: 'Mike Torres', dueDate: '2026-04-15', priority: 'high', status: 'open' },
  { id: 7, title: 'Paint touch-up needed', area: 'Stairwell', assignedTo: 'David Lee', dueDate: '2026-04-18', priority: 'medium', status: 'in-progress' },
  // ... 13 more items with fake names
];
```

**After Code:**
```typescript
// Fetch punch list items from API
const { data: punchListItems = [], isLoading, error, refetch } = usePunchList(projectId);

// Fetch team members for assignment
const { data: teamMembers = [] } = useTeamMembers(projectId);

// State for filter and new item creation
const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in-progress' | 'closed'>('all');
const [isCreating, setIsCreating] = useState(false);
```

**Update Filtering Logic:**
- Replace any filtering logic that used `expandedPunchList` to use `punchListItems` instead
- Example: `const filtered = punchListItems.filter(item => filterStatus === 'all' || item.status === filterStatus);`

---

## Step 4: src/pages/PunchList.tsx — Add loading, error, and empty states

**File Path:** `src/pages/PunchList.tsx`

**Location:** Inside the PunchList functional component, at the start of JSX return

**After Code:**
```typescript
// Show loading skeleton
if (isLoading) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Punch List</h1>
      <Skeleton lines={10} />
    </div>
  );
}

// Show error state
if (error) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Punch List</h1>
      <ErrorState
        icon="AlertTriangle"
        title="Failed to load punch list"
        message={error.message || 'Unable to fetch punch items'}
        actionLabel="Try Again"
        onAction={refetch}
      />
    </div>
  );
}

// Show empty state
if (!punchListItems.length) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Punch List</h1>
      <EmptyState
        icon="CheckCircle"
        title="No punch items yet"
        description="All work items are complete, or create the first punch item to track outstanding work."
        actionLabel="Add Punch Item"
        onAction={() => setIsCreating(true)}
      />
    </div>
  );
}

// Render actual data
return (
  <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
    {/* Table/list rendering using punchListItems */}
  </div>
);
```

---

## Step 5: src/pages/DailyLog.tsx — Remove crewHours and photos arrays

**File Path:** `src/pages/DailyLog.tsx`

**What to Delete:**
- Lines 57–65: `const crewHours: CrewHoursEntry[] = [...]` (7 mock entries with trades, worker counts, hours)
- Lines 68–75: `const photos: DailyLogPhoto[] = [...]` (6 mock photo entries with captions)

**Before Code:**
```typescript
const crewHours: CrewHoursEntry[] = [
  { trade: 'Concrete', workerCount: 12, hoursWorked: 8, productivity: 'high' },
  { trade: 'Framing', workerCount: 8, hoursWorked: 8, productivity: 'medium' },
  // ... 5 more
];

const photos: DailyLogPhoto[] = [
  { id: 1, url: '/photo1.jpg', caption: 'Concrete pour complete', timestamp: '2026-03-31T10:30:00Z' },
  // ... 5 more
];
```

**After Code:**
```typescript
// Fetch daily log entries for today
const today = new Date().toISOString().split('T')[0];
const { data: crewHours = [], isLoading: hoursLoading } = useCrewHours(projectId, today);
const { data: logPhotos = [], isLoading: photosLoading } = useDailyLogPhotos(projectId, today);
const { error: logError, refetch } = useDailyLog(projectId, today);

// State for new entry creation
const [isAddingEntry, setIsAddingEntry] = useState(false);
const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
```

---

## Step 6: src/pages/DailyLog.tsx — Add loading, error, and empty states

**File Path:** `src/pages/DailyLog.tsx`

**Location:** Inside the DailyLog functional component, at the start of JSX return

**After Code:**
```typescript
// Show loading skeleton
if (hoursLoading || photosLoading) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Daily Log</h1>
      <Skeleton lines={6} />
    </div>
  );
}

// Show error state
if (logError) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Daily Log</h1>
      <ErrorState
        icon="AlertTriangle"
        title="Failed to load daily log"
        message={logError.message || 'Unable to fetch today log entries'}
        actionLabel="Try Again"
        onAction={refetch}
      />
    </div>
  );
}

// Show empty state (no crew hours or photos)
if (!crewHours.length && !logPhotos.length) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Daily Log</h1>
      <EmptyState
        icon="BookOpen"
        title="No log entries for today"
        description="Log crew hours and photos to document project progress."
        actionLabel="Add Entry"
        onAction={() => setIsAddingEntry(true)}
      />
    </div>
  );
}

// Render actual data
return (
  <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
    {/* Table/grid rendering using crewHours and logPhotos */}
  </div>
);
```

---

## Step 7: src/pages/RFIs.tsx — Remove commentCounts, drawingRefs, and ballInCourt records

**File Path:** `src/pages/RFIs.tsx`

**What to Delete:**
- Line 39: `const commentCounts: Record<string, number> = { ... }` (hardcoded comment counts)
- Line 41: `const drawingRefs: Record<string, string> = { ... }` (drawing reference codes)
- Lines 43–51: `const ballInCourt: Record<string, { name: string; avatar: string }> = { ... }` (fake names: Jennifer Lee, Robert Anderson, David Kumar)

**Before Code:**
```typescript
const commentCounts: Record<string, number> = {
  'RFI-001': 5,
  'RFI-002': 3,
  // ...
};

const drawingRefs: Record<string, string> = {
  'RFI-001': 'A2.3',
  'RFI-002': 'S1.2',
  // ...
};

const ballInCourt: Record<string, { name: string; avatar: string }> = {
  'RFI-001': { name: 'Jennifer Lee', avatar: 'jl' },
  'RFI-002': { name: 'Robert Anderson', avatar: 'ra' },
  'RFI-003': { name: 'David Kumar', avatar: 'dk' },
  // ...
};
```

**After Code:**
```typescript
// Fetch RFI data from API (includes comment counts, drawing refs, ball in court)
const { data: rfis = [], isLoading, error, refetch } = useRFIs(projectId);

// State for filtering and new RFI creation
const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'pending' | 'closed'>('all');
const [isCreating, setIsCreating] = useState(false);
```

**Update All References:**
- Replace `commentCounts[rfiId]` with `rfis.find(r => r.id === rfiId)?.commentCount || 0`
- Replace `drawingRefs[rfiId]` with `rfis.find(r => r.id === rfiId)?.drawingReference || ''`
- Replace `ballInCourt[rfiId]` with `rfis.find(r => r.id === rfiId)?.assignedTo` (backend returns full person object)

---

## Step 8: src/pages/RFIs.tsx — Add loading, error, and empty states

**File Path:** `src/pages/RFIs.tsx`

**Location:** Inside the RFIs functional component, at the start of JSX return

**After Code:**
```typescript
// Show loading skeleton
if (isLoading) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Requests for Information</h1>
      <Skeleton lines={8} />
    </div>
  );
}

// Show error state
if (error) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Requests for Information</h1>
      <ErrorState
        icon="AlertTriangle"
        title="Failed to load RFIs"
        message={error.message || 'Unable to fetch request data'}
        actionLabel="Try Again"
        onAction={refetch}
      />
    </div>
  );
}

// Show empty state
if (!rfis.length) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Requests for Information</h1>
      <EmptyState
        icon="HelpCircle"
        title="No RFIs yet"
        description="Submit an RFI to get clarification or approvals from design team or GC."
        actionLabel="Submit RFI"
        onAction={() => setIsCreating(true)}
      />
    </div>
  );
}

// Render actual data
return (
  <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
    {/* List/table rendering using rfis */}
  </div>
);
```

---

## Step 9: src/pages/Submittals.tsx — Remove reviewTimelines, specSections, reviewCycles, leadTimes records

**File Path:** `src/pages/Submittals.tsx`

**What to Delete:**
- Lines 35–56: `const reviewTimelines: Record<string, ReviewProcess[]> = { ... }` (hardcoded review processes with dates and companies)
- Lines 59–64: `const specSections: Record<string, string> = { ... }` (specification sections)
- Line 66: `const reviewCycles: Record<string, number> = { ... }` (cycle counts)
- Lines 68–70: `const leadTimes: Record<string, number> = { ... }` (lead time days)

**Before Code:**
```typescript
const reviewTimelines: Record<string, ReviewProcess[]> = {
  'SUB-001': [
    { step: 'Contractor Review', completedDate: '2026-03-28', company: 'BuildCorp' },
    { step: 'Architect Review', completedDate: '2026-03-29', company: 'ArchDesign' },
  ],
  // ...
};

const specSections: Record<string, string> = {
  'SUB-001': '03 30 00',
  'SUB-002': '05 12 00',
  // ...
};

const reviewCycles: Record<string, number> = {
  'SUB-001': 2,
  'SUB-002': 1,
  // ...
};

const leadTimes: Record<string, number> = {
  'SUB-001': 14,
  'SUB-002': 7,
  // ...
};
```

**After Code:**
```typescript
// Fetch submittal data from API (includes review timeline, spec section, cycles, lead times)
const { data: submittals = [], isLoading, error, refetch } = useSubmittals(projectId);

// State for filtering and new submittal creation
const [filterStatus, setFilterStatus] = useState<'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected'>('submitted');
const [isCreating, setIsCreating] = useState(false);
```

**Update All References:**
- Replace `reviewTimelines[submittalId]` with `submittals.find(s => s.id === submittalId)?.reviewHistory || []`
- Replace `specSections[submittalId]` with `submittals.find(s => s.id === submittalId)?.specSection || ''`
- Replace `reviewCycles[submittalId]` with `submittals.find(s => s.id === submittalId)?.reviewCycleCount || 0`
- Replace `leadTimes[submittalId]` with `submittals.find(s => s.id === submittalId)?.leadTimeDays || 0`

---

## Step 10: src/pages/Submittals.tsx — Add loading, error, and empty states

**File Path:** `src/pages/Submittals.tsx`

**Location:** Inside the Submittals functional component, at the start of JSX return

**After Code:**
```typescript
// Show loading skeleton
if (isLoading) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Submittals</h1>
      <Skeleton lines={8} />
    </div>
  );
}

// Show error state
if (error) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Submittals</h1>
      <ErrorState
        icon="AlertTriangle"
        title="Failed to load submittals"
        message={error.message || 'Unable to fetch submittal data'}
        actionLabel="Try Again"
        onAction={refetch}
      />
    </div>
  );
}

// Show empty state
if (!submittals.length) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Submittals</h1>
      <EmptyState
        icon="FileCheck"
        title="No submittals yet"
        description="Create a submittal for materials, equipment, or methods requiring approval."
        actionLabel="Create Submittal"
        onAction={() => setIsCreating(true)}
      />
    </div>
  );
}

// Render actual data
return (
  <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
    {/* List/table rendering using submittals */}
  </div>
);
```

---

## Step 11: src/pages/Tasks.tsx — Remove assigneeMap record

**File Path:** `src/pages/Tasks.tsx`

**What to Delete:**
- Lines 54–61: `const assigneeMap: Record<string, string> = { ... }` (hardcoded assignees with fake names: Mike Patterson, Jennifer Lee, etc.)

**Before Code:**
```typescript
const assigneeMap: Record<string, string> = {
  'TASK-001': 'Mike Patterson',
  'TASK-002': 'Jennifer Lee',
  'TASK-003': 'Robert Kim',
  'TASK-004': 'Sarah Martinez',
  'TASK-005': 'David Chang',
  'TASK-006': 'Lisa Anderson',
};
```

**After Code:**
```typescript
// Fetch tasks from API (includes assignee information)
const { data: tasks = [], isLoading, error, refetch } = useTasks(projectId);

// Fetch team members for task assignment
const { data: teamMembers = [] } = useTeamMembers(projectId);

// State for filtering and new task creation
const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in-progress' | 'completed'>('all');
const [isCreating, setIsCreating] = useState(false);
```

**Update All References:**
- Replace `assigneeMap[taskId]` with `tasks.find(t => t.id === taskId)?.assignedTo?.name || 'Unassigned'`
- Ensure the Task type includes an `assignedTo` field with at least `{ id, name, avatar }` structure

---

## Step 12: src/pages/Tasks.tsx — Add loading, error, and empty states

**File Path:** `src/pages/Tasks.tsx`

**Location:** Inside the Tasks functional component, at the start of JSX return

**After Code:**
```typescript
// Show loading skeleton
if (isLoading) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Tasks</h1>
      <Skeleton lines={8} />
    </div>
  );
}

// Show error state
if (error) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Tasks</h1>
      <ErrorState
        icon="AlertTriangle"
        title="Failed to load tasks"
        message={error.message || 'Unable to fetch task data'}
        actionLabel="Try Again"
        onAction={refetch}
      />
    </div>
  );
}

// Show empty state
if (!tasks.length) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Tasks</h1>
      <EmptyState
        icon="ListTodo"
        title="No tasks assigned"
        description="Create a task to assign work and track progress."
        actionLabel="Create Task"
        onAction={() => setIsCreating(true)}
      />
    </div>
  );
}

// Render actual data
return (
  <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
    {/* List/table rendering using tasks */}
  </div>
);
```

---

## Step 13: src/pages/Crews.tsx — Remove crewColors, crewPositions, certifications, crewTaskOverrides, crewForemen, crewCerts records

**File Path:** `src/pages/Crews.tsx`

**What to Delete:**
- Lines 11–27: `const crewColors: Record<string, string> = { ... }` (hardcoded crew color assignments)
- Lines 20–27: `const crewPositions: Record<string, { x: number; y: number }> = { ... }` (x,y coordinates for crew dots)
- Lines 29–35: `const certifications: CertificationRecord[] = [...]` (5 mock certification objects)
- Lines 37–44: `const crewTaskOverrides: Record<string, string[]> = { ... }` (task assignments)
- Lines 46–53: `const crewForemen: Record<string, string> = { ... }` (fake names)
- Lines 55–62: `const crewCerts: Record<string, string[]> = { ... }` (certification mappings)

**Before Code:**
```typescript
const crewColors: Record<string, string> = {
  'Steel Crew A': '#FF6B6B',
  'MEP Crew B': '#4ECDC4',
  // ...
};

const crewPositions: Record<string, { x: number; y: number }> = {
  'Steel Crew A': { x: 150, y: 200 },
  'MEP Crew B': { x: 300, y: 250 },
  // ...
};

const certifications: CertificationRecord[] = [
  { id: 1, name: 'OSHA 30', category: 'Safety', expiryDate: '2027-06-15' },
  // ... 4 more
];

const crewTaskOverrides: Record<string, string[]> = {
  'Steel Crew A': ['TASK-001', 'TASK-002'],
  // ...
};

const crewForemen: Record<string, string> = {
  'Steel Crew A': 'Mike Patterson',
  'MEP Crew B': 'Jennifer Lee',
  // ...
};

const crewCerts: Record<string, string[]> = {
  'Steel Crew A': ['OSHA-30', 'First-Aid'],
  // ...
};
```

**After Code:**
```typescript
// Fetch crew data from API (includes color, position, certifications, tasks, foreman, certs)
const { data: crews = [], isLoading, error, refetch } = useCrews(projectId);

// Fetch all available certifications
const { data: availableCertifications = [] } = useCertifications();

// State for filtering and crew creation
const [selectedCrew, setSelectedCrew] = useState<string | null>(null);
const [isCreating, setIsCreating] = useState(false);
```

**Update All References:**
- Replace `crewColors[crewName]` with `crews.find(c => c.name === crewName)?.color || '#999999'`
- Replace `crewPositions[crewName]` with `crews.find(c => c.name === crewName)?.mapPosition || { x: 0, y: 0 }`
- Replace `certifications` array with `availableCertifications`
- Replace `crewTaskOverrides[crewName]` with `crews.find(c => c.name === crewName)?.assignedTasks || []`
- Replace `crewForemen[crewName]` with `crews.find(c => c.name === crewName)?.foreman?.name || 'Unassigned'`
- Replace `crewCerts[crewName]` with `crews.find(c => c.name === crewName)?.certifications || []`

---

## Step 14: src/pages/Crews.tsx — Add loading, error, and empty states

**File Path:** `src/pages/Crews.tsx`

**Location:** Inside the Crews functional component, at the start of JSX return

**After Code:**
```typescript
// Show loading skeleton
if (isLoading) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Crews</h1>
      <Skeleton lines={6} />
    </div>
  );
}

// Show error state
if (error) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Crews</h1>
      <ErrorState
        icon="AlertTriangle"
        title="Failed to load crews"
        message={error.message || 'Unable to fetch crew data'}
        actionLabel="Try Again"
        onAction={refetch}
      />
    </div>
  );
}

// Show empty state
if (!crews.length) {
  return (
    <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
      <h1>Crews</h1>
      <EmptyState
        icon="Users"
        title="No crews set up"
        description="Create crews to organize workers by trade and track productivity."
        actionLabel="Create Crew"
        onAction={() => setIsCreating(true)}
      />
    </div>
  );
}

// Render actual data
return (
  <div style={{ padding: '24px', backgroundColor: theme.colors.light_bg }}>
    {/* Grid/map rendering using crews */}
  </div>
);
```

---

## Step 15: src/components/activity/MentionInput.tsx — Remove people array

**File Path:** `src/components/activity/MentionInput.tsx`

**What to Delete:**
- Lines 12–20: `const people: Person[] = [...]` (7 mock person objects with fake names: Mike Patterson, Jennifer Lee, etc.)

**Before Code:**
```typescript
const people: Person[] = [
  { id: '1', name: 'Mike Patterson', avatar: 'mp', email: 'mike@company.com' },
  { id: '2', name: 'Jennifer Lee', avatar: 'jl', email: 'jennifer@company.com' },
  { id: '3', name: 'Robert Kim', avatar: 'rk', email: 'robert@company.com' },
  { id: '4', name: 'Sarah Martinez', avatar: 'sm', email: 'sarah@company.com' },
  { id: '5', name: 'David Chang', avatar: 'dc', email: 'david@company.com' },
  { id: '6', name: 'Lisa Anderson', avatar: 'la', email: 'lisa@company.com' },
  { id: '7', name: 'Tom Wilson', avatar: 'tw', email: 'tom@company.com' },
];
```

**After Code:**
```typescript
// Fetch team members from API for mentions
const { data: people = [], isLoading } = useTeamMembers(projectId);
```

**Update Component Logic:**
- The MentionInput component should use the `people` variable as it currently does
- The component will now receive real team members instead of mock data
- No changes needed to the mention filtering/rendering logic itself

---

## Step 16: src/components/dashboard/widgets/RiskHeatmapWidget.tsx — Remove risks array

**File Path:** `src/components/dashboard/widgets/RiskHeatmapWidget.tsx`

**What to Delete:**
- Lines 16–24: `const risks: Risk[] = [...]` (7 mock risk objects with fake names, titles, scores)

**Before Code:**
```typescript
const risks: Risk[] = [
  { id: 'R-001', title: 'Schedule Delay', assignedTo: 'Mike Patterson', likelihood: 'high', impact: 'high', score: 9 },
  { id: 'R-002', title: 'Budget Overrun', assignedTo: 'Jennifer Lee', likelihood: 'medium', impact: 'high', score: 6 },
  { id: 'R-003', title: 'Material Shortage', assignedTo: 'Robert Kim', likelihood: 'medium', impact: 'medium', score: 4 },
  // ... 4 more
];
```

**After Code:**
```typescript
// Fetch project risks from API
const { data: risks = [], isLoading } = useProjectRisks(projectId);
```

**Update Widget Rendering:**
- The widget should display loading state if `isLoading` is true
- Display empty state if `risks.length === 0`
- Render heatmap using the fetched `risks` data

**Add to Component:**
```typescript
if (isLoading) {
  return <Skeleton lines={4} />;
}

if (!risks.length) {
  return (
    <div style={{ textAlign: 'center', padding: '20px', color: theme.colors.text_secondary }}>
      <p>No risks identified</p>
    </div>
  );
}

// Render heatmap with risks data
```

---

## Step 17: src/components/files/FilePreview.tsx — Remove versionHistory array

**File Path:** `src/components/files/FilePreview.tsx`

**What to Delete:**
- Lines 21–25: `const versionHistory: Version[] = [...]` (3 mock version objects with fake dates and authors)

**Before Code:**
```typescript
const versionHistory: Version[] = [
  { id: '3', version: 'v1.3', uploadedBy: 'Jennifer Lee', date: '2026-03-29', fileSize: '2.4 MB' },
  { id: '2', version: 'v1.2', uploadedBy: 'Mike Patterson', date: '2026-03-27', fileSize: '2.2 MB' },
  { id: '1', version: 'v1.1', uploadedBy: 'Sarah Martinez', date: '2026-03-25', fileSize: '2.1 MB' },
];
```

**After Code:**
```typescript
// Fetch file version history from API
const { data: versionHistory = [], isLoading } = useFileVersions(fileId);
```

**Update Component Logic:**
- Add loading state check: `if (isLoading) return <Skeleton lines={3} />;`
- Add empty state: if `versionHistory.length === 0`, show message "No version history"
- Render version list using the fetched `versionHistory` data

---

## Step 18: src/machines/closeoutMachine.ts — Move template constants to separate file

**File Path:** `src/machines/closeoutMachine.ts`

**Important Note:**
Lines 131–193 contain `BASE_CLOSEOUT_ITEMS` which is TEMPLATE data, NOT mock data. This is legitimate reference content (HVAC O&M Manual, Electrical O&M Manual, etc.) that should be preserved but organized separately.

**What to Do:**
1. Create a new file: `src/constants/closeoutTemplates.ts`
2. Move the entire `BASE_CLOSEOUT_ITEMS` array to this new file
3. Export it from the constants file
4. Import it back into `closeoutMachine.ts`

**Example Structure:**

In `src/constants/closeoutTemplates.ts`:
```typescript
export const BASE_CLOSEOUT_ITEMS = [
  {
    id: 'hvac-om',
    category: 'Mechanical',
    title: 'HVAC O&M Manual',
    description: 'Operating and maintenance manual for HVAC systems',
    responsible: 'MEP Contractor',
  },
  // ... rest of items
];
```

In `src/machines/closeoutMachine.ts`:
```typescript
import { BASE_CLOSEOUT_ITEMS } from '../constants/closeoutTemplates';

// Rest of machine definition remains unchanged
```

**Verification:**
- The template data is preserved and properly organized
- No hardcoded closures or test data remains
- The machine can still access the template items
- Everything builds and functions as before

---

## Step 19: Verify Zero Mock Data — Grep Commands

**File Path:** Root of repository

**Run these commands to verify NO mock data remains:**

```bash
# Search for any remaining hardcoded arrays with typical mock patterns
grep -r "const \(crews\|initialTasks\|expandedPunchList\|crewHours\|photos\|commentCounts\|drawingRefs\|ballInCourt\|reviewTimelines\|specSections\|reviewCycles\|leadTimes\|assigneeMap\|crewColors\|crewPositions\|certifications\|crewTaskOverrides\|crewForemen\|crewCerts\|people\|risks\|versionHistory\)" src/ --include="*.tsx" --include="*.ts"

# Search for any remaining fake person names (case-insensitive)
grep -ri "\(Mike Patterson\|Jennifer Lee\|Robert Kim\|Sarah Martinez\|David Chang\|Lisa Anderson\|Tom Wilson\|Mike Torres\|David Lee\|James Wilson\|Sarah Johnson\|Maria Garcia\|Karen Williams\|Tom Anderson\|Robert Chen\|John Smith\|Jennifer Lee\|Robert Anderson\|David Kumar\)" src/ --include="*.tsx" --include="*.ts"

# Search for fake crew names
grep -r "\(Steel Crew\|MEP Crew\|Concrete Crew\|Framing Crew\|Finishing Crew\|Safety Crew\)" src/ --include="*.tsx" --include="*.ts"

# Verify no remaining Record<string, ...> hardcoded lookups for data
grep -r "Record<string, \(string\|number\|boolean\|{.*}\)>" src/ --include="*.tsx" --include="*.ts" | grep -v "type " | grep -v "interface " | grep -v "//"
```

**Expected Output:**
- Zero matches for hardcoded arrays
- Zero matches for fake person names
- Zero matches for crew names
- Only type definitions should match the Record pattern (those with "type " or "interface " prefix)

---

## Step 20: Build and Test Verification

**Run these commands to verify everything builds and functions:**

```bash
# Install dependencies (if needed)
npm install

# Run linter to catch any remaining issues
npm run lint

# Build the project
npm run build

# Run dev server and manually verify:
# - All pages show loading skeleton while data loads
# - Pages show empty states when no data is available
# - Error states display correctly when API calls fail
npm run dev
```

**Manual Testing Checklist:**
- [ ] Navigate to Dashboard — should show loading state then empty/real data
- [ ] Navigate to Lookahead — should show loading state, then empty state with "Create Task" button
- [ ] Navigate to Punch List — should show loading state, then empty state with "Add Punch Item" button
- [ ] Navigate to Daily Log — should show loading state, then empty state with "Add Entry" button
- [ ] Navigate to RFIs — should show loading state, then empty state with "Submit RFI" button
- [ ] Navigate to Submittals — should show loading state, then empty state with "Create Submittal" button
- [ ] Navigate to Tasks — should show loading state, then empty state with "Create Task" button
- [ ] Navigate to Crews — should show loading state, then empty state with "Create Crew" button
- [ ] Search console for any errors related to missing data — should be clean
- [ ] All navigation and UI interactions work without breaking

---

## Acceptance Criteria

- [ ] **ZERO hardcoded arrays** — No `const crews = [...]`, `const tasks = [...]`, `const risks = [...]`, etc. remain in codebase
- [ ] **ZERO fake person names** — No Mike Patterson, Jennifer Lee, Robert Kim, Sarah Martinez, David Chang, Lisa Anderson, Tom Wilson, Mike Torres, David Lee, James Wilson, Sarah Johnson, Maria Garcia, Karen Williams, Tom Anderson, Robert Chen, John Smith, Robert Anderson, David Kumar remain anywhere
- [ ] **ZERO fake crew names** — No "Steel Crew A", "MEP Crew B", "Concrete Crew C", etc. remain
- [ ] **ZERO mock data lookups** — No `commentCounts[rfiId]`, `ballInCourt[id]`, `assigneeMap[taskId]` remain as hardcoded records
- [ ] **Every page shows loading skeleton** — While data fetches, pages display `<Skeleton />` component
- [ ] **Every page shows error state** — When API call fails, pages display `<ErrorState />` with retry button
- [ ] **Every page shows empty state** — When no data available, pages display `<EmptyState />` with action CTA
- [ ] **Template data preserved** — `BASE_CLOSEOUT_ITEMS` moved to `src/constants/closeoutTemplates.ts` and still accessible
- [ ] **`npm run lint` passes** — No linter errors or warnings
- [ ] **`npm run build` succeeds** — Production build completes without errors
- [ ] **All features remain functional** — No regressions in UI/UX
- [ ] **Grep verification clean** — All verification grep commands return zero mock data matches

---

## Summary

After executing this prompt:
1. ALL mock data (arrays, fake names, hardcoded lookups) is ELIMINATED
2. EVERY page fetches real data via React Query hooks
3. EVERY page has proper loading/error/empty states
4. Template data (closeoutMachine) is organized but preserved
5. Zero hardcoded values remain in the codebase
6. The app is audit-ready and production-safe

The codebase moves from fake prototype to real data architecture in one clean sweep.
