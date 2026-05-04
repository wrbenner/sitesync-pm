import React, { useState, useMemo } from 'react';
import { Search, Download, Clock, X, AlertCircle } from 'lucide-react';
import { PageContainer, Card, Btn, Skeleton, Modal, useToast } from '../components/Primitives';
import { ApiError } from '../api/errors';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useAuditTrail, exportAuditTrailCSV } from '../hooks/useAuditTrail';
import type { AuditEntry } from '../hooks/useAuditTrail';
import { PermissionGate } from '../components/auth/PermissionGate';

const actionColors: Record<string, string> = {
  create: colors.statusActive,
  update: colors.statusInfo,
  delete: colors.statusCritical,
  status_change: colors.statusPending,
  approve: colors.statusActive,
  reject: colors.statusCritical,
};

const entityIcons: Record<string, string> = {
  rfi: '📋', task: '✅', submittal: '📑', change_order: '💰',
  daily_log: '📝', punch_item: '🔨', meeting: '📅', file: '📁',
  project: '🏗️', member: '👤',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const AuditTrail: React.FC = () => {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntity, setFilterEntity] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const { data: entries, total, hasMore, loadMore, loadingMore, isPending: loading, isError, error } = useAuditTrail({
    entityType: filterEntity || undefined,
    action: filterAction || undefined,
  });

  const filtered = useMemo(() => {
    if (!entries) return [];
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      (e.entity_title || '').toLowerCase().includes(q) ||
      e.entity_type.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  const handleExport = () => {
    if (!filtered.length) { addToast('error', 'No entries to export'); return; }
    const csv = exportAuditTrailCSV(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', `Exported ${filtered.length} audit entries`);
  };

  if (loading) {
    return (
      <PageContainer title="Audit Trail" subtitle="Loading...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height="56px" />)}
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    const safeMessage = error instanceof ApiError ? error.userMessage : 'Failed to load audit log';
    return (
      <PageContainer title="Audit Trail" subtitle="Error">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: spacing['4'], color: colors.statusCritical }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: typography.fontSize.body }}>{safeMessage}</span>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Audit Trail"
      subtitle={total > 0 ? `${filtered.length} of ${total} entries` : `${filtered.length} entries`}
      actions={
        <PermissionGate permission="export.data">
          <Btn variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExport}>Export CSV</Btn>
        </PermissionGate>
      }
    >
      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, flex: '1 1 200px', maxWidth: 320 }}>
          <Search size={14} color={colors.textTertiary} />
          <input type="text" placeholder="Search audit trail..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary }} />
          {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="Clear search" title="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}><X size={12} /></button>}
        </div>

        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
          style={{ padding: `${spacing['1']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.full, backgroundColor: colors.surfaceRaised, color: colors.textPrimary }}>
          <option value="">All entities</option>
          <option value="rfi">RFIs</option>
          <option value="task">Tasks</option>
          <option value="submittal">Submittals</option>
          <option value="change_order">Change Orders</option>
          <option value="daily_log">Daily Logs</option>
          <option value="punch_item">Punch Items</option>
        </select>

        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          style={{ padding: `${spacing['1']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.full, backgroundColor: colors.surfaceRaised, color: colors.textPrimary }}>
          <option value="">All actions</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
          <option value="status_change">Status Changed</option>
          <option value="approve">Approved</option>
          <option value="reject">Rejected</option>
        </select>
      </div>

      {/* Entries */}
      <Card padding="0">
        {filtered.length === 0 ? (
          <div style={{ padding: spacing['6'], textAlign: 'center' }}>
            <Clock size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
            <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0 }}>No audit entries found</p>
          </div>
        ) : (<>
          {filtered.map((entry, i) => (
            <div key={entry.id} role="button" tabIndex={0}
              aria-label={`View changes for ${entry.entity_type} ${entry.entity_title ?? ''}`}
              onClick={() => setSelectedEntry(entry)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedEntry(entry); } }}
              style={{
              display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
              padding: `${spacing['3']} ${spacing['4']}`,
              borderBottom: i < filtered.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
              transition: `background-color ${transitions.quick}`,
              cursor: 'pointer',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
            >
              {/* Icon */}
              <span style={{ fontSize: '16px', marginTop: 2, flexShrink: 0 }}>
                {entityIcons[entry.entity_type] || '📌'}
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                    color: actionColors[entry.action] || colors.textSecondary,
                    backgroundColor: `${actionColors[entry.action] || colors.textTertiary}10`,
                    padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                    textTransform: 'uppercase',
                  }}>{entry.action.replace('_', ' ')}</span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' }}>{entry.entity_type.replace('_', ' ')}</span>
                </div>
                {entry.entity_title && (
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: `${spacing['1']} 0 0`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.entity_title}
                  </p>
                )}
                {entry.old_value && entry.new_value && (
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: `${spacing['1']} 0 0` }}>
                    Changed: {Object.keys(entry.new_value).filter(k => k !== 'updated_at').join(', ')}
                  </p>
                )}
              </div>

              {/* Timestamp */}
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {formatRelativeTime(entry.created_at)}
              </span>
            </div>
          ))}
          {hasMore && !searchQuery && (
            <div style={{ padding: spacing['4'], textAlign: 'center', borderTop: `1px solid ${colors.borderSubtle}` }}>
              <Btn variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : `Load more (${total - entries.length} remaining)`}
              </Btn>
            </div>
          )}
        </>)}
      </Card>

      <AuditDiffModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </PageContainer>
  );
};

