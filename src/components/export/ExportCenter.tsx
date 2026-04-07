import React, { useState, lazy, Suspense, useMemo, useCallback } from 'react';
import { Download, FileText, Table, Calendar, Check, X, ChevronRight, ChevronLeft, Clock, Sheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Btn, ProgressBar } from '../Primitives';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../../styles/theme';
import {
  REPORT_TYPES,
  type ReportType,
  useExecutiveSummaryData,
  useRFILogData,
  useSubmittalLogData,
  usePunchListData,
  useBudgetReportData,
  useDailyLogSummaryData,
  useMonthlyProgressData,
  useCostReportData,
  useScheduleReportData,
  useSubcontractorPerformanceData,
} from '../../hooks/useReportData';
import {
  exportRFILogXlsx,
  exportSubmittalLogXlsx,
  exportPunchListXlsx,
  exportBudgetXlsx,
  exportDailyLogXlsx,
} from '../../lib/exportXlsx';
import { toast } from 'sonner';

// Lazy load PDF components
const PDFDownloadLink = lazy(() => import('@react-pdf/renderer').then((m) => ({ default: m.PDFDownloadLink })));

// Lazy load report templates
const ExecutiveSummary = lazy(() => import('./ExecutiveSummary').then((m) => ({ default: m.ExecutiveSummary })));
const MonthlyProgressReport = lazy(() => import('./MonthlyProgressReport').then((m) => ({ default: m.MonthlyProgressReport })));
const RFIReport = lazy(() => import('./RFIReport').then((m) => ({ default: m.RFIReport })));
const SubmittalLog = lazy(() => import('./SubmittalLog').then((m) => ({ default: m.SubmittalLog })));
const PunchListReport = lazy(() => import('./PunchListReport').then((m) => ({ default: m.PunchListReport })));
const DailyLogReport = lazy(() => import('./DailyLogReport').then((m) => ({ default: m.DailyLogReport })));
const BudgetReport = lazy(() => import('./BudgetReport').then((m) => ({ default: m.BudgetReport })));
const SafetyReport = lazy(() => import('./SafetyReport').then((m) => ({ default: m.SafetyReport })));
const CostReport = lazy(() => import('./CostReport').then((m) => ({ default: m.CostReport })));
const ScheduleReport = lazy(() => import('./ScheduleReport').then((m) => ({ default: m.ScheduleReport })));
const SubcontractorReport = lazy(() => import('./SubcontractorReport').then((m) => ({ default: m.SubcontractorReport })));

// ── Types ────────────────────────────────────────────────

type ExportFormat = 'pdf' | 'xlsx';
type Step = 'select' | 'configure' | 'generate';

