import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles, ChevronRight, Share2, FileText, Link, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Card, SectionHeader, Btn, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useInView } from '../hooks/useInView';

interface HealthDimension {
  label: string;
  score: number;
  trend: 'up' | 'down' | 'flat';
  change: number;
  detail: string;
  fullDetail: string;
  route: string;
}

const overallScore = 87;
const percentile = 82;

const dimensions: HealthDimension[] = [
  { label: 'Schedule Health', score: 78, trend: 'down', change: -3, detail: 'MEP phase 6 days behind. Exterior weather risk.', fullDetail: 'MEP phase is trending 6 days behind the baseline schedule, primarily driven by unanswered RFI 003 and submittal review delays. Exterior curtain wall work faces weather risk with 3 rain days forecast next week. Critical path has shifted from structure to MEP rough in.', route: '/schedule' },
  { label: 'Budget Health', score: 91, trend: 'flat', change: 0, detail: 'Overall 1.2% under budget. Structural at risk.', fullDetail: 'Project is tracking 1.2% under total budget with $3.8M contingency remaining. However, the Structural division is at 97% spend with effectively zero remaining contingency. Electrical division trending 8% over on projected final cost. Two change orders pending approval totaling $157K.', route: '/budget' },
  { label: 'Quality', score: 88, trend: 'up', change: 2, detail: 'Submittal approval rate improving. 1 revision pending.', fullDetail: 'Submittal first pass approval rate has improved from 60% to 75% over the past month. The Tuesday batch review process is working well. One revision pending on door hardware specs. Drawing coordination clashes reduced from 5 to 3 this month.', route: '/punch-list' },
  { label: 'Safety', score: 96, trend: 'up', change: 1, detail: '0 incidents this week. 1 overdue punch item (safety).', fullDetail: 'Zero recordable incidents this week and month to date. One safety related punch list item (PL 003, door closer in parking garage) is 3 days past the 48 hour resolution target. Quarterly safety audit scheduled for Friday with 3 open findings from last inspection.', route: '/daily-log' },
  { label: 'Communication', score: 82, trend: 'down', change: -2, detail: '2 RFIs overdue. Response time trending up.', fullDetail: 'Average RFI response time has increased from 3.2 to 4.1 days over the past two weeks. RFI 003 and RFI 004 are both overdue, with cascading impacts on schedule. Pattern analysis shows 68% of recent RFIs from floors 8 to 10 are MEP coordination issues that could be batched.', route: '/activity' },
  { label: 'Documentation', score: 90, trend: 'up', change: 3, detail: 'All drawings current. Daily logs on time.', fullDetail: 'All drawing sets are on the current revision. Daily logs have been submitted on time for 14 consecutive days. One drawing (M 001 HVAC diagram) may need revision based on CO 002 HVAC upgrade scope. File organization compliance at 94%.', route: '/files' },
];

const historicalScores = [84, 85, 86, 85, 87, 86, 88, 87, 89, 88, 90, 89, 87, 86, 88, 87, 85, 86, 87, 87];
const weekLabels = historicalScores.map((_, i) => `W${i + 1}`);

const aiExplanation = 'Score dropped 3 points this week due to 2 missed milestones and 4 overdue RFIs. The MEP phase slipping contributed most to the schedule dimension decline. Positive factors: improved submittal velocity and zero safety incidents.';

function getScoreColor(score: number): string {
  if (score >= 90) return colors.statusActive;
  if (score >= 70) return colors.statusPending;
  if (score >= 50) return colors.statusInfo;
  return colors.statusCritical;
}

function getLineColor(score: number): string {
  if (score > 70) return colors.statusActive;
  if (score >= 50) return colors.statusPending;
  return colors.statusCritical;
}

const TrendIcons = { up: TrendingUp, down: TrendingDown, flat: Minus };
const trendColors = { up: colors.statusActive, down: colors.statusCritical, flat: colors.textTertiary };

