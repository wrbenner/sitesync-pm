import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────
const signInMock = vi.fn()

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOtp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(),
  },
  isSupabaseConfigured: true,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ signIn: signInMock }),
}))

// Import AFTER mocks
import { Login } from '../Login'

function wrap(ui: React.ReactElement) {
  return <MemoryRouter>{ui}</MemoryRouter>
}

describe('Login', () => {
  beforeEach(() => {
    signInMock.mockReset()
    signInMock.mockResolvedValue({ error: null })
  })

  it('renders email and password fields', () => {
    render(wrap(<Login />))
    expect(screen.getByLabelText(/email address/i)).toBeDefined()
    expect(screen.getByLabelText(/^password$/i)).toBeDefined()
  })

  it('shows Zod validation errors for empty fields on submit', async () => {
    render(wrap(<Login />))
    const form = screen.getByRole('form', { name: /sign in to sitesync/i })
    // Bypass native HTML5 validation by submitting the form directly
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    })
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('shows Zod validation error for invalid email', async () => {
    render(wrap(<Login />))
    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    const form = screen.getByRole('form', { name: /sign in to sitesync/i })
    fireEvent.submit(form)
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const hasEmailError = alerts.some((el) =>
        /valid email/i.test(el.textContent || '')
      )
      expect(hasEmailError).toBe(true)
    })
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('calls auth signIn with valid data on submit', async () => {
    render(wrap(<Login />))
    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'secretpw' } })
    const form = screen.getByRole('form', { name: /sign in to sitesync/i })
    fireEvent.submit(form)
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('user@example.com', 'secretpw')
    })
  })
})