interface ExportCenterProps {
  open: boolean;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────

export const ExportCenter: React.FC<ExportCenterProps> = ({ open, onClose }) => {
  const [step, setStep] = useState<Step>('select');
  const [selectedReport, setSelectedReport] = useState<ReportType>('executive_summary');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  // Fetch data for all report types (only active ones will actually query)
  const execData = useExecutiveSummaryData();
  const rfiData = useRFILogData();
  const submittalData = useSubmittalLogData();
  const punchData = usePunchListData();
  const budgetData = useBudgetReportData();
  const dailyLogData = useDailyLogSummaryData();
  const monthlyData = useMonthlyProgressData();
  const costData = useCostReportData();
  const scheduleData = useScheduleReportData();
  const subPerformanceData = useSubcontractorPerformanceData();

  const isLoading = useMemo(() => {
    switch (selectedReport) {
      case 'executive_summary': return execData.loading;
      case 'rfi_log': return rfiData.loading;
      case 'submittal_log': return submittalData.loading;
      case 'punch_list': return punchData.loading;
      case 'budget_report': return budgetData.loading;
      case 'daily_log_summary': return dailyLogData.loading;
      case 'monthly_progress': return monthlyData.loading;
      case 'cost_report': return costData.loading;
      case 'schedule_report': return scheduleData.loading;
      case 'subcontractor_performance': return subPerformanceData.loading;
      default: return false;
    }
  }, [selectedReport, execData.loading, rfiData.loading, submittalData.loading, punchData.loading, budgetData.loading, dailyLogData.loading, monthlyData.loading, costData.loading, scheduleData.loading, subPerformanceData.loading]);

  // Build PDF document based on selected report
  const pdfDocument = useMemo(() => {
    switch (selectedReport) {
      case 'executive_summary':
        return execData.data ? <ExecutiveSummary {...execData.data} /> : null;
      case 'monthly_progress':
        return monthlyData.data ? <MonthlyProgressReport {...monthlyData.data} /> : null;
      case 'rfi_log':
        return rfiData.data ? <RFIReport {...rfiData.data} /> : null;
      case 'submittal_log':
        return submittalData.data ? <SubmittalLog {...submittalData.data} /> : null;
      case 'punch_list':
        return punchData.data ? <PunchListReport projectName={punchData.data.projectName} items={punchData.data.items} /> : null;
      case 'budget_report':
        return budgetData.data ? <BudgetReport {...budgetData.data} /> : null;
      case 'daily_log_summary':
        return dailyLogData.data ? <DailyLogReport projectName={dailyLogData.data.projectName} entries={dailyLogData.data.entries} totalManHours={dailyLogData.data.totalManHours} avgWorkers={dailyLogData.data.avgWorkers} totalIncidents={dailyLogData.data.totalIncidents} /> : null;
      case 'safety_report':
        return <SafetyReport projectName="Project" periodStart="" periodEnd="" daysWithoutIncident={30} trir={0} emr={0.85} openCorrectiveActions={0} incidents={[]} inspections={[]} />;
      case 'cost_report':
        return costData.data ? <CostReport data={costData.data} /> : null;
      case 'schedule_report':
        return scheduleData.data ? <ScheduleReport data={scheduleData.data} /> : null;
      case 'subcontractor_performance':
        return subPerformanceData.data ? <SubcontractorReport data={subPerformanceData.data} /> : null;
      default:
        return null;
    }
  }, [selectedReport, execData.data, rfiData.data, submittalData.data, punchData.data, budgetData.data, dailyLogData.data, monthlyData.data, costData.data, scheduleData.data, subPerformanceData.data]);

  const handleXlsxExport = useCallback(() => {
    setGenerating(true);
    setProgress(0);

    // Simulate progress for UX (XLSX generation is near-instant)
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + 25;
      });
    }, 100);

    setTimeout(() => {
      try {
        switch (selectedReport) {
          case 'rfi_log':
            if (rfiData.data) exportRFILogXlsx(rfiData.data.projectName, rfiData.data.rfis);
            break;
          case 'submittal_log':
            if (submittalData.data) exportSubmittalLogXlsx(submittalData.data.projectName, submittalData.data.submittals);
            break;
          case 'punch_list':
            if (punchData.data) exportPunchListXlsx(punchData.data.projectName, punchData.data.items);
            break;
          case 'budget_report':
            if (budgetData.data) exportBudgetXlsx(budgetData.data.projectName, budgetData.data);
            break;
          case 'daily_log_summary':
            if (dailyLogData.data) exportDailyLogXlsx(dailyLogData.data.projectName, dailyLogData.data.entries);
            break;
          default:
            toast.info('Excel export not available for this report type. Use PDF instead.');
        }
        setDone(true);
        toast.success('Report exported successfully');
      } catch {
        toast.error('Export failed. Please try again.');
      }
      clearInterval(interval);
      setGenerating(false);
      setProgress(100);
    }, 500);
  }, [selectedReport, rfiData.data, submittalData.data, punchData.data, budgetData.data, dailyLogData.data]);

  const handleReset = () => {
    setStep('select');
    setDone(false);
    setProgress(0);
    setGenerating(false);
  };

  const reportConfig = REPORT_TYPES.find((r) => r.type === selectedReport);
  const dateStr = new Date().toISOString().slice(0, 10);
  const pdfFilename = `SiteSync_${reportConfig?.label.replace(/\s+/g, '_')}_${dateStr}`;

  // Reports that support XLSX
  const xlsxSupported = ['rfi_log', 'submittal_log', 'punch_list', 'budget_report', 'daily_log_summary'].includes(selectedReport);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: zIndex.modal as number }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '580px', maxWidth: '90vw', maxHeight: '85vh',
              backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
              boxShadow: shadows.panel, zIndex: (zIndex.modal as number) + 1,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${spacing['4']} ${spacing['5']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Download size={18} color={colors.textPrimary} />
                <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                  {step === 'select' ? 'Export Report' : step === 'configure' ? reportConfig?.label : 'Generating...'}
                </h3>
              </div>
              <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: `${spacing['4']} ${spacing['5']}` }}>

              {/* ── Step 1: Report Selection ──────────── */}
              {step === 'select' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {REPORT_TYPES.map((report) => (
                    <button
                      key={report.type}
                      onClick={() => { setSelectedReport(report.type); setStep('configure'); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: spacing['4'], border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.md, backgroundColor: colors.surfaceRaised,
                        cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontFamily,
                        transition: `all ${transitions.instant}`,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primaryOrange; (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeSubtle; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderSubtle; (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceRaised; }}
                    >
                      <div>
                        <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>
                          {report.label}
                        </p>
                        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: '2px' }}>
                          {report.description} · ~{report.estimatedPages} pages
                        </p>
                      </div>
                      <ChevronRight size={16} color={colors.textTertiary} />
                    </button>
                  ))}
                </div>
              )}

              {/* ── Step 2: Configure & Format ────────── */}
              {step === 'configure' && (
                <>
                  {/* Format selection */}
                  <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['2'] }}>
                    Format
                  </p>
                  <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['5'] }}>
                    <FormatButton
                      icon={<FileText size={14} />}
                      label="PDF Report"
                      active={format === 'pdf'}
                      onClick={() => setFormat('pdf')}
                    />
                    {xlsxSupported && (
                      <FormatButton
                        icon={<Sheet size={14} />}
                        label="Excel"
                        active={format === 'xlsx'}
                        onClick={() => setFormat('xlsx')}
                      />
                    )}
                  </div>

                  {/* Report info */}
                  <div style={{ padding: spacing['4'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, marginBottom: spacing['4'] }}>
                    <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>
                      {reportConfig?.label}
                    </p>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginBottom: spacing['2'] }}>
                      {reportConfig?.description}
                    </p>
                    <div style={{ display: 'flex', gap: spacing['3'] }}>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={11} /> ~{reportConfig?.estimatedPages} pages
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> Generated {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Data status */}
                  {isLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.statusInfoSubtle, borderRadius: borderRadius.md }}>
                      <div style={{ width: 14, height: 14, border: `2px solid ${colors.statusInfo}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.statusInfo }}>Loading project data...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.statusActiveSubtle, borderRadius: borderRadius.md }}>
                      <Check size={14} color={colors.statusActive} />
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.statusActive }}>Data ready for export</span>
                    </div>
                  )}

                  {/* Scheduled reports teaser */}
                  <div style={{ marginTop: spacing['5'], padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                      <Calendar size={14} color={colors.textTertiary} />
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>Schedule Recurring Export</span>
                    </div>
                    <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
                      Automatically generate and email this report weekly, biweekly, or monthly.
                    </p>
                  </div>
                </>
              )}

              {/* ── Step 3: Generate & Download ───────── */}
              {step === 'generate' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: spacing['8'] }}>
                  {generating && (
                    <>
                      <ProgressBar value={Math.min(progress, 100)} height={4} color={colors.primaryOrange} />
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['3'], textAlign: 'center' }}>
                        Generating {reportConfig?.label}... {Math.min(Math.round(progress), 100)}%
                      </p>
                    </>
                  )}
                  {done && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: colors.statusActiveSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', marginBottom: spacing['3'] }}>
                        <Check size={24} color={colors.statusActive} />
                      </div>
                      <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>
                        Report Ready
                      </p>
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing['5'] }}>
                        {reportConfig?.label} has been generated successfully.
                      </p>
                      <Btn onClick={handleReset} variant="ghost">Generate Another</Btn>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: spacing['2'], padding: `${spacing['3']} ${spacing['5']}`,
              borderTop: `1px solid ${colors.borderSubtle}`, flexShrink: 0,
            }}>
              <div>
                {step !== 'select' && !generating && (
                  <Btn variant="ghost" onClick={() => step === 'configure' ? setStep('select') : handleReset()} icon={<ChevronLeft size={14} />}>
                    Back
                  </Btn>
                )}
              </div>
              <div style={{ display: 'flex', gap: spacing['2'] }}>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                {step === 'configure' && format === 'pdf' && pdfDocument && (
                  <Suspense fallback={
                    <Btn disabled>Preparing PDF...</Btn>
                  }>
                    <PDFDownloadLink document={pdfDocument as React.ReactElement} fileName={`${pdfFilename}.pdf`}>
                      {({ loading }: { loading: boolean }) => (
                        <Btn
                          onClick={() => { if (!loading) { setStep('generate'); setDone(true); toast.success('PDF downloaded'); } }}
                          icon={<Download size={14} />}
                          disabled={loading || isLoading}
                        >
                          {loading ? 'Rendering...' : isLoading ? 'Loading data...' : 'Download PDF'}
                        </Btn>
                      )}
                    </PDFDownloadLink>
                  </Suspense>
                )}
                {step === 'configure' && format === 'xlsx' && (
                  <Btn
                    onClick={() => { setStep('generate'); handleXlsxExport(); }}
                    icon={<Download size={14} />}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Loading data...' : 'Download Excel'}
                  </Btn>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ── Sub-components ───────────────────────────────────────

const FormatButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: spacing['2'], padding: spacing['3'],
      border: `1px solid ${active ? colors.primaryOrange : colors.borderDefault}`,
      borderRadius: borderRadius.md,
      backgroundColor: active ? colors.orangeSubtle : 'transparent',
      color: active ? colors.orangeText : colors.textSecondary,
      fontSize: typography.fontSize.sm,
      fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.normal,
      fontFamily: typography.fontFamily, cursor: 'pointer',
      transition: `all ${transitions.instant}`,
    }}
  >
    {icon} {label}
  </button>
);
