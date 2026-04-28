import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────
const { signInWithOtpMock, signInWithOAuthMock } = vi.hoisted(() => ({
  signInWithOtpMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOtp: signInWithOtpMock,
      signInWithOAuth: signInWithOAuthMock,
      resetPasswordForEmail: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(),
  },
  isSupabaseConfigured: true,
}))

// Import AFTER mocks
import { Login } from '../Login'

function wrap(ui: React.ReactElement) {
  return <MemoryRouter>{ui}</MemoryRouter>
}

describe('Login (magic-link + OAuth)', () => {
  beforeEach(() => {
    signInWithOtpMock.mockReset()
    signInWithOtpMock.mockResolvedValue({ error: null })
    signInWithOAuthMock.mockReset()
    signInWithOAuthMock.mockResolvedValue({ error: null })
  })

  it('renders the email input and the OAuth provider buttons', () => {
    render(wrap(<Login />))
    expect(screen.getByLabelText(/^email$/i)).toBeDefined()
    expect(screen.getByLabelText(/continue with google/i)).toBeDefined()
    expect(screen.getByLabelText(/continue with microsoft/i)).toBeDefined()
  })

  it('does not call signInWithOtp on empty submit (Zod blocks it)', async () => {
    render(wrap(<Login />))
    const form = screen.getByRole('form', { name: /sign in with email/i })
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })
    expect(signInWithOtpMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid email format', async () => {
    render(wrap(<Login />))
    const input = screen.getByLabelText(/^email$/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-an-email' } })
    fireEvent.submit(screen.getByRole('form', { name: /sign in with email/i }))
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(/valid email/i.test(alert.textContent || '')).toBe(true)
    })
    expect(signInWithOtpMock).not.toHaveBeenCalled()
  })

  it('sends a magic link for a valid email', async () => {
    render(wrap(<Login />))
    const input = screen.getByLabelText(/^email$/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'user@example.com' } })
    fireEvent.submit(screen.getByRole('form', { name: /sign in with email/i }))
    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'user@example.com',
      }))
    })
  })

  it('starts the Google OAuth flow when the Google button is clicked', async () => {
    render(wrap(<Login />))
    fireEvent.click(screen.getByLabelText(/continue with google/i))
    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'google',
      }))
    })
  })

  it('starts the Microsoft (azure) OAuth flow when the Microsoft button is clicked', async () => {
    render(wrap(<Login />))
    fireEvent.click(screen.getByLabelText(/continue with microsoft/i))
    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'azure',
      }))
    })
  })
})
