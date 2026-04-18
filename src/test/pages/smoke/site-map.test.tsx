// AUTO-GENERATED from audit/registry.ts — do not edit by hand.
// Regenerate with: npx tsx scripts/generate-page-tests.ts
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderPageWithProviders } from '../_helpers'

// Universal mocks — most pages touch these, so mocking unconditionally
// keeps the smoke test isolated from backend + analytics + telemetry.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (r: (x: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(r),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
  fromTable: vi.fn(),
  isSupabaseConfigured: true,
}))
vi.mock('../../../hooks/useProjectId', () => ({ useProjectId: () => 'test-project' }))
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isAtLeast: () => true,
    canAccessModule: () => true,
    role: 'project_manager',
    loading: false,
  }),
  PermissionError: class extends Error {},
}))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@example.com' }, session: null, loading: false, signOut: vi.fn() }),
}))
vi.mock('../../../stores/copilotStore', () => ({
  useCopilotStore: () => ({ setPageContext: vi.fn(), openCopilot: vi.fn(), isOpen: false }),
}))
vi.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('../../../lib/analytics', () => ({ default: { capture: vi.fn(), identify: vi.fn() } }))
vi.mock('../../../lib/sentry', () => ({ default: { captureException: vi.fn(), captureMessage: vi.fn() } }))
vi.mock('../../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}))

describe('Site Map smoke', () => {
  it('renders without throwing', async () => {
    const mod = await import('../../../pages/SiteMap')
    const Page = (mod as Record<string, unknown>).SiteMap ?? (mod as { default?: unknown }).default
    expect(typeof Page).toBe('function')
    expect(() => renderPageWithProviders(React.createElement(Page as React.ComponentType), { route: '/site-map' }))
      .not.toThrow()
  })
})
