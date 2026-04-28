/* Direction 1 v4 — "The Threshold"
   Da Vinci × Jobs.

   Construction metaphor (corrected):
     The page's level line is the FLOOR. The field's underline IS the
     level line. Email text sits above the line (where text always sits).
     The line ends in the black circle (the period at the end).

   Greeting states (via URL ?g=…):
     g=hello (default)  "Good morning, Alex." — recognized device
     g=first            "Welcome."             — first-time visitor
     g=time             "Good morning."        — recognized client, no name
     g=back             "Welcome back."        — signed-out from this device
*/

function useGreetingState() {
  // URL ?g=...
  const p = new URLSearchParams(location.search);
  const mode = p.get('g') || 'hello';
  const hour = new Date().getHours();
  const tod = hour < 5 ? 'Good evening'
            : hour < 12 ? 'Good morning'
            : hour < 18 ? 'Good afternoon'
            : 'Good evening';
  if (mode === 'first') return { kind: 'plain', text: 'Welcome.' };
  if (mode === 'back')  return { kind: 'plain', text: 'Welcome back.' };
  if (mode === 'time')  return { kind: 'plain', text: tod + '.' };
  return { kind: 'named', prefix: tod, name: 'Alex' };
}

function Greeting({ size }) {
  // size: 36 (desktop) or 28 (mobile)
  const g = useGreetingState();
  const sty = {
    font: `500 ${size}px/1 Inter, sans-serif`,
    letterSpacing: '-0.035em',
    color: SS_FG1,
    margin: 0, marginBottom: size === 36 ? 40 : 36,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };
  if (g.kind === 'plain') return <h1 style={sty}>{g.text}</h1>;
  return (
    <h1 style={sty}>
      {g.prefix}, <span style={{ fontStyle: 'italic', fontWeight: 400 }}>{g.name}</span>.
    </h1>
  );
}

function MinimalDesktop() {
  return (
    <DesktopFrame>
      {/* Form column anchored so the FIELD'S BOTTOM (the line) sits at the
          page's vertical 50%.
          Column from top: 24 (mark) + 56 + 36 (h1) + 40 + 56 (field) = 212
          Field-bottom is 212 from column-top. We translate(-50%, -212px)
          so that the line lands precisely at page 50%. */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 360,
        transform: 'translate(-50%, -212px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ marginBottom: 56 }}>
          <LogoSymbol size={24}/>
        </div>

        <Greeting size={36}/>

        {/* Field — text sits ABOVE the line. The line is the floor. */}
        <div style={{
          width: '100%', height: 56,
          position: 'relative',
        }}>
          <input
            readOnly
            type="email"
            defaultValue="alex@horizonbuilders.co"
            style={{
              position: 'absolute', left: 0, right: 76, top: 0, bottom: 1,
              width: 'auto',
              padding: 0,
              background: 'transparent',
              border: 'none', outline: 'none', borderRadius: 0,
              font: '400 17px/1 Inter, sans-serif',
              letterSpacing: '-0.011em',
              color: SS_FG1,
            }}
          />
          {/* Field's underline = the page's level line, at field-bottom. */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 1, background: SS_FG1,
          }}/>

          {/* Circle button — center sits ON the line (line passes through
              its diameter). Stacked above the line so the line appears to
              terminate INTO the circle. */}
          <button
            aria-label="Continue"
            style={{
              position: 'absolute', right: 0, bottom: -28,
              width: 56, height: 56,
              background: SS_FG1, color: '#fff',
              border: 'none', borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 220ms cubic-bezier(0.32,0.72,0,1)',
              zIndex: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(3px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; }}
          >
            <Icon name="arrow-right" size={18} stroke="#fff" sw={1.5}/>
          </button>
        </div>

        <div style={{ height: 40 }}/>
        <div style={{
          font: '400 13px/1.6 Inter, sans-serif',
          color: SS_FG3,
          letterSpacing: '-0.005em',
          textAlign: 'center',
        }}>
          We'll send a sign-in link.
        </div>
      </div>

      {/* The level line continues across the page on the same y as the
          field's underline — i.e. page 50%. */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, width: 'calc(50% - 240px)',
        height: 1, transform: 'translateY(-0.5px)',
        background: 'linear-gradient(to right, transparent 0%, rgba(26,22,19,0.07) 100%)',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: '50%', right: 0, width: 'calc(50% - 240px)',
        height: 1, transform: 'translateY(-0.5px)',
        background: 'linear-gradient(to left, transparent 0%, rgba(26,22,19,0.07) 100%)',
        pointerEvents: 'none',
      }}/>

      <div style={{
        position: 'absolute', bottom: 56, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        font: '400 12px/1 Inter, sans-serif', color: SS_FG3,
        letterSpacing: '0.01em',
      }}>
        <a style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>Use single sign-on</a>
      </div>

      <div style={{
        position: 'absolute', bottom: 60, right: 56,
        width: 4, height: 4, borderRadius: '50%',
        background: SS_ORANGE,
      }}/>
    </DesktopFrame>
  );
}

