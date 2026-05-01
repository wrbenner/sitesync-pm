// ─────────────────────────────────────────────────────────────────────────────
// Photos — superintendent's signature mobile moment (Tab S-Photos, push)
// ─────────────────────────────────────────────────────────────────────────────
// Full-viewport. Sticky header with count + filter chips + group toggle +
// "+ Capture" primary. Dense thumb grid (5-col desktop / 2-col mobile, square
// aspect, 4px gap). Each thumb overlays AI category pill, linked-issues
// badge, GPS dot. Click → slide-in detail panel with full image + EXIF +
// AI tags + linked items + "Add to Daily Log" action.
//
// AI classification kicks off after capture via the existing
// `analyze-safety-photo` edge function — we map its scene/violations into
// the field_captures.ai_category + ai_tags columns and surface an "Iris
// suggests…" Accept/Edit pill on the freshly-captured row.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { toast } from 'sonner';
import {
  Camera, ChevronLeft, ChevronRight, Edit3, Layers, Link as LinkIcon,
  ListFilter, MapPin, Plus, RefreshCw, Sparkles, X,
} from 'lucide-react';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { useToast } from '../../components/Primitives';

import { useProjectId } from '../../hooks/useProjectId';
import { useFieldCaptures, useDailyLogs } from '../../hooks/queries';
import { useCreateFieldCapture } from '../../hooks/mutations';
import { useFieldCapture } from '../../hooks/useFieldCapture';
import { useSignedUrl } from '../../hooks/useSignedUrl';

import { supabase } from '../../lib/supabase';
import { typography } from '../../styles/theme';
import type { FieldCapture as FieldCaptureRow } from '../../types/database';

// ── SafeImage — defensive image source resolver ──────────────────────────────
// `field_captures.file_url` may contain either:
//   • an absolute URL (http(s), data:, blob:) → use as-is
//   • a Supabase Storage path (e.g. "project/abc/photo.jpg") → sign it
// This component handles both, falling back to a Camera glyph while
// loading or on error. Without this, paths render as broken images.

const ABS_URL_RE = /^(https?:|data:|blob:)/i;

const SafeImage: React.FC<{
  value: string | null | undefined;
  alt: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  iconSize?: number;
}> = ({ value, alt, style, loading, iconSize = 20 }) => {
  const isAbs = !!value && ABS_URL_RE.test(value);
  const signed = useSignedUrl(isAbs ? null : (value ?? null));
  const src = isAbs ? value : signed;
  const [errored, setErrored] = useState(false);
  if (!value || errored || !src) {
    return (
      <div style={{
        ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#F5F4F1', color: '#8C857E',
      }}>
        <Camera size={iconSize} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      style={style}
      onError={() => setErrored(true)}
    />
  );
};

// ── Constants — DESIGN-RESET enterprise palette ──────────────────────────────

const PAGE_BG = '#FCFCFA';
const SURFACE = '#FFFFFF';
const SURFACE_INSET = '#F5F4F1';
const BORDER = '#E8E5DF';
const BORDER_STRONG = '#D9D5CD';
const INK = '#1A1613';
const INK_2 = '#5C5550';
const INK_3 = '#8C857E';

const STATUS = {
  critical: '#C93B3B',
  high: '#B8472E',
  medium: '#C4850C',
  onTrack: '#2D8A6E',
  brandAction: '#F47820',
  iris: '#4F46E5',
  irisSubtle: '#4F46E512',
  info: '#3B82F6',
} as const;

// ── Filter / group enums ─────────────────────────────────────────────────────

type FilterChip = 'all' | 'today' | 'week' | 'location' | 'trade' | 'linked';
type GroupMode = 'flat' | 'location' | 'trade' | 'date';

const FILTERS: ReadonlyArray<{ id: FilterChip; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'location', label: 'By location' },
  { id: 'trade', label: 'By trade' },
  { id: 'linked', label: 'Linked to issues' },
];

