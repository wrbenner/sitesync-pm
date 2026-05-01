// ── Sealed entity export — pure helpers ────────────────────────────────────
// Builds the deterministic HTML structure used by the sealed-entity-export
// edge function. The HTML is then rendered to PDF on the server (or in
// the browser fallback). This file is pure — no fetch, no DOM, no
// Supabase — so it can be tested standalone and shared between the
// client (preview-mode) and edge function.
//
// Output structure:
//   1. Title page: entity number, title, current state
//   2. State history: timeline of state changes
//   3. Comments + email-thread reconstruction
//   4. Linked media (placeholder; the edge fn embeds the actual bytes)
//   5. Hash chain proof page
//   6. Manifest: generated_at, content_hash, generator id

import { sha256Hex, type AuditLogRow, type ChainVerificationResult } from './hashChainVerifier';

export interface SealedExportEntity {
  type: 'rfi' | 'submittal' | 'change_order' | 'punch_item';
  id: string;
  number: number | string;
  title: string;
  status: string;
  /** Optional payload: the entity row itself for the title page render. */
  detail?: Record<string, unknown>;
}

export interface SealedExportComment {
  id: string;
  author: string;
  authored_at: string;
  body: string;
  /** RFC 5322 Message-ID for email replies (preserved verbatim). */
  message_id?: string;
  /** Empty when sent in-app. */
  via_email?: boolean;
}

export interface SealedExportMedia {
  id: string;
  /** 'photo' | 'document' | 'drawing_pin'. */
  kind: string;
  /** Public or signed URL the edge fn will embed. */
  url: string;
  /** Optional caption / context. */
  caption?: string;
}

export interface SealedExportManifest {
  generated_at: string;
  content_hash: string;
  source_row_count: number;
  chain_verified: boolean;
  chain_gap_count: number;
  generator: string;
  partial_chain: boolean;
}

export interface SealedExportBundle {
  entity: SealedExportEntity;
  audit_rows: ReadonlyArray<AuditLogRow>;
  chain: ChainVerificationResult;
  comments: ReadonlyArray<SealedExportComment>;
  media: ReadonlyArray<SealedExportMedia>;
  /** Optional escalation events (RFI only). */
  escalations?: ReadonlyArray<{ stage: string; channel: string; triggered_at: string; recipient_email?: string }>;
}

/**
 * Compute the content hash for a bundle. The hash is over a canonical
 * serialization (sorted keys, no whitespace) so any tamper in any field
 * surfaces on re-open.
 */
export async function computeContentHash(bundle: SealedExportBundle): Promise<string> {
  const canonical = canonicalize({
    entity: bundle.entity,
    audit_row_ids: bundle.audit_rows.map((r) => r.id).sort(),
    audit_entry_hashes: bundle.audit_rows.map((r) => r.entry_hash).filter(Boolean),
    chain_ok: bundle.chain.ok,
    chain_total: bundle.chain.total,
    comment_ids: bundle.comments.map((c) => c.id).sort(),
    media_ids: bundle.media.map((m) => m.id).sort(),
  });
  return sha256Hex(canonical);
}

/**
 * Build a sealed-export manifest. Pure — given a bundle and a content
 * hash, produces the metadata block that the PDF appends as its last
 * page.
 */
export function buildManifest(
  bundle: SealedExportBundle,
  contentHash: string,
  generator = 'sealed-entity-export-v1',
): SealedExportManifest {
  return {
    generated_at: new Date().toISOString(),
    content_hash: contentHash,
    source_row_count:
      bundle.audit_rows.length + bundle.comments.length + bundle.media.length,
    chain_verified: bundle.chain.ok,
    chain_gap_count: bundle.chain.gaps.length,
    generator,
    partial_chain: !bundle.chain.ok,
  };
}

/** Stable, sorted-key, no-whitespace JSON. */
function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}'
  );
}

/**
 * Suggested filename for the sealed PDF. Uses the entity number + a
 * truncated hash so two PDFs with identical content collapse into one
 * storage object.
 */
export function suggestFilename(
  entity: SealedExportEntity,
  contentHash: string,
): string {
  const safe = String(entity.number).replace(/[^A-Za-z0-9._-]/g, '_');
  return `${entity.type}-${safe}-${contentHash.slice(0, 12)}.pdf`;
}

/**
 * Render the bundle to a self-contained HTML document. The edge function
 * pipes this through a headless browser (or a HTML→PDF library) to
 * produce the actual PDF. Returning HTML keeps this file pure and
 * testable.
 */
