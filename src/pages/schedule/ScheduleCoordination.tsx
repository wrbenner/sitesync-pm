import React from 'react';
import { Sparkles, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, RefreshCw, Cloud, Shield, Zap } from 'lucide-react';
import { Skeleton } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import type { PredictedRisk } from '../../lib/predictions';

interface OverallHealthStatus {
  status: string;
  label: string;
}

interface CriticalPathRisk {
  id: string;
  name: string;
  floatDays: number;
  status: string | undefined;
}

interface ScheduleCoordinationProps {
  risks: PredictedRisk[];
  riskPanelOpen: boolean;
  setRiskPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  analyzing: boolean;
  lastAnalyzed: Date | null;
  minutesAgo: number;
  runAnalysis: () => void;
  overallHealthStatus: OverallHealthStatus;
  criticalPathAtRisk: CriticalPathRisk[];
  outdoorActivityCount: number;
  aiEdgeText: string | null;
  aiEdgeLoading: boolean;
  runAiEdgeAnalysis: () => void;
  openCopilotWithRisk: (risk: PredictedRisk) => void;
  recoveryExpanded: boolean;
  setRecoveryExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

// ── Health badge colors ─────────────────────────────────
function healthColors(status: string): { fg: string; bg: string; border: string; icon: React.ReactNode } {
  if (status === 'green') return { fg: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: <Shield size={14} /> };
  if (status === 'amber') return { fg: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: <AlertTriangle size={14} /> };
  return { fg: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5', icon: <AlertTriangle size={14} /> };
}

// ── Risk severity color ─────────────────────────────────
function riskColor(likelihood: number): { fg: string; bg: string } {
  if (likelihood >= 70) return { fg: '#DC2626', bg: '#FEF2F2' };
  if (likelihood >= 40) return { fg: '#D97706', bg: '#FEF3C7' };
  return { fg: '#6B7280', bg: '#F3F4F6' };
}

export const ScheduleCoordination: React.FC<ScheduleCoordinationProps> = ({
  risks,
  riskPanelOpen,
  setRiskPanelOpen,
  analyzing,
  lastAnalyzed,
  minutesAgo,
  runAnalysis,
  overallHealthStatus,
  criticalPathAtRisk,
  outdoorActivityCount,
  aiEdgeText,
  aiEdgeLoading,
  runAiEdgeAnalysis,
  openCopilotWithRisk,
  recoveryExpanded,
  setRecoveryExpanded,
}) => {
  const hc = healthColors(overallHealthStatus.status);
  const totalImpact = risks.reduce((s, r) => s + (r.impactDays ?? 0), 0);

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${risks.length > 0 ? `${colors.primaryOrange}20` : colors.borderSubtle}`,
      overflow: 'hidden',
      boxShadow: shadows.card,
    }}>
      {/* ── Panel header ── */}
      <div
        role="button" tabIndex={0}
        aria-expanded={riskPanelOpen}
        aria-label={`AI Risk Analysis panel, ${riskPanelOpen ? 'expanded' : 'collapsed'}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['4']} ${spacing['5']}`,
          borderBottom: riskPanelOpen ? `1px solid ${colors.borderSubtle}` : 'none',
          cursor: 'pointer',
          transition: `background-color ${transitions.quick}`,
        }}
        onClick={() => setRiskPanelOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRiskPanelOpen((v) => !v); } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div style={{
            width: 32, height: 32, borderRadius: borderRadius.md,
            background: risks.length > 0
              ? 'linear-gradient(135deg, #FEF3C7, #FDE68A)'
              : 'linear-gradient(135deg, #F0FDF4, #BBF7D0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={16} color={risks.length > 0 ? '#D97706' : '#16A34A'} />
          </div>
          <div>
            <span style={{
              fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.body,
              color: colors.textPrimary, display: 'block', lineHeight: 1,
            }}>
              AI Risk Analysis
            </span>
            {lastAnalyzed && !analyzing && (
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, lineHeight: 1 }}>
                {minutesAgo === 0 ? 'Just analyzed' : `${minutesAgo}m ago`}
              </span>
            )}
          </div>
          {risks.length > 0 && (
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
              backgroundColor: '#FEF3C7', color: '#92400E',
              padding: `2px ${spacing['2.5']}`, borderRadius: borderRadius.full,
            }}>
              {risks.length} risk{risks.length > 1 ? 's' : ''} · +{totalImpact}d impact
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {/* Health badge */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: spacing['1.5'],
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
            padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.full,
            backgroundColor: hc.bg, color: hc.fg, border: `1px solid ${hc.border}`,
          }}>
            {hc.icon}
            {overallHealthStatus.status === 'green' ? 'Healthy' : overallHealthStatus.status === 'amber' ? 'Monitor' : 'At Risk'}
          </span>

          <button onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
            disabled={analyzing}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
              color: analyzing ? colors.textTertiary : colors.primaryOrange,
              background: 'none', border: 'none', cursor: analyzing ? 'default' : 'pointer',
              fontFamily: typography.fontFamily, padding: spacing['1'],
            }}
          >
            <RefreshCw size={13} style={{ animation: analyzing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {riskPanelOpen ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
        </div>
      </div>

      {/* ── Panel body ── */}
      {riskPanelOpen && (
        <div style={{ padding: spacing['5'], display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>

          {/* Summary row */}
          <div style={{ display: 'flex', gap: spacing['3'], flexWrap: 'wrap' }}>
            {/* Critical path risks */}
            {criticalPathAtRisk.length > 0 && (
              <div style={{
                flex: '1 1 300px', padding: spacing['4'],
                backgroundColor: '#FEF2F2', borderRadius: borderRadius.lg,
                border: '1px solid #FEE2E2',
              }}>
                <div style={{
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                  color: '#991B1B', textTransform: 'uppercase' as const,
                  letterSpacing: typography.letterSpacing.wider, marginBottom: spacing['3'],
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                }}>
                  <Zap size={12} />
                  Critical Path Risks
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {criticalPathAtRisk.map(activity => (
                    <div key={activity.id} style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      fontSize: typography.fontSize.sm,
                    }}>
                      <span style={{
                        width: 3, height: 16, borderRadius: 2, backgroundColor: '#EF4444', flexShrink: 0,
                      }} />
                      <span style={{ flex: 1, color: '#7F1D1D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activity.name}
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: '#991B1B', fontVariantNumeric: 'tabular-nums' }}>
                        {activity.floatDays}d float
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weather impact */}
            {outdoorActivityCount > 0 && (
              <div style={{
                flex: '1 1 200px', padding: spacing['4'],
                backgroundColor: '#FEF3C7', borderRadius: borderRadius.lg,
                border: '1px solid #FDE68A',
                display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
              }}>
                <Cloud size={18} color="#92400E" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: '#92400E', display: 'block' }}>
                    {outdoorActivityCount} outdoor {outdoorActivityCount === 1 ? 'activity' : 'activities'}
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: '#A16207' }}>
                    Check weather before committing
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Risk items */}
          {analyzing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {[1, 2].map((i) => (
                <div key={i} style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-start' }}>
                  <Skeleton height="36px" width="36px" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                    <Skeleton height="14px" width="40%" />
                    <Skeleton height="12px" width="80%" />
                  </div>
                </div>
              ))}
            </div>
          ) : risks.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              padding: spacing['4'], backgroundColor: '#F0FDF4',
              borderRadius: borderRadius.lg, border: '1px solid #BBF7D0',
            }}>
              <CheckCircle2 size={18} color="#16A34A" />
              <span style={{ fontSize: typography.fontSize.sm, color: '#166534', fontWeight: typography.fontWeight.medium }}>
                No risks detected. Schedule looks healthy for the next 7 days.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {risks.map((risk) => {
                const rc = riskColor(risk.likelihoodPercent);
                return (
                  <div key={risk.phaseId}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surfaceHover;
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surfaceInset;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    style={{
                    display: 'flex', gap: spacing['4'], alignItems: 'flex-start',
                    padding: spacing['4'], backgroundColor: colors.surfaceInset,
                    borderRadius: borderRadius.lg,
                    borderLeft: `3px solid ${rc.fg}`,
                    transition: `background-color ${transitions.quick}, box-shadow ${transitions.quick}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap', marginBottom: spacing['1.5'] }}>
                        <span style={{
                          fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm,
                          color: colors.textPrimary,
                        }}>
                          {risk.title}
                        </span>
                        <span style={{
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
                          backgroundColor: rc.bg, color: rc.fg,
                          padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                        }}>
                          {risk.likelihoodPercent}%
                        </span>
                        <span style={{
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          backgroundColor: '#FEF3C7', color: '#92400E',
                          padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                        }}>
                          +{risk.impactDays}d
                        </span>
                      </div>
                      <p style={{
                        margin: 0, fontSize: typography.fontSize.sm,
                        color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed,
                      }}>
                        {risk.reason}
                      </p>
                    </div>
                    <button
                      onClick={() => openCopilotWithRisk(risk)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 3px 8px rgba(244,120,32,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 2px rgba(244,120,32,0.2)';
                      }}
                      style={{
                        padding: `${spacing['2']} ${spacing['4']}`,
                        backgroundColor: colors.primaryOrange, color: colors.white,
                        border: 'none', borderRadius: borderRadius.lg,
                        fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                        fontFamily: typography.fontFamily, cursor: 'pointer',
                        whiteSpace: 'nowrap', flexShrink: 0,
                        boxShadow: '0 1px 2px rgba(244,120,32,0.2)',
                        transition: `transform ${transitions.quick}, box-shadow ${transitions.quick}`,
                      }}
                    >
                      Recovery Plan
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI Deep Analysis */}
          <div style={{
            borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['4'],
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              Deep AI analysis via cloud
            </span>
            <button onClick={runAiEdgeAnalysis} disabled={aiEdgeLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                backgroundColor: 'transparent', color: colors.primaryOrange,
                border: `1px solid ${colors.primaryOrange}30`,
                borderRadius: borderRadius.lg,
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                cursor: aiEdgeLoading ? 'default' : 'pointer',
                opacity: aiEdgeLoading ? 0.6 : 1,
                transition: transitions.quick,
              }}
            >
              {aiEdgeLoading
                ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <Sparkles size={13} />
              }
              {aiEdgeLoading ? 'Analyzing...' : 'Run Deep Analysis'}
            </button>
          </div>
          {aiEdgeText && (
            <div style={{
              padding: spacing['4'], backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`,
            }}>
              <p style={{
                margin: 0, fontSize: typography.fontSize.sm,
                color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed,
                whiteSpace: 'pre-wrap',
              }}>
                {aiEdgeText}
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
