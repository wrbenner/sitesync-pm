// ── QuickRFI ─────────────────────────────────────────────────
// Full-screen photo + voice → AI-drafted RFI in 15 seconds.
// Three phases: Capture → Process → Review & Submit

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MicOff, X, Check, Edit3, Send,
  AlertTriangle, Loader2, ChevronDown, Clock,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, zIndex, touchTarget } from '../../styles/theme';
import { duration, easingArray } from '../../styles/animations';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useHaptics } from '../../hooks/useMobileCapture';
import { useProjectId } from '../../hooks/useProjectId';
import { supabase } from '../../lib/supabase';
import { rfiService } from '../../services/rfiService';
import { toast } from 'sonner';
import type { Priority } from '../../types/database';

// ── Types ────────────────────────────────────────────────────

type Phase = 'capture-photo' | 'capture-voice' | 'processing' | 'review';

interface AIDraft {
  subject: string;
  question: string;
  trade_classification?: { trade?: string; csi_division?: string; urgency?: string };
  suggested_assignee_id?: string;
  suggested_assignee_name?: string;
  drawing_reference?: string;
  code_citation?: string;
}

interface QuickRFIProps {
  open: boolean;
  onClose: () => void;
}

// ── Waveform Visualizer ──────────────────────────────────────

function WaveformBars({ frequencies, active }: { frequencies: number[]; active: boolean }) {
  const bars = frequencies.slice(0, 24);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', height: 48 }}>
      {bars.map((freq, i) => (
        <motion.div
          key={i}
          animate={{
            height: active ? Math.max(4, freq * 6) : 4,
          }}
          transition={{ duration: 0.08, ease: 'linear' }}
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: active ? colors.primaryOrange : colors.gray400,
          }}
        />
      ))}
    </div>
  );
}

// ── Progress Steps ───────────────────────────────────────────

