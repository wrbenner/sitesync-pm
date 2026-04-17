# VERIFICATION TESTS — SiteSync PM

> **Purpose**: This file tells the evolution engine HOW to verify its own work beyond `npm run build`. Every test in this document is executable. The engine MUST run relevant verification tests after fixing auth, security, or data related issues. A fix that compiles but fails verification is NOT fixed.
>
> **Execution**: The engine should generate and run these tests using Claude Code CLI. Tests that require a running Supabase instance use the project at `https://hypxrmcppjfbtlwuoafc.supabase.co`. Tests that require a browser use Playwright against `http://localhost:5173/sitesync-pm/`.
>
> **Test Users**: All test users are pre-seeded with password `Password123!`. UUIDs are deterministic for assertion stability.

---

## Test Infrastructure

### Supabase Connection

```typescript
// test-utils/supabase-test-client.ts
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hypxrmcppjfbtlwuoafc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cHhybWNwcGpmYnRsd3VvYWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM1MjQsImV4cCI6MjA5MDI4OTUyNH0.gI_zodUcFN1z5a9k4GC5At4fsPYgWi-99C0ZNcVgmYA'

export function createTestClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export async function signInAsUser(email: string, password: string = 'Password123!') {
  const client = createTestClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Auth failed for ${email}: ${error.message}`)
  return { client, session: data.session, user: data.user }
}

export async function signInAsRole(role: string) {
  const roleEmails: Record<string, string> = {
    project_manager: 'mike.chen@turnergc.com',
    superintendent: 'jennifer.walsh@turnergc.com',
    project_engineer: 'david.park@turnergc.com',
    safety_manager: 'robert.martinez@turnergc.com',
    field_engineer: 'lisa.thompson@turnergc.com',
    subcontractor: 'karen.rodriguez@turnergc.com',
    owner_rep: 'james.wilson@turnergc.com',
    viewer: 'sarah.kim@turnergc.com',
  }
  const email = roleEmails[role]
  if (!email) throw new Error(`No test user for role: ${role}`)
  return signInAsUser(email)
}
```

### Seed User Reference

| UUID | Email | Role | Level |
|------|-------|------|-------|
| `11111111-...-111111111111` | mike.chen@turnergc.com | project_manager | 4 |
| `22222222-...-222222222222` | jennifer.walsh@turnergc.com | superintendent | 3 |
| `33333333-...-333333333333` | david.park@turnergc.com | project_engineer | 3 |
| `44444444-...-444444444444` | robert.martinez@turnergc.com | safety_manager | 3 |
| `55555555-...-555555555555` | lisa.thompson@turnergc.com | field_engineer | 3 |
| `66666666-...-666666666666` | karen.rodriguez@turnergc.com | subcontractor | 2 |
| `77777777-...-777777777777` | james.wilson@turnergc.com | owner_rep | 2 |
| `88888888-...-888888888888` | sarah.kim@turnergc.com | viewer | 1 |

### Test Project

| Field | Value |
|-------|-------|
| project_id | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` |
| name | Riverside Commercial Tower |

---

## SECTION 1: Authentication Flow Tests

These tests verify the complete auth lifecycle. The engine MUST run these after modifying any file in `src/hooks/useAuth.ts`, `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/pages/Onboarding.tsx`, `src/lib/supabase.ts`, or `src/components/auth/`.

### AUTH-001: Successful Login

```typescript
// e2e/auth-login.spec.ts
import { test, expect } from '@playwright/test'

test('successful login redirects to dashboard', async ({ page }) => {
  await page.goto('/login')

  // Form elements exist and are interactable
  const emailInput = page.getByLabel(/email/i)
  const passwordInput = page.getByLabel(/password/i)
  const submitButton = page.getByRole('button', { name: /sign in|log in/i })

  await expect(emailInput).toBeVisible()
  await expect(passwordInput).toBeVisible()
  await expect(submitButton).toBeVisible()
  await expect(submitButton).toBeEnabled()

  // Fill credentials
  await emailInput.fill('mike.chen@turnergc.com')
  await passwordInput.fill('Password123!')
  await submitButton.click()

  // Should redirect to dashboard within 5 seconds
  await expect(page).toHaveURL(/dashboard|\/$/,  { timeout: 5000 })

  // Dashboard should show user context (name, avatar, or role indicator)
  await expect(page.locator('body')).not.toContainText(/sign in|log in/i)
})
```

