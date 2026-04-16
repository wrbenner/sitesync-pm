import React, { useState, useCallback, memo } from 'react'
import {
  Key, Code, Webhook, BarChart3, Copy, Check, Plus, Trash2,
  RefreshCw, Terminal,
  AlertTriangle, Clock, Zap, Globe, Shield, Package,
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useApiKeys, useWebhooks } from '../hooks/queries'
import { PermissionGate } from '../components/auth/PermissionGate'
import { toast } from 'sonner'
import CreateAPIKeyModal from '../components/forms/CreateAPIKeyModal'
import AddWebhookEndpointModal from '../components/forms/AddWebhookEndpointModal'

// ── Types ─────────────────────────────────────────────────────

type TabKey = 'keys' | 'webhooks' | 'explorer' | 'usage'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'keys', label: 'API Keys', icon: Key },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook },
  { key: 'explorer', label: 'API Explorer', icon: Terminal },
  { key: 'usage', label: 'Usage', icon: BarChart3 },
]

// ── API Explorer Endpoints ────────────────────────────────────

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  scopes: string[]
  params?: Array<{ name: string; type: string; required: boolean; description: string }>
}

const API_ENDPOINTS: ApiEndpoint[] = [
  { method: 'GET', path: '/v1/projects', description: 'List all projects', scopes: ['read'] },
  { method: 'GET', path: '/v1/projects/{id}', description: 'Get a project', scopes: ['read'] },
  { method: 'GET', path: '/v1/projects/{id}/rfis', description: 'List RFIs', scopes: ['read:rfis'], params: [{ name: 'status', type: 'string', required: false, description: 'Filter by status: open, under_review, answered, closed' }, { name: 'expand', type: 'string', required: false, description: 'Expand related resources: responses' }] },
  { method: 'POST', path: '/v1/projects/{id}/rfis', description: 'Create an RFI', scopes: ['write:rfis'], params: [{ name: 'title', type: 'string', required: true, description: 'RFI subject line' }, { name: 'description', type: 'string', required: false, description: 'Detailed question' }, { name: 'priority', type: 'string', required: false, description: 'low, medium, high, critical' }] },
  { method: 'GET', path: '/v1/projects/{id}/tasks', description: 'List tasks', scopes: ['read:tasks'] },
  { method: 'POST', path: '/v1/projects/{id}/tasks', description: 'Create a task', scopes: ['write:tasks'], params: [{ name: 'title', type: 'string', required: true, description: 'Task title' }, { name: 'priority', type: 'string', required: false, description: 'low, medium, high, critical' }] },
  { method: 'GET', path: '/v1/projects/{id}/submittals', description: 'List submittals', scopes: ['read:submittals'] },
  { method: 'GET', path: '/v1/projects/{id}/daily-logs', description: 'List daily logs', scopes: ['read:daily_logs'] },
  { method: 'GET', path: '/v1/projects/{id}/change-orders', description: 'List change orders', scopes: ['read:change_orders'] },
  { method: 'GET', path: '/v1/projects/{id}/budget', description: 'Get budget summary', scopes: ['read:budget'] },
  { method: 'GET', path: '/v1/projects/{id}/punch-items', description: 'List punch items', scopes: ['read:punch_items'] },
]

