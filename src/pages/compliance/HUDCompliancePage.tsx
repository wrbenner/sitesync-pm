import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Shield, AlertTriangle, Clock, DollarSign, Users, Building2, FileText,
  ChevronRight, ChevronDown, Search, Plus, X, Check, Edit2, TrendingUp,
  Calendar, BarChart3, Target, Download,
  CheckCircle, Info, AlertCircle, Calculator, Camera, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { fromTable } from '../../lib/supabase';
import { useProjectId } from '../../hooks/useProjectId';

// ── Types ───────────────────────────────────────────────
type MainTab = 'overview' | 'lihtc' | 'davis-bacon' | 'section3' | 'tax-credits';
type TaxCreditSub = 'htc' | 'nmtc' | '45l' | '179d' | 'oz';
type AlertSeverity = 'critical' | 'warning' | 'info';

interface ComplianceProgram {
  id: string; name: string; code: string; status: 'active' | 'pending' | 'expired';
  credits: number; nextDeadline: string; healthScore: number;
}

interface LIHTCUnit {
  id: string; unit: string; bedrooms: number; sqft: number; rentLimit: number;
  actualRent: number; incomeLimit: number; tenantStatus: 'compliant' | 'pending' | 'vacant' | 'over-income';
  certDate: string; tenantName: string;
}

interface PayrollEntry {
  id: string; weekEnding: string; contractor: string; status: 'certified' | 'pending' | 'rejected';
  totalGross: number; employees: PayrollEmployee[];
}

interface PayrollEmployee {
  name: string; classification: string; hours: number[]; rate: number; gross: number; deductions: number; net: number;
}

interface WageRate {
  classification: string; journeymanRate: number; fringes: number; total: number; apprenticeRatio: string;
}

interface Section3Worker {
  id: string; name: string; qualification: string; hours: number; section3: boolean; resident: boolean;
}

interface Section3Business {
  id: string; name: string; certType: string; contractAmt: number; section3: boolean;
}

interface ComplianceAlert {
  id: string; severity: AlertSeverity; program: string; message: string; date: string; actionRequired: boolean;
}

// ── Styles ───────────────────────────────────────────────
const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: `${spacing.sm} ${spacing.lg}`,
  cursor: 'pointer',
  border: 'none',
  borderBottom: active ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
  background: 'none',
  color: active ? colors.primaryOrange : colors.textSecondary,
  fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
  fontSize: typography.fontSize.sm,
  transition: transitions.fast,
  whiteSpace: 'nowrap',
});

const cardStyle: React.CSSProperties = {
  background: colors.surfaceRaised,
  borderRadius: borderRadius.lg,
  border: `1px solid ${colors.borderSubtle}`,
  padding: spacing.lg,
};

const badgeStyle = (variant: 'active' | 'pending' | 'expired' | 'certified' | 'rejected' | 'compliant' | 'vacant' | 'over-income' | 'critical' | 'warning' | 'info'): React.CSSProperties => {
  const map: Record<string, { bg: string; fg: string }> = {
    active: { bg: colors.statusActiveSubtle, fg: colors.statusActive },
    certified: { bg: colors.statusActiveSubtle, fg: colors.statusActive },
    compliant: { bg: colors.statusActiveSubtle, fg: colors.statusActive },
    pending: { bg: colors.statusPendingSubtle, fg: colors.statusPending },
    expired: { bg: colors.statusCriticalSubtle, fg: colors.statusCritical },
    rejected: { bg: colors.statusCriticalSubtle, fg: colors.statusCritical },
    'over-income': { bg: colors.statusCriticalSubtle, fg: colors.statusCritical },
    vacant: { bg: colors.statusNeutralSubtle, fg: colors.statusNeutral },
    critical: { bg: colors.statusCriticalSubtle, fg: colors.statusCritical },
    warning: { bg: colors.statusWarningSubtle, fg: colors.statusWarning },
    info: { bg: colors.statusInfoSubtle, fg: colors.statusInfo },
  };
  const c = map[variant] || map.pending;
  return {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
    color: c.fg, backgroundColor: c.bg, textTransform: 'capitalize' as const,
  };
};

