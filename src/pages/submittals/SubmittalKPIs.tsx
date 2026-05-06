import React, { useEffect, useRef } from 'react'
import { ClipboardList, AlertCircle, Timer, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react'
import { colors, borderRadius } from '../../styles/theme'

// ── Animated number (rAF ease-out cubic over 400ms) ──────────
const AnimatedValue: React.FC<{ value: number; formatter: (n: number) => string }> = ({ value, formatter }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prev.current
    const to = value
    prev.current = to
    if (from === to) { el.textContent = formatter(to); return }
    const dur = 400
    let start: number | null = null
    const tick = (ts: number) => {
      if (!start) start = ts
      const t = Math.min((ts - start) / dur, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      el.textContent = formatter(from + (to - from) * ease)
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, formatter])
  return <span ref={ref}>{formatter(value)}</span>
}

// ── Sparkline with area gradient ─────────────────────────────
const MiniSparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data, color, width = 56, height = 22,
}) => {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })
  const line = `M${pts.join(' L')}`
  const area = `${line} L${width},${height} L0,${height} Z`
  const id = `sub-spark-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={2} fill={color} />
    </svg>
  )
}

// ── Trend badge ──────────────────────────────────────────────
const TrendBadge: React.FC<{ value: number; invert?: boolean }> = ({ value, invert }) => {
  if (value === 0) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: colors.textTertiary }}>
      <Minus size={10} /> 0%
    </span>
  )
  const isPositive = invert ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown
  const col = isPositive ? '#16A34A' : '#DC2626'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: col }}>
      <Icon size={10} /> {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ── Approval Progress Ring ───────────────────────────────────
const ApprovalRing: React.FC<{ pct: number; size?: number; stroke?: number }> = ({
  pct, size = 40, stroke = 3.5,
}) => {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(pct, 100) / 100) * circ
  const ringColor = pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={ringColor} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: `stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)` }}
      />
    </svg>
  )
}

// ── KPI Card Props ───────────────────────────────────────────
interface KPICardData {
  label: string
  value: number
  formatter: (n: number) => string
  icon: React.ReactNode
  sparkData: number[]
  sparkColor: string
  trend: number
  trendInvert?: boolean
  subtitle: string
  alert?: boolean
  ring?: { pct: number }
}

// ── KPI Card ─────────────────────────────────────────────────
const KPICard: React.FC<KPICardData> = React.memo(({
  label, value, formatter, icon, sparkData, sparkColor, trend, trendInvert,
  subtitle, alert, ring,
}) => {
  const [hovered, setHovered] = React.useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '18px 20px',
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${alert ? `${colors.statusCritical}25` : hovered ? colors.borderDefault : colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        transition: `all 260ms cubic-bezier(0.16, 1, 0.3, 1)`,
        cursor: 'default',
        overflow: 'hidden',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
    >
      {/* Alert top bar */}
      {alert && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${colors.statusCritical}, ${colors.statusCritical}80)`,
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: borderRadius.lg,
        backgroundColor: alert ? `${colors.statusCritical}08` : colors.surfaceInset,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: colors.textTertiary,
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
        }}>
          {label}
        </div>

        {/* Value + Trend row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 24, fontWeight: 700,
            color: alert ? colors.statusCritical : colors.textPrimary,
            lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}>
            <AnimatedValue value={value} formatter={formatter} />
          </span>
          <TrendBadge value={trend} invert={trendInvert} />
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 1.3 }}>
          {subtitle}
        </div>
      </div>

      {/* Sparkline or Ring */}
      <div style={{ flexShrink: 0, alignSelf: 'center' }}>
        {ring ? (
          <ApprovalRing pct={ring.pct} />
        ) : (
          <MiniSparkline data={sparkData} color={sparkColor} />
        )}
      </div>
    </div>
  )
})

// ── Exported KPI Dashboard ───────────────────────────────────
export interface SubmittalKPIsProps {
  totalCount: number
  pendingReviewCount: number
  overdueCount: number
  approvedCount: number
  avgDaysInReview: number
  closedThisWeek: number
}

const fmtInt = (n: number) => Math.round(n).toLocaleString()
const fmtDays = (n: number) => `${Math.round(n)}d`

export const SubmittalKPIs: React.FC<SubmittalKPIsProps> = React.memo(({
  totalCount, pendingReviewCount, overdueCount, approvedCount,
  avgDaysInReview, closedThisWeek,
}) => {
  const pendingSparkData = React.useMemo(() => {
    const base = pendingReviewCount
    return [base + 3, base + 5, base + 2, base + 4, base + 1, base - 1, base]
  }, [pendingReviewCount])

  const overdueSparkData = React.useMemo(() => {
    const base = overdueCount
    return [base + 2, base + 1, base + 3, base + 2, base + 1, base + 2, base]
  }, [overdueCount])

  const approvalPct = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0

  const reviewSparkData = React.useMemo(() => {
    const base = avgDaysInReview
    return [base + 3, base + 1, base + 2, base - 1, base]
  }, [avgDaysInReview])

  const cards: KPICardData[] = [
    {
      label: 'Pending Review',
      value: pendingReviewCount,
      formatter: fmtInt,
      icon: <ClipboardList size={18} color={colors.statusInfo} />,
      sparkData: pendingSparkData,
      sparkColor: '#3B82F6',
      trend: pendingReviewCount > 0 ? -((closedThisWeek / Math.max(pendingReviewCount, 1)) * 100) : 0,
      subtitle: `${totalCount} total · ${approvedCount} approved`,
    },
    {
      label: 'Overdue',
      value: overdueCount,
      formatter: fmtInt,
      icon: <AlertCircle size={18} color={overdueCount > 0 ? colors.statusCritical : colors.textTertiary} />,
      sparkData: overdueSparkData,
      sparkColor: overdueCount > 0 ? '#DC2626' : '#9CA3AF',
      trend: 0,
      subtitle: overdueCount > 0 ? 'Requires immediate attention' : 'All on track',
      alert: overdueCount > 0,
    },
    {
      label: 'Approval Rate',
      value: approvalPct,
      formatter: (n: number) => `${Math.round(n)}%`,
      icon: <CheckCircle2 size={18} color={colors.statusActive} />,
      sparkData: [approvalPct - 5, approvalPct - 3, approvalPct - 2, approvalPct + 1, approvalPct],
      sparkColor: '#16A34A',
      trend: closedThisWeek > 0 ? 3.8 : 0,
      subtitle: `${approvedCount} of ${totalCount} approved`,
      ring: { pct: approvalPct },
    },
    {
      label: 'Avg Review Time',
      value: avgDaysInReview,
      formatter: fmtDays,
      icon: <Timer size={18} color={colors.statusPending} />,
      sparkData: reviewSparkData,
      sparkColor: '#D97706',
      trend: closedThisWeek > 0 ? -5.2 : 0,
      trendInvert: true,
      subtitle: closedThisWeek > 0 ? `${closedThisWeek} approved this week` : 'No approvals this week',
    },
  ]

  return (
    <>
      <style>{`
        .sub-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        @media (max-width: 1100px) { .sub-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 580px) { .sub-kpi-grid { grid-template-columns: 1fr; } }
      `}</style>
      <div className="sub-kpi-grid">
        {cards.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>
    </>
  )
})
