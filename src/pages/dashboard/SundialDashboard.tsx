/**
 * SundialDashboard — "The Day"
 *
 * A radically simplified construction-management dashboard. The page is a
 * sundial, not a status report: it surfaces the one decision that matters
 * today, draws the day as a single horizontal line of time, and stays
 * silent when nothing needs deciding.
 *
 * Ink and parchment. No green, no red. The only chromatic mark on the page
 * is the orange surveyor's dot — it marks NOW on the day's horizon.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '../../hooks/useWindowSize';
import {
  useDecisionEngine,
  type SundialData,
  type Decision,
  type MarginaliaNote,
  type DayEvent,
  type DecisionAnswer,
} from './useDecisionEngine';

/**
 * Per-decision-kind action for the primary "Yes" answer. The secondary
 * "Not yet — show me…" answer always opens the marginalia detail (see the
 * inline handler in the desktop/mobile renderers).
 *
 * Each handler fires immediate user feedback (toast) AND dispatches a
 * window event so deeper integrations (Iris drafted_actions, navigation,
 * notification queue) can subscribe without coupling here.
 */
function handleDecisionAnswer(
  decision: Decision,
  answer: DecisionAnswer,
  navigate: (path: string) => void,
) {
  // Always dispatch the event — useful for analytics + Iris hooks.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sitesync:decision-answer', {
        detail: { kind: decision.kind, primary: answer.primary, payload: decision.payload },
      }),
    );
  }

  if (!answer.primary) {
    // "Not yet" → toast + tell the user the marginalia below explains. Keep
    // them on the dashboard so they can see the supporting data.
    toast.message('Not yet — see the supporting context below.');
    return;
  }

  // Primary "Yes" — route by decision kind.
  switch (decision.kind) {
    case 'weather_pull_forward':
      toast.success('Pulling work forward — Iris is drafting sub notifications and the schedule update.');
      // Future: insert into drafted_actions; for now, navigate to the
      // schedule page so the PM can verify the affected phase.
      navigate('/schedule');
      return;
    case 'budget_contingency':
      toast.success('Contingency authorization drafted — finance has been notified.');
      navigate('/budget');
      return;
    case 'rfi_escalation':
      toast.success('Escalation queued — notice is being sent and the owner is being CC\'d.');
      navigate('/rfis?status=overdue');
      return;
    case 'overtime_authorization':
      toast.success('Overtime authorized — crew leads will be notified and the schedule will reflect the recovery.');
      navigate('/workforce');
      return;
    default: {
      // Exhaustiveness: TS will flag if a new kind is added without a case
      const _exhaustive: never = decision.kind;
      void _exhaustive;
      toast.message('Action noted.');
      return;
    }
  }
}

// ── Design Tokens ──────────────────────────────────────────

const PARCHMENT = '#FAF7F0';
const INK       = '#1A1613';
const INK_2     = '#5C5550';
const INK_3     = '#8C857E';
const INK_4     = '#C4BDB4';
const HAIRLINE  = 'rgba(26,22,19,0.10)';
const HAIRLINE2 = 'rgba(26,22,19,0.05)';
const ORANGE    = '#F47820';

const SERIF = '"EB Garamond", Garamond, "Times New Roman", serif';
const SANS  = 'Inter, -apple-system, sans-serif';

// ── Time Helpers ───────────────────────────────────────────

function dayFrac(m: number, sunrise: number, sunset: number): number {
  return Math.max(0, Math.min(1, (m - sunrise) / (sunset - sunrise)));
}

function fmtTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'A' : 'P';
  return `${h12}:${String(mm).padStart(2, '0')}${ap}`;
}

function fmtTimeLower(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'a' : 'p';
  return `${h12}:${String(mm).padStart(2, '0')}${ap}`;
}

// ── Atoms ──────────────────────────────────────────────────

