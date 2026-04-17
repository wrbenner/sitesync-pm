import React from 'react';
import { Sparkles, AlertTriangle, ChevronDown, ChevronUp, CheckCircle, RefreshCw, Cloud } from 'lucide-react';
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
}) => (
  <>
    {recoveryExpanded && (
      <div style={{
        padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'],
        backgroundColor: `${colors.statusPending}06`, borderRadius: borderRadius.md,
        border: `1px solid ${colors.statusPending}15`,
        animation: 'slideInUp 200ms ease-out',
      }}>
        <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Recovery Plan</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[
            'Authorize MEP overtime on floors 4 through 6 to recover 4 days of schedule float.',
            'Redirect Exterior Crew D to secondary facade sections while RFI 004 is resolved.',
            'Batch Tuesday RFI reviews with MEP consultant to reduce average response time by 40%.',
          ].map((action, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.semibold }}>{i + 1}.</span>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>{action}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setRecoveryExpanded(false)} style={{ marginTop: spacing['3'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, color: colors.textTertiary, cursor: 'pointer' }}>
          Collapse
        </button>
      </div>
    )}

    {/* AI Risk Panel */}
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${risks.length > 0 ? `${colors.primaryOrange}30` : colors.borderDefault}`,
      marginBottom: spacing['5'],
      overflow: 'hidden',
      boxShadow: shadows.sm,
    }}>
      {/* Panel header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={riskPanelOpen}
        aria-label={`AI Risk Analysis panel, ${riskPanelOpen ? 'expanded' : 'collapsed'}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['3']} ${spacing['4']}`,
          borderBottom: riskPanelOpen ? `1px solid ${colors.borderDefault}` : 'none',
          cursor: 'pointer',
          backgroundColor: risks.length > 0 ? `${colors.primaryOrange}05` : 'transparent',
        }}
        onClick={() => setRiskPanelOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRiskPanelOpen((v) => !v); } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Sparkles size={15} color={risks.length > 0 ? colors.primaryOrange : colors.statusActive} />
          <span style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
            AI Risk Analysis
          </span>
          {risks.length > 0 && (
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              backgroundColor: `${colors.primaryOrange}18`, color: colors.primaryOrange,
              padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
            }}>
              {risks.length} risk{risks.length > 1 ? 's' : ''} detected
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {lastAnalyzed && !analyzing && (
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Last analyzed: {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
            disabled={analyzing}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              color: analyzing ? colors.textTertiary : colors.primaryOrange,
              background: 'none', border: 'none', cursor: analyzing ? 'default' : 'pointer',
              fontFamily: typography.fontFamily, padding: 0,
            }}
          >
            <RefreshCw size={11} style={{ animation: analyzing ? 'spin 1s linear infinite' : 'none' }} />
            Re-analyze
          </button>
          {riskPanelOpen ? <ChevronUp size={14} color={colors.textTertiary} /> : <ChevronDown size={14} color={colors.textTertiary} />}
        </div>
      </div>

      {/* Panel body */}
      {riskPanelOpen && (
        <div style={{ padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>

          {/* Section A: Overall Health */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>
              Overall Health
            </span>
            <span style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              padding: `2px ${spacing['3']}`,
              borderRadius: borderRadius.full,
              backgroundColor: overallHealthStatus.status === 'green'
                ? `${colors.statusActive}18`
                : overallHealthStatus.status === 'amber'
                ? `${colors.statusPending}18`
                : `${colors.statusCritical}18`,
              color: overallHealthStatus.status === 'green'
                ? colors.statusActive
                : overallHealthStatus.status === 'amber'
                ? colors.statusPending
                : colors.statusCritical,
            }}>
              {overallHealthStatus.label}
            </span>
          </div>

          {/* Section B: Critical Path Risks */}
          {criticalPathAtRisk.length > 0 && (
            <div>
              <p style={{ margin: `0 0 ${spacing['2']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Critical Path Risks
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {criticalPathAtRisk.map(activity => (
                  <div key={activity.id} style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: `${colors.statusCritical}08`,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${colors.statusCritical}20`,
                  }}>
                    <AlertTriangle size={13} color={colors.statusCritical} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activity.name}
                    </span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                      {activity.floatDays}d float
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                      padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                      backgroundColor: activity.status === 'delayed' ? `${colors.statusCritical}15` : `${colors.statusPending}15`,
                      color: activity.status === 'delayed' ? colors.statusCritical : colors.statusPending,
                      whiteSpace: 'nowrap',
                    }}>
                      {activity.status === 'delayed' ? 'Delayed' : 'Low Float'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section C: Weather Impact */}
          {outdoorActivityCount > 0 && (
            <div style={{
              padding: `${spacing['3']} ${spacing['3']}`,
              backgroundColor: `${colors.statusPending}10`,
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.statusPending}25`,
              display: 'flex', alignItems: 'center', gap: spacing['3'],
            }}>
              <Cloud size={15} color={colors.statusPending} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                <strong style={{ color: colors.textPrimary }}>{outdoorActivityCount} outdoor {outdoorActivityCount === 1 ? 'activity' : 'activities'}</strong> scheduled this week. Check weather before committing.
              </span>
            </div>
          )}

          {/* Predictive risk items from local analysis */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} 0` }}>
              <CheckCircle size={16} color={colors.statusActive} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                No risks detected for the next 7 days. Schedule looks healthy.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {risks.map((risk) => (
                <div key={risk.phaseId} style={{
                  display: 'flex', gap: spacing['3'], alignItems: 'flex-start',
                  padding: `${spacing['3']} ${spacing['3']}`,
                  backgroundColor: `${colors.primaryOrange}06`,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.primaryOrange}15`,
                }}>
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    <AlertTriangle size={15} color={colors.primaryOrange} fill={`${colors.primaryOrange}25`} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap', marginBottom: spacing['1'] }}>
                      <span style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                        {risk.title}
                      </span>
                      <span style={{
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                        backgroundColor: risk.likelihoodPercent >= 70 ? `${colors.statusCritical}15` : `${colors.statusPending}15`,
                        color: risk.likelihoodPercent >= 70 ? colors.statusCritical : colors.statusPending,
                        padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                      }}>
                        {risk.likelihoodPercent}% likely
                      </span>
                      <span style={{
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                        backgroundColor: `${colors.primaryOrange}12`, color: colors.primaryOrange,
                        padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                      }}>
                        +{risk.impactDays} day{risk.impactDays > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                      {risk.reason}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <button
                      onClick={() => openCopilotWithRisk(risk)}
                      style={{
                        padding: `${spacing['1']} ${spacing['3']}`,
                        backgroundColor: colors.primaryOrange, color: colors.white,
                        border: 'none', borderRadius: borderRadius.base,
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                        fontFamily: typography.fontFamily, cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: `opacity ${transitions.quick}`,
                      }}
                    >
                      View Recovery Plan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Edge Function section */}
          <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Deep AI analysis via cloud service
              </span>
              <button
                onClick={runAiEdgeAnalysis}
                disabled={aiEdgeLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['1']} ${spacing['3']}`,
                  backgroundColor: colors.primaryOrange, color: colors.white,
                  border: 'none', borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: aiEdgeLoading ? 'default' : 'pointer',
                  opacity: aiEdgeLoading ? 0.7 : 1,
                  transition: `opacity ${transitions.quick}`,
                }}
              >
                {aiEdgeLoading
                  ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Sparkles size={12} />
                }
                {aiEdgeLoading ? 'Analyzing...' : 'Run AI Analysis'}
              </button>
            </div>
            {aiEdgeText && (
              <div style={{
                padding: spacing['3'],
                backgroundColor: `${colors.primaryOrange}06`,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.primaryOrange}20`,
              }}>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                  {aiEdgeText}
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  </>
);
