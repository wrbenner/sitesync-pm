import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock react-router-dom BEFORE importing the hook
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

// ---------------------------------------------------------------------------
// Mock supabase BEFORE importing the hook
// ---------------------------------------------------------------------------
const mockSignInWithPassword = vi.fn()
const mockSignUp = vi.fn()
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()
const mockResetPasswordForEmail = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockFromInsert = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
    from: () => ({
      insert: (...args: unknown[]) => mockFromInsert(...args),
    }),
  },
}))

// ---------------------------------------------------------------------------
// Mock queryClient & sentry
// ---------------------------------------------------------------------------
const mockQueryClear = vi.fn()
vi.mock('../../lib/queryClient', () => ({
  queryClient: { clear: () => mockQueryClear() },
}))

vi.mock('../../lib/sentry', () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Default session & user fixtures
// ---------------------------------------------------------------------------
const MOCK_USER = {
  id: 'user-abc',
  email: 'test@example.com',
  user_metadata: { role: 'project_manager' },
}
const MOCK_SESSION = {
  access_token: 'tok-abc',
  user: MOCK_USER,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
}

// Helper: simulate onAuthStateChange returning a no-op subscription
function stubOnAuthStateChange() {
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

// Reset module-level singleton state between tests by re-importing
// (Use vi.resetModules to bust the module cache)
beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockSignOut.mockResolvedValue({ error: null })
  stubOnAuthStateChange()
})

// Lazy import after mocks (module level singleton needs reset per test file run)
async function getHook() {
  const { useAuth } = await import('../../hooks/useAuth')
  return useAuth
}

// ---------------------------------------------------------------------------
// mapAuthError — tested through signIn error messages
// ---------------------------------------------------------------------------
describe('useAuth — error mapping via signIn', () => {
  it('maps invalid_credentials to friendly message', async () => {
    const useAuth = await getHook()
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })

    const { result } = renderHook(() => useAuth())
    let signInResult: { error: string | null } | undefined
    await act(async () => {
      signInResult = await result.current.signIn('a@b.com', 'wrong')
    })

    expect(signInResult?.error).toBe('Email or password is incorrect')
  })

  it('maps rate limit to friendly message', async () => {
    const useAuth = await getHook()
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Rate limit exceeded. Too many requests.' },
    })

    const { result } = renderHook(() => useAuth())
    let signInResult: { error: string | null } | undefined
    await act(async () => {
      signInResult = await result.current.signIn('a@b.com', 'pw')
    })

    expect(signInResult?.error).toContain('Too many attempts')
  })

  it('maps network failure to friendly message', async () => {
    const useAuth = await getHook()
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Failed to fetch' },
    })

    const { result } = renderHook(() => useAuth())
    let signInResult: { error: string | null } | undefined
    await act(async () => {
      signInResult = await result.current.signIn('a@b.com', 'pw')
    })

    expect(signInResult?.error).toContain('Unable to connect')
  })

  it('returns null error on successful signIn', async () => {
    const useAuth = await getHook()
    mockSignInWithPassword.mockResolvedValue({
      data: { session: MOCK_SESSION },
      error: null,
    })

    const { result } = renderHook(() => useAuth())
    let signInResult: { error: string | null } | undefined
    await act(async () => {
      signInResult = await result.current.signIn('a@b.com', 'pw')
    })

    expect(signInResult?.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------
describe('useAuth — signOut', () => {
  it('calls supabase.auth.signOut and queryClient.clear', async () => {
    const useAuth = await getHook()
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockSignOut).toHaveBeenCalled()
    expect(mockQueryClear).toHaveBeenCalled()
  })

  it('navigates to /login after signOut', async () => {
    const useAuth = await getHook()
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})

// ---------------------------------------------------------------------------
// resetPassword
// ---------------------------------------------------------------------------
describe('useAuth — resetPassword', () => {
  it('returns null error on success', async () => {
    const useAuth = await getHook()
    mockResetPasswordForEmail.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useAuth())
    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.resetPassword('a@b.com')
    })

    expect(res?.error).toBeNull()
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('a@b.com')
  })

  it('returns mapped error when supabase errors', async () => {
    const useAuth = await getHook()
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'Email not found' },
    })

    const { result } = renderHook(() => useAuth())
    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.resetPassword('unknown@b.com')
    })

    expect(res?.error).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// isAuthenticated / isSessionValid
// ---------------------------------------------------------------------------
describe('useAuth — computed auth flags', () => {
  it('isAuthenticated is false when no session', async () => {
    const useAuth = await getHook()
    const { result } = renderHook(() => useAuth())
    // Session starts as null
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('loading becomes false after session resolves', async () => {
    const useAuth = await getHook()
    // Regardless of singleton initialization state, loading must eventually settle to false
    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------
describe('useAuth — signUp', () => {
  it('returns null error on success', async () => {
    const useAuth = await getHook()
    mockSignUp.mockResolvedValue({
      data: { user: MOCK_USER, session: MOCK_SESSION },
      error: null,
    })
    mockFromInsert.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useAuth())
    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.signUp('a@b.com', 'password123', 'Alice Smith')
    })

    expect(res?.error).toBeNull()
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com' }),
    )
  })

  it('returns mapped error when supabase errors', async () => {
    const useAuth = await getHook()
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    })

    const { result } = renderHook(() => useAuth())
    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.signUp('existing@b.com', 'pw', 'Bob')
    })

    expect(res?.error).toContain('already exists')
  })
})