const METHOD_COLORS: Record<string, { color: string; bg: string }> = {
  GET: { color: colors.statusActive, bg: colors.statusActiveSubtle },
  POST: { color: colors.statusInfo, bg: colors.statusInfoSubtle },
  PATCH: { color: colors.statusPending, bg: colors.statusPendingSubtle },
  DELETE: { color: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

// ── Code Examples ─────────────────────────────────────────────

type CodeLanguage = 'curl' | 'javascript' | 'python' | 'ruby'

function generateCodeExample(
  endpoint: ApiEndpoint,
  language: CodeLanguage,
  apiKey: string,
): string {
  const baseUrl = 'https://your-project.supabase.co/functions/v1/api-v1'
  const path = endpoint.path.replace('{id}', 'PROJECT_ID')

  switch (language) {
    case 'curl':
      if (endpoint.method === 'GET') {
        return `curl ${baseUrl}${path} \\\n  -H "X-API-Key: ${apiKey}"`
      }
      return `curl -X ${endpoint.method} ${baseUrl}${path} \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title": "Example"}'`

    case 'javascript':
      if (endpoint.method === 'GET') {
        return `const response = await fetch('${baseUrl}${path}', {\n  headers: { 'X-API-Key': '${apiKey}' }\n})\nconst data = await response.json()`
      }
      return `const response = await fetch('${baseUrl}${path}', {\n  method: '${endpoint.method}',\n  headers: {\n    'X-API-Key': '${apiKey}',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({ title: 'Example' })\n})\nconst data = await response.json()`

    case 'python':
      if (endpoint.method === 'GET') {
        return `import requests\n\nresponse = requests.get(\n    '${baseUrl}${path}',\n    headers={'X-API-Key': '${apiKey}'}\n)\ndata = response.json()`
      }
      return `import requests\n\nresponse = requests.${endpoint.method.toLowerCase()}(\n    '${baseUrl}${path}',\n    headers={'X-API-Key': '${apiKey}'},\n    json={'title': 'Example'}\n)\ndata = response.json()`

    case 'ruby':
      if (endpoint.method === 'GET') {
        return `require 'net/http'\nrequire 'json'\n\nuri = URI('${baseUrl}${path}')\nreq = Net::HTTP::Get.new(uri)\nreq['X-API-Key'] = '${apiKey}'\nres = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }\ndata = JSON.parse(res.body)`
      }
      return `require 'net/http'\nrequire 'json'\n\nuri = URI('${baseUrl}${path}')\nreq = Net::HTTP::Post.new(uri)\nreq['X-API-Key'] = '${apiKey}'\nreq['Content-Type'] = 'application/json'\nreq.body = { title: 'Example' }.to_json\nres = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }\ndata = JSON.parse(res.body)`
  }
}

// ── Code Block Component ──────────────────────────────────────

const CodeBlock = memo<{ code: string; language: string }>(({ code, language }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div style={{ position: 'relative', backgroundColor: colors.textPrimary, borderRadius: borderRadius.md, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
        <span style={{ fontSize: typography.fontSize.caption, color: 'rgba(255,255,255,0.4)', fontFamily: typography.fontFamilyMono }}>{language}</span>
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], backgroundColor: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: typography.fontFamily, fontSize: typography.fontSize.caption }}
        >
          {copied ? <Check size={11} color={colors.statusActive} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: spacing['4'], color: 'rgba(255,255,255,0.85)', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, lineHeight: typography.lineHeight.relaxed, overflow: 'auto', maxHeight: 300 }}>
        {code}
      </pre>
    </div>
  )
})
CodeBlock.displayName = 'CodeBlock'

// ── API Key Card ──────────────────────────────────────────────

const ApiKeyCard = memo<{ apiKey: Record<string, unknown> }>(({ apiKey }) => {
  const [_showKey, _setShowKey] = useState(false)
  const prefix = apiKey.key_prefix as string
  const name = apiKey.name as string
  const lastUsed = apiKey.last_used_at as string | null
  const expiresAt = apiKey.expires_at as string | null
  const permissions = (apiKey.permissions as string[]) || []
  const rateLimit = (apiKey.rate_limit as number) || 100

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['4'],
      padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: borderRadius.base,
        backgroundColor: colors.orangeSubtle, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Key size={16} color={colors.primaryOrange} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{name}</span>
          <span style={{
            padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
            backgroundColor: colors.surfaceInset, color: colors.textTertiary,
            fontSize: typography.fontSize.caption, fontFamily: typography.fontFamilyMono,
          }}>
            {prefix}...
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginTop: spacing['1'] }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {permissions.length} scope{permissions.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {rateLimit}/min
          </span>
          {lastUsed && (
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Last used: {new Date(lastUsed).toLocaleDateString()}
            </span>
          )}
          {expiresAt && (
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              color: new Date(expiresAt) < new Date() ? colors.statusCritical : colors.textTertiary,
            }}>
              {new Date(expiresAt) < new Date() ? 'Expired' : `Expires: ${new Date(expiresAt).toLocaleDateString()}`}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: spacing['1'] }}>
        <button
          onClick={() => toast.info('Rotate key: This will invalidate the current key and generate a new one.')}
          aria-label="Rotate API key"
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={() => toast.info('Revoke key: This action cannot be undone.')}
          aria-label="Revoke API key"
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, cursor: 'pointer', color: colors.statusCritical }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
})
ApiKeyCard.displayName = 'ApiKeyCard'

// ── Webhook Event Types ───────────────────────────────────────

const EVENT_CATEGORIES: Record<string, string[]> = {
  'RFIs': ['rfi.created', 'rfi.updated', 'rfi.responded'],
  'Tasks': ['task.created', 'task.updated', 'task.completed'],
  'Submittals': ['submittal.created', 'submittal.updated', 'submittal.approved'],
  'Change Orders': ['change_order.created', 'change_order.approved'],
  'Daily Logs': ['daily_log.created', 'daily_log.submitted'],
  'Payments': ['payment.submitted', 'payment.approved', 'payment.completed'],
  'Safety': ['incident.reported', 'inspection.completed'],
}

