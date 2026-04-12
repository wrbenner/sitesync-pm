// FILTER STATUS: CONSISTENT FAIL — kept as proven bug probe; do not fix here
// STATUS: FAILING — real bug detected
// Bug description: Test file has JSX syntax error preventing vitest from parsing it
// Fix hint: Check JSX syntax near line 36, ensure proper TypeScript/JSX configuration in vitest setup

// ADVERSARIAL TEST
// Source file: src/hooks/useAuth.ts
// Fragile logic targeted: Subscriber count management and auth state race conditions during rapid mount/unmount cycles
// Failure mode: Double-decrement of subscriberCount, auth state leaked between test runs, cleanup race during sign-in

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '../../hooks/useAuth'
import { BrowserRouter } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

vi.mock('../../lib/supabase')
vi.mock('../../lib/queryClient')
vi.mock('../../lib/sentry')

const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: { role: 'admin' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
}

const mockSession: Session = {
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser,
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>
}

describe('useAuth adversarial tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should handle rapid mount and unmount without double-decrementing subscriber count', async () => {
    // Fragile logic: subscriberCount++ on mount, subscriberCount-- on unmount.
    // If cleanup runs twice for the same mount, subscriberCount can go negative,
    // causing auth subscription to never be cleaned up properly.

    const { unmount: unmount1 } = renderHook(() => useAuth(), { wrapper })
    const { unmount: unmount2 } = renderHook(() => useAuth(), { wrapper })
    const { unmount: unmount3 } = renderHook(() => useAuth(), { wrapper })

    // Unmount all three hooks
    unmount1()
    unmount2()
    unmount3()

    // Now mount a new hook - if subscriberCount went negative, auth won't initialize correctly
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // If subscriber count logic is broken, this hook may still show loading: true
    expect(result.current.loading).toBe(false)
  })

  it('should correctly validate session expiry boundary (expires_at edge case)', async () => {
    // Fragile logic: isSessionValid checks session.expires_at > Math.floor(Date.now() / 1000)
    // Off-by-one: what if expires_at === Math.floor(Date.now() / 1000)? Should return false.

    const now = Math.floor(Date.now() / 1000)
    const expiredSession: Session = {
      ...mockSession,
      expires_at: now, // Exactly now - should be invalid
    }

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: expiredSession },
      error: null,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Session exists but is expired exactly at current second
    expect(result.current.isAuthenticated).toBe(true) // session exists
    expect(result.current.isSessionValid).toBe(false) // but it's expired
  })

  it('should handle signIn race condition when session arrives before state update', async () => {
    // Fragile logic: signIn immediately updates shared state after supabase.auth.signInWithPassword.
    // If onAuthStateChange fires before setState completes, we could have a race.
    // This test ensures the immediate setState in signIn wins.

    let authChangeCallback: ((event: string, session: Session | null) => void) | null = null

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback: any) => {
      authChangeCallback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any
    })

    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(async () => {
      // Simulate onAuthStateChange firing BEFORE signInWithPassword resolves
      setTimeout(() => {
        authChangeCallback?.('SIGNED_IN', mockSession)
      }, 0)
      return { data: { session: mockSession, user: mockUser }, error: null }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Trigger sign-in
    const signInPromise = result.current.signIn('test@example.com', 'password')

    // Should immediately see user in state
    await waitFor(() => {
      expect(result.current.user).toBeTruthy()
    })

    await signInPromise

    // Ensure session is set correctly
    expect(result.current.session).toBeTruthy()
    expect(result.current.user?.id).toBe('test-user-id')
  })

  it('should handle signOut clearing all state even if onAuthStateChange fires late', async () => {
    // Fragile logic: signOut manually sets state to null AND calls supabase.auth.signOut().
    // If onAuthStateChange('SIGNED_OUT') arrives after manual setState, state should still be null.

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    let authChangeCallback: ((event: string, session: Session | null) => void) | null = null
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback: any) => {
      authChangeCallback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any
    })

    vi.mocked(supabase.auth.signOut).mockImplementation(async () => {
      setTimeout(() => {
        authChangeCallback?.('SIGNED_OUT', null)
      }, 10)
      return { error: null }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.user).toBeTruthy()
    })

    // Trigger sign out
    await result.current.signOut()

    // State should be cleared immediately
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()

    // Wait for delayed event
    await new Promise(resolve => setTimeout(resolve, 20))

    // State should still be null
    expect(result.current.user).toBeNull()
  })

  it('should handle signUp with empty name without crashing', async () => {
    // Fragile logic: signUp splits name by space to extract first_name and last_name.
    // What if name is empty string or whitespace-only?

    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    })

    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Sign up with empty name
    const { error } = await result.current.signUp('test@example.com', 'password', '')

    expect(error).toBeNull()
  })
})
