import React, { useState, useCallback, useRef, useEffect, KeyboardEvent as ReactKeyboardEvent , startTransition} from 'react';
import { X, Camera, Mic, QrCode, MapPin, Tag, Link2, Check, Square, RefreshCw, Clock, Sparkles, AlertTriangle, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { useMobileCapture, useHaptics } from '../../hooks/useMobileCapture';
import { useOfflineMutation } from '../../hooks/useOfflineMutation';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { usePhotoAnalysis } from '../../hooks/usePhotoAnalysis';
import { GenSafetyAlert } from '../ai/generativeUI/GenSafetyAlert';
import type { SafetyAlertBlock } from '../ai/generativeUI/types';

type CaptureMode = 'camera' | 'voice' | 'qr';
type TagCategory = 'progress' | 'safety' | 'quality' | 'weather' | 'equipment' | 'general';

const CATEGORIES: { id: TagCategory; label: string; color: string }[] = [
  { id: 'progress', label: 'Progress', color: colors.statusInfo },
  { id: 'safety', label: 'Safety', color: colors.statusCritical },
  { id: 'quality', label: 'Quality', color: colors.statusActive },
  { id: 'weather', label: 'Weather', color: colors.statusPending },
  { id: 'equipment', label: 'Equipment', color: colors.statusReview },
  { id: 'general', label: 'General', color: colors.statusNeutral },
];

interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
  onSave: (capture: CaptureData) => void;
}

export interface CaptureData {
  id?: string;
  type: 'photo' | 'voice' | 'qr';
  imageUrl?: string;
  transcript?: string;
  qrData?: string;
  caption?: string;
  aiTags?: string[];
  category: TagCategory;
  location: string;
  gpsLat?: number;
  gpsLng?: number;
  relatedItem?: string;
  notes: string;
  timestamp: string;
}

