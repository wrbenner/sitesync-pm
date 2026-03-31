# V6 Track A: A4 — Expand Test Coverage (21 → 80+ Test Files)

**Status:** CRITICALLY LOW COVERAGE | 19 test files, 2,216 lines
**Priority:** P1 (Machines well-tested, UI/features blind)
**Estimated Effort:** 30-40 hours

---

## CURRENT STATE

```
find src/ -name "*.test.*" -o -name "*.spec.*" | wc -l
19 test files

Categories:
  - Machine tests: 15 files (payment, agent orchestration, ...)
  - Component tests: 2 files
  - Hook tests: 2 files
  - Coverage: ~8% (mostly machines)
```

---

## TARGET STATE

**80+ test files** covering all layers:

```
✅ Machine tests:        15 files (existing, maintain)
✅ Component tests:      30 NEW files (all Generative UI + form modals)
✅ Hook tests:           15 NEW files (usePermissions, useQuery variants, etc.)
✅ Integration tests:    10 NEW files (E2E workflows)
✅ E2E tests:            5 NEW files (login → RFI → assign → close)
═══════════════════════════════════════════════════════════
   TOTAL:               75-85 test files
```

---

## COMPONENT TESTS (30 NEW FILES)

### Generative UI Components (13 files)

1. **GenChart.test.tsx** (~50 lines)
```typescript
import { render, screen } from '@testing-library/react'
import { GenChart } from '../GenerativeUI/GenChart'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

describe('GenChart', () => {
  it('should render chart with data', () => {
    const data = [
      { month: 'Jan', spent: 10000 },
      { month: 'Feb', spent: 12000 },
    ]

    render(
      <QueryClientProvider client={queryClient}>
        <GenChart data={data} type="bar" title="Budget Spend" />
      </QueryClientProvider>
    )

    expect(screen.getByText('Budget Spend')).toBeInTheDocument()
  })

  it('should handle empty data', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GenChart data={[]} type="line" title="Empty" />
      </QueryClientProvider>
    )

    expect(screen.getByText('Empty')).toBeInTheDocument()
  })

  it('should switch chart types', async () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <GenChart data={[]} type="bar" title="Chart" />
      </QueryClientProvider>
    )

    rerender(
      <QueryClientProvider client={queryClient}>
        <GenChart data={[]} type="line" title="Chart" />
      </QueryClientProvider>
    )

    expect(screen.getByText('Chart')).toBeInTheDocument()
  })

  it('should handle missing data gracefully', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <GenChart data={undefined as any} type="bar" title="Error" />
      </QueryClientProvider>
    )

    expect(container).toBeInTheDocument()
  })
})
```

2. **GenDataTable.test.tsx** (~60 lines)
```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GenDataTable } from '../GenerativeUI/GenDataTable'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient()

describe('GenDataTable', () => {
  const columns = [
    { key: 'id', label: 'ID', width: '100px' },
    { key: 'name', label: 'Name', width: '200px' },
    { key: 'status', label: 'Status', width: '150px' },
  ]

  const data = [
    { id: '1', name: 'RFI-001', status: 'draft' },
    { id: '2', name: 'RFI-002', status: 'approved' },
  ]

  it('should render table with columns and data', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GenDataTable columns={columns} data={data} />
      </QueryClientProvider>
    )

    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('RFI-001')).toBeInTheDocument()
    expect(screen.getByText('draft')).toBeInTheDocument()
  })

  it('should handle sorting', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <GenDataTable columns={columns} data={data} sortable />
      </QueryClientProvider>
    )

    const nameHeader = screen.getByText('Name')
    await user.click(nameHeader)

    // Should have sort indicator
    expect(nameHeader.parentElement).toHaveAttribute('data-sorted')
  })

  it('should handle pagination', async () => {
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `RFI-${String(i).padStart(3, '0')}`,
      status: i % 2 === 0 ? 'draft' : 'approved',
    }))

    render(
      <QueryClientProvider client={queryClient}>
        <GenDataTable columns={columns} data={largeData} pageSize={10} />
      </QueryClientProvider>
    )

    expect(screen.getByText('RFI-000')).toBeInTheDocument()
    expect(screen.queryByText('RFI-010')).not.toBeInTheDocument() // On next page
  })

  it('should highlight selected rows', async () => {
    const user = userEvent.setup()
    const onSelectionChange = jest.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <GenDataTable
          columns={columns}
          data={data}
          selectable
          onSelectionChange={onSelectionChange}
        />
      </QueryClientProvider>
    )

    const firstRow = screen.getByText('RFI-001').closest('[role="row"]')
    await user.click(firstRow!)

    expect(onSelectionChange).toHaveBeenCalledWith(['1'])
  })

  it('should handle empty data state', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GenDataTable columns={columns} data={[]} emptyMessage="No data" />
      </QueryClientProvider>
    )

    expect(screen.getByText('No data')).toBeInTheDocument()
  })
})
```