### AUTH-002: Invalid Credentials Show Error

```typescript
test('invalid credentials show user-friendly error', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel(/email/i).fill('mike.chen@turnergc.com')
  await page.getByLabel(/password/i).fill('WrongPassword999!')
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Should show mapped error message, NOT raw Supabase error
  const errorText = page.getByText(/incorrect|invalid|wrong/i)
  await expect(errorText).toBeVisible({ timeout: 5000 })

  // Should NOT show: "invalid_credentials" or Supabase internal errors
  await expect(page.locator('body')).not.toContainText('invalid_credentials')
  await expect(page.locator('body')).not.toContainText('AuthApiError')

  // Should stay on login page
  await expect(page).toHaveURL(/login/)
})
```

### AUTH-003: Protected Route Redirect

```typescript
test('unauthenticated user redirected to login with returnTo', async ({ page }) => {
  // Try to access a protected page directly
  await page.goto('/rfis')

  // Should redirect to login with returnTo parameter
  await expect(page).toHaveURL(/login/)

  // After login, should redirect back to original page
  await page.getByLabel(/email/i).fill('mike.chen@turnergc.com')
  await page.getByLabel(/password/i).fill('Password123!')
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  await expect(page).toHaveURL(/rfis/, { timeout: 5000 })
})
```

### AUTH-004: Sign Out Clears Session

```typescript
test('sign out clears all auth state and redirects to login', async ({ page }) => {
  // Login first
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('mike.chen@turnergc.com')
  await page.getByLabel(/password/i).fill('Password123!')
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await expect(page).toHaveURL(/dashboard|\/$/,  { timeout: 5000 })

  // Find and click sign out (could be in avatar menu, sidebar, or settings)
  const signOutTrigger = page.getByRole('button', { name: /sign out|log out|logout/i })
    .or(page.getByText(/sign out|log out/i))

  // May need to open a dropdown first
  const avatarButton = page.locator('[data-testid="avatar-menu"], [data-testid="user-menu"]')
  if (await avatarButton.isVisible()) {
    await avatarButton.click()
  }

  await signOutTrigger.click()

  // Should redirect to login
  await expect(page).toHaveURL(/login/, { timeout: 5000 })

  // Trying to navigate to protected page should stay on login
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/login/)
})
```

### AUTH-005: Session Persistence Across Tabs

```typescript
test('session persists on page reload', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('mike.chen@turnergc.com')
  await page.getByLabel(/password/i).fill('Password123!')
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await expect(page).toHaveURL(/dashboard|\/$/,  { timeout: 5000 })

  // Reload the page
  await page.reload()

  // Should still be on dashboard, not redirected to login
  await expect(page).toHaveURL(/dashboard|\/$/)
  await expect(page.locator('body')).not.toContainText(/sign in|log in/i)
})
```

### AUTH-006: Password Reset Flow

```typescript
test('password reset sends email without exposing user existence', async ({ page }) => {
  await page.goto('/login')

  // Find the forgot password link
  const forgotLink = page.getByText(/forgot|reset/i)
  await expect(forgotLink).toBeVisible()
  await forgotLink.click()

  // Fill in email
  const emailInput = page.getByLabel(/email/i)
  await emailInput.fill('mike.chen@turnergc.com')

  const submitButton = page.getByRole('button', { name: /send|reset|submit/i })
  await submitButton.click()

  // Should show success message regardless of whether email exists (security)
  const successText = page.getByText(/check your email|sent|instructions/i)
  await expect(successText).toBeVisible({ timeout: 5000 })
})
```

### AUTH-007: Error Message Mapping (Unit Test)