export const QuickCapture: React.FC<QuickCaptureProps> = ({ open, onClose, onSave }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CaptureMode>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [step, setStep] = useState<'capture' | 'tag'>('capture');
  const [category, setCategory] = useState<TagCategory>('progress');
  const [locationText, setLocationText] = useState('');
  const [relatedItem, setRelatedItem] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [waveform, setWaveform] = useState<number[]>(Array(24).fill(4));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number>(0);
  const waveRef = useRef<number>(0);
  const recognitionRef = useRef<unknown>(null);

  // QR state
  const [qrData, setQrData] = useState<string | null>(null);

  // AI analysis state
  const [caption, setCaption] = useState('');
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [safetyAlertBlock, setSafetyAlertBlock] = useState<SafetyAlertBlock | null>(null);

  const { state: analysisState, result: analysisResult, analyzePhoto, reset: resetAnalysis } = usePhotoAnalysis();

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { capturePhoto, capturing } = useMobileCapture();
  const { impact, notification } = useHaptics();
  const { isOnline, syncState, pendingChanges } = useOfflineStatus();

  const captureMutation = useOfflineMutation<CaptureData, CaptureData>({
    table: 'field_captures',
    operation: 'insert',
    mutationFn: async (capture) => capture,
    getOfflinePayload: (capture) => capture as unknown as Record<string, unknown>,
    onSuccess: (_data, capture) => {
      onSave(capture);
      notification('success');
      onClose();
    },
  });

  // Auto-capture GPS on open
  useEffect(() => {
    if (open) {
      navigator.geolocation?.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [open]);

  // Apply AI analysis results when ready
  useEffect(() => {
    if (analysisState === 'ready' && analysisResult) {
      startTransition(() => { setCaption(analysisResult.summary); });
      const allTags = [...new Set([
        ...analysisResult.suggestedTags,
        ...analysisResult.materials,
        ...analysisResult.equipment,
      ])];
      setAiTags(allTags);

      // Critical violations have confidence > 0.7 by severity definition
      const criticalViolation = analysisResult.safetyViolations.find(v => v.severity === 'critical');
      if (criticalViolation) {
        setSafetyAlertBlock({
          ui_type: 'safety_alert',
          alert_id: crypto.randomUUID(),
          severity: 'critical',
          title: criticalViolation.type,
          description: criticalViolation.description,
          location: criticalViolation.location,
          reported_by: 'Field App',
          timestamp: new Date().toISOString(),
          status: 'open',
          recommended_actions: analysisResult.ppeCompliance.violations.length > 0
            ? analysisResult.ppeCompliance.violations.map(v => `Address PPE violation: ${v}`)
            : ['Stop work in affected area', 'Notify site safety officer immediately'],
          photo_url: capturedImage || undefined,
        });
      }
    }
  }, [analysisState, analysisResult, capturedImage]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCapturedImage(null);
      setStep('capture');
      setCategory('progress');
      setLocationText('');
      setRelatedItem('');
      setNotes('');
      setTranscript('');
      setQrData(null);
      setRecording(false);
      setElapsed(0);
      setCaption('');
      setAiTags([]);
      setSafetyAlertBlock(null);
      resetAnalysis();
    }
  }, [open, resetAnalysis]);

  // ── Camera ─────────────────────────────────────────

  const handleCameraCapture = useCallback(async () => {
    impact('medium');
    const result = await capturePhoto();
    if (result?.imageUrl) {
      setCapturedImage(result.imageUrl);
      if (result.latitude && result.longitude) {
        setGps({ lat: result.latitude, lng: result.longitude });
      }
      notification('success');
      setStep('tag');
      analyzePhoto(result.imageUrl);
    }
  }, [capturePhoto, impact, notification, analyzePhoto]);

  // ── Voice Recording ────────────────────────────────

  const startRecording = useCallback(async () => {
    impact('medium');
    setRecording(true);
    setElapsed(0);
    setTranscript('');

    // Start Web Speech API recognition
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as unknown as Record<string, any>).SpeechRecognition || (window as unknown as Record<string, any>).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event: { results: { length: number; [index: number]: { [index: number]: { transcript: string } } } }) => {
          let full = '';
          for (let i = 0; i < event.results.length; i++) {
            full += event.results[i][0].transcript;
          }
          setTranscript(full);
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch { /* Speech API unavailable */ }

    // Timer
    timerRef.current = window.setInterval(() => {
      setElapsed((p) => p + 0.1);
    }, 100);

    // Waveform animation
    waveRef.current = window.setInterval(() => {
      setWaveform(Array(24).fill(0).map(() => 4 + (Math.sin(Date.now() / 200 + i * 0.5) * 0.5 + 0.5) * 28));
    }, 80);

    // Start MediaRecorder for actual audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.start();
      recorderRef.current = recorder;
    } catch { /* No mic */ }
  }, [impact]);

  const stopRecording = useCallback(() => {
    impact('light');
    setRecording(false);
    clearInterval(timerRef.current);
    clearInterval(waveRef.current);
    setWaveform(Array(24).fill(4));

    recognitionRef.current?.stop();
    recorderRef.current?.stop();
    recorderRef.current?.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());

    notification('success');
    setStep('tag');
  }, [impact, notification]);

  // ── QR Scan ────────────────────────────────────────

  const handleQrScan = useCallback(() => {
    impact('light');
    // In production, this would use BarcodeDetector API or a library
    // For now, simulate with a prompt
    const data = window.prompt('Scan QR: enter equipment/location ID');
    if (data) {
      setQrData(data);
      setLocationText(data);
      notification('success');
      setStep('tag');
    }
  }, [impact, notification]);

  // ── Save ───────────────────────────────────────────

  const handleSave = useCallback(() => {
    impact('medium');
    const capture: CaptureData = {
      id: crypto.randomUUID(),
      type: mode === 'camera' ? 'photo' : mode === 'voice' ? 'voice' : 'qr',
      imageUrl: capturedImage || undefined,
      transcript: transcript || undefined,
      qrData: qrData || undefined,
      caption: caption || undefined,
      aiTags: aiTags.length ? aiTags : undefined,
      category,
      location: locationText,
      gpsLat: gps?.lat,
      gpsLng: gps?.lng,
      relatedItem: relatedItem || undefined,
      notes,
      timestamp: new Date().toISOString(),
    };
    captureMutation.mutate(capture);
  }, [mode, capturedImage, transcript, qrData, caption, aiTags, category, locationText, gps, relatedItem, notes, impact, captureMutation]);

  // Focus trap
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const firstFocusable = dialog.querySelector<HTMLElement>('button:not([disabled]), input, textarea, select');
    firstFocusable?.focus();
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([type="file"]), textarea, select, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  const handleKeyActivate = useCallback((e: ReactKeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  }, []);

  const handleUploadFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCapturedImage(url);
    notification('success');
    setStep('tag');
    analyzePhoto(url);
  }, [notification, analyzePhoto]);

  if (!open) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={step === 'capture' ? 'Quick Capture' : 'Tag and Save'}
      style={{
        position: 'fixed', inset: 0, zIndex: zIndex.tooltip as number,
        backgroundColor: step === 'capture' ? colors.viewerBg : colors.surfacePage,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* ── Header ────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['3']} ${spacing['4']}`, flexShrink: 0,
        backgroundColor: step === 'capture' ? 'transparent' : colors.surfaceRaised,
        borderBottom: step === 'tag' ? `1px solid ${colors.borderSubtle}` : 'none',
      }}>
        <button onClick={onClose} style={{
          width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: step === 'capture' ? colors.overlayWhiteThin : 'transparent',
          border: 'none', borderRadius: borderRadius.full, cursor: 'pointer',
          touchAction: 'manipulation',
        }}
          aria-label="Close"
        >
          <X size={20} color={step === 'capture' ? 'white' : colors.textSecondary} />
        </button>
        <span style={{
          fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold,
          color: step === 'capture' ? 'white' : colors.textPrimary,
        }}>
          {step === 'capture' ? 'Quick Capture' : 'Tag & Save'}
        </span>
        <div style={{ width: 44 }} />
      </div>

      {step === 'capture' ? (
        /* ── CAPTURE STEP ────────────────────────── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Primary action cards */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: spacing['3'],
            width: '100%', padding: `0 ${spacing['5']}`,
            marginBottom: spacing['8'],
          }}>
            {([
              { id: 'camera' as const, icon: Camera, label: 'Photo', desc: 'Capture site conditions' },
              { id: 'voice' as const, icon: Mic, label: 'Voice', desc: 'Record voice note' },
              { id: 'qr' as const, icon: QrCode, label: 'QR Scan', desc: 'Scan equipment or location' },
            ]).map((m) => (
              <button
                key={m.id}
                onClick={() => { impact('light'); setMode(m.id); }}
                onTouchStart={() => { navigator.vibrate?.(10); }}
                style={{
                  width: '100%', height: '72px',
                  display: 'flex', alignItems: 'center', gap: spacing['4'],
                  padding: `0 ${spacing['5']}`,
                  backgroundColor: mode === m.id ? colors.primaryOrange : 'rgba(255,255,255,0.08)',
                  color: colors.white,
                  border: mode === m.id ? 'none' : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: borderRadius.xl,
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  transition: `background-color ${transitions.quick}`,
                  touchAction: 'manipulation',
                  flexShrink: 0,
                }}
                aria-pressed={mode === m.id}
              >
                <m.icon size={22} style={{ flexShrink: 0 }} />
                {m.label}
              </button>
            ))}

            {/* Daily Log shortcut */}
            <button
              onClick={() => { impact('light'); onClose(); navigate('/daily-log'); }}
              onTouchStart={() => { navigator.vibrate?.(10); }}
              style={{
                width: '100%', height: '72px',
                display: 'flex', alignItems: 'center', gap: spacing['4'],
                padding: `0 ${spacing['5']}`,
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: colors.white,
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: borderRadius.xl,
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                transition: `background-color ${transitions.quick}`,
                touchAction: 'manipulation',
                flexShrink: 0,
              }}
              aria-label="Open Daily Log"
            >
              <BookOpen size={22} style={{ flexShrink: 0 }} />
              Daily Log
            </button>
          </div>

          {/* Camera mode */}
          {mode === 'camera' && (
            <>
              {/* Viewfinder */}
              <div style={{
                width: '280px', height: '280px',
                border: `2px solid rgba(255,255,255,0.2)`,
                borderRadius: borderRadius.xl, position: 'relative', marginBottom: spacing['8'],
              }}>
                {/* Corner marks */}
                {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                  <div key={pos} style={{
                    position: 'absolute',
                    [pos.includes('top') ? 'top' : 'bottom']: -1,
                    [pos.includes('left') ? 'left' : 'right']: -1,
                    width: 24, height: 24,
                    borderColor: colors.primaryOrange,
                    borderStyle: 'solid', borderWidth: 0,
                    ...(pos.includes('top') ? { borderTopWidth: 3 } : { borderBottomWidth: 3 }),
                    ...(pos.includes('left') ? { borderLeftWidth: 3 } : { borderRightWidth: 3 }),
                    borderRadius: pos.includes('top') && pos.includes('left') ? `${borderRadius.xl} 0 0 0`
                      : pos.includes('top') && pos.includes('right') ? `0 ${borderRadius.xl} 0 0`
                      : pos.includes('bottom') && pos.includes('left') ? `0 0 0 ${borderRadius.xl}`
                      : `0 0 ${borderRadius.xl} 0`,
                  }} />
                ))}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.15)', fontSize: typography.fontSize.display }}>
                  <Camera size={64} />
                </div>
              </div>

              {/* Capture button */}
              <button
                onClick={handleCameraCapture}
                onKeyDown={(e) => handleKeyActivate(e, handleCameraCapture)}
                disabled={capturing}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
                  border: `4px solid ${colors.toolbarBg}`,
                  cursor: capturing ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: shadows.glow, opacity: capturing ? 0.6 : 1,
                  touchAction: 'manipulation',
                }}
                aria-label="Capture photo"
              >
                <Camera size={28} color="white" />
              </button>

              {/* Upload trigger */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadFile}
                style={{ display: 'none' }}
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => handleKeyActivate(e, () => fileInputRef.current?.click())}
                style={{
                  marginTop: spacing['3'],
                  padding: `${spacing['2']} ${spacing['4']}`, minHeight: '44px', minWidth: '44px',
                  backgroundColor: colors.overlayWhiteThin,
                  border: 'none', borderRadius: borderRadius.full, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  color: colors.textOnDarkMuted, fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily, touchAction: 'manipulation',
                }}
                aria-label="Upload photo"
              >
                <Camera size={14} /> Upload photo
              </button>

              {/* GPS indicator */}
              {gps && (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: spacing['4'], color: colors.darkMutedText, fontSize: typography.fontSize.caption }}>
                  <MapPin size={12} /> GPS: {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                </div>
              )}
            </>
          )}

          {/* Voice mode */}
          {mode === 'voice' && (
            <>
              {/* Live region for recording state announcements */}
              <div
                aria-live="polite"
                aria-atomic="true"
                style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
              >
                {recording ? 'Recording in progress' : transcript}
              </div>

              {/* Waveform */}
              <div
                aria-hidden="true"
                style={{ display: 'flex', alignItems: 'center', gap: 2, height: 48, marginBottom: spacing['6'] }}
              >
                {waveform.map((h, i) => (
                  <div key={i} style={{
                    width: 3, height: `${h}px`, borderRadius: 2,
                    backgroundColor: recording ? colors.statusCritical : 'rgba(255,255,255,0.15)',
                    transition: recording ? 'none' : `height ${transitions.quick}`,
                  }} />
                ))}
              </div>
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
                {recording ? 'Audio waveform active' : ''}
              </span>

              {/* Timer */}
              <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.white, margin: 0, marginBottom: spacing['2'], fontFeatureSettings: '"tnum"' }}>
                {formatTime(elapsed)}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.darkMutedText, margin: 0, marginBottom: spacing['8'] }}>
                {recording ? 'Listening...' : elapsed > 0 ? 'Tap to re-record' : 'Tap to start recording'}
              </p>

              {/* Record/Stop button */}
              <button
                onClick={() => recording ? stopRecording() : startRecording()}
                aria-label={recording ? 'Stop recording' : 'Start voice recording'}
                aria-pressed={recording}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  backgroundColor: recording ? 'rgba(255,255,255,0.15)' : colors.statusCritical,
                  border: `3px solid ${recording ? colors.statusCritical : 'transparent'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', touchAction: 'manipulation',
                }}
              >
                {recording ? <Square size={24} color="white" fill="white" /> : <Mic size={28} color="white" />}
              </button>

              {/* Live transcript */}
              {transcript && (
                <div style={{ marginTop: spacing['6'], maxWidth: '320px', padding: `0 ${spacing['4']}` }}>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.overlayWhiteBold, margin: 0, lineHeight: typography.lineHeight.relaxed, textAlign: 'center' }}>
                    "{transcript}"
                    {recording && <span style={{ opacity: 0.5, animation: 'pulse 1s infinite' }}>|</span>}
                  </p>
                </div>
              )}
            </>
          )}

          {/* QR mode */}
          {mode === 'qr' && (
            <>
              <div style={{
                width: '240px', height: '240px',
                border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: borderRadius.lg, position: 'relative', marginBottom: spacing['6'],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <QrCode size={64} color="rgba(255,255,255,0.15)" />
                {/* Scan line animation */}
                <div style={{
                  position: 'absolute', left: spacing['4'], right: spacing['4'],
                  height: 2, backgroundColor: colors.primaryOrange,
                  animation: 'scanLine 2s ease-in-out infinite',
                  boxShadow: `0 0 12px ${colors.primaryOrange}`,
                }} />
              </div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.darkMutedText, margin: 0, marginBottom: spacing['6'] }}>
                Point camera at QR code on equipment or location marker
              </p>
              <button
                onClick={handleQrScan}
                style={{
                  padding: `${spacing['3']} ${spacing['6']}`, minHeight: '48px', minWidth: '44px',
                  backgroundColor: colors.primaryOrange, color: colors.white,
                  border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
                  fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                  touchAction: 'manipulation',
                  fontFamily: typography.fontFamily,
                }}
              >
                Scan QR Code
              </button>
            </>
          )}
        </div>
      ) : (
        /* ── TAG STEP ────────────────────────────── */
        <div style={{ flex: 1, overflow: 'auto', padding: spacing['5'] }}>
          {/* Preview */}
          {capturedImage && (
            <div style={{
              width: '100%', height: 200, borderRadius: borderRadius.lg,
              backgroundImage: `url(${capturedImage})`, backgroundSize: 'cover', backgroundPosition: 'center',
              marginBottom: spacing['5'],
            }} />
          )}
          {transcript && (
            <div style={{
              padding: spacing['4'], backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.lg, marginBottom: spacing['5'],
            }}>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                Transcript
              </p>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>
                "{transcript}"
              </p>
            </div>
          )}
          {qrData && (
            <div style={{
              padding: spacing['4'], backgroundColor: colors.statusInfoSubtle,
              borderRadius: borderRadius.lg, marginBottom: spacing['5'],
              display: 'flex', alignItems: 'center', gap: spacing['3'],
            }}>
              <QrCode size={20} color={colors.statusInfo} />
              <div>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>QR Data</p>
                <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{qrData}</p>
              </div>
            </div>
          )}

          {/* AI Safety Alert */}
          {safetyAlertBlock && (
            <div style={{ marginBottom: spacing['5'] }}>
              <GenSafetyAlert block={safetyAlertBlock} onAction={() => {}} />
              <button
                onClick={() => { impact('medium'); notification('success'); setSafetyAlertBlock(null); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: spacing['2'], padding: `${spacing['3']} ${spacing['4']}`, minHeight: '48px',
                  backgroundColor: colors.statusCritical, color: 'white',
                  border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
                  fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily, marginTop: spacing['2'],
                  touchAction: 'manipulation',
                }}
              >
                <AlertTriangle size={16} /> Create Safety Observation
              </button>
            </div>
          )}

          {/* AI Caption */}
          {mode === 'camera' && (analysisState === 'analyzing' || analysisState === 'ready') && (
            <div style={{ marginBottom: spacing['5'] }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary, marginBottom: spacing['2'],
              }}>
                <Sparkles size={14} color={colors.primaryOrange} /> AI Caption
              </label>
              {analysisState === 'analyzing' ? (
                <div style={{
                  padding: `${spacing['3.5']} ${spacing['4']}`,
                  backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  border: `1.5px solid ${colors.borderSubtle}`,
                }}>
                  <RefreshCw size={14} color={colors.textTertiary} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Analyzing photo...</span>
                </div>
              ) : (
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="AI suggested caption..."
                  style={{
                    width: '100%', padding: `${spacing['3.5']} ${spacing['4']}`, fontSize: typography.fontSize.title,
                    fontFamily: typography.fontFamily,
                    border: `1.5px solid ${colors.primaryOrange}40`,
                    backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
                    outline: 'none', boxSizing: 'border-box', minHeight: '72px',
                    resize: 'vertical', lineHeight: typography.lineHeight.normal,
                  }}
                />
              )}
            </div>
          )}

          {/* AI Detected Tags */}
          {aiTags.length > 0 && (
            <div style={{ marginBottom: spacing['5'] }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary, marginBottom: spacing['2'],
              }}>
                <Sparkles size={14} color={colors.primaryOrange} /> Detected Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
                {aiTags.map((tag) => (
                  <span key={tag} style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                    padding: `${spacing['1']} ${spacing['2']} ${spacing['1']} ${spacing['3']}`,
                    backgroundColor: `${colors.primaryOrange}15`,
                    color: colors.primaryOrange,
                    border: `1px solid ${colors.primaryOrange}30`,
                    borderRadius: borderRadius.full,
                    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  }}>
                    {tag}
                    <button
                      onClick={() => setAiTags(tags => tags.filter(t => t !== tag))}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: spacing['2'], margin: `-${spacing['2']}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: colors.primaryOrange, lineHeight: 1,
                        minWidth: '44px', minHeight: '44px', touchAction: 'manipulation',
                      }}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          <label style={{ display: 'block', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['2'] }}>
            <Tag size={14} style={{ marginRight: spacing['1'], verticalAlign: 'middle' }} /> Category
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], marginBottom: spacing['5'] }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { impact('light'); setCategory(cat.id); }}
                style={{
                  padding: `${spacing['2']} ${spacing['4']}`, minHeight: '44px', minWidth: '44px',
                  backgroundColor: category === cat.id ? `${cat.color}15` : colors.surfaceInset,
                  color: category === cat.id ? cat.color : colors.textSecondary,
                  border: category === cat.id ? `1.5px solid ${cat.color}40` : `1.5px solid transparent`,
                  borderRadius: borderRadius.full, cursor: 'pointer',
                  fontSize: typography.fontSize.sm, fontWeight: category === cat.id ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  fontFamily: typography.fontFamily, transition: `all ${transitions.instant}`,
                  touchAction: 'manipulation',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Location */}
          <label style={{ display: 'block', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['2'] }}>
            <MapPin size={14} style={{ marginRight: spacing['1'], verticalAlign: 'middle' }} /> Location
          </label>
          <input
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="Floor, area, room..."
            style={{
              width: '100%', padding: `${spacing['3.5']} ${spacing['4']}`, fontSize: typography.fontSize.title,
              fontFamily: typography.fontFamily, border: 'none',
              backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
              outline: 'none', boxSizing: 'border-box', minHeight: '48px',
              marginBottom: spacing['4'],
            }}
          />

          {/* Related item */}
          <label style={{ display: 'block', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['2'] }}>
            <Link2 size={14} style={{ marginRight: spacing['1'], verticalAlign: 'middle' }} /> Link to Item (optional)
          </label>
          <input
            value={relatedItem}
            onChange={(e) => setRelatedItem(e.target.value)}
            placeholder="RFI, task, punch item..."
            style={{
              width: '100%', padding: `${spacing['3.5']} ${spacing['4']}`, fontSize: typography.fontSize.title,
              fontFamily: typography.fontFamily, border: 'none',
              backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
              outline: 'none', boxSizing: 'border-box', minHeight: '48px',
              marginBottom: spacing['4'],
            }}
          />

          {/* Notes */}
          <label style={{ display: 'block', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['2'] }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional context..."
            style={{
              width: '100%', padding: `${spacing['3.5']} ${spacing['4']}`, fontSize: typography.fontSize.title,
              fontFamily: typography.fontFamily, border: 'none',
              backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
              outline: 'none', boxSizing: 'border-box', minHeight: '96px',
              resize: 'vertical', lineHeight: typography.lineHeight.normal,
            }}
          />
        </div>
      )}

      {/* ── Save Button (tag step) ────────────────── */}
      {step === 'tag' && (
        <div style={{
          padding: `${spacing['3']} ${spacing['5']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceRaised,
        }}>
          <button
            onClick={handleSave}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: spacing['2'], padding: `${spacing['4']}`, minHeight: '52px',
              background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
              color: colors.white, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
              fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily, boxShadow: shadows.glow,
              touchAction: 'manipulation',
            }}
          >
            <Check size={18} /> Save Capture
          </button>
        </div>
      )}

      {/* Sync status bar */}
      {(() => {
        const isActivelySyncing = syncState === 'syncing' || captureMutation.isPending;
        const offlineQueued = !isOnline && pendingChanges > 0;
        const bg = isActivelySyncing
          ? colors.statusInfoSubtle
          : offlineQueued
          ? colors.statusPendingSubtle
          : colors.statusActiveSubtle;
        const iconColor = isActivelySyncing
          ? colors.statusInfo
          : offlineQueued
          ? colors.statusPending
          : colors.statusActive;
        const text = isActivelySyncing
          ? 'Syncing...'
          : offlineQueued
          ? `${pendingChanges} item${pendingChanges !== 1 ? 's' : ''} queued`
          : 'Synced';
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['4']}`,
            backgroundColor: bg,
            borderTop: `1px solid ${iconColor}20`,
            paddingBottom: `max(${spacing['2']}, env(safe-area-inset-bottom))`,
            flexShrink: 0,
          }}>
            {isActivelySyncing
              ? <RefreshCw size={12} color={iconColor} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              : offlineQueued
              ? <Clock size={12} color={iconColor} style={{ flexShrink: 0 }} />
              : <Check size={12} color={iconColor} style={{ flexShrink: 0 }} />
            }
            <span style={{
              fontSize: typography.fontSize.caption,
              color: iconColor,
              fontWeight: typography.fontWeight.medium,
            }}>
              {text}
            </span>
          </div>
        );
      })()}

      {/* Animations */}
      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 20px; }
          50% { top: calc(100% - 20px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