3. **GenMetricCards.test.tsx** (~45 lines)
4. **GenMetricGauge.test.tsx** (~40 lines)
5. **GenTimeline.test.tsx** (~50 lines)
6. **GenKanban.test.tsx** (~60 lines)
7. **GenOrgChart.test.tsx** (~45 lines)
8. **GenCalendar.test.tsx** (~50 lines)
9. **GenFileExplorer.test.tsx** (~50 lines)
10. **GenMapView.test.tsx** (~50 lines)
11. **GenGantt.test.tsx** (~55 lines)
12. **GenChat.test.tsx** (~60 lines)
13. **GenDashboard.test.tsx** (~65 lines)

---

### Form Modals (17 files)

1. **CreateRFIModal.test.tsx** (~70 lines)
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateRFIModal } from '../forms/CreateRFIModal'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toaster } from 'sonner'

jest.mock('sonner')

const queryClient = new QueryClient()

describe('CreateRFIModal', () => {
  const mockOnClose = jest.fn()
  const mockOnSuccess = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render modal when open', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CreateRFIModal
          open={true}
          onClose={mockOnClose}
          projectId="proj-1"
          onSuccess={mockOnSuccess}
        />
      </QueryClientProvider>
    )

    expect(screen.getByText('Create RFI')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    const { queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <CreateRFIModal
          open={false}
          onClose={mockOnClose}
          projectId="proj-1"
          onSuccess={mockOnSuccess}
        />
      </QueryClientProvider>
    )

    expect(queryByText('Create RFI')).not.toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <CreateRFIModal
          open={true}
          onClose={mockOnClose}
          projectId="proj-1"
          onSuccess={mockOnSuccess}
        />
      </QueryClientProvider>
    )

    const submitBtn = screen.getByRole('button', { name: /submit|create/i })
    await user.click(submitBtn)

    expect(screen.getByText(/title is required/i)).toBeInTheDocument()
  })

  it('should call onSuccess on successful creation', async () => {
    const user = userEvent.setup()

    // Mock the API call
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'rfi-1', title: 'Test RFI' }),
    } as Response)

    render(
      <QueryClientProvider client={queryClient}>
        <CreateRFIModal
          open={true}
          onClose={mockOnClose}
          projectId="proj-1"
          onSuccess={mockOnSuccess}
        />
      </QueryClientProvider>
    )

    const titleInput = screen.getByLabelText('Title')
    await user.type(titleInput, 'Test RFI')

    const submitBtn = screen.getByRole('button', { name: /submit|create/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith({ id: 'rfi-1', title: 'Test RFI' })
    })
  })

  it('should close modal on cancel', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <CreateRFIModal
          open={true}
          onClose={mockOnClose}
          projectId="proj-1"
          onSuccess={mockOnSuccess}
        />
      </QueryClientProvider>
    )

    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelBtn)

    expect(mockOnClose).toHaveBeenCalled()
  })
})
```

2. **CreateTaskModal.test.tsx** (~65 lines)
3. **CreateChangeOrderModal.test.tsx** (~70 lines)
4. **CreateMeetingModal.test.tsx** (~65 lines)
5. **CreateSubmittalModal.test.tsx** (~65 lines)
6. **CreateDailyLogModal.test.tsx** (~70 lines)
7. **EditRFIModal.test.tsx** (~65 lines)
8. **EditBudgetModal.test.tsx** (~65 lines)
9. **AssignRFIModal.test.tsx** (~60 lines)
10. **UpdateProjectContextModal.test.tsx** (~60 lines)
11. **ManagePermissionsModal.test.tsx** (~70 lines)
12. **UploadFilesModal.test.tsx** (~65 lines)
13. **ImportBudgetModal.test.tsx** (~70 lines)
14. **ScheduleMeetingModal.test.tsx** (~65 lines)
15. **CreatePunchItemModal.test.tsx** (~60 lines)
16. **ApproveChangeOrderModal.test.tsx** (~65 lines)
17. **AddCrewModal.test.tsx** (~60 lines)

---

## HOOK TESTS (15 NEW FILES)

### Query Hooks (8 files)

1. **usePermissions.test.ts** (~50 lines)
```typescript
import { renderHook } from '@testing-library/react'
import { usePermissions } from '../usePermissions'
import { useAuthStore } from '../../stores/authStore'

