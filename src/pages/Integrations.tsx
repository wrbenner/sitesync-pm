import React, { useState } from 'react'
import { Plug, Check, X, RefreshCw, ChevronRight, Clock, AlertTriangle, Zap, Shield, ExternalLink } from 'lucide-react'
import { PageContainer, Card, Btn, Skeleton, MetricBox, TabBar } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme'
import { useIntegrations, useIntegrationSyncLog } from '../hooks/queries'
import { useConnectIntegration, useDisconnectIntegration, useSyncIntegration } from '../hooks/mutations'
import { useProjectId } from '../hooks/useProjectId'
import { INTEGRATION_REGISTRY, type IntegrationMeta } from '../services/integrations'
import { FormModal, FormBody, FormFooter, FormField, FormInput } from '../components/forms/FormPrimitives'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'

// ── Types ────────────────────────────────────────────────

type CategoryFilter = 'all' | 'accounting' | 'scheduling' | 'documents' | 'communication' | 'storage' | 'automation'

const CATEGORY_TABS = [
  { id: 'all' as const, label: 'All', count: 0 },
  { id: 'accounting' as const, label: 'Accounting', count: 0 },
  { id: 'scheduling' as const, label: 'Scheduling', count: 0 },
  { id: 'documents' as const, label: 'Documents', count: 0 },
  { id: 'communication' as const, label: 'Communication', count: 0 },
  { id: 'storage' as const, label: 'Storage', count: 0 },
  { id: 'automation' as const, label: 'Automation', count: 0 },
]

// ── Helpers ──────────────────────────────────────────────

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function statusBadge(status: string) {
  const configs: Record<string, { color: string; bg: string; label: string }> = {
    connected: { color: colors.statusActive, bg: colors.statusActiveSubtle, label: 'Connected' },
    syncing: { color: colors.statusInfo, bg: colors.statusInfoSubtle, label: 'Syncing' },
    error: { color: colors.statusCritical, bg: colors.statusCriticalSubtle, label: 'Error' },
    disconnected: { color: colors.textTertiary, bg: colors.surfaceInset, label: 'Disconnected' },
  }
  const cfg = configs[status] ?? configs.disconnected
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
      padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.color, animation: status === 'syncing' ? 'pulse 1s infinite' : 'none' }} />
      {cfg.label}
    </span>
  )
}

// ── Main Component ───────────────────────────────────────