const inputStyle: React.CSSProperties = {
  background: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.md, padding: `${spacing.sm} ${spacing.md}`,
  color: colors.textPrimary, fontSize: typography.fontSize.sm, outline: 'none',
  width: '100%',
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: 'left' as const, padding: `${spacing.sm} ${spacing.md}`,
  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
  color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

const tableCellStyle: React.CSSProperties = {
  padding: `${spacing.sm} ${spacing.md}`, fontSize: typography.fontSize.sm,
  color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}`,
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
  padding: `${spacing.sm} ${spacing.lg}`, background: colors.primaryOrange,
  color: colors.white, border: 'none', borderRadius: borderRadius.md,
  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
  cursor: 'pointer', transition: transitions.fast,
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary, background: 'transparent',
  border: `1px solid ${colors.borderDefault}`, color: colors.textSecondary,
};

// ── Helpers ─────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('en-US');
const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const daysUntil = (d: string) => Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000);

const HealthRing: React.FC<{ score: number; size?: number }> = ({ score, size = 56 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const ringColor = score >= 90 ? colors.statusActive : score >= 70 ? colors.statusWarning : colors.statusCritical;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.borderSubtle} strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ringColor}
        strokeWidth={4} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
};

/** Empty state card for sections with no data yet */
const EmptyCard: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({ icon: Icon, title, description }) => (
  <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: spacing.xl, textAlign: 'center', gap: spacing.md }}>
    <div style={{ width: 56, height: 56, borderRadius: borderRadius.full, background: colors.surfaceInset, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={28} color={colors.textTertiary} />
    </div>
    <div>
      <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.xs }}>{title}</div>
      <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, maxWidth: 400 }}>{description}</div>
    </div>
  </div>
);

/** Loading skeleton row */
const LoadingSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
    {Array.from({ length: 3 }, (_, i) => (
      <div key={i} style={{ ...cardStyle, height: 64, background: colors.surfaceInset, borderRadius: borderRadius.md, animation: 'pulse 1.5s ease-in-out infinite' }} />
    ))}
  </div>
);

// ── Main Component ──────────────────────────────────────
const HUDCompliancePage: React.FC = () => {
  const projectId = useProjectId();
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [taxSub, setTaxSub] = useState<TaxCreditSub>('htc');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPayroll, setExpandedPayroll] = useState<string | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [applicableFraction, setApplicableFraction] = useState({ lowIncomeUnits: 0, totalUnits: 0, lowIncomeSqft: 0, totalSqft: 0 });

  // ── State for Supabase data ─────────────────────────────
  const [programs, setPrograms] = useState<ComplianceProgram[]>([]);
  const [lihtcUnits, _setLihtcUnits] = useState<LIHTCUnit[]>([]);
  const [wageRates, setWageRates] = useState<WageRate[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [section3Workers, setSection3Workers] = useState<Section3Worker[]>([]);
  const [section3Businesses, setSection3Businesses] = useState<Section3Business[]>([]);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch compliance programs from compliance_reports ────
  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        // Fetch compliance reports (these are org-level, so we try with project_id)
        const { data: reports } = await fromTable('compliance_reports')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (!cancelled && reports && reports.length > 0) {
          // Map compliance_reports to ComplianceProgram shape
          const mapped: ComplianceProgram[] = reports.map((r: Record<string, unknown>, _i: number) => ({
            id: String(r.id),
            name: String(r.report_type ?? 'Compliance Report'),
            code: String(r.report_type ?? 'Report').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            status: 'active' as const,
            credits: 0,
            nextDeadline: r.date_range_end ? String(r.date_range_end).slice(0, 10) : '',
            healthScore: 85,
          }));
          setPrograms(mapped);
        } else if (!cancelled) {
          setPrograms([]);
        }
      } catch (err) {
        console.warn('[HUDCompliance] Failed to fetch compliance reports:', err);
        if (!cancelled) setPrograms([]);
      }

      // Fetch prevailing wage rates
      try {
        const { data: wages } = await fromTable('prevailing_wage_rates')
          .select('*')
          .order('trade', { ascending: true });

        if (!cancelled && wages && wages.length > 0) {
          const mapped: WageRate[] = wages.map((w: Record<string, unknown>) => ({
            classification: String(w.trade ?? ''),
            journeymanRate: Number(w.base_hourly_rate ?? 0),
            fringes: Number(w.fringe_benefits ?? 0),
            total: Number(w.base_hourly_rate ?? 0) + Number(w.fringe_benefits ?? 0),
            apprenticeRatio: '1:3', // Not stored in DB — default
          }));
          setWageRates(mapped);
        } else if (!cancelled) {
          setWageRates([]);
        }
      } catch (err) {
        console.warn('[HUDCompliance] Failed to fetch wage rates:', err);
        if (!cancelled) setWageRates([]);
      }

      // Fetch certified payroll reports + employees
      try {
        const { data: payrolls } = await fromTable('certified_payroll_reports')
          .select('*')
          .eq('project_id', projectId)
          .order('week_ending_date', { ascending: false })
          .limit(20);

        if (!cancelled && payrolls && payrolls.length > 0) {
          // Fetch employees for all payroll reports
          const reportIds = payrolls.map((p: Record<string, unknown>) => String(p.id));
          const { data: employees } = await fromTable('certified_payroll_employees')
            .select('*')
            .in('payroll_report_id', reportIds);

          const employeesByReport = new Map<string, Record<string, unknown>[]>();
          (employees || []).forEach((emp: Record<string, unknown>) => {
            const rid = String(emp.payroll_report_id);
            if (!employeesByReport.has(rid)) employeesByReport.set(rid, []);
            employeesByReport.get(rid)!.push(emp);
          });

          const mapped: PayrollEntry[] = payrolls.map((p: Record<string, unknown>) => {
            const emps = employeesByReport.get(String(p.id)) || [];
            const mappedEmps: PayrollEmployee[] = emps.map((e: Record<string, unknown>) => {
              const totalHours = Number(e.hours_worked ?? 0);
              const rate = Number(e.hourly_rate ?? 0);
              const gross = Number(e.gross_pay ?? 0);
              const deductions = Number(e.federal_withholding ?? 0) + Number(e.social_security ?? 0)
                + Number(e.medicare ?? 0) + Number(e.state_withholding ?? 0);
              return {
                name: String(e.employee_name ?? ''),
                classification: String(e.trade_classification ?? ''),
                hours: [totalHours, 0, 0, 0, 0, 0, 0], // DB stores total, not daily breakdown
                rate,
                gross,
                deductions,
                net: gross - deductions,
              };
            });
            const totalGross = mappedEmps.reduce((s, e) => s + e.gross, 0);
            // Map DB status to our display status
            const rawStatus = String(p.status ?? 'draft');
            const status = rawStatus === 'approved' ? 'certified' : rawStatus === 'submitted' ? 'pending' : rawStatus === 'rejected' ? 'rejected' : 'pending';
            return {
              id: String(p.id),
              weekEnding: p.week_ending_date ? String(p.week_ending_date).slice(0, 10) : '',
              contractor: String(p.contractor_id ?? 'Unknown Contractor'),
              status: status as PayrollEntry['status'],
              totalGross,
              employees: mappedEmps,
            };
          });
          setPayrollEntries(mapped);

          // Generate alerts from payroll data — flag rejected reports
          const payrollAlerts: ComplianceAlert[] = [];
          mapped.forEach(entry => {
            if (entry.status === 'rejected') {
              payrollAlerts.push({
                id: `alert-payroll-${entry.id}`,
                severity: 'critical',
                program: 'Davis-Bacon',
                message: `Certified payroll report rejected for ${entry.contractor} — week ending ${fmtDate(entry.weekEnding)}. Review and resubmit.`,
                date: entry.weekEnding,
                actionRequired: true,
              });
            }
          });
          if (!cancelled) {
            setAlerts(prev => [...prev.filter(a => !a.id.startsWith('alert-payroll-')), ...payrollAlerts]);
          }
        } else if (!cancelled) {
          setPayrollEntries([]);
        }
      } catch (err) {
        console.warn('[HUDCompliance] Failed to fetch payroll data:', err);
        if (!cancelled) setPayrollEntries([]);
      }

      // Fetch workforce members for Section 3 worker registry
      try {
        const { data: workers } = await fromTable('workforce_members')
          .select('*')
          .eq('project_id', projectId)
          .eq('status', 'active')
          .order('name', { ascending: true });

        if (!cancelled && workers && workers.length > 0) {
          // Fetch total hours from time_entries for each worker
          const workerIds = workers.map((w: Record<string, unknown>) => String(w.id));
          const { data: timeEntries } = await fromTable('time_entries')
            .select('workforce_member_id, regular_hours, overtime_hours')
            .eq('project_id', projectId)
            .in('workforce_member_id', workerIds);

          const hoursByWorker = new Map<string, number>();
          (timeEntries || []).forEach((te: Record<string, unknown>) => {
            const wid = String(te.workforce_member_id);
            const hrs = Number(te.regular_hours ?? 0) + Number(te.overtime_hours ?? 0);
            hoursByWorker.set(wid, (hoursByWorker.get(wid) ?? 0) + hrs);
          });

          const mapped: Section3Worker[] = workers.map((w: Record<string, unknown>) => ({
            id: String(w.id),
            name: String(w.name ?? ''),
            qualification: 'N/A', // No section3 qualification field in DB yet
            hours: hoursByWorker.get(String(w.id)) ?? 0,
            section3: false, // No section3 flag in DB yet
            resident: false, // No resident flag in DB yet
          }));
          setSection3Workers(mapped);
        } else if (!cancelled) {
          setSection3Workers([]);
        }
      } catch (err) {
        console.warn('[HUDCompliance] Failed to fetch workforce data:', err);
        if (!cancelled) setSection3Workers([]);
      }

      // Fetch vendors for Section 3 business registry
      try {
        const { data: vendors } = await fromTable('vendors')
          .select('*')
          .eq('project_id', projectId)
          .order('company_name', { ascending: true });

        if (!cancelled && vendors && vendors.length > 0) {
          const mapped: Section3Business[] = vendors.map((v: Record<string, unknown>) => ({
            id: String(v.id),
            name: String(v.company_name ?? ''),
            certType: 'None', // No section3 cert type in DB yet
            contractAmt: 0, // No contract amount on vendor table
            section3: false, // No section3 flag in DB yet
          }));
          setSection3Businesses(mapped);
        } else if (!cancelled) {
          setSection3Businesses([]);
        }
      } catch (err) {
        console.warn('[HUDCompliance] Failed to fetch vendor data:', err);
        if (!cancelled) setSection3Businesses([]);
      }

      if (!cancelled) setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [projectId]);

  const mainTabs: { key: MainTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'lihtc', label: 'LIHTC', icon: Building2 },
    { key: 'davis-bacon', label: 'Davis-Bacon', icon: Users },
    { key: 'section3', label: 'Section 3', icon: Target },
    { key: 'tax-credits', label: 'Tax Credits', icon: DollarSign },
  ];

  const totalCredits = useMemo(() => programs.reduce((s, p) => s + p.credits, 0), [programs]);
  const activePrograms = useMemo(() => programs.filter(p => p.status === 'active').length, [programs]);
  const pendingAlerts = useMemo(() => alerts.filter(a => a.actionRequired).length, [alerts]);
  const nextDeadline = useMemo(() => {
    const withDeadlines = programs.filter(p => p.nextDeadline);
    const sorted = [...withDeadlines].sort((a, b) => a.nextDeadline.localeCompare(b.nextDeadline));
    return sorted[0]?.nextDeadline || '';
  }, [programs]);
  const overallHealth = useMemo(() => programs.length > 0 ? Math.round(programs.reduce((s, p) => s + p.healthScore, 0) / programs.length) : 0, [programs]);

  const filteredAlerts = useMemo(() => {
    if (!searchTerm) return alerts;
    const term = searchTerm.toLowerCase();
    return alerts.filter(a => a.message.toLowerCase().includes(term) || a.program.toLowerCase().includes(term));
  }, [searchTerm, alerts]);

  const togglePayroll = useCallback((id: string) => {
    setExpandedPayroll(prev => prev === id ? null : id);
  }, []);

  // Section 3 calculations
  const s3TotalHours = useMemo(() => section3Workers.reduce((s, w) => s + w.hours, 0), [section3Workers]);
  const s3QualifiedHours = useMemo(() => section3Workers.filter(w => w.section3).reduce((s, w) => s + w.hours, 0), [section3Workers]);
  const s3LaborPct = useMemo(() => s3TotalHours > 0 ? ((s3QualifiedHours / s3TotalHours) * 100) : 0, [s3TotalHours, s3QualifiedHours]);
  const s3TotalContracts = useMemo(() => section3Businesses.reduce((s, b) => s + b.contractAmt, 0), [section3Businesses]);
  const s3QualifiedContracts = useMemo(() => section3Businesses.filter(b => b.section3).reduce((s, b) => s + b.contractAmt, 0), [section3Businesses]);
  const s3ContractPct = useMemo(() => s3TotalContracts > 0 ? ((s3QualifiedContracts / s3TotalContracts) * 100) : 0, [s3TotalContracts, s3QualifiedContracts]);

  // Applicable fraction
  const unitFraction = applicableFraction.totalUnits > 0 ? applicableFraction.lowIncomeUnits / applicableFraction.totalUnits : 0;
  const sqftFraction = applicableFraction.totalSqft > 0 ? applicableFraction.lowIncomeSqft / applicableFraction.totalSqft : 0;
  const appFraction = Math.min(unitFraction, sqftFraction);

  // ── Render Tab Content ────────────────────────────────
  const renderOverview = () => {
    if (loading) return <LoadingSkeleton />;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md }}>
          {[
            { label: 'Total Credits Value', value: programs.length > 0 ? fmtUSD(totalCredits) : '$0', icon: DollarSign, accent: colors.chartGreen },
            { label: 'Programs Active', value: `${activePrograms} / ${programs.length}`, icon: Shield, accent: colors.primaryOrange },
            { label: 'Alerts Pending', value: String(pendingAlerts), icon: AlertTriangle, accent: colors.statusWarning },
            { label: 'Next Deadline', value: nextDeadline ? fmtDate(nextDeadline) : 'None', icon: Clock, accent: colors.statusInfo },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <div style={{ width: 40, height: 40, borderRadius: borderRadius.md, background: stat.accent + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <stat.icon size={20} color={stat.accent} />
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{stat.label}</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{stat.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Compliance Health + Program Cards */}
        {programs.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: spacing.lg }}>
            {/* Health Score */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Overall Compliance Health
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HealthRing score={overallHealth} size={120} />
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '28px', fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{overallHealth}%</span>
                </div>
              </div>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: 'center' }}>
                {overallHealth >= 90 ? 'Excellent — all programs on track' : overallHealth >= 70 ? 'Good — some items need attention' : 'At Risk — immediate action required'}
              </div>
            </motion.div>

            {/* Program Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: spacing.md }}>
              {programs.map((prog, i) => (
                <motion.div key={prog.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }} style={{ ...cardStyle, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  whileHover={{ scale: 1.01 }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: prog.healthScore >= 90 ? colors.statusActive : prog.healthScore >= 70 ? colors.statusWarning : colors.statusCritical }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm }}>
                    <span style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{prog.code}</span>
                    <span style={badgeStyle(prog.status)}>{prog.status}</span>
                  </div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing.sm }}>{prog.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                      <HealthRing score={prog.healthScore} size={28} />
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{prog.healthScore}%</span>
                    </div>
                    {prog.credits > 0 && (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{fmtUSD(prog.credits)}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyCard
            icon={Shield}
            title="No Compliance Programs Configured"
            description="Configure compliance programs (LIHTC, Davis-Bacon, Section 3, HTC, etc.) in Settings to begin tracking compliance status and deadlines."
          />
        )}

        {/* Deadlines + Alerts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
          {/* Upcoming Deadlines */}
          <div style={cardStyle}>
            <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <Calendar size={18} color={colors.primaryOrange} /> Upcoming Deadlines
            </div>
            {programs.length > 0 ? (
              [...programs].filter(p => p.nextDeadline).sort((a, b) => a.nextDeadline.localeCompare(b.nextDeadline)).map(prog => {
                const days = daysUntil(prog.nextDeadline);
                const urgency = days <= 30 ? colors.statusCritical : days <= 60 ? colors.statusWarning : colors.statusActive;
                return (
                  <div key={prog.id} style={{ display: 'flex', alignItems: 'center', padding: `${spacing.sm} 0`,
                    borderBottom: `1px solid ${colors.borderSubtle}`, gap: spacing.md }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: urgency, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{prog.code}</div>
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{fmtDate(prog.nextDeadline)}</div>
                    </div>
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                      color: urgency }}>{days}d</span>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                No upcoming deadlines. Configure compliance programs to track deadlines.
              </div>
            )}
          </div>

          {/* Active Alerts */}
          <div style={cardStyle}>
            <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <AlertTriangle size={18} color={colors.statusWarning} /> Active Alerts
            </div>
            <div style={{ position: 'relative', marginBottom: spacing.md }}>
              <Search size={16} style={{ position: 'absolute', left: spacing.sm, top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
              <input placeholder="Search alerts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '32px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, maxHeight: 300, overflowY: 'auto' }}>
              {filteredAlerts.length > 0 ? filteredAlerts.map(alert => (
                <div key={alert.id} style={{ display: 'flex', gap: spacing.sm, padding: spacing.sm,
                  borderRadius: borderRadius.md, background: colors.surfaceInset }}>
                  <div style={{ marginTop: 2 }}>
                    {alert.severity === 'critical' ? <AlertCircle size={16} color={colors.statusCritical} /> :
                     alert.severity === 'warning' ? <AlertTriangle size={16} color={colors.statusWarning} /> :
                     <Info size={16} color={colors.statusInfo} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center', marginBottom: 2 }}>
                      <span style={badgeStyle(alert.severity)}>{alert.severity}</span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{alert.program}</span>
                    </div>
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, lineHeight: 1.4 }}>{alert.message}</div>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>{fmtDate(alert.date)}</div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                  {searchTerm ? 'No alerts match your search.' : 'No active alerts. All compliance items are in good standing.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLIHTC = () => {
    if (loading) return <LoadingSkeleton />;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        {/* Project Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing.md }}>
          {[
            { label: 'Credit Type', value: lihtcUnits.length > 0 ? '9% / 4% Hybrid' : '—' },
            { label: 'Set-Aside', value: lihtcUnits.length > 0 ? '40% @ 60% AMI' : '—' },
            { label: 'Applicable Fraction', value: applicableFraction.totalUnits > 0 ? `${(appFraction * 100).toFixed(1)}%` : '—' },
            { label: 'Qualified Basis', value: '—' },
            { label: 'Max Annual Credit', value: '—' },
            { label: 'Compliance Period', value: '—' },
          ].map((item, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing.xs }}>{item.label}</div>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Compliance Timeline */}
        <div style={cardStyle}>
          <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
            Compliance Timeline (30-Year Extended Use Period)
          </div>
          <div style={{ display: 'flex', gap: 2, height: 32, borderRadius: borderRadius.md, overflow: 'hidden' }}>
            {Array.from({ length: 30 }, (_, i) => {
              const isCurrentYear = i === 1;
              const isInitial = i < 15;
              return (
                <div key={i} style={{
                  flex: 1, background: isCurrentYear ? colors.primaryOrange : isInitial ? colors.statusActive : colors.statusInfo,
                  opacity: isCurrentYear ? 1 : i <= 1 ? 0.9 : 0.4,
                  position: 'relative', cursor: 'pointer',
                }} title={`Year ${i + 1} — ${isInitial ? 'Initial Compliance' : 'Extended Use'}`} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.xs }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Year 1</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive }}>Initial 15-Year Period</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusInfo }}>Extended 15-Year Period</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Year 30</span>
          </div>
        </div>

        {/* Applicable Fraction Calculator */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <Calculator size={18} color={colors.primaryOrange} /> Applicable Fraction Calculator
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 1fr', gap: spacing.md, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: 4 }}>Low-Income Units</label>
              <input type="number" value={applicableFraction.lowIncomeUnits}
                onChange={e => setApplicableFraction(p => ({ ...p, lowIncomeUnits: +e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: 4 }}>Total Units</label>
              <input type="number" value={applicableFraction.totalUnits}
                onChange={e => setApplicableFraction(p => ({ ...p, totalUnits: +e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ fontSize: '20px', color: colors.textTertiary, paddingBottom: spacing.sm }}>=</div>
            <div style={{ ...cardStyle, background: colors.surfaceInset, textAlign: 'center' }}>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Unit Fraction</div>
              <div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange }}>
                {applicableFraction.totalUnits > 0 ? (unitFraction * 100).toFixed(1) : '0.0'}%
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 1fr', gap: spacing.md, alignItems: 'end', marginTop: spacing.md }}>
            <div>
              <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: 4 }}>Low-Income Sq Ft</label>
              <input type="number" value={applicableFraction.lowIncomeSqft}
                onChange={e => setApplicableFraction(p => ({ ...p, lowIncomeSqft: +e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: 4 }}>Total Sq Ft</label>
              <input type="number" value={applicableFraction.totalSqft}
                onChange={e => setApplicableFraction(p => ({ ...p, totalSqft: +e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ fontSize: '20px', color: colors.textTertiary, paddingBottom: spacing.sm }}>=</div>
            <div style={{ ...cardStyle, background: colors.surfaceInset, textAlign: 'center' }}>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Floor Space Fraction</div>
              <div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange }}>
                {applicableFraction.totalSqft > 0 ? (sqftFraction * 100).toFixed(1) : '0.0'}%
              </div>
            </div>
          </div>
          <div style={{ marginTop: spacing.md, padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.md, textAlign: 'center' }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Applicable Fraction (lesser of unit or floor space): </span>
            <span style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange }}>
              {(applicableFraction.totalUnits > 0 || applicableFraction.totalSqft > 0) ? (appFraction * 100).toFixed(1) : '0.0'}%
            </span>
          </div>
        </div>

        {/* Unit Table */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Unit Compliance ({lihtcUnits.length} units)
            </div>
            <button style={btnPrimary} onClick={() => setShowUnitModal(true)}>
              <Plus size={16} /> Add Unit
            </button>
          </div>
          {lihtcUnits.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Unit', 'BR', 'Sq Ft', 'Rent Limit', 'Actual Rent', 'Income Limit', 'Tenant', 'Status', 'Cert Date', ''].map(h => (
                      <th key={h} style={tableHeaderStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lihtcUnits.map(u => (
                    <tr key={u.id} style={{ transition: transitions.fast }}>
                      <td style={{ ...tableCellStyle, fontWeight: typography.fontWeight.semibold }}>{u.unit}</td>
                      <td style={tableCellStyle}>{u.bedrooms}</td>
                      <td style={tableCellStyle}>{fmt(u.sqft)}</td>
                      <td style={tableCellStyle}>{fmtUSD(u.rentLimit)}</td>
                      <td style={{ ...tableCellStyle, color: u.actualRent > u.rentLimit ? colors.statusCritical : colors.textPrimary }}>
                        {fmtUSD(u.actualRent)}
                      </td>
                      <td style={tableCellStyle}>{fmtUSD(u.incomeLimit)}</td>
                      <td style={tableCellStyle}>{u.tenantName || '—'}</td>
                      <td style={tableCellStyle}><span style={badgeStyle(u.tenantStatus)}>{u.tenantStatus}</span></td>
                      <td style={tableCellStyle}>{fmtDate(u.certDate)}</td>
                      <td style={tableCellStyle}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}>
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCard
              icon={Building2}
              title="No LIHTC Units Configured"
              description="Add your low-income housing tax credit units to track rent limits, income limits, tenant certifications, and compliance status."
            />
          )}
        </div>

        {/* Add Unit Modal */}
        <AnimatePresence>
          {showUnitModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: colors.overlayDark, display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
              onClick={() => setShowUnitModal(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                style={{ ...cardStyle, width: 480, maxHeight: '80vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                  <span style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Add LIHTC Unit</span>
                  <button onClick={() => setShowUnitModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary }}><X size={20} /></button>
                </div>
                {['Unit Number', 'Bedrooms', 'Square Footage', 'Rent Limit ($)', 'Income Limit ($)', 'Tenant Name'].map(label => (
                  <div key={label} style={{ marginBottom: spacing.md }}>
                    <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input style={inputStyle} placeholder={label} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end', marginTop: spacing.lg }}>
                  <button style={btnSecondary} onClick={() => setShowUnitModal(false)}>Cancel</button>
                  <button style={btnPrimary} onClick={() => setShowUnitModal(false)}>
                    <Check size={16} /> Save Unit
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderDavisBacon = () => {
    if (loading) return <LoadingSkeleton />;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        {/* Wage Decision Info */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <div>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Prevailing Wage Rates
              </div>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Configure prevailing wages for your jurisdiction
              </div>
            </div>
            {wageRates.length > 0 && <span style={badgeStyle('active')}>Current</span>}
          </div>
        </div>

        {/* Violation Alerts from payroll */}
        {payrollEntries.some(e => e.status === 'rejected') && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            style={{ ...cardStyle, borderLeft: `4px solid ${colors.statusCritical}`, background: colors.statusCriticalSubtle }}>
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'flex-start' }}>
              <AlertCircle size={20} color={colors.statusCritical} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical }}>
                  Payroll Reports Require Attention
                </div>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, marginTop: 4 }}>
                  {payrollEntries.filter(e => e.status === 'rejected').length} certified payroll report(s) have been rejected. Review and resubmit to maintain Davis-Bacon compliance.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Prevailing Wage Rates Table */}
        <div style={cardStyle}>
          <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
            Prevailing Wage Rates
          </div>
          {wageRates.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Classification', 'Base Rate', 'Fringes', 'Total', 'Apprentice Ratio'].map(h => (
                    <th key={h} style={tableHeaderStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wageRates.map(w => (
                  <tr key={w.classification}>
                    <td style={{ ...tableCellStyle, fontWeight: typography.fontWeight.semibold }}>{w.classification}</td>
                    <td style={tableCellStyle}>${w.journeymanRate.toFixed(2)}</td>
                    <td style={tableCellStyle}>${w.fringes.toFixed(2)}</td>
                    <td style={{ ...tableCellStyle, fontWeight: typography.fontWeight.semibold }}>${w.total.toFixed(2)}</td>
                    <td style={tableCellStyle}>{w.apprenticeRatio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyCard
              icon={DollarSign}
              title="No Prevailing Wage Rates Configured"
              description="Add prevailing wage rates from the Department of Labor wage decision for your project jurisdiction and trade classifications."
            />
          )}
        </div>

        {/* Certified Payroll List */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Certified Payroll (WH-347)
            </div>
            <button style={btnPrimary}><Download size={16} /> Generate WH-347</button>
          </div>
          {payrollEntries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {payrollEntries.map(entry => (
                <div key={entry.id}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: spacing.md, background: colors.surfaceInset,
                    borderRadius: expandedPayroll === entry.id ? `${borderRadius.md} ${borderRadius.md} 0 0` : borderRadius.md,
                    cursor: 'pointer', gap: spacing.md }}
                    onClick={() => togglePayroll(entry.id)}>
                    {expandedPayroll === entry.id ? <ChevronDown size={16} color={colors.textTertiary} /> : <ChevronRight size={16} color={colors.textTertiary} />}
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{entry.contractor}</span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing.md }}>
                        Week ending {fmtDate(entry.weekEnding)}
                      </span>
                    </div>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginRight: spacing.md }}>{fmtUSD(entry.totalGross)}</span>
                    <span style={badgeStyle(entry.status as 'certified' | 'pending' | 'rejected')}>{entry.status}</span>
                  </div>
                  <AnimatePresence>
                    {expandedPayroll === entry.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ background: colors.surfaceInset, borderTop: `1px solid ${colors.borderSubtle}`,
                          borderRadius: `0 0 ${borderRadius.md} ${borderRadius.md}`, padding: spacing.md }}>
                          {entry.employees.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  {['Employee', 'Classification', 'Hours', 'Rate', 'Gross', 'Ded.', 'Net'].map(h => (
                                    <th key={h} style={{ ...tableHeaderStyle, fontSize: '11px', padding: `4px ${spacing.sm}` }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {entry.employees.map((emp, i) => {
                                  const expectedRate = wageRates.find(w => w.classification === emp.classification)?.journeymanRate || 0;
                                  const underpaid = expectedRate > 0 && emp.rate < expectedRate;
                                  return (
                                    <tr key={i} style={{ background: underpaid ? colors.statusCriticalSubtle : 'transparent' }}>
                                      <td style={{ ...tableCellStyle, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold }}>
                                        {emp.name} {underpaid && <AlertCircle size={12} color={colors.statusCritical} style={{ marginLeft: 4 }} />}
                                      </td>
                                      <td style={{ ...tableCellStyle, fontSize: typography.fontSize.caption }}>{emp.classification}</td>
                                      <td style={{ ...tableCellStyle, fontSize: typography.fontSize.caption, textAlign: 'center' }}>{emp.hours[0] || '—'}</td>
                                      <td style={{ ...tableCellStyle, fontSize: typography.fontSize.caption, color: underpaid ? colors.statusCritical : colors.textPrimary }}>
                                        ${emp.rate.toFixed(2)}
                                      </td>
                                      <td style={{ ...tableCellStyle, fontSize: typography.fontSize.caption }}>{fmtUSD(emp.gross)}</td>
                                      <td style={{ ...tableCellStyle, fontSize: typography.fontSize.caption }}>{fmtUSD(emp.deductions)}</td>
                                      <td style={{ ...tableCellStyle, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold }}>{fmtUSD(emp.net)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ padding: spacing.md, textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                              No employee records for this payroll report.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCard
              icon={FileText}
              title="No Certified Payroll Reports"
              description="Certified payroll reports (WH-347) will appear here once contractors submit their weekly payroll data for Davis-Bacon compliance."
            />
          )}
        </div>
      </div>
    );
  };

  const renderSection3 = () => {
    if (loading) return <LoadingSkeleton />;

    const hasWorkerData = section3Workers.length > 0;
    const hasBusinessData = section3Businesses.length > 0;

    const monthlyData = [
      { month: 'Nov', pct: 0 }, { month: 'Dec', pct: 0 }, { month: 'Jan', pct: 0 },
      { month: 'Feb', pct: 0 }, { month: 'Mar', pct: 0 }, { month: 'Apr', pct: s3LaborPct },
    ];
    const maxPct = 30;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        {/* Info banner about Section 3 tracking */}
        {!hasWorkerData && !hasBusinessData && (
          <EmptyCard
            icon={Target}
            title="Section 3 Tracking Not Yet Configured"
            description="Section 3 compliance tracking requires workforce members and vendors to be tagged with Section 3 qualifications. Add workforce members on the Time Tracking page and vendors on the Vendors page, then configure Section 3 flags here."
          />
        )}

        {/* Progress Bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
          {[
            { label: 'Labor Hours Goal', target: 25, actual: s3LaborPct, qualified: fmt(s3QualifiedHours), total: fmt(s3TotalHours), unit: 'hrs' },
            { label: 'Contracting Goal', target: 3, actual: s3ContractPct, qualified: fmtUSD(s3QualifiedContracts), total: fmtUSD(s3TotalContracts), unit: '' },
          ].map((goal, i) => {
            const met = goal.actual >= goal.target;
            return (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <span style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{goal.label}</span>
                  <span style={badgeStyle(met ? 'active' : 'warning')}>{met ? 'Met' : 'Below Target'}</span>
                </div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing.sm }}>
                  {goal.qualified} / {goal.total} {goal.unit}
                </div>
                <div style={{ height: 24, background: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden', position: 'relative' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${goal.target > 0 ? Math.min(goal.actual / goal.target * 100, 100) : 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{ height: '100%', background: met ? colors.statusActive : colors.statusWarning, borderRadius: borderRadius.full }} />
                  <div style={{ position: 'absolute', left: `${(goal.target / (goal.target * 1.5)) * 100}%`, top: 0, bottom: 0,
                    width: 2, background: colors.textPrimary, opacity: 0.6 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.xs }}>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                    Current: {goal.actual.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                    Target: {goal.target}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trend Chart */}
        <div style={cardStyle}>
          <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
            Monthly Section 3 Labor Hours Trend
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md, height: 180, padding: `0 ${spacing.md}` }}>
            {monthlyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{d.pct.toFixed(1)}%</span>
                <motion.div initial={{ height: 0 }} animate={{ height: `${(d.pct / maxPct) * 140}px` }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  style={{ width: '100%', background: d.pct >= 25 ? colors.statusActive : colors.primaryOrange,
                    borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`, minHeight: 4 }} />
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{d.month}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px dashed ${colors.statusActive}`, marginTop: spacing.sm, position: 'relative' }}>
            <span style={{ position: 'absolute', right: 0, top: -10, fontSize: typography.fontSize.caption, color: colors.statusActive }}>
              25% Target
            </span>
          </div>
        </div>

        {/* Worker Registry */}
        <div style={cardStyle}>
          <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
            Worker Registry
          </div>
          {hasWorkerData ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Qualification', 'Hours', 'Section 3', 'Resident'].map(h => (
                    <th key={h} style={tableHeaderStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section3Workers.map(w => (
                  <tr key={w.id}>
                    <td style={{ ...tableCellStyle, fontWeight: typography.fontWeight.semibold }}>{w.name}</td>
                    <td style={tableCellStyle}>{w.qualification}</td>
                    <td style={tableCellStyle}>{fmt(w.hours)}</td>
                    <td style={tableCellStyle}>
                      {w.section3 ? <CheckCircle size={16} color={colors.statusActive} /> : <X size={16} color={colors.textTertiary} />}
                    </td>
                    <td style={tableCellStyle}>
                      {w.resident ? <CheckCircle size={16} color={colors.statusActive} /> : <X size={16} color={colors.textTertiary} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyCard
              icon={Users}
              title="No Workers Registered"
              description="Workforce members will appear here once added to the project. Tag workers with Section 3 qualifications to track compliance."
            />
          )}
        </div>

        {/* Business Registry */}
        <div style={cardStyle}>
          <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
            Business Registry
          </div>
          {hasBusinessData ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Business', 'Certification', 'Contract Amount', 'Section 3'].map(h => (
                    <th key={h} style={tableHeaderStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section3Businesses.map(b => (
                  <tr key={b.id}>
                    <td style={{ ...tableCellStyle, fontWeight: typography.fontWeight.semibold }}>{b.name}</td>
                    <td style={tableCellStyle}>{b.certType}</td>
                    <td style={tableCellStyle}>{b.contractAmt > 0 ? fmtUSD(b.contractAmt) : '—'}</td>
                    <td style={tableCellStyle}>
                      {b.section3 ? <CheckCircle size={16} color={colors.statusActive} /> : <X size={16} color={colors.textTertiary} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyCard
              icon={Building2}
              title="No Businesses Registered"
              description="Vendors will appear here once added to the project. Tag vendors with Section 3 certifications to track contracting goals."
            />
          )}
        </div>
      </div>
    );
  };

  const renderTaxCredits = () => {
    const taxTabs: { key: TaxCreditSub; label: string }[] = [
      { key: 'htc', label: 'Historic (HTC)' },
      { key: 'nmtc', label: 'New Markets (NMTC)' },
      { key: '45l', label: '45L Energy' },
      { key: '179d', label: '179D Deduction' },
      { key: 'oz', label: 'Opportunity Zone' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: spacing.xs, borderBottom: `1px solid ${colors.borderSubtle}`, overflowX: 'auto' }}>
          {taxTabs.map(t => (
            <button key={t.key} onClick={() => setTaxSub(t.key)}
              style={{ ...tabStyle(taxSub === t.key), fontSize: typography.fontSize.caption }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* HTC */}
        {taxSub === 'htc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md }}>
              {[
                { label: 'Total QRE', value: '—' },
                { label: 'Federal HTC (20%)', value: '—' },
                { label: 'State HTC (25%)', value: '—' },
                { label: 'NPS Status', value: '—' },
              ].map((item, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.label}</div>
                  <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* NPS Application Status */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                NPS Application Progress
              </div>
              <div style={{ display: 'flex', gap: spacing.lg }}>
                {[
                  { part: 'Part 1', desc: 'Significance', status: 'Pending', date: '' },
                  { part: 'Part 2', desc: 'Proposed Work', status: 'Pending', date: '' },
                  { part: 'Part 3', desc: 'Completed Work', status: 'Pending', date: '' },
                ].map((p, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.sm }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%',
                      background: p.status === 'Approved' ? colors.statusActive : colors.surfaceInset,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.status === 'Approved' ? <Check size={24} color={colors.white} /> :
                        <span style={{ fontSize: typography.fontSize.lg, color: colors.textTertiary }}>{i + 1}</span>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{p.part}</div>
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{p.desc}</div>
                      <div style={{ fontSize: typography.fontSize.caption, color: p.status === 'Approved' ? colors.statusActive : colors.textTertiary }}>
                        {p.status === 'Approved' ? fmtDate(p.date) : 'Not Started'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo Documentation Grid */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  Photo Documentation
                </div>
                <button style={btnSecondary}><Camera size={16} /> Upload Photos</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.md }}>
                {['Facade - Before', 'Facade - During', 'Interior - Before', 'Interior - During',
                  'Windows - Before', 'Windows - Installed', 'Cornice - Before', 'Cornice - Restored'].map((label, i) => (
                  <div key={i} style={{ background: colors.surfaceInset, borderRadius: borderRadius.md, aspectRatio: '4/3',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
                    <Camera size={24} color={colors.textTertiary} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textAlign: 'center', padding: `0 ${spacing.sm}` }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* QRE Tracker */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                Qualified Rehabilitation Expenditures (QRE)
              </div>
              <EmptyCard
                icon={DollarSign}
                title="No QRE Data Yet"
                description="Qualified rehabilitation expenditure tracking will populate as construction costs are recorded and categorized."
              />
            </div>
          </div>
        )}

        {/* NMTC */}
        {taxSub === 'nmtc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md }}>
              {[
                { label: 'NMTC Allocation', value: '—' },
                { label: 'QLICI Amount', value: '—' },
                { label: 'Investor Credit (39%)', value: '—' },
                { label: 'Compliance Year', value: '—' },
              ].map((item, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.label}</div>
                  <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* 7-Year Timeline */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                7-Year Compliance Period
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs }}>
                    <div style={{ width: '100%', height: 32, borderRadius: borderRadius.md,
                      background: colors.surfaceInset,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    </div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      Yr {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Jobs Created */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                Jobs Created / Retained
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
                <div style={{ textAlign: 'center', padding: spacing.lg, background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <div style={{ fontSize: '36px', fontWeight: typography.fontWeight.bold, color: colors.textTertiary }}>—</div>
                  <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Full-Time Jobs Created</div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Configure target in Settings</div>
                </div>
                <div style={{ textAlign: 'center', padding: spacing.lg, background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <div style={{ fontSize: '36px', fontWeight: typography.fontWeight.bold, color: colors.textTertiary }}>—</div>
                  <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Full-Time Jobs Retained</div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Configure target in Settings</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 45L */}
        {taxSub === '45l' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md }}>
              {[
                { label: 'Eligible Units', value: lihtcUnits.length > 0 ? String(lihtcUnits.length) : '—' },
                { label: 'Certified Units', value: '—' },
                { label: 'Credit per Unit', value: '—' },
                { label: 'Estimated Total', value: '—' },
              ].map((item, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.label}</div>
                  <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  Unit Certification Status
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Prevailing Wage Met</label>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: colors.surfaceInset, position: 'relative', cursor: 'pointer' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: colors.white, position: 'absolute', top: 2, left: 2, transition: transitions.fast }} />
                  </div>
                </div>
              </div>
              {lihtcUnits.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Unit', 'ENERGY STAR', 'HERS Score', 'Credit Amount', 'Status'].map(h => (
                        <th key={h} style={tableHeaderStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lihtcUnits.map((u) => (
                      <tr key={u.id}>
                        <td style={{ ...tableCellStyle, fontWeight: typography.fontWeight.semibold }}>{u.unit}</td>
                        <td style={tableCellStyle}>
                          <Clock size={16} color={colors.textTertiary} />
                        </td>
                        <td style={tableCellStyle}>—</td>
                        <td style={{ ...tableCellStyle, fontWeight: typography.fontWeight.semibold }}>—</td>
                        <td style={tableCellStyle}>
                          <span style={badgeStyle('pending')}>Pending</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyCard
                  icon={Zap}
                  title="No Units for 45L Certification"
                  description="Add LIHTC units first, then track ENERGY STAR certifications and HERS scores for 45L energy credit eligibility."
                />
              )}
            </div>

            {/* Credit Calculator */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                45L Credit Calculator
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.lg }}>
                {[
                  { tier: 'Base ($500)', desc: 'ENERGY STAR certified', color: colors.statusInfo },
                  { tier: 'Enhanced ($2,500)', desc: 'Zero Energy Ready', color: colors.statusActive },
                  { tier: 'Max ($5,000)', desc: 'Zero Energy Ready + Prevailing Wage', color: colors.primaryOrange },
                ].map((t, i) => (
                  <div key={i} style={{ padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.md,
                    borderTop: `3px solid ${t.color}` }}>
                    <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: t.color }}>{t.tier}</div>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 179D */}
        {taxSub === '179d' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md }}>
              {[
                { label: 'Building Sq Ft', value: '—' },
                { label: 'Credit per Sq Ft', value: '—' },
                { label: 'Estimated Deduction', value: '—' },
                { label: 'ASHRAE Baseline', value: '—' },
              ].map((item, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.label}</div>
                  <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Energy Model Summary */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                Energy Model — ASHRAE 90.1 Comparison
              </div>
              <EmptyCard
                icon={Zap}
                title="No Energy Model Data"
                description="Upload your ASHRAE 90.1 energy model comparison to track savings percentages and 179D deduction qualification."
              />
            </div>

            {/* Bonus Qualifiers */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                Bonus Deduction Qualifiers
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.md }}>
                {[
                  { label: 'Prevailing Wage Requirement', met: false, desc: 'All laborers and mechanics paid prevailing wages' },
                  { label: 'Apprenticeship Requirement', met: false, desc: 'Apprentice hours meet or exceed 15% threshold' },
                  { label: 'Energy Savings >= 25%', met: false, desc: 'Proposed design achieves required savings over baseline' },
                  { label: 'Bonus Rate Eligible', met: false, desc: 'Qualifies for $5.36/sf (vs. base $1.07/sf)' },
                ].map((q, i) => (
                  <div key={i} style={{ display: 'flex', gap: spacing.sm, padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      {q.met ? <CheckCircle size={18} color={colors.statusActive} /> : <AlertCircle size={18} color={colors.statusWarning} />}
                    </div>
                    <div>
                      <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{q.label}</div>
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{q.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Opportunity Zone */}
        {taxSub === 'oz' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md }}>
              {[
                { label: 'Original Basis', value: '—' },
                { label: 'Improvement Target', value: '—' },
                { label: 'Improvements to Date', value: '—' },
                { label: 'Census Tract', value: '—' },
              ].map((item, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.label}</div>
                  <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Substantial Improvement Test */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                Substantial Improvement Test
              </div>
              <EmptyCard
                icon={TrendingUp}
                title="No Improvement Data"
                description="Configure your Opportunity Zone investment basis and improvement targets in Settings to track the substantial improvement test."
              />
            </div>

            {/* 30-Month Deadline Countdown */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                30-Month Improvement Deadline
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.lg, textAlign: 'center' }}>
                <div style={{ padding: spacing.lg, background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Start Date</div>
                  <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary }}>—</div>
                </div>
                <div style={{ padding: spacing.lg, background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Days Remaining</div>
                  <div style={{ fontSize: '36px', fontWeight: typography.fontWeight.bold, color: colors.textTertiary }}>—</div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Configure in Settings</div>
                </div>
                <div style={{ padding: spacing.lg, background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Deadline</div>
                  <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary }}>—</div>
                </div>
              </div>
            </div>

            {/* Basis Tracking */}
            <div style={cardStyle}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md }}>
                Improvement Basis Tracking
              </div>
              <EmptyCard
                icon={Calculator}
                title="No Basis Tracking Data"
                description="Add improvement categories and amounts to track your qualified Opportunity Zone basis and progress toward the substantial improvement test."
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0, backgroundColor: colors.surfacePage }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: `${spacing.xl} ${spacing.lg}` }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Shield size={24} color={colors.primaryOrange} />
              <h1 style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0 }}>
                HUD & Tax Credit Compliance
              </h1>
            </div>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>
              Track LIHTC, Davis-Bacon, Section 3, and tax credit compliance for your project
            </p>
          </div>
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button style={btnSecondary}><Download size={16} /> Export Report</button>
            <button style={btnPrimary}><FileText size={16} /> Compliance Summary</button>
          </div>
        </div>

        {/* Main Tabs */}
        <div style={{ display: 'flex', gap: spacing.xs, borderBottom: `1px solid ${colors.borderSubtle}`, marginBottom: spacing.lg, overflowX: 'auto' }}>
          {mainTabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={tabStyle(activeTab === t.key)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}>
                <t.icon size={16} /> {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'lihtc' && renderLIHTC()}
            {activeTab === 'davis-bacon' && renderDavisBacon()}
            {activeTab === 'section3' && renderSection3()}
            {activeTab === 'tax-credits' && renderTaxCredits()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HUDCompliancePage;