function MinimalMobile() {
  return (
    <MobileFrame>
      {/* Column from top: 22 (mark) + 44 + 28 (h1) + 36 + 52 (field) = 182.
          translateY(-182px) puts field-bottom at page 50%. */}
      <div style={{
        position: 'absolute',
        top: '50%', left: 32, right: 32,
        transform: 'translateY(-182px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ marginBottom: 44 }}>
          <LogoSymbol size={22}/>
        </div>

        <Greeting size={28}/>

        <div style={{ width: '100%', height: 52, position: 'relative' }}>
          <input
            readOnly
            type="email"
            defaultValue="alex@horizonbuilders.co"
            style={{
              position: 'absolute', left: 0, right: 68, top: 0, bottom: 1,
              padding: 0, background: 'transparent',
              border: 'none', outline: 'none', borderRadius: 0,
              font: '400 16px/1 Inter, sans-serif',
              letterSpacing: '-0.011em', color: SS_FG1,
            }}
          />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: SS_FG1 }}/>
          <button
            aria-label="Continue"
            style={{
              position: 'absolute', right: 0, bottom: -26,
              width: 52, height: 52,
              background: SS_FG1, color: '#fff',
              border: 'none', borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2,
            }}>
            <Icon name="arrow-right" size={17} stroke="#fff" sw={1.5}/>
          </button>
        </div>

        <div style={{ height: 36 }}/>
        <div style={{
          font: '400 13px/1.6 Inter, sans-serif', color: SS_FG3,
          letterSpacing: '-0.005em', textAlign: 'center',
        }}>
          We'll send a sign-in link.
        </div>
      </div>

      <div style={{
        position: 'absolute', top: '50%', left: 0, width: 24,
        height: 1, transform: 'translateY(-0.5px)',
        background: 'linear-gradient(to right, transparent 0%, rgba(26,22,19,0.07) 100%)',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: '50%', right: 0, width: 24,
        height: 1, transform: 'translateY(-0.5px)',
        background: 'linear-gradient(to left, transparent 0%, rgba(26,22,19,0.07) 100%)',
        pointerEvents: 'none',
      }}/>

      <div style={{
        position: 'absolute', bottom: 64, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        font: '400 12px/1 Inter, sans-serif', color: SS_FG3,
      }}>
        <a style={{ color: 'inherit', textDecoration: 'none' }}>Use single sign-on</a>
      </div>

      <div style={{
        position: 'absolute', bottom: 68, right: 32,
        width: 4, height: 4, borderRadius: '50%',
        background: SS_ORANGE,
      }}/>
    </MobileFrame>
  );
}

window.MinimalDesktop = MinimalDesktop;
window.MinimalMobile = MinimalMobile;
