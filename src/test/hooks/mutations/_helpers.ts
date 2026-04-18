// Shared helpers for testing mutation hooks that go through useAuditedMutation.
//
// Usage template (at top of each hook test file):
//
//   import { vi, describe, it, expect, beforeEach } from 'vitest'
//   import { renderHook, waitFor } from '@testing-library/react'
//
//   // 1. Hoisted mock spies — referenced by vi.mock() factories below.
//   const mocks = vi.hoisted(() => ({
//     hasPermission: vi.fn(() => true),
//     logAuditEntry: vi.fn(),
//     invalidateEntity: vi.fn(),
//     posthogCapture: vi.fn(),
//     sentryCapture: vi.fn(),
//     toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
//     projectId: 'test-project',
//   }))
//
//   // 2. Wire mocks — these must stay literal for hoisting to find them.
//   vi.mock('../../../hooks/usePermissions', () => ({
//     usePermissions: () => ({ hasPermission: mocks.hasPermission, role: 'project_manager' }),
//     PermissionError: class extends Error { constructor(m: string) { super(m); this.name = 'PermissionError' } },
//   }))
//   vi.mock('../../../hooks/useProjectId', () => ({ useProjectId: () => mocks.projectId }))
//   vi.mock('sonner', () => ({ toast: mocks.toast }))
//   vi.mock('../../../lib/analytics', () => ({ default: { capture: mocks.posthogCapture } }))
//   vi.mock('../../../lib/sentry', () => ({ default: { captureException: mocks.sentryCapture } }))
//   vi.mock('../../../api/invalidation', () => ({ invalidateEntity: mocks.invalidateEntity }))
//   vi.mock('../../../lib/auditLogger', () => ({ logAuditEntry: mocks.logAuditEntry }))
//
//   // 3. Mock supabase — import the shared factory and wire it.
//   import { createMockSupabase } from '../../mocks/supabase'
//   const sb = vi.hoisted(() => {
//     // hoisted — mocks module resolves before useHook() imports supabase
//     return createMockSupabase()
//   })
//   vi.mock('../../../lib/supabase', () => ({ supabase: sb.supabase, fromTable: sb.supabase.from }))
//
//   // 4. Per-test setup:
//   beforeEach(() => {
//     vi.clearAllMocks()
//     mocks.hasPermission.mockReturnValue(true)
//     sb.setResult({ data: { id: 'mock-id' }, error: null })
//   })
//
// The `renderMutation` export wraps a hook in a fresh QueryClient.

import React, { type PropsWithChildren, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, type RenderHookOptions } from '@testing-library/react'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function QueryClientTestWrapper({
  children,
  client,
}: PropsWithChildren<{ client?: QueryClient }>): ReactElement {
  const c = client ?? createTestQueryClient()
  return React.createElement(QueryClientProvider, { client: c }, children)
}

export function renderMutation<T>(
  hook: () => T,
  options?: Omit<RenderHookOptions<unknown>, 'wrapper'>,
) {
  const client = createTestQueryClient()
  const wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client }, children)
  const result = renderHook(hook, { ...options, wrapper })
  return { ...result, client }
}
