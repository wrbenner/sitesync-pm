/**
 * OwnerPayAppPreview — public route, NO Supabase session required.
 *
 * URL pattern: /share/owner-payapp?id=<preview_id>&t=<token>
 *
 * The token IS the auth. We POST to the `owner-payapp-preview` edge
 * function which validates server-side, rotates the expiry, and returns
 * the read-only payload + comment thread + reconciliation snapshot.
 *
 * The page renders read-only line items, lets the owner thread comments,
 * and exposes a single "Approve preview" CTA. No mutations to the pay app
 * itself — that's by design; this is a preview, not a signing portal.
 */

import React, { useEffect, useState } from 'react';
import { colors, typography, spacing } from '../../styles/theme';
import {
  Eyebrow,
  Hairline,
  PageQuestion,
  SectionHeading,
  Sliver,
  OrangeDot,
} from '../../components/atoms';

interface PayAppPayload {
  id: string;
  application_number: number;
  period_to: string;
  total_completed_and_stored: number;
  retainage_amount: number;
  current_payment_due: number;
  status: string;
  project: {
    name: string;
    address: string | null;
    owner_name: string | null;
  } | null;
}

interface LineItem {
  id: string;
  item_number: string;
  description: string;
  scheduled_value: number;
  previous_completed: number;
  this_period: number;
  materials_stored: number;
  percent_complete: number;
}

interface CommentRow {
  id: string;
  author_email: string;
  author_role: string;
  comment: string;
  cost_code_anchor: string | null;
  resolved: boolean;
  created_at: string;
}

