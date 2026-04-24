import React, { useMemo, useState } from 'react'
import { Plug, Check, X, RefreshCw, Clock, AlertTriangle, Zap, Shield, History, Lock } from 'lucide-react'
import { PageContainer, Card, Btn, Skeleton, MetricBox } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { FormModal, FormBody, FormFooter, FormField, FormInput } from '../components/forms/FormPrimitives'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useOrganization } from '../hooks/useOrganization'
import {
  useIntegrationConnections,
  useIntegrationSyncJobs,
  type IntegrationConnection,
  type IntegrationProvider,
  type IntegrationStatus,
  type IntegrationSyncJob,
  type SyncEntityType,
  type SyncDirection,
  type SyncStatus,
} from '../hooks/queries/integrations'
import {
  useCreateConnection,
  useConfirmConnection,
  useDisconnectConnection,
  useRevokeConnection,
  useTriggerSyncJob,
} from '../hooks/mutations/integrations'

// ── Provider registry ─────────────────────────────────────────
// Matches the 5-provider whitelist in the integration_connections CHECK
// constraint. Category drives icon choice only — filters are optional.

interface ProviderMeta {
  provider: IntegrationProvider
  name: string
  category: 'accounting' | 'scheduling' | 'documents' | 'construction'
  description: string
  capabilities: SyncEntityType[]
}

const PROVIDER_REGISTRY: Record<IntegrationProvider, ProviderMeta> = {
  procore: {
    provider: 'procore',
    name: 'Procore',
    category: 'construction',
    description: 'Sync RFIs, submittals, and drawings with Procore Construction Management.',
    capabilities: ['rfis', 'submittals', 'drawings', 'documents'],
  },
  sage: {
    provider: 'sage',
    name: 'Sage 300 CRE',
    category: 'accounting',
    description: 'Push budget and pay-app data into Sage for reconciliation.',
    capabilities: ['budget', 'documents'],
  },
  quickbooks: {
    provider: 'quickbooks',
    name: 'QuickBooks',
    category: 'accounting',
    description: 'Mirror budget and actuals into QuickBooks for company-wide reporting.',
    capabilities: ['budget'],
  },
  autodesk_bim360: {
    provider: 'autodesk_bim360',
    name: 'Autodesk BIM 360',
    category: 'documents',
    description: 'Two-way sync on sheets and markups with Autodesk Docs / BIM 360.',
    capabilities: ['drawings', 'documents', 'rfis'],
  },
  oracle_aconex: {
    provider: 'oracle_aconex',
    name: 'Oracle Aconex',
    category: 'documents',
    description: 'Collaborate on transmittals and submittals with Oracle Aconex partners.',
    capabilities: ['submittals', 'documents', 'rfis'],
  },
}

const PROVIDER_ORDER: IntegrationProvider[] = [
  'procore', 'autodesk_bim360', 'oracle_aconex', 'sage', 'quickbooks',
]

// ── Status + helpers ──────────────────────────────────────────

