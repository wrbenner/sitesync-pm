// ── AutoDraftPanel ─────────────────────────────────────────────────────────
// Tab A's main UI surface. Renders all 5 sections of an auto-drafted daily
// log inline-editable, with per-section "Regenerate" + a global "Looks
// right" / "Reject" footer.
//
// State management: the panel keeps a local copy of the draft and edits
// it in place. On "Looks right" we POST a status='approved' update on
// the drafted_actions row + invoke services/iris/executors/dailyLog.ts
// (or just hand back to the caller via onApprove). On "Reject" we set
// status='rejected' but preserve the draft for audit.
//
// The component accepts the draft via prop so it's trivially renderable
// in __demo__ and tests against mock data — no Supabase required.

import React, { useState } from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';
import type {
  DraftedDailyLog,
  DraftedDailyLogSectionId,
} from '../../types/dailyLogDraft';
import { AutoDraftSection } from './AutoDraftSection';

export interface AutoDraftPanelProps {
  draft: DraftedDailyLog;
  /** Approve handler — caller persists the result and finalizes the log. */
  onApprove: (finalized: DraftedDailyLog) => Promise<void> | void;
  /** Reject handler — caller marks the drafted_actions row rejected. */
  onReject: (reason?: string) => Promise<void> | void;
  /** Regenerate one section. Caller re-invokes draft-daily-log with the
   *  section param and pushes the new sub-draft back in via `draft`. */
  onRegenerateSection?: (id: DraftedDailyLogSectionId) => Promise<void> | void;
  /** Disables all editing; renders as a read-only audit view. */
  readOnly?: boolean;
}

const SECTION_DEFS: ReadonlyArray<{
  id: DraftedDailyLogSectionId;
  title: string;
}> = [
  { id: 'weather', title: 'Weather & Conditions' },
  { id: 'manpower', title: 'Manpower' },
  { id: 'work_performed', title: 'Work Performed' },
  { id: 'issues', title: 'Issues / Delays' },
  { id: 'visitors', title: 'Visitors / Inspections' },
];