function ProcessingSteps({ currentStep }: { currentStep: number }) {
  const steps = [
    'Analyzing photo...',
    'Transcribing voice...',
    'Drafting RFI...',
    'Classifying trade...',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      {steps.map((label, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: isDone || isActive ? 1 : 0.4, x: 0 }}
            transition={{ delay: i * 0.15, duration: 0.2 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              fontSize: typography.fontSize.sm,
              color: isDone ? colors.statusActive : isActive ? colors.white : colors.textOnDarkMuted,
            }}
          >
            {isDone ? (
              <Check size={14} />
            ) : isActive ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Clock size={14} />
            )}
            {label}
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Urgency Badge ────────────────────────────────────────────

function UrgencyBadge({ level }: { level: string }) {
  const colorMap: Record<string, { fg: string; bg: string }> = {
    low: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
    medium: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
    high: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
    critical: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
  };
  const c = colorMap[level.toLowerCase()] || colorMap.medium;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
      padding: `${spacing['0.5']} ${spacing['2']}`,
      borderRadius: borderRadius.full,
      fontSize: typography.fontSize.label,
      fontWeight: typography.fontWeight.medium,
      color: c.fg, backgroundColor: c.bg,
      textTransform: 'capitalize',
    }}>
      {level === 'critical' && <AlertTriangle size={11} />}
      {level}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────

const QuickRFI: React.FC<QuickRFIProps> = ({ open, onClose }) => {
  const reducedMotion = useReducedMotion();
  const projectId = useProjectId();
  const { impact, notification } = useHaptics();
  const voice = useVoiceCapture();

  const [phase, setPhase] = useState<Phase>('capture-photo');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [aiDraft, setAiDraft] = useState<AIDraft | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editQuestion, setEditQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Camera ───────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('Camera access denied. Please allow camera access.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUrl;
  }, []);

  // ── Lifecycle ────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setPhase('capture-photo');
      setPhotoDataUrl(null);
      setAiDraft(null);
      setEditMode(false);
      setError(null);
      setProcessingStep(0);
      startCamera();
    } else {
      stopCamera();
      voice.reset();
    }
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Handle Photo Capture ─────────────────────────────────

  const handleTakePhoto = useCallback(async () => {
    const dataUrl = takePhoto();
    if (!dataUrl) return;

    await impact('medium');
    setPhotoDataUrl(dataUrl);
    stopCamera();

    // Transition to voice phase
    setPhase('capture-voice');
    try {
      await voice.startRecording();
    } catch {
      // Voice failed but photo succeeded — graceful degradation
      setError('Microphone unavailable. Submitting photo only.');
    }
  }, [takePhoto, impact, stopCamera, voice]);

  // ── Handle Voice Done → Process ──────────────────────────

  const handleVoiceDone = useCallback(async () => {
    await voice.stopRecording();
    await impact('light');
    setPhase('processing');

    // Get transcript from voice hook
    const transcript = voice.transcript || voice.interimText || '';

    // Simulate progress steps
    setProcessingStep(0);
    const stepTimer1 = setTimeout(() => setProcessingStep(1), 800);
    const stepTimer2 = setTimeout(() => setProcessingStep(2), 1600);
    const stepTimer3 = setTimeout(() => setProcessingStep(3), 2400);

    try {
      // Extract base64 from data URL
      const photoBase64 = photoDataUrl?.split(',')[1] || '';

      const { data, error: fnError } = await supabase.functions.invoke('ai-rfi-draft', {
        body: {
          description: transcript,
          photo_base64: photoBase64,
          project_id: projectId,
        },
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      if (fnError || !data) {
        throw new Error(fnError?.message || 'AI processing failed');
      }

      const draft: AIDraft = {
        subject: data.title || data.subject || 'Untitled RFI',
        question: data.description || data.question || transcript,
        trade_classification: data.trade_classification || data.classification,
        suggested_assignee_id: data.suggested_assignee_id,
        suggested_assignee_name: data.suggested_assignee_name || data.suggested_assignee,
        drawing_reference: data.drawing_reference,
        code_citation: data.code_citation,
      };

      setAiDraft(draft);
      setEditSubject(draft.subject);
      setEditQuestion(draft.question);
      setProcessingStep(4);
      await notification('success');
      setPhase('review');
     
    } catch (_err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      // Graceful degradation: show what we have
      const fallbackDraft: AIDraft = {
        subject: 'Field Observation',
        question: transcript || 'Photo captured — please add description.',
        trade_classification: { urgency: 'medium' },
      };
      setAiDraft(fallbackDraft);
      setEditSubject(fallbackDraft.subject);
      setEditQuestion(fallbackDraft.question);
      setError('AI processing failed — showing captured data. You can edit and submit.');
      setPhase('review');
    }
  }, [voice, photoDataUrl, projectId, impact, notification]);

  // ── Submit RFI ───────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!aiDraft || !projectId) return;

    setSubmitting(true);
    try {
      const priority = (aiDraft.trade_classification?.urgency as Priority) || 'medium';
      const { data: rfi, error: createError } = await rfiService.createRfi({
        project_id: projectId,
        title: editMode ? editSubject : aiDraft.subject,
        description: editMode ? editQuestion : aiDraft.question,
        priority,
        assigned_to: aiDraft.suggested_assignee_id ?? undefined,
      });

      if (createError || !rfi) {
        throw new Error(createError || 'Failed to create RFI');
      }

      // Transition to open
      await rfiService.transitionStatus(rfi.id, 'open');

      await notification('success');
      toast.success(`RFI created successfully`);
      onClose();
    } catch (err) {
      toast.error(`Failed to create RFI: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [aiDraft, projectId, editMode, editSubject, editQuestion, notification, onClose]);

  // ── Close handler ────────────────────────────────────────

  const handleClose = useCallback(() => {
    stopCamera();
    voice.cancelRecording();
    onClose();
  }, [stopCamera, voice, onClose]);

  // ── Skip voice (photo only) ──────────────────────────────

  const handleSkipVoice = useCallback(async () => {
    voice.cancelRecording();
    setPhase('processing');

    setProcessingStep(0);
    const stepTimer1 = setTimeout(() => setProcessingStep(1), 800);
    const stepTimer2 = setTimeout(() => setProcessingStep(2), 1600);
    const stepTimer3 = setTimeout(() => setProcessingStep(3), 2400);

    try {
      const photoBase64 = photoDataUrl?.split(',')[1] || '';

      const { data, error: fnError } = await supabase.functions.invoke('ai-rfi-draft', {
        body: {
          description: '',
          photo_base64: photoBase64,
          project_id: projectId,
        },
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      if (fnError || !data) throw new Error('AI processing failed');

      const draft: AIDraft = {
        subject: data.title || data.subject || 'Untitled RFI',
        question: data.description || data.question || '',
        trade_classification: data.trade_classification || data.classification,
        suggested_assignee_id: data.suggested_assignee_id,
        suggested_assignee_name: data.suggested_assignee_name || data.suggested_assignee,
        drawing_reference: data.drawing_reference,
        code_citation: data.code_citation,
      };

      setAiDraft(draft);
      setEditSubject(draft.subject);
      setEditQuestion(draft.question);
      setProcessingStep(4);
      setPhase('review');
    } catch {
      const fallback: AIDraft = {
        subject: 'Field Observation',
        question: 'Photo captured — please add description.',
        trade_classification: { urgency: 'medium' },
      };
      setAiDraft(fallback);
      setEditSubject(fallback.subject);
      setEditQuestion(fallback.question);
      setError('AI processing failed — you can edit and submit manually.');
      setPhase('review');
    }
  }, [voice, photoDataUrl, projectId]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="quick-rfi-overlay"
          initial={reducedMotion ? undefined : { opacity: 0 }}
          animate={reducedMotion ? undefined : { opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: duration.normal / 1000 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: zIndex.modal + 10,
            backgroundColor: phase === 'review' ? colors.overlayHeavy : colors.black,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ── Close Button ──────────────────────────────────── */}
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: spacing['4'],
              right: spacing['4'],
              zIndex: 10,
              width: touchTarget.comfortable,
              height: touchTarget.comfortable,
              borderRadius: borderRadius.full,
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: 'none',
              color: colors.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={22} />
          </button>

          {/* ── Phase: Capture Photo ──────────────────────────── */}
          <AnimatePresence mode="wait">
            {phase === 'capture-photo' && (
              <motion.div
                key="photo-phase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: duration.normal / 1000, ease: easingArray.apple }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Camera Viewfinder */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    flex: 1,
                    objectFit: 'cover',
                    width: '100%',
                    backgroundColor: '#000',
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Camera UI Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: spacing['6'],
                  paddingBottom: spacing['10'],
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: spacing['3'],
                }}>
                  <span style={{
                    color: colors.white,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.medium,
                    opacity: 0.8,
                  }}>
                    Point at the issue and tap to capture
                  </span>

                  {/* Shutter Button */}
                  <button
                    onClick={handleTakePhoto}
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: borderRadius.full,
                      border: '4px solid rgba(255,255,255,0.9)',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    <div style={{
                      width: '58px',
                      height: '58px',
                      borderRadius: borderRadius.full,
                      backgroundColor: colors.white,
                      transition: 'transform 100ms ease',
                    }} />
                  </button>
                </div>

                {error && (
                  <div style={{
                    position: 'absolute', top: spacing['16'], left: spacing['4'], right: spacing['4'],
                    padding: spacing['3'],
                    backgroundColor: 'rgba(224, 82, 82, 0.9)',
                    borderRadius: borderRadius.md,
                    color: colors.white,
                    fontSize: typography.fontSize.sm,
                    textAlign: 'center',
                  }}>
                    {error}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Phase: Capture Voice ─────────────────────────── */}
            {phase === 'capture-voice' && (
              <motion.div
                key="voice-phase"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: duration.normal / 1000, ease: easingArray.apple }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Photo thumbnail background */}
                {photoDataUrl && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${photoDataUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(20px) brightness(0.3)',
                  }} />
                )}

                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  padding: spacing['6'],
                  gap: spacing['6'],
                }}>
                  {/* Photo preview */}
                  {photoDataUrl && (
                    <motion.img
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      src={photoDataUrl}
                      alt="Captured"
                      style={{
                        width: 120,
                        height: 90,
                        objectFit: 'cover',
                        borderRadius: borderRadius.lg,
                        border: '2px solid rgba(255,255,255,0.2)',
                      }}
                    />
                  )}

                  {/* Recording indicator */}
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: borderRadius.full,
                      backgroundColor: '#E05252',
                    }}
                  />

                  <span style={{
                    color: colors.white,
                    fontSize: typography.fontSize.title,
                    fontWeight: typography.fontWeight.semibold,
                  }}>
                    Describe the issue
                  </span>

                  {/* Waveform */}
                  <WaveformBars
                    frequencies={voice.waveform.frequencies}
                    active={voice.phase === 'recording'}
                  />

                  {/* Live transcript */}
                  {(voice.transcript || voice.interimText) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        maxWidth: 320,
                        padding: spacing['3'],
                        borderRadius: borderRadius.md,
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        color: colors.white,
                        fontSize: typography.fontSize.sm,
                        lineHeight: typography.lineHeight.normal,
                        textAlign: 'center',
                      }}
                    >
                      {voice.transcript}
                      {voice.interimText && (
                        <span style={{ opacity: 0.5 }}> {voice.interimText}</span>
                      )}
                    </motion.div>
                  )}

                  {/* Elapsed */}
                  <span style={{
                    color: colors.textOnDarkMuted,
                    fontSize: typography.fontSize.label,
                    fontFamily: typography.fontFamilyMono,
                  }}>
                    {Math.floor(voice.elapsed)}s
                  </span>
                </div>

                {/* Bottom controls */}
                <div style={{
                  padding: spacing['6'],
                  paddingBottom: spacing['10'],
                  display: 'flex',
                  justifyContent: 'center',
                  gap: spacing['4'],
                  position: 'relative',
                }}>
                  {/* Skip voice */}
                  <button
                    onClick={handleSkipVoice}
                    style={{
                      height: touchTarget.field,
                      padding: `0 ${spacing['5']}`,
                      borderRadius: borderRadius.full,
                      border: '1px solid rgba(255,255,255,0.3)',
                      backgroundColor: 'transparent',
                      color: colors.white,
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['2'],
                    }}
                  >
                    <ChevronDown size={16} />
                    Skip
                  </button>

                  {/* Done recording */}
                  <button
                    onClick={handleVoiceDone}
                    style={{
                      height: touchTarget.field,
                      padding: `0 ${spacing['8']}`,
                      borderRadius: borderRadius.full,
                      border: 'none',
                      backgroundColor: colors.primaryOrange,
                      color: colors.white,
                      fontSize: typography.fontSize.body,
                      fontWeight: typography.fontWeight.semibold,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['2'],
                    }}
                  >
                    <MicOff size={18} />
                    Done
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Phase: Processing ────────────────────────────── */}
            {phase === 'processing' && (
              <motion.div
                key="processing-phase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.normal / 1000 }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  gap: spacing['8'],
                }}
              >
                {/* Photo with pulse */}
                {photoDataUrl && (
                  <motion.div
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <img loading="lazy"
                      src={photoDataUrl}
                      alt="Processing"
                      style={{
                        width: 200,
                        height: 150,
                        objectFit: 'cover',
                        borderRadius: borderRadius.xl,
                        border: '2px solid rgba(255,255,255,0.15)',
                      }}
                    />
                  </motion.div>
                )}

                {/* Transcription preview */}
                {(voice.transcript || voice.interimText) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      maxWidth: 300,
                      padding: spacing['3'],
                      borderRadius: borderRadius.md,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      color: colors.textOnDarkMuted,
                      fontSize: typography.fontSize.sm,
                      lineHeight: typography.lineHeight.normal,
                      textAlign: 'center',
                    }}
                  >
                    &ldquo;{voice.transcript || voice.interimText}&rdquo;
                  </motion.div>
                )}

                <ProcessingSteps currentStep={processingStep} />
              </motion.div>
            )}

            {/* ── Phase: Review ─────────────────────────────────── */}
            {phase === 'review' && aiDraft && (
              <motion.div
                key="review-phase"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: duration.smooth / 1000, ease: easingArray.apple }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* Photo strip at top */}
                {photoDataUrl && (
                  <div style={{ height: 160, flexShrink: 0, position: 'relative' }}>
                    <img loading="lazy"
                      src={photoDataUrl}
                      alt="RFI field observation"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 60,
                      background: 'linear-gradient(transparent, rgba(255,255,255,1))',
                    }} />
                  </div>
                )}

                {/* RFI Card */}
                <div style={{
                  flex: 1,
                  padding: spacing['5'],
                  backgroundColor: colors.white,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing['5'],
                  borderTopLeftRadius: photoDataUrl ? 0 : borderRadius['2xl'],
                  borderTopRightRadius: photoDataUrl ? 0 : borderRadius['2xl'],
                }}>
                  {/* Error banner */}
                  {error && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['2'],
                      padding: spacing['3'],
                      backgroundColor: colors.statusPendingSubtle,
                      borderRadius: borderRadius.md,
                      fontSize: typography.fontSize.sm,
                      color: colors.statusPending,
                    }}>
                      <AlertTriangle size={14} />
                      {error}
                    </div>
                  )}

                  {/* Subject */}
                  {editMode ? (
                    <input
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      style={{
                        width: '100%',
                        fontSize: typography.fontSize.subtitle,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.borderDefault}`,
                        borderRadius: borderRadius.md,
                        padding: spacing['3'],
                        outline: 'none',
                        fontFamily: typography.fontFamily,
                      }}
                    />
                  ) : (
                    <h2 style={{
                      fontSize: typography.fontSize.subtitle,
                      fontWeight: typography.fontWeight.bold,
                      color: colors.textPrimary,
                      lineHeight: typography.lineHeight.tight,
                      margin: 0,
                    }}>
                      {aiDraft.subject}
                    </h2>
                  )}

                  {/* Classification badges */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: spacing['2'],
                  }}>
                    {aiDraft.trade_classification?.urgency && (
                      <UrgencyBadge level={aiDraft.trade_classification.urgency} />
                    )}
                    {aiDraft.trade_classification?.trade && (
                      <span style={{
                        display: 'inline-flex',
                        padding: `${spacing['0.5']} ${spacing['2']}`,
                        borderRadius: borderRadius.full,
                        fontSize: typography.fontSize.label,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.statusInfo,
                        backgroundColor: colors.statusInfoSubtle,
                        textTransform: 'capitalize',
                      }}>
                        {aiDraft.trade_classification.trade}
                      </span>
                    )}
                    {aiDraft.trade_classification?.csi_division && (
                      <span style={{
                        display: 'inline-flex',
                        padding: `${spacing['0.5']} ${spacing['2']}`,
                        borderRadius: borderRadius.full,
                        fontSize: typography.fontSize.label,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.statusReview,
                        backgroundColor: colors.statusReviewSubtle,
                      }}>
                        CSI {aiDraft.trade_classification.csi_division}
                      </span>
                    )}
                  </div>

                  {/* Question text */}
                  {editMode ? (
                    <textarea
                      value={editQuestion}
                      onChange={e => setEditQuestion(e.target.value)}
                      rows={6}
                      style={{
                        width: '100%',
                        fontSize: typography.fontSize.body,
                        color: colors.textPrimary,
                        lineHeight: typography.lineHeight.normal,
                        border: `1px solid ${colors.borderDefault}`,
                        borderRadius: borderRadius.md,
                        padding: spacing['3'],
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: typography.fontFamily,
                      }}
                    />
                  ) : (
                    <p style={{
                      fontSize: typography.fontSize.body,
                      color: colors.textSecondary,
                      lineHeight: typography.lineHeight.relaxed,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {aiDraft.question}
                    </p>
                  )}

                  {/* Meta: assignee, drawing, code */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing['3'],
                    padding: spacing['3'],
                    backgroundColor: colors.surfaceInset,
                    borderRadius: borderRadius.md,
                  }}>
                    {aiDraft.suggested_assignee_name && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.sm }}>
                        <span style={{ color: colors.textTertiary }}>Assigned to</span>
                        <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                          {aiDraft.suggested_assignee_name}
                        </span>
                      </div>
                    )}
                    {aiDraft.drawing_reference && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.sm }}>
                        <span style={{ color: colors.textTertiary }}>Drawing</span>
                        <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                          {aiDraft.drawing_reference}
                        </span>
                      </div>
                    )}
                    {aiDraft.code_citation && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.sm }}>
                        <span style={{ color: colors.textTertiary }}>Code Reference</span>
                        <span style={{
                          color: colors.statusInfo,
                          fontWeight: typography.fontWeight.medium,
                          fontSize: typography.fontSize.label,
                        }}>
                          {aiDraft.code_citation}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: spacing['3'],
                    paddingBottom: spacing['6'],
                  }}>
                    <button
                      onClick={() => {
                        if (editMode) {
                          // Save edits back to draft
                          setAiDraft(prev => prev ? { ...prev, subject: editSubject, question: editQuestion } : prev);
                        }
                        setEditMode(!editMode);
                      }}
                      style={{
                        flex: 1,
                        height: touchTarget.field,
                        borderRadius: borderRadius.xl,
                        border: `1px solid ${colors.borderDefault}`,
                        backgroundColor: colors.white,
                        color: colors.textPrimary,
                        fontSize: typography.fontSize.body,
                        fontWeight: typography.fontWeight.medium,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing['2'],
                      }}
                    >
                      <Edit3 size={16} />
                      {editMode ? 'Done Editing' : 'Edit'}
                    </button>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      style={{
                        flex: 2,
                        height: touchTarget.field,
                        borderRadius: borderRadius.xl,
                        border: 'none',
                        backgroundColor: submitting ? colors.orangePressed : colors.primaryOrange,
                        color: colors.white,
                        fontSize: typography.fontSize.body,
                        fontWeight: typography.fontWeight.semibold,
                        cursor: submitting ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing['2'],
                        opacity: submitting ? 0.7 : 1,
                      }}
                    >
                      {submitting ? (
                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Send size={18} />
                      )}
                      {submitting ? 'Submitting...' : 'Submit RFI'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spin keyframes */}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickRFI;
