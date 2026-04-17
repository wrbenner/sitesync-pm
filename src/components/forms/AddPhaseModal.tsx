import React, { useState } from 'react';
import { X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme';
import { Btn } from '../Primitives';

interface AddPhaseModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; start_date: string; end_date: string }) => Promise<void> | void;
}

const AddPhaseModal: React.FC<AddPhaseModalProps> = ({ open, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      setError('Name, start date, and end date are required.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be on or after start date.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), start_date: startDate, end_date: endDate });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create phase');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-phase-title"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: colors.overlayBackdrop,
        zIndex: zIndex.popover, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing['4'],
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
          padding: spacing['6'], width: '100%', maxWidth: 480, boxShadow: shadows.panel,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
          <h2 id="add-phase-title" style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            Add Phase
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: spacing['1.5'], color: colors.textTertiary, display: 'flex', borderRadius: borderRadius.base, minWidth: 32, minHeight: 32, justifyContent: 'center', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>Phase name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Foundation"
              disabled={submitting}
              required
              style={{ padding: spacing['3'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: colors.surfacePage, color: colors.textPrimary, outline: 'none', minHeight: 44 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={submitting}
              required
              style={{ padding: spacing['3'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: colors.surfacePage, color: colors.textPrimary, outline: 'none', minHeight: 44 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={submitting}
              required
              style={{ padding: spacing['3'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: colors.surfacePage, color: colors.textPrimary, outline: 'none', minHeight: 44 }}
            />
          </label>

          {error && (
            <div role="alert" style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, padding: spacing['2'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.sm }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['5'], justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Btn>
          <Btn disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Phase'}
          </Btn>
        </div>
      </form>
    </div>
  );
};

export default AddPhaseModal;