export const AutoDraftPanel: React.FC<AutoDraftPanelProps> = ({
  draft: initialDraft,
  onApprove,
  onReject,
  onRegenerateSection,
  readOnly,
}) => {
  const [draft, setDraft] = useState<DraftedDailyLog>(initialDraft);
  const [busySection, setBusySection] = useState<DraftedDailyLogSectionId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const updateBullet = (sectionId: DraftedDailyLogSectionId, index: number, newText: string) => {
    setDraft((prev) => {
      const arr = (prev[sectionId === 'work_performed' ? 'work_performed'
        : sectionId === 'issues' ? 'issues'
        : sectionId === 'visitors' ? 'visitors' : 'work_performed'] as ReadonlyArray<typeof prev.work_performed[number]>);
      const next = arr.map((b, i) => i === index ? { ...b, text: newText } : b);
      if (sectionId === 'work_performed') return { ...prev, work_performed: next };
      if (sectionId === 'issues') return { ...prev, issues: next };
      if (sectionId === 'visitors') return { ...prev, visitors: next };
      return prev;
    });
  };

  const handleRegenerate = async (id: DraftedDailyLogSectionId) => {
    if (!onRegenerateSection) return;
    setBusySection(id);
    try { await onRegenerateSection(id); } finally { setBusySection(null); }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try { await onApprove(draft); } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (rejectReason.trim().length < 3) {
      setShowRejectInput(true);
      return;
    }
    setSubmitting(true);
    try { await onReject(rejectReason.trim()); } finally { setSubmitting(false); }
  };

  return (
    <div
      style={{
        marginTop: spacing['3'],
        padding: spacing['4'],
        background: colors.surfacePage,
        border: `1px solid ${colors.primaryOrange}`,
        borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing['2'] }}>
        <Sparkles size={14} color={colors.primaryOrange} />
        <h3 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
          Auto-drafted daily log
        </h3>
        {draft.partial && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: colors.statusPendingSubtle,
              color: colors.statusPending,
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            Partial — please review
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['3'] }}>
        Generated from {draft.provenance.reduce((acc, p) => acc + p.count, 0)} source data points across photos, RFIs, schedule activity, and crew check-ins.
        Edit any bullet inline; tap Regenerate to refresh a single section.
      </p>

      {/* Weather + Manpower share simpler render paths — they're not bullet lists. */}
      <AutoDraftSection
        id="weather"
        title={SECTION_DEFS[0].title}
        bullets={[]}
        reason={draft.partial_reasons.weather}
        headerExtra={
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
            {draft.weather_summary}
          </span>
        }
        onBulletChange={() => {}}
        onRegenerate={onRegenerateSection ? () => handleRegenerate('weather') : undefined}
        busy={busySection === 'weather'}
        readOnly={readOnly}
      />

      <AutoDraftSection
        id="manpower"
        title={SECTION_DEFS[1].title}
        bullets={[]}
        reason={draft.partial_reasons.manpower}
        headerExtra={
          draft.manpower.length === 0 ? null : (
            <table style={{ width: '100%', fontSize: typography.fontSize.sm, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: colors.textSecondary, textAlign: 'left' }}>
                  <th style={{ padding: '4px 0', fontWeight: typography.fontWeight.medium }}>Trade</th>
                  <th style={{ padding: '4px 0', fontWeight: typography.fontWeight.medium }}>Sub</th>
                  <th style={{ padding: '4px 0', fontWeight: typography.fontWeight.medium, textAlign: 'right' }}>Count</th>
                  <th style={{ padding: '4px 0', fontWeight: typography.fontWeight.medium, textAlign: 'right' }}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {draft.manpower.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                    <td style={{ padding: '6px 0' }}>{row.trade}</td>
                    <td style={{ padding: '6px 0', color: colors.textSecondary }}>
                      {row.sub_company ?? '—'}
                      {row.source === 'roster_scheduled' && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: colors.statusPending }}>
                          (scheduled — attendance unconfirmed)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>{row.count}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>{row.hours ?? '—'}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${colors.border}`, fontWeight: typography.fontWeight.semibold }}>
                  <td style={{ padding: '6px 0' }}>Total</td>
                  <td />
                  <td style={{ padding: '6px 0', textAlign: 'right' }}>{draft.manpower_total}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )
        }
        onBulletChange={() => {}}
        onRegenerate={onRegenerateSection ? () => handleRegenerate('manpower') : undefined}
        busy={busySection === 'manpower'}
        readOnly={readOnly}
      />

      <AutoDraftSection
        id="work_performed"
        title={SECTION_DEFS[2].title}
        bullets={draft.work_performed}
        reason={draft.partial_reasons.work_performed}
        onBulletChange={(i, text) => updateBullet('work_performed', i, text)}
        onRegenerate={onRegenerateSection ? () => handleRegenerate('work_performed') : undefined}
        busy={busySection === 'work_performed'}
        readOnly={readOnly}
      />

      <AutoDraftSection
        id="issues"
        title={SECTION_DEFS[3].title}
        bullets={draft.issues}
        reason={draft.partial_reasons.issues}
        onBulletChange={(i, text) => updateBullet('issues', i, text)}
        onRegenerate={onRegenerateSection ? () => handleRegenerate('issues') : undefined}
        busy={busySection === 'issues'}
        readOnly={readOnly}
      />

      <AutoDraftSection
        id="visitors"
        title={SECTION_DEFS[4].title}
        bullets={draft.visitors}
        reason={draft.partial_reasons.visitors}
        onBulletChange={(i, text) => updateBullet('visitors', i, text)}
        onRegenerate={onRegenerateSection ? () => handleRegenerate('visitors') : undefined}
        busy={busySection === 'visitors'}
        readOnly={readOnly}
      />

      {/* Footer */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            marginTop: spacing['3'],
            paddingTop: spacing['3'],
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          {showRejectInput && (
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for reject (≥ 3 chars)"
              style={{
                flex: 1,
                padding: '6px 10px',
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
              }}
              autoFocus
            />
          )}
          <button
            onClick={() => showRejectInput ? handleReject() : setShowRejectInput(true)}
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 14px',
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textSecondary,
            }}
          >
            <X size={12} />
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 16px',
              border: 'none',
              borderRadius: 6,
              background: colors.primaryOrange,
              color: 'white',
              cursor: 'pointer',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            <Check size={12} />
            Looks right
          </button>
        </div>
      )}
    </div>
  );
};

export default AutoDraftPanel;