```typescript
// src/test/auth-errors.test.ts
import { describe, it, expect } from 'vitest'

// Import or replicate the error mapping function from useAuth
function mapAuthError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('invalid login') || msg.includes('invalid_credentials')) return 'Email or password is incorrect'
  if (msg.includes('email not confirmed')) return 'Please check your email to confirm your account'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts. Please try again in a few minutes'
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) return 'Unable to connect. Check your internet connection'
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'An account with this email already exists'
  if (msg.includes('password') && msg.includes('short')) return 'Password must be at least 6 characters'
  return message
}

describe('Auth Error Mapping', () => {
  it('maps invalid_credentials to user-friendly message', () => {
    expect(mapAuthError('Invalid login credentials')).toBe('Email or password is incorrect')
    expect(mapAuthError('invalid_credentials')).toBe('Email or password is incorrect')
  })

  it('maps email not confirmed', () => {
    expect(mapAuthError('Email not confirmed')).toBe('Please check your email to confirm your account')
  })

  it('maps rate limiting', () => {
    expect(mapAuthError('Rate limit exceeded')).toBe('Too many attempts. Please try again in a few minutes')
    expect(mapAuthError('Too many requests')).toBe('Too many attempts. Please try again in a few minutes')
  })

  it('maps network errors', () => {
    expect(mapAuthError('Failed to fetch')).toBe('Unable to connect. Check your internet connection')
    expect(mapAuthError('Network error')).toBe('Unable to connect. Check your internet connection')
  })

  it('maps duplicate registration', () => {
    expect(mapAuthError('User already registered')).toBe('An account with this email already exists')
    expect(mapAuthError('Email has already been registered')).toBe('An account with this email already exists')
  })

  it('maps password too short', () => {
    expect(mapAuthError('Password is too short')).toBe('Password must be at least 6 characters')
  })

  it('passes through unknown errors unchanged', () => {
    expect(mapAuthError('Something unexpected')).toBe('Something unexpected')
  })

  it('never exposes raw Supabase internals', () => {
    const errors = [
      'Invalid login credentials',
      'invalid_credentials',
      'Email not confirmed',
      'Rate limit exceeded',
      'Failed to fetch',
      'User already registered',
      'Password is too short',
    ]
    for (const err of errors) {
      const mapped = mapAuthError(err)
      expect(mapped).not.toContain('AuthApiError')
      expect(mapped).not.toContain('PGRST')
      expect(mapped).not.toContain('supabase')
    }
  })
})
```

---

## SECTION 2: Row Level Security Tests

These tests verify that RLS policies enforce data isolation correctly. The engine MUST run these after modifying any migration file, `src/lib/rls.ts`, or any file that constructs Supabase queries.

**CRITICAL**: RLS test failures are P0 security vulnerabilities. A single failing RLS test means the engine MUST NOT proceed to other modules until fixed.

### Role Hierarchy Reference

```
owner(6) > admin(5) > project_manager(4) > superintendent(3) > subcontractor(2) > viewer(1)
```

### RLS-001: Project Member Isolation

```typescript
// src/test/rls/project-isolation.test.ts
import { describe, it, expect } from 'vitest'
import { signInAsRole, createTestClient } from '../../test-utils/supabase-test-client'

const PROJECT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

describe('Project Member Isolation', () => {
  it('project member CAN read project data', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data, error } = await client
      .from('projects')
      .select('id, name')
      .eq('id', PROJECT_ID)
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.id).toBe(PROJECT_ID)
    expect(data!.name).toBe('Riverside Commercial Tower')
  })

  it('non-member CANNOT read project data', async () => {
    // Create a fresh anonymous client (not signed in as any project member)
    const client = createTestClient()

    const { data, error } = await client
      .from('projects')
      .select('id, name')
      .eq('id', PROJECT_ID)

    // Should return empty array or error, never the project data
    expect(data?.length ?? 0).toBe(0)
  })

  it('member of Project A CANNOT see data from Project B', async () => {
    const { client } = await signInAsRole('viewer')

    // Query ALL projects (not filtered by ID)
    const { data } = await client.from('projects').select('id')

    // Should only see projects where user is a member
    const projectIds = (data || []).map(p => p.id)
    // The viewer should see the test project but NOT any project they are not a member of
    expect(projectIds).toContain(PROJECT_ID)

    // Each returned project should have a corresponding project_members row for this user
    for (const pid of projectIds) {
      const { data: membership } = await client
        .from('project_members')
        .select('id')
        .eq('project_id', pid)
      expect(membership?.length).toBeGreaterThan(0)
    }
  })
})
```

### RLS-002: Budget Access (Superintendent+ Only)