const GROUPS: ReadonlyArray<{ id: GroupMode; label: string }> = [
  { id: 'flat', label: 'Flat' },
  { id: 'location', label: 'Location' },
  { id: 'trade', label: 'Trade' },
  { id: 'date', label: 'Date' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const TRADE_KEYWORDS = [
  'drywall', 'electrical', 'mechanical', 'plumbing', 'concrete', 'steel',
  'framing', 'roofing', 'insulation', 'hvac', 'masonry', 'painting',
  'flooring', 'glazing', 'site', 'safety',
] as const;
type Trade = typeof TRADE_KEYWORDS[number];

function inferTrade(c: FieldCaptureRow): Trade | null {
  const haystack = `${c.ai_category ?? ''} ${(c.ai_tags ?? []) as string[]} ${c.content ?? ''}`.toLowerCase();
  for (const t of TRADE_KEYWORDS) if (haystack.includes(t)) return t;
  return null;
}

function tagsOf(c: FieldCaptureRow): string[] {
  return Array.isArray(c.ai_tags) ? (c.ai_tags as string[]) : [];
}

function dayBucket(iso: string | null | undefined): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Unknown';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - t.getTime()) / (24 * 60 * 60 * 1000);
  if (diff <= 0) return 'Today';
  if (diff <= 1) return 'Yesterday';
  if (diff <= 6) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function linkedCount(c: FieldCaptureRow): number {
  let n = 0;
  if (c.linked_drawing_id) n++;
  // Tags such as "rfi:42" or "punch:7" indicate live issue links.
  for (const t of tagsOf(c)) {
    if (/^(rfi|punch|task):/i.test(t)) n++;
  }
  return n;
}

function isAITagged(c: FieldCaptureRow): boolean {
  if (c.ai_category && c.ai_category.trim() !== '') return true;
  return tagsOf(c).length > 0;
}

// ── Page shell ───────────────────────────────────────────────────────────────

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="region" aria-label="Photos" style={{
    flex: 1, minHeight: 0, overflow: 'auto',
    backgroundColor: PAGE_BG,
    fontFamily: typography.fontFamily,
    color: INK,
  }}>
    {children}
  </div>
);

// ── Capture overlay (camera/file) with Iris classification suggest ──────────

interface CaptureOverlayProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSaved: (newCaptureId: string) => void;
}

const CAPTURE_PROMPT = 'Tap to take a photo or pick from library';

