import React, { useState, useRef, useMemo } from 'react';
import { Camera, MapPin, Sparkles, RefreshCw, AlertTriangle, LayoutGrid, Map as MapIcon, X, Tag, Mic } from 'lucide-react';
import { PageContainer, Card, Btn, useToast } from '../components/Primitives';
import { ErrorBoundary } from '../components/ErrorBoundary';
import FieldCaptureSkeleton from '../components/field/FieldCaptureSkeleton';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useFieldCaptures } from '../hooks/queries';
import { useCreateFieldCapture } from '../hooks/mutations';
import { useSyncStatus } from '../hooks/useSyncStatus';
import type { FieldCapture } from '../types/database';

const CONSTRUCTION_TAGS = ['progress', 'safety', 'quality', 'defect', 'delivery'] as const;

const LINK_OPTIONS = [
  { label: 'RFI #12 — Beam pocket depth', value: 'rfi:12' },
  { label: 'RFI #14 — Slab thickness', value: 'rfi:14' },
  { label: 'Punch Item #45 — Paint defect', value: 'punch:45' },
  { label: 'Punch Item #52 — Door hardware', value: 'punch:52' },
  { label: 'Daily Log — Today', value: 'daily_log:today' },
];

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ── Skeleton grid for loading state ────────────────────────