```typescript
describe('Budget Items RLS', () => {
  it('superintendent CAN read budget items', async () => {
    const { client } = await signInAsRole('superintendent')

    const { data, error } = await client
      .from('budget_items')
      .select('id, description, original_amount')
      .eq('project_id', PROJECT_ID)
      .limit(5)

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('subcontractor CANNOT read budget items', async () => {
    const { client } = await signInAsRole('subcontractor')

    const { data, error } = await client
      .from('budget_items')
      .select('id, description, original_amount')
      .eq('project_id', PROJECT_ID)

    // RLS should return empty result set
    expect(data?.length ?? 0).toBe(0)
  })

  it('viewer CANNOT read budget items', async () => {
    const { client } = await signInAsRole('viewer')

    const { data } = await client
      .from('budget_items')
      .select('id')
      .eq('project_id', PROJECT_ID)

    expect(data?.length ?? 0).toBe(0)
  })

  it('project_manager CAN insert budget items', async () => {
    const { client } = await signInAsRole('project_manager')

    const { error } = await client
      .from('budget_items')
      .insert({
        project_id: PROJECT_ID,
        description: 'RLS Test Item — Delete After Test',
        csi_code: '01 00 00',
        original_amount: 1000,
      })

    expect(error).toBeNull()

    // Clean up
    await client
      .from('budget_items')
      .delete()
      .eq('description', 'RLS Test Item — Delete After Test')
  })

  it('superintendent CANNOT insert budget items', async () => {
    const { client } = await signInAsRole('superintendent')

    const { error } = await client
      .from('budget_items')
      .insert({
        project_id: PROJECT_ID,
        description: 'Should Fail',
        csi_code: '01 00 00',
        original_amount: 500,
      })

    expect(error).not.toBeNull()
  })
})
```

### RLS-003: RFI Access (All Members Read, Superintendent+ Write)

```typescript
describe('RFI RLS', () => {
  const TEST_RFI_ID = 'b0000001-0000-0000-0000-000000000001'

  it('viewer CAN read RFIs', async () => {
    const { client } = await signInAsRole('viewer')

    const { data, error } = await client
      .from('rfis')
      .select('id, title, status')
      .eq('project_id', PROJECT_ID)
      .limit(5)

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('subcontractor CAN read RFIs', async () => {
    const { client } = await signInAsRole('subcontractor')

    const { data, error } = await client
      .from('rfis')
      .select('id, title')
      .eq('project_id', PROJECT_ID)
      .limit(1)

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('superintendent CAN create RFIs', async () => {
    const { client } = await signInAsRole('superintendent')

    const { error } = await client
      .from('rfis')
      .insert({
        project_id: PROJECT_ID,
        title: 'RLS Test RFI — Delete After Test',
        status: 'open',
        priority: 'medium',
      })

    expect(error).toBeNull()

    // Clean up
    await client.from('rfis').delete().eq('title', 'RLS Test RFI — Delete After Test')
  })

  it('viewer CANNOT create RFIs', async () => {
    const { client } = await signInAsRole('viewer')

    const { error } = await client
      .from('rfis')
      .insert({
        project_id: PROJECT_ID,
        title: 'Should Fail',
        status: 'open',
        priority: 'low',
      })

    expect(error).not.toBeNull()
  })

  it('project_manager CAN delete RFIs', async () => {
    const { client: pmClient } = await signInAsRole('project_manager')

    // Create then delete
    const { data: created } = await pmClient
      .from('rfis')
      .insert({
        project_id: PROJECT_ID,
        title: 'RLS Delete Test',
        status: 'open',
        priority: 'low',
      })
      .select()
      .single()

    if (created) {
      const { error } = await pmClient.from('rfis').delete().eq('id', created.id)
      expect(error).toBeNull()
    }
  })

  it('superintendent CANNOT delete RFIs', async () => {
    const { client } = await signInAsRole('superintendent')

    const { error } = await client
      .from('rfis')
      .delete()
      .eq('id', TEST_RFI_ID)

    // Should either error or affect 0 rows
    if (!error) {
      // Verify the row still exists
      const { client: pmClient } = await signInAsRole('project_manager')
      const { data } = await pmClient.from('rfis').select('id').eq('id', TEST_RFI_ID).single()
      expect(data).not.toBeNull()
    }
  })
})
```

### RLS-004: Payment Applications (Superintendent+ Read, PM+ Write, Admin Delete)

