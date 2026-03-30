// Test data factories for all entity types
// Usage: rfiFactory.build(), rfiFactory.buildList(5), rfiFactory.build({ status: 'closed' })

let counter = 0
const nextId = () => `test-${++counter}-${Date.now()}`

export const rfiFactory = {
  build: (overrides?: Record<string, unknown>) => ({
    id: nextId(),
    project_id: 'test-project-id',
    number: 1,
    title: 'Test RFI: Structural connection detail',
    description: 'Clarification needed on the connection detail at grid B3',
    status: 'open',
    priority: 'medium',
    created_by: 'test-user-id',
    assigned_to: null,
    ball_in_court: null,
    drawing_reference: null,
    due_date: null,
    closed_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
  buildList: (count: number, overrides?: Record<string, unknown>) =>
    Array.from({ length: count }, (_, i) =>
      rfiFactory.build({ number: i + 1, title: `Test RFI ${i + 1}`, ...overrides })
    ),
}

export const taskFactory = {
  build: (overrides?: Record<string, unknown>) => ({
    id: nextId(),
    project_id: 'test-project-id',
    title: 'Test Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigned_to: null,
    due_date: null,
    is_critical_path: false,
    sort_order: 0,
    parent_task_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
  buildList: (count: number, overrides?: Record<string, unknown>) =>
    Array.from({ length: count }, (_, i) =>
      taskFactory.build({ title: `Task ${i + 1}`, sort_order: i, ...overrides })
    ),
}

export const punchItemFactory = {
  build: (overrides?: Record<string, unknown>) => ({
    id: nextId(),
    project_id: 'test-project-id',
    number: 1,
    title: 'Test Punch Item',
    description: '',
    location: 'Floor 3',
    floor: '3',
    area: 'Apartment 301',
    trade: 'Electrical',
    priority: 'medium',
    status: 'open',
    assigned_to: null,
    reported_by: 'test-user-id',
    due_date: null,
    photos: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
}

export const budgetItemFactory = {
  build: (overrides?: Record<string, unknown>) => ({
    id: nextId(),
    project_id: 'test-project-id',
    division: '03 Concrete',
    description: 'Concrete work',
    original_amount: 500000,
    committed_amount: 480000,
    actual_amount: 350000,
    forecast_amount: 490000,
    percent_complete: 70,
    status: 'on_track',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
  buildList: (count: number) => {
    const divisions = ['03 Concrete', '05 Metals', '09 Finishes', '22 Plumbing', '23 HVAC', '26 Electrical']
    return Array.from({ length: count }, (_, i) =>
      budgetItemFactory.build({ division: divisions[i % divisions.length], original_amount: 100000 * (i + 1) })
    )
  },
}

export const projectFactory = {
  build: (overrides?: Record<string, unknown>) => ({
    id: 'test-project-id',
    name: 'Test Project',
    address: '123 Construction Ave',
    city: 'Dallas',
    state: 'TX',
    status: 'active',
    contract_value: 52000000,
    start_date: '2024-01-15',
    target_completion: '2027-03-31',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
}
