/**
 * The Ledger — "Where is the money?"
 *
 * Shape: Book — chapters you can leaf through.
 * Financial overview: budget, change orders, contracts, pay apps.
 * Serif numbers. Parchment ground. One orange dot on the critical number.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { useCopilotStore } from '../../stores/copilotStore';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject, useBudgetItems, useChangeOrders } from '../../hooks/queries';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { useContracts, usePayApplications } from '../../hooks/queries/financials';
import { colors, typography, transitions } from '../../styles/theme';
import {
  OrangeDot,
  Eyebrow,
} from '../../components/atoms';
import { DollarSign, FileText } from 'lucide-react';
import { QuickCreateFAB } from '../../components/QuickCreateFAB';
import CreateChangeOrderModal from '../../components/forms/CreateChangeOrderModal';
import { useCreateChangeOrder } from '../../hooks/mutations/change-orders';

// ── Currency helper ─────────────────────────────────────────

const formatCurrency = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ── Status badge ────────────────────────────────────────────

const statusColors: Record<string, { fg: string; bg: string }> = {
  approved:    { fg: colors.statusActive,   bg: colors.statusActiveSubtle },
  executed:    { fg: colors.statusActive,   bg: colors.statusActiveSubtle },
  active:      { fg: colors.statusActive,   bg: colors.statusActiveSubtle },
  pending:     { fg: colors.statusPending,  bg: colors.statusPendingSubtle },
  under_review:{ fg: colors.statusPending,  bg: colors.statusPendingSubtle },
  draft:       { fg: colors.ink3,           bg: colors.parchment2 },
  rejected:    { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
  void:        { fg: colors.ink3,           bg: colors.parchment2 },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] ?? { fg: colors.ink3, bg: colors.parchment2 };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: '10px',
        fontWeight: 500,
        fontFamily: typography.fontFamily,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: s.fg,
        backgroundColor: s.bg,
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Big Number ──────────────────────────────────────────────

function BigNumber({
  label,
  value,
  showDot = false,
  muted = false,
}: {
  label: string;
  value: string;
  showDot?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        {showDot && <OrangeDot size={7} label="attention" />}
        <Eyebrow color="muted">{label}</Eyebrow>
      </div>
      <div
        style={{
          fontFamily: typography.fontFamilySerif,
          fontSize: '36px',
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: muted ? colors.ink3 : colors.ink,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Budget Bar ──────────────────────────────────────────────

function BudgetBar({
  total,
  spent,
  committed,
}: {
  total: number;
  spent: number;
  committed: number;
}) {
  if (!total || total === 0) return null;

  const spentPct     = Math.min(100, (spent / total) * 100);
  const committedPct = Math.min(100 - spentPct, (committed / total) * 100);
  const remainPct    = Math.max(0, 100 - spentPct - committedPct);

  return (
    <div>
      {/* Bar */}
      <div
        style={{
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
          display: 'flex',
          backgroundColor: colors.parchment2,
        }}
      >
        {spentPct > 0 && (
          <div
            style={{
              width: `${spentPct}%`,
              backgroundColor: colors.ink,
              transition: transitions.smooth,
            }}
          />
        )}
        {committedPct > 0 && (
          <div
            style={{
              width: `${committedPct}%`,
              backgroundColor: colors.ink3,
              transition: transitions.smooth,
            }}
          />
        )}
        {remainPct > 0 && (
          <div
            style={{
              width: `${remainPct}%`,
              backgroundColor: colors.parchment3,
              transition: transitions.smooth,
            }}
          />
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          marginTop: 10,
        }}
      >
        {[
          { label: 'Spent',     pct: spentPct,     color: colors.ink  },
          { label: 'Committed', pct: committedPct, color: colors.ink3 },
          { label: 'Remaining', pct: remainPct,    color: colors.parchment3 },
        ].map(({ label, pct, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: color,
                border: color === colors.parchment3 ? `1px solid ${colors.hairline}` : 'none',
                flexShrink: 0,
              }}
            />
            <Eyebrow color="muted">{label} {pct.toFixed(0)}%</Eyebrow>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The Ledger Page ─────────────────────────────────────────

const LedgerPage: React.FC = () => {
  const projectId = useProjectId();
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();

  const [showCreateCO, setShowCreateCO] = useState(false);

  useEffect(() => { setPageContext('ledger'); }, [setPageContext]);

  // ── Data (hooks must be called before any early return) ───
  const { data: project } = useProject(projectId);
  const { data: metrics, isPending: metricsLoading } = useProjectMetrics(projectId);
  const { data: budgetData, isPending: budgetLoading } = useBudgetItems(projectId);
  const { data: changeOrderData, isPending: coLoading } = useChangeOrders(projectId);
  const { data: contractData } = useContracts(projectId);
  const { data: payAppData } = usePayApplications(projectId);

  if (!projectId) return <ProjectGate />;

  // ── Data arrays ─────────────────────────────────────────
  const budgetItems = useMemo(
    () => (budgetData ?? []) as Array<{
      id: string; name: string; category: string;
      budgeted_amount: number; actual_amount: number;
      committed_amount: number; status: string;
    }>,
    [budgetData]
  );

  const changeOrders = useMemo(
    () => (changeOrderData ?? []) as Array<{
      id: string; number: string | number; title: string;
      amount: number; status: string; created_at: string;
    }>,
    [changeOrderData]
  );

  const contracts = useMemo(
    () => (contractData ?? []) as Array<{
      id: string; name: string; vendor_name: string;
      contract_value: number; status: string;
    }>,
    [contractData]
  );

  const _payApps = useMemo(
    () => (payAppData ?? []) as Array<{
      id: string; app_number: number; period_to: string;
      current_payment_due: number; status: string;
    }>,
    [payAppData]
  );
  void _payApps;

  // ── Derived values — prefer live data, fallback to metrics ──
  const budgetTotal = useMemo(() => {
    const fromItems = budgetItems.reduce((sum, b) => sum + (b.budgeted_amount ?? 0), 0);
    return fromItems > 0 ? fromItems : (metrics?.budget_total ?? 0);
  }, [budgetItems, metrics]);

  const budgetSpent = useMemo(() => {
    const fromItems = budgetItems.reduce((sum, b) => sum + (b.actual_amount ?? 0), 0);
    return fromItems > 0 ? fromItems : (metrics?.budget_spent ?? 0);
  }, [budgetItems, metrics]);

  const budgetCommitted = useMemo(() => {
    const fromItems = budgetItems.reduce((sum, b) => sum + (b.committed_amount ?? 0), 0);
    return fromItems > 0 ? fromItems : (metrics?.budget_committed ?? 0);
  }, [budgetItems, metrics]);

  const budgetRemaining = budgetTotal - budgetSpent;
  const spentPct        = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;
  const showBudgetDot   = spentPct > 90;

  // ── Change order exposure ─────────────────────────────────
  const pendingCOs = useMemo(
    () => changeOrders.filter((co) => co.status === 'pending' || co.status === 'under_review'),
    [changeOrders]
  );
  const pendingCOTotal = useMemo(
    () => pendingCOs.reduce((sum, co) => sum + (co.amount ?? 0), 0),
    [pendingCOs]
  );

  // ── Recent 5 COs ─────────────────────────────────────────
  const recentCOs = useMemo(
    () =>
      [...changeOrders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [changeOrders]
  );

  // ── Top 5 contracts by value ──────────────────────────────
  const topContracts = useMemo(
    () =>
      [...contracts]
        .sort((a, b) => (b.contract_value ?? 0) - (a.contract_value ?? 0))
        .slice(0, 5),
    [contracts]
  );
  const contractsTotal = useMemo(
    () => contracts.reduce((sum, c) => sum + (c.contract_value ?? 0), 0),
    [contracts]
  );

  const isLoading = metricsLoading || budgetLoading || coLoading;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
        backgroundColor: colors.parchment,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: isMobile ? '16px 16px 0' : '36px 36px 0',
          paddingBottom: 80,
        }}
      >
        {/* ── Compact Header ──────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: typography.fontFamilySerif, fontSize: isMobile ? '20px' : '24px', color: colors.ink, lineHeight: 1.2 }}>
              The Ledger
            </span>
            <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
              {project?.name ?? 'Project'}
            </span>
          </div>
          <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
            {isOnline ? 'Live' : 'Offline'}
          </span>
        </div>

        <PageState
          status={isLoading ? 'loading' : 'ready'}
          loading={{ rows: 3 }}
        >
          {/* Big three numbers */}
          <div
            style={{
              display: 'flex',
              gap: isMobile ? 24 : 48,
              flexWrap: 'wrap',
              marginBottom: 28,
            }}
          >
            <BigNumber
              label="Budget total"
              value={budgetTotal ? formatCurrency(budgetTotal) : '—'}
            />
            <BigNumber
              label="Spent"
              value={budgetSpent ? formatCurrency(budgetSpent) : '—'}
              showDot={showBudgetDot}
            />
            <BigNumber
              label="Remaining"
              value={budgetTotal ? formatCurrency(budgetRemaining) : '—'}
              muted={budgetRemaining <= 0}
            />
          </div>

          {/* Budget bar */}
          {budgetTotal > 0 && (
            <BudgetBar
              total={budgetTotal}
              spent={budgetSpent}
              committed={budgetCommitted}
            />
          )}
        </PageState>

        {/* ── Change Order Exposure ──────────────────────── */}

        <div
          style={{
            backgroundColor: colors.parchment2,
            border: `1px solid ${colors.hairline}`,
            borderRadius: 8,
            padding: isMobile ? '20px 16px' : '24px 28px',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              marginBottom: pendingCOs.length > 0 ? 20 : 0,
            }}
          >
            {pendingCOs.length > 0 && (
              <OrangeDot size={8} label={`${pendingCOs.length} pending change orders`} style={{ marginTop: 6 }} />
            )}
            <div>
              <div
                style={{
                  fontFamily: typography.fontFamilySerif,
                  fontSize: '28px',
                  fontWeight: 400,
                  letterSpacing: '-0.018em',
                  color: colors.ink,
                  lineHeight: 1.15,
                }}
              >
                {pendingCOs.length > 0
                  ? formatCurrency(pendingCOTotal)
                  : '—'}
              </div>
              <div style={{ marginTop: 4 }}>
                <Eyebrow color="muted">
                  {pendingCOs.length} pending change order{pendingCOs.length !== 1 ? 's' : ''}
                </Eyebrow>
              </div>
            </div>
          </div>

          {pendingCOs.length > 0 && (
            <div>
              {pendingCOs.map((co, i) => (
                <React.Fragment key={co.id}>
                  {i > 0 && (
                    <div
                      style={{
                        borderTop: `1px solid ${colors.hairline}`,
                        margin: '0',
                      }}
                    />
                  )}
                  <a
                    href="#/change-orders"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      textDecoration: 'none',
                      color: 'inherit',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <Eyebrow color="muted" style={{ flexShrink: 0 }}>
                        CO-{String(co.number).padStart(3, '0')}
                      </Eyebrow>
                      <span
                        style={{
                          fontFamily: typography.fontFamily,
                          fontSize: '13px',
                          color: colors.ink2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {co.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <StatusBadge status={co.status} />
                      <span
                        style={{
                          fontFamily: typography.fontFamilySerif,
                          fontSize: '15px',
                          color: colors.ink,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {co.amount != null ? formatCurrency(co.amount) : '—'}
                      </span>
                    </div>
                  </a>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* ── Recent Change Orders ──────────────────────── */}
        <Eyebrow style={{ marginBottom: 12, marginTop: 24 }}>Recent Change Orders</Eyebrow>

        {recentCOs.length === 0 ? (
          <p
            style={{
              fontFamily: typography.fontFamilySerif,
              fontSize: '17px',
              color: colors.ink3,
              fontStyle: 'italic',
              marginBottom: 32,
            }}
          >
            No change orders recorded.
          </p>
        ) : (
          <div style={{ marginBottom: 32 }}>
            {recentCOs.map((co, i) => (
              <React.Fragment key={co.id}>
                {i > 0 && <div style={{ borderTop: `1px solid ${colors.hairline}` }} />}
                <a
                  href="#/change-orders"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 0',
                    textDecoration: 'none',
                    color: 'inherit',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Eyebrow color="muted" style={{ flexShrink: 0 }}>
                      #{String(co.number).padStart(3, '0')}
                    </Eyebrow>
                    <span
                      style={{
                        fontFamily: typography.fontFamily,
                        fontSize: '14px',
                        color: colors.ink,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {co.title}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flexShrink: 0,
                    }}
                  >
                    <StatusBadge status={co.status} />
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontSize: '16px',
                        color: colors.ink,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {co.amount != null ? formatCurrency(co.amount) : '—'}
                    </span>
                  </div>
                </a>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Active Contracts ───────────────────────────── */}
        <Eyebrow style={{ marginBottom: 12, marginTop: 24 }}>Active Contracts</Eyebrow>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontFamily: typography.fontFamilySerif,
              fontSize: '28px',
              fontWeight: 400,
              letterSpacing: '-0.018em',
              color: colors.ink,
            }}
          >
            {contractsTotal > 0 ? formatCurrency(contractsTotal) : '—'}
          </span>
          <Eyebrow color="muted">
            across {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
          </Eyebrow>
        </div>

        {topContracts.length === 0 ? (
          <p
            style={{
              fontFamily: typography.fontFamilySerif,
              fontSize: '17px',
              color: colors.ink3,
              fontStyle: 'italic',
              marginBottom: 32,
            }}
          >
            No contracts recorded.
          </p>
        ) : (
          <div style={{ marginBottom: 32 }}>
            {topContracts.map((c, i) => (
              <React.Fragment key={c.id}>
                {i > 0 && <div style={{ borderTop: `1px solid ${colors.hairline}` }} />}
                <a
                  href="#/contracts"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 0',
                    textDecoration: 'none',
                    color: 'inherit',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: typography.fontFamily,
                        fontSize: '14px',
                        color: colors.ink,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: 2,
                      }}
                    >
                      {c.name}
                    </div>
                    <Eyebrow color="muted">{c.vendor_name}</Eyebrow>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flexShrink: 0,
                    }}
                  >
                    <StatusBadge status={c.status} />
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontSize: '16px',
                        color: colors.ink,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {c.contract_value != null ? formatCurrency(c.contract_value) : '—'}
                    </span>
                  </div>
                </a>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Quick Links ─────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 24,
            marginBottom: 56,
          }}
        >
          {[
            { href: '#/budget', label: 'Budget' },
            { href: '#/change-orders', label: 'Change Orders' },
            { href: '#/pay-apps', label: 'Pay Apps' },
            { href: '#/contracts', label: 'Contracts' },
          ].map(({ href, label }) => (
            <a key={href} href={href} style={{
              fontFamily: typography.fontFamily, fontSize: '12px', fontWeight: 500,
              color: colors.ink3, textDecoration: 'none', padding: '6px 14px',
              borderRadius: 100, border: `1px solid ${colors.hairline2}`,
              transition: transitions.quick,
            }}>{label}</a>
          ))}
        </div>
      </div>

      {/* ── Quick-Create FAB ─────────────────────── */}
      <QuickCreateFAB
        onPrimaryAction={() => setShowCreateCO(true)}
      />

      {/* ── Create Change Order Modal ────────────── */}
      <CreateCOModalWrapper
        open={showCreateCO}
        onClose={() => setShowCreateCO(false)}
        projectId={projectId}
      />
    </div>
  );
};

// ── Create CO Modal Wrapper ──────────────────────────────────

const CreateCOModalWrapper: React.FC<{ open: boolean; onClose: () => void; projectId: string }> = ({ open, onClose, projectId }) => {
  const createCO = useCreateChangeOrder();
  const handleSubmit = async (data: Record<string, unknown>) => {
    await createCO.mutateAsync({ data: { ...data, project_id: projectId }, projectId });
    onClose();
  };
  return <CreateChangeOrderModal open={open} onClose={onClose} onSubmit={handleSubmit} />;
};

// ── Export ──────────────────────────────────────────────────

const Ledger: React.FC = () => (
  <ErrorBoundary>
    <LedgerPage />
  </ErrorBoundary>
);

export default Ledger;