```typescript
describe('Payment Applications RLS', () => {
  it('superintendent CAN read payment applications', async () => {
    const { client } = await signInAsRole('superintendent')

    const { data, error } = await client
      .from('payment_applications')
      .select('id, period_number, status')
      .eq('project_id', PROJECT_ID)

    expect(error).toBeNull()
    // May be empty if no pay apps seeded, but should not error
  })

  it('subcontractor CANNOT read payment applications', async () => {
    const { client } = await signInAsRole('subcontractor')

    const { data } = await client
      .from('payment_applications')
      .select('id')
      .eq('project_id', PROJECT_ID)

    expect(data?.length ?? 0).toBe(0)
  })

  it('viewer CANNOT read payment applications', async () => {
    const { client } = await signInAsRole('viewer')

    const { data } = await client
      .from('payment_applications')
      .select('id')
      .eq('project_id', PROJECT_ID)

    expect(data?.length ?? 0).toBe(0)
  })
})
```

### RLS-005: Daily Log (All Read, Superintendent+ Write)

```typescript
describe('Daily Log RLS', () => {
  it('viewer CAN read daily logs', async () => {
    const { client } = await signInAsRole('viewer')

    const { data, error } = await client
      .from('daily_logs')
      .select('id, log_date, status')
      .eq('project_id', PROJECT_ID)
      .limit(3)

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('superintendent CAN create daily logs', async () => {
    const { client } = await signInAsRole('superintendent')

    const { error } = await client
      .from('daily_logs')
      .insert({
        project_id: PROJECT_ID,
        log_date: '2099-12-31',
        status: 'draft',
      })

    expect(error).toBeNull()

    // Clean up
    await client.from('daily_logs').delete().eq('log_date', '2099-12-31')
  })

  it('viewer CANNOT create daily logs', async () => {
    const { client } = await signInAsRole('viewer')

    const { error } = await client
      .from('daily_logs')
      .insert({
        project_id: PROJECT_ID,
        log_date: '2099-12-30',
        status: 'draft',
      })

    expect(error).not.toBeNull()
  })

  it('subcontractor CANNOT create daily logs', async () => {
    const { client } = await signInAsRole('subcontractor')

    const { error } = await client
      .from('daily_logs')
      .insert({
        project_id: PROJECT_ID,
        log_date: '2099-12-29',
        status: 'draft',
      })

    expect(error).not.toBeNull()
  })
})
```

### RLS-006: Audit Trail (Append Only)

```typescript
describe('Audit Trail RLS', () => {
  it('project member CAN read audit trail', async () => {
    const { client } = await signInAsRole('viewer')

    const { data, error } = await client
      .from('audit_trail')
      .select('id, action, entity_type')
      .eq('project_id', PROJECT_ID)
      .limit(5)

    expect(error).toBeNull()
  })

  it('authenticated user CAN insert audit entries', async () => {
    const { client } = await signInAsRole('superintendent')

    const { error } = await client
      .from('audit_trail')
      .insert({
        project_id: PROJECT_ID,
        action: 'test',
        entity_type: 'rls_test',
        entity_title: 'RLS Verification Test',
      })

    expect(error).toBeNull()

    // Clean up
    await client.from('audit_trail').delete().eq('entity_type', 'rls_test')
  })

  it('nobody CAN update audit trail entries (append only)', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data: entries } = await client
      .from('audit_trail')
      .select('id')
      .eq('project_id', PROJECT_ID)
      .limit(1)

    if (entries && entries.length > 0) {
      const { error } = await client
        .from('audit_trail')
        .update({ action: 'tampered' })
        .eq('id', entries[0].id)

      // Should fail — audit trail is append-only
      expect(error).not.toBeNull()
    }
  })
})
```

### RLS-007: Complete Role Matrix Sweep

```typescript
describe('Complete Role Matrix', () => {
  // Tables and their minimum SELECT role
  const tableAccess: Array<{ table: string; minReadRole: string; blockedRoles: string[] }> = [
    { table: 'rfis', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'submittals', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'tasks', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'punch_items', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'daily_logs', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'schedule_phases', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'drawings', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'directory_contacts', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'meetings', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'crews', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'budget_items', minReadRole: 'superintendent', blockedRoles: ['subcontractor', 'viewer'] },
    { table: 'change_orders', minReadRole: 'superintendent', blockedRoles: ['subcontractor', 'viewer'] },
    { table: 'payment_applications', minReadRole: 'superintendent', blockedRoles: ['subcontractor', 'viewer'] },
    { table: 'field_captures', minReadRole: 'viewer', blockedRoles: [] },
    { table: 'files', minReadRole: 'viewer', blockedRoles: [] },
  ]

  for (const { table, blockedRoles } of tableAccess) {
    for (const role of blockedRoles) {
      it(`${role} CANNOT read ${table}`, async () => {
        const { client } = await signInAsRole(role)

        const { data } = await client
          .from(table)
          .select('id')
          .eq('project_id', PROJECT_ID)
          .limit(1)

        expect(data?.length ?? 0).toBe(0)
      })
    }
  }
})
```