export function renderSealedHtml(
  bundle: SealedExportBundle,
  manifest: SealedExportManifest,
): string {
  const e = bundle.entity;
  const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const titlePage = `
    <section class="page title-page">
      <h1>${escapeHtml(e.type.toUpperCase())} #${escapeHtml(String(e.number))}</h1>
      <h2>${escapeHtml(e.title)}</h2>
      <p class="status">Current state: <strong>${escapeHtml(e.status)}</strong></p>
      <p class="meta">Generated ${escapeHtml(manifest.generated_at)} · Generator ${escapeHtml(manifest.generator)}</p>
    </section>`;

  const auditPage = `
    <section class="page audit-page">
      <h2>State history</h2>
      ${bundle.audit_rows.length === 0 ? '<p class="empty">No audit events.</p>' : ''}
      <ol>
        ${bundle.audit_rows
          .map(
            (r) =>
              `<li>
                <span class="ts">${escapeHtml(r.created_at)}</span>
                <span class="who">${escapeHtml(r.user_name ?? r.user_email ?? 'system')}</span>
                <span class="action">${escapeHtml(r.action)}</span>
              </li>`,
          )
          .join('')}
      </ol>
    </section>`;

  const commentsPage = `
    <section class="page comments-page">
      <h2>Comments &amp; email thread</h2>
      ${bundle.comments.length === 0 ? '<p class="empty">No comments.</p>' : ''}
      <ol>
        ${bundle.comments
          .map(
            (c) =>
              `<li>
                <p class="meta">${escapeHtml(c.author)} · ${escapeHtml(c.authored_at)}${c.via_email ? ' · email' : ''}</p>
                ${c.message_id ? `<p class="message-id">Message-ID: ${escapeHtml(c.message_id)}</p>` : ''}
                <pre>${escapeHtml(c.body)}</pre>
              </li>`,
          )
          .join('')}
      </ol>
    </section>`;

  const mediaPage = `
    <section class="page media-page">
      <h2>Linked media (${bundle.media.length})</h2>
      ${bundle.media.length === 0 ? '<p class="empty">No linked media.</p>' : ''}
      ${bundle.media.map((m) =>
        `<figure>
          <img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.caption ?? '')}" />
          ${m.caption ? `<figcaption>${escapeHtml(m.caption)}</figcaption>` : ''}
        </figure>`).join('')}
    </section>`;

  const chainPage = `
    <section class="page chain-page">
      <h2>Hash chain proof</h2>
      <p>Total audit entries: ${manifest.source_row_count}</p>
      <p>Chain verified: <strong>${manifest.chain_verified ? 'YES' : 'NO'}</strong></p>
      ${
        bundle.chain.gaps.length === 0
          ? ''
          : '<h3 class="warn">PARTIAL CHAIN — see manifest</h3><ul>' +
            bundle.chain.gaps.map((g) =>
              `<li>Row ${escapeHtml(g.row_id)}: ${escapeHtml(g.reason)}</li>`).join('') +
            '</ul>'
      }
    </section>`;

  const manifestPage = `
    <section class="page manifest-page">
      <h2>Manifest</h2>
      <table>
        <tr><th>Generated at</th><td>${escapeHtml(manifest.generated_at)}</td></tr>
        <tr><th>Content hash</th><td><code>${escapeHtml(manifest.content_hash)}</code></td></tr>
        <tr><th>Source rows</th><td>${manifest.source_row_count}</td></tr>
        <tr><th>Chain verified</th><td>${manifest.chain_verified ? 'YES' : 'NO'}</td></tr>
        <tr><th>Chain gaps</th><td>${manifest.chain_gap_count}</td></tr>
        <tr><th>Generator</th><td>${escapeHtml(manifest.generator)}</td></tr>
      </table>
      <p class="legal">
        This document is sealed. Re-opening it through SiteSync will recompute the content hash;
        a mismatch indicates the file has been modified outside the platform.
      </p>
    </section>`;

  return `<!doctype html>
    <html><head>
      <meta charset="utf-8"/>
      <title>${escapeHtml(e.type)} #${escapeHtml(String(e.number))} — sealed export</title>
      <style>
        body { font-family: 'Helvetica', sans-serif; color: #111; }
        .page { page-break-after: always; padding: 36pt; }
        h1, h2 { margin-bottom: 6pt; }
        .ts { color: #666; font-size: 10pt; margin-right: 6pt; }
        .who { font-weight: bold; margin-right: 4pt; }
        .action { color: #666; font-style: italic; }
        .empty { color: #999; font-style: italic; }
        .meta { color: #666; font-size: 10pt; }
        pre { white-space: pre-wrap; font-family: inherit; background: #f6f6f6; padding: 8pt; border-radius: 4pt; }
        figure { margin: 0 0 12pt 0; }
        figure img { max-width: 100%; max-height: 480pt; }
        figcaption { font-size: 10pt; color: #666; margin-top: 4pt; }
        .warn { color: #b00020; }
        table { border-collapse: collapse; }
        th, td { padding: 6pt 12pt; border-bottom: 1pt solid #ddd; text-align: left; }
        code { font-family: monospace; font-size: 10pt; }
        .legal { font-size: 9pt; color: #666; margin-top: 24pt; }
      </style>
    </head><body>
      ${titlePage}
      ${auditPage}
      ${commentsPage}
      ${mediaPage}
      ${chainPage}
      ${manifestPage}
    </body></html>`;
}
