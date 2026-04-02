import React, { useState, useMemo, useRef } from 'react';
import { Camera, Mic, FileText, AlertTriangle, MapPin, ChevronRight, Sparkles, Users, RefreshCw, QrCode } from 'lucide-react';
import { PageContainer, Card, Btn, SectionHeader, useToast } from '../components/Primitives';
import { ErrorBoundary } from '../components/ErrorBoundary';
import FieldCaptureSkeleton from '../components/field/FieldCaptureSkeleton';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../styles/theme';
import { PhotoAnnotator } from '../components/field/PhotoAnnotator';
import { VoiceCapture } from '../components/field/VoiceCapture';
import { CaptureTimeline } from '../components/field/CaptureTimeline';
import { QuickCapture, type CaptureData } from '../components/field/QuickCapture';
import { QRCheckIn, QRScannerSheet } from '../components/workforce/QRCheckIn';
import { useProjectId } from '../hooks/useProjectId';
import { useFieldCaptures } from '../hooks/queries';
import { useCreateFieldCapture } from '../hooks/mutations';
import { useSyncOfflineCheckIns } from '../hooks/useCheckIn';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { PermissionGate } from '../components/auth/PermissionGate';
import EmptyState from '../components/ui/EmptyState';
import type { ExtractedEntity } from '../hooks/useVoiceCapture';

type CaptureMode = null | 'photo' | 'voice' | 'text' | 'checkin';
type IssueType = 'issue' | 'progress' | 'safety' | 'note';

const issueTypes: { type: IssueType; label: string; color: string; template: string }[] = [
  { type: 'issue', label: 'Issue', color: colors.statusCritical, template: 'Describe the issue found at...' },
  { type: 'progress', label: 'Progress Update', color: colors.statusActive, template: 'Work completed today on...' },
  { type: 'safety', label: 'Safety Concern', color: colors.statusPending, template: 'Safety observation at...' },
  { type: 'note', label: 'General Note', color: colors.statusInfo, template: 'Note for the team regarding...' },
];

const locations = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5', 'Floor 6', 'Floor 7', 'Floor 8', 'Floor 9', 'Floor 10', 'Floor 11', 'Floor 12', 'Lobby', 'Basement', 'Roof', 'Exterior'];

function formatCaptureTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatCaptureDatetime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const FieldCaptureInner: React.FC = () => {
  const projectId = useProjectId();
  const { data: capturesData, isLoading, isError, error, refetch } = useFieldCaptures(projectId);
  const captures = capturesData ?? [];

  const { pendingCount } = useSyncStatus();
  const { photosToday, voiceNotesToday, itemsCreatedToday } = useMemo(() => ({
    photosToday: captures.filter(c => c.type === 'photo' && isToday(c.created_at)).length,
    voiceNotesToday: captures.filter(c => c.type === 'voice' && isToday(c.created_at)).length,
    itemsCreatedToday: captures.filter(c => isToday(c.created_at) && (c.ai_category === 'rfi_draft' || c.ai_category === 'punch_item')).length,
  }), [captures]);

  if (isLoading) {
    return (
      <PageContainer title="Field Capture" subtitle="Loading...">
        <FieldCaptureSkeleton />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer title="Field Capture" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Failed to load field captures</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{(error as Error)?.message || 'Unable to fetch captures from the field'}</p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const { todayCaptures, previousCaptures } = useMemo(() => {
    const today: typeof mapped = [];
    const previous: typeof mapped = [];
    const mapped = captures.map(c => ({
      id: c.id,
      type: (c.type as 'photo' | 'voice' | 'text' | 'issue') ?? 'text',
      title: c.content ?? 'Untitled capture',
      time: isToday(c.created_at) ? formatCaptureTime(c.created_at) : formatCaptureDatetime(c.created_at),
      capturedBy: c.created_by ?? 'Unknown',
      location: c.location ?? '',
      aiCategory: c.ai_category ?? undefined,
      preview: undefined as string | undefined,
    }));
    for (const item of mapped) {
      if (captures.find(c => c.id === item.id && isToday(c.created_at))) {
        today.push(item);
      } else {
        previous.push(item);
      }
    }
    return { todayCaptures: today, previousCaptures: previous };
  }, [captures]);
  const { addToast } = useToast();
  const createFieldCapture = useCreateFieldCapture();
  useSyncOfflineCheckIns();
  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [quickTextType, setQuickTextType] = useState<IssueType | null>(null);
  const [quickTextValue, setQuickTextValue] = useState('');
  const [quickTextLocation, setQuickTextLocation] = useState('');
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [showCheckInSheet, setShowCheckInSheet] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Offline detection
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Photo capture via file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoNotes, setPhotoNotes] = useState('');
  const [photoTags, setPhotoTags] = useState('');
  const [photoLinkTo, setPhotoLinkTo] = useState('');

  React.useEffect(() => {
    if (pendingCount === 0) {
      setLiveAnnouncement('All captures synced');
    } else {
      setLiveAnnouncement(`${pendingCount} capture${pendingCount !== 1 ? 's' : ''} pending sync`);
    }
  }, [pendingCount]);

  const handleQuickCaptureSave = async (capture: CaptureData) => {
    try {
      await createFieldCapture.mutateAsync({
        projectId: projectId!,
        data: {
          project_id: projectId!,
          type: capture.type,
          content: capture.notes || capture.transcript || capture.qrData || '',
          location: capture.location || null,
          ai_category: capture.category || null,
          gps_latitude: capture.gpsLat || null,
          gps_longitude: capture.gpsLng || null,
        },
      });
      addToast('success', 'Field capture saved');
      setLiveAnnouncement('Photo uploaded and saved successfully');
    } catch {
      addToast('error', 'Failed to save capture');
      setLiveAnnouncement('Failed to save capture');
    }
  };

  const handlePhotoButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePhotoMetaSave = async () => {
    try {
      await createFieldCapture.mutateAsync({
        projectId: projectId!,
        data: {
          project_id: projectId!,
          type: 'photo',
          content: photoTitle || photoNotes || 'Photo capture',
          location: null,
          ai_category: null,
        },
      });
      addToast('success', 'Photo saved');
      setLiveAnnouncement('Photo saved successfully');
      setPhotoDataUrl(null);
      setPhotoTitle('');
      setPhotoNotes('');
      setPhotoTags('');
      setPhotoLinkTo('');
    } catch {
      addToast('error', 'Failed to save photo');
      setLiveAnnouncement('Failed to save photo');
    }
  };

  const handlePhotoMetaCancel = () => {
    setPhotoDataUrl(null);
    setPhotoTitle('');
    setPhotoNotes('');
    setPhotoTags('');
    setPhotoLinkTo('');
  };

  const handleQuickTextSend = async () => {
    if (!quickTextValue.trim()) return;
    try {
      const label = quickTextType ? issueTypes.find((t) => t.type === quickTextType)?.label : 'Note';
      await createFieldCapture.mutateAsync({ projectId: projectId!, data: { project_id: projectId!, type: quickTextType || 'text', content: quickTextValue, location: quickTextLocation || null } })
      addToast('success', `${label} captured`)
      setLiveAnnouncement(`${label} saved successfully`);
      setQuickTextValue('')
      setQuickTextType(null)
      setQuickTextLocation('')
    } catch {
      addToast('error', 'Failed to save capture');
      setLiveAnnouncement('Failed to save capture');
    }
  };

  const captureIconMap: Record<string, React.ReactNode> = {
    photo: <Camera size={14} color={colors.statusInfo} />,
    voice: <Mic size={14} color={colors.statusReview} />,
    issue: <AlertTriangle size={14} color={colors.statusCritical} />,
    text: <FileText size={14} color={colors.statusInfo} />,
  };

  const captureBgMap: Record<string, string> = {
    photo: `${colors.statusInfo}14`,
    voice: `${colors.statusReview}14`,
    issue: `${colors.statusCritical}14`,
    text: `${colors.statusInfo}14`,
  };

  return (
    <PageContainer title="Field Capture" subtitle="Capture photos, voice notes, and observations from the field" aria-label="Field capture management">
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>{liveAnnouncement}</div>
      <QuickCapture open={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} onSave={handleQuickCaptureSave} />

      {/* Hidden file input for camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Offline banner */}
      {!isOnline && (
        <div
          aria-live="assertive"
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: '12px', marginBottom: spacing['4'],
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: borderRadius.base,
          }}
        >
          <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: typography.fontSize.sm, color: '#92400E', fontWeight: typography.fontWeight.medium }}>
            You are offline. Photos will sync when you reconnect.
          </span>
        </div>
      )}

      {/* Photo metadata overlay */}
      {photoDataUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: zIndex.tooltip as number,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: spacing['4'],
        }}>
          <div style={{
            backgroundColor: colors.white, borderRadius: borderRadius.xl,
            width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            <img
              src={photoDataUrl}
              alt="Captured photo preview"
              style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: `${borderRadius.xl} ${borderRadius.xl} 0 0`, display: 'block' }}
            />
            <div style={{ padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              <input
                type="text"
                value={photoTitle}
                onChange={(e) => setPhotoTitle(e.target.value)}
                placeholder="Title (optional)"
                style={{
                  width: '100%', padding: `${spacing['2']} ${spacing['3']}`,
                  border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <textarea
                value={photoNotes}
                onChange={(e) => setPhotoNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={3}
                style={{
                  width: '100%', padding: spacing['3'],
                  border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                value={photoTags}
                onChange={(e) => setPhotoTags(e.target.value)}
                placeholder="Tags, comma separated (optional)"
                style={{
                  width: '100%', padding: `${spacing['2']} ${spacing['3']}`,
                  border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                value={photoLinkTo}
                onChange={(e) => setPhotoLinkTo(e.target.value)}
                placeholder="Link to RFI, punch item, or drawing (optional)"
                style={{
                  width: '100%', padding: `${spacing['2']} ${spacing['3']}`,
                  border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
                <Btn variant="ghost" size="sm" onClick={handlePhotoMetaCancel}>Cancel</Btn>
                <Btn variant="primary" size="sm" onClick={handlePhotoMetaSave}>Save</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: colors.statusReviewSubtle, borderRadius: borderRadius.base, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, margin: 0, lineHeight: 1.5 }}>
          AI Analysis: 85% of today's captures were auto categorized. 2 potential safety concerns flagged for review.
        </p>
      </div>
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['4'] }}>
        {([
          { icon: <Camera size={18} color={colors.statusInfo} />, label: 'Photos Today', value: photosToday, color: colors.statusInfo },
          { icon: <Mic size={18} color={colors.statusReview} />, label: 'Voice Notes', value: voiceNotesToday, color: colors.statusReview },
          { icon: <FileText size={18} color={colors.statusActive} />, label: 'Items Created', value: itemsCreatedToday, color: colors.statusActive },
          { icon: <RefreshCw size={18} color={pendingCount > 0 ? colors.statusPending : colors.textTertiary} />, label: 'Pending Sync', value: pendingCount, color: pendingCount > 0 ? colors.statusPending : colors.textTertiary },
        ] as const).map(({ icon, label, value, color }) => (
          <div key={label} style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing['6'], display: 'flex', flexDirection: 'column', gap: spacing['2'], boxShadow: shadows.card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              {icon}
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{label}</span>
            </div>
            <span style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* QR Check-In Sheet */}
      {showCheckInSheet && (
        <QRScannerSheet onClose={() => setShowCheckInSheet(false)} />
      )}

      {/* Quick Capture Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['3'],
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, boxShadow: shadows.card, marginBottom: spacing['6'],
      }}>
        <button
          aria-label="Check in via QR code"
          onClick={() => setShowCheckInSheet(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['4']} ${spacing['3']}`, minHeight: 44, minWidth: 44,
            backgroundColor: `${colors.statusActive}14`,
            color: colors.statusActive,
            border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
            transition: `all ${transitions.instant}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${colors.statusActive}22`; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${colors.statusActive}14`; }}
        >
          <QrCode size={24} />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Check In</span>
          <span style={{ fontSize: typography.fontSize.caption, opacity: 0.8, fontWeight: typography.fontWeight.normal }}>Scan QR code</span>
        </button>

        <PermissionGate permission="field_capture.create">
          <button
            aria-label="Capture photo"
            onClick={handlePhotoButtonClick}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['4']} ${spacing['3']}`, minHeight: 44, minWidth: 44,
              backgroundColor: colors.primaryOrange, color: colors.white, border: 'none',
              borderRadius: borderRadius.md, cursor: 'pointer',
              transition: `background-color ${transitions.instant}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.primaryOrange; }}
          >
            <Camera size={24} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Photo</span>
            <span style={{ fontSize: typography.fontSize.caption, opacity: 0.8, fontWeight: typography.fontWeight.normal }}>Take a photo</span>
          </button>
        </PermissionGate>

        <PermissionGate permission="field_capture.create">
          <button
            aria-label="Record voice note"
            onClick={() => setShowVoice(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['4']} ${spacing['3']}`, minHeight: 44, minWidth: 44,
              backgroundColor: colors.statusReview, color: colors.white, border: 'none',
              borderRadius: borderRadius.md, cursor: 'pointer',
              transition: `opacity ${transitions.instant}`,
            }}
          >
            <Mic size={24} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Voice</span>
            <span style={{ fontSize: typography.fontSize.caption, opacity: 0.8, fontWeight: typography.fontWeight.normal }}>Record and transcribe</span>
          </button>
        </PermissionGate>

        <PermissionGate permission="field_capture.create">
          <button
            aria-label="Add tags"
            onClick={() => setQuickTextType(quickTextType ? null : 'note')}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['4']} ${spacing['3']}`, minHeight: 44, minWidth: 44,
              backgroundColor: quickTextType ? colors.surfaceSelected : `${colors.statusInfo}14`,
              color: quickTextType ? colors.primaryOrange : colors.statusInfo,
              border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
              transition: `all ${transitions.instant}`,
            }}
          >
            <FileText size={24} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Text</span>
            <span style={{ fontSize: typography.fontSize.caption, opacity: 0.8, fontWeight: typography.fontWeight.normal }}>Quick note</span>
          </button>
        </PermissionGate>

        <button
          aria-label="View crew check-in board"
          onClick={() => setCaptureMode(captureMode === 'checkin' ? null : 'checkin')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['4']} ${spacing['3']}`, minHeight: 44, minWidth: 44,
            backgroundColor: captureMode === 'checkin' ? colors.surfaceSelected : `${colors.statusActive}14`,
            color: captureMode === 'checkin' ? colors.primaryOrange : colors.statusActive,
            border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
            transition: `all ${transitions.instant}`,
          }}
          onMouseEnter={(e) => { if (captureMode !== 'checkin') (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${colors.statusActive}22`; }}
          onMouseLeave={(e) => { if (captureMode !== 'checkin') (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${colors.statusActive}14`; }}
        >
          <Users size={24} />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Crew</span>
          <span style={{ fontSize: typography.fontSize.caption, opacity: 0.8, fontWeight: typography.fontWeight.normal }}>Check-in board</span>
        </button>
      </div>

      {/* Camera simulation overlay */}
      {captureMode === 'photo' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: zIndex.tooltip as number, backgroundColor: colors.black, /* camera overlay */
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: '640px', aspectRatio: '4/3', position: 'relative', backgroundColor: colors.darkNavy }}>
            {/* Viewfinder guides */}
            <div style={{ position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%', border: `1px solid ${colors.overlayWhiteThin}`, borderRadius: borderRadius.md }}>
              {/* Corner marks */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                <div key={pos} style={{
                  position: 'absolute',
                  [pos.includes('top') ? 'top' : 'bottom']: -1,
                  [pos.includes('left') ? 'left' : 'right']: -1,
                  width: 20, height: 20,
                  borderTop: pos.includes('top') ? `2px solid ${colors.white}` : 'none',
                  borderBottom: pos.includes('bottom') ? `2px solid ${colors.white}` : 'none',
                  borderLeft: pos.includes('left') ? `2px solid ${colors.white}` : 'none',
                  borderRight: pos.includes('right') ? `2px solid ${colors.white}` : 'none',
                }} />
              ))}
            </div>
            {/* Center crosshair */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <div style={{ width: 20, height: 1, backgroundColor: colors.darkMutedText }} />
              <div style={{ width: 1, height: 20, backgroundColor: colors.darkMutedText, position: 'absolute', top: -10, left: 10 }} />
            </div>
            {/* Metadata overlay */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <MapPin size={12} color={colors.overlayWhiteMedium} />
                <span style={{ fontSize: '10px', color: colors.overlayWhiteMedium }}>Floor 7, Grid B4</span>
              </div>
              <span style={{ fontSize: '10px', color: colors.overlayWhiteMedium }}>Capturing...</span>
            </div>
            {/* Flash animation */}
            <div style={{
              position: 'absolute', inset: 0, backgroundColor: colors.white,
              animation: 'fadeIn 100ms ease-out reverse',
              opacity: 0, pointerEvents: 'none',
            }} />
          </div>
        </div>
      )}

      {/* Quick Text Panel */}
      {quickTextType && (
        <Card padding={spacing['4']}>
          <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['3'] }}>
            {issueTypes.map((t) => (
              <button
                key={t.type}
                aria-label={`Set type to ${t.label}`}
                aria-pressed={quickTextType === t.type}
                onClick={() => {
                  setQuickTextType(t.type);
                  setQuickTextValue(t.template);
                }}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`,
                  minHeight: 44, minWidth: 44,
                  backgroundColor: quickTextType === t.type ? `${t.color}14` : 'transparent',
                  color: quickTextType === t.type ? t.color : colors.textTertiary,
                  border: `1px solid ${quickTextType === t.type ? t.color : colors.borderDefault}`,
                  borderRadius: borderRadius.full, cursor: 'pointer',
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily, transition: `all ${transitions.instant}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            value={quickTextLocation}
            onChange={(e) => setQuickTextLocation(e.target.value)}
            style={{
              width: '100%', padding: `${spacing['2']} ${spacing['3']}`,
              border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md,
              fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
              color: quickTextLocation ? colors.textPrimary : colors.textTertiary,
              backgroundColor: colors.surfaceRaised, marginBottom: spacing['2'], outline: 'none',
            }}
          >
            <option value="">Select location...</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <textarea
            value={quickTextValue}
            onChange={(e) => setQuickTextValue(e.target.value)}
            placeholder="Describe what you see..."
            style={{
              width: '100%', height: '80px', padding: spacing['3'],
              border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md,
              fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
              color: colors.textPrimary, resize: 'vertical', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['2'] }}>
            <Btn variant="ghost" size="sm" onClick={() => { setQuickTextType(null); setQuickTextLocation(''); }}>Cancel</Btn>
            <PermissionGate permission="field_capture.create">
              <Btn size="sm" onClick={handleQuickTextSend} disabled={!quickTextValue.trim()}>Save Capture</Btn>
            </PermissionGate>
          </div>
        </Card>
      )}

      {/* Crew Check-In Board */}
      {captureMode === 'checkin' && (
        <div style={{ marginBottom: spacing['6'] }}>
          <SectionHeader
            title="Crew Check-In"
            action={
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                Live · updates in real time
              </span>
            }
          />
          <div style={{ marginTop: spacing['3'] }}>
            <QRCheckIn showLiveBoard />
          </div>
        </div>
      )}

      {/* Today's Timeline */}
      {captures.length === 0 ? (
        <div style={{ marginTop: quickTextType ? spacing['4'] : 0 }}>
          <Card padding={spacing['10']}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: `${colors.primaryOrange}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={32} color={colors.primaryOrange} />
              </div>
              <div>
                <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>No field captures yet</p>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>Start documenting site conditions with photos.</p>
              </div>
              <button
                aria-label="Capture photo"
                onClick={handlePhotoButtonClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['3']} ${spacing['6']}`,
                  backgroundColor: colors.primaryOrange, color: colors.white,
                  border: 'none', borderRadius: borderRadius.lg,
                  fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                <Camera size={18} />
                Capture
              </button>
            </div>
          </Card>
        </div>
      ) : (
        <>
      <div style={{ marginTop: quickTextType ? spacing['4'] : 0 }}>
        <SectionHeader title="Today's Captures" action={<span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{todayCaptures.length} items</span>} />
        <Card>
          {todayCaptures.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No captures today"
              description="Use the buttons below to log a photo, voice note, or check in"
              action={{ label: 'Start Capturing', onClick: () => setQuickCaptureOpen(true) }}
            />
          ) : (
            <CaptureTimeline
              events={todayCaptures}
              onSelect={(event) => addToast('info', `Viewing: ${event.title}`)}
            />
          )}
        </Card>
      </div>

      {/* Previous Captures */}
      <div style={{ marginTop: spacing['6'] }}>
        <SectionHeader title="Previous Captures" />
        {previousCaptures.length === 0 ? (
          <Card>
            <EmptyState
              icon={Camera}
              title="No captures today"
              description="Use the buttons below to log a photo, voice note, or check in"
              action={{ label: 'Start Capturing', onClick: () => setQuickCaptureOpen(true) }}
            />
          </Card>
        ) : (
        <Card padding="0">
          <div role="list" aria-label="Field captures">
          {previousCaptures.map((capture, index) => (
            <div
              key={capture.id}
              role="listitem"
              tabIndex={0}
              aria-label={`View ${capture.type} capture: ${capture.title}`}
              onClick={() => addToast('info', `Viewing ${capture.title}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addToast('info', `Viewing ${capture.title}`); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: `${spacing['3']} ${spacing['5']}`,
                borderBottom: index < previousCaptures.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                cursor: 'pointer', transition: `background-color ${transitions.instant}`,
                minHeight: 44,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                backgroundColor: captureBgMap[capture.type] || `${colors.statusInfo}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {captureIconMap[capture.type] || <FileText size={14} color={colors.statusInfo} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{capture.title}</p>
                  {capture.aiCategory && (
                    <span title="Categorized by AI" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', backgroundColor: `${colors.statusReview}12`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview }}>
                      <Sparkles size={10} /> {capture.aiCategory}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{capture.capturedBy} · {capture.time}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: 2 }}>
                  <MapPin size={10} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{capture.location}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {capture.type === 'photo' && (
                  <PermissionGate permission="field_capture.create">
                    <button
                      aria-label="Pin photo to drawing sheet"
                      onClick={(e) => { e.stopPropagation(); addToast('info', 'Select a drawing sheet to pin this photo'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['1'],
                        padding: `${spacing['1']} ${spacing['2']}`,
                        minHeight: 44, minWidth: 44,
                        backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`,
                        borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption,
                        fontFamily: typography.fontFamily, color: colors.textTertiary,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <FileText size={10} /> Pin to Drawing
                    </button>
                  </PermissionGate>
                )}
                <ChevronRight size={14} color={colors.textTertiary} />
              </div>
            </div>
          ))}
          </div>
        </Card>
        )}
      </div>
      </>
      )}

      {/* Fixed bottom Capture button */}
      <PermissionGate permission="field_capture.create">
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: zIndex.modal as number, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'] }}>
          {pendingCount > 0 && (
            <div style={{
              backgroundColor: '#F59E0B', color: '#fff',
              borderRadius: borderRadius.full,
              padding: `2px ${spacing['3']}`,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              whiteSpace: 'nowrap', boxShadow: shadows.card,
            }}>
              {pendingCount} photo{pendingCount !== 1 ? 's' : ''} pending upload
            </div>
          )}
          <button
            aria-label="Capture photo"
            onClick={handlePhotoButtonClick}
            style={{
              width: 64, height: 64,
              borderRadius: '50%',
              backgroundColor: colors.primaryOrange,
              color: colors.white,
              border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(244,120,32,0.45)',
              transition: `background-color ${transitions.instant}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.primaryOrange; }}
          >
            <Camera size={28} />
          </button>
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, backgroundColor: colors.white, borderRadius: borderRadius.full, padding: `2px ${spacing['3']}`, boxShadow: shadows.card }}>Capture</span>
        </div>
      </PermissionGate>

      {/* Overlays */}
      {showAnnotator && (
        <PhotoAnnotator
          onClose={() => setShowAnnotator(false)}
          onSave={async () => {
            try {
              await createFieldCapture.mutateAsync({ projectId: projectId!, data: { project_id: projectId!, type: 'photo', content: 'Photo capture with annotations' } })
              addToast('success', 'Photo saved with annotations')
            } catch { addToast('error', 'Failed to save photo') }
          }}
        />
      )}
      {showVoice && (
        <VoiceCapture
          onClose={() => setShowVoice(false)}
          onConfirm={async (entities: ExtractedEntity[], transcript: string, _audioBlob: Blob | null) => {
            let savedCount = 0;
            for (const entity of entities) {
              try {
                const data = entity.data as Record<string, unknown>;
                if (entity.type === 'daily_log') {
                  const activities = data.activities as Array<Record<string, unknown>> | undefined;
                  const location = activities?.[0]?.location as string || '';
                  await createFieldCapture.mutateAsync({
                    projectId: projectId!,
                    data: {
                      project_id: projectId!,
                      type: 'voice',
                      content: transcript,
                      location: location || null,
                      ai_category: 'daily_log',
                    },
                  });
                  savedCount++;
                } else if (entity.type === 'rfi_draft') {
                  await createFieldCapture.mutateAsync({
                    projectId: projectId!,
                    data: {
                      project_id: projectId!,
                      type: 'voice',
                      content: `RFI: ${data.subject || ''} — ${data.question || ''}`,
                      location: (data.location as string) || null,
                      ai_category: 'rfi_draft',
                    },
                  });
                  savedCount++;
                } else if (entity.type === 'punch_item') {
                  await createFieldCapture.mutateAsync({
                    projectId: projectId!,
                    data: {
                      project_id: projectId!,
                      type: 'voice',
                      content: `Punch: ${data.title || ''} — ${data.description || ''}`,
                      location: (data.location as string) || null,
                      ai_category: 'punch_item',
                    },
                  });
                  savedCount++;
                } else if (entity.type === 'safety_observation') {
                  await createFieldCapture.mutateAsync({
                    projectId: projectId!,
                    data: {
                      project_id: projectId!,
                      type: 'voice',
                      content: `Safety: ${data.description || ''}`,
                      location: (data.location as string) || null,
                      ai_category: 'safety_observation',
                    },
                  });
                  savedCount++;
                } else {
                  await createFieldCapture.mutateAsync({
                    projectId: projectId!,
                    data: {
                      project_id: projectId!,
                      type: 'voice',
                      content: transcript,
                      ai_category: 'general_note',
                    },
                  });
                  savedCount++;
                }
              } catch {
                addToast('error', `Failed to save ${entity.type}`);
              }
            }
            if (savedCount > 0) {
              addToast('success', `${savedCount} item${savedCount !== 1 ? 's' : ''} created from voice capture`);
            }
            setShowVoice(false);
          }}
        />
      )}
    </PageContainer>
  );
};

export const FieldCapture: React.FC = () => (
  <ErrorBoundary message="Field capture could not be displayed. Check your connection and try again.">
    <FieldCaptureInner />
  </ErrorBoundary>
);

export default FieldCapture;