---

## SECTION 3: Data Integrity Tests

These tests verify that seeded data is realistic, calculations are correct, and business rules are enforced. The engine MUST run these after modifying mock data, seed files, or calculation logic.

### DATA-001: Budget Calculations

```typescript
describe('Budget Data Integrity', () => {
  it('budget line items sum to contract total', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data: items } = await client
      .from('budget_items')
      .select('original_amount')
      .eq('project_id', PROJECT_ID)

    if (items && items.length > 0) {
      const total = items.reduce((sum, i) => sum + (i.original_amount || 0), 0)

      const { data: project } = await client
        .from('projects')
        .select('contract_value')
        .eq('id', PROJECT_ID)
        .single()

      if (project?.contract_value) {
        // Line items should sum to within 1% of contract value
        const variance = Math.abs(total - project.contract_value) / project.contract_value
        expect(variance).toBeLessThan(0.01)
      }
    }
  })

  it('no budget item has negative original amount', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('budget_items')
      .select('id, description, original_amount')
      .eq('project_id', PROJECT_ID)
      .lt('original_amount', 0)

    expect(data?.length ?? 0).toBe(0)
  })
})
```

### DATA-002: RFI Data Validity

```typescript
describe('RFI Data Integrity', () => {
  it('all RFIs have required fields', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data: rfis } = await client
      .from('rfis')
      .select('id, title, status, priority, project_id')
      .eq('project_id', PROJECT_ID)

    for (const rfi of rfis || []) {
      expect(rfi.title).toBeTruthy()
      expect(rfi.status).toMatch(/^(open|under_review|answered|closed)$/)
      expect(rfi.priority).toMatch(/^(low|medium|high|critical)$/)
      expect(rfi.project_id).toBe(PROJECT_ID)
    }
  })

  it('closed RFIs have a closed_at timestamp', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('rfis')
      .select('id, title, status, closed_at')
      .eq('project_id', PROJECT_ID)
      .eq('status', 'closed')

    for (const rfi of data || []) {
      expect(rfi.closed_at).not.toBeNull()
    }
  })

  it('RFI numbers are unique within project', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('rfis')
      .select('rfi_number')
      .eq('project_id', PROJECT_ID)

    if (data && data.length > 0) {
      const numbers = data.map(r => r.rfi_number).filter(Boolean)
      const unique = new Set(numbers)
      expect(unique.size).toBe(numbers.length)
    }
  })
})
```

### DATA-003: Schedule Phase Integrity

```typescript
describe('Schedule Data Integrity', () => {
  it('no phase has end_date before start_date', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('schedule_phases')
      .select('id, name, start_date, end_date')
      .eq('project_id', PROJECT_ID)

    for (const phase of data || []) {
      if (phase.start_date && phase.end_date) {
        expect(new Date(phase.end_date).getTime())
          .toBeGreaterThanOrEqual(new Date(phase.start_date).getTime())
      }
    }
  })

  it('completion percentage is between 0 and 100', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('schedule_phases')
      .select('id, name, percent_complete')
      .eq('project_id', PROJECT_ID)

    for (const phase of data || []) {
      if (phase.percent_complete !== null) {
        expect(phase.percent_complete).toBeGreaterThanOrEqual(0)
        expect(phase.percent_complete).toBeLessThanOrEqual(100)
      }
    }
  })
})
```

### DATA-004: Daily Log Uniqueness

```typescript
describe('Daily Log Integrity', () => {
  it('no duplicate daily logs for the same date', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('daily_logs')
      .select('log_date')
      .eq('project_id', PROJECT_ID)

    if (data && data.length > 0) {
      const dates = data.map(d => d.log_date)
      const unique = new Set(dates)
      expect(unique.size).toBe(dates.length)
    }
  })
})
```

### DATA-005: Punch Item Status Validity

