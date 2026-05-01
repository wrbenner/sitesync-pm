// ── Webhooks Admin Page ────────────────────────────────────────────────────
// Org admin manages outbound webhook subscriptions: URL, event filter,
// status filter, pause toggle. Delivery log surfaces last 50 deliveries
// with status + receiver response.

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminPageShell } from '../../../components/admin/AdminPageShell';
import { colors, spacing, typography } from '../../../styles/theme';
import { toast } from 'sonner';
import { Plus, Trash2, Pause, Play, Send } from 'lucide-react';
import { useConfirm } from '../../../components/ConfirmDialog';

interface SubRow {
  id: string;
  name: string;
  url: string;
  event_types: string[];
  paused: boolean;
  active: boolean;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
}

interface DeliveryRow {
  id: string;
  webhook_id: string;
  event_type: string;
  status: 'pending' | 'succeeded' | 'failed' | 'dead_letter';
  attempt_count: number;
  last_response_status: number | null;
  last_attempt_at: string | null;
  created_at: string;
}

interface Props { organizationId: string }

export const WebhooksAdminPage: React.FC<Props> = ({ organizationId }) => {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState('rfi.*, submittal.*, change_order.*');

  const { data: subs } = useQuery({
    queryKey: ['outbound_webhooks', organizationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('outbound_webhooks')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      return (data as SubRow[] | null) ?? [];
    },
  });

  const { data: recent } = useQuery({
    queryKey: ['webhook_deliveries_recent', organizationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('webhook_deliveries')
        .select('id, webhook_id, event_type, status, attempt_count, last_response_status, last_attempt_at, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data as DeliveryRow[] | null) ?? [];
    },
    refetchInterval: 30_000,
  });

  const create = async () => {
    if (!newName.trim() || !newUrl.trim()) { toast.error('Name and URL required'); return; }
    if (!/^https:\/\//.test(newUrl)) { toast.error('URL must use HTTPS'); return; }
    const events = newEvents.split(',').map((s) => s.trim()).filter(Boolean);
    const { error } = await (supabase as any).from('outbound_webhooks').insert({
      organization_id: organizationId,
      name: newName.trim(),
      url: newUrl.trim(),
      event_types: events.length ? events : ['*'],
      secret_hint: 'managed',
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Webhook created');
    setNewName(''); setNewUrl('');
    qc.invalidateQueries({ queryKey: ['outbound_webhooks', organizationId] });
  };

  const togglePause = async (sub: SubRow) => {
    await (supabase as any).from('outbound_webhooks').update({ paused: !sub.paused }).eq('id', sub.id);
    qc.invalidateQueries({ queryKey: ['outbound_webhooks', organizationId] });
  };

  const { confirm: confirmRemoveHook, dialog: removeHookDialog } = useConfirm();

  const remove = async (id: string) => {
    const ok = await confirmRemoveHook({
      title: 'Delete webhook?',
      description: 'Any deliveries in flight will be cancelled. The receiver will stop getting events immediately. Past delivery history is preserved for audit.',
      destructiveLabel: 'Delete webhook',
    });
    if (!ok) return;
    await (supabase as any).from('outbound_webhooks').delete().eq('id', id);
    toast.success('Webhook deleted');
    qc.invalidateQueries({ queryKey: ['outbound_webhooks', organizationId] });
  };

  const testFire = async (id: string) => {
    const { error } = await (supabase as any).functions.invoke('webhook-dispatch', {
      body: { webhook_id: id },
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Test event enqueued; check the delivery log');
    qc.invalidateQueries({ queryKey: ['webhook_deliveries_recent', organizationId] });
  };

  return (
    <AdminPageShell
      title="Outbound Webhooks"
      subtitle="Stream entity state changes to your data engineering pipelines. HMAC-signed; 7-day exponential-backoff retry."
    >
      <fieldset style={fieldset}>
        <legend style={legend}>Add subscription</legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input style={{ ...input, flex: 2, minWidth: 240 }} placeholder="https://hooks.example.com/sitesync" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
        </div>
        <input style={{ ...input, marginTop: 8 }} placeholder="Event types (comma): rfi.*, submittal.*, *" value={newEvents} onChange={(e) => setNewEvents(e.target.value)} />
        <button onClick={create} style={{ ...primaryBtn, marginTop: spacing['2'] }}>
          <Plus size={12} /> Add subscription
        </button>
      </fieldset>

      <fieldset style={fieldset}>
        <legend style={legend}>Subscriptions</legend>
        {(subs?.length ?? 0) === 0 ? (
          <p style={empty}>None yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
            <thead>
              <tr style={{ color: colors.textSecondary, textAlign: 'left' }}>
                <th style={th}>Name</th><th style={th}>URL</th><th style={th}>Events</th><th style={th}>Health</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {subs!.map((s) => (
                <tr key={s.id} style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                  <td style={td}>{s.name}</td>
                  <td style={td}><code style={{ fontSize: 11 }}>{s.url}</code></td>
                  <td style={td}>{s.event_types.join(', ')}</td>
                  <td style={td}>
                    {s.paused ? <span style={{ color: colors.statusPending }}>paused</span>
                      : s.consecutive_failures >= 5 ? <span style={{ color: colors.statusCritical }}>{s.consecutive_failures} fail(s)</span>
                      : <span style={{ color: colors.statusActive }}>healthy</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => testFire(s.id)} style={ghostBtn} title="Test fire"><Send size={11} /></button>
                    <button onClick={() => togglePause(s)} style={{ ...ghostBtn, marginLeft: 4 }}>{s.paused ? <Play size={11} /> : <Pause size={11} />}</button>
                    <button onClick={() => remove(s.id)} style={{ ...ghostBtn, marginLeft: 4 }}><Trash2 size={11} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </fieldset>

      <fieldset style={fieldset}>
        <legend style={legend}>Recent deliveries</legend>
        {(recent?.length ?? 0) === 0 ? <p style={empty}>No deliveries yet.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
            <thead>
              <tr style={{ color: colors.textSecondary, textAlign: 'left' }}>
                <th style={th}>When</th><th style={th}>Event</th><th style={th}>Status</th><th style={th}>HTTP</th><th style={th}>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {recent!.map((d) => (
                <tr key={d.id} style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                  <td style={td}>{new Date(d.created_at).toLocaleString()}</td>
                  <td style={td}>{d.event_type}</td>
                  <td style={td}>{d.status}</td>
                  <td style={td}>{d.last_response_status ?? '—'}</td>
                  <td style={td}>{d.attempt_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </fieldset>
      {removeHookDialog}
    </AdminPageShell>
  );
};

const fieldset: React.CSSProperties = { marginBottom: spacing['3'], padding: spacing['3'], background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8 };
const legend: React.CSSProperties = { padding: '0 6px', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.textPrimary };
const input: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: typography.fontSize.sm };
const empty: React.CSSProperties = { color: colors.textSecondary, fontStyle: 'italic', fontSize: typography.fontSize.sm };
const th: React.CSSProperties = { padding: '6px 4px', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: '6px 4px' };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', border: 'none', borderRadius: 6, background: colors.primaryOrange, color: 'white', fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: `1px solid ${colors.border}`, borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.label, color: colors.textSecondary };

export default WebhooksAdminPage;
