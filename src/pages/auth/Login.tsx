/**
 * Login — "The Threshold"
 *
 * Direction 1 Minimal: Da Vinci x Jobs.
 *
 * Construction metaphor:
 *   The page's level line is the FLOOR. The field's underline IS the
 *   level line. Email text sits above the line (where text always sits).
 *   The line ends in the black circle (the period at the end).
 *
 * Greeting states (via localStorage):
 *   hello  — recognized device, name stored   → "Good morning, Alex."
 *   back   — returning flag, no name          → "Welcome back."
 *   time   — (fallback) time-of-day only      → "Good morning."
 *   first  — first-time visitor               → "Welcome."
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { magicLinkSchema } from '../../schemas/auth'

// ── Design Tokens (raw values — this page opts out of CSS vars for
//    pixel-perfect control on the only page that lives OUTSIDE the app shell) ──

const SS_BG    = '#FAFAF8'
const SS_FG1   = '#1A1613'
const SS_FG3   = '#767170'
const SS_ORANGE = '#F47820'

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

// ── Greeting Logic ──────────────────────────────────────

interface GreetingState {
  kind: 'named' | 'plain'
  prefix?: string
  name?: string
  text?: string
}

function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function useGreetingState(): GreetingState {
  const tod = getTimeOfDay()
  try {
    const name = localStorage.getItem('ss:last-name')
    const returning = localStorage.getItem('ss:returning')
    if (name) return { kind: 'named', prefix: tod, name }
    if (returning) return { kind: 'plain', text: 'Welcome back.' }
  } catch {
    // localStorage unavailable — first visit
  }
  return { kind: 'plain', text: 'Welcome.' }
}

// ── Logo Symbol ─────────────────────────────────────────

const LogoSymbol: React.FC<{ size: number }> = ({ size }) => (
  <img
    src={`${import.meta.env.BASE_URL}logos/sitesync-symbol.png`}
    alt="SiteSync"
    width={size}
    height={size}
    style={{ display: 'block', objectFit: 'contain' }}
  />
)

// ── Arrow Icon ──────────────────────────────────────────

const ArrowRightIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2.25}
    strokeLinecap="square"
    strokeLinejoin="miter"
    style={{ display: 'block' }}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

// ── Provider Logos (brand-correct, official palettes) ───

const GoogleGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" style={{ display: 'block' }}>
    <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
)

const MicrosoftGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" style={{ display: 'block' }}>
    <rect x="0"  y="0"  width="8" height="8" fill="#F25022" />
    <rect x="10" y="0"  width="8" height="8" fill="#7FBA00" />
    <rect x="0"  y="10" width="8" height="8" fill="#00A4EF" />
    <rect x="10" y="10" width="8" height="8" fill="#FFB900" />
  </svg>
)

// ── OAuth Button ────────────────────────────────────────

interface OAuthButtonProps {
  label: string
  short: string
  icon: React.ReactNode
  onClick: () => void
  pending: boolean
  disabled: boolean
  isMobile: boolean
}

const OAuthButton: React.FC<OAuthButtonProps> = ({
  label, short, icon, onClick, pending, disabled, isMobile,
}) => {
  const [isHovering, setIsHovering] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      onMouseEnter={() => !disabled && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        flex: 1,
        height: 44,
        background: '#FFFFFF',
        border: `1px solid ${isHovering && !disabled ? 'rgba(26,22,19,0.32)' : 'rgba(26,22,19,0.14)'}`,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !pending ? 0.55 : 1,
        font: `500 13.5px/1 "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
        letterSpacing: '-0.005em',
        color: '#1A1613',
        padding: '0 14px',
        transition: 'border-color 160ms ease, opacity 200ms ease',
        boxShadow: isHovering && !disabled ? '0 1px 2px rgba(26,22,19,0.04)' : 'none',
      }}
    >
      {pending ? (
        <span aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ animation: 'ss-spin 0.8s linear infinite' }}>
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          Connecting…
        </span>
      ) : (
        <>
          {icon}
          <span>{isMobile ? label : short}</span>
        </>
      )}
    </button>
  )
}

// ── Greeting Component ──────────────────────────────────

const Greeting: React.FC<{ size: number }> = ({ size }) => {
  const g = useGreetingState()
  const sty: React.CSSProperties = {
    font: `500 ${size}px/1 ${FONT}`,
    letterSpacing: size >= 36 ? '-0.035em' : '-0.030em',
    color: SS_FG1,
    margin: 0,
    marginBottom: size === 36 ? 40 : 36,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  }
  if (g.kind === 'plain') return <h1 style={sty}>{g.text}</h1>
  return (
    <h1 style={sty}>
      {g.prefix},{' '}
      <span style={{ fontStyle: 'italic', fontWeight: 400 }}>{g.name}</span>.
    </h1>
  )
}

// ── Check Your Inbox (success state) ────────────────────

const CheckInbox: React.FC<{ email: string; onBack: () => void }> = ({ email, onBack }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
    style={{ textAlign: 'center' }}
  >
    {/* Checkmark circle */}
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      style={{
        width: 56, height: 56, borderRadius: '50%',
        backgroundColor: SS_FG1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
      }}
    >
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </motion.div>

    <h2 style={{
      font: `500 28px/1.2 ${FONT}`,
      letterSpacing: '-0.025em',
      color: SS_FG1,
      margin: '0 0 12px',
    }}>
      Check your inbox.
    </h2>

    <p style={{
      font: `400 14px/1.6 ${FONT}`,
      color: SS_FG3,
      margin: '0 0 8px',
      letterSpacing: '-0.005em',
    }}>
      We sent a sign-in link to
    </p>
    <p style={{
      font: `500 14px/1.6 ${FONT}`,
      color: SS_FG1,
      margin: '0 0 32px',
      letterSpacing: '-0.005em',
    }}>
      {email}
    </p>

    <button
      onClick={onBack}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        font: `400 13px/1 ${FONT}`,
        color: SS_FG3,
        letterSpacing: '-0.005em',
        padding: '8px 0',
      }}
    >
      Use a different email
    </button>
  </motion.div>
)

