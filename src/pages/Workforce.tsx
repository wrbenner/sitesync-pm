/**
 * Workforce — canonical labor view per DESIGN-RESET.md.
 *
 * Today / This Week / Roster. Dense tables, sticky header, real numbers.
 * No artistic surface, no demo tabs. Real-time = React Query refetch on
 * mount + window-focus; check-ins materialize through `time_entries` rows.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ProjectGate } from '../components/ProjectGate';
import { PermissionGate } from '../components/auth/PermissionGate';
import { colors, spacing, typography } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { usePermissions } from '../hooks/usePermissions';
import {
  useWorkforceMembers,
  useTimeEntries,
  useCreateWorkforceMember,
  useCrews,
} from '../hooks/queries';

// ── Types ──────────────────────────────────────────────────────

interface WorkforceMemberRow {
  id: string;
  name: string;
  trade: string;
  role: string | null;
  status: string | null;
  hourly_rate: number | null;
  company: string | null;
  project_id: string;
}

interface TimeEntryRow {
  id: string;
  date: string;
  workforce_member_id: string;
  regular_hours: number | null;
  overtime_hours: number | null;
  double_time_hours: number | null;
  clock_in: string | null;
  clock_out: string | null;
}

type ViewKey = 'today' | 'week' | 'roster';

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'roster', label: 'Roster' },
];

// ── Helpers ────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday = start of week
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function totalHours(t: TimeEntryRow): number {
  return (
    Number(t.regular_hours ?? 0) +
    Number(t.overtime_hours ?? 0) +
    Number(t.double_time_hours ?? 0)
  );
}

// Labor cost: regular at base rate, OT at 1.5×, double-time at 2×. Falls
// back to base × all hours when only one rate exists.
function laborCost(t: TimeEntryRow, hourlyRate: number): number {
  const reg = Number(t.regular_hours ?? 0);
  const ot = Number(t.overtime_hours ?? 0);
  const dt = Number(t.double_time_hours ?? 0);
  return reg * hourlyRate + ot * hourlyRate * 1.5 + dt * hourlyRate * 2;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtHours(n: number): string {
  return n === 0 ? '—' : n.toFixed(1);
}

interface TradeRoll {
  trade: string;
  headcount: number;
  hoursToday: number;
  hoursWeek: number;
  laborToday: number;
  laborWeek: number;
}

function rollupByTrade(
  members: WorkforceMemberRow[],
  entries: TimeEntryRow[],
  today: string,
  weekStart: string,
): TradeRoll[] {
  const memberById = new Map<string, WorkforceMemberRow>();
  for (const m of members) memberById.set(m.id, m);

  const tradeAcc = new Map<string, TradeRoll>();
  const checkedInTodayPerTrade = new Map<string, Set<string>>();

  for (const m of members) {
    const trade = m.trade || 'Unassigned';
    if (!tradeAcc.has(trade)) {
      tradeAcc.set(trade, {
        trade,
        headcount: 0,
        hoursToday: 0,
        hoursWeek: 0,
        laborToday: 0,
        laborWeek: 0,
      });
    }
  }

  for (const e of entries) {
    const m = memberById.get(e.workforce_member_id);
    if (!m) continue;
    const trade = m.trade || 'Unassigned';
    const roll = tradeAcc.get(trade);
    if (!roll) continue;
    const hrs = totalHours(e);
    const cost = laborCost(e, Number(m.hourly_rate ?? 0));
    if (e.date >= weekStart) {
      roll.hoursWeek += hrs;
      roll.laborWeek += cost;
    }
    if (e.date === today) {
      roll.hoursToday += hrs;
      roll.laborToday += cost;
      const set = checkedInTodayPerTrade.get(trade) ?? new Set<string>();
      set.add(m.id);
      checkedInTodayPerTrade.set(trade, set);
    }
  }

  for (const [trade, roll] of tradeAcc.entries()) {
    roll.headcount = checkedInTodayPerTrade.get(trade)?.size ?? 0;
  }

  return Array.from(tradeAcc.values()).sort((a, b) => {
    if (b.headcount !== a.headcount) return b.headcount - a.headcount;
    return a.trade.localeCompare(b.trade);
  });
}

// ── Status pill (active / out / off) ──────────────────────────

function statusPill(status: string | null): { label: string; bg: string; fg: string } {
  const key = (status ?? 'off').toLowerCase();
  if (key === 'active' || key === 'on_site' || key === 'on-site' || key === 'on site')
    return { label: 'Active', bg: '#E5F2EC', fg: '#1F6F4F' };
  if (key === 'out' || key === 'sick' || key === 'pto')
    return { label: 'Out', bg: '#FCF2DE', fg: '#7A5C12' };
  return { label: 'Off', bg: '#F1ECE2', fg: '#5C5550' };
}

function StatusChip({ status }: { status: string | null }) {
  const t = statusPill(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontFamily: typography.fontFamily,
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: t.fg,
          flexShrink: 0,
        }}
      />
      {t.label}
    </span>
  );
}

// ── Add Worker modal — minimal, preserves the existing mutation ──

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  knownCrews: Array<{ id: string; name: string; trade: string | null }>;
}

function AddMemberModal({ open, onClose, projectId, knownCrews }: AddMemberModalProps) {
  const create = useCreateWorkforceMember();
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [role, setRole] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setTrade('');
      setRole('');
      setHourlyRate('');
      setCompany('');
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    try {
      await create.mutateAsync({
        project_id: projectId,
        name: name.trim(),
        trade: trade.trim() || 'Unassigned',
        role: role.trim() || null,
        hourly_rate: hourlyRate ? Number(hourlyRate) : null,
        company: company.trim() || null,
        status: 'active',
      });
      toast.success(`${name.trim()} added`);
      onClose();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  const trades = Array.from(
    new Set(knownCrews.map((c) => c.trade).filter((t): t is string => !!t)),
  ).sort();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    background: colors.surfaceRaised,
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: colors.textTertiary,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.40)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 480,
          maxWidth: '92vw',
          background: colors.surfaceRaised,
          borderRadius: 8,
          padding: spacing[6],
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[4],
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: colors.textPrimary,
            }}
          >
            Add to Crew
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textTertiary,
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: spacing[3] }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[3] }}>
            <div>
              <label style={labelStyle}>Trade</label>
              <input
                style={inputStyle}
                list="workforce-trade-options"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
              />
              <datalist id="workforce-trade-options">
                {trades.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <input style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[3] }}>
            <div>
              <label style={labelStyle}>Hourly rate ($)</label>
              <input
                style={inputStyle}
                type="number"
                inputMode="decimal"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[5] }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: 6,
              fontFamily: typography.fontFamily,
              fontSize: 13,
              fontWeight: 500,
              color: colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            style={{
              padding: '8px 14px',
              background: colors.primaryOrange,
              border: 'none',
              borderRadius: 6,
              fontFamily: typography.fontFamily,
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: create.isPending ? 'not-allowed' : 'pointer',
              opacity: create.isPending ? 0.6 : 1,
            }}
          >
            {create.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Today / Week table ────────────────────────────────────────

interface TradeTableProps {
  rows: TradeRoll[];
  showLabor: boolean;
  highlightTrade: string | null;
  onTradeClick: (trade: string) => void;
}

function TradeTable({ rows, showLabor, highlightTrade, onTradeClick }: TradeTableProps) {
  const grid = showLabor
    ? 'minmax(220px, 2fr) minmax(160px, 1.5fr) 100px 110px 110px 130px 130px'
    : 'minmax(220px, 2fr) minmax(160px, 1.5fr) 100px 110px 110px';

  const headers = showLabor
    ? ['Trade', 'Company', 'Headcount', 'Hours today', 'Hours week', 'Labor $ today', 'Labor $ week']
    : ['Trade', 'Company', 'Headcount', 'Hours today', 'Hours week'];
  const aligns: Array<'left' | 'right'> = showLabor
    ? ['left', 'left', 'right', 'right', 'right', 'right', 'right']
    : ['left', 'left', 'right', 'right', 'right'];

  const totals = rows.reduce(
    (acc, r) => {
      acc.headcount += r.headcount;
      acc.hoursToday += r.hoursToday;
      acc.hoursWeek += r.hoursWeek;
      acc.laborToday += r.laborToday;
      acc.laborWeek += r.laborWeek;
      return acc;
    },
    { headcount: 0, hoursToday: 0, hoursWeek: 0, laborToday: 0, laborWeek: 0 },
  );

  return (
    <div
      role="grid"
      aria-label="Workforce by trade"
      style={{
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: grid,
          height: 36,
          alignItems: 'center',
          background: '#FCFCFA',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {headers.map((h, i) => (
          <div
            key={h}
            role="columnheader"
            style={{
              padding: `0 ${spacing[3]}`,
              textAlign: aligns[i],
              fontFamily: typography.fontFamily,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: colors.textTertiary,
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: spacing[6],
            textAlign: 'center',
            color: colors.textTertiary,
            fontFamily: typography.fontFamily,
            fontSize: 13,
          }}
        >
          No workforce activity yet.
        </div>
      ) : (
        rows.map((r) => {
          const focused = highlightTrade === r.trade;
          return (
            <div
              key={r.trade}
              role="row"
              data-trade={r.trade}
              onClick={() => onTradeClick(r.trade)}
              style={{
                display: 'grid',
                gridTemplateColumns: grid,
                height: 36,
                alignItems: 'center',
                borderBottom: `1px solid ${colors.borderSubtle}`,
                background: focused ? '#F4F2EF' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 13,
                  fontWeight: 500,
                  color: colors.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {r.trade}
              </div>
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                —
              </div>
              <NumCell value={r.headcount} fmt={(n) => (n === 0 ? '—' : String(n))} />
              <NumCell value={r.hoursToday} fmt={fmtHours} />
              <NumCell value={r.hoursWeek} fmt={fmtHours} />
              {showLabor && <NumCell value={r.laborToday} fmt={fmtMoney} />}
              {showLabor && <NumCell value={r.laborWeek} fmt={fmtMoney} />}
            </div>
          );
        })
      )}

      {rows.length > 0 && (
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: grid,
            height: 40,
            alignItems: 'center',
            borderTop: `2px solid ${colors.borderSubtle}`,
            background: '#FCFCFA',
            fontWeight: 600,
          }}
        >
          <div
            style={{
              padding: `0 ${spacing[3]}`,
              fontFamily: typography.fontFamily,
              fontSize: 12,
              fontWeight: 600,
              color: colors.textPrimary,
              letterSpacing: '0.02em',
            }}
          >
            Total
          </div>
          <div />
          <NumCell value={totals.headcount} fmt={(n) => String(n)} bold />
          <NumCell value={totals.hoursToday} fmt={fmtHours} bold />
          <NumCell value={totals.hoursWeek} fmt={fmtHours} bold />
          {showLabor && <NumCell value={totals.laborToday} fmt={fmtMoney} bold />}
          {showLabor && <NumCell value={totals.laborWeek} fmt={fmtMoney} bold />}
        </div>
      )}
    </div>
  );
}

function NumCell({
  value,
  fmt,
  bold = false,
}: {
  value: number;
  fmt: (n: number) => string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        padding: `0 ${spacing[3]}`,
        textAlign: 'right',
        fontFamily: typography.fontFamily,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        color: value === 0 ? colors.textTertiary : colors.textSecondary,
        fontWeight: bold ? 600 : 400,
      }}
    >
      {fmt(value)}
    </div>
  );
}

// ── Roster table ──────────────────────────────────────────────

interface RosterRow {
  member: WorkforceMemberRow;
  crewName: string;
  checkInTime: string | null;
}

function RosterTable({
  rows,
  showRate,
  filterTrade,
}: {
  rows: RosterRow[];
  showRate: boolean;
  filterTrade: string | null;
}) {
  const filtered = useMemo(
    () => (filterTrade ? rows.filter((r) => r.member.trade === filterTrade) : rows),
    [rows, filterTrade],
  );
  const grid = showRate
    ? 'minmax(180px, 2fr) minmax(120px, 1.5fr) minmax(120px, 1.2fr) 100px 80px 100px 100px'
    : 'minmax(180px, 2fr) minmax(120px, 1.5fr) minmax(120px, 1.2fr) 100px 100px 100px';

  const headers = showRate
    ? ['Worker', 'Crew', 'Trade', 'Role', 'Rate', 'Status', 'Check-in']
    : ['Worker', 'Crew', 'Trade', 'Role', 'Status', 'Check-in'];
  const aligns: Array<'left' | 'right'> = showRate
    ? ['left', 'left', 'left', 'left', 'right', 'left', 'left']
    : ['left', 'left', 'left', 'left', 'left', 'left'];

  return (
    <div
      role="grid"
      aria-label="Roster"
      style={{
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: grid,
          height: 36,
          alignItems: 'center',
          background: '#FCFCFA',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {headers.map((h, i) => (
          <div
            key={h}
            role="columnheader"
            style={{
              padding: `0 ${spacing[3]}`,
              textAlign: aligns[i],
              fontFamily: typography.fontFamily,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: colors.textTertiary,
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: spacing[6],
            textAlign: 'center',
            color: colors.textTertiary,
            fontFamily: typography.fontFamily,
            fontSize: 13,
          }}
        >
          No workers in this view.
        </div>
      ) : (
        filtered.map(({ member, crewName, checkInTime }) => (
          <div
            key={member.id}
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns: grid,
              height: 36,
              alignItems: 'center',
              borderBottom: `1px solid ${colors.borderSubtle}`,
              background: 'transparent',
            }}
          >
            <div
              style={{
                padding: `0 ${spacing[3]}`,
                fontFamily: typography.fontFamily,
                fontSize: 13,
                fontWeight: 500,
                color: colors.textPrimary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {member.name}
            </div>
            <div
              style={{
                padding: `0 ${spacing[3]}`,
                fontFamily: typography.fontFamily,
                fontSize: 12,
                color: colors.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {crewName || '—'}
            </div>
            <div
              style={{
                padding: `0 ${spacing[3]}`,
                fontFamily: typography.fontFamily,
                fontSize: 12,
                color: colors.textSecondary,
                whiteSpace: 'nowrap',
              }}
            >
              {member.trade || '—'}
            </div>
            <div
              style={{
                padding: `0 ${spacing[3]}`,
                fontFamily: typography.fontFamily,
                fontSize: 12,
                color: colors.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {member.role || '—'}
            </div>
            {showRate && (
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  textAlign: 'right',
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                  color: colors.textSecondary,
                }}
              >
                {member.hourly_rate != null ? `$${member.hourly_rate.toFixed(2)}` : '—'}
              </div>
            )}
            <div style={{ padding: `0 ${spacing[3]}` }}>
              <StatusChip status={member.status} />
            </div>
            <div
              style={{
                padding: `0 ${spacing[3]}`,
                fontFamily: typography.fontFamily,
                fontSize: 12,
                color: colors.textSecondary,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {checkInTime || '—'}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

const WorkforcePage: React.FC = () => {
  const projectId = useProjectId();
  const { hasPermission } = usePermissions();
  const [view, setView] = useState<ViewKey>('today');
  const [drilledTrade, setDrilledTrade] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: rawMembers = [] } = useWorkforceMembers(projectId);
  const { data: rawEntries = [] } = useTimeEntries(projectId);
  const { data: rawCrews = [] } = useCrews(projectId);

  const members = rawMembers as unknown as WorkforceMemberRow[];
  const entries = rawEntries as unknown as TimeEntryRow[];
  const crews = rawCrews as Array<{ id: string; name: string; trade: string | null }>;

  const today = todayISO();
  const weekStart = weekStartISO();

  const todayRoll = useMemo(
    () => rollupByTrade(members, entries, today, weekStart),
    [members, entries, today, weekStart],
  );

  const showLaborCost = hasPermission('budget.view');
  const showRate = hasPermission('budget.view');

  // Roster rows: marry workforce_member with today's check-in time
  const rosterRows = useMemo<RosterRow[]>(() => {
    const checkInByMember = new Map<string, string>();
    for (const e of entries) {
      if (e.date !== today) continue;
      if (!e.clock_in) continue;
      checkInByMember.set(e.workforce_member_id, e.clock_in);
    }
    // Crews don't have a member-level FK in our schema; surface the crew the
    // member's trade belongs to as a directional hint, otherwise blank.
    const tradeToCrew = new Map<string, string>();
    for (const c of crews) {
      if (c.trade && !tradeToCrew.has(c.trade)) tradeToCrew.set(c.trade, c.name);
    }
    return members.map((m) => ({
      member: m,
      crewName: tradeToCrew.get(m.trade) ?? '',
      checkInTime: (() => {
        const ts = checkInByMember.get(m.id);
        if (!ts) return null;
        try {
          return new Date(ts).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });
        } catch {
          return null;
        }
      })(),
    }));
  }, [members, entries, crews, today]);

  const onSiteToday = todayRoll.reduce((a, r) => a + r.headcount, 0);

  const handleTradeClick = useCallback((trade: string) => {
    setDrilledTrade(trade);
    setView('roster');
  }, []);

  if (!projectId) return <ProjectGate />;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#FCFCFA',
        fontFamily: typography.fontFamily,
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#FCFCFA',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          paddingLeft: spacing[6],
          paddingRight: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: spacing[4],
          display: 'flex',
          alignItems: 'center',
          gap: spacing[4],
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: colors.textPrimary,
            letterSpacing: '-0.01em',
          }}
        >
          Workforce
        </h1>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 999,
            background: '#F1ECE2',
            fontSize: 12,
            fontWeight: 500,
            color: colors.textSecondary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ fontWeight: 600, color: colors.textPrimary }}>{onSiteToday}</span>
          on site today
        </span>

        <div
          role="tablist"
          aria-label="Workforce views"
          style={{
            display: 'inline-flex',
            background: '#F1ECE2',
            borderRadius: 6,
            padding: 2,
          }}
        >
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  setView(v.key);
                  if (v.key !== 'roster') setDrilledTrade(null);
                }}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  borderRadius: 4,
                  background: active ? colors.surfaceRaised : 'transparent',
                  color: active ? colors.textPrimary : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 2px rgba(26, 22, 19, 0.04)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <PermissionGate
          permission="crews.manage"
          fallback={
            <button
              type="button"
              disabled
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: colors.surfaceInset,
                border: 'none',
                borderRadius: 6,
                color: colors.textTertiary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'not-allowed',
              }}
            >
              <Plus size={14} aria-hidden="true" />
              Add to Crew
            </button>
          }
        >
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: colors.primaryOrange,
              border: 'none',
              borderRadius: 6,
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} aria-hidden="true" />
            Add to Crew
          </button>
        </PermissionGate>
      </header>

      <main
        style={{
          paddingLeft: spacing[6],
          paddingRight: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: spacing[8],
        }}
      >
        {view === 'roster' && drilledTrade && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              marginBottom: spacing[3],
              fontSize: 12,
              color: colors.textSecondary,
              fontFamily: typography.fontFamily,
            }}
          >
            <span>
              Filtered: <strong style={{ color: colors.textPrimary }}>{drilledTrade}</strong>
            </span>
            <button
              type="button"
              onClick={() => setDrilledTrade(null)}
              style={{
                padding: '2px 8px',
                background: 'transparent',
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: 4,
                cursor: 'pointer',
                color: colors.textSecondary,
                fontSize: 11,
                fontFamily: typography.fontFamily,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <X size={10} aria-hidden="true" />
              Clear
            </button>
          </div>
        )}

        {view === 'roster' ? (
          <RosterTable rows={rosterRows} showRate={showRate} filterTrade={drilledTrade} />
        ) : (
          <TradeTable
            rows={todayRoll}
            showLabor={showLaborCost}
            highlightTrade={null}
            onTradeClick={handleTradeClick}
          />
        )}
      </main>

      <AddMemberModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        projectId={projectId}
        knownCrews={crews}
      />
    </div>
  );
};

export const Workforce: React.FC = () => (
  <ErrorBoundary>
    <WorkforcePage />
  </ErrorBoundary>
);

export default Workforce;