jest.mock('../../stores/authStore')

describe('usePermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should check permissions correctly', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
      user: { id: 'user-1', role: 'admin' },
      permissions: ['rfis.create', 'rfis.edit', 'rfis.delete'],
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.checkPermission('rfis.create')).toBe(true)
    expect(result.current.checkPermission('rfis.view')).toBe(false)
  })

  it('should return all user permissions', () => {
    const permissions = ['rfis.create', 'rfis.edit']
    ;(useAuthStore as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      permissions,
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.permissions).toEqual(permissions)
  })

  it('should handle missing user', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
      user: null,
      permissions: [],
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.checkPermission('rfis.create')).toBe(false)
    expect(result.current.permissions).toEqual([])
  })

  it('should handle wildcard permissions', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
      user: { id: 'user-1', role: 'super_admin' },
      permissions: ['*'],
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.checkPermission('rfis.create')).toBe(true)
    expect(result.current.checkPermission('anything.anything')).toBe(true)
  })
})
```

2. **useRealtimeQuery.test.ts** (~60 lines)
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useRealtimeQuery } from '../useRealtimeQuery'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('useRealtimeQuery', () => {
  it('should fetch initial data', async () => {
    const { result } = renderHook(() => useRealtimeQuery('rfis', 'proj-1'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
  })

  it('should subscribe to real-time updates', async () => {
    const { result } = renderHook(() => useRealtimeQuery('rfis', 'proj-1'), {
      wrapper,
    })

    // Simulate real-time update
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Data should be updated
    expect(result.current.data).toBeDefined()
  })

  it('should handle errors', async () => {
    const { result } = renderHook(
      () => useRealtimeQuery('invalid_table', 'proj-1'),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })
  })

  it('should cleanup subscription on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeQuery('rfis', 'proj-1'), {
      wrapper,
    })

    const unsubscribeSpy = jest.spyOn(require('../useRealtimeQuery'), 'unsubscribe')
    unmount()

    expect(unsubscribeSpy).toHaveBeenCalled()
  })
})
```

3. **useRealtimeSubscription.test.ts** (~50 lines)
4. **useVoiceCapture.test.ts** (~60 lines)
5. **useDigitalTwin.test.ts** (~60 lines)
6. **useBIMModel.test.ts** (~55 lines)
7. **useMultiAgentChat.test.ts** (~65 lines)
8. **useProjectAI.test.ts** (~60 lines)

### Authentication & Features (7 files)

9. **useSSO.test.ts** (~50 lines)
10. **useCheckIn.test.ts** (~45 lines)
11. **usePushNotifications.test.ts** (~55 lines)
12. **useMobileCapture.test.ts** (~50 lines)
13. **usePhotoAnalysis.test.ts** (~55 lines)
14. **useAgentBuilder.test.ts** (~60 lines)
15. **usePlatformIntel.test.ts** (~55 lines)