const SkeletonGrid: React.FC = () => (
  <>
    <style>{`@keyframes fieldCapturePulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'] }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.xl,
            aspectRatio: '4/3',
            animation: 'fieldCapturePulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  </>
);

// ── Post-capture overlay form ───────────────────────────────

interface OverlayMeta {
  title: string;
  notes: string;
  tags: string[];
  linkTo: string;
  location: string | null;
}

interface PhotoOverlayProps {
  dataUrl: string;
  location: string | null;
  isSaving: boolean;
  onSave: (meta: OverlayMeta) => void;
  onCancel: () => void;
}

const PhotoOverlay: React.FC<PhotoOverlayProps> = ({ dataUrl, location, isSaving, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [linkTo, setLinkTo] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing['3']} ${spacing['3']}`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: colors.surfacePage,
    minHeight: '44px',
  };

  return (
    <div
      role="dialog"
      aria-label="Add photo details"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal as number,
        backgroundColor: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: `${borderRadius['2xl']} ${borderRadius['2xl']} 0 0`,
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Preview image */}
        <div style={{ position: 'relative' }}>
          <img
            src={dataUrl}
            alt="Captured photo preview"
            style={{
              width: '100%',
              maxHeight: '220px',
              objectFit: 'cover',
              borderRadius: `${borderRadius['2xl']} ${borderRadius['2xl']} 0 0`,
              display: 'block',
            }}
          />
          <button
            aria-label="Close"
            onClick={onCancel}
            style={{
              position: 'absolute',
              top: spacing['3'],
              right: spacing['3'],
              width: '32px',
              height: '32px',
              borderRadius: borderRadius.full,
              backgroundColor: 'rgba(0,0,0,0.55)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color="#fff" />
          </button>
        </div>

        {/* Form fields */}
        <div style={{ padding: spacing['5'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* Timestamp + GPS row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`,
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.full,
              }}
            >
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </div>
          {/* GPS badge */}
          {location && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`,
                backgroundColor: `${colors.primaryOrange}12`,
                borderRadius: borderRadius.full,
                alignSelf: 'flex-start',
              }}
            >
              <MapPin size={12} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>
                {location}
              </span>
            </div>
          )}

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title (optional)"
            style={inputStyle}
          />

          {/* Notes */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              style={{
                ...inputStyle,
                minHeight: '80px',
                resize: 'vertical',
                paddingRight: spacing['10'],
              }}
            />
            <button
              type="button"
              aria-label="Voice to text (coming soon)"
              title="Voice to text"
              style={{
                position: 'absolute',
                top: spacing['3'],
                right: spacing['3'],
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: colors.textTertiary,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Mic size={16} />
            </button>
          </div>

          {/* Tags multi-select */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
              <Tag size={13} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>
                Tags
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
              {CONSTRUCTION_TAGS.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: `${spacing['1.5']} ${spacing['3']}`,
                      minHeight: '32px',
                      backgroundColor: active ? colors.primaryOrange : 'transparent',
                      color: active ? colors.white : colors.textSecondary,
                      border: `1px solid ${active ? colors.primaryOrange : colors.borderDefault}`,
                      borderRadius: borderRadius.full,
                      cursor: 'pointer',
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      fontFamily: typography.fontFamily,
                      transition: `all ${transitions.quick}`,
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Link to */}
          <select
            value={linkTo}
            onChange={e => setLinkTo(e.target.value)}
            aria-label="Link photo to an item"
            style={{
              ...inputStyle,
              appearance: 'auto',
              color: linkTo ? colors.textPrimary : colors.textTertiary,
            }}
          >
            <option value="">Link to drawing, task, punch, RFI, or daily log (optional)</option>
            {LINK_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Actions */}
          <div style={{ display: 'flex', gap: spacing['3'], paddingBottom: spacing['2'] }}>
            <Btn variant="ghost" size="md" onClick={onCancel} style={{ flex: 1, minHeight: '44px' } as React.CSSProperties}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              size="md"
              onClick={() => onSave({ title, notes, tags: selectedTags, linkTo, location })}
              disabled={isSaving}
              style={{ flex: 1, minHeight: '44px' } as React.CSSProperties}
            >
              {isSaving ? 'Saving...' : 'Save Photo'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Photo card (grid tile) ─────────────────────────────────

interface PhotoCardProps {
  capture: FieldCapture;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ capture }) => {
  const [hovered, setHovered] = useState(false);
  const tags = Array.isArray(capture.ai_tags) ? (capture.ai_tags as string[]) : [];
  const hasAiFlag = !!capture.ai_category;

  return (
    <div
      role="article"
      aria-label={`Field capture: ${capture.content || 'Photo'}`}
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        boxShadow: hovered ? shadows.cardHover : shadows.card,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: `box-shadow ${transitions.quick}`,
      }}
    >
      {/* Thumbnail */}
      {capture.file_url ? (
        <img
          src={capture.file_url}
          alt={capture.content || 'Field capture'}
          style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '4/3',
            backgroundColor: colors.surfaceInset,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Camera size={28} color={colors.textTertiary} />
        </div>
      )}

      {/* Weather tag badge */}
      {tags.includes('weather') && (
        <div
          style={{
            position: 'absolute',
            bottom: spacing['2'],
            left: spacing['2'],
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: borderRadius.full,
            padding: `${spacing['1']} ${spacing['2']}`,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span style={{ fontSize: '10px', color: '#fff', fontWeight: typography.fontWeight.medium }}>weather</span>
        </div>
      )}

      {/* AI sparkle badge */}
      {hasAiFlag && (
        <div
          style={{
            position: 'absolute',
            top: spacing['2'],
            right: spacing['2'],
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: borderRadius.full,
            padding: `${spacing['1']} ${spacing['2']}`,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Sparkles size={11} color="#fff" />
          <span style={{ fontSize: '10px', color: '#fff', fontWeight: typography.fontWeight.semibold }}>
            {capture.ai_category}
          </span>
        </div>
      )}

      {/* GPS badge */}
      {capture.location && (
        <div
          style={{
            position: 'absolute',
            top: spacing['2'],
            left: spacing['2'],
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: borderRadius.full,
            padding: `${spacing['1']} ${spacing['2']}`,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <MapPin size={10} color="#fff" />
          <span style={{ fontSize: '10px', color: '#fff' }}>{capture.location}</span>
        </div>
      )}

      {/* Info footer */}
      <div style={{ padding: `${spacing['2']} ${spacing['3']} ${spacing['3']}` }}>
        {capture.content && (
          <p
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              margin: 0,
              marginBottom: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {capture.content}
          </p>
        )}
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
          {formatTimestamp(capture.created_at)}
        </p>

        {/* Tag pills */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: spacing['1'] }}>
            {tags.slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                style={{
                  padding: '1px 6px',
                  backgroundColor: `${colors.primaryOrange}14`,
                  color: colors.primaryOrange,
                  borderRadius: borderRadius.full,
                  fontSize: '10px',
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Linked item badge */}
        {capture.linked_drawing_id && (
          <div style={{ marginTop: spacing['1'] }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 6px',
                backgroundColor: `${colors.statusInfo}14`,
                color: colors.statusInfo,
                borderRadius: borderRadius.full,
                fontSize: '10px',
                fontWeight: typography.fontWeight.medium,
              }}
            >
              Drawing linked
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Map view placeholder ────────────────────────────────────

const MapView: React.FC<{ captures: FieldCapture[] }> = ({ captures }) => {
  const withLocation = captures.filter(c => c.location);
  return (
    <div
      style={{
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.xl,
        border: `1px dashed ${colors.borderDefault}`,
        padding: spacing['10'],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '320px',
        gap: spacing['4'],
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: `${colors.statusInfo}14`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MapIcon size={28} color={colors.statusInfo} />
      </div>
      <div>
        <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>
          Map view
        </p>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>
          Mapbox is not configured. {withLocation.length} capture{withLocation.length !== 1 ? 's' : ''} have location data.
        </p>
      </div>
      {withLocation.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], justifyContent: 'center', maxWidth: '400px' }}>
          {withLocation.slice(0, 8).map(c => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1.5']} ${spacing['3']}`,
                backgroundColor: colors.white,
                borderRadius: borderRadius.full,
                boxShadow: shadows.card,
                fontSize: typography.fontSize.caption,
                color: colors.textSecondary,
              }}
            >
              <MapPin size={10} color={colors.primaryOrange} />
              {c.location}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main inner component ────────────────────────────────────

const FieldCaptureInner: React.FC = () => {
  const projectId = useProjectId();
  const { data: capturesData, isLoading, isError, error, refetch } = useFieldCaptures(projectId);
  const captures = capturesData ?? [];
  const { pendingCount } = useSyncStatus();
  const createFieldCapture = useCreateFieldCapture();
  const { addToast } = useToast();

  // Offline detection
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  React.useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // View toggle: grid vs map
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Post-capture overlay state
  const [overlayDataUrl, setOverlayDataUrl] = useState<string | null>(null);
  const [overlayLocation, setOverlayLocation] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter state
  const [filterTag, setFilterTag] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [filterEntityType, setFilterEntityType] = useState('');

  // Derived metrics
  const { totalCaptures, thisWeek, locationsCount } = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const uniqueLocations = new Set(captures.map(c => c.location).filter(Boolean));
    return {
      totalCaptures: captures.length,
      thisWeek: captures.filter(c => c.created_at && new Date(c.created_at) >= weekAgo).length,
      locationsCount: uniqueLocations.size,
    };
  }, [captures]);

  // Filtered captures for display
  const filteredCaptures = useMemo(() => {
    let result = captures;
    if (filterTag) {
      result = result.filter(c => Array.isArray(c.ai_tags) && (c.ai_tags as string[]).includes(filterTag));
    }
    if (filterDateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date(now);
      if (filterDateRange === 'today') {
        cutoff.setHours(0, 0, 0, 0);
      } else if (filterDateRange === 'week') {
        cutoff.setDate(now.getDate() - 7);
      } else if (filterDateRange === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
      }
      result = result.filter(c => c.created_at && new Date(c.created_at) >= cutoff);
    }
    if (filterEntityType) {
      if (filterEntityType === 'drawing') {
        result = result.filter(c => !!c.linked_drawing_id);
      } else if (filterEntityType === 'rfi') {
        result = result.filter(c => typeof c.content === 'string' && c.content.toLowerCase().includes('rfi'));
      }
    }
    return result;
  }, [captures, filterTag, filterDateRange, filterEntityType]);

  const handleCaptureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      setOverlayDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Attempt GPS
    setOverlayLocation(null);
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setOverlayLocation(
          `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        );
      },
      () => {
        setOverlayLocation(null);
      },
      { timeout: 5000 }
    );

    e.target.value = '';
  };

  const handleOverlaySave = async (meta: {
    title: string;
    notes: string;
    tags: string[];
    linkTo: string;
    location: string | null;
  }) => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      await createFieldCapture.mutateAsync({
        projectId,
        data: {
          project_id: projectId,
          type: 'photo',
          content: meta.title || meta.notes || 'Photo capture',
          location: meta.location,
          ai_tags: meta.tags.length > 0 ? meta.tags : null,
          ai_category: null,
          file_url: overlayDataUrl,
        },
      });
      addToast('success', 'Photo saved');
      setOverlayDataUrl(null);
      setOverlayLocation(null);
    } catch {
      addToast('error', 'Failed to save photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverlayCancel = () => {
    setOverlayDataUrl(null);
    setOverlayLocation(null);
  };

  // Loading
  if (isLoading) {
    return (
      <PageContainer title="Field Capture" subtitle="Loading...">
        <FieldCaptureSkeleton />
      </PageContainer>
    );
  }

  // Error
  if (isError) {
    return (
      <PageContainer title="Field Capture" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
                Failed to load field captures
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>
                {(error as Error)?.message || 'Unable to fetch captures from the field'}
              </p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>
              Retry
            </Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Field Capture"
      subtitle="Document site conditions with photos, GPS, and AI analysis"
      aria-label="Field capture management"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Post-capture overlay */}
      {overlayDataUrl && (
        <PhotoOverlay
          dataUrl={overlayDataUrl}
          location={overlayLocation}
          isSaving={isSaving}
          onSave={handleOverlaySave}
          onCancel={handleOverlayCancel}
        />
      )}

      {/* FAB — fixed bottom-right on mobile, fixed top-right on desktop */}
      <style>{`
        .fc-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          z-index: 100;
        }
        @media (min-width: 768px) {
          .fc-fab {
            top: 20px;
            right: 36px;
            bottom: auto;
            width: auto;
            height: 44px;
            border-radius: 10px;
            padding: 0 20px;
          }
        }
      `}</style>
      <button
        className="fc-fab"
        aria-label="Capture new field photo"
        onClick={handleCaptureClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing['2'],
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          border: 'none',
          cursor: 'pointer',
          boxShadow: shadows.glow,
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.semibold,
          fontFamily: typography.fontFamily,
          transition: `background-color ${transitions.quick}`,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeHover; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.primaryOrange; }}
      >
        <Camera size={20} />
        <span className="fc-fab-label" style={{ display: 'none' }}>Capture</span>
        <style>{`.fc-fab-label { display: none; } @media (min-width: 768px) { .fc-fab-label { display: inline; } }`}</style>
      </button>

      {/* Offline / pending banner */}
      {(!isOnline || pendingCount > 0) && (
        <div
          aria-live="assertive"
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: spacing['3'],
            marginBottom: spacing['4'],
            backgroundColor: '#FEF3C7',
            border: `1px solid #F59E0B`,
            borderRadius: borderRadius.md,
          }}
        >
          <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: typography.fontSize.sm, color: '#92400E', fontWeight: typography.fontWeight.medium }}>
            {pendingCount > 0
              ? `${pendingCount} photo${pendingCount !== 1 ? 's' : ''} pending upload`
              : 'You are offline. Photos will sync when you reconnect.'}
          </span>
        </div>
      )}

      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing['3'],
          marginBottom: spacing['6'],
        }}
      >
        {[
          {
            label: 'Total Captures',
            value: totalCaptures,
            icon: <Camera size={18} color={colors.statusInfo} />,
            color: colors.statusInfo,
          },
          {
            label: 'This Week',
            value: thisWeek,
            icon: <Camera size={18} color={colors.primaryOrange} />,
            color: colors.primaryOrange,
          },
          {
            label: 'Pending Sync',
            value: pendingCount,
            icon: <RefreshCw size={18} color={pendingCount > 0 ? colors.statusPending : colors.textTertiary} />,
            color: pendingCount > 0 ? colors.statusPending : colors.textTertiary,
          },
          {
            label: 'Locations Covered',
            value: locationsCount,
            icon: <MapPin size={18} color={locationsCount > 0 ? colors.statusActive : colors.textTertiary} />,
            color: locationsCount > 0 ? colors.statusActive : colors.textTertiary,
          },
        ].map(({ label, value, icon, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.xl,
              padding: spacing['5'],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['2'],
              boxShadow: shadows.card,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              {icon}
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>
                {label}
              </span>
            </div>
            <span style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          marginBottom: spacing['4'],
          flexWrap: 'wrap',
        }}
      >
        <select
          value={filterTag}
          onChange={e => setFilterTag(e.target.value)}
          aria-label="Filter by tag"
          style={{
            padding: `${spacing['2']} ${spacing['3']}`,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.lg,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            color: filterTag ? colors.textPrimary : colors.textTertiary,
            backgroundColor: filterTag ? colors.orangeSubtle : colors.white,
            cursor: 'pointer',
            outline: 'none',
            minHeight: '36px',
          }}
        >
          <option value="">All tags</option>
          {CONSTRUCTION_TAGS.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filterDateRange}
          onChange={e => setFilterDateRange(e.target.value as typeof filterDateRange)}
          aria-label="Filter by date range"
          style={{
            padding: `${spacing['2']} ${spacing['3']}`,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.lg,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            color: filterDateRange !== 'all' ? colors.textPrimary : colors.textTertiary,
            backgroundColor: filterDateRange !== 'all' ? colors.orangeSubtle : colors.white,
            cursor: 'pointer',
            outline: 'none',
            minHeight: '36px',
          }}
        >
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <select
          value={filterEntityType}
          onChange={e => setFilterEntityType(e.target.value)}
          aria-label="Filter by linked entity type"
          style={{
            padding: `${spacing['2']} ${spacing['3']}`,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.lg,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            color: filterEntityType ? colors.textPrimary : colors.textTertiary,
            backgroundColor: filterEntityType ? colors.orangeSubtle : colors.white,
            cursor: 'pointer',
            outline: 'none',
            minHeight: '36px',
          }}
        >
          <option value="">All linked types</option>
          <option value="drawing">Drawing</option>
          <option value="rfi">RFI</option>
        </select>
        {(filterTag || filterDateRange !== 'all' || filterEntityType) && (
          <button
            onClick={() => { setFilterTag(''); setFilterDateRange('all'); setFilterEntityType(''); }}
            style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.lg,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              color: colors.textSecondary,
              backgroundColor: colors.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              minHeight: '36px',
            }}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Grid / Map toggle + count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing['4'],
        }}
      >
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          {filteredCaptures.length} photo{filteredCaptures.length !== 1 ? 's' : ''}
          {filteredCaptures.length !== captures.length && ` of ${captures.length}`}
        </span>
        <div
          style={{
            display: 'flex',
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.lg,
            padding: '3px',
            gap: '2px',
          }}
        >
          {([
            { mode: 'grid' as const, icon: <LayoutGrid size={15} />, label: 'Grid view' },
            { mode: 'map' as const, icon: <MapIcon size={15} />, label: 'Map view' },
          ]).map(({ mode, icon, label }) => (
            <button
              key={mode}
              aria-label={label}
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['2']} ${spacing['3']}`,
                minHeight: '32px',
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: 'pointer',
                backgroundColor: viewMode === mode ? colors.white : 'transparent',
                color: viewMode === mode ? colors.textPrimary : colors.textTertiary,
                fontFamily: typography.fontFamily,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
                boxShadow: viewMode === mode ? shadows.card : 'none',
                transition: `all ${transitions.quick}`,
              }}
            >
              {icon}
              <span style={{ textTransform: 'capitalize' }}>{mode}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content: empty state OR grid/map */}
      {captures.length === 0 ? (
        <Card padding={spacing['10']}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing['4'],
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: `${colors.primaryOrange}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Camera size={36} color={colors.primaryOrange} />
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
                No field captures yet
              </p>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.normal }}>
                Start documenting site conditions with photos.
              </p>
            </div>
            <button
              aria-label="Open camera to capture"
              onClick={handleCaptureClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['3']} ${spacing['6']}`,
                backgroundColor: colors.primaryOrange,
                color: colors.white,
                border: 'none',
                borderRadius: borderRadius.lg,
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              <Camera size={18} />
              Open Camera
            </button>
          </div>
        </Card>
      ) : viewMode === 'map' ? (
        <MapView captures={filteredCaptures} />
      ) : (
        <>
          <style>{`
            @media (max-width: 640px) {
              .fc-grid { grid-template-columns: repeat(1, 1fr) !important; }
            }
            @media (min-width: 641px) and (max-width: 1023px) {
              .fc-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
          `}</style>
          <div
            className="fc-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: spacing['3'],
            }}
          >
            {filteredCaptures.map(capture => (
              <PhotoCard key={capture.id} capture={capture} />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
};

// ── Exported page ───────────────────────────────────────────

const FieldCapturePage: React.FC = () => (
  <ErrorBoundary>
    <FieldCaptureInner />
  </ErrorBoundary>
);

export default FieldCapturePage;