interface PreviewPayload {
  preview: {
    id: string;
    expires_at: string;
    approved_at: string | null;
    approved_by_email: string | null;
  };
  pay_app: PayAppPayload | null;
  line_items: LineItem[];
  comments: CommentRow[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

export const OwnerPayAppPreview: React.FC = () => {
  const [data, setData] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const url = new URL(window.location.href);
  const previewId = url.searchParams.get('id') ?? '';
  const token = url.searchParams.get('t') ?? '';

  useEffect(() => {
    const supaUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
    const fnUrl = `${supaUrl}/functions/v1/owner-payapp-preview?id=${encodeURIComponent(previewId)}&t=${encodeURIComponent(token)}`;
    fetch(fnUrl)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? `Status ${r.status}`);
        }
        return r.json();
      })
      .then((json: PreviewPayload) => setData(json))
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [previewId, token]);

  async function postComment() {
    if (!data || !authorEmail || !comment.trim()) return;
    setSubmitting(true);
    try {
      const supaUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
      const fnUrl = `${supaUrl}/functions/v1/owner-payapp-preview/comment`;
      const r = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: previewId, t: token, comment, author_email: authorEmail }),
      });
      if (!r.ok) throw new Error(`Status ${r.status}`);
      // Optimistically prepend the comment.
      setData({
        ...data,
        comments: [
          ...data.comments,
          {
            id: 'local-' + Date.now(),
            author_email: authorEmail,
            author_role: 'owner',
            comment,
            cost_code_anchor: null,
            resolved: false,
            created_at: new Date().toISOString(),
          },
        ],
      });
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function approvePreview() {
    if (!data || !authorEmail) return;
    setSubmitting(true);
    try {
      const supaUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
      const fnUrl = `${supaUrl}/functions/v1/owner-payapp-preview/approve`;
      const r = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: previewId, t: token, approved_by_email: authorEmail }),
      });
      if (!r.ok) throw new Error(`Status ${r.status}`);
      setData({
        ...data,
        preview: {
          ...data.preview,
          approved_at: new Date().toISOString(),
          approved_by_email: authorEmail,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: spacing['32'], maxWidth: 960, margin: '0 auto' }}>
        <Eyebrow muted>Loading…</Eyebrow>
      </main>
    );
  }

  if (error || !data || !data.pay_app) {
    return (
      <main style={{ padding: spacing['32'], maxWidth: 720, margin: '0 auto' }}>
        <Eyebrow color="orange">Pay App Preview</Eyebrow>
        <PageQuestion size="medium">This preview link can't be opened.</PageQuestion>
        <p style={{ ...typography.body, color: colors.textSecondary }}>
          {error ?? 'The token may be expired or invalid. Ask the GC to resend.'}
        </p>
      </main>
    );
  }

  const pa = data.pay_app;
  const projectName = pa.project?.name ?? 'Project';

  return (
    <main style={{ padding: spacing['32'], maxWidth: 1080, margin: '0 auto' }}>
      <Sliver
        left={projectName}
        right={`Pay App #${pa.application_number} · Through ${pa.period_to.slice(0, 10)}`}
      />

      <header>
        <Eyebrow color="orange">Owner Preview</Eyebrow>
        <PageQuestion>Does this look right?</PageQuestion>
      </header>

      <Hairline />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        <Stat label="Total completed & stored" value={fmt(pa.total_completed_and_stored)} />
        <Stat label="Retainage" value={fmt(pa.retainage_amount)} />
        <Stat label="Current payment due" value={fmt(pa.current_payment_due)} highlight />
      </section>

      <Hairline />

      <SectionHeading level={3}>Schedule of values</SectionHeading>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: spacing['12'] }}>
        <thead>
          <tr>
            {['#', 'Description', 'SOV', 'Prev', 'This period', 'Stored', '% complete'].map(h => (
              <th key={h} style={{
                ...typography.eyebrow,
                fontSize: 10,
                color: colors.textTertiary,
                textAlign: h === 'Description' ? 'left' : 'right',
                padding: '10px 8px',
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.line_items.map(li => (
            <tr key={li.id}>
              <td style={td}>{li.item_number}</td>
              <td style={{ ...td, textAlign: 'left', fontFamily: typography.fontFamilySerif }}>{li.description}</td>
              <td style={tdMono}>{fmt(li.scheduled_value)}</td>
              <td style={tdMono}>{fmt(li.previous_completed)}</td>
              <td style={tdMono}>{fmt(li.this_period)}</td>
              <td style={tdMono}>{fmt(li.materials_stored)}</td>
              <td style={tdMono}>{li.percent_complete?.toFixed(1) ?? '0.0'}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Hairline />

      <SectionHeading level={3}>Comments</SectionHeading>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {data.comments.map(c => (
          <li key={c.id} style={{
            padding: '12px 0',
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}>
            <div style={{ ...typography.eyebrow, fontSize: 10, color: colors.textTertiary }}>
              {c.author_email} · {new Date(c.created_at).toLocaleDateString()}
            </div>
            <div style={{ fontFamily: typography.fontFamilySerif, fontSize: 14, marginTop: 4 }}>
              {c.comment}
            </div>
          </li>
        ))}
        {data.comments.length === 0 && (
          <li style={{ ...typography.body, color: colors.textTertiary, padding: '12px 0' }}>
            No comments yet.
          </li>
        )}
      </ul>

      {!data.preview.approved_at && (
        <section style={{ marginTop: spacing['16'] }}>
          <input
            type="email"
            placeholder="Your email"
            value={authorEmail}
            onChange={e => setAuthorEmail(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Add a comment or request a change"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              type="button"
              disabled={submitting || !authorEmail || !comment.trim()}
              onClick={postComment}
              style={btnStyle(false)}
            >
              Post comment
            </button>
            <button
              type="button"
              disabled={submitting || !authorEmail}
              onClick={approvePreview}
              style={btnStyle(true)}
            >
              Approve preview
            </button>
          </div>
        </section>
      )}

      {data.preview.approved_at && (
        <section style={{ marginTop: spacing['16'], display: 'flex', alignItems: 'center', gap: 8 }}>
          <OrangeDot />
          <span style={{ fontFamily: typography.fontFamilySerif, fontStyle: 'italic', color: colors.textSecondary }}>
            Approved by {data.preview.approved_by_email} on {new Date(data.preview.approved_at).toLocaleDateString()}.
          </span>
        </section>
      )}
    </main>
  );
};

const td: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'right',
  fontFamily: typography.fontFamily,
  fontSize: 13,
  color: colors.textPrimary,
  borderBottom: `1px solid ${colors.borderSubtle}`,
};
const tdMono: React.CSSProperties = {
  ...td,
  fontFamily: typography.fontFamilyMono,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: typography.fontFamily,
  fontSize: 14,
  padding: '10px 12px',
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: 6,
  background: colors.surfacePage,
  color: colors.textPrimary,
};
const btnStyle = (primary: boolean): React.CSSProperties => ({
  fontFamily: typography.fontFamily,
  fontSize: 13,
  fontWeight: 500,
  padding: '10px 18px',
  borderRadius: 6,
  border: primary ? 'none' : `1px solid ${colors.borderDefault}`,
  background: primary ? colors.primaryOrange : 'transparent',
  color: primary ? '#fff' : colors.textPrimary,
  cursor: 'pointer',
});

const Stat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div>
    <div style={{ ...typography.eyebrow, fontSize: 10, color: colors.textTertiary }}>{label}</div>
    <div style={{
      fontFamily: typography.fontFamilyMono,
      fontSize: highlight ? 26 : 20,
      color: highlight ? colors.primaryOrange : colors.textPrimary,
      marginTop: 6,
    }}>
      {value}
    </div>
  </div>
);

export default OwnerPayAppPreview;
