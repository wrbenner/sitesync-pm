import React, { useState } from 'react';
import { FileCheck, Plus, Trash2, Send } from 'lucide-react';
import { PageContainer, MetricBox, Skeleton, Btn, Modal, InputField } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions, touchTarget } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useNavigate } from 'react-router-dom';
import { useLienWaivers, useCreateLienWaiver, useDeleteLienWaiver } from '../hooks/queries/lien-waivers';
import { toast } from 'sonner';
import {
  useCreateSignatureRequest,
  useSendForSignature,
  useAddSigner,
} from '../hooks/queries/signatures';
import { getSignerColorPalette } from '../services/signatureService';

type WaiverStateValue = 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final';
type WaiverFilterType = WaiverStateValue | 'all';
type StatusFilter = 'all' | 'pending' | 'signed';

const WAIVER_TYPE_LABELS: Record<WaiverStateValue, string> = {
  conditional_progress: 'Conditional Progress',
  unconditional_progress: 'Unconditional Progress',
  conditional_final: 'Conditional Final',
  unconditional_final: 'Unconditional Final',
};

function fmtDollars(n: number | null): string {
  if (n == null) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isSignedStatus(status: string): boolean {
  return status === 'received';
}

export function LienWaivers() {
  const projectId = useProjectId();
  const navigate = useNavigate();

  const { data: rawWaivers, isLoading: loading } = useLienWaivers(projectId);
  const createWaiver = useCreateLienWaiver();
  const deleteWaiver = useDeleteLienWaiver();
  const createSignatureRequest = useCreateSignatureRequest();
  const sendForSignature = useSendForSignature();
  const addSignerMutation = useAddSigner();

  // API endpoint maps columns to different names from the DB schema
  const waivers = (rawWaivers ?? []) as Array<Record<string, unknown>>;
  const [sendingSignatureId, setSendingSignatureId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<WaiverFilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hovered, setHovered] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [formContractor, setFormContractor] = useState('');
  const [formWaiverState, setFormWaiverState] = useState<WaiverStateValue>('conditional_progress');
  const [formAmount, setFormAmount] = useState('');
  const [formThroughDate, setFormThroughDate] = useState('');
  const [formStatus, setFormStatus] = useState('pending');
  const [formNotes, setFormNotes] = useState('');

  const resetForm = () => {
    setFormContractor('');
    setFormWaiverState('conditional_progress');
    setFormAmount('');
    setFormThroughDate('');
    setFormStatus('pending');
    setFormNotes('');
  };

  // Use the actual DB column names. The API endpoint maps them so we need to handle both naming conventions.
  const getWaiverState = (w: any): string => w.waiver_type ?? w.waiver_state ?? w.type ?? '';
  const getContractorName = (w: any): string => w.contractor_name ?? w.subcontractor_id ?? '';
  const getThroughDate = (w: any): string | null => w.through_date ?? w.payment_period ?? null;
  const getSignedAt = (w: any): string | null => w.signed_at ?? w.received_at ?? null;
  const getStatus = (w: any): string => w.status ?? 'pending';

  const filtered = waivers.filter((w) => {
    const ws = getWaiverState(w);
    if (typeFilter !== 'all' && ws !== typeFilter) return false;
    if (statusFilter === 'pending' && isSignedStatus(getStatus(w))) return false;
    if (statusFilter === 'signed' && !isSignedStatus(getStatus(w))) return false;
    return true;
  });

  const totalCount = waivers.length;
  const pendingCount = waivers.filter((w) => !isSignedStatus(getStatus(w))).length;
  const signedCount = waivers.filter((w) => isSignedStatus(getStatus(w))).length;
  const missingCount = waivers.filter((w) => getStatus(w) === 'missing').length;

  const handleCreate = async () => {
    if (!projectId) return;
    if (!formContractor.trim()) {
      toast.error('Contractor name is required');
      return;
    }
    try {
      await createWaiver.mutateAsync({
        project_id: projectId,
        contractor_name: formContractor.trim(),
        waiver_state: formWaiverState,
        amount: formAmount ? parseFloat(formAmount) : null,
        through_date: formThroughDate || null,
        status: formStatus,
        notes: formNotes || null,
      });
      setShowCreate(false);
      resetForm();
    } catch {
      // toast handled by hook
    }
  };

  const handleDelete = async (w: any) => {
    if (!projectId) return;
    const label = getContractorName(w) || 'this waiver';
    if (!window.confirm(`Delete waiver for "${label}"? This cannot be undone.`)) return;
    try {
      await deleteWaiver.mutateAsync({ id: w.id, projectId });
    } catch {
      // toast handled by hook
    }
  };

  const handleSendForSignature = async (w: any) => {
    if (!projectId) return;
    const vendor = getContractorName(w) || 'Unknown Vendor';
    setSendingSignatureId(w.id);
    try {
      const waiverState = getWaiverState(w);
      const label = WAIVER_TYPE_LABELS[waiverState as WaiverStateValue] ?? waiverState;
      const request = await createSignatureRequest.mutateAsync({
        project_id: projectId,
        title: `Lien Waiver — ${label} — ${vendor}`,
        source_file_url: `lien-waiver://${w.id}`,
        signing_order: 'parallel',
        metadata: { lien_waiver_id: w.id, signer_count: 1 },
      });
      const palette = getSignerColorPalette();
      await addSignerMutation.mutateAsync({
        request_id: request.id,
        signer_name: vendor,
        signer_email: `${vendor.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`,
        signing_order_index: 0,
        color_code: palette[0],
      });
      await sendForSignature.mutateAsync({
        request_id: request.id,
        project_id: projectId,
      });
      toast.success(`Lien waiver sent to ${vendor} for signature`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send for signature');
    } finally {
      setSendingSignatureId(null);
    }
  };

  const colWidths = ['18%', '16%', '11%', '12%', '9%', '11%', '23%'];
  const colHeaders = ['Vendor', 'Waiver Type', 'Amount Waived', 'Period Through', 'Status', 'Signed Date', 'Actions'];

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: `${spacing['3']} ${spacing['4']}`,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    fontSize: typography.fontSize.body,
    color: colors.textPrimary,
    padding: `0 ${spacing['4']}`,
    verticalAlign: 'middle',
  };

  return (
    <PageContainer
      title="Lien Waivers"
      subtitle="Track conditional and unconditional lien waivers from subcontractors and vendors."
      actions={
        <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          New Waiver
        </Btn>
      }
    >
      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing['5'],
          marginBottom: spacing['8'],
        }}
      >
        <MetricBox
          label="Total Waivers"
          value={loading ? '—' : totalCount}
        />
        <MetricBox
          label="Pending Signature"
          value={loading ? '—' : pendingCount}
          colorOverride={pendingCount > 0 ? 'warning' : undefined}
        />
        <MetricBox
          label="Signed This Period"
          value={loading ? '—' : signedCount}
          colorOverride={signedCount > 0 ? 'success' : undefined}
        />
        <MetricBox
          label="Missing Waivers"
          value={loading ? '—' : missingCount}
          colorOverride={missingCount > 0 ? 'danger' : undefined}
        />
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['4'],
          marginBottom: spacing['5'],
        }}
      >
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as WaiverFilterType)}
          aria-label="Filter by waiver type"
          style={{
            fontSize: typography.fontSize.body,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            padding: `0 ${spacing['3']}`,
            cursor: 'pointer',
            outline: 'none',
            minHeight: touchTarget.field,
          }}
        >
          <option value="all">All Types</option>
          {(Object.keys(WAIVER_TYPE_LABELS) as WaiverStateValue[]).map((t) => (
            <option key={t} value={t}>{WAIVER_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* Status toggle */}
        <div
          role="group"
          aria-label="Filter by status"
          style={{
            display: 'flex',
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.md,
            padding: 2,
            gap: 2,
          }}
        >
          {(['all', 'pending', 'signed'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                padding: `0 ${spacing['4']}`,
                minHeight: touchTarget.field,
                borderRadius: borderRadius.base,
                border: 'none',
                cursor: 'pointer',
                transition: transitions.quick,
                backgroundColor: statusFilter === s ? colors.surfaceRaised : 'transparent',
                color: statusFilter === s ? colors.textPrimary : colors.textTertiary,
                boxShadow: statusFilter === s ? shadows.sm : 'none',
                fontFamily: typography.fontFamily,
              }}
            >
              {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : 'Signed'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: shadows.card,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              {colHeaders.map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {colWidths.map((_, j) => (
                    <td key={j} style={{ ...tdStyle, height: touchTarget.field }}>
                      <Skeleton
                        width={j === 1 ? '70%' : j === 2 ? '55%' : '80%'}
                        height="14px"
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: spacing['16'],
                    textAlign: 'center',
                    verticalAlign: 'middle',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: spacing['4'],
                    }}
                  >
                    <FileCheck size={36} color={colors.textTertiary} strokeWidth={1.5} />
                    <p
                      style={{
                        fontSize: typography.fontSize.body,
                        color: colors.textSecondary,
                        margin: 0,
                        maxWidth: 420,
                        lineHeight: 1.6,
                      }}
                    >
                      No lien waivers for this period. Click "New Waiver" to create one, or waivers are generated automatically when pay applications are approved.
                    </p>
                    <Btn
                      variant="secondary"
                      onClick={() => navigate('/pay-apps')}
                    >
                      View Pay Applications
                    </Btn>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((w) => {
                const status = getStatus(w);
                const signed = isSignedStatus(status);
                const isMissing = status === 'missing';
                const isHovered = hovered === w.id;
                const waiverState = getWaiverState(w);

                return (
                  <tr
                    key={w.id}
                    onMouseEnter={() => setHovered(w.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      height: touchTarget.field,
                      cursor: 'pointer',
                      backgroundColor: isHovered ? colors.surfaceHover : 'transparent',
                      transition: transitions.quick,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                    }}
                  >
                    {/* Vendor */}
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: typography.fontSize.body,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textPrimary,
                        }}
                      >
                        {getContractorName(w) || 'Unknown Vendor'}
                      </span>
                    </td>

                    {/* Waiver Type */}
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textSecondary,
                          backgroundColor: colors.surfaceInset,
                          borderRadius: borderRadius.base,
                          padding: `2px ${spacing['2']}`,
                        }}
                      >
                        {WAIVER_TYPE_LABELS[waiverState as WaiverStateValue] ?? waiverState}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', fontWeight: typography.fontWeight.medium }}>
                      {fmtDollars(w.amount)}
                    </td>

                    {/* Period Covered Through */}
                    <td style={{ ...tdStyle, color: colors.textSecondary }}>
                      {getThroughDate(w) ? fmtDate(getThroughDate(w)) : <span style={{ color: colors.textTertiary }}>Not set</span>}
                    </td>

                    {/* Status */}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            flexShrink: 0,
                            backgroundColor: signed
                              ? colors.statusActive
                              : isMissing
                              ? colors.statusCritical
                              : colors.statusPending,
                          }}
                        />
                        <span
                          style={{
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.medium,
                            color: signed
                              ? colors.statusActive
                              : isMissing
                              ? colors.statusCritical
                              : colors.statusPending,
                          }}
                        >
                          {signed ? 'Signed' : isMissing ? 'Missing' : 'Unsigned'}
                        </span>
                      </div>
                    </td>

                    {/* Signed Date */}
                    <td style={{ ...tdStyle, color: colors.textSecondary }}>
                      {signed && getSignedAt(w)
                        ? fmtDate(getSignedAt(w))
                        : <span style={{ color: colors.textTertiary }}>--</span>}
                    </td>

                    {/* Actions */}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
                        {!signed && (
                          <Btn
                            size="sm"
                            variant="secondary"
                            icon={<Send size={12} />}
                            onClick={(e) => { e.stopPropagation(); handleSendForSignature(w); }}
                            loading={sendingSignatureId === w.id}
                            disabled={sendingSignatureId != null}
                            aria-label="Send for signature"
                          >
                            Sign
                          </Btn>
                        )}
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleDelete(w); }}
                          disabled={deleteWaiver.isPending}
                          aria-label="Delete waiver"
                        >
                          <Trash2 size={14} />
                        </Btn>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title="New Lien Waiver">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField
            label="Contractor Name"
            value={formContractor}
            onChange={setFormContractor}
            placeholder="e.g. ABC Contractors, LLC"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                Waiver Type
              </label>
              <select
                value={formWaiverState}
                onChange={(e) => setFormWaiverState(e.target.value as WaiverStateValue)}
                style={{
                  width: '100%',
                  padding: spacing['2'],
                  borderRadius: borderRadius.base,
                  border: `1px solid ${colors.borderDefault}`,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textPrimary,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                }}
              >
                {(Object.keys(WAIVER_TYPE_LABELS) as WaiverStateValue[]).map((t) => (
                  <option key={t} value={t}>{WAIVER_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <InputField
              label="Amount ($)"
              value={formAmount}
              onChange={setFormAmount}
              placeholder="0.00"
              type="number"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField
              label="Through Date"
              value={formThroughDate}
              onChange={setFormThroughDate}
              type="date"
            />
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: spacing['2'],
                  borderRadius: borderRadius.base,
                  border: `1px solid ${colors.borderDefault}`,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textPrimary,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                }}
              >
                <option value="pending">Pending</option>
                <option value="received">Received</option>
                <option value="missing">Missing</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
              Notes
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes..."
              style={{
                width: '100%',
                padding: spacing['2'],
                borderRadius: borderRadius.base,
                border: `1px solid ${colors.borderDefault}`,
                backgroundColor: colors.surfaceRaised,
                color: colors.textPrimary,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} loading={createWaiver.isPending}>
              {createWaiver.isPending ? 'Creating...' : 'Create Waiver'}
            </Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

export default LienWaivers;