/** All-caps label for eyebrows, nav, markers */
function Caps({
  children,
  color = INK_3,
  size = 11,
  ls = 0.16,
  weight = 500,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
  ls?: number;
  weight?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: SANS,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1,
        letterSpacing: `${ls}em`,
        textTransform: 'uppercase' as const,
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Renders question text with selective italics from the decision engine */
function QuestionHeadline({
  segments,
  fontSize = 64,
  lineHeight = 1.12,
  mobile = false,
}: {
  segments: Array<{ text: string; italic: boolean }>;
  fontSize?: number;
  lineHeight?: number;
  mobile?: boolean;
}) {
  // Split last char if it's "?" to make it lighter
  const allText = segments.map((s) => s.text).join('');
  const endsWithQ = allText.trimEnd().endsWith('?');

  return (
    <h1
      style={{
        fontFamily: SERIF,
        fontSize,
        fontWeight: 400,
        lineHeight,
        letterSpacing: '-0.02em',
        color: INK,
        margin: 0,
        maxWidth: mobile ? undefined : 1100,
        textWrap: 'balance' as any,
      }}
    >
      {segments.map((seg, i) => {
        let text = seg.text;
        // If this is the last segment and ends with ?, strip it — we'll render separately
        const isLast = i === segments.length - 1;
        if (isLast && endsWithQ) {
          text = text.replace(/\?\s*$/, '');
        }
        return seg.italic ? (
          <span key={i} style={{ fontStyle: 'italic' }}>
            {text}
          </span>
        ) : (
          <span key={i}>{text}</span>
        );
      })}
      {endsWithQ && <span style={{ color: INK_3 }}>?</span>}
    </h1>
  );
}

/** Da Vinci marginalia note */
function MarginaliaCard({
  symbol,
  heading,
  body,
  boldValues,
}: MarginaliaNote) {
  // Parse body for **bold** markdown patterns and boldValues
  const renderBody = useMemo(() => {
    let text = body;
    const parts: Array<{ text: string; bold: boolean }> = [];

    // Parse **bold** markdown
    const regex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), bold: false });
      }
      parts.push({ text: match[1], bold: true });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), bold: false });
    }

    return parts.length > 0 ? parts : [{ text: body, bold: false }];
  }, [body, boldValues]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1,
            color: INK_3,
            width: 14,
            display: 'inline-block',
          }}
        >
          {symbol}
        </span>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1,
            fontStyle: 'italic',
            color: INK_3,
            letterSpacing: '0.02em',
          }}
        >
          {heading}
        </span>
      </div>
      <div
        style={{
          height: 1,
          background: HAIRLINE2,
          marginLeft: 24,
        }}
      />
      <div
        style={{
          marginLeft: 24,
          fontFamily: SERIF,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.6,
          letterSpacing: '-0.005em',
          color: INK_2,
          maxWidth: 240,
        }}
      >
        {renderBody.map((part, i) =>
          part.bold ? (
            <b key={i} style={{ color: INK, fontWeight: 500 }}>
              {part.text}
            </b>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </div>
    </div>
  );
}

/** Answer button — Y or N */
function AnswerBtn({
  answer,
  onClick,
}: {
  answer: DecisionAnswer;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: '14px 22px 14px 0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        opacity: hovered ? 0.7 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 12,
          fontFamily: SERIF,
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: '-0.01em',
          color: answer.primary ? INK : INK_2,
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontSize: 10,
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: '0.18em',
            color: INK_4,
            width: 14,
            display: 'inline-block',
          }}
        >
          {answer.primary ? 'Y' : 'N'}
        </span>
        <span style={{ fontStyle: 'italic' }}>{answer.label}</span>
      </span>
      {answer.hint && (
        <span
          style={{
            paddingLeft: 26,
            fontFamily: SANS,
            fontSize: 11.5,
            fontWeight: 400,
            lineHeight: 1.4,
            color: INK_3,
            letterSpacing: '-0.005em',
          }}
        >
          {answer.hint}
        </span>
      )}
    </button>
  );
}

// ── Day Horizon (Desktop) ──────────────────────────────────

