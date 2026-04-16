import React from 'react';
import { Card, Btn } from '../../components/Primitives';
import { DataTable, createColumnHelper } from '../../components/shared/DataTable';
import { ShieldCheck } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { toast } from 'sonner';
import { CHECKLIST_TEMPLATES, type TemplateKey } from './safetyTypes';

// ── Inspection columns ────────────────────────────────────────

const inspectionCol = createColumnHelper<Record<string, unknown>>();
const inspectionColumns = [
  inspectionCol.accessor('date', {
    header: 'Date',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : ''}</span>,
  }),
  inspectionCol.accessor('type', {
    header: 'Type',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue() as string}</span>,
  }),
  inspectionCol.accessor('inspector', {
    header: 'Inspector',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
  }),
  inspectionCol.accessor('area', {
    header: 'Area',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
  }),
  inspectionCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string;
      const statusColor = v === 'passed' ? colors.statusActive : v === 'failed' ? colors.statusCritical : v === 'pending' ? colors.statusPending : colors.statusInfo;
      const statusBg = v === 'passed' ? colors.statusActiveSubtle : v === 'failed' ? colors.statusCriticalSubtle : v === 'pending' ? colors.statusPendingSubtle : colors.statusInfoSubtle;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: statusColor, backgroundColor: statusBg }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      );
    },
  }),
  inspectionCol.accessor('score', {
    header: 'Score',
    cell: (info) => {
      const score = info.getValue() as number | null;
      if (score == null) return <span style={{ color: colors.textTertiary }}>N/A</span>;
      const scoreColor = score >= 90 ? colors.statusActive : score >= 70 ? colors.statusPending : colors.statusCritical;
      return <span style={{ fontWeight: typography.fontWeight.semibold, color: scoreColor }}>{score}%</span>;
    },
  }),
];

// ── Cert columns ─────────────────────────────────────────────

const certCol = createColumnHelper<Record<string, unknown>>();
const certColumns = [
  certCol.accessor('worker_name', {
    header: 'Worker',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue() as string}</span>,
  }),
  certCol.accessor('company', {
    header: 'Company',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
  }),
  certCol.accessor('certification_type', {
    header: 'Type',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
  }),
  certCol.accessor('expiration_date', {
    header: 'Expires',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : 'No expiry'}</span>,
  }),
  certCol.display({
    id: 'cert_status',
    header: 'Status',
    cell: (info) => {
      const expDate = info.row.original.expiration_date as string | null;
      if (!expDate) return <span style={{ color: colors.textTertiary }}>No expiry</span>;
      const daysUntil = (new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntil < 0) return <span style={{ display: 'inline-flex', alignItems: 'center', padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold, color: '#FFFFFF', backgroundColor: colors.statusCritical, letterSpacing: '0.05em' }}>EXPIRED</span>;
      if (daysUntil <= 30) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, backgroundColor: colors.statusCriticalSubtle }}><div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.statusCritical }} />Expires in {Math.ceil(daysUntil)}d</span>;
      if (daysUntil <= 60) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: '#E67E22', backgroundColor: '#FFF7ED' }}><div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#E67E22' }} />Expires in {Math.ceil(daysUntil)}d</span>;
      if (daysUntil <= 90) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.statusPending, backgroundColor: colors.statusPendingSubtle }}><div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.statusPending }} />Expires in {Math.ceil(daysUntil)}d</span>;
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.statusActive, backgroundColor: colors.statusActiveSubtle }}><div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.statusActive }} />Valid</span>;
    },
  }),
];

// ── Corrective Action columns ─────────────────────────────────