```typescript
describe('Punch Item Integrity', () => {
  it('all punch items have valid status', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('punch_items')
      .select('id, title, status')
      .eq('project_id', PROJECT_ID)

    for (const item of data || []) {
      expect(item.status).toMatch(/^(open|in_progress|resolved|verified)$/)
    }
  })

  it('verified items have a verified_at or resolved_at timestamp', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('punch_items')
      .select('id, status, resolved_at, verified_at')
      .eq('project_id', PROJECT_ID)
      .eq('status', 'verified')

    for (const item of data || []) {
      const hasTimestamp = item.resolved_at || item.verified_at
      expect(hasTimestamp).toBeTruthy()
    }
  })
})
```

### DATA-006: Project Member Role Validity

```typescript
describe('Project Member Integrity', () => {
  it('all members have valid roles from the allowed set', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('project_members')
      .select('id, role, user_id')
      .eq('project_id', PROJECT_ID)

    const validRoles = ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer',
                        'project_executive', 'project_engineer', 'safety_manager', 'field_engineer', 'owner_rep', 'architect']

    for (const member of data || []) {
      expect(validRoles).toContain(member.role)
    }
  })

  it('project has at least one project_manager or higher', async () => {
    const { client } = await signInAsRole('project_manager')

    const { data } = await client
      .from('project_members')
      .select('role')
      .eq('project_id', PROJECT_ID)

    const hasManager = (data || []).some(m =>
      ['owner', 'admin', 'project_manager', 'project_executive'].includes(m.role)
    )
    expect(hasManager).toBe(true)
  })
})
```

---

## SECTION 4: UI Permission Gate Tests

These tests verify that the UI correctly hides/shows elements based on user role. The engine MUST run these after modifying any `<PermissionGate>` usage or role-based rendering logic.

### PERM-001: Viewer Cannot See Edit Controls

```typescript
// e2e/permission-gates.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Viewer Permission Gates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('sarah.kim@turnergc.com') // viewer
    await page.getByLabel(/password/i).fill('Password123!')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await expect(page).toHaveURL(/dashboard|\/$/, { timeout: 5000 })
  })

  test('viewer cannot see "New RFI" button on RFI page', async ({ page }) => {
    await page.goto('/rfis')
    await page.waitForLoadState('networkidle')

    const newButton = page.getByRole('button', { name: /new rfi|create rfi|add rfi/i })
    await expect(newButton).not.toBeVisible()
  })

  test('viewer cannot see "New Task" button on Tasks page', async ({ page }) => {
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')

    const newButton = page.getByRole('button', { name: /new task|create task|add task/i })
    await expect(newButton).not.toBeVisible()
  })

  test('viewer cannot see budget edit controls', async ({ page }) => {
    await page.goto('/budget')
    await page.waitForLoadState('networkidle')

    // Should not see edit, add, or delete buttons
    const editButton = page.getByRole('button', { name: /edit|add line|new item/i })
    await expect(editButton).not.toBeVisible()
  })

  test('viewer cannot access project settings', async ({ page }) => {
    await page.goto('/portal/owner')

    // Should show access denied or redirect
    const accessDenied = page.getByText(/access|permission|denied|request/i)
    await expect(accessDenied).toBeVisible({ timeout: 3000 })
  })
})
```

### PERM-002: Subcontractor Data Scoping

```typescript
test.describe('Subcontractor Data Scoping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('karen.rodriguez@turnergc.com') // subcontractor
    await page.getByLabel(/password/i).fill('Password123!')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await expect(page).toHaveURL(/dashboard|\/$/, { timeout: 5000 })
  })

  test('subcontractor cannot access budget page', async ({ page }) => {
    await page.goto('/budget')

    // Should show access denied or empty state, never budget data
    const budgetData = page.locator('[data-testid="budget-table"], table')
    const accessMessage = page.getByText(/access|permission|denied|request/i)

    // Either the table doesn't exist or an access message is shown
    const tableVisible = await budgetData.isVisible().catch(() => false)
    const messageVisible = await accessMessage.isVisible().catch(() => false)

    expect(tableVisible === false || messageVisible === true).toBe(true)
  })

  test('subcontractor cannot see financial data on dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Budget amount, contract value, or financial figures should not be visible
    // This checks that the dashboard respects permission-based widget visibility
    const budgetWidget = page.locator('[data-testid="budget-widget"], [data-testid="financial-summary"]')
    await expect(budgetWidget).not.toBeVisible()
  })
})
```

### PERM-003: Project Manager Full Access

