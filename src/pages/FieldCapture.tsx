import React, { useState, useMemo } from 'react';
import { Camera, Mic, FileText, AlertTriangle, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { PageContainer, Card, Btn, SectionHeader, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { PhotoAnnotator } from '../components/field/PhotoAnnotator';
import { VoiceCapture } from '../components/field/VoiceCapture';
import { CaptureTimeline } from '../components/field/CaptureTimeline';
import { QuickCapture, type CaptureData } from '../components/field/QuickCapture';
import { useProjectId } from '../hooks/useProjectId';
import { useFieldCaptures } from '../hooks/queries';
import { useCreateFieldCapture } from '../hooks/mutations';
import { PermissionGate } from '../components/auth/PermissionGate';
import type { ExtractedEntity } from '../hooks/useVoiceCapture';

type CaptureMode = null | 'photo' | 'voice' | 'text';
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

export const FieldCapture: React.FC = () => {
  const projectId = useProjectId();
  const { data: capturesData } = useFieldCaptures(projectId);
  const captures = capturesData ?? [];

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
  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [quickTextType, setQuickTextType] = useState<IssueType | null>(null);
  const [quickTextValue, setQuickTextValue] = useState('');
  const [quickTextLocation, setQuickTextLocation] = useState('');
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

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
    } catch {
      addToast('error', 'Failed to save capture');
    }
  };

  const handlePhotoCapture = () => {
    setCaptureMode('photo');
    // Simulate camera "capture" then open annotator
    setTimeout(() => {
      setCaptureMode(null);
      setShowAnnotator(true);
    }, 1200);
  };

  const handleQuickTextSend = async () => {
    if (!quickTextValue.trim()) return;
    try {
      await createFieldCapture.mutateAsync({ projectId: projectId!, data: { project_id: projectId!, type: quickTextType || 'text', content: quickTextValue, location: quickTextLocation || null } })
      addToast('success', `${quickTextType ? issueTypes.find((t) => t.type === quickTextType)?.label : 'Note'} captured`)
      setQuickTextValue('')
      setQuickTextType(null)
      setQuickTextLocation('')
    } catch { addToast('error', 'Failed to save capture') }
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
    <PageContainer title="Field Capture" subtitle="Capture photos, voice notes, and observations from the field">
      <QuickCapture open={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} onSave={handleQuickCaptureSave} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: colors.statusReviewSubtle, borderRadius: borderRadius.base, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, margin: 0, lineHeight: 1.5 }}>
          AI Analysis: 85% of today's captures were auto categorized. 2 potential safety concerns flagged for review.
        </p>
      </div>
      {/* Quick Capture Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['3'],
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, boxShadow: shadows.card, marginBottom: spacing['6'],
      }}>
        <PermissionGate permission="field_capture.create">
          <button
            onClick={() => setQuickCaptureOpen(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['4']} ${spacing['3']}`,
              backgroundColor: colors.primaryOrange, color: 'white', border: 'none',
              borderRadius: borderRadius.md, cursor: 'pointer',
              transition: `background-color ${transitions.instant}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.primaryOrange; }}
          >
            <Camera size={24} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Photo</span>
            <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: typography.fontWeight.normal }}>Take a photo</span>
          </button>
        </PermissionGate>

        <PermissionGate permission="field_capture.create">
          <button
            onClick={() => setShowVoice(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['4']} ${spacing['3']}`,
              backgroundColor: colors.statusReview, color: 'white', border: 'none',
              borderRadius: borderRadius.md, cursor: 'pointer',
              transition: `opacity ${transitions.instant}`,
            }}
          >
            <Mic size={24} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Voice</span>
            <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: typography.fontWeight.normal }}>Record and transcribe</span>
          </button>
        </PermissionGate>

        <PermissionGate permission="field_capture.create">
          <button
            onClick={() => setQuickTextType(quickTextType ? null : 'note')}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['4']} ${spacing['3']}`,
              backgroundColor: quickTextType ? colors.surfaceSelected : `${colors.statusInfo}14`,
              color: quickTextType ? colors.primaryOrange : colors.statusInfo,
              border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
              transition: `all ${transitions.instant}`,
            }}
          >
            <FileText size={24} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Text</span>
            <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: typography.fontWeight.normal }}>Quick note</span>
          </button>
        </PermissionGate>
      </div>

      {/* Camera simulation overlay */}
      {captureMode === 'photo' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1060, backgroundColor: '#000', /* camera overlay */
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: '640px', aspectRatio: '4/3', position: 'relative', backgroundColor: colors.darkNavy }}>
            {/* Viewfinder guides */}
            <div style={{ position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%', border: '1px solid rgba(255,255,255,0.2)', borderRadius: borderRadius.md }}>
              {/* Corner marks */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                <div key={pos} style={{
                  position: 'absolute',
                  [pos.includes('top') ? 'top' : 'bottom']: -1,
                  [pos.includes('left') ? 'left' : 'right']: -1,
                  width: 20, height: 20,
                  borderTop: pos.includes('top') ? '2px solid white' : 'none',
                  borderBottom: pos.includes('bottom') ? '2px solid white' : 'none',
                  borderLeft: pos.includes('left') ? '2px solid white' : 'none',
                  borderRight: pos.includes('right') ? '2px solid white' : 'none',
                }} />
              ))}
            </div>
            {/* Center crosshair */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <div style={{ width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
              <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.4)', position: 'absolute', top: -10, left: 10 }} />
            </div>
            {/* Metadata overlay */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <MapPin size={12} color="rgba(255,255,255,0.6)" />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Floor 7, Grid B4</span>
              </div>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Capturing...</span>
            </div>
            {/* Flash animation */}
            <div style={{
              position: 'absolute', inset: 0, backgroundColor: 'white',
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
                onClick={() => {
                  setQuickTextType(t.type);
                  setQuickTextValue(t.template);
                }}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`,
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

      {/* Today's Timeline */}
      <div style={{ marginTop: quickTextType ? spacing['4'] : 0 }}>
        <SectionHeader title="Today's Captures" action={<span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{todayCaptures.length} items</span>} />
        <Card>
          <CaptureTimeline
            events={todayCaptures}
            onSelect={(event) => addToast('info', `Viewing: ${event.title}`)}
          />
        </Card>
      </div>

      {/* Previous Captures */}
      <div style={{ marginTop: spacing['6'] }}>
        <SectionHeader title="Previous Captures" />
        <Card padding="0">
          {previousCaptures.map((capture, index) => (
            <div
              key={capture.id}
              onClick={() => addToast('info', `Viewing ${capture.title}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: `${spacing['3']} ${spacing['5']}`,
                borderBottom: index < previousCaptures.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                cursor: 'pointer', transition: `background-color ${transitions.instant}`,
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
                      onClick={(e) => { e.stopPropagation(); addToast('info', 'Select a drawing sheet to pin this photo'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['1'],
                        padding: `${spacing['1']} ${spacing['2']}`,
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
        </Card>
      </div>

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