const caCol = createColumnHelper<Record<string, unknown>>();
export const caColumns = [
  caCol.accessor('description', {
    header: 'Description',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue() as string}</span>,
  }),
  caCol.accessor('assigned_to', {
    header: 'Assigned To',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{(info.getValue() as string) || '—'}</span>,
  }),
  caCol.accessor('due_date', {
    header: 'Due Date',
    cell: (info) => {
      const val = info.getValue() as string | null;
      if (!val) return <span style={{ color: colors.textTertiary }}>—</span>;
      const isOverdue = new Date(val) < new Date() && info.row.original.status !== 'closed' && info.row.original.status !== 'verified';
      return (
        <span style={{ color: isOverdue ? colors.statusCritical : colors.textSecondary, fontWeight: isOverdue ? typography.fontWeight.semibold : typography.fontWeight.normal }}>
          {new Date(val).toLocaleDateString()}
          {isOverdue && <span style={{ marginLeft: spacing.xs, fontSize: typography.fontSize.caption, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}> OVERDUE</span>}
        </span>
      );
    },
  }),
  caCol.accessor('severity', {
    header: 'Severity',
    cell: (info) => {
      const v = (info.getValue() as string) || 'medium';
      const colorMap: Record<string, { fg: string; bg: string }> = {
        critical: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
        high: { fg: '#E67E22', bg: '#FFF7ED' },
        medium: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
        low: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
      };
      const c = colorMap[v] ?? colorMap.medium;
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: c.fg, backgroundColor: c.bg }}><div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c.fg }} />{v.charAt(0).toUpperCase() + v.slice(1)}</span>;
    },
  }),
  caCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = (info.getValue() as string) || 'open';
      const c = v === 'closed' || v === 'verified' ? colors.statusActive : v === 'in_progress' ? colors.statusInfo : colors.statusPending;
      const bg = v === 'closed' || v === 'verified' ? colors.statusActiveSubtle : v === 'in_progress' ? colors.statusInfoSubtle : colors.statusPendingSubtle;
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: c, backgroundColor: bg }}><div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c }} />{v === 'in_progress' ? 'In Progress' : v.charAt(0).toUpperCase() + v.slice(1)}</span>;
    },
  }),
];

// ── Inspections Tab ───────────────────────────────────────────

interface InspectionsTabProps {
  inspections: unknown[];
  passCount: number;
  failCount: number;
}

export const InspectionsTab: React.FC<InspectionsTabProps> = ({ inspections, passCount, failCount }) => {
  const [activeTemplate, setActiveTemplate] = React.useState<TemplateKey | null>(null);
  const [checklistResults, setChecklistResults] = React.useState<Record<string, 'pass' | 'fail' | 'na' | null>>({});
  const [checklistNotes, setChecklistNotes] = React.useState<Record<string, string>>({});

  return (
    <>
      {/* Checklist Template Selector */}
      <Card style={{ marginBottom: spacing['4'] }}>
        <p style={{ margin: `0 0 ${spacing['3']} 0`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Run Inspection Checklist</p>
        <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap', marginBottom: activeTemplate ? spacing['5'] : 0 }}>
          {(Object.keys(CHECKLIST_TEMPLATES) as TemplateKey[]).map((key) => {
            const isActive = activeTemplate === key;
            return (
              <button
                key={key}
                onClick={() => {
                  if (activeTemplate === key) { setActiveTemplate(null); setChecklistResults({}); setChecklistNotes({}); }
                  else { setActiveTemplate(key); setChecklistResults({}); setChecklistNotes({}); }
                }}
                style={{ padding: `${spacing['2']} ${spacing['4']}`, border: isActive ? `1.5px solid ${colors.primaryOrange}` : `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal, color: isActive ? colors.orangeText : colors.textPrimary, backgroundColor: isActive ? colors.orangeSubtle : colors.surfaceRaised, transition: `all ${transitions.instant}`, minHeight: '56px' }}
              >
                {CHECKLIST_TEMPLATES[key].label}
              </button>
            );
          })}
        </div>
        {activeTemplate && (
          <>
            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['4'] }}>
              {CHECKLIST_TEMPLATES[activeTemplate].items.map((item, idx) => {
                const result = checklistResults[idx] ?? null;
                const note = checklistNotes[idx] ?? '';
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], padding: `${spacing['3']} 0`, borderBottom: idx < CHECKLIST_TEMPLATES[activeTemplate].items.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, flex: 1, minWidth: 200 }}>{item}</span>
                      <div style={{ display: 'flex', gap: spacing['2'], flexShrink: 0 }}>
                        {(['pass', 'fail', 'na'] as const).map((val) => {
                          const isSelected = result === val;
                          const btnColor = val === 'pass' ? { fg: colors.statusActive, bg: colors.statusActiveSubtle, border: colors.statusActive } : val === 'fail' ? { fg: colors.statusCritical, bg: colors.statusCriticalSubtle, border: colors.statusCritical } : { fg: colors.textSecondary, bg: colors.surfaceInset, border: colors.borderDefault };
                          return (
                            <button key={val} aria-pressed={isSelected} aria-label={`${val === 'na' ? 'N/A' : val.charAt(0).toUpperCase() + val.slice(1)} for: ${item}`} onClick={() => setChecklistResults((p) => ({ ...p, [idx]: isSelected ? null : val }))} style={{ padding: `${spacing['1']} ${spacing['3']}`, border: isSelected ? `1.5px solid ${btnColor.border}` : `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, cursor: 'pointer', fontSize: typography.fontSize.caption, fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.normal, fontFamily: typography.fontFamily, color: isSelected ? btnColor.fg : colors.textTertiary, backgroundColor: isSelected ? btnColor.bg : 'transparent', transition: `all ${transitions.instant}`, textTransform: 'uppercase', letterSpacing: '0.04em', minHeight: '56px', minWidth: '52px' }}>
                              {val === 'na' ? 'N/A' : val.charAt(0).toUpperCase() + val.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setChecklistNotes((p) => ({ ...p, [idx]: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, color: colors.textPrimary, outline: 'none', backgroundColor: colors.surfaceInset }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['4'] }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                {Object.values(checklistResults).filter(Boolean).length} of {CHECKLIST_TEMPLATES[activeTemplate].items.length} items reviewed
                {Object.values(checklistResults).filter((r) => r === 'fail').length > 0 && <span style={{ marginLeft: spacing['2'], color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>{Object.values(checklistResults).filter((r) => r === 'fail').length} failed</span>}
              </span>
              <Btn variant="primary" onClick={() => { toast.info('Inspection saved. Backend required to persist.'); setActiveTemplate(null); setChecklistResults({}); setChecklistNotes({}); }} style={{ minHeight: '56px' }}>Complete Inspection</Btn>
            </div>
          </>
        )}
      </Card>

      {/* Past Inspection Records */}
      {inspections.length === 0 ? (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center' }}>
            <ShieldCheck size={40} style={{ color: colors.textTertiary }} />
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 360 }}>No inspections recorded. Safety tracking not yet configured.</p>
            <Btn variant="primary" onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: '56px' }}>Schedule First Inspection</Btn>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'] }}>
            <div style={{ backgroundColor: colors.statusActiveSubtle, borderRadius: borderRadius.md, padding: `${spacing['2']} ${spacing['4']}` }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{passCount} Passed</span>
            </div>
            <div style={{ backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, padding: `${spacing['2']} ${spacing['4']}` }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical }}>{failCount} Failed</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Card>
              <DataTable columns={inspectionColumns} data={inspections} enableSorting />
            </Card>
          </div>
        </>
      )}
    </>
  );
};

// ── Certifications Tab ────────────────────────────────────────

interface CertificationsTabProps {
  certifications: unknown[];
}

export const CertificationsTab: React.FC<CertificationsTabProps> = ({ certifications }) => {
  if (certifications.length === 0) {
    return (
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center' }}>
          <ShieldCheck size={40} style={{ color: colors.textTertiary }} />
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 360 }}>No certifications on file. Safety tracking not yet configured.</p>
          <Btn variant="primary" onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: '56px' }}>Add First Certification</Btn>
        </div>
      </Card>
    );
  }
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <Card>
        <DataTable columns={certColumns} data={certifications} enableSorting />
      </Card>
    </div>
  );
};