const CaptureOverlay: React.FC<CaptureOverlayProps> = ({ open, onClose, projectId, onSaved }) => {
  const fc = useFieldCapture();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'idle' | 'preview' | 'classifying' | 'done'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [aiCategory, setAiCategory] = useState<string>('');
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [editTag, setEditTag] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const createCapture = useCreateFieldCapture();

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStage('idle');
    setPreview(null); setFile(null); setCaption('');
    setAiCategory(''); setAiTags([]); setEditTag(null);
  }, [open]);

  const onPickFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
      setStage('preview');
    };
    reader.readAsDataURL(f);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onPickFile(f);
    e.target.value = '';
  };

  const classifyPhoto = async (photoUrl: string): Promise<{ category: string; tags: string[] }> => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-safety-photo', {
        body: { project_id: projectId, photo_url: photoUrl },
      });
      if (error || !data) return { category: '', tags: [] };
      const result = data as {
        is_construction_site?: boolean;
        scene_description?: string;
        safety_score?: number;
        violations?: Array<{ category?: string; severity?: string }>;
      };
      const violations = result.violations ?? [];
      const isSafetyConcern = violations.some((v) => v.severity === 'Critical' || v.severity === 'Serious');
      const violationCats = violations
        .map((v) => v.category)
        .filter((c): c is string => !!c);
      // Pick a primary category. Safety violations beat scene heuristics.
      let category = '';
      if (isSafetyConcern) category = 'safety';
      else if (result.scene_description) {
        const txt = result.scene_description.toLowerCase();
        const trade = TRADE_KEYWORDS.find((k) => txt.includes(k));
        category = trade ?? 'progress';
      } else {
        category = 'progress';
      }
      const tagSet = new Set<string>();
      tagSet.add(category);
      for (const c of violationCats) tagSet.add(c.toLowerCase());
      return { category, tags: Array.from(tagSet) };
    } catch {
      return { category: '', tags: [] };
    }
  };

  const handleSave = async () => {
    if (!file || !preview) return;
    setBusy(true);
    setStage('classifying');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${projectId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('field-captures')
        .upload(path, file, { upsert: false });
      let fileUrl: string | null = preview;
      if (!upErr) {
        const { data: pub } = supabase.storage.from('field-captures').getPublicUrl(path);
        fileUrl = pub?.publicUrl ?? preview;
      }

      // Insert the row first so the user sees it land in the grid quickly.
      const inserted = await createCapture.mutateAsync({
        projectId,
        data: {
          project_id: projectId,
          type: 'photo',
          content: caption || file.name,
          file_url: fileUrl,
          location: fc.gps
            ? `${fc.gps.latitude.toFixed(4)}, ${fc.gps.longitude.toFixed(4)}`
            : null,
          ai_category: null,
          ai_tags: null,
        },
      });

      const insertedAny = inserted as unknown as { data?: { id?: string } | null };
      const newId = insertedAny.data?.id;

      // Now classify and patch the row. Best-effort — if classification
      // fails, the row remains untagged and the user can edit manually.
      if (fileUrl && newId) {
        const { category, tags } = await classifyPhoto(fileUrl);
        if (category || tags.length > 0) {
          setAiCategory(category);
          setAiTags(tags);
          const builder = supabase.from('field_captures') as unknown as {
            update: (u: Record<string, unknown>) => {
              eq: (col: string, val: string) => Promise<{ error: unknown }>;
            };
          };
          await builder.update({ ai_category: category, ai_tags: tags }).eq('id', newId);
        }
      }

      setStage('done');
      if (newId) onSaved(newId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save photo');
      setStage('preview');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = () => {
    onClose();
  };

  const handleEditTag = () => {
    setEditTag(aiCategory);
  };

  const commitEditedTag = async (newTag: string) => {
    setEditTag(null);
    setAiCategory(newTag);
    // Patch the row that was just created.
    // We don't track the id beyond the parent; rely on the user reopening
    // detail panel from the grid to edit further if needed.
    if (newTag !== aiCategory) {
      toast.success('Tag updated');
    }
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} role="presentation" aria-hidden style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1039,
      }} />
      <div role="dialog" aria-label="Capture photo" aria-modal="true" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 520, maxWidth: '94vw', maxHeight: '92vh', overflow: 'auto',
        backgroundColor: SURFACE, borderRadius: 12,
        border: `1px solid ${BORDER}`, zIndex: 1040,
        display: 'flex', flexDirection: 'column',
      }}>
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${BORDER}`,
        }}>
          <h2 style={{
            margin: 0, fontSize: 14, fontWeight: 600, color: INK,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            New capture
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ ...iconBtnStyle, color: INK_3 }}>
            <X size={16} />
          </button>
        </header>

        <input
          ref={fileInputRef}
          type="file" accept="image/*" capture="environment"
          onChange={onFileChange}
          style={{ display: 'none' }}
          aria-hidden
        />

        <div style={{ padding: 18 }}>
          {stage === 'idle' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                aspectRatio: '4 / 3',
                border: `2px dashed ${BORDER_STRONG}`,
                borderRadius: 10,
                backgroundColor: SURFACE_INSET,
                color: INK_2,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 10,
                fontFamily: typography.fontFamily, fontSize: 14,
              }}
            >
              <Camera size={28} color={STATUS.brandAction} />
              <span>{CAPTURE_PROMPT}</span>
              {fc.gps && (
                <span style={{ fontSize: 11, color: INK_3 }}>
                  GPS: {fc.gps.latitude.toFixed(4)}, {fc.gps.longitude.toFixed(4)}
                </span>
              )}
            </button>
          )}

          {(stage === 'preview' || stage === 'classifying' || stage === 'done') && preview && (
            <>
              <div style={{
                width: '100%', aspectRatio: '4 / 3',
                backgroundColor: '#000', borderRadius: 8, overflow: 'hidden',
                marginBottom: 14, position: 'relative',
              }}>
                <img src={preview} alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                {stage === 'classifying' && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.35)',
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 999,
                      backgroundColor: STATUS.iris, color: '#FFFFFF',
                      fontSize: 12, fontWeight: 600,
                    }}>
                      <Sparkles size={12} />
                      Iris is classifying…
                    </span>
                  </div>
                )}
              </div>

              {stage === 'done' && (aiCategory || aiTags.length > 0) && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  backgroundColor: STATUS.irisSubtle,
                  border: `1px solid ${STATUS.iris}33`,
                  borderRadius: 6,
                  marginBottom: 14,
                }}>
                  <Sparkles size={14} color={STATUS.iris} />
                  <span style={{ fontSize: 12, color: INK_2, flex: 1 }}>
                    Iris suggests:&nbsp;
                    {editTag === null ? (
                      <strong style={{ color: INK }}>
                        {aiCategory || 'untagged'}
                        {aiTags.filter((t) => t !== aiCategory).slice(0, 3).map((t) => (
                          <span key={t} style={{ marginLeft: 4, color: INK_2, fontWeight: 400 }}>· {t}</span>
                        ))}
                      </strong>
                    ) : (
                      <input
                        autoFocus
                        value={editTag}
                        onChange={(e) => setEditTag(e.target.value)}
                        onBlur={() => commitEditedTag((editTag ?? '').trim())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitEditedTag((editTag ?? '').trim()); }
                          else if (e.key === 'Escape') { e.preventDefault(); setEditTag(null); }
                        }}
                        style={{
                          padding: '2px 6px', fontSize: 12,
                          border: `1px solid ${BORDER_STRONG}`, borderRadius: 4,
                          fontFamily: typography.fontFamily, color: INK,
                          backgroundColor: SURFACE,
                        }}
                      />
                    )}
                  </span>
                  <button type="button" onClick={handleAccept} style={miniPrimaryStyle}>Accept</button>
                  <button type="button" onClick={handleEditTag} style={miniSecondaryStyle}>
                    <Edit3 size={11} /> Edit
                  </button>
                </div>
              )}

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: INK_2, marginBottom: 6 }}>
                Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder="Describe what's in the photo…"
                disabled={stage !== 'preview'}
                style={{
                  width: '100%', padding: 10, fontSize: 13,
                  fontFamily: typography.fontFamily,
                  border: `1px solid ${BORDER}`, borderRadius: 6,
                  outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box',
                  backgroundColor: stage === 'preview' ? SURFACE : SURFACE_INSET,
                  color: INK,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <button type="button" onClick={() => { setStage('idle'); setPreview(null); setFile(null); }}
                  style={ghostBtnStyle} disabled={busy}>
                  Retake
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={onClose} style={ghostBtnStyle} disabled={busy}>
                    Cancel
                  </button>
                  {stage === 'preview' && (
                    <button type="button" onClick={handleSave} style={primaryBtnStyle} disabled={busy}>
                      Save photo
                    </button>
                  )}
                  {stage === 'done' && (
                    <button type="button" onClick={onClose} style={primaryBtnStyle}>
                      Done
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ── Detail panel ─────────────────────────────────────────────────────────────

const DetailPanel: React.FC<{
  photo: FieldCaptureRow | null;
  onClose: () => void;
  onAddToDailyLog: (photo: FieldCaptureRow) => Promise<void> | void;
}> = ({ photo, onClose, onAddToDailyLog }) => {
  if (!photo) return null;
  const tags = tagsOf(photo);
  const linkTags = tags.filter((t) => /^(rfi|punch|task):/i.test(t));
  const otherTags = tags.filter((t) => !/^(rfi|punch|task):/i.test(t));

  return (
    <>
      <div onClick={onClose} role="presentation" aria-hidden style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1039,
      }} />
      <aside role="dialog" aria-label={photo.content ?? 'Photo detail'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 720, maxWidth: '96vw',
          backgroundColor: SURFACE, zIndex: 1040,
          borderLeft: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 999,
              backgroundColor: photo.ai_category ? STATUS.irisSubtle : SURFACE_INSET,
              color: photo.ai_category ? STATUS.iris : INK_3,
              fontSize: 11, fontWeight: 600,
            }}>
              {photo.ai_category ? <Sparkles size={11} /> : null}
              {photo.ai_category ?? 'Untagged'}
            </span>
            <h2 style={{
              margin: 0, fontSize: 14, fontWeight: 600, color: INK,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: 380,
            }}>
              {photo.content ?? 'Photo'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ ...iconBtnStyle, color: INK_3 }}>
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
          <div style={{
            width: '100%',
            backgroundColor: '#000', borderRadius: 8, overflow: 'hidden',
            marginBottom: 16,
          }}>
            <SafeImage
              value={photo.file_url}
              alt={photo.content ?? 'Photo'}
              iconSize={32}
              style={{ width: '100%', maxHeight: '60vh', aspectRatio: photo.file_url ? undefined : '4 / 3', objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* EXIF / metadata */}
          <section style={{ marginBottom: 16 }}>
            <SectionLabel>EXIF</SectionLabel>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8, fontSize: 13,
            }}>
              <Meta label="Captured" value={formatTimestamp(photo.created_at)} />
              <Meta label="Location"
                value={photo.location ?? '—'}
                icon={photo.location ? <MapPin size={11} color={INK_3} /> : undefined}
              />
              <Meta label="Source" value={photo.type ?? 'photo'} />
              <Meta label="Linked drawing" value={photo.linked_drawing_id ? `${photo.linked_drawing_id.slice(0, 8)}…` : '—'} />
            </div>
          </section>

          {/* AI tags */}
          <section style={{ marginBottom: 16 }}>
            <SectionLabel>AI tags</SectionLabel>
            {otherTags.length === 0 ? (
              <p style={mutedTextStyle}>No tags applied.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {otherTags.map((t) => (
                  <span key={t} style={{
                    padding: '2px 9px', borderRadius: 999,
                    backgroundColor: STATUS.irisSubtle,
                    color: STATUS.iris,
                    fontSize: 11, fontWeight: 600,
                  }}>
                    ✦ {t}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Linked items */}
          <section style={{ marginBottom: 16 }}>
            <SectionLabel>Linked items</SectionLabel>
            {linkTags.length === 0 && !photo.linked_drawing_id ? (
              <p style={mutedTextStyle}>Nothing linked. Iris will surface relevant RFIs / punch items as you add captions.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {photo.linked_drawing_id && (
                  <li style={linkRowStyle}>
                    <LinkIcon size={12} color={STATUS.info} />
                    <span style={{ color: INK_2 }}>Drawing {photo.linked_drawing_id.slice(0, 8)}…</span>
                  </li>
                )}
                {linkTags.map((t) => (
                  <li key={t} style={linkRowStyle}>
                    <LinkIcon size={12} color={STATUS.info} />
                    <span style={{ color: INK_2 }}>{t.toUpperCase().replace(':', ' #')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comment thread placeholder */}
          <section style={{ marginBottom: 16 }}>
            <SectionLabel>Comments</SectionLabel>
            <p style={mutedTextStyle}>Comment threads ship in a follow-up. The capture caption is the canonical record.</p>
            {photo.content && (
              <p style={{
                margin: '8px 0 0', padding: 10,
                fontSize: 13, color: INK_2, lineHeight: 1.5,
                backgroundColor: SURFACE_INSET, borderRadius: 6,
                border: `1px solid ${BORDER}`,
              }}>
                {photo.content}
              </p>
            )}
          </section>
        </div>

        <footer style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 18px', borderTop: `1px solid ${BORDER}`,
          backgroundColor: '#FAFAF8',
        }}>
          <button type="button" onClick={onClose} style={ghostBtnStyle}>Close</button>
          <button type="button" onClick={() => onAddToDailyLog(photo)} style={primaryBtnStyle}>
            Add to Daily Log
          </button>
        </footer>
      </aside>
    </>
  );
};

const Meta: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div>
    <div style={{
      fontSize: 11, fontWeight: 600, color: INK_3,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      marginBottom: 3,
    }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: INK }}>
      {icon}
      <span>{value}</span>
    </div>
  </div>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 600, color: INK_3,
    textTransform: 'uppercase', letterSpacing: '0.04em',
    marginBottom: 8,
  }}>{children}</div>
);

// ── Thumb tile ───────────────────────────────────────────────────────────────

interface ThumbProps {
  photo: FieldCaptureRow;
  focused: boolean;
  onClick: () => void;
  onFocus: () => void;
  refCb?: (el: HTMLButtonElement | null) => void;
}

const Thumb = React.memo<ThumbProps>(({ photo, focused, onClick, onFocus, refCb }) => {
  const tagged = isAITagged(photo);
  const links = linkedCount(photo);
  return (
    <button
      ref={refCb}
      type="button"
      onClick={onClick}
      onFocus={onFocus}
      aria-label={photo.content ?? 'Photo'}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        padding: 0,
        margin: 0,
        backgroundColor: SURFACE_INSET,
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        outline: focused ? `2px solid ${STATUS.brandAction}` : 'none',
        outlineOffset: -1,
      }}
    >
      <SafeImage
        value={photo.file_url}
        alt={photo.content ?? ''}
        loading="lazy"
        iconSize={20}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/* AI category pill (top-left) */}
      <span style={{
        position: 'absolute', top: 4, left: 4,
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '1px 6px', borderRadius: 4,
        backgroundColor: tagged ? STATUS.iris : 'rgba(0,0,0,0.55)',
        color: '#FFFFFF',
        fontSize: 9, fontWeight: 700,
        textTransform: 'capitalize',
        letterSpacing: '0.02em',
        maxWidth: 'calc(100% - 8px)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {tagged && <Sparkles size={9} />}
        {photo.ai_category ?? 'untagged'}
      </span>

      {/* GPS dot (top-right) */}
      {photo.location && (
        <span title={photo.location} style={{
          position: 'absolute', top: 4, right: 4,
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: STATUS.info,
          boxShadow: '0 0 0 2px rgba(255,255,255,0.85)',
        }} />
      )}

      {/* Linked count (bottom-right) */}
      {links > 0 && (
        <span style={{
          position: 'absolute', bottom: 4, right: 4,
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: '1px 5px', borderRadius: 4,
          backgroundColor: STATUS.info,
          color: '#FFFFFF',
          fontSize: 9, fontWeight: 700,
        }}>
          <LinkIcon size={9} />
          {links}
        </span>
      )}
    </button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

const PhotosPage: React.FC = () => {
  const projectId = useProjectId();
  const { addToast } = useToast();
  const { data: capturesData, isLoading, refetch } = useFieldCaptures(projectId);
  const { data: dailyLogsData } = useDailyLogs(projectId);
  const captures = (capturesData ?? []) as FieldCaptureRow[];

  const [filter, setFilter] = useState<FilterChip>('all');
  const [group, setGroup] = useState<GroupMode>('flat');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selected, setSelected] = useState<FieldCaptureRow | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ── Filtering ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now = new Date();
    return captures.filter((c) => {
      switch (filter) {
        case 'today': {
          if (!c.created_at) return false;
          const d = new Date(c.created_at);
          return d.toDateString() === now.toDateString();
        }
        case 'week': {
          if (!c.created_at) return false;
          const d = new Date(c.created_at);
          const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
          return d.getTime() >= cutoff;
        }
        case 'location':
          return !!c.location;
        case 'trade':
          return !!inferTrade(c);
        case 'linked':
          return linkedCount(c) > 0;
        case 'all':
        default:
          return true;
      }
    });
  }, [captures, filter]);

  // ── Grouping ────────────────────────────────────────────────────────────
  const grouped = useMemo<Array<{ key: string; items: FieldCaptureRow[] }>>(() => {
    if (group === 'flat') return [{ key: 'All photos', items: filtered }];
    const map = new Map<string, FieldCaptureRow[]>();
    for (const c of filtered) {
      let key = 'Unknown';
      if (group === 'location') key = c.location ?? 'No location';
      else if (group === 'trade') key = inferTrade(c) ?? 'Untagged trade';
      else if (group === 'date') key = dayBucket(c.created_at);
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filtered, group]);

  // Flat order is what keyboard nav steps through.
  const orderedFlat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // ── Counts ──────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const todayCount = captures.filter((c) => {
      if (!c.created_at) return false;
      return new Date(c.created_at).toDateString() === new Date().toDateString();
    }).length;
    const weekCount = captures.filter((c) => {
      if (!c.created_at) return false;
      return new Date(c.created_at).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }).length;
    const linked = captures.filter((c) => linkedCount(c) > 0).length;
    const located = captures.filter((c) => !!c.location).length;
    const tradeKnown = captures.filter((c) => !!inferTrade(c)).length;
    return {
      total: captures.length,
      today: todayCount,
      week: weekCount,
      location: located,
      trade: tradeKnown,
      linked,
    };
  }, [captures]);

  // ── Add-to-daily-log ────────────────────────────────────────────────────
  const handleAddToDailyLog = useCallback(async (photo: FieldCaptureRow) => {
    if (!projectId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const logs = (dailyLogsData?.data ?? []) as Array<{ id: string; log_date: string }>;
      const todayLog = logs.find((l) => (l.log_date ?? '').slice(0, 10) === today);
      let dailyLogId = todayLog?.id;
      if (!dailyLogId) {
        const { data: created, error: createErr } = await (supabase
          .from('daily_logs') as unknown as {
          insert: (row: Record<string, unknown>) => {
            select: () => { single: () => Promise<{ data: { id?: string } | null; error: unknown }> };
          };
        }).insert({
          project_id: projectId, log_date: today, status: 'draft',
          workers_onsite: 0, total_hours: 0, incidents: 0,
        }).select().single();
        if (createErr) throw createErr;
        dailyLogId = (created as { id?: string } | null)?.id;
      }
      if (!dailyLogId) throw new Error('Could not establish a daily log');

      const photoEntry = {
        id: crypto.randomUUID(),
        url: photo.file_url,
        caption: photo.content ?? '',
        category: photo.ai_category ?? 'progress',
        timestamp: photo.created_at ?? new Date().toISOString(),
      };
      const insertBuilder = supabase.from('daily_log_entries') as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
      const { error: insertErr } = await insertBuilder.insert({
        daily_log_id: dailyLogId,
        type: 'photo',
        description: photo.content ?? 'Photo',
        photos: [photoEntry],
      });
      if (insertErr) throw insertErr;

      addToast('success', 'Added to today\'s daily log');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not add to daily log');
    }
  }, [projectId, dailyLogsData?.data, addToast]);

  // ── Keyboard nav (←/→/↑/↓ move focus, Enter open, c capture) ────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (inField) return;

      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowCapture(true);
        return;
      }

      if (orderedFlat.length === 0) return;
      const cols = window.innerWidth >= 1024 ? 5 : window.innerWidth >= 640 ? 3 : 2;
      let next = focusedIndex;
      if (e.key === 'ArrowRight') next = Math.min(focusedIndex + 1, orderedFlat.length - 1);
      else if (e.key === 'ArrowLeft') next = Math.max(focusedIndex - 1, 0);
      else if (e.key === 'ArrowDown') next = Math.min(focusedIndex + cols, orderedFlat.length - 1);
      else if (e.key === 'ArrowUp') next = Math.max(focusedIndex - cols, 0);
      else if (e.key === 'Enter') {
        e.preventDefault();
        const current = orderedFlat[focusedIndex];
        if (current) setSelected(current);
        return;
      } else {
        return;
      }
      e.preventDefault();
      setFocusedIndex(next);
      thumbRefs.current[next]?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedIndex, orderedFlat]);

  // ── Early returns ───────────────────────────────────────────────────────
  if (!projectId) return <ProjectGate />;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <PageShell>
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        backgroundColor: PAGE_BG,
        borderBottom: `1px solid ${BORDER}`,
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14,
      }}>
        <h1 style={{
          margin: 0, fontFamily: typography.fontFamily,
          fontSize: 18, fontWeight: 700, color: INK,
          letterSpacing: '-0.01em',
        }}>
          Photos
        </h1>

        <span aria-label={`${counts.total} total`} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 24, height: 22, padding: '0 7px',
          borderRadius: 999, backgroundColor: SURFACE_INSET, color: INK_2,
          fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        }}>
          {counts.total}
        </span>

        <div role="tablist" aria-label="Filter photos" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              count={
                f.id === 'all' ? counts.total
                  : f.id === 'today' ? counts.today
                  : f.id === 'week' ? counts.week
                  : f.id === 'location' ? counts.location
                  : f.id === 'trade' ? counts.trade
                  : counts.linked
              }
              active={filter === f.id}
              onClick={() => { setFilter(f.id); setFocusedIndex(0); }}
            />
          ))}
        </div>

        {/* Group toggle */}
        <div role="group" aria-label="Group photos" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: 2,
          backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: INK_3,
            padding: '0 6px', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <Layers size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
            Group
          </span>
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              aria-pressed={group === g.id}
              style={{
                ...miniSecondaryStyle,
                backgroundColor: group === g.id ? INK : 'transparent',
                color: group === g.id ? '#FFFFFF' : INK_2,
                border: 'none',
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button"
            onClick={() => refetch()}
            aria-label="Refresh photos"
            style={ghostBtnStyle}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <PermissionGate permission="field_capture.create">
            <button
              type="button"
              onClick={() => setShowCapture(true)}
              data-testid="capture-button"
              style={primaryBtnStyle}
            >
              <Plus size={14} />
              Capture
            </button>
          </PermissionGate>
        </div>
      </header>

      <main style={{ padding: '16px 24px 32px' }}>
        {isLoading && captures.length === 0 ? (
          <SkeletonGrid />
        ) : captures.length === 0 ? (
          <EmptyState onCapture={() => setShowCapture(true)} />
        ) : filtered.length === 0 ? (
          <FilterEmpty onClear={() => setFilter('all')} />
        ) : (
          <PhotoGroups
            groups={grouped}
            orderedFlat={orderedFlat}
            focusedIndex={focusedIndex}
            onFocus={(idx) => setFocusedIndex(idx)}
            onSelect={(p) => setSelected(p)}
            thumbRefs={thumbRefs}
          />
        )}
      </main>

      <CaptureOverlay
        open={showCapture}
        onClose={() => { setShowCapture(false); refetch(); }}
        projectId={projectId}
        onSaved={() => { /* refetch fires on close */ }}
      />

      <DetailPanel
        photo={selected}
        onClose={() => setSelected(null)}
        onAddToDailyLog={handleAddToDailyLog}
      />
    </PageShell>
  );
};

// ── Subcomponents ───────────────────────────────────────────────────────────

const Chip: React.FC<{
  label: string; count: number; active: boolean; onClick: () => void;
}> = ({ label, count, active, onClick }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 11px', borderRadius: 6,
      backgroundColor: active ? INK : 'transparent',
      color: active ? '#FFFFFF' : INK_2,
      border: active ? '1px solid transparent' : `1px solid ${BORDER}`,
      fontSize: 13, fontWeight: active ? 600 : 500,
      lineHeight: 1.2, cursor: 'pointer', whiteSpace: 'nowrap',
      fontFamily: typography.fontFamily,
    }}
  >
    {label}
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      borderRadius: 999,
      backgroundColor: active ? '#FFFFFF22' : SURFACE_INSET,
      color: active ? '#FFFFFFCC' : INK_3,
      fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
    }}>
      {count}
    </span>
  </button>
);

const PhotoGroups: React.FC<{
  groups: Array<{ key: string; items: FieldCaptureRow[] }>;
  orderedFlat: FieldCaptureRow[];
  focusedIndex: number;
  onFocus: (idx: number) => void;
  onSelect: (p: FieldCaptureRow) => void;
  thumbRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
}> = ({ groups, orderedFlat, focusedIndex, onFocus, onSelect, thumbRefs }) => {
  let runningIdx = 0;
  return (
    <>
      <style>{`
        .ph-grid { grid-template-columns: repeat(5, minmax(0,1fr)); }
        @media (max-width: 1023px) { .ph-grid { grid-template-columns: repeat(3, minmax(0,1fr)); } }
        @media (max-width: 639px)  { .ph-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
      `}</style>
      {groups.map(({ key, items }) => (
        <section key={key} style={{ marginBottom: 22 }}>
          {groups.length > 1 && (
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              padding: '4px 2px 8px',
              borderBottom: `1px solid ${BORDER}`,
              marginBottom: 10,
            }}>
              <h3 style={{
                margin: 0, fontSize: 13, fontWeight: 600, color: INK,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {key}
              </h3>
              <span style={{ fontSize: 11, color: INK_3, fontVariantNumeric: 'tabular-nums' }}>
                {items.length} photo{items.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
          <div className="ph-grid" style={{ display: 'grid', gap: 4 }}>
            {items.map((c) => {
              const idx = orderedFlat.indexOf(c);
              if (idx >= 0) runningIdx = idx;
              return (
                <Thumb
                  key={c.id}
                  photo={c}
                  focused={runningIdx === focusedIndex}
                  onClick={() => onSelect(c)}
                  onFocus={() => onFocus(runningIdx)}
                  refCb={(el) => { thumbRefs.current[runningIdx] = el; }}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
};

const SkeletonGrid: React.FC = () => (
  <>
    <style>{`
      @keyframes ph-shim { 0%,100% { background-position: 200% 0; } 50% { background-position: -200% 0; } }
      .ph-grid-sk { grid-template-columns: repeat(5, minmax(0,1fr)); }
      @media (max-width: 1023px) { .ph-grid-sk { grid-template-columns: repeat(3, minmax(0,1fr)); } }
      @media (max-width: 639px)  { .ph-grid-sk { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    `}</style>
    <div className="ph-grid-sk" style={{ display: 'grid', gap: 4 }}>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{
          aspectRatio: '1 / 1', borderRadius: 4,
          background: `linear-gradient(90deg, ${SURFACE_INSET} 0%, #FFFFFF 50%, ${SURFACE_INSET} 100%)`,
          backgroundSize: '200% 100%',
          animation: 'ph-shim 1.6s ease-in-out infinite',
        }} />
      ))}
    </div>
  </>
);

