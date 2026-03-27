import React, { useState } from 'react';
import { Download, FileText, Table, Calendar, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Btn, ProgressBar } from '../Primitives';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../../styles/theme';

interface ExportCenterProps {
  open: boolean;
  onClose: () => void;
}

type ExportFormat = 'pdf' | 'csv' | 'xlsx';

const sections = [
  { id: 'executive', label: 'Executive Summary', checked: true },
  { id: 'schedule', label: 'Schedule Overview', checked: true },
  { id: 'budget', label: 'Budget Summary', checked: true },
  { id: 'rfis', label: 'Open RFIs', checked: false },
  { id: 'submittals', label: 'Submittal Status', checked: false },
  { id: 'safety', label: 'Safety Report', checked: true },
  { id: 'photos', label: 'Photo Documentation', checked: false },
  { id: 'crews', label: 'Crew Performance', checked: false },
];

export const ExportCenter: React.FC<ExportCenterProps> = ({ open, onClose }) => {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [checkedSections, setCheckedSections] = useState(new Set(sections.filter((s) => s.checked).map((s) => s.id)));
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const handleExport = () => {
    setExporting(true);
    setProgress(0);
    setDone(false);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); setExporting(false); setDone(true); return 100; }
        return p + 8 + Math.random() * 12;
      });
    }, 200);
  };

  const toggleSection = (id: string) => {
    setCheckedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: zIndex.modal as number }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '520px', maxWidth: '90vw', maxHeight: '85vh', backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl, boxShadow: shadows.panel, zIndex: zIndex.modal as number + 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Download size={18} color={colors.textPrimary} />
                <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Export Report</h3>
              </div>
              <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: `${spacing['4']} ${spacing['5']}` }}>
              {/* Format */}
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['2'] }}>Format</p>
              <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['5'] }}>
                {([
                  { id: 'pdf' as const, icon: <FileText size={14} />, label: 'PDF Report' },
                  { id: 'csv' as const, icon: <Table size={14} />, label: 'CSV Data' },
                  { id: 'xlsx' as const, icon: <Table size={14} />, label: 'Excel' },
                ]).map((f) => (
                  <button key={f.id} onClick={() => setFormat(f.id)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'],
                    padding: spacing['3'], border: `1px solid ${format === f.id ? colors.primaryOrange : colors.borderDefault}`,
                    borderRadius: borderRadius.md, backgroundColor: format === f.id ? colors.orangeSubtle : 'transparent',
                    color: format === f.id ? colors.primaryOrange : colors.textSecondary,
                    fontSize: typography.fontSize.sm, fontWeight: format === f.id ? typography.fontWeight.semibold : typography.fontWeight.normal,
                    fontFamily: typography.fontFamily, cursor: 'pointer', transition: `all ${transitions.instant}`,
                  }}>
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>

              {/* Sections */}
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['2'] }}>Include Sections</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'], marginBottom: spacing['5'] }}>
                {sections.map((section) => {
                  const checked = checkedSections.has(section.id);
                  return (
                    <button key={section.id} onClick={() => toggleSection(section.id)} style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      padding: `${spacing['2']} ${spacing['3']}`, border: 'none',
                      backgroundColor: 'transparent', borderRadius: borderRadius.sm,
                      cursor: 'pointer', fontFamily: typography.fontFamily, textAlign: 'left',
                      transition: `background-color ${transitions.instant}`,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: borderRadius.sm,
                        border: `1.5px solid ${checked ? colors.primaryOrange : colors.borderDefault}`,
                        backgroundColor: checked ? colors.primaryOrange : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: `all ${transitions.instant}`,
                      }}>
                        {checked && <Check size={12} color="white" />}
                      </div>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{section.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Scheduled reports */}
              <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                  <Calendar size={14} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>Schedule Weekly Report</span>
                </div>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>Send owner status report every Monday at 8 AM</p>
              </div>

              {/* Progress */}
              {(exporting || done) && (
                <div style={{ marginTop: spacing['4'] }}>
                  {exporting && <ProgressBar value={Math.min(progress, 100)} height={4} color={colors.primaryOrange} />}
                  {exporting && <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'], textAlign: 'center' }}>Generating report... {Math.min(Math.round(progress), 100)}%</p>}
                  {done && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: spacing['3'], backgroundColor: `${colors.statusActive}08`, borderRadius: borderRadius.md }}>
                      <Check size={16} color={colors.statusActive} />
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>Report ready for download</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], padding: `${spacing['3']} ${spacing['5']}`, borderTop: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
              <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn onClick={handleExport} icon={<Download size={14} />} disabled={exporting}>
                {done ? 'Download' : exporting ? 'Generating...' : `Export ${format.toUpperCase()}`}
              </Btn>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
