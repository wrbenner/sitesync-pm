import React from 'react';
import { Card, Btn } from '../../components/Primitives';
import { DataTable, createColumnHelper } from '../../components/shared/DataTable';
import { ShieldCheck } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

import { fromTable } from '../../lib/db/queries'
import { useProjectId } from '../../hooks/useProjectId';

// ── Column definitions ────────────────────────────────────────

const talkCol = createColumnHelper<Record<string, unknown>>();
const talkColumns = [
  talkCol.accessor('date', {
    header: 'Date',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : ''}</span>,
  }),
  talkCol.accessor('title', {
    header: 'Title',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue() as string}</span>,
  }),
  talkCol.accessor('topic', {
    header: 'Topic',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
  }),
  talkCol.accessor('presenter', {
    header: 'Presenter',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
  }),
  talkCol.accessor('attendance_count', {
    header: 'Attendees',
    cell: (info) => <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{(info.getValue() as number) ?? 0}</span>,
  }),
];

// ── Toolbox list ─────────────────────────────────────────────

interface ToolboxTalksListProps {
  talks: Record<string, unknown>[];
  onNewTalk: () => void;
}

export const ToolboxTalksList: React.FC<ToolboxTalksListProps> = ({ talks, onNewTalk }) => {
  if (talks.length === 0) {
    return (
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center' }}>
          <ShieldCheck size={40} style={{ color: colors.textTertiary }} />
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 360 }}>No toolbox talks recorded. Safety tracking not yet configured.</p>
          <Btn variant="primary" onClick={onNewTalk} style={{ minHeight: '56px' }}>Log First Toolbox Talk</Btn>
        </div>
      </Card>
    );
  }
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <Card>
        <DataTable columns={talkColumns} data={talks} enableSorting />
      </Card>
    </div>
  );
};

// ── New talk modal ────────────────────────────────────────────

interface TalkFormState {
  topic: string;
  date: string;
  presenter: string;
  attendees: string[];
  newAttendee: string;
}

interface ToolboxTalkFormProps {
  onClose: () => void;
}

export const ToolboxTalkForm: React.FC<ToolboxTalkFormProps> = ({ onClose }) => {
  const projectId = useProjectId();
  const [form, setForm] = React.useState<TalkFormState>({ topic: '', date: '', presenter: '', attendees: [], newAttendee: '' });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!form.topic.trim()) errs.topic = 'Topic is required';
    if (!form.date) errs.date = 'Date is required';
    if (!form.presenter.trim()) errs.presenter = 'Presenter is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!projectId) { setErrors({ topic: 'No project selected' }); return; }

    setSubmitting(true);
    try {
      const { data: inserted, error } = await fromTable('toolbox_talks').insert({
        project_id: projectId,
        title: form.topic,
        topic: form.topic,
        date: form.date,
        attendance_count: form.attendees.length,
      } as never).select('id').single();
      if (error) throw error;
      const talkId = inserted?.id as string | undefined;
      if (talkId && form.attendees.length > 0) {
        await fromTable('toolbox_talk_attendees').insert(
          form.attendees.map((name) => ({ toolbox_talk_id: talkId, worker_name: name }))
        );
      }
      onClose();
    } catch (e) {
      setErrors({ topic: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAttendee = () => {
    const name = form.newAttendee.trim();
    if (!name) return;
    if (form.attendees.includes(name)) { setErrors((p) => ({ ...p, newAttendee: 'Already on the list' })); return; }
    setForm((p) => ({ ...p, attendees: [...p.attendees, name], newAttendee: '' }));
    setErrors((p) => ({ ...p, newAttendee: '' }));
  };

  const handleRemoveAttendee = (name: string) => {
    setForm((p) => ({ ...p, attendees: p.attendees.filter((a) => a !== name) }));
  };


  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box', padding: `${spacing['2']} ${spacing['3']}`,
    border: hasError ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.base, fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily, color: colors.textPrimary, outline: 'none',
  });

  return (
    <div
      role="dialog" aria-modal="true" aria-label="New Toolbox Talk"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing['6'], width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['5'] }}>
          <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>New Toolbox Talk</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: colors.textSecondary, lineHeight: 1, padding: 4, minHeight: '56px', minWidth: '56px' }}>&times;</button>
        </div>

        {/* Topic */}
        <div style={{ marginBottom: spacing['4'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Topic<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
          <input type="text" placeholder="e.g. Fall protection, Lockout tagout" value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} style={inputStyle(!!errors.topic)} />
          {errors.topic && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{errors.topic}</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['4'] }}>
          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Date<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} style={inputStyle(!!errors.date)} />
            {errors.date && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{errors.date}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Presenter<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
            <input type="text" placeholder="Name or title" value={form.presenter} onChange={(e) => setForm((p) => ({ ...p, presenter: e.target.value }))} style={inputStyle(!!errors.presenter)} />
            {errors.presenter && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{errors.presenter}</p>}
          </div>
        </div>

        {/* Attendance */}
        <div style={{ marginBottom: spacing['5'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
            Attendance Sign-in
            <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, marginLeft: spacing['2'], fontWeight: typography.fontWeight.normal }}>{form.attendees.length} signed in</span>
          </label>
          <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['2'] }}>
            <input type="text" placeholder="Enter name and press Add" value={form.newAttendee} onChange={(e) => setForm((p) => ({ ...p, newAttendee: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAttendee(); } }} style={{ ...inputStyle(!!errors.newAttendee), flex: 1 }} />
            <Btn variant="secondary" onClick={handleAddAttendee} style={{ minHeight: '56px', flexShrink: 0 }}>Add</Btn>
          </div>
          {errors.newAttendee && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '0 0 4px' }}>{errors.newAttendee}</p>}
          {form.attendees.length > 0 && (
            <div style={{ border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, maxHeight: 180, overflowY: 'auto' }}>
              {form.attendees.map((name, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: idx < form.attendees.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: colors.orangeSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, flexShrink: 0 }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{name}</span>
                  </div>
                  <button onClick={() => handleRemoveAttendee(name)} aria-label={`Remove ${name}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: 16, padding: '2px 4px', lineHeight: 1 }}>&times;</button>
                </div>
              ))}
            </div>
          )}
          {form.attendees.length === 0 && <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>No attendees signed in yet. Add names above.</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
          <Btn variant="ghost" onClick={onClose} style={{ minHeight: '56px' }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={submitting} style={{ minHeight: '56px' }}>{submitting ? 'Saving...' : 'Save Talk'}</Btn>
        </div>
      </div>
    </div>
  );
};