const STATUS_META: Record<IntegrationStatus, { label: string; color: string; bg: string }> = {
  connected:    { label: 'Connected',    color: colors.statusActive,   bg: colors.statusActiveSubtle   },
  pending_auth: { label: 'Pending Auth', color: colors.statusPending,  bg: colors.statusPendingSubtle  },
  disconnected: { label: 'Disconnected', color: colors.textTertiary,   bg: colors.surfaceInset         },
  error:        { label: 'Error',        color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  revoked:      { label: 'Revoked',      color: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

const SYNC_STATUS_META: Record<SyncStatus, { label: string; color: string }> = {
  queued:    { label: 'Queued',    color: colors.textTertiary  },
  running:   { label: 'Running',   color: colors.statusInfo    },
  succeeded: { label: 'Succeeded', color: colors.statusActive  },
  failed:    { label: 'Failed',    color: colors.statusCritical },
}

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  if (Number.isNaN(diff)) return 'Never'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const meta = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
      padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color: meta.color, backgroundColor: meta.bg,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}

function providerIcon(meta: ProviderMeta, color: string) {
  if (meta.category === 'accounting') return <Shield size={20} color={color} />
  if (meta.category === 'documents') return <Zap size={20} color={color} />
  return <Plug size={20} color={color} />
}

// ── Main page ─────────────────────────────────────────────────

export const Integrations: React.FC = () => {
  const { currentOrg } = useOrganization()
  const orgId = currentOrg?.id ?? undefined
  const connectionsQuery = useIntegrationConnections(orgId)
  const createConnection = useCreateConnection()
  const confirmConnection = useConfirmConnection()
  const disconnect = useDisconnectConnection()
  const revoke = useRevokeConnection()

  // Pick one active connection per provider (pending_auth > connected > error > revoked > disconnected)
  // but still expose all connection rows through the detail panel.
  const byProvider = useMemo(() => {
    const rank: Record<IntegrationStatus, number> = {
      connected: 0, pending_auth: 1, error: 2, revoked: 3, disconnected: 4,
    }
    const map = new Map<IntegrationProvider, IntegrationConnection>()
    for (const c of connectionsQuery.data ?? []) {
      const existing = map.get(c.provider)
      if (!existing || rank[c.status] < rank[existing.status]) {
        map.set(c.provider, c)
      }
    }
    return map
  }, [connectionsQuery.data])

  const [createForm, setCreateForm] = useState<{ provider: IntegrationProvider; accountName: string; scope: string } | null>(null)
  const [detailConnection, setDetailConnection] = useState<IntegrationConnection | null>(null)

  const connectedCount = (connectionsQuery.data ?? []).filter((c) => c.status === 'connected').length
  const pendingCount = (connectionsQuery.data ?? []).filter((c) => c.status === 'pending_auth').length
  const errorCount = (connectionsQuery.data ?? []).filter((c) => c.status === 'error' || c.status === 'revoked').length

  const openCreate = (provider: IntegrationProvider) => {
    setCreateForm({ provider, accountName: '', scope: '' })
  }

  const submitCreate = async () => {
    if (!createForm || !orgId) return
    try {
      await createConnection.mutateAsync({
        organizationId: orgId,
        provider: createForm.provider,
        accountName: createForm.accountName.trim() || null,
        scope: createForm.scope.trim() || null,
      })
      setCreateForm(null)
    } catch {
      // toast already emitted by mutation's onError
    }
  }

  const handleConfirm = async (conn: IntegrationConnection) => {
    if (!orgId) return
    await confirmConnection.mutateAsync({ id: conn.id, organizationId: orgId })
  }

  const handleDisconnect = async (conn: IntegrationConnection) => {
    if (!orgId) return
    await disconnect.mutateAsync({ id: conn.id, organizationId: orgId })
  }

  const handleRevoke = async (conn: IntegrationConnection) => {
    if (!orgId) return
    if (!window.confirm(`Revoke ${PROVIDER_REGISTRY[conn.provider].name}? This marks the connection revoked.`)) return
    await revoke.mutateAsync({ id: conn.id, organizationId: orgId })
  }

  if (!orgId) {
    return (
      <PageContainer title="Integrations" subtitle="Connect SiteSync to your existing tools and services">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['3'], textAlign: 'center' }}>
            <Lock size={28} color={colors.textTertiary} />
            <p style={{ margin: 0, fontSize: typography.fontSize.body, color: colors.textPrimary }}>
              Select an organization to manage integrations
            </p>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              Connections are scoped to an organization so they can be shared across every project in it.
            </p>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title="Integrations"
      subtitle="Connect SiteSync to your existing tools and services"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <MetricBox label="Connected" value={String(connectedCount)} />
          <MetricBox label="Pending" value={String(pendingCount)} />
          <MetricBox label="Issues" value={String(errorCount)} />
        </div>
      }
    >
      {connectionsQuery.isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: spacing['4'] }}>
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} width="100%" height="220px" />)}
        </div>
      )}

      {!connectionsQuery.isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: spacing['4'] }}>
          {PROVIDER_ORDER.map((provider) => {
            const meta = PROVIDER_REGISTRY[provider]
            const conn = byProvider.get(provider) ?? null
            const status: IntegrationStatus = conn?.status ?? 'disconnected'
            const iconColor = status === 'connected' ? colors.statusActive : colors.textTertiary

            return (
              <Card key={provider} padding={spacing['5']}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: borderRadius.md,
                    backgroundColor: status === 'connected' ? colors.statusActiveSubtle : colors.surfaceInset,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {providerIcon(meta, iconColor)}
                  </div>
                  <StatusBadge status={status} />
                </div>

                <h3 style={{
                  fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary, margin: 0, marginBottom: spacing['1'],
                }}>{meta.name}</h3>
                <p style={{
                  fontSize: typography.fontSize.sm, color: colors.textTertiary,
                  margin: 0, marginBottom: spacing['2'], lineHeight: 1.5,
                }}>{meta.description}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'], marginBottom: spacing['3'] }}>
                  {meta.capabilities.map((cap) => (
                    <span key={cap} style={{
                      fontSize: typography.fontSize.caption, color: colors.textTertiary,
                      padding: `1px ${spacing['2']}`, backgroundColor: colors.surfaceInset,
                      borderRadius: borderRadius.full,
                    }}>{cap}</span>
                  ))}
                </div>

                {conn?.account_name && (
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing['2'] }}>
                    Account: <span style={{ color: colors.textPrimary }}>{conn.account_name}</span>
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  fontSize: typography.fontSize.caption, color: colors.textTertiary,
                  marginBottom: spacing['3'],
                }}>
                  <Clock size={11} /> Last synced {formatTimeAgo(conn?.last_sync_at)}
                </div>

                <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
                  {!conn && (
                    <PermissionGate permission="project.settings">
                      <Btn
                        variant="primary" size="sm"
                        icon={<Check size={14} />}
                        onClick={() => openCreate(provider)}
                        disabled={createConnection.isPending}
                      >
                        Connect
                      </Btn>
                    </PermissionGate>
                  )}

                  {conn?.status === 'pending_auth' && (
                    <PermissionGate permission="project.settings">
                      <Btn
                        variant="primary" size="sm"
                        icon={<Check size={14} />}
                        onClick={() => handleConfirm(conn)}
                        disabled={confirmConnection.isPending}
                      >
                        {confirmConnection.isPending ? 'Confirming…' : 'Confirm Connection'}
                      </Btn>
                    </PermissionGate>
                  )}

                  {conn && conn.status !== 'disconnected' && (
                    <Btn
                      variant="ghost" size="sm"
                      icon={<History size={14} />}
                      onClick={() => setDetailConnection(conn)}
                    >
                      History
                    </Btn>
                  )}

                  {conn?.status === 'connected' && (
                    <PermissionGate permission="project.settings">
                      <Btn
                        variant="ghost" size="sm"
                        icon={<RefreshCw size={14} />}
                        onClick={() => setDetailConnection(conn)}
                      >
                        Sync
                      </Btn>
                    </PermissionGate>
                  )}

                  {conn && (conn.status === 'connected' || conn.status === 'pending_auth' || conn.status === 'error') && (
                    <PermissionGate permission="project.settings">
                      <Btn
                        variant="ghost" size="sm"
                        icon={<X size={14} />}
                        onClick={() => handleDisconnect(conn)}
                        disabled={disconnect.isPending}
                      >
                        Disconnect
                      </Btn>
                    </PermissionGate>
                  )}

                  {conn?.status === 'connected' && (
                    <PermissionGate permission="project.settings">
                      <Btn
                        variant="ghost" size="sm"
                        icon={<AlertTriangle size={14} />}
                        onClick={() => handleRevoke(conn)}
                        disabled={revoke.isPending}
                      >
                        Revoke
                      </Btn>
                    </PermissionGate>
                  )}

                  {conn && (conn.status === 'disconnected' || conn.status === 'revoked') && (
                    <PermissionGate permission="project.settings">
                      <Btn
                        variant="primary" size="sm"
                        icon={<Check size={14} />}
                        onClick={() => openCreate(provider)}
                      >
                        Reconnect
                      </Btn>
                    </PermissionGate>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Connect (stub) modal ────────────────────────── */}
      {createForm && (
        <FormModal open onClose={() => setCreateForm(null)} title={`Connect ${PROVIDER_REGISTRY[createForm.provider].name}`}>
          <FormBody onSubmit={(e) => { e.preventDefault(); void submitCreate() }}>
            <div style={{
              padding: spacing['3'], backgroundColor: colors.statusInfoSubtle,
              borderRadius: borderRadius.md, marginBottom: spacing['3'],
              fontSize: typography.fontSize.sm, color: colors.statusInfo,
            }}>
              Live OAuth is not wired yet. This creates a <strong>pending_auth</strong> row — click
              "Confirm Connection" on the card once the remote side is ready.
            </div>

            <FormField label="Account name">
              <FormInput
                value={createForm.accountName}
                placeholder="e.g. acme-construction"
                onChange={(e) => setCreateForm((f) => f ? { ...f, accountName: e.target.value } : f)}
              />
            </FormField>

            <FormField label="Scope (optional)">
              <FormInput
                value={createForm.scope}
                placeholder="e.g. read:rfis write:submittals"
                onChange={(e) => setCreateForm((f) => f ? { ...f, scope: e.target.value } : f)}
              />
            </FormField>

            <FormFooter
              onCancel={() => setCreateForm(null)}
              submitLabel={createConnection.isPending ? 'Creating…' : 'Create pending connection'}
            />
          </FormBody>
        </FormModal>
      )}

      {/* ── Detail / sync-history panel ─────────────────── */}
      {detailConnection && (
        <SyncHistoryPanel
          connection={detailConnection}
          organizationId={orgId}
          providerName={PROVIDER_REGISTRY[detailConnection.provider].name}
          capabilities={PROVIDER_REGISTRY[detailConnection.provider].capabilities}
          onClose={() => setDetailConnection(null)}
        />
      )}
    </PageContainer>
  )
}

// ── Sync history panel ────────────────────────────────────────

interface SyncHistoryPanelProps {
  connection: IntegrationConnection
  organizationId: string
  providerName: string
  capabilities: SyncEntityType[]
  onClose: () => void
}

const SyncHistoryPanel: React.FC<SyncHistoryPanelProps> = ({ connection, organizationId, providerName, capabilities, onClose }) => {
  const syncJobsQuery = useIntegrationSyncJobs(connection.id)
  const trigger = useTriggerSyncJob()
  const [syncEntity, setSyncEntity] = useState<SyncEntityType>(capabilities[0] ?? 'rfis')
  const [syncDirection, setSyncDirection] = useState<SyncDirection>('bidirectional')

  const canQueue = connection.status === 'connected'

  const handleQueue = async () => {
    if (!canQueue) {
      toast.error('Connection must be in "connected" status before syncing.')
      return
    }
    await trigger.mutateAsync({
      organizationId,
      connectionId: connection.id,
      entityType: syncEntity,
      direction: syncDirection,
    })
  }

  return (
    <FormModal open onClose={onClose} title={`${providerName} — Sync History`} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        {/* Trigger form */}
        <Card padding={spacing['4']}>
          <div style={{
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary, marginBottom: spacing['3'],
          }}>Trigger manual sync</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], marginBottom: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['1'] }}>
                Entity
              </label>
              <select
                value={syncEntity}
                onChange={(e) => setSyncEntity(e.target.value as SyncEntityType)}
                style={{
                  width: '100%', padding: '8px 10px',
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamily,
                }}
              >
                {capabilities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['1'] }}>
                Direction
              </label>
              <select
                value={syncDirection}
                onChange={(e) => setSyncDirection(e.target.value as SyncDirection)}
                style={{
                  width: '100%', padding: '8px 10px',
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamily,
                }}
              >
                <option value="import">Import</option>
                <option value="export">Export</option>
                <option value="bidirectional">Bidirectional</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PermissionGate permission="project.settings">
              <Btn
                variant="primary" size="sm"
                icon={<RefreshCw size={14} />}
                onClick={handleQueue}
                disabled={trigger.isPending || !canQueue}
              >
                {trigger.isPending ? 'Queuing…' : 'Trigger Manual Sync'}
              </Btn>
            </PermissionGate>
          </div>

          {!canQueue && (
            <div style={{
              marginTop: spacing['2'], display: 'flex', alignItems: 'center', gap: spacing['1'],
              fontSize: typography.fontSize.caption, color: colors.statusPending,
            }}>
              <AlertTriangle size={11} />
              Connection is {connection.status} — confirm it before syncing.
            </div>
          )}
        </Card>

        {/* History table */}
        <div>
          <div style={{
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary, marginBottom: spacing['2'],
          }}>Recent sync jobs</div>

          {syncJobsQuery.isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} height="44px" />)}
            </div>
          )}

          {!syncJobsQuery.isLoading && (syncJobsQuery.data?.length ?? 0) === 0 && (
            <div style={{ textAlign: 'center', padding: spacing['6'], color: colors.textTertiary }}>
              <Clock size={20} style={{ marginBottom: spacing['2'], opacity: 0.3 }} />
              <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>No sync history yet.</p>
            </div>
          )}

          {(syncJobsQuery.data ?? []).map((job) => <SyncJobRow key={job.id} job={job} />)}
        </div>
      </div>
    </FormModal>
  )
}

const SyncJobRow: React.FC<{ job: IntegrationSyncJob }> = ({ job }) => {
  const meta = SYNC_STATUS_META[job.status]
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '10px 1fr 110px 120px',
      alignItems: 'center', gap: spacing['3'],
      padding: spacing['3'], backgroundColor: colors.surfaceInset,
      borderRadius: borderRadius.md, marginBottom: spacing['2'],
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: meta.color }} />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
          color: colors.textPrimary,
        }}>
          {job.entity_type} · {job.direction}
        </div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
          {job.records_processed} processed
          {job.records_failed > 0 ? ` · ${job.records_failed} failed` : ''}
          {job.error_message ? ` · ${job.error_message.slice(0, 60)}` : ''}
        </div>
      </div>
      <span style={{
        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
        color: meta.color, textAlign: 'right',
      }}>{meta.label}</span>
      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textAlign: 'right' }}>
        {formatTimeAgo(job.completed_at ?? job.started_at ?? job.created_at)}
      </span>
    </div>
  )
}

export default Integrations