// ── Corrective Actions Tab ────────────────────────────────────

interface CorrectiveActionsTabProps {
  correctiveActions: unknown[];
}

export const CorrectiveActionsTab: React.FC<CorrectiveActionsTabProps> = ({ correctiveActions }) => {
  if (correctiveActions.length === 0) {
    return (
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center' }}>
          <ShieldCheck size={40} style={{ color: colors.textTertiary }} />
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 360 }}>No corrective actions on record. Corrective actions are created from safety inspections and incident investigations.</p>
          <Btn variant="primary" onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: '56px' }}>Log Corrective Action</Btn>
        </div>
      </Card>
    );
  }
  return (
    <>
      <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        {(['open', 'in_progress', 'closed'] as const).map((s) => {
          const count = correctiveActions.filter((ca: unknown) => (ca as Record<string, unknown>).status === s || (s === 'closed' && (ca as Record<string, unknown>).status === 'verified')).length;
          const colorMap = {
            open: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
            in_progress: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
            closed: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
          };
          const c = colorMap[s];
          const label = s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
          return <div key={s} style={{ backgroundColor: c.bg, borderRadius: borderRadius.md, padding: `${spacing['2']} ${spacing['4']}` }}><span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: c.fg }}>{count} {label}</span></div>;
        })}
        {(() => {
          const overdueCount = correctiveActions.filter((ca: unknown) => {
            const c = ca as Record<string, unknown>;
            if (!c.due_date) return false;
            if (c.status === 'closed' || c.status === 'verified') return false;
            return new Date(c.due_date as string) < new Date();
          }).length;
          if (overdueCount === 0) return null;
          return <div style={{ backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, padding: `${spacing['2']} ${spacing['4']}` }}><span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical }}>{overdueCount} Overdue</span></div>;
        })()}
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Card>
          <DataTable columns={caColumns} data={correctiveActions} enableSorting />
        </Card>
      </div>
    </>
  );
};
