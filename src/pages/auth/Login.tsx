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
          emailRedirectTo: window.location.origin + (searchParams.get('returnTo') || '/dashboard'),
        },
      })
      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('rate limit') || msg.includes('too many')) {
          setErrorMessage('Try again in a moment.')
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
  }, [email, submitting, searchParams])

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
  const buttonSize     = isMobile ? 52 : 56
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
              right: buttonSize + 20,
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
              The line ENDS just before the circle's left edge — the circle
              is the period at the end of the line, not a stamp on top of it.
              We can't extend the line under the button: the button sits at
              0.45 opacity until the email parses valid, and a translucent
              circle would let the line bleed through the arrow.
              On hover the line creeps a few pixels closer to the circle —
              a tiny "the arrow leads you out" cue. */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: isHovering && !submitting ? buttonSize + 4 : buttonSize + 10,
            bottom: 0,
            height: 1,
            background: SS_FG1,
            transition: 'right 160ms cubic-bezier(0.32, 0.72, 0, 1)',
          }} />

          {/* Circle button — center sits ON the line.
              Three feedback layers compose the "alive" feel:
              1. Opacity: 0.45 idle → 1.0 once email parses valid (the
                 circle "wakes up" the instant you finish typing).
              2. Hover: 5px slide right with a fast ease — feels like
                 the arrow physically leans toward its destination.
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
              bottom: -(buttonSize / 2),
              width: buttonSize,
              height: buttonSize,
              background: SS_FG1,
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: submitting ? 'wait' : 'pointer',
              transform: isPressed
                ? 'scale(0.96)'
                : isHovering && !submitting
                  ? 'translateX(5px)'
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

      {/* ─── SSO Link ────────────────────────────────────── */}
      <a
        href="#/login/sso"
        aria-label="Use single sign-on"
        style={{
          position: 'absolute',
          bottom: isMobile ? 64 : 56,
          left: 0, right: 0,
          display: 'flex',
          justifyContent: 'center',
          font: `400 12px/1 ${FONT}`,
          color: SS_FG3,
          letterSpacing: '0.01em',
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        Use single sign-on
      </a>

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