// ── Main Login Component ────────────────────────────────

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [oauthPending, setOauthPending] = useState<null | 'google' | 'azure'>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isPressed, setIsPressed] = useState(false)

  // Validity is parsed live so the circle "wakes up" the moment the
  // user finishes typing a credible address. Empty input keeps the
  // circle dimmed, which makes the affordance read as "not ready yet"
  // without forcing a separate disabled visual.
  const isValid = magicLinkSchema.safeParse({ email }).success

  const inputRef = useRef<HTMLInputElement>(null)

  // Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Focus input on mount
  useEffect(() => {
    // Small delay to let the entrance animation settle
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])

  // ── Redirect URL helper ─────────────────────────────────
  // Lands the user back at the app root, including Vite's base path
  // (`/sitesync-pm/` in dev, `/` on Vercel). We can't append a hash
  // route here because supabase overwrites the URL fragment with auth
  // tokens; instead we rely on detectSessionInUrl + ProtectedRoute to
  // get the user from "/" to "/dashboard" once the session lands.
  // returnTo (if present) is stashed in sessionStorage so the global
  // SIGNED_IN handler can navigate after the auth state settles.
  const buildRedirectUrl = useCallback(() => {
    const baseUrl = import.meta.env.BASE_URL || '/'
    const returnTo = searchParams.get('returnTo')
    if (returnTo) {
      try { sessionStorage.setItem('ss:returnTo', returnTo) } catch { /* noop */ }
    }
    return window.location.origin + baseUrl
  }, [searchParams])

  // ── Submit Handler ────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    setErrorMessage(null)

    // Validate
    const parsed = magicLinkSchema.safeParse({ email })
    if (!parsed.success) {
      const fieldErr = parsed.error.flatten().fieldErrors.email?.[0]
      setErrorMessage(fieldErr ?? 'Check your spelling and try again.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          emailRedirectTo: buildRedirectUrl(),
        },
      })
      if (error) {
        const raw = error.message
        const msg = raw.toLowerCase()
        if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('security purposes')) {
          // Supabase commonly returns "For security purposes, you can only
          // request this after N seconds." — surface N when present so the
          // user knows whether to wait 30s or come back tomorrow.
          const secondsMatch = raw.match(/(\d+)\s*second/i)
          if (secondsMatch) {
            const s = Number(secondsMatch[1])
            setErrorMessage(`Too many requests. Try again in ${s} second${s === 1 ? '' : 's'}.`)
          } else {
            setErrorMessage('Too many requests. Try again in about a minute, or use Google / Microsoft.')
          }
        } else if (msg.includes('not found') || msg.includes('invalid')) {
          setErrorMessage("We couldn't find that address.")
        } else {
          setErrorMessage('Something went wrong. Try again.')
        }
      } else {
        setSuccess(true)
      }
    } catch {
      setErrorMessage('Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }, [email, submitting, buildRedirectUrl])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setEmail('')
      setErrorMessage(null)
    }
  }, [handleSubmit])

  // ── OAuth Handler ────────────────────────────────────
  // Hands the browser off to the provider's consent screen. On success
  // the provider redirects back to redirectTo with tokens in the URL
  // fragment; supabase's `detectSessionInUrl: true` picks them up and
  // fires SIGNED_IN, which the global onAuthStateChange listener handles
  // (see hooks/useAuth.ts). This function never returns to a rendered
  // success state — the page navigates away mid-call.
  const signInWithProvider = useCallback(async (provider: 'google' | 'azure') => {
    if (oauthPending || submitting) return
    setErrorMessage(null)
    setOauthPending(provider)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: buildRedirectUrl(),
        },
      })
      if (error) {
        setOauthPending(null)
        const friendly = provider === 'azure' ? 'Microsoft' : 'Google'
        setErrorMessage(`We couldn't reach ${friendly}. Try again.`)
      }
    } catch {
      setOauthPending(null)
      setErrorMessage('Check your connection and try again.')
    }
  }, [oauthPending, submitting, buildRedirectUrl])

  // ── Measurements ──────────────────────────────────────
  //
  // Desktop column: 24(mark) + 56(gap) + 36(h1) + 40(gap) + 56(field) = 212
  //   → translateY(-212px) from page 50% puts field-bottom at center.
  //
  // Mobile column:  22(mark) + 44(gap) + 28(h1) + 36(gap) + 52(field) = 182
  //   → translateY(-182px) from page 50%.

  const markSize       = isMobile ? 22 : 24
  const markGap        = isMobile ? 44 : 56
  const greetingSize   = isMobile ? 28 : 36
  const fieldHeight    = isMobile ? 52 : 56
  const pillWidth      = isMobile ? 60 : 68
  const pillHeight     = isMobile ? 34 : 38
  const columnOffset   = isMobile ? 182 : 212
  const columnWidth    = isMobile ? undefined : 360
  const pagePadding    = isMobile ? 32 : 0

  // Level line widths
  const lineSideWidth  = isMobile ? '24px' : 'calc(50% - 240px)'

  // ── Success State ─────────────────────────────────────

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: SS_BG,
        fontFamily: FONT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}>
        <CheckInbox email={email} onBack={() => { setSuccess(false); setEmail('') }} />
      </div>
    )
  }

  // ── Main Render ───────────────────────────────────────

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        backgroundColor: SS_BG,
        fontFamily: FONT,
        overflow: 'hidden',
      }}
      role="main"
      aria-label="Sign in to SiteSync"
    >
      {/* The global *:focus-visible rule paints a 2px orange ring around
          any focused element. This page's input auto-focuses on mount and
          is supposed to render as a bare underline — so we scope a rule
          that nukes the ring on this page's input only. */}
      <style>{`
        .ss-login-input:focus,
        .ss-login-input:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }
        @keyframes ss-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ─── Form Column ────────────────────────────────
          Outer non-motion <div> owns positioning — `position: absolute`
          + `translate(-50%, ...)` to center horizontally and lift to the
          composed level-line height. Framer-motion's animated transform
          would otherwise override our centering translate, slamming the
          column 50% to the right of the viewport. The inner motion.div
          carries only opacity/y enter animation. */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          ...(isMobile
            ? { left: pagePadding, right: pagePadding, transform: `translateY(-${columnOffset}px)` }
            : { left: '50%', width: columnWidth, transform: `translate(-50%, -${columnOffset}px)` }
          ),
        }}
      >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Mark */}
        <div style={{ marginBottom: markGap }}>
          <LogoSymbol size={markSize} />
        </div>

        {/* Greeting */}
        <Greeting size={greetingSize} />

        {/* ─── Field Block ─────────────────────────────── */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          style={{
            width: '100%',
            height: fieldHeight,
            position: 'relative',
          }}
          aria-label="Sign in with email"
        >
          {/* Email input — sits ABOVE the line */}
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errorMessage) setErrorMessage(null)
            }}
            onKeyDown={handleKeyDown}
            aria-label="Email"
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? 'login-error' : undefined}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            disabled={submitting}
            placeholder=""
            className="ss-login-input"
            style={{
              position: 'absolute',
              left: 0,
              right: pillWidth + 16,
              top: 0,
              bottom: 1,
              width: 'auto',
              padding: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              borderRadius: 0,
              font: `400 ${isMobile ? 16 : 17}px/1 ${FONT}`,
              letterSpacing: '-0.011em',
              color: SS_FG1,
              caretColor: SS_FG1,
              // iOS: 16px minimum prevents auto-zoom on focus
            }}
          />

          {/* Underline = the level line at field-bottom.
              The pill now floats ABOVE the line (at the input's vertical
              middle), so the line runs uninterrupted across the full field
              width — no more arrow-through-line collision. */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            background: SS_FG1,
          }} />

          {/* Pill button — sits in the middle of the typed-email row,
              above the line. Three feedback layers:
              1. Opacity: 0.45 idle → 1.0 once email parses valid.
              2. Hover: 4px slide right — the arrow leans toward its destination.
              3. Press: scale 0.96 — tactile click moment. */}
          <button
            type="submit"
            aria-label="Continue"
            disabled={submitting}
            onMouseEnter={() => !submitting && setIsHovering(true)}
            onMouseLeave={() => { setIsHovering(false); setIsPressed(false) }}
            onMouseDown={() => !submitting && setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onTouchStart={() => !submitting && setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            style={{
              position: 'absolute',
              right: 0,
              top: (fieldHeight - pillHeight) / 2,
              width: pillWidth,
              height: pillHeight,
              background: SS_FG1,
              color: '#fff',
              border: 'none',
              borderRadius: pillHeight / 2,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: submitting ? 'wait' : 'pointer',
              transform: isPressed
                ? 'scale(0.96)'
                : isHovering && !submitting
                  ? 'translateX(4px)'
                  : 'translateX(0)',
              transition: 'transform 80ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease',
              zIndex: 2,
              opacity: submitting ? 0.7 : isValid ? 1 : 0.45,
            }}
          >
            {submitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </motion.div>
            ) : (
              <ArrowRightIcon size={isMobile ? 17 : 18} color="#fff" />
            )}
          </button>
        </form>

        {/* ─── Hint / Error Slot ─────────────────────────── */}
        <div style={{ height: 40 }} />
        <div
          id="login-error"
          role={errorMessage ? 'alert' : undefined}
          style={{
            font: `400 13px/1.6 ${FONT}`,
            color: SS_FG3,
            letterSpacing: '-0.005em',
            textAlign: 'center',
            minHeight: '1.6em',
            transition: 'opacity 200ms ease',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={errorMessage || 'hint'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {errorMessage || "We'll send a sign-in link."}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* ─── OAuth Divider ──────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          width: '100%',
          marginTop: 28,
          marginBottom: 18,
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(26,22,19,0.10)' }} />
          <span style={{
            font: `400 11px/1 ${FONT}`,
            color: SS_FG3,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}>
            or
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(26,22,19,0.10)' }} />
        </div>

        {/* ─── OAuth Row ──────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 10,
          width: '100%',
        }}>
          <OAuthButton
            label="Continue with Google"
            short="Google"
            icon={<GoogleGlyph size={18} />}
            onClick={() => signInWithProvider('google')}
            pending={oauthPending === 'google'}
            disabled={!!oauthPending || submitting}
            isMobile={isMobile}
          />
          <OAuthButton
            label="Continue with Microsoft"
            short="Microsoft"
            icon={<MicrosoftGlyph size={18} />}
            onClick={() => signInWithProvider('azure')}
            pending={oauthPending === 'azure'}
            disabled={!!oauthPending || submitting}
            isMobile={isMobile}
          />
        </div>
      </motion.div>
      </div>

      {/* ─── Level Lines (extend from form to page edges) ─── */}
      {/* Left */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          width: lineSideWidth,
          height: 1,
          transform: 'translateY(-0.5px)',
          background: 'linear-gradient(to right, transparent 0%, rgba(26,22,19,0.07) 100%)',
          pointerEvents: 'none',
        }}
      />
      {/* Right */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          right: 0,
          width: lineSideWidth,
          height: 1,
          transform: 'translateY(-0.5px)',
          background: 'linear-gradient(to left, transparent 0%, rgba(26,22,19,0.07) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ─── Surveyor's Dot ──────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: isMobile ? 68 : 60,
          right: isMobile ? 32 : 56,
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: SS_ORANGE,
        }}
      />
    </div>
  )
}
