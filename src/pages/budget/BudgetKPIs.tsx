import React, { useMemo, useState, useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown, Minus, DollarSign, ShieldCheck, PieChart, Wallet } from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'

// ── Animated number (rAF ease-out cubic over 400ms) ──
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
      const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic
      el.textContent = formatter(from + (to - from) * ease)
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, formatter])
  return <span ref={ref}>{formatter(value)}</span>
}

// ── Sparkline ──
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
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`
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

// ── Trend badge ──
const TrendBadge: React.FC<{ value: number; invert?: boolean }> = ({ value, invert }) => {
  if (value === 0) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: colors.textTertiary }}>
      <Minus size={10} /> 0%
    </span>
  )
  // For "remaining", positive trend is good. For "spent", positive trend means more spent (bad).
  const isPositive = invert ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown
  const col = isPositive ? colors.statusActive : colors.statusCritical
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: col }}>
      <Icon size={10} /> {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ── Budget utilization ring ──
const UtilizationRing: React.FC<{ pct: number; size?: number; stroke?: number }> = ({
  pct, size = 40, stroke = 3.5,
}) => {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(pct, 100) / 100) * circ
  const ringColor = pct > 100 ? colors.statusCritical : pct > 80 ? colors.statusPending : colors.statusActive
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.statusNeutralSubtle} strokeWidth={stroke} />
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

// ── Format helpers ──
const fmtCurrency = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}
const fmtPct = (n: number): string => `${Math.round(n)}%`

// ── Types ──
interface BudgetKPIProps {
  totalBudget: number
  spent: number
  committed: number
  remaining: number
  contingencyRemaining: number
  contingencyTotal: number
  contingencyPct: number
  previousBilledToDate: number
  isFlashing?: boolean
}

export const BudgetKPIs: React.FC<BudgetKPIProps> = ({
  totalBudget, spent, committed, remaining,
  contingencyRemaining, contingencyTotal, contingencyPct,
  previousBilledToDate, isFlashing,
}) => {
  const utilizationPct = totalBudget > 0 ? ((spent + committed) / totalBudget) * 100 : 0
  const spentPct = totalBudget > 0 ? (spent / totalBudget) * 100 : 0

  // Synthetic trend data (in a real app, these would come from historical snapshots)
  const spentTrend = useMemo(() => {
    const base = spent * 0.6
    return [0, 1, 2, 3, 4, 5, 6].map((_, i) => base + (spent - base) * (i / 6))
  }, [spent])

  const committedTrend = useMemo(() => {
    const base = committed * 0.5
    return [0, 1, 2, 3, 4, 5, 6].map((_, i) => base + (committed - base) * (i / 6))
  }, [committed])

  const spentDelta = previousBilledToDate > 0
    ? ((spent - previousBilledToDate) / previousBilledToDate) * 100
    : 0

  const cards = [
    {
      label: 'TOTAL PROJECT',
      value: totalBudget,
      formatter: fmtCurrency,
      icon: DollarSign,
      color: colors.brand400,
      sparkData: null as number[] | null,
      trend: null as number | null,
      trendInvert: false,
    },
    {
      label: 'SPENT TO DATE',
      value: spent,
      formatter: fmtCurrency,
      icon: Wallet,
      color: colors.statusInfo,
      sparkData: spentTrend,
      trend: spentDelta,
      trendInvert: true, // spending going up is bad
    },
    {
      label: 'COMMITTED',
      value: committed,
      formatter: fmtCurrency,
      icon: PieChart,
      color: colors.indigo,
      sparkData: committedTrend,
      trend: null,
      trendInvert: false,
    },
    {
      label: 'REMAINING',
      value: remaining,
      formatter: fmtCurrency,
      icon: ShieldCheck,
      color: remaining >= 0 ? colors.statusActive : colors.statusCritical,
      sparkData: null,
      trend: null,
      trendInvert: false,
    },
  ]

  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div style={{ position: 'relative', marginBottom: spacing['4'] }}>
      {/* Real-time flash indicator */}
      {isFlashing && (
        <div style={{
          position: 'absolute', top: -8, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: spacing['1'],
          padding: `2px ${spacing['2']}`,
          backgroundColor: colors.primaryOrange, borderRadius: borderRadius.full,
          animation: 'fadeInDown 0.15s ease-out',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.white, display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: colors.white, whiteSpace: 'nowrap' }}>Budget updated</span>
        </div>
      )}

      <div
        role="group"
        aria-label="Budget summary metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing['3'],
        }}
      >
        {cards.map((card, i) => {
          const Icon = card.icon
          const isHov = hovered === i
          return (
            <div
              key={card.label}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: `${spacing['4']} ${spacing['4']}`,
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.xl,
                border: `1px solid ${isHov ? card.color + '40' : colors.borderSubtle}`,
                transition: `all ${transitions.quick}`,
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Top row: label + icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                  color: colors.textTertiary, textTransform: 'uppercase' as const,
                }}>
                  {card.label}
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: borderRadius.md,
                  backgroundColor: card.color + '12',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: `background-color ${transitions.quick}`,
                  ...(isHov ? { backgroundColor: card.color + '20' } : {}),
                }}>
                  <Icon size={14} color={card.color} />
                </div>
              </div>

              {/* Value + utilization ring for last card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                {i === 3 && (
                  <UtilizationRing pct={utilizationPct} size={36} stroke={3} />
                )}
                <span style={{
                  fontSize: 24, fontWeight: 700, color: colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1,
                }}>
                  <AnimatedValue value={card.value} formatter={card.formatter} />
                </span>
              </div>

              {/* Bottom row: sparkline + trend */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
                {card.sparkData ? (
                  <MiniSparkline data={card.sparkData} color={card.color} />
                ) : i === 0 ? (
                  <span style={{ fontSize: 11, color: colors.textTertiary }}>
                    {fmtPct(spentPct)} utilized
                  </span>
                ) : i === 3 ? (
                  <span style={{ fontSize: 11, color: remaining >= 0 ? colors.statusActive : colors.statusCritical, fontWeight: 500 }}>
                    {remaining >= 0 ? 'Under budget' : 'Over budget'}
                  </span>
                ) : (
                  <span />
                )}
                {card.trend !== null && <TrendBadge value={card.trend} invert={card.trendInvert} />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Contingency bar */}
      {contingencyTotal > 0 && (
        <div style={{
          marginTop: spacing['3'],
          padding: `${spacing['2.5']} ${spacing['4']}`,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderSubtle}`,
          display: 'flex', alignItems: 'center', gap: spacing['3'],
        }}>
          <ShieldCheck size={15} color={contingencyPct > 80 ? colors.statusCritical : contingencyPct > 50 ? colors.statusPending : colors.statusActive} />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textPrimary }}>
            Contingency
          </span>
          <div style={{
            flex: 1, height: 6, backgroundColor: colors.statusNeutralSubtle,
            borderRadius: borderRadius.full, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(contingencyPct, 100)}%`,
              backgroundColor: contingencyPct > 80 ? colors.statusCritical : contingencyPct > 50 ? colors.statusPending : colors.statusActive,
              borderRadius: borderRadius.full,
              transition: `width 0.6s cubic-bezier(0.16,1,0.3,1)`,
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
            {fmtCurrency(contingencyRemaining)} remaining
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px',
            borderRadius: borderRadius.full, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
            backgroundColor: contingencyPct > 80 ? colors.statusCriticalSubtle : contingencyPct > 50 ? colors.statusPendingSubtle : colors.statusActiveSubtle,
            color: contingencyPct > 80 ? colors.statusCritical : contingencyPct > 50 ? colors.statusPending : colors.statusActive,
          }}>
            {100 - Math.round(contingencyPct)}%
          </span>
        </div>
      )}
    </div>
  )
}