export const ProjectHealth: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [chartRef, chartInView] = useInView();
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const scoreColor = getScoreColor(overallScore);
  const circumference = 2 * Math.PI * 70;
  // Fix 9: No animation, show final value immediately
  const offset = circumference - (overallScore / 100) * circumference;

  // Fix 8: Score history line chart data
  const chartW = 100;
  const chartH = 120;
  const minScore = 70;
  const maxScore = 100;
  const stepX = chartW / (historicalScores.length - 1);
  const yPos = (score: number) => chartH - ((score - minScore) / (maxScore - minScore)) * chartH;

  const linePath = historicalScores
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yPos(s)}`)
    .join(' ');

  return (
    <PageContainer
      title="Project Health"
      subtitle="Meridian Tower health score and diagnostics"
      actions={
        <div style={{ position: 'relative' }}>
          <Btn variant="secondary" size="sm" icon={<Share2 size={14} />} onClick={() => setShareOpen(!shareOpen)}>
            Share Report
          </Btn>
          {/* Fix 11: Share dropdown */}
          {shareOpen && (
            <>
              <div onClick={() => setShareOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: spacing['1'],
                backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md,
                boxShadow: shadows.dropdown, zIndex: 1000, overflow: 'hidden', minWidth: '180px',
              }}>
                {[
                  { icon: <FileText size={14} />, label: 'Export as PDF' },
                  { icon: <Link size={14} />, label: 'Copy Link' },
                  { icon: <Send size={14} />, label: 'Send to Owner' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { addToast('info', 'Coming soon'); setShareOpen(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                      padding: `${spacing['2']} ${spacing['3']}`, border: 'none',
                      backgroundColor: 'transparent', cursor: 'pointer',
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      color: colors.textPrimary, textAlign: 'left',
                      transition: `background-color ${transitions.instant}`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ color: colors.textTertiary, display: 'flex' }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: spacing['6'] }}>
        {/* Score ring */}
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 180, height: 180 }}>
              <svg width={180} height={180} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={90} cy={90} r={70} fill="none" stroke={colors.surfaceInset} strokeWidth="12" />
                <circle
                  cx={90} cy={90} r={70} fill="none" stroke={scoreColor} strokeWidth="12"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '48px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: 1 }}>{overallScore}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>out of 100</span>
              </div>
            </div>

            <div style={{ marginTop: spacing['4'], textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: scoreColor, margin: 0 }}>
                {overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : overallScore >= 60 ? 'Fair' : 'Needs Attention'}
              </p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
                {percentile}nd percentile for mixed use projects
              </p>
            </div>
          </div>
        </Card>

        {/* Dimensions (Fix 10: clickable, Fix 12: expandable) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {dimensions.map((dim) => {
            const Icon = TrendIcons[dim.trend];
            const color = getScoreColor(dim.score);
            const tColor = trendColors[dim.trend];
            const isExpanded = expandedDim === dim.label;
            return (
              <div
                key={dim.label}
                onClick={() => navigate(dim.route)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['4'],
                  padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.md, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  cursor: 'pointer', transition: `all ${transitions.instant}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
              >
                {/* Score */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color }}>{dim.score}</span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{dim.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: tColor }}>
                      <Icon size={12} />
                      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium }}>{dim.change > 0 ? '+' : ''}{dim.change}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2 }}>{dim.detail}</p>

                  {/* Fix 12: Expandable detail */}
                  {isExpanded && (
                    <p style={{
                      fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, marginTop: spacing['2'],
                      lineHeight: typography.lineHeight.relaxed,
                      overflow: 'hidden', maxHeight: isExpanded ? '200px' : '0',
                      transition: 'max-height 0.3s ease-out',
                    }}>
                      {dim.fullDetail}
                    </p>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedDim(isExpanded ? null : dim.label); }}
                    style={{
                      display: 'inline', border: 'none', backgroundColor: 'transparent', padding: 0, marginTop: 2,
                      fontSize: typography.fontSize.caption, color: colors.primaryOrange, cursor: 'pointer',
                      fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
                    }}
                  >
                    {isExpanded ? 'See less' : 'See more'}
                  </button>
                </div>

                {/* Mini bar */}
                <div style={{ width: 60, height: 6, backgroundColor: colors.surfaceInset, borderRadius: 3, flexShrink: 0 }}>
                  <div style={{ width: `${dim.score}%`, height: '100%', backgroundColor: color, borderRadius: 3, transition: `width ${transitions.smooth}` }} />
                </div>

                {/* Fix 10: Arrow icon */}
                <ChevronRight size={16} color={colors.textTertiary} style={{ flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Fix 8: Proper line chart */}
      <div style={{ marginTop: spacing['6'] }} ref={chartRef}>
        <SectionHeader title="Score History" action={<span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Last 20 weeks</span>} />
        <Card padding={spacing['5']}>
          <svg
            viewBox={`-12 -10 ${chartW + 24} ${chartH + 28}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '200px', overflow: 'visible' }}
          >
            {/* Y-axis grid lines and labels */}
            {[70, 80, 90, 100].map((score) => (
              <React.Fragment key={score}>
                <line x1={0} y1={yPos(score)} x2={chartW} y2={yPos(score)} stroke={colors.borderSubtle} strokeWidth="0.3" />
                <text x={-4} y={yPos(score) + 1.5} textAnchor="end" fill={colors.textTertiary} fontSize="4" fontFamily={typography.fontFamily}>{score}</text>
              </React.Fragment>
            ))}

            {/* Color zones */}
            <rect x={0} y={yPos(100)} width={chartW} height={yPos(70) - yPos(100)} fill={`${colors.statusActive}06`} rx="1" />

            {/* Line */}
            {chartInView && (
              <>
                <path d={linePath} fill="none" stroke={colors.statusActive} strokeWidth="1.5" strokeLinecap="round" />
                {/* Data points */}
                {historicalScores.map((score, i) => (
                  <circle
                    key={i}
                    cx={i * stepX}
                    cy={yPos(score)}
                    r={i === historicalScores.length - 1 ? 3 : 2}
                    fill={i === historicalScores.length - 1 ? colors.primaryOrange : getLineColor(score)}
                    stroke={colors.surfaceRaised}
                    strokeWidth="1"
                  />
                ))}
              </>
            )}

            {/* X-axis labels (every 4th week) */}
            {weekLabels.filter((_, i) => i % 4 === 0 || i === weekLabels.length - 1).map((label) => {
              const idx = weekLabels.indexOf(label);
              return (
                <text key={label} x={idx * stepX} y={chartH + 12} textAnchor="middle" fill={colors.textTertiary} fontSize="4" fontFamily={typography.fontFamily}>{label}</text>
              );
            })}
          </svg>
        </Card>
      </div>

      {/* AI Explanation */}
      <div style={{ marginTop: spacing['5'] }}>
        <Card padding={spacing['4']}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${colors.statusReview} 0%, #9B8ADB 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={13} color="white" />
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['1'] }}>AI Analysis</p>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{aiExplanation}</p>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};
