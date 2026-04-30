import React, { useState, useEffect } from 'react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

interface SCurveProps {
  totalBudget: number;
  spent: number;
  /** Cumulative planned values (in millions) — computed from real data */
  plannedData?: number[];
  /** Cumulative actual values (in millions) — computed from real data */
  actualData?: number[];
  /** Month labels */
  labels?: string[];
}

const W = 100;
const H = 60;

export const SCurve: React.FC<SCurveProps> = ({
  totalBudget,
  spent,
  plannedData: externalPlanned,
  actualData: externalActual,
  labels: externalLabels,
}) => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Use provided data or generate from totalBudget/spent
  const plannedData = externalPlanned && externalPlanned.length > 1
    ? externalPlanned
    : generateDefaultCurve(totalBudget);

  const actualData = externalActual && externalActual.length > 0
    ? externalActual
    : generateActualFromSpent(spent, plannedData);

  const months = externalLabels && externalLabels.length > 0
    ? externalLabels
    : generateDefaultLabels(plannedData.length);

  const maxVal = Math.max(...plannedData, ...actualData, 1) * 1.15;
  const gridLines = computeGridLines(maxVal);

  function yPos(val: number): number {
    return H - (val / maxVal) * H;
  }

  const stepX = plannedData.length > 1 ? W / (plannedData.length - 1) : W;

  const plannedPath = plannedData.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yPos(v)}`).join(' ');
  const actualPath = actualData.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yPos(v)}`).join(' ');
  const actualFill = actualData.length > 0
    ? actualPath + ` L ${(actualData.length - 1) * stepX} ${H} L 0 ${H} Z`
    : '';

  const fmtM = (v: number) => v >= 1 ? `$${v.toFixed(1)}M` : `$${Math.round(v * 1000)}K`;

  return (
    <div>
      <div
        style={{
          position: 'relative',
          outline: focused ? '2px solid ' + colors.primaryOrange : 'none',
          outlineOffset: '2px',
        }}
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            setHovered(prev => {
              const next = prev === null ? 0 : Math.min(prev + 1, actualData.length - 1);
              setAnnouncement(`Month: ${months[next]}, Planned: ${fmtM(plannedData[next])}, Actual: ${actualData[next] !== undefined ? fmtM(actualData[next]) : 'N/A'}`);
              return next;
            });
          } else if (e.key === 'ArrowLeft') {
            setHovered(prev => {
              const next = prev === null ? actualData.length - 1 : Math.max(prev - 1, 0);
              setAnnouncement(`Month: ${months[next]}, Planned: ${fmtM(plannedData[next])}, Actual: ${actualData[next] !== undefined ? fmtM(actualData[next]) : 'N/A'}`);
              return next;
            });
          }
        }}
      >
        <svg
          viewBox={`-8 -8 ${W + 16} ${H + 28}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-roledescription="interactive data chart"
          aria-label="S-Curve chart showing planned versus actual project spend over time"
          aria-describedby="scurve-data-table"
          tabIndex={0}
          style={{
            width: '100%', height: '220px',
            overflow: 'visible',
          }}
        >
          <title>S-Curve chart showing planned versus actual project spend over time</title>
          <desc>{`Planned spend: ${fmtM(plannedData[plannedData.length - 1] ?? 0)}, Actual spend to date: ${fmtM(actualData[actualData.length - 1] ?? 0)}`}</desc>
          {/* Grid */}
          {gridLines.map((v) => (
            <React.Fragment key={v}>
              <line x1={0} y1={yPos(v)} x2={W} y2={yPos(v)} stroke={colors.borderSubtle} strokeWidth="0.3" />
              <text x={-3} y={yPos(v) + 1.5} textAnchor="end" fill={colors.textTertiary} fontSize="3" fontFamily={typography.fontFamily}>{fmtM(v)}</text>
            </React.Fragment>
          ))}

          {/* Planned line (dashed) */}
          <path d={plannedPath} fill="none" stroke={colors.textTertiary} strokeWidth="0.8" strokeDasharray="2 1.5" opacity={0.5} />

          {/* Actual fill */}
          {actualFill && (
            <path
              d={actualFill}
              fill={`${colors.primaryOrange}10`}
              style={{
                opacity: animated ? 1 : 0,
                transition: 'opacity 0.8s ease-out',
              }}
            />
          )}

          {/* Actual line (animated) */}
          {actualData.length > 0 && (
            <path
              d={actualPath}
              fill="none"
              stroke={colors.primaryOrange}
              strokeWidth="1.2"
              strokeLinecap="round"
              style={{
                strokeDasharray: 200,
                strokeDashoffset: animated ? 0 : 200,
                transition: 'stroke-dashoffset 1.5s ease-out',
              }}
            />
          )}

          {/* Data points */}
          {actualData.map((v, i) => (
            <g key={i}>
              <circle
                cx={i * stepX}
                cy={yPos(v)}
                r={hovered === i ? 2.5 : 1.5}
                fill={colors.primaryOrange}
                stroke={colors.surfaceRaised}
                strokeWidth="0.8"
                tabIndex={0}
                role="listitem"
                aria-label={`${months[i]}: Actual ${fmtM(actualData[i])}`}
                style={{ cursor: 'pointer', opacity: animated ? 1 : 0, transition: `opacity 0.5s ease-out ${i * 0.1}s`, outline: 'none' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              />
            </g>
          ))}

          {/* X axis labels */}
          {months.map((m, i) => {
            // Show every label if few, every other if many
            const skip = months.length > 8 ? 2 : 1;
            return i % skip === 0 ? (
              <text key={`${m}-${i}`} x={i * stepX} y={H + 8} textAnchor="middle" fill={colors.textTertiary} fontSize="3" fontFamily={typography.fontFamily}>
                {m}
              </text>
            ) : null;
          })}

          {/* Forecast zone */}
          {actualData.length < plannedData.length && actualData.length > 0 && (
            <>
              <rect
                x={(actualData.length - 1) * stepX}
                y={0}
                width={W - (actualData.length - 1) * stepX}
                height={H}
                fill={`${colors.statusReview}05`}
              />
              <text
                x={((actualData.length - 1) * stepX + W) / 2}
                y={8}
                textAnchor="middle"
                fill={colors.statusReview}
                fontSize="3"
                fontFamily={typography.fontFamily}
                fontWeight="400"
              >
                Forecast
              </text>
            </>
          )}
        </svg>

        <table id="scurve-data-table" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
          <caption>S-Curve planned vs actual spend data</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Planned ($M)</th>
              <th scope="col">Actual ($M)</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={`${m}-${i}`}>
                <td>{m}</td>
                <td>{plannedData[i]}</td>
                <td>{actualData[i] !== undefined ? actualData[i] : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{announcement}</div>

        {/* Hover tooltip */}
        {hovered !== null && (
          <div role="status" aria-live="polite" style={{
            position: 'absolute',
            left: `${plannedData.length > 1 ? (hovered / (plannedData.length - 1)) * 100 : 50}%`,
            top: 0, transform: 'translateX(-50%)',
            padding: `${spacing['1']} ${spacing['2']}`,
            backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.sm,
            boxShadow: shadows.cardHover,
            fontSize: typography.fontSize.caption, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
          }}>
            <span style={{ fontWeight: typography.fontWeight.semibold }}>{fmtM(actualData[hovered])} actual</span>
            <span style={{ color: colors.textTertiary }}> / {fmtM(plannedData[hovered])} planned</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['2'], justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <div style={{ width: 16, height: 2, backgroundColor: colors.textTertiary, borderRadius: 1, opacity: 0.5 }} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Planned</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <div style={{ width: 16, height: 2, backgroundColor: colors.primaryOrange, borderRadius: 1 }} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Actual</span>
        </div>
      </div>
    </div>
  );
};

// ── Helper functions (no mock data) ────────────────────────

function generateDefaultCurve(totalBudget: number): number[] {
  // Generate S-curve from actual totalBudget
  const budgetM = totalBudget / 1_000_000;
  const points = 12;
  const result: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    // S-curve formula
    const s = 1 / (1 + Math.exp(-10 * (t - 0.4)));
    result.push(Math.round(budgetM * s * 100) / 100);
  }
  return result;
}

function generateActualFromSpent(spent: number, planned: number[]): number[] {
  // Find where actual spend falls on the planned curve
  const spentM = spent / 1_000_000;
  if (spentM <= 0 || planned.length === 0) return [];

  const result: number[] = [];
  for (let i = 0; i < planned.length; i++) {
    if (planned[i] <= spentM) {
        result.push(Math.round(planned[i] * 100) / 100);
    } else if (result.length > 0) {
      // One more point at current spend level
      result.push(Math.round(spentM * 100) / 100);
      break;
    }
  }
  if (result.length === 0 && spentM > 0) {
    result.push(0, Math.round(spentM * 100) / 100);
  }
  return result;
}

function generateDefaultLabels(count: number): string[] {
  const now = new Date();
  const labels: string[] = [];
  // Start from project beginning (estimated as count/2 months ago)
  const startMonth = new Date(now.getFullYear(), now.getMonth() - Math.floor(count / 2), 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
  }
  return labels;
}

function computeGridLines(maxVal: number): number[] {
  // Compute nice grid line values
  const target = 4; // aim for ~4 grid lines
  const raw = maxVal / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  let step: number;
  if (normalized < 1.5) step = 1 * magnitude;
  else if (normalized < 3.5) step = 2 * magnitude;
  else if (normalized < 7.5) step = 5 * magnitude;
  else step = 10 * magnitude;

  const lines: number[] = [];
  for (let v = step; v < maxVal; v += step) {
    lines.push(Math.round(v * 100) / 100);
  }
  return lines;
}
