import React, { useState, useEffect } from 'react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

interface SCurveProps {
  totalBudget: number;
  spent: number;
}

const plannedData = [0, 2.1, 6.5, 12.0, 18.0, 24.5, 30.0, 35.5, 40.0, 43.5, 46.0, 47.5];
const actualData = [0, 1.8, 6.2, 11.4, 17.8, 24.1, 28.9, 34.2, 38.5];
const months = ['Jun 23', 'Sep 23', 'Dec 23', 'Mar 24', 'Jun 24', 'Sep 24', 'Dec 24', 'Mar 25', 'Jun 25', 'Sep 25', 'Dec 25'];

const W = 100;
const H = 60;
const maxVal = 50;

function yPos(val: number): number {
  return H - (val / maxVal) * H;
}

export const SCurve: React.FC<SCurveProps> = () => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const stepX = W / (plannedData.length - 1);

  const plannedPath = plannedData.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yPos(v)}`).join(' ');
  const actualPath = actualData.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yPos(v)}`).join(' ');
  const actualFill = actualPath + ` L ${(actualData.length - 1) * stepX} ${H} L 0 ${H} Z`;

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
              setAnnouncement(`Month: ${months[next]}, Planned: $${plannedData[next]}M, Actual: $${actualData[next] !== undefined ? actualData[next] : 'N/A'}M`);
              return next;
            });
          } else if (e.key === 'ArrowLeft') {
            setHovered(prev => {
              const next = prev === null ? actualData.length - 1 : Math.max(prev - 1, 0);
              setAnnouncement(`Month: ${months[next]}, Planned: $${plannedData[next]}M, Actual: $${actualData[next] !== undefined ? actualData[next] : 'N/A'}M`);
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
          <desc>{`Planned spend: $${plannedData[plannedData.length - 1]}M, Actual spend to date: $${actualData[actualData.length - 1]}M`}</desc>
          {/* Grid */}
          {[10, 20, 30, 40].map((v) => (
            <React.Fragment key={v}>
              <line x1={0} y1={yPos(v)} x2={W} y2={yPos(v)} stroke={colors.borderSubtle} strokeWidth="0.3" />
              <text x={-3} y={yPos(v) + 1.5} textAnchor="end" fill={colors.textTertiary} fontSize="3" fontFamily={typography.fontFamily}>${v}M</text>
            </React.Fragment>
          ))}

          {/* Planned line (dashed) */}
          <path d={plannedPath} fill="none" stroke={colors.textTertiary} strokeWidth="0.8" strokeDasharray="2 1.5" opacity={0.5} />

          {/* Actual fill */}
          <path
            d={actualFill}
            fill={`${colors.primaryOrange}10`}
            style={{
              opacity: animated ? 1 : 0,
              transition: 'opacity 0.8s ease-out',
            }}
          />

          {/* Actual line (animated) */}
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
                aria-label={`${months[i]}: Actual $${actualData[i]}M`}
                style={{ cursor: 'pointer', opacity: animated ? 1 : 0, transition: `opacity 0.5s ease-out ${i * 0.1}s`, outline: 'none' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              />
            </g>
          ))}

          {/* X axis labels */}
          {months.map((m, i) => (
            i % 2 === 0 && (
              <text key={m} x={i * stepX} y={H + 8} textAnchor="middle" fill={colors.textTertiary} fontSize="3" fontFamily={typography.fontFamily}>
                {m}
              </text>
            )
          ))}

          {/* Forecast zone */}
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
              <tr key={m}>
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
            left: `${(hovered / (plannedData.length - 1)) * 100}%`,
            top: 0, transform: 'translateX(-50%)',
            padding: `${spacing['1']} ${spacing['2']}`,
            backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.sm,
            boxShadow: shadows.cardHover,
            fontSize: typography.fontSize.caption, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
          }}>
            <span style={{ fontWeight: typography.fontWeight.semibold }}>${actualData[hovered]}M actual</span>
            <span style={{ color: colors.textTertiary }}> / ${plannedData[hovered]}M planned</span>
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