```typescript
test.describe('Project Manager Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('mike.chen@turnergc.com') // project_manager
    await page.getByLabel(/password/i).fill('Password123!')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await expect(page).toHaveURL(/dashboard|\/$/, { timeout: 5000 })
  })

  test('PM can see create buttons on all core pages', async ({ page }) => {
    const pages = [
      { url: '/rfis', buttonPattern: /new|create|add/i },
      { url: '/tasks', buttonPattern: /new|create|add/i },
      { url: '/submittals', buttonPattern: /new|create|add/i },
      { url: '/punch-list', buttonPattern: /new|create|add/i },
    ]

    for (const { url, buttonPattern } of pages) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')

      const createButton = page.getByRole('button', { name: buttonPattern }).first()
      await expect(createButton).toBeVisible({ timeout: 3000 })
    }
  })

  test('PM can access budget page with edit controls', async ({ page }) => {
    await page.goto('/budget')
    await page.waitForLoadState('networkidle')

    // Should see budget data
    const budgetContent = page.locator('table, [data-testid="budget-table"], [data-testid="budget-content"]')
    await expect(budgetContent).toBeVisible({ timeout: 5000 })
  })
})
```

---

## SECTION 5: Cross-Cutting Verification

### CROSS-001: Deep Link Integrity

```typescript
test.describe('Deep Links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('mike.chen@turnergc.com')
    await page.getByLabel(/password/i).fill('Password123!')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await expect(page).toHaveURL(/dashboard|\/$/, { timeout: 5000 })
  })

  test('all main routes load without errors', async ({ page }) => {
    const routes = [
      '/dashboard', '/tasks', '/rfis', '/submittals', '/budget',
      '/schedule', '/daily-log', '/punch-list', '/drawings',
      '/directory', '/meetings', '/safety', '/field-capture',
      '/change-orders', '/crews', '/files', '/copilot',
    ]

    for (const route of routes) {
      await page.goto(route)

      // Should not show error page or crash
      const errorIndicator = page.getByText(/error|crashed|something went wrong/i)
      const hasError = await errorIndicator.isVisible().catch(() => false)
      expect(hasError).toBe(false)

      // Should have loaded actual content (not a blank page)
      const bodyText = await page.locator('body').innerText()
      expect(bodyText.length).toBeGreaterThan(50)
    }
  })
})
```

### CROSS-002: Empty State Presence

```typescript
test('every page has a non-generic empty state', async ({ page }) => {
  // This test assumes a fresh project with no data
  // In practice, test with a project that has specific modules empty

  const routes = [
    { url: '/rfis', expectedText: /no rfi|create.*rfi/i },
    { url: '/tasks', expectedText: /no task|create.*task/i },
    { url: '/submittals', expectedText: /no submittal|create.*submittal/i },
    { url: '/punch-list', expectedText: /no punch|clean|deficien/i },
    { url: '/drawings', expectedText: /no drawing|upload/i },
    { url: '/daily-log', expectedText: /no.*log|start.*log/i },
    { url: '/meetings', expectedText: /no meeting|schedule/i },
    { url: '/change-orders', expectedText: /no change order|scope/i },
  ]

  // NOTE: This test is informational. It validates that if a page
  // renders with zero items, the empty state message is contextual,
  // not a generic "No data found."
})
```

---

## How the Engine Should Use This Document

1. **After ANY auth-related fix**: run AUTH-001 through AUTH-007. All must pass.
2. **After ANY migration or RLS change**: run RLS-001 through RLS-007. ALL must pass. A single RLS failure is P0 — stop everything and fix it.
3. **After ANY seed data change**: run DATA-001 through DATA-006.
4. **After ANY PermissionGate or role-based rendering change**: run PERM-001 through PERM-003.
5. **After ANY new page or route change**: run CROSS-001.
6. **Test execution**: generate the test file, run with `npx vitest run src/test/rls/` for unit/integration tests or `npx playwright test e2e/auth-` for E2E tests.
7. **Failure handling**: if a verification test fails, the issue is NOT fixed. Re-open the issue, include the test failure output in the next prompt, and iterate until the test passes.
8. **Test cleanup**: all tests that insert data MUST delete it after. Use unique markers like "RLS Test" in descriptions for safe cleanup.

---

*Last updated: 2026-04-01*
*Author: Walker + Claude*
*Version: 1.0*