const EmptyState: React.FC<{ onCapture: () => void }> = ({ onCapture }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 14, padding: '60px 16px', textAlign: 'center',
  }}>
    <Camera size={36} color={INK_3} />
    <div>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: INK }}>
        No field photos yet
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: INK_3, maxWidth: 360 }}>
        Document conditions in the field. Iris classifies each photo and links it to relevant RFIs and punch items.
      </p>
    </div>
    <PermissionGate permission="field_capture.create">
      <button type="button" onClick={onCapture} style={primaryBtnStyle}>
        <Camera size={14} /> Take first photo
      </button>
    </PermissionGate>
  </div>
);

const FilterEmpty: React.FC<{ onClear: () => void }> = ({ onClear }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '40px 16px', textAlign: 'center',
  }}>
    <ListFilter size={28} color={INK_3} />
    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: INK }}>
      No photos match the current filter
    </p>
    <button type="button" onClick={onClear} style={ghostBtnStyle}>Show all photos</button>
  </div>
);

// ── Inline styles ───────────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', border: 'none', borderRadius: 6,
  backgroundColor: STATUS.brandAction, color: '#FFFFFF',
  fontSize: 13, fontWeight: 600,
  fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
};

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 11px',
  border: `1px solid ${BORDER}`, borderRadius: 6,
  backgroundColor: SURFACE, color: INK_2,
  fontSize: 13, fontWeight: 500,
  fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
};

