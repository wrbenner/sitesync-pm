import React, { useState, useEffect } from 'react';
import { Camera, Mic, FileText, AlertTriangle, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { PageContainer, Card, Btn, SectionHeader, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useFieldCaptureStore } from '../stores/fieldCaptureStore';
import { useProjectContext } from '../stores/projectContextStore';
import { PhotoAnnotator } from '../components/field/PhotoAnnotator';
import { VoiceRecorder } from '../components/field/VoiceRecorder';
import { CaptureTimeline } from '../components/field/CaptureTimeline';

type CaptureMode = null | 'photo' | 'voice' | 'text';
type IssueType = 'issue' | 'progress' | 'safety' | 'note';

const issueTypes: { type: IssueType; label: string; color: string; template: string }[] = [
  { type: 'issue', label: 'Issue', color: colors.statusCritical, template: 'Describe the issue found at...' },
  { type: 'progress', label: 'Progress Update', color: colors.statusActive, template: 'Work completed today on...' },
  { type: 'safety', label: 'Safety Concern', color: colors.statusPending, template: 'Safety observation at...' },
  { type: 'note', label: 'General Note', color: colors.statusInfo, template: 'Note for the team regarding...' },
];

const locations = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5', 'Floor 6', 'Floor 7', 'Floor 8', 'Floor 9', 'Floor 10', 'Floor 11', 'Floor 12', 'Lobby', 'Basement', 'Roof', 'Exterior'];

export const FieldCapture: React.FC = () => {
  const { addToast } = useToast();
  const { loadCaptures, addCapture, getTodayCaptures, getPreviousCaptures } = useFieldCaptureStore();
  const { activeProject } = useProjectContext();
  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [quickTextType, setQuickTextType] = useState<IssueType | null>(null);
  const [quickTextValue, setQuickTextValue] = useState('');
  const [quickTextLocation, setQuickTextLocation] = useState('');

  useEffect(() => {
    if (activeProject?.id) {
      loadCaptures(activeProject.id);
    }
  }, [activeProject?.id]);

  const todayCaptures = getTodayCaptures();
  const previousCaptures = getPreviousCaptures();

  const handlePhotoCapture = () => {
    setCaptureMode('photo');
    setTimeout(() => {
      setCaptureMode(null);
      setShowAnnotator(true);
    }, 1200);
  };

  const handleQuickTextSend = () => {
    if (!quickTextValue.trim() || !activeProject) return;
    const captureType = quickTextType === 'issue' ? 'issue' as const : 'text' as const;
    addCapture({
      project_id: activeProject.id,
      capture_type: captureType,
      title: quickTextValue.substring(0, 60),
      description: quickTextValue,
      location: quickTextLocation || 'Unspecified',
      captured_by: 'Current User',
      ai_category: quickTextType === 'safety' ? 'Safety' : quickTextType === 'issue' ? 'Issue' : null,
      file_url: null,
      transcript: null,
    });
    addToast('success', `${quickTextType ? issueTypes.find((t) => t.type === quickTextType)?.label : 'Note'} captured`);
    setQuickTextValue('');
    setQuickTextType(null);
    setQuickTextLocation('');
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

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Map store captures to CaptureTimeline format
  const timelineEvents = todayCaptures.map((c) => ({
    id: parseInt(c.id.replace(/\D/g, '')) || Date.now(),
    type: c.capture_type as 'photo' | 'voice' | 'text' | 'issue',
    title: c.title,
    time: formatTime(c.created_at),
    capturedBy: c.captured_by,
    location: c.location,
    aiCategory: c.ai_category || undefined,
    preview: c.transcript || c.description,
  }));

  return (
    <PageContainer title="Field Capture" subtitle="Capture photos, voice notes, and observations from the field">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', marginBottom: '16px', backgroundColor: 'rgba(124, 93, 199, 0.04)', borderRadius: '8px', borderLeft: '3px solid #7C5DC7' }}>
        <Sparkles size={14} color="#7C5DC7" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#1A1613', margin: 0, lineHeight: 1.5 }}>
          AI Analysis: {todayCaptures.filter((c) => c.ai_category).length > 0 ? `${Math.round((todayCaptures.filter((c) => c.ai_category).length / Math.max(todayCaptures.length, 1)) * 100)}% of today's captures were auto categorized.` : 'No captures yet today.'} {todayCaptures.filter((c) => c.ai_category === 'Safety').length > 0 ? `${todayCaptures.filter((c) => c.ai_category === 'Safety').length} potential safety concern${todayCaptures.filter((c) => c.ai_category === 'Safety').length > 1 ? 's' : ''} flagged for review.` : ''}
        </p>
      </div>

      {/* Quick Capture Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['3'],
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, boxShadow: shadows.card, marginBottom: spacing['6'],
      }}>
        <button
          onClick={handlePhotoCapture}
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
      </div>

      {/* Camera simulation overlay */}
      {captureMode === 'photo' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1060, backgroundColor: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: '640px', aspectRatio: '4/3', position: 'relative', backgroundColor: '#1a1a2e' }}>
            <div style={{ position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%', border: '1px solid rgba(255,255,255,0.2)', borderRadius: borderRadius.md }}>
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
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <div style={{ width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
              <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.4)', position: 'absolute', top: -10, left: 10 }} />
            </div>
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <MapPin size={12} color="rgba(255,255,255,0.6)" />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Floor 7, Grid B4</span>
              </div>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Capturing...</span>
            </div>
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
            <Btn size="sm" onClick={handleQuickTextSend} disabled={!quickTextValue.trim()}>Save Capture</Btn>
          </div>
        </Card>
      )}

      {/* Today's Timeline */}
      <div style={{ marginTop: quickTextType ? spacing['4'] : 0 }}>
        <SectionHeader title="Today's Captures" action={<span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{todayCaptures.length} items</span>} />
        <Card>
          {timelineEvents.length > 0 ? (
            <CaptureTimeline
              events={timelineEvents}
              onSelect={(event) => addToast('info', `Viewing: ${event.title}`)}
            />
          ) : (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: spacing['3'] }}>No captures yet today. Use the buttons above to start capturing.</p>
          )}
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
                backgroundColor: captureBgMap[capture.capture_type] || `${colors.statusInfo}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {captureIconMap[capture.capture_type] || <FileText size={14} color={colors.statusInfo} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{capture.title}</p>
                  {capture.ai_category && (
                    <span title="Categorized by AI" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', backgroundColor: `${colors.statusReview}12`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview }}>
                      <Sparkles size={10} /> {capture.ai_category}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{capture.captured_by} · {formatTime(capture.created_at)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: 2 }}>
                  <MapPin size={10} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{capture.location}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {capture.capture_type === 'photo' && (
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
          onSave={() => {
            if (activeProject) {
              addCapture({
                project_id: activeProject.id,
                capture_type: 'photo',
                title: 'New Photo Capture',
                description: 'Photo captured from field',
                location: 'Floor 7',
                captured_by: 'Current User',
                ai_category: null,
                file_url: null,
                transcript: null,
              });
            }
            addToast('success', 'Photo saved with annotations');
          }}
        />
      )}
      {showVoice && (
        <VoiceRecorder
          onClose={() => setShowVoice(false)}
          onSave={(transcript) => {
            if (activeProject) {
              addCapture({
                project_id: activeProject.id,
                capture_type: 'voice',
                title: transcript.substring(0, 60) || 'Voice Note',
                description: transcript,
                location: 'Unspecified',
                captured_by: 'Current User',
                ai_category: null,
                file_url: null,
                transcript,
              });
            }
            addToast('success', 'Voice note saved');
            setShowVoice(false);
          }}
        />
      )}
    </PageContainer>
  );
};