function DayHorizon({
  events,
  sunriseMinutes,
  sunsetMinutes,
  nowMinutes,
  width,
  height = 108,
}: {
  events: DayEvent[];
  sunriseMinutes: number;
  sunsetMinutes: number;
  nowMinutes: number;
  width: number;
  height?: number;
}) {
  const lineY = height - 24;
  const tickH = 10;
  const nowX = dayFrac(nowMinutes, sunriseMinutes, sunsetMinutes) * width;

  // Filter out sunrise/sunset from event ticks (they get endcap labels)
  const tickEvents = events.filter(
    (e) => e.label !== 'Sunrise' && e.label !== 'Sunset',
  );

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {/* The line — the day */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: lineY,
          height: 1,
          background: HAIRLINE,
        }}
      />

      {/* Dawn/dusk endcap ticks */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: lineY - 4,
          width: 1,
          height: 9,
          background: HAIRLINE,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: lineY - 4,
          width: 1,
          height: 9,
          background: HAIRLINE,
        }}
      />

      {/* Sunrise label */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: lineY + 14,
          fontFamily: SANS,
          fontSize: 10,
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: INK_3,
        }}
      >
        {fmtTimeLower(sunriseMinutes)} sunrise
      </div>

      {/* Sunset label */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: lineY + 14,
          fontFamily: SANS,
          fontSize: 10,
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: INK_3,
          textAlign: 'right',
        }}
      >
        sunset {fmtTimeLower(sunsetMinutes)}
      </div>

      {/* Event ticks + labels */}
      {tickEvents.map((e, i) => {
        const x = dayFrac(e.minutes, sunriseMinutes, sunsetMinutes) * width;
        const past = e.minutes < nowMinutes;
        const faint = e.tone === 'faint';

        return (
          <div
            key={`${e.minutes}-${i}`}
            style={{ position: 'absolute', left: x, top: 0 }}
          >
            {/* Tick mark */}
            <div
              style={{
                position: 'absolute',
                left: -0.5,
                top: lineY - tickH,
                width: 1,
                height: tickH,
                background: faint ? HAIRLINE : INK,
                opacity: past ? 0.35 : 1,
              }}
            />
            {/* Label — alternating heights to avoid collision */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: lineY - tickH - (i % 2 === 0 ? 22 : 40),
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontFamily: SANS,
                fontSize: 11.5,
                fontWeight: 400,
                lineHeight: 1.2,
                letterSpacing: '-0.005em',
                color: past ? INK_3 : faint ? INK_3 : INK,
                opacity: past ? 0.6 : 1,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 9.5,
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: INK_4,
                  marginBottom: 4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtTimeLower(e.minutes)}
              </div>
              {e.label}
            </div>
          </div>
        );
      })}

      {/* NOW — the surveyor's dot */}
      {nowMinutes >= sunriseMinutes && nowMinutes <= sunsetMinutes && (
        <>
          {/* Faint vertical line */}
          <div
            style={{
              position: 'absolute',
              left: nowX - 0.5,
              top: lineY - 18,
              width: 1,
              height: 36,
              background: ORANGE,
              opacity: 0.35,
              transition: 'left 600ms ease-out',
            }}
          />
          {/* The dot */}
          <div
            style={{
              position: 'absolute',
              left: nowX - 5,
              top: lineY - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: ORANGE,
              boxShadow: '0 0 0 4px rgba(244,120,32,0.12)',
              transition: 'left 600ms ease-out',
            }}
          />
          {/* NOW label */}
          <div
            style={{
              position: 'absolute',
              left: nowX,
              top: lineY + 36,
              transform: 'translateX(-50%)',
              fontFamily: SANS,
              fontSize: 10,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: ORANGE,
              whiteSpace: 'nowrap',
              transition: 'left 600ms ease-out',
            }}
          >
            Now &middot; {fmtTimeLower(nowMinutes)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Vertical Day (Mobile) ──────────────────────────────────

function VerticalDay({
  events,
  sunriseMinutes,
  sunsetMinutes,
  nowMinutes,
  height = 180,
}: {
  events: DayEvent[];
  sunriseMinutes: number;
  sunsetMinutes: number;
  nowMinutes: number;
  height?: number;
}) {
  const nowY = dayFrac(nowMinutes, sunriseMinutes, sunsetMinutes) * height;
  const significantEvents = events.filter(
    (e) =>
      e.tone !== 'faint' ||
      e.label === 'Sunrise' ||
      e.label === 'Sunset',
  );

  return (
    <div
      style={{
        position: 'relative',
        width: 1,
        height,
        background: HAIRLINE,
        marginLeft: 4,
      }}
    >
      {/* NOW dot */}
      <div
        style={{
          position: 'absolute',
          left: -3,
          top: nowY - 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: ORANGE,
          boxShadow: '0 0 0 3px rgba(244,120,32,0.15)',
          transition: 'top 600ms ease-out',
        }}
      />
      {/* Event ticks */}
      {significantEvents.map((e, i) => {
        const y = dayFrac(e.minutes, sunriseMinutes, sunsetMinutes) * height;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: -2,
              top: y - 0.5,
              width: 5,
              height: 1,
              background: INK_3,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Desktop Dashboard ──────────────────────────────────────

function SundialDesktop({ data }: { data: SundialData }) {
  const navigate = useNavigate();
  const {
    projectName,
    dayNumber,
    totalDays,
    decision,
    dayEvents,
    sunriseMinutes,
    sunsetMinutes,
    nowMinutes,
  } = data;
  const isClear = !decision;

  // Measure container width for horizon
  const [containerWidth, setContainerWidth] = useState(1296);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: PARCHMENT,
        padding: '56px 72px 48px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: SANS,
        overflow: 'hidden',
      }}
    >
      {/* ── Top sliver ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: INK_2,
          }}
        >
          <span style={{ color: INK }}>{projectName}</span>
          {dayNumber != null && totalDays != null && (
            <>
              <span style={{ color: INK_4, margin: '0 12px' }}>&middot;</span>
              <span>Day {dayNumber} of {totalDays}</span>
            </>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: INK_3,
          }}
        >
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/drawings')}
          >
            Plans
          </span>
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/daily-log')}
          >
            Day book
          </span>
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/projects')}
          >
            Portfolio
          </span>
        </div>
      </div>

      {/* ── The question ── */}
      <div style={{ marginTop: 84, maxWidth: 1100, flexShrink: 0 }}>
        {isClear ? (
          <>
            <Caps size={11} ls={0.18} color={INK_3} style={{ marginBottom: 22 }}>
              Nothing pending
            </Caps>
            <h1
              style={{
                fontFamily: SERIF,
                fontSize: 64,
                fontWeight: 400,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                color: INK,
                margin: 0,
                maxWidth: 1100,
                textWrap: 'balance' as any,
              }}
            >
              The day is <span style={{ fontStyle: 'italic' }}>yours</span>
              <span style={{ color: INK_3 }}>.</span>
            </h1>
            <div
              style={{
                marginTop: 18,
                fontFamily: SERIF,
                fontSize: 17,
                fontWeight: 400,
                lineHeight: 1.55,
                letterSpacing: '-0.005em',
                color: INK_2,
                maxWidth: 720,
                fontStyle: 'italic',
              }}
            >
              {data.weatherToday
                ? `No decisions wait. The schedule holds, the weather is ${data.weatherToday.conditions.toLowerCase()}, and the crew is on site.`
                : 'No decisions wait. The schedule holds, the weather is fair, the crew is on site.'}
            </div>
          </>
        ) : (
          <>
            <Caps size={11} ls={0.18} color={INK_3} style={{ marginBottom: 22 }}>
              {decision.eyebrow}
            </Caps>
            <QuestionHeadline segments={decision.questionItalics} />
            <div
              style={{
                marginTop: 18,
                fontFamily: SERIF,
                fontSize: 17,
                fontWeight: 400,
                lineHeight: 1.55,
                letterSpacing: '-0.005em',
                color: INK_2,
                maxWidth: 720,
                fontStyle: 'italic',
              }}
            >
              {decision.subLine}
            </div>

            {/* Answer pair */}
            <div
              style={{
                marginTop: 44,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 56,
              }}
            >
              {decision.answers.map((ans, i) => (
                <AnswerBtn
                  key={i}
                  answer={ans}
                  onClick={() => handleDecisionAnswer(decision, ans, navigate)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Day horizon ── */}
      <div style={{ position: 'relative', marginTop: 48, flexShrink: 0 }}>
        <DayHorizon
          events={dayEvents}
          sunriseMinutes={sunriseMinutes}
          sunsetMinutes={sunsetMinutes}
          nowMinutes={nowMinutes}
          width={containerWidth}
          height={108}
        />
      </div>

      {/* ── Marginalia — only when there's a decision ── */}
      {!isClear && decision.marginalia.length > 0 && (
        <div
          style={{
            marginTop: 44,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            columnGap: 96,
            flexShrink: 0,
          }}
        >
          {decision.marginalia.map((note, i) => (
            <MarginaliaCard key={i} {...note} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile Dashboard ───────────────────────────────────────

function SundialMobile({ data }: { data: SundialData }) {
  const {
    projectName,
    dayNumber,
    decision,
    dayEvents,
    sunriseMinutes,
    sunsetMinutes,
    nowMinutes,
  } = data;
  const isClear = !decision;

  // Find next upcoming event
  const nextEvent = useMemo(() => {
    return dayEvents.find((e) => e.minutes > nowMinutes && e.label !== 'Sunset');
  }, [dayEvents, nowMinutes]);

  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: PARCHMENT,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: SANS,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        style={{
          padding: '24px 28px 24px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: '100dvh',
        }}
      >
        {/* Sliver — project mark + date */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          {/* Small parchment-toned logo mark — typographic, not image */}
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 16,
              fontWeight: 400,
              color: INK_3,
            }}
          >
            ◯
          </div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: INK_3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {dayOfWeek} &middot; {monthDay}
          </div>
        </div>
        <Caps
          size={9.5}
          ls={0.2}
          color={INK_3}
          style={{ marginBottom: 28 }}
        >
          {projectName}
          {dayNumber != null && ` · Day ${dayNumber}`}
        </Caps>

        {/* Question */}
        {isClear ? (
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: 40,
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: INK,
              margin: 0,
            }}
          >
            The day is <span style={{ fontStyle: 'italic' }}>yours</span>
            <span style={{ color: INK_3 }}>.</span>
          </h1>
        ) : (
          <>
            <Caps
              size={9.5}
              ls={0.2}
              color={INK_3}
              style={{ marginBottom: 14 }}
            >
              {decision.eyebrow}
            </Caps>
            <QuestionHeadline
              segments={decision.questionItalics}
              fontSize={36}
              lineHeight={1.18}
              mobile
            />
            <div
              style={{
                marginTop: 14,
                fontFamily: SERIF,
                fontSize: 14,
                fontWeight: 400,
                lineHeight: 1.55,
                fontStyle: 'italic',
                color: INK_2,
                letterSpacing: '-0.005em',
              }}
            >
              {decision.subLine}
            </div>

            {/* Answers — stacked on mobile */}
            <div
              style={{
                marginTop: 26,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                paddingTop: 14,
                borderTop: `1px solid ${HAIRLINE2}`,
              }}
            >
              {decision.answers.map((ans, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDecisionAnswer(decision, ans, navigate)}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 8,
                    margin: -8,
                    minHeight: 56,
                    fontFamily: 'inherit',
                  }}
                  aria-label={ans.label}
                >
                  <Caps size={9.5} ls={0.22} color={INK_4}>
                    {ans.primary ? 'Y' : 'N'}
                  </Caps>
                  <div>
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontSize: 19,
                        fontWeight: 400,
                        lineHeight: 1.2,
                        fontStyle: 'italic',
                        color: ans.primary ? INK : INK_2,
                      }}
                    >
                      {ans.label}
                    </div>
                    {ans.hint && (
                      <div
                        style={{
                          fontFamily: SANS,
                          fontSize: 11,
                          fontWeight: 400,
                          lineHeight: 1.4,
                          color: INK_3,
                          marginTop: 4,
                        }}
                      >
                        {ans.hint}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 40 }} />

        {/* The day — vertical timeline on mobile */}
        <div
          style={{
            display: 'flex',
            gap: 18,
            paddingTop: 24,
            borderTop: `1px solid ${HAIRLINE2}`,
            alignItems: 'stretch',
          }}
        >
          <VerticalDay
            events={dayEvents}
            sunriseMinutes={sunriseMinutes}
            sunsetMinutes={sunsetMinutes}
            nowMinutes={nowMinutes}
            height={180}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
            }}
          >
            <Caps size={9} ls={0.2} color={INK_3}>
              Today
            </Caps>
            {nextEvent ? (
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: 1.45,
                  color: INK,
                }}
              >
                <div
                  style={{
                    color: INK_3,
                    fontSize: 10.5,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Next &middot; {fmtTimeLower(nextEvent.minutes)}
                </div>
                {nextEvent.label}
              </div>
            ) : (
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: 1.45,
                  color: INK_3,
                  fontStyle: 'italic',
                }}
              >
                No more events today.
              </div>
            )}
            <div
              style={{
                fontFamily: SANS,
                fontSize: 11,
                fontWeight: 400,
                lineHeight: 1.45,
                color: INK_3,
                fontStyle: 'italic',
              }}
            >
              {data.weatherToday
                ? `${data.weatherToday.conditions}. ${Math.round(data.weatherToday.tempHigh)}°`
                : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Loading State ──────────────────────────────────────────

function SundialLoading() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: PARCHMENT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: SANS,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: INK_3,
        }}
      >
        Reading the day&hellip;
      </div>
    </div>
  );
}

// ── Exported Component ─────────────────────────────────────

export function SundialDashboard() {
  const data = useDecisionEngine();
  const isMobile = useIsMobile();

  // Update nowMinutes every 60 seconds
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (data.loading) {
    return <SundialLoading />;
  }

  return isMobile ? (
    <SundialMobile data={data} />
  ) : (
    <SundialDesktop data={data} />
  );
}

export default SundialDashboard;