export const Integrations: React.FC = () => {
  const projectId = useProjectId()
  const { data: integrations, isLoading } = useIntegrations()
  const connectMutation = useConnectIntegration()
  const disconnectMutation = useDisconnectIntegration()
  const syncMutation = useSyncIntegration()

  const [category, setCategory] = useState<CategoryFilter>('all')
  const [connectingType, setConnectingType] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [detailType, setDetailType] = useState<string | null>(null)

  // Build map of connected integrations
  const connectedMap: Record<string, any> = {}
  if (integrations) {
    for (const i of integrations) {
      connectedMap[i.type] = i
    }
  }

  // Filter by category
  const allTypes = Object.entries(INTEGRATION_REGISTRY)
  const filteredTypes = category === 'all'
    ? allTypes
    : allTypes.filter(([, meta]) => meta.category === category)

  // Count connected
  const connectedCount = integrations?.filter((i) => i.status === 'connected').length ?? 0

  // ── Handlers ───────────────────────────────────────

  const handleConnect = async (type: string) => {
    if (!projectId) { toast.error('No active project'); return }
    const meta = INTEGRATION_REGISTRY[type]
    if (!meta) return

    if (meta.fields.length === 0) {
      // No credentials needed, connect directly
      try {
        await connectMutation.mutateAsync({ type, projectId, credentials: {} })
        toast.success(`${meta.name} connected`)
      } catch (err) {
        toast.error(`Failed to connect: ${(err as Error).message}`)
      }
      return
    }

    // Open credential form
    setConnectingType(type)
    setCredentials({})
  }

  const handleSubmitConnect = async () => {
    if (!connectingType || !projectId) return
    const meta = INTEGRATION_REGISTRY[connectingType]
    if (!meta) return

    // Validate required fields
    for (const field of meta.fields) {
      if (field.required && !credentials[field.key]?.trim()) {
        toast.error(`${field.label} is required`)
        return
      }
    }

    try {
      await connectMutation.mutateAsync({ type: connectingType, projectId, credentials })
      toast.success(`${meta.name} connected successfully`)
      setConnectingType(null)
    } catch (err) {
      toast.error(`Connection failed: ${(err as Error).message}`)
    }
  }

  const handleDisconnect = async (type: string, integrationId: string) => {
    const meta = INTEGRATION_REGISTRY[type]
    try {
      await disconnectMutation.mutateAsync({ integrationId, type })
      toast.success(`${meta?.name ?? type} disconnected`)
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const handleSync = async (type: string, integrationId: string) => {
    const meta = INTEGRATION_REGISTRY[type]
    try {
      const result = await syncMutation.mutateAsync({ integrationId, type })
      if (result.success) {
        toast.success(`${meta?.name ?? type}: ${result.recordsSynced} records synced`)
      } else {
        toast.error(`Sync completed with ${result.recordsFailed} errors`)
      }
    } catch (err) {
      toast.error(`Sync failed: ${(err as Error).message}`)
    }
  }

  // ── Render ─────────────────────────────────────────

  const connectingMeta = connectingType ? INTEGRATION_REGISTRY[connectingType] : null

  return (
    <PageContainer
      title="Integrations"
      subtitle="Connect SiteSync to your existing tools and services"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <MetricBox label="Connected" value={String(connectedCount)} />
        </div>
      }
    >
      {/* Category filter tabs */}
      <div style={{ marginBottom: spacing['5'] }}>
        <TabBar
          tabs={CATEGORY_TABS.map((t) => ({
            ...t,
            count: t.id === 'all'
              ? allTypes.length
              : allTypes.filter(([, m]) => m.category === t.id).length,
          }))}
          activeId={category}
          onTabChange={(id) => setCategory(id as CategoryFilter)}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing['4'] }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} width="100%" height="180px" />)}
        </div>
      )}

      {/* Integration cards */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing['4'] }}>
          {filteredTypes.map(([type, meta]) => {
            const dbRecord = connectedMap[type]
            const status = dbRecord?.status || 'available'
            const isConnected = status === 'connected'
            const isSyncing = syncMutation.isPending && syncMutation.variables?.type === type

            return (
              <Card key={type} padding={spacing['5']}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: borderRadius.md,
                    backgroundColor: isConnected ? colors.statusActiveSubtle : colors.surfaceInset,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {meta.category === 'accounting' ? <Shield size={20} color={isConnected ? colors.statusActive : colors.textTertiary} /> :
                     meta.category === 'automation' ? <Zap size={20} color={isConnected ? colors.statusActive : colors.textTertiary} /> :
                     <Plug size={20} color={isConnected ? colors.statusActive : colors.textTertiary} />}
                  </div>
                  {statusBadge(isSyncing ? 'syncing' : status)}
                </div>

                {/* Info */}
                <h3 style={{
                  fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary, margin: 0, marginBottom: spacing['1'],
                }}>
                  {meta.name}
                </h3>
                <p style={{
                  fontSize: typography.fontSize.sm, color: colors.textTertiary,
                  margin: 0, marginBottom: spacing['2'], lineHeight: '1.5',
                }}>
                  {meta.description}
                </p>

                {/* Capabilities */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'], marginBottom: spacing['3'] }}>
                  {meta.capabilities.slice(0, 3).map((cap) => (
                    <span key={cap} style={{
                      fontSize: typography.fontSize.caption, color: colors.textTertiary,
                      padding: `1px ${spacing['2']}`, backgroundColor: colors.surfaceInset,
                      borderRadius: borderRadius.full,
                    }}>
                      {cap.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                {/* Last sync */}
                {dbRecord?.last_sync && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: spacing['1'],
                    fontSize: typography.fontSize.caption, color: colors.textTertiary,
                    marginBottom: spacing['3'],
                  }}>
                    <Clock size={11} /> Last synced {formatTimeAgo(dbRecord.last_sync)}
                  </div>
                )}

                {/* Error */}
                {status === 'error' && dbRecord?.error_log && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: spacing['1'],
                    fontSize: typography.fontSize.caption, color: colors.statusCritical,
                    marginBottom: spacing['3'],
                  }}>
                    <AlertTriangle size={11} />
                    {Array.isArray(dbRecord.error_log) ? (dbRecord.error_log as string[])[0]?.slice(0, 60) : 'Connection error'}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
                  {isConnected ? (
                    <>
                      <PermissionGate permission="project.settings">
                      <Btn
                        variant="ghost" size="sm"
                        icon={<RefreshCw size={14} style={isSyncing ? { animation: 'spin 1s linear infinite' } : undefined} />}
                        onClick={() => handleSync(type, dbRecord.id)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                      </Btn>
                      </PermissionGate>
                      <Btn
                        variant="ghost" size="sm"
                        icon={<ChevronRight size={14} />}
                        onClick={() => setDetailType(type)}
                      >
                        Details
                      </Btn>
                      <PermissionGate permission="project.settings">
                      <Btn
                        variant="ghost" size="sm"
                        icon={<X size={14} />}
                        onClick={() => handleDisconnect(type, dbRecord.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        Disconnect
                      </Btn>
                      </PermissionGate>
                    </>
                  ) : (
                    <PermissionGate permission="project.settings">
                    <Btn
                      variant="primary" size="sm"
                      icon={<Check size={14} />}
                      onClick={() => handleConnect(type)}
                      disabled={connectMutation.isPending}
                    >
                      Connect
                    </Btn>
                    </PermissionGate>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredTypes.length === 0 && (
        <div style={{ textAlign: 'center', padding: spacing['12'], color: colors.textTertiary }}>
          <Plug size={32} style={{ marginBottom: spacing['3'], opacity: 0.3 }} />
          <p style={{ fontSize: typography.fontSize.body, margin: 0, marginBottom: spacing['1'] }}>No integrations in this category</p>
          <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>Try a different filter</p>
        </div>
      )}

      {/* ── Connect Modal ────────────────────────────── */}
      {connectingType && connectingMeta && (
        <FormModal open={!!connectingType} onClose={() => setConnectingType(null)} title={`Connect ${connectingMeta.name}`}>
          <FormBody onSubmit={(e) => { e.preventDefault(); handleSubmitConnect(); }}>
            {connectingMeta.authType === 'oauth2' && (
              <div style={{
                padding: spacing['3'], backgroundColor: colors.statusInfoSubtle,
                borderRadius: borderRadius.md, marginBottom: spacing['3'],
                fontSize: typography.fontSize.sm, color: colors.statusInfo,
              }}>
                OAuth2 authentication. Enter your app credentials to begin the authorization flow.
              </div>
            )}

            {connectingMeta.fields.map((field) => (
              <FormField key={field.key} label={field.label} required={field.required}>
                <FormInput
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={credentials[field.key] ?? ''}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder ?? ''}
                />
              </FormField>
            ))}

            <FormFooter
              onCancel={() => setConnectingType(null)}
              submitLabel={connectMutation.isPending ? 'Connecting...' : `Connect ${connectingMeta.name}`}
            />
          </FormBody>
        </FormModal>
      )}

      {/* ── Sync History Detail Panel ─────────────────── */}
      {detailType && connectedMap[detailType] && (
        <SyncHistoryPanel
          integrationId={connectedMap[detailType].id}
          type={detailType}
          name={INTEGRATION_REGISTRY[detailType]?.name ?? detailType}
          onClose={() => setDetailType(null)}
        />
      )}
    </PageContainer>
  )
}

// ── Sync History Panel ───────────────────────────────────

const SyncHistoryPanel: React.FC<{
  integrationId: string
  type: string
  name: string
  onClose: () => void
}> = ({ integrationId, type, name, onClose }) => {
  const { data: syncLog, isLoading } = useIntegrationSyncLog(integrationId)

  return (
    <FormModal open onClose={onClose} title={`${name} Sync History`} width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height="48px" />)}
          </div>
        )}

        {!isLoading && (!syncLog || syncLog.length === 0) && (
          <div style={{ textAlign: 'center', padding: spacing['8'], color: colors.textTertiary }}>
            <Clock size={24} style={{ marginBottom: spacing['2'], opacity: 0.3 }} />
            <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>No sync history yet</p>
          </div>
        )}

        {syncLog?.map((log) => {
          const statusColor = log.status === 'success' ? colors.statusActive
            : log.status === 'partial' ? colors.statusPending
            : colors.statusCritical
          return (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              padding: spacing['3'], backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.md,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                    color: colors.textPrimary,
                  }}>
                    {log.records_synced ?? 0} synced
                    {(log.records_failed ?? 0) > 0 && `, ${log.records_failed} failed`}
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {log.completed_at ? formatTimeAgo(log.completed_at) : ''}
                  </span>
                </div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: '2px' }}>
                  {log.direction ?? 'sync'} · {log.status}
                </div>
                {log.error_details && Array.isArray(log.error_details) && (log.error_details as string[]).length > 0 && (
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, marginTop: spacing['1'] }}>
                    {(log.error_details as string[])[0]}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </FormModal>
  )
}

export default Integrations