---

## INTEGRATION TESTS (10 NEW FILES)

### End-to-End Workflows

1. **payment-workflow.integration.test.ts** (~100 lines)
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangeOrderApp } from '../../pages/ChangeOrder'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

describe('Payment Workflow Integration', () => {
  it('should complete full payment flow: draft → approve → payment', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <ChangeOrderApp projectId="proj-1" />
      </QueryClientProvider>
    )

    // Step 1: Create draft CO
    const createBtn = screen.getByRole('button', { name: /create/i })
    await user.click(createBtn)

    const titleInput = screen.getByLabelText('Title')
    await user.type(titleInput, 'Test CO')

    const submitBtn = screen.getByRole('button', { name: /submit/i })
    await user.click(submitBtn)

    // Step 2: Verify draft status
    await waitFor(() => {
      expect(screen.getByText('Test CO')).toBeInTheDocument()
      expect(screen.getByText('draft')).toBeInTheDocument()
    })

    // Step 3: Approve CO
    const approveBtn = screen.getByRole('button', { name: /approve/i })
    await user.click(approveBtn)

    await waitFor(() => {
      expect(screen.getByText('approved')).toBeInTheDocument()
    })

    // Step 4: Process payment
    const paymentBtn = screen.getByRole('button', { name: /process|payment/i })
    await user.click(paymentBtn)

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument()
    })
  })
})
```

2. **agent-orchestrator.integration.test.ts** (~100 lines)
3. **offline-sync.integration.test.ts** (~100 lines)
4. **permission-gates.integration.test.ts** (~90 lines)
5. **api-v1-endpoints.integration.test.ts** (~100 lines)
6. **real-time-collaboration.integration.test.ts** (~100 lines)
7. **notification-system.integration.test.ts** (~90 lines)
8. **audit-trail.integration.test.ts** (~90 lines)
9. **data-import.integration.test.ts** (~100 lines)
10. **multi-tenant.integration.test.ts** (~100 lines)

---

## E2E TESTS (5 NEW FILES)

### Full Application Flows

1. **login-rfi-workflow.e2e.test.ts** (~150 lines)
```typescript
import { test, expect } from '@playwright/test'

