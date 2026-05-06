/* Shared atoms for SiteSync login mockups.
   These are mockup-only — no real auth, no real validation.
   They reproduce the codebase's PremiumInput/PremiumButton visual language
   so the four directions read as production-credible. */

const SS_ORANGE = '#F47820';
const SS_ORANGE_HOVER = '#E06A10';
const SS_FG1 = '#1A1613';
const SS_FG2 = '#5C5550';
const SS_FG3 = '#767170';
const SS_BORDER = '#E5E1DC';
const SS_BORDER_SUBTLE = '#F0EDE9';
const SS_BG_PAGE = '#FAFAF8';
const SS_BG_INSET = '#F3EFEC';
const SS_INDIGO = '#4F46E5';

/* Tiny inline icons — small set, drawn to lucide spec. */
function Icon({ name, size = 16, stroke = SS_FG3, sw = 1.75, style }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'inline-block', verticalAlign: 'middle', ...style } };
  switch (name) {
    case 'mail': return <svg {...common}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>;
    case 'lock': return <svg {...common}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case 'eye':  return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'arrow-right': return <svg {...common}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;
    case 'sparkle': return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'check': return <svg {...common}><path d="M20 6 9 17l-5-5"/></svg>;
    case 'shield': return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>;
    case 'hard-hat': return <svg {...common}><path d="M2 18h20"/><path d="M4 18v-3a8 8 0 0 1 16 0v3"/><path d="M10 6V4a2 2 0 0 1 4 0v2"/></svg>;
    case 'chart': return <svg {...common}><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-5"/></svg>;
    case 'file-check': return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>;
    case 'cloud': return <svg {...common}><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8 6.5 6.5 0 0 0-12.6 2.3A4 4 0 0 0 5 19h12.5Z"/></svg>;
    default: return null;
  }
}

/* Google G mark — actual Google colors, used only on the SSO button. */
function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.3C4.68 5.18 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

function AppleMark({ size = 18, color = SS_FG1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M16.365 1.43c0 1.14-.41 2.21-1.23 3.21-.99 1.18-2.18 1.86-3.47 1.76-.16-1.14.4-2.32 1.21-3.16.91-.95 2.42-1.65 3.49-1.81zm4.21 16.53c-.6 1.34-.89 1.94-1.66 3.13-1.07 1.66-2.59 3.73-4.46 3.74-1.66.02-2.09-1.08-4.36-1.07-2.27.01-2.74 1.09-4.41 1.07-1.87-.02-3.3-1.88-4.38-3.55-3.01-4.7-3.32-10.21-1.47-13.15.7-1.13 2.42-3.27 5.11-3.27 1.99 0 3.07 1.09 4.66 1.09 1.55 0 2.49-1.09 4.79-1.09 2.41 0 4.41 1.31 5.66 3.31-3.6 1.97-3.01 7.11.71 9.79z"/>
    </svg>
  );
}

/* Reusable input */
function Field({ label, type = 'text', value, placeholder, icon, focus = false, error, rightSlot, dark = false }) {
  const labelColor = error ? '#C93B3B' : focus ? (dark ? 'rgba(255,255,255,0.92)' : SS_FG1) : (dark ? 'rgba(255,255,255,0.6)' : SS_FG2);
  const borderColor = error ? '#C93B3B' : focus ? SS_ORANGE : (dark ? 'rgba(255,255,255,0.14)' : SS_BORDER);
  const bg = dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
  const fg = dark ? 'rgba(255,255,255,0.92)' : SS_FG1;
  return (
    <div style={{ width: '100%' }}>
      <label style={{
        display: 'block', fontSize: 13, fontWeight: 500, color: labelColor,
        marginBottom: 6, letterSpacing: 0.01, transition: 'color 120ms ease',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: focus ? SS_ORANGE : (error ? '#C93B3B' : (dark ? 'rgba(255,255,255,0.45)' : SS_FG3)),
            pointerEvents: 'none', display: 'flex', }}>
            <Icon name={icon} size={16} stroke="currentColor" sw={1.75}/>
          </span>
        )}
        <input
          readOnly
          type={type}
          defaultValue={value}
          placeholder={placeholder}
          style={{
            width: '100%', height: 48,
            padding: `0 ${rightSlot ? 44 : 14}px 0 ${icon ? 40 : 14}px`,
            background: bg,
            border: `${focus ? 1.5 : 1}px solid ${borderColor}`,
            borderRadius: 8,
            fontSize: 14, fontFamily: 'Inter, sans-serif',
            letterSpacing: '-0.011em', color: fg,
            boxSizing: 'border-box', outline: 'none',
            boxShadow: focus ? `0 0 0 4px ${dark ? 'rgba(244,120,32,0.18)' : 'rgba(244,120,32,0.10)'}` : 'none',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
          }}
        />
        {rightSlot && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            {rightSlot}
          </span>
        )}
      </div>
      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#C93B3B' }}>{error}</div>
      )}
    </div>
  );
}

