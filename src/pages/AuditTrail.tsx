import React, { useState, useMemo } from 'react';
import { Search, Download, Clock, X, AlertCircle } from 'lucide-react';
import { PageContainer, Card, Btn, Skeleton, useToast } from '../components/Primitives';
import { ApiError } from '../api/errors';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useAuditTrail, exportAuditTrailCSV } from '../hooks/useAuditTrail';
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

  const { data: entries, isPending: loading, isError, error } = useAuditTrail({
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
      subtitle={`${filtered.length} entries`}
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
        ) : (
          filtered.map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
              padding: `${spacing['3']} ${spacing['4']}`,
              borderBottom: i < filtered.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
              transition: `background-color ${transitions.quick}`,
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
          ))
        )}
      </Card>
    </PageContainer>
  );
};