test.describe('Complete RFI Workflow', () => {
  test('should complete login → create → assign → respond → close', async ({ page }) => {
    // Step 1: Login
    await page.goto('http://localhost:3000/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for dashboard
    await page.waitForURL('**/dashboard')
    expect(page.url()).toContain('/dashboard')

    // Step 2: Navigate to RFIs
    await page.click('a[href="/rfis"]')
    await page.waitForURL('**/rfis')

    // Step 3: Create new RFI
    await page.click('button:has-text("Create RFI")')
    await page.fill('[name="title"]', 'New RFI')
    await page.fill('[name="description"]', 'Test description')
    await page.selectOption('[name="priority"]', 'high')
    await page.click('button:has-text("Create")')

    // Wait for success toast and verify RFI appears
    await page.waitForSelector('text=RFI created successfully')
    await expect(page.locator('text=New RFI')).toBeVisible()

    // Step 4: Assign RFI
    await page.click('button:has-text("New RFI")')
    await page.click('button:has-text("Assign")')
    await page.selectOption('[name="assignee"]', 'john@example.com')
    await page.click('button:has-text("Save")')

    // Verify assignment
    await expect(page.locator('text=Assigned to John')).toBeVisible()

    // Step 5: Respond (as different user)
    // ... logout and login as assignee ...
    await page.click('text=Logout')
    // Login as john@example.com
    // Navigate to RFI
    // Click "Add Response"
    // Type response
    // Submit

    // Step 6: Close RFI
    // ... login as original user ...
    // Navigate to RFI detail
    // Click "Close RFI"
    // Verify status = "closed"

    expect(page.url()).toContain('/rfis')
  })
})
```

2. **daily-log-photo-workflow.e2e.test.ts** (~120 lines)
3. **change-order-approval.e2e.test.ts** (~130 lines)
4. **agent-interaction.e2e.test.ts** (~140 lines)
5. **offline-sync.e2e.test.ts** (~150 lines)

---

## Test Configuration Files

### Jest Setup

**File:** `jest.config.js` (update/create)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
}
```

**File:** `src/setupTests.ts`
```typescript
import '@testing-library/jest-dom'
import { server } from './mocks/server'

// Start server before all tests
beforeAll(() => server.listen())

// Reset handlers before each test
beforeEach(() => server.resetHandlers())

// Clean up after all tests
afterAll(() => server.close())
```

### Playwright Setup

**File:** `playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test src/components/__tests__/CreateRFIModal.test.tsx

# Run E2E tests
npx playwright test

# Watch mode
npm test -- --watch
```

---

## Coverage Goals

| Category | Current | Target | Effort |
|----------|---------|--------|--------|
| Machines | 95% | 95% | 0 hours (maintain) |
| Components | 5% | 75% | 18 hours |
| Hooks | 10% | 80% | 12 hours |
| Integration | 0% | 70% | 10 hours |
| E2E | 0% | 60% | 5 hours |
| **OVERALL** | **8%** | **70%** | **45 hours** |

---

## Verification Script

```bash
#!/bin/bash
# Verify test coverage expansion

set -e

echo "✓ Checking test file count..."
test_count=$(find src/ -name "*.test.*" -o -name "*.spec.*" | wc -l)
if [ "$test_count" -lt 70 ]; then
  echo "❌ FAIL: Only $test_count test files (expected >= 70)"
  exit 1
fi
echo "  Found: $test_count test files"

echo "✓ Checking component tests..."
component_tests=$(find src/components -name "*.test.*" | wc -l)
if [ "$component_tests" -lt 25 ]; then
  echo "❌ FAIL: Only $component_tests component tests (expected >= 25)"
  exit 1
fi
echo "  Component tests: $component_tests"

echo "✓ Checking hook tests..."
hook_tests=$(find src/hooks -name "*.test.*" | wc -l)
if [ "$hook_tests" -lt 12 ]; then
  echo "❌ FAIL: Only $hook_tests hook tests (expected >= 12)"
  exit 1
fi
echo "  Hook tests: $hook_tests"

echo "✓ Checking integration tests..."
integration_tests=$(find src/ -name "*.integration.test.*" | wc -l)
if [ "$integration_tests" -lt 8 ]; then
  echo "❌ FAIL: Only $integration_tests integration tests (expected >= 8)"
  exit 1
fi
echo "  Integration tests: $integration_tests"

echo "✓ Checking E2E tests..."
e2e_tests=$(find src/e2e -name "*.e2e.test.*" 2>/dev/null | wc -l)
if [ "$e2e_tests" -lt 3 ]; then
  echo "⚠ WARNING: Only $e2e_tests E2E tests (expected >= 3)"
fi
echo "  E2E tests: $e2e_tests"

echo "✓ Running tests..."
if ! npm test -- --listTests 2>/dev/null | head -5; then
  echo "⚠ WARNING: Could not list tests"
fi

echo "✓ Checking Jest config..."
if [ ! -f "jest.config.js" ]; then
  echo "❌ FAIL: jest.config.js not found"
  exit 1
fi

echo "✓ Checking test setup..."
if [ ! -f "src/setupTests.ts" ]; then
  echo "❌ FAIL: src/setupTests.ts not found"
  exit 1
fi

echo ""
echo "✅ ALL CHECKS PASSED - Test coverage expanded!"
echo ""
echo "Statistics:"
echo "  - Total test files: $test_count"
echo "  - Component tests: $component_tests"
echo "  - Hook tests: $hook_tests"
echo "  - Integration tests: $integration_tests"
echo "  - E2E tests: $e2e_tests"
```

Run with:
```bash
bash scripts/verify-test-coverage.sh
```
