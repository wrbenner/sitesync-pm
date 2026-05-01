// ── EntityAuditViewer ──────────────────────────────────────────────────────
// Top-level viewer that aggregates the deposition-grade audit pack for
// a single entity (RFI / Submittal / Change Order / Punch). Drops onto
// any entity detail page; the entity owner imports it once.
//
// Surfaces:
//   • HashChainBadge at the top with verification result
//   • AuditTimeline (paginated 50/page) with chain-gap rails
//   • "Sealed PDF export" button — calls supabase/functions/sealed-entity-export
//   • "Share with non-app user" button — calls supabase/functions/entity-magic-link
//
// All fetches are project-scoped via the user's RLS; the magic-link path
// (read-only viewer) uses a separate component MagicLinkEntity.tsx.

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { colors, typography, spacing } from '../../styles/theme';
import {
  verifyChain,
  type AuditLogRow,
  type ChainVerificationResult,
} from '../../lib/audit/hashChainVerifier';
import { HashChainBadge } from './HashChainBadge';
import { AuditTimeline } from './AuditTimeline';
import { toast } from 'sonner';

export type AuditEntityType = 'rfi' | 'submittal' | 'change_order' | 'punch_item';

interface EntityAuditViewerProps {
  entityType: AuditEntityType;
  entityId: string;
  projectId: string;
  /** Optional: when true, hide the Share button (e.g. magic-link view). */
  hideShare?: boolean;
}

export const EntityAuditViewer: React.FC<EntityAuditViewerProps> = ({
  entityType,
  entityId,
  projectId,
  hideShare,
}) => {
  const [page, setPage] = useState(0);
  const [verifying, setVerifying] = useState(true);
  const [chain, setChain] = useState<ChainVerificationResult | undefined>();
  const [showGapDetail, setShowGapDetail] = useState(false);

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['audit-log', entityType, entityId],
    queryFn: async (): Promise<AuditLogRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from('audit_log')
        .select(
          'id, created_at, user_id, user_email, user_name, project_id, organization_id, ' +
            'entity_type, entity_id, action, before_state, after_state, changed_fields, metadata, ' +
            'previous_hash, entry_hash',
        )
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return (data as AuditLogRow[]) ?? [];
    },
  });

  const orderedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    if (orderedRows.length === 0) {
      setChain({ ok: true, total: 0, gaps: [] });
      setVerifying(false);
      return;
    }
    setVerifying(true);
    verifyChain(orderedRows)
      .then((r) => { if (!cancelled) { setChain(r); setVerifying(false); } })
      .catch(() => { if (!cancelled) setVerifying(false); });
    return () => { cancelled = true; };
  }, [orderedRows]);

  const exportSealed = async () => {
    toast.message('Generating sealed PDF…');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb.functions.invoke('sealed-entity-export', {
      body: { entity_type: entityType, entity_id: entityId, project_id: projectId },
    });
    if (error) {
      toast.error(`Export failed: ${error.message ?? 'unknown error'}`);
      return;
    }
    const url = (data?.signed_url as string | undefined) ?? null;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('Sealed PDF ready — opened in new tab.');
    } else {
      toast.warning('Export returned no URL.');
    }
  };

  const shareMagicLink = async () => {
    const recipient = window.prompt('Recipient email (architect, owner, etc.):');
    if (!recipient) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb.functions.invoke('entity-magic-link', {
      body: {
        entity_type: entityType,
        entity_id: entityId,
        project_id: projectId,
        recipient_email: recipient,
        scope: 'comment',
      },
    });
    if (error) {
      toast.error(`Share failed: ${error.message ?? 'unknown error'}`);
      return;
    }
    const url = (data?.share_url as string | undefined) ?? null;
    if (url) {
      navigator.clipboard?.writeText(url).catch(() => undefined);
      toast.success('Magic link copied to clipboard.');
    }
  };

  return (
    <section
      style={{
        marginTop: spacing['3'],
        padding: spacing['3'],
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
      }}
    >
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          marginBottom: spacing['2'],
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: typography.fontSize.title,
            fontWeight: typography.fontWeight.semibold,
          }}
        >
          Deposition pack
        </h3>
        <HashChainBadge result={verifying ? undefined : chain} onShowDetails={() => setShowGapDetail((s) => !s)} />
        <div style={{ flex: 1 }} />
        <button onClick={exportSealed} disabled={isPending} style={primaryBtn}>
          <Download size={12} /> Sealed PDF
        </button>
        {!hideShare && (
          <button onClick={shareMagicLink} disabled={isPending} style={secondaryBtn}>
            <Send size={12} /> Share link
          </button>
        )}
      </header>

      {chain && !chain.ok && showGapDetail && (
        <div
          style={{
            marginBottom: spacing['2'],
            padding: spacing['2'],
            background: colors.statusCriticalSubtle,
            border: `1px solid ${colors.statusCritical}`,
            borderRadius: 6,
            fontSize: typography.fontSize.sm,
            color: colors.statusCritical,
          }}
        >
          <strong>Chain integrity gaps</strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {chain.gaps.slice(0, 8).map((g) => (
              <li key={g.row_id}>
                Row <code>{g.row_id.slice(0, 8)}</code>: {g.reason.replace(/_/g, ' ')}
              </li>
            ))}
            {chain.gaps.length > 8 && <li>+ {chain.gaps.length - 8} more</li>}
          </ul>
        </div>
      )}

      {isPending ? (
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
          Loading audit history…
        </p>
      ) : (
        <AuditTimeline
          rows={orderedRows}
          gaps={chain?.gaps}
          page={page}
          onChangePage={setPage}
        />
      )}
    </section>
  );
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 14px',
  border: 'none',
  borderRadius: 6,
  background: colors.primaryOrange,
  color: 'white',
  fontWeight: typography.fontWeight.semibold,
  fontSize: typography.fontSize.sm,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 14px',
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  background: 'transparent',
  color: colors.textPrimary,
  fontWeight: typography.fontWeight.medium,
  fontSize: typography.fontSize.sm,
  cursor: 'pointer',
};

export default EntityAuditViewer;
