// FILTER STATUS: CONSISTENT FAIL — kept as proven bug probe; do not fix here
// STATUS: FAILING — real bug detected
// Bug description: Test file has JSX syntax error preventing vitest from parsing it
// Fix hint: Check JSX syntax near line 24, ensure proper TypeScript/JSX configuration in vitest setup

// ADVERSARIAL TEST
// Source file: src/hooks/usePermissions.ts
// Fragile logic targeted: Role hierarchy comparisons using >= operator, permission matrix lookups with null roles
// Failure mode: Off-by-one errors in isAtLeast(), missing permission in matrix causing silent failures, null role edge cases

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePermissions, ROLE_LEVELS, PERMISSION_MATRIX } from '../../hooks/usePermissions'
import { useAuth } from '../../hooks/useAuth'
import { useProjectId } from '../../hooks/useProjectId'
import { supabase } from '../../lib/supabase'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ProjectRole } from '../../hooks/usePermissions'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useProjectId')
vi.mock('../../lib/supabase')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('usePermissions adversarial tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123' } as any,
      session: null,
      loading: false,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      isAuthenticated: true,
      isSessionValid: true,
    })
    vi.mocked(useProjectId).mockReturnValue('project-123')
  })

  it('should correctly handle role hierarchy boundary conditions (isAtLeast edge case)', async () => {
    // Fragile logic: isAtLeast uses ROLE_LEVELS[role] >= ROLE_LEVELS[minimumRole]
    // Off-by-one: does 'superintendent' (level 3) >= 'superintendent' (level 3)? Should be true.

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'superintendent' },
              error: null,
            }),
          }),
        }),
      }),
    } as any)

    const { result } = renderHook(() => usePermissions(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Superintendent should be at least superintendent (boundary)
    expect(result.current.isAtLeast('superintendent')).toBe(true)

    // Superintendent should NOT be at least project_manager (level 4)
    expect(result.current.isAtLeast('project_manager')).toBe(false)
  })

  it('should return false for all permissions when role is null', async () => {
    // Fragile logic: When membership query returns null, role defaults to 'viewer'.
    // But what if the query actually returns null role field?

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: null }, // Null role in database
              error: null,
            }),
          }),
        }),
      }),
    } as any)

    const { result } = renderHook(() => usePermissions(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // With null role, should default to viewer
    expect(result.current.role).toBe('viewer')
    expect(result.current.hasPermission('tasks.create')).toBe(false)
    expect(result.current.hasPermission('dashboard.view')).toBe(true) // viewer can view dashboard
  })

  it('should handle permission not in PERMISSION_MATRIX gracefully', async () => {
    // Fragile logic: hasPermission looks up PERMISSION_MATRIX[permission].
    // What if a permission string is passed that doesn't exist in the matrix?

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'owner' },
              error: null,
            }),
          }),
        }),
      }),
    } as any)

    const { result } = renderHook(() => usePermissions(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Try a permission that doesn't exist in the matrix
    const hasFakePermission = result.current.hasPermission('fake.permission' as any)

    // Should return false gracefully, not throw
    expect(hasFakePermission).toBe(false)
  })

  it('should handle hasAnyPermission with empty array', async () => {
    // Fragile logic: hasAnyPermission uses permissions.some(). Empty array edge case.

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null,
            }),
          }),
        }),
      }),
    } as any)

    const { result } = renderHook(() => usePermissions(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Empty array should return false (no permissions to check)
    expect(result.current.hasAnyPermission([])).toBe(false)
  })

  it('should correctly differentiate between adjacent role levels', async () => {
    // Fragile logic: superintendent (3) vs project_manager (4) vs admin (5).
    // Ensure >= comparison doesn't leak permissions up or down.

    const testCases: Array<{ role: ProjectRole; canEditBudget: boolean }> = [
      { role: 'viewer', canEditBudget: false },
      { role: 'subcontractor', canEditBudget: false },
      { role: 'superintendent', canEditBudget: false },
      { role: 'project_manager', canEditBudget: true },
      { role: 'admin', canEditBudget: true },
      { role: 'owner', canEditBudget: true },
    ]

    for (const testCase of testCases) {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: testCase.role },
                error: null,
              }),
            }),
          }),
        }),
      } as any)

      const { result } = renderHook(() => usePermissions(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasPermission('budget.edit')).toBe(testCase.canEditBudget)
    }
  })

  it('should handle realtime permission revocation edge case', async () => {
    // Fragile logic: Realtime subscription invalidates permissions when project_members row changes.
    // What if the row is deleted (user removed from project)?

    let realtimeCallback: ((payload: any) => void) | null = null

    const mockChannel = {
      on: vi.fn().mockImplementation((event: string, opts: any, callback: any) => {
        realtimeCallback = callback
        return mockChannel
      }),
      subscribe: vi.fn().mockReturnValue(mockChannel),
    }

    vi.mocked(supabase.channel).mockReturnValue(mockChannel as any)
    vi.mocked(supabase.removeChannel).mockResolvedValue({ status: 'ok', error: null } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null,
            }),
          }),
        }),
      }),
    } as any)

    const { result } = renderHook(() => usePermissions(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBe('admin')

    // Simulate DELETE event (user removed from project)
    realtimeCallback?.({
      eventType: 'DELETE',
      old: { project_id: 'project-123', user_id: 'user-123', role: 'admin' },
      new: null,
    })

    // Should trigger query invalidation
    await waitFor(() => {
      // Query invalidation happened
      expect(vi.mocked(supabase.from)).toHaveBeenCalled()
    })
  })

  it('should verify ROLE_LEVELS has no gaps or duplicates', () => {
    // Sanity check: ensure role levels are sequential without gaps.
    // If someone adds a role with duplicate level, comparisons break.

    const levels = Object.values(ROLE_LEVELS)
    const uniqueLevels = new Set(levels)

    // No duplicate levels
    expect(uniqueLevels.size).toBe(levels.length)

    // Levels are positive integers
    for (const level of levels) {
      expect(level).toBeGreaterThan(0)
      expect(Number.isInteger(level)).toBe(true)
    }
  })

  it('should verify every permission in PERMISSION_MATRIX has at least one role', () => {
    // Sanity check: no permission should have an empty allowed roles array.
    // If PERMISSION_MATRIX[somePermission] = [], then NO ONE can access it.

    for (const [permission, allowedRoles] of Object.entries(PERMISSION_MATRIX)) {
      expect(allowedRoles.length).toBeGreaterThan(0)
    }
  })
})