// ── Diff viewer ────────────────────────────────────────────────────────
// Lightweight line-by-line JSON compare. No external deps.

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  const sorter = (_: string, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as unknown as Record<string, unknown>).sort()) {
        out[k] = (v as unknown as Record<string, unknown>)[k];
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(value, sorter, 2);
}

interface DiffLine {
  kind: 'context' | 'added' | 'removed';
  text: string;
}

function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  // O(n*m) LCS — fine for the small JSON payloads we render (KB scale).
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ kind: 'context', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ kind: 'removed', text: a[i] }); i++; }
    else { out.push({ kind: 'added', text: b[j] }); j++; }
  }
  while (i < m) { out.push({ kind: 'removed', text: a[i++] }); }
  while (j < n) { out.push({ kind: 'added', text: b[j++] }); }
  return out;
}

const AuditDiffModal: React.FC<{ entry: AuditEntry | null; onClose: () => void }> = ({ entry, onClose }) => {
  const lines = useMemo(() => {
    if (!entry) return [] as DiffLine[];
    return computeLineDiff(stableStringify(entry.old_value), stableStringify(entry.new_value));
  }, [entry]);

  if (!entry) return null;

  const summary = `${entry.action.replace('_', ' ')} · ${entry.entity_type.replace('_', ' ')}${entry.entity_title ? ` · ${entry.entity_title}` : ''}`;
  const hasContent = entry.old_value || entry.new_value;

  return (
    <Modal open={!!entry} onClose={onClose} title="Change details" width="820px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
          <div style={{ textTransform: 'capitalize', color: colors.textPrimary, fontWeight: typography.fontWeight.semibold, marginBottom: spacing['1'] }}>
            {summary}
          </div>
          <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
            {new Date(entry.created_at).toLocaleString()}
            {entry.actor_id ? ` · ${entry.actor_id.slice(0, 8)}` : ''}
          </div>
        </div>

        {!hasContent ? (
          <div style={{ padding: spacing['5'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
            No before/after data recorded for this event.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <JsonPane label="Before" json={entry.old_value} />
            <JsonPane label="After" json={entry.new_value} />
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, marginBottom: spacing['2'] }}>
                Diff
              </div>
              <DiffPane lines={lines} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

const JsonPane: React.FC<{ label: string; json: Record<string, unknown> | null }> = ({ label, json }) => (
  <div>
    <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, marginBottom: spacing['2'] }}>
      {label}
    </div>
    <pre style={{
      margin: 0, padding: spacing['3'], maxHeight: 260, overflow: 'auto',
      backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
      borderRadius: borderRadius.md, fontSize: typography.fontSize.caption,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      color: colors.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {json ? stableStringify(json) : '— (empty)'}
    </pre>
  </div>
);

const DiffPane: React.FC<{ lines: DiffLine[] }> = ({ lines }) => (
  <pre style={{
    margin: 0, padding: spacing['3'], maxHeight: 320, overflow: 'auto',
    backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
    borderRadius: borderRadius.md, fontSize: typography.fontSize.caption,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: colors.textPrimary, whiteSpace: 'pre', overflowX: 'auto',
  }}>
    {lines.length === 0 ? (
      <span style={{ color: colors.textTertiary }}>No differences.</span>
    ) : lines.map((line, idx) => {
      const prefix = line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '- ' : '  ';
      const bg = line.kind === 'added' ? 'rgba(16,185,129,0.12)'
        : line.kind === 'removed' ? 'rgba(239,68,68,0.12)'
        : 'transparent';
      const fg = line.kind === 'added' ? colors.statusActive
        : line.kind === 'removed' ? colors.statusCritical
        : colors.textSecondary;
      return (
        <div key={idx} style={{ backgroundColor: bg, color: fg, padding: '1px 4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {prefix}{line.text || ' '}
        </div>
      );
    })}
  </pre>
);