// ── Main Page ─────────────────────────────────────────────────

export const Developers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('keys')
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>(API_ENDPOINTS[0])
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>('curl')
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false)
  const [showAddEndpointModal, setShowAddEndpointModal] = useState(false)
  const projectId = useProjectId()
  const { data: apiKeys, isLoading: loadingKeys } = useApiKeys(projectId)
  const { data: webhooks, isLoading: loadingWebhooks } = useWebhooks(projectId)

  const keys = (apiKeys ?? []) as Array<Record<string, unknown>>
  const hooks = (webhooks ?? []) as Array<Record<string, unknown>>

  return (
    <>
    <PageContainer
      title="Developer Portal"
      subtitle="API keys, webhooks, SDK, and integration tools for building on SiteSync"
    >
      {/* Tab Switcher */}
      <div style={{
        display: 'flex', gap: spacing['1'],
        backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
        padding: spacing['1'], marginBottom: spacing['2xl'], overflowX: 'auto',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none', borderRadius: borderRadius.base, cursor: 'pointer',
                fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`, whiteSpace: 'nowrap',
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── API Keys Tab ───────────────────────────────────── */}
      {activeTab === 'keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* SDK Banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing['4'],
            padding: spacing['5'], backgroundColor: colors.statusReviewSubtle,
            borderRadius: borderRadius.lg, borderLeft: `3px solid ${colors.statusReview}`,
          }}>
            <Package size={20} color={colors.statusReview} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                TypeScript SDK Available
              </p>
              <p style={{ margin: `${spacing['0.5']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                Install with: npm install @sitesync/sdk
              </p>
            </div>
            <CodeBlock code="npm install @sitesync/sdk" language="bash" />
          </div>

          {/* Create key button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PermissionGate permission="project.settings">
              <Btn onClick={() => setShowCreateKeyModal(true)} size="sm">
                <Plus size={14} /> Create API Key
              </Btn>
            </PermissionGate>
          </div>

          {/* Key list */}
          <Card padding="0">
            <div style={{ padding: `${spacing['4']} ${spacing['5']} ${spacing['3']}` }}>
              <SectionHeader title="API Keys" />
            </div>
            {loadingKeys ? (
              <div style={{ padding: spacing['5'] }}>
                <Skeleton width="100%" height="60px" />
              </div>
            ) : keys.length > 0 ? (
              keys.map((key) => <ApiKeyCard key={key.id as string} apiKey={key} />)
            ) : (
              <div style={{ padding: spacing['5'] }}>
                <EmptyState
                  icon={<Key size={28} color={colors.textTertiary} />}
                  title="No API keys"
                  description="Create an API key to start using the SiteSync REST API."
                  action={<Btn onClick={() => setShowCreateKeyModal(true)} size="sm"><Plus size={14} /> Create Key</Btn>}
                />
              </div>
            )}
          </Card>

          {/* Authentication guide */}
          <Card padding={spacing['5']}>
            <SectionHeader title="Authentication" />
            <p style={{ margin: `${spacing['3']} 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
              Include your API key in every request via the X-API-Key header. Keys are scoped to your organization and support fine grained permissions.
            </p>
            <CodeBlock
              code={`curl https://api.sitesync.ai/v1/projects \\\n  -H "X-API-Key: sk_live_your_key_here"`}
              language="curl"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing['3'], marginTop: spacing['4'] }}>
              {[
                { icon: Shield, label: 'Scoped Permissions', desc: 'read, write, per-resource' },
                { icon: Clock, label: 'Rate Limiting', desc: '100 req/min default' },
                { icon: Zap, label: 'Idempotency', desc: 'X-Idempotency-Key header' },
                { icon: Globe, label: 'Cursor Pagination', desc: 'starting_after + limit' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
                  <item.icon size={14} color={colors.primaryOrange} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Webhooks Tab ───────────────────────────────────── */}
      {activeTab === 'webhooks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PermissionGate permission="project.settings">
              <Btn onClick={() => setShowAddEndpointModal(true)} size="sm">
                <Plus size={14} /> Add Endpoint
              </Btn>
            </PermissionGate>
          </div>

          {/* Webhook endpoints */}
          <Card padding={spacing['5']}>
            <SectionHeader title="Webhook Endpoints" />
            {loadingWebhooks ? (
              <Skeleton width="100%" height="80px" />
            ) : hooks.length > 0 ? hooks.map((hook) => (
              <div key={hook.id as string} style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: `${spacing['3']} 0`, borderBottom: `1px solid ${colors.borderSubtle}`,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: (hook.active as boolean) ? colors.statusActive : colors.textTertiary,
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontFamily: typography.fontFamilyMono }}>
                    {hook.url as string}
                  </p>
                  <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['1'] }}>
                    {((hook.events as string[]) || []).slice(0, 3).map((evt) => (
                      <span key={evt} style={{
                        padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                        backgroundColor: colors.surfaceInset, color: colors.textTertiary,
                        fontSize: '9px', fontFamily: typography.fontFamilyMono,
                      }}>
                        {evt}
                      </span>
                    ))}
                    {((hook.events as string[]) || []).length > 3 && (
                      <span style={{ fontSize: '9px', color: colors.textTertiary }}>
                        +{((hook.events as string[]) || []).length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                {(hook.failure_count as number) > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                    padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                    backgroundColor: colors.statusCriticalSubtle, color: colors.statusCritical,
                    fontSize: typography.fontSize.caption,
                  }}>
                    <AlertTriangle size={9} />
                    {hook.failure_count as number} failures
                  </span>
                )}
              </div>
            )) : (
              <EmptyState
                icon={<Webhook size={28} color={colors.textTertiary} />}
                title="No webhook endpoints"
                description="Add a webhook endpoint to receive real time event notifications from SiteSync."
                action={<Btn onClick={() => setShowAddEndpointModal(true)} size="sm"><Plus size={14} /> Add Endpoint</Btn>}
              />
            )}
          </Card>

          {/* Event types reference */}
          <Card padding={spacing['5']}>
            <SectionHeader title="Available Event Types" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: spacing['3'], marginTop: spacing['3'] }}>
              {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                <div key={category} style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
                  <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{category}</p>
                  {events.map((evt) => (
                    <p key={evt} style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary, fontFamily: typography.fontFamilyMono }}>{evt}</p>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          {/* Signature verification */}
          <Card padding={spacing['5']}>
            <SectionHeader title="Signature Verification" />
            <p style={{ margin: `${spacing['2']} 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
              Every webhook delivery includes an X-SiteSync-Signature header with HMAC-SHA256 signature. Verify it to ensure the payload is authentic.
            </p>
            <CodeBlock
              code={`// Verify webhook signature (Node.js)\nconst crypto = require('crypto')\n\nfunction verifyWebhook(payload, signatureHeader, secret) {\n  const parts = Object.fromEntries(\n    signatureHeader.split(',').map(p => p.split('='))\n  )\n  const expected = crypto\n    .createHmac('sha256', secret)\n    .update(parts.t + '.' + payload)\n    .digest('hex')\n  return crypto.timingSafeEqual(\n    Buffer.from(expected),\n    Buffer.from(parts.v1)\n  )\n}`}
              language="javascript"
            />
          </Card>
        </div>
      )}

      {/* ── API Explorer Tab ───────────────────────────────── */}
      {activeTab === 'explorer' && (
        <div style={{ display: 'flex', gap: spacing['5'], alignItems: 'flex-start' }}>
          {/* Endpoint list */}
          <div style={{ width: 320, flexShrink: 0 }}>
            <Card padding="0">
              <div style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                <SectionHeader title="Endpoints" />
              </div>
              {API_ENDPOINTS.map((ep) => {
                const isActive = selectedEndpoint === ep
                const methodColor = METHOD_COLORS[ep.method]
                return (
                  <button
                    key={`${ep.method}-${ep.path}`}
                    onClick={() => setSelectedEndpoint(ep)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                      padding: `${spacing['2.5']} ${spacing['4']}`,
                      backgroundColor: isActive ? colors.surfaceSelected : 'transparent',
                      border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily,
                      textAlign: 'left', borderBottom: `1px solid ${colors.borderSubtle}`,
                      transition: `background-color ${transitions.instant}`,
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', padding: `1px ${spacing['1.5']}`,
                      borderRadius: borderRadius.sm, backgroundColor: methodColor.bg,
                      color: methodColor.color, fontSize: '9px',
                      fontWeight: typography.fontWeight.bold, fontFamily: typography.fontFamilyMono,
                      minWidth: 38, justifyContent: 'center',
                    }}>
                      {ep.method}
                    </span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, fontFamily: typography.fontFamilyMono }}>
                      {ep.path}
                    </span>
                  </button>
                )
              })}
            </Card>
          </div>

          {/* Endpoint detail */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Card padding={spacing['5']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'] }}>
                <span style={{
                  display: 'inline-flex', padding: `${spacing['1']} ${spacing['2']}`,
                  borderRadius: borderRadius.sm, backgroundColor: METHOD_COLORS[selectedEndpoint.method].bg,
                  color: METHOD_COLORS[selectedEndpoint.method].color, fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.bold, fontFamily: typography.fontFamilyMono,
                }}>
                  {selectedEndpoint.method}
                </span>
                <span style={{ fontSize: typography.fontSize.body, fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>
                  {selectedEndpoint.path}
                </span>
              </div>
              <p style={{ margin: 0, marginBottom: spacing['3'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                {selectedEndpoint.description}
              </p>

              {/* Scopes */}
              <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['4'] }}>
                {selectedEndpoint.scopes.map((scope) => (
                  <span key={scope} style={{
                    padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                    backgroundColor: colors.orangeSubtle, color: colors.orangeText,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                  }}>
                    {scope}
                  </span>
                ))}
              </div>

              {/* Parameters */}
              {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                <div style={{ marginBottom: spacing['5'] }}>
                  <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Parameters</p>
                  {selectedEndpoint.params.map((param) => (
                    <div key={param.name} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], minWidth: 120 }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontFamily: typography.fontFamilyMono }}>{param.name}</span>
                        {param.required && <span style={{ fontSize: '9px', color: colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>required</span>}
                      </div>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{param.type}</span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, flex: 1 }}>{param.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Language tabs */}
              <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['3'] }}>
                {(['curl', 'javascript', 'python', 'ruby'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setCodeLanguage(lang)}
                    style={{
                      padding: `${spacing['1']} ${spacing['3']}`,
                      backgroundColor: codeLanguage === lang ? colors.textPrimary : 'transparent',
                      color: codeLanguage === lang ? colors.white : colors.textTertiary,
                      border: `1px solid ${codeLanguage === lang ? colors.textPrimary : colors.borderDefault}`,
                      borderRadius: borderRadius.base, cursor: 'pointer',
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              <CodeBlock
                code={generateCodeExample(selectedEndpoint, codeLanguage, 'sk_live_your_key_here')}
                language={codeLanguage}
              />
            </Card>
          </div>
        </div>
      )}

      {/* ── Usage Tab ──────────────────────────────────────── */}
      {activeTab === 'usage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'] }}>
            <MetricBox label="Total Requests (30d)" value="0" />
            <MetricBox label="Error Rate" value="0%" change={1} />
            <MetricBox label="Avg Latency" value="0ms" />
            <MetricBox label="Webhook Deliveries" value="0" />
          </div>

          <Card padding={spacing['5']}>
            <SectionHeader title="Request Volume" />
            <EmptyState
              icon={<BarChart3 size={28} color={colors.textTertiary} />}
              title="No API usage yet"
              description="Request volume, error rates, and latency charts will appear here once you start making API calls."
            />
          </Card>

          {/* Rate limits reference */}
          <Card padding={spacing['5']}>
            <SectionHeader title="Rate Limits" />
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: spacing['3'] }}>
              {[
                { endpoint: 'GET /v1/projects/*', limit: '100/min', description: 'Read operations' },
                { endpoint: 'POST /v1/projects/*', limit: '30/min', description: 'Write operations' },
                { endpoint: 'PATCH /v1/projects/*', limit: '30/min', description: 'Update operations' },
                { endpoint: 'AI analysis', limit: '10/min', description: 'AI powered endpoints' },
                { endpoint: 'File uploads', limit: '20/min', description: 'File and document uploads' },
              ].map((item) => (
                <div key={item.endpoint} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `${spacing['2.5']} 0`, borderBottom: `1px solid ${colors.borderSubtle}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{item.endpoint}</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.description}</span>
                  </div>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange }}>{item.limit}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: `${spacing['3']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset. 429 responses include Retry-After.
            </p>
          </Card>
        </div>
      )}
    </PageContainer>

    <CreateAPIKeyModal
      open={showCreateKeyModal}
      onClose={() => setShowCreateKeyModal(false)}
      onSuccess={(apiKey) => {
        navigator.clipboard.writeText(apiKey.key)
        setShowCreateKeyModal(false)
      }}
    />

    <AddWebhookEndpointModal
      open={showAddEndpointModal}
      onClose={() => setShowAddEndpointModal(false)}
      onSuccess={() => {
        setShowAddEndpointModal(false)
      }}
    />
  </>
  )
}

export default Developers