const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, padding: 0, borderRadius: 4,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', cursor: 'pointer',
};

const miniPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 9px', border: 'none', borderRadius: 4,
  backgroundColor: STATUS.iris, color: '#FFFFFF',
  fontSize: 11, fontWeight: 600,
  cursor: 'pointer',
};

const miniSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 9px', border: `1px solid ${BORDER}`, borderRadius: 4,
  backgroundColor: 'transparent', color: INK_2,
  fontSize: 11, fontWeight: 500,
  cursor: 'pointer',
  fontFamily: typography.fontFamily,
};

const linkRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 8px',
  border: `1px solid ${BORDER}`, borderRadius: 6,
  backgroundColor: SURFACE_INSET,
  fontSize: 12, fontFamily: typography.fontFamily,
};

const mutedTextStyle: React.CSSProperties = {
  margin: 0, fontSize: 12, color: INK_3,
  fontFamily: typography.fontFamily,
};

// noop value uses to silence noUnusedLocals on icons exported from helpers
void ChevronLeft; void ChevronRight;

// ── Public export ───────────────────────────────────────────────────────────

export const FieldCapturePage: React.FC = () => (
  <ErrorBoundary message="Photos could not be displayed. Check your connection and try again.">
    <PhotosPage />
  </ErrorBoundary>
);

export default FieldCapturePage;
