/**
 * The Conversation — "What is waiting on me?"
 *
 * Shape: Stream — a river of entries, response time as the spine.
 * Absorbs: RFIs + Submittals into one inbox.
 *
 * Principle #2: A workflow is not a navigation item.
 * RFIs and Submittals belong inside one inbox, not two destinations.
 * The orange dot is on the item waiting on you.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { useCopilotStore } from '../../stores/copilotStore';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject, useRFIs, useSubmittals } from '../../hooks/queries';
import { useChangeOrders } from '../../hooks/queries/change-orders';
import { usePunchItems } from '../../hooks/queries/punch-items';
import { InboxRow as ExternalInboxRow, type InboxItem as InboxItemBase } from '../../components/conversation/InboxRow';
import { calculateSlaState, compareSlaStateMostBrokenFirst } from '../../lib/slaCalculator';
import { useAuthStore } from '../../stores/authStore';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { colors, typography, transitions } from '../../styles/theme';
import {
  OrangeDot,
  Eyebrow,
  SectionHeading,
} from '../../components/atoms';
import {
  WifiOff, ChevronRight, HelpCircle, Send, FileEdit, ListChecks, ClipboardList, ListTodo,
  AlertTriangle, CheckCircle, Sparkles,
} from 'lucide-react';
import { RFIActionPanel } from '../../components/panels/RFIActionPanel';
import { SubmittalActionPanel } from '../../components/panels/SubmittalActionPanel';
import { QuickCreateFAB } from '../../components/QuickCreateFAB';
import CreateRFIModal from '../../components/forms/CreateRFIModal';
import CreateSubmittalModal from '../../components/forms/CreateSubmittalModal';
import CreateChangeOrderModal from '../../components/forms/CreateChangeOrderModal';
import CreatePunchItemModal from '../../components/forms/CreatePunchItemModal';
import CreateDailyLogModal from '../../components/forms/CreateDailyLogModal';
import CreateTaskModal from '../../components/forms/CreateTaskModal';
import { useCreateRFI } from '../../hooks/mutations/rfis';
import { useCreateSubmittal } from '../../hooks/mutations/submittals';
import { useCreateChangeOrder } from '../../hooks/mutations/change-orders';
import { useCreatePunchItem } from '../../hooks/mutations/punch-items';
import { useCreateDailyLog } from '../../hooks/mutations/daily-logs';
import { useCreateTask } from '../../hooks/mutations/tasks';
import { useIrisDrafts } from '../../hooks/useIrisDrafts';
import { IrisApprovalGate } from '../../components/iris/IrisApprovalGate';
import { approveAndExecute, rejectDraft } from '../../services/iris/executeAction';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DraftedAction } from '../../types/draftedActions';

// ── Types ─────────────────────────────────────────────────

type ConversationView = 'all' | 'rfis' | 'submittals' | 'change_orders' | 'punch';
type WaitingFilter = 'all' | 'me' | 'other';

// Re-export from the unified inbox-row component so the rest of the page
// can keep using the bare `InboxItem` name unchanged.
type InboxItem = InboxItemBase & { overdue: boolean };

// ── The Conversation Page ────────────────────────────────────

const ConversationPage: React.FC = () => {
  const projectId = useProjectId();
  useProject(projectId);
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => { setPageContext('conversation'); }, [setPageContext]);

  const [activeView, setActiveView] = useState<ConversationView>('all');
  const [waitingFilter, setWaitingFilter] = useState<WaitingFilter>('all');
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [showCreateRFI, setShowCreateRFI] = useState(false);
  const [showCreateSubmittal, setShowCreateSubmittal] = useState(false);
  const [showCreateChangeOrder, setShowCreateChangeOrder] = useState(false);
  const [showCreatePunch, setShowCreatePunch] = useState(false);
  const [showCreateDailyLog, setShowCreateDailyLog] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  // ── Data ────────────────────────────────────────────────
  const { data: rfiData, isPending: rfisLoading } = useRFIs(projectId);
  const { data: submittalData, isPending: submittalsLoading } = useSubmittals(projectId);
  const { data: changeOrderData, isPending: changeOrdersLoading } = useChangeOrders(projectId);
  const { data: punchData, isPending: punchLoading } = usePunchItems(projectId);
  const { data: drafts } = useIrisDrafts(projectId);
  const qc = useQueryClient();
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);

  const rfis = useMemo(() => (rfiData?.data ?? []) as Record<string, unknown>[], [rfiData]);
  const submittals = useMemo(() => (submittalData?.data ?? []) as Record<string, unknown>[], [submittalData]);
  const changeOrders = useMemo(() => (changeOrderData ?? []) as Record<string, unknown>[], [changeOrderData]);
  const punchItems = useMemo(() => (punchData?.data ?? []) as Record<string, unknown>[], [punchData]);

  // ── Iris drafts (waiting on you to approve) ───────────
  const pendingDrafts = useMemo(
    () => (drafts ?? []).filter((d) => d.status === 'pending'),
    [drafts],
  );

  const handleApproveDraft = useCallback(async (draft: DraftedAction) => {
    if (!user?.id) { toast.error('Sign in required'); return; }
    setBusyDraftId(draft.id);
    const result = await approveAndExecute({ draftId: draft.id, decided_by: user.id });
    setBusyDraftId(null);
    if (result.ok) {
      // Invalidate everything the executor may have written so the inbox refreshes.
      // Keep this list in sync with src/services/iris/executors/* — each executor
      // writes to one of these query keys.
      qc.invalidateQueries({ queryKey: ['drafted_actions'] });
      qc.invalidateQueries({ queryKey: ['rfis'] });
      qc.invalidateQueries({ queryKey: ['submittals'] });
      qc.invalidateQueries({ queryKey: ['daily_logs'] });
      qc.invalidateQueries({ queryKey: ['payment_applications'] });
      qc.invalidateQueries({ queryKey: ['punch_items'] });
      qc.invalidateQueries({ queryKey: ['transmittals'] });
      toast.success(`${actionLabel(draft.action_type)} sent`);
    } else {
      toast.error(result.error ?? 'Failed to execute');
    }
  }, [user?.id, qc]);

  const handleRejectDraft = useCallback(async (draft: DraftedAction) => {
    if (!user?.id) { toast.error('Sign in required'); return; }
    setBusyDraftId(draft.id);
    const result = await rejectDraft({ draftId: draft.id, decided_by: user.id });
    setBusyDraftId(null);
    if (result.ok) {
      qc.invalidateQueries({ queryKey: ['drafted_actions'] });
      toast.success('Draft rejected');
    } else {
      toast.error(result.error ?? 'Failed to reject');
    }
  }, [user?.id, qc]);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Build unified inbox ────────────────────────────────
  // Aggregates RFIs + Submittals + Change Orders + Punch into one list,
  // each row carrying enough state for the SLA-driven sort to work.
  const inboxItems = useMemo<InboxItem[]>(() => {
    const items: InboxItem[] = [];
    const isOverdue = (dueDate: string, terminal: ReadonlyArray<string>, status: string) =>
      dueDate ? dueDate.split('T')[0] < todayStr && !terminal.includes(status) : false;

    for (const rfi of rfis) {
      const status = (rfi.status as string) ?? 'open';
      const dueDate = (rfi.response_due_date as string) ?? (rfi.due_date as string) ?? '';
      items.push({
        id: `rfi-${rfi.id}`,
        type: 'rfi',
        number: (rfi.number as number) ?? '',
        title: (rfi.subject as string) ?? (rfi.title as string) ?? 'RFI',
        status,
        assignee: displayAssignee((rfi.ball_in_court as string) ?? (rfi.assigned_to as string) ?? ''),
        dueDate,
        createdAt: (rfi.created_at as string) ?? '',
        waitingOnYou: ['open', 'under_review', 'draft'].includes(status),
        overdue: isOverdue(dueDate, ['closed', 'answered', 'void'], status),
        pausedAt: (rfi.sla_paused_at as string | null) ?? null,
        approvalChain: rfi.approval_chain ?? null,
        data: rfi,
      });
    }

    for (const sub of submittals) {
      const status = (sub.status as string) ?? 'draft';
      const dueDate = (sub.due_date as string) ?? '';
      items.push({
        id: `sub-${sub.id}`,
        type: 'submittal',
        number: (sub.number as number) ?? (sub.spec_section as string) ?? '',
        title: (sub.title as string) ?? (sub.description as string) ?? 'Submittal',
        status,
        assignee: displayAssignee((sub.assigned_to as string) ?? (sub.subcontractor as string) ?? ''),
        dueDate,
        createdAt: (sub.created_at as string) ?? '',
        waitingOnYou: ['pending', 'under_review'].includes(status),
        overdue: isOverdue(dueDate, ['approved', 'rejected'], status),
        approvalChain: sub.approval_chain ?? null,
        data: sub,
      });
    }

    for (const co of changeOrders) {
      const status = (co.status as string) ?? 'draft';
      // Change orders have no formal SLA window in the schema; we use
      // requested_date + 14 days as a lightweight default (most owner CO
      // review windows are 14 days). The escalator can override later.
      const requested = (co.requested_date as string) ?? '';
      const dueDate = requested
        ? new Date(new Date(requested).getTime() + 14 * 86_400_000).toISOString().slice(0, 10)
        : '';
      items.push({
        id: `co-${co.id}`,
        type: 'change_order',
        number: (co.number as number) ?? '',
        title: (co.title as string) ?? (co.description as string) ?? 'Change Order',
        status,
        assignee: displayAssignee((co.requested_by as string) ?? ''),
        dueDate,
        createdAt: (co.created_at as string) ?? '',
        waitingOnYou: ['draft', 'pending_review'].includes(status),
        overdue: isOverdue(dueDate, ['approved', 'rejected', 'void'], status),
        approvalChain: co.approval_chain ?? null,
        data: co,
      });
    }

    for (const p of punchItems) {
      const status = (p.status as string) ?? 'open';
      const dueDate = (p.due_date as string) ?? '';
      items.push({
        id: `punch-${p.id}`,
        type: 'punch',
        number: (p.number as number) ?? '',
        title: (p.title as string) ?? 'Punch item',
        status,
        assignee: displayAssignee((p.assigned_to as string) ?? ''),
        dueDate,
        createdAt: (p.created_at as string) ?? '',
        waitingOnYou: ['open', 'in_progress', 'resolved'].includes(status),
        overdue: isOverdue(dueDate, ['verified'], status),
        approvalChain: p.approval_chain ?? null,
        data: p,
      });
    }

    // SLA-clock-most-broken-first. Pre-compute SLA state once per item.
    const slaCache = new Map<string, ReturnType<typeof calculateSlaState>>();
    for (const it of items) {
      slaCache.set(it.id, calculateSlaState({ dueDate: it.dueDate, pausedAt: it.pausedAt }));
    }
    items.sort((a, b) => {
      const aS = slaCache.get(a.id)!;
      const bS = slaCache.get(b.id)!;
      const slaCmp = compareSlaStateMostBrokenFirst(aS, bS);
      if (slaCmp !== 0) return slaCmp;
      // Tie-break: waiting-on-you > waiting-on-other; then newer first.
      if (a.waitingOnYou !== b.waitingOnYou) return a.waitingOnYou ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return items;
  }, [rfis, submittals, changeOrders, punchItems, todayStr]);

  // ── Filter ─────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let out = inboxItems;
    if (activeView !== 'all') {
      const typeFor: Record<Exclude<ConversationView, 'all'>, InboxItem['type']> = {
        rfis: 'rfi',
        submittals: 'submittal',
        change_orders: 'change_order',
        punch: 'punch',
      };
      const t = typeFor[activeView];
      out = out.filter((i) => i.type === t);
    }
    if (waitingFilter === 'me') out = out.filter((i) => i.waitingOnYou);
    else if (waitingFilter === 'other') out = out.filter((i) => !i.waitingOnYou);
    return out;
  }, [inboxItems, activeView, waitingFilter]);

  const waitingCount = inboxItems.filter((i) => i.waitingOnYou).length;
  const overdueCount = inboxItems.filter((i) => i.overdue).length;
  const isLoading = rfisLoading || submittalsLoading || changeOrdersLoading || punchLoading;

  if (!projectId) return <ProjectGate />;

  return (
    <ErrorBoundary>
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
          }}
        >
          {/* ── Header + Stats ───────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontFamily: typography.fontFamilySerif, fontSize: isMobile ? '20px' : '24px', color: colors.ink }}>
              Inbox
            </span>
            {!isOnline && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: typography.fontFamily, fontSize: '11px', color: colors.ink4 }}>
                <WifiOff size={11} /> Offline
              </span>
            )}
          </div>

          {/* ── Summary counts ──────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            {waitingCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <OrangeDot size={7} haloSpread={2} />
                <span style={{ fontFamily: typography.fontFamily, fontSize: '13px', fontWeight: 500, color: colors.ink2 }}>
                  {waitingCount} waiting on you
                </span>
              </div>
            )}
            {overdueCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={13} style={{ color: colors.statusCritical }} />
                <span style={{ fontFamily: typography.fontFamily, fontSize: '13px', fontWeight: 500, color: colors.statusCritical }}>
                  {overdueCount} overdue
                </span>
              </div>
            )}
            {pendingDrafts.length > 0 && (
              <a
                href="#/iris/inbox"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <Sparkles size={13} style={{ color: '#7C5DC7' }} />
                <span style={{ fontFamily: typography.fontFamily, fontSize: '13px', fontWeight: 500, color: '#7C5DC7' }}>
                  Iris drafted {pendingDrafts.length}
                </span>
              </a>
            )}
          </div>

          {/* ── Iris drafted-action stack ────────────── */}
          {/* The decision moment: Iris hands the user pre-drafted actions
              cited to project evidence. One click sends. The audit trail
              is captured automatically via the executor. */}
          {pendingDrafts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={14} style={{ color: '#7C5DC7' }} />
                  <Eyebrow style={{ fontSize: '10px' }}>
                    Iris drafted — review & send
                  </Eyebrow>
                </div>
                {pendingDrafts.length > 3 && (
                  <a
                    href="#/iris/inbox"
                    style={{
                      fontFamily: typography.fontFamily, fontSize: '11px', fontWeight: 500,
                      color: colors.ink4, textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}
                  >
                    View all {pendingDrafts.length}
                    <ChevronRight size={11} />
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingDrafts.slice(0, 3).map((draft) => (
                  <IrisApprovalGate
                    key={draft.id}
                    draft={draft}
                    busy={busyDraftId === draft.id}
                    onApprove={handleApproveDraft}
                    onReject={handleRejectDraft}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Quick Actions Row ─────────────────────
              Productivity-first: every create + every destination in one
              row, not buried behind a FAB. The user said "no way to create
              anything or go to each page easily" — this fixes that. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {([
              { label: 'New RFI', icon: <HelpCircle size={13} />, onClick: () => setShowCreateRFI(true) },
              { label: 'New Submittal', icon: <Send size={13} />, onClick: () => setShowCreateSubmittal(true) },
              { label: 'New CO', icon: <FileEdit size={13} />, onClick: () => setShowCreateChangeOrder(true) },
              { label: 'New Punch', icon: <ListChecks size={13} />, onClick: () => setShowCreatePunch(true) },
              { label: 'New Daily Log', icon: <ClipboardList size={13} />, onClick: () => setShowCreateDailyLog(true) },
              { label: 'New Task', icon: <ListTodo size={13} />, onClick: () => setShowCreateTask(true) },
            ]).map((act) => (
              <button
                key={act.label}
                onClick={act.onClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  border: '1px solid var(--hairline-2)',
                  borderRadius: 8,
                  background: colors.parchment,
                  cursor: 'pointer',
                  fontFamily: typography.fontFamily,
                  fontSize: '12px',
                  fontWeight: 500,
                  color: colors.ink2,
                  transition: transitions.quick,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F47820'; e.currentTarget.style.color = '#F47820'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hairline-2)'; e.currentTarget.style.color = colors.ink2; }}
              >
                {act.icon}
                {act.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {([
              { path: '/rfis', label: 'RFIs' },
              { path: '/submittals', label: 'Submittals' },
              { path: '/change-orders', label: 'COs' },
              { path: '/punch-list', label: 'Punch' },
              { path: '/iris/inbox', label: 'Iris' },
            ]).map((dest) => (
              <button
                key={dest.path}
                onClick={() => navigate(dest.path)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: typography.fontFamily,
                  fontSize: '11px',
                  fontWeight: 500,
                  color: colors.ink3,
                  transition: transitions.quick,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = colors.ink; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = colors.ink3; }}
              >
                Open {dest.label}
                <ChevronRight size={11} />
              </button>
            ))}
          </div>

          {/* ── View Tabs + Awaiting Filters ──── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: `1px solid ${colors.hairline2}`, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: isMobile ? 0 : 4 }}>
              {([
                { id: 'all' as const, label: `All (${inboxItems.length})` },
                { id: 'rfis' as const, label: `RFIs (${rfis.length})` },
                { id: 'submittals' as const, label: `Submittals (${submittals.length})` },
                { id: 'change_orders' as const, label: `COs (${changeOrders.length})` },
                { id: 'punch' as const, label: `Punch (${punchItems.length})` },
              ]).map((tab) => {
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id)}
                    style={{
                      padding: isMobile ? '8px 12px' : '6px 14px',
                      border: 'none',
                      borderBottom: isActive ? '2px solid #F47820' : '2px solid transparent',
                      background: 'none',
                      cursor: 'pointer',
                      fontFamily: typography.fontFamily,
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? colors.ink : colors.ink3,
                      transition: transitions.quick,
                      whiteSpace: 'nowrap',
                      marginBottom: '-1px',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {([
                { id: 'all' as const, label: 'All' },
                { id: 'me' as const, label: 'Awaiting me' },
                { id: 'other' as const, label: 'Awaiting other' },
              ]).map((chip) => {
                const active = waitingFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setWaitingFilter(chip.id)}
                    aria-pressed={active}
                    style={{
                      padding: '4px 10px',
                      border: `1px solid ${active ? '#F47820' : 'var(--hairline-2)'}`,
                      borderRadius: 999,
                      background: active ? 'rgba(244,120,32,0.08)' : 'transparent',
                      cursor: 'pointer',
                      fontFamily: typography.fontFamily,
                      fontSize: '11px',
                      fontWeight: active ? 600 : 500,
                      color: active ? '#F47820' : colors.ink3,
                      transition: transitions.quick,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Inbox Content ────────────────────────── */}
          {isLoading ? (
            <PageState status="loading" />
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <CheckCircle size={32} style={{ color: colors.ink4, marginBottom: 12 }} />
              <SectionHeading level={3} style={{ marginBottom: 8 }}>
                Inbox is <em>clear</em>
              </SectionHeading>
              <p style={{ fontFamily: typography.fontFamilySerif, fontStyle: 'italic', fontSize: '15px', color: colors.ink3 }}>
                Nothing waiting on you. A rare moment of quiet.
              </p>
            </div>
          ) : (
            <div>
              {filteredItems.map((item) => (
                <ExternalInboxRow
                  key={item.id}
                  item={item}
                  onSelect={(i) => {
                    // RFIs and Submittals open the slide-over panel inline
                    // (fast triage). COs and Punch items go to their full
                    // detail page where the multi-party approval chain UI
                    // and full edit affordances live.
                    const it = i as InboxItem;
                    if (it.type === 'rfi' || it.type === 'submittal') {
                      setSelectedItem(it);
                    } else if (it.type === 'change_order') {
                      const id = (it.data.id as string) ?? '';
                      navigate(`/change-orders${id ? `/${id}` : ''}`);
                    } else if (it.type === 'punch') {
                      const id = (it.data.id as string) ?? '';
                      navigate(`/punch-list${id ? `/${id}` : ''}`);
                    }
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ height: 64 }} />
        </div>

        {/* ── Slide-Over Panels ────────────────────── */}
        {selectedItem?.type === 'rfi' && (
          <RFIActionPanel
            open={true}
            onClose={() => setSelectedItem(null)}
            rfi={selectedItem.data as any}
          />
        )}
        {selectedItem?.type === 'submittal' && (
          <SubmittalActionPanel
            open={true}
            onClose={() => setSelectedItem(null)}
            submittal={selectedItem.data as any}
          />
        )}
      </div>

      {/* ── Quick-Create FAB ─────────────────────── */}
      <QuickCreateFAB
        options={[
          { id: 'new-rfi', label: 'New RFI', icon: <HelpCircle size={16} />, onClick: () => setShowCreateRFI(true) },
          { id: 'new-submittal', label: 'New Submittal', icon: <Send size={16} />, onClick: () => setShowCreateSubmittal(true) },
          { id: 'new-co', label: 'New Change Order', icon: <FileEdit size={16} />, onClick: () => setShowCreateChangeOrder(true) },
          { id: 'new-punch', label: 'New Punch Item', icon: <ListChecks size={16} />, onClick: () => setShowCreatePunch(true) },
          { id: 'new-daily', label: 'New Daily Log', icon: <ClipboardList size={16} />, onClick: () => setShowCreateDailyLog(true) },
          { id: 'new-task', label: 'New Task', icon: <ListTodo size={16} />, onClick: () => setShowCreateTask(true) },
        ]}
      />

      {/* ── Create Modals ────────────────────────── */}
      <CreateRFIModalWrapper open={showCreateRFI} onClose={() => setShowCreateRFI(false)} projectId={projectId} />
      <CreateSubmittalModalWrapper open={showCreateSubmittal} onClose={() => setShowCreateSubmittal(false)} projectId={projectId} />
      <CreateChangeOrderModalWrapper open={showCreateChangeOrder} onClose={() => setShowCreateChangeOrder(false)} projectId={projectId} />
      <CreatePunchItemModalWrapper open={showCreatePunch} onClose={() => setShowCreatePunch(false)} projectId={projectId} />
      <CreateDailyLogModalWrapper open={showCreateDailyLog} onClose={() => setShowCreateDailyLog(false)} projectId={projectId} />
      <CreateTaskModalWrapper open={showCreateTask} onClose={() => setShowCreateTask(false)} projectId={projectId} />
    </ErrorBoundary>
  );
};

// ── Inbox Row ───────────────────────────────────────────

// (Inline InboxRow removed — replaced by ../../components/conversation/InboxRow.)

// ── Helpers ─────────────────────────────────────────────

function actionLabel(t: DraftedAction['action_type']): string {
  switch (t) {
    case 'rfi.draft': return 'RFI';
    case 'daily_log.draft': return 'Daily log';
    case 'pay_app.draft': return 'Pay application';
    case 'punch_item.draft': return 'Punch item';
    case 'schedule.resequence': return 'Schedule resequence';
    case 'submittal.transmittal_draft': return 'Submittal transmittal';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hide raw UUIDs — they're not useful to a GC on their phone at 6am */
function displayAssignee(raw: string | undefined): string {
  if (!raw) return '';
  if (UUID_RE.test(raw)) return '';
  return raw;
}

function _formatShortDate(dateStr: string): string {
         void _formatShortDate;
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ── Create Modal Wrappers ─────────────────────────────────

const CreateRFIModalWrapper: React.FC<{ open: boolean; onClose: () => void; projectId: string }> = ({ open, onClose, projectId }) => {
  const createRFI = useCreateRFI();
  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    await createRFI.mutateAsync({ data: { ...data, project_id: projectId }, projectId });
    onClose();
  }, [createRFI, projectId, onClose]);
  return <CreateRFIModal open={open} onClose={onClose} onSubmit={handleSubmit} />;
};

const CreateSubmittalModalWrapper: React.FC<{ open: boolean; onClose: () => void; projectId: string }> = ({ open, onClose, projectId }) => {
  const createSubmittal = useCreateSubmittal();
  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    await createSubmittal.mutateAsync({ data: { ...data, project_id: projectId }, projectId });
    onClose();
  }, [createSubmittal, projectId, onClose]);
  return <CreateSubmittalModal open={open} onClose={onClose} onSubmit={handleSubmit} />;
};

const CreateChangeOrderModalWrapper: React.FC<{ open: boolean; onClose: () => void; projectId: string }> = ({ open, onClose, projectId }) => {
  const createCO = useCreateChangeOrder();
  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    await createCO.mutateAsync({ data: { ...data, project_id: projectId }, projectId });
    onClose();
  }, [createCO, projectId, onClose]);
  return <CreateChangeOrderModal open={open} onClose={onClose} onSubmit={handleSubmit} />;
};

const CreatePunchItemModalWrapper: React.FC<{ open: boolean; onClose: () => void; projectId: string }> = ({ open, onClose, projectId }) => {
  const createPunch = useCreatePunchItem();
  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    await createPunch.mutateAsync({ data: { ...data, project_id: projectId }, projectId });
    onClose();
  }, [createPunch, projectId, onClose]);
  return <CreatePunchItemModal open={open} onClose={onClose} onSubmit={handleSubmit} />;
};

const CreateDailyLogModalWrapper: React.FC<{ open: boolean; onClose: () => void; projectId: string }> = ({ open, onClose, projectId }) => {
  const createDL = useCreateDailyLog();
  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    await createDL.mutateAsync({ data: { ...data, project_id: projectId }, projectId });
    onClose();
  }, [createDL, projectId, onClose]);
  return <CreateDailyLogModal open={open} onClose={onClose} onSubmit={handleSubmit} />;
};

const CreateTaskModalWrapper: React.FC<{ open: boolean; onClose: () => void; projectId: string }> = ({ open, onClose, projectId }) => {
  const createTask = useCreateTask();
  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    await createTask.mutateAsync({ data: { ...data, project_id: projectId }, projectId });
    onClose();
  }, [createTask, projectId, onClose]);
  return <CreateTaskModal open={open} onClose={onClose} onSubmit={handleSubmit} />;
};

// ── Export ─────────────────────────────────────────────────

export default ConversationPage;