/* Primary CTA */
function PrimaryButton({ children, glow = true, full = true, height = 48, withArrow = true }) {
  return (
    <button style={{
      width: full ? '100%' : undefined,
      height, padding: '0 24px',
      background: SS_ORANGE, color: '#fff',
      border: 'none', borderRadius: 8,
      font: '600 14px/1 Inter, sans-serif',
      letterSpacing: '-0.011em',
      whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      boxShadow: glow ? '0 4px 24px rgba(244,120,32,0.28), 0 1px 2px rgba(0,0,0,0.06)' : '0 1px 2px rgba(0,0,0,0.06)',
      cursor: 'pointer', transition: 'background 160ms ease',
    }}>
      <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
      {withArrow && <Icon name="arrow-right" size={16} stroke="#fff" sw={2}/>}
    </button>
  );
}

/* SSO buttons */
function SSOButton({ provider = 'google', dark = false, label }) {
  const isGoogle = provider === 'google';
  return (
    <button style={{
      width: '100%', height: 44, padding: '0 14px',
      background: dark ? 'rgba(255,255,255,0.04)' : '#fff',
      color: dark ? 'rgba(255,255,255,0.92)' : SS_FG1,
      border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : SS_BORDER}`,
      borderRadius: 8,
      font: '500 14px/1 Inter, sans-serif',
      letterSpacing: '-0.011em',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      cursor: 'pointer',
    }}>
      {isGoogle ? <GoogleG size={18}/> : <AppleMark size={18} color={dark ? '#fff' : SS_FG1}/>}
      {label || (isGoogle ? 'Continue with Google' : 'Continue with Apple')}
    </button>
  );
}

/* Logo helpers — paths relative to login html files */
function LogoHorizontal({ height = 28, white = false }) {
  const src = white ? '../../../assets/logos/sitesync-horizontal-white.png' : '../../../assets/logos/sitesync-horizontal.png';
  return <img src={src} alt="SiteSync" style={{ height, width: 'auto', display: 'block' }}/>;
}
function LogoSymbol({ size = 32, white = false }) {
  const src = white ? '../../../assets/logos/sitesync-symbol-white.png' : '../../../assets/logos/sitesync-symbol.png';
  return <img src={src} alt="SiteSync" style={{ height: size, width: 'auto', display: 'block' }}/>;
}

/* "PM" pill — small orange badge as described in brief */
function PMBadge({ size = 'sm' }) {
  const h = size === 'sm' ? 18 : 22;
  const fs = size === 'sm' ? 10 : 12;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: h, padding: '0 7px', borderRadius: 5,
      background: SS_ORANGE, color: '#fff',
      font: `700 ${fs}px/1 Inter, sans-serif`,
      letterSpacing: '0.04em',
    }}>PM</span>
  );
}

/* Divider with label */
function OrDivider({ dark = false }) {
  const c = dark ? 'rgba(255,255,255,0.12)' : SS_BORDER_SUBTLE;
  const tc = dark ? 'rgba(255,255,255,0.45)' : SS_FG3;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: c }}/>
      <div style={{ font: '500 11px/1 Inter, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: tc }}>or</div>
      <div style={{ flex: 1, height: 1, background: c }}/>
    </div>
  );
}

/* Mobile frame — simple white phone bezel for 390×844 mockups */
function MobileFrame({ children, dark = false }) {
  return (
    <div style={{
      width: 390, height: 844,
      background: dark ? '#0C0D0F' : SS_BG_PAGE,
      overflow: 'hidden',
      position: 'relative',
      fontFamily: 'Inter, sans-serif',
      color: dark ? 'rgba(255,255,255,0.92)' : SS_FG1,
    }}>
      {/* status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 47,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px 0 32px',
        font: '600 15px/1 -apple-system, BlinkMacSystemFont, Inter, sans-serif',
        color: dark ? '#fff' : SS_FG1,
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <span>9:41</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {/* signal */}
          <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.5"/><rect x="5" y="5" width="3" height="6" rx="0.5"/><rect x="10" y="2" width="3" height="9" rx="0.5"/><rect x="15" y="0" width="3" height="11" rx="0.5"/></svg>
          {/* battery */}
          <svg width="27" height="12" viewBox="0 0 27 12" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke="currentColor" opacity="0.45"/><rect x="2" y="2" width="19" height="8" rx="1.5" fill="currentColor"/><rect x="24" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.45"/></svg>
        </span>
      </div>
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
      {/* home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 3,
        background: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)',
        zIndex: 10,
      }}/>
    </div>
  );
}

/* Desktop frame — flat 1440×900 surface for the canvas */
function DesktopFrame({ children, dark = false, style = {} }) {
  return (
    <div style={{
      width: 1440, height: 900,
      background: dark ? '#0C0D0F' : SS_BG_PAGE,
      fontFamily: 'Inter, sans-serif',
      color: dark ? 'rgba(255,255,255,0.92)' : SS_FG1,
      letterSpacing: '-0.011em',
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, {
  Icon, GoogleG, AppleMark, Field, PrimaryButton, SSOButton,
  LogoHorizontal, LogoSymbol, PMBadge, OrDivider, MobileFrame, DesktopFrame,
  SS_ORANGE, SS_ORANGE_HOVER, SS_FG1, SS_FG2, SS_FG3, SS_BORDER,
  SS_BORDER_SUBTLE, SS_BG_PAGE, SS_BG_INSET, SS_INDIGO,
});
