// ── DailyLogCapture ──────────────────────────────────────────
// Floating capture bar that appears throughout the day at the bottom of screen.
// Quick buttons: Photo, Voice Note, Add Crew, Safety Note
// Each capture gets timestamped and added to the running daily log.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Mic, Users, AlertTriangle, X, Check,
  Loader2, Plus, UserPlus,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex, touchTarget } from '../../styles/theme';
import { dailyLogService } from '../../services/dailyLogService';
import type { CaptureType } from '../../services/dailyLogService';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────

type CaptureMode = null | 'photo' | 'voice' | 'crew' | 'safety' | 'visitor';

interface DailyLogCaptureProps {
  logId: string | null;
  visible?: boolean;
}

// ── Quick Capture Buttons ────────────────────────────────────

const captureButtons: Array<{ mode: CaptureMode; icon: React.ReactNode; label: string; emoji: string }> = [
  { mode: 'photo', icon: <Camera size={20} />, label: 'Photo', emoji: '📷' },
  { mode: 'voice', icon: <Mic size={20} />, label: 'Voice', emoji: '🎤' },
  { mode: 'crew', icon: <Users size={20} />, label: 'Add Crew', emoji: '👷' },
  { mode: 'safety', icon: <AlertTriangle size={20} />, label: 'Safety', emoji: '⚠️' },
  { mode: 'visitor', icon: <UserPlus size={20} />, label: 'Visitor', emoji: '👤' },
];

// ── Capture Forms ────────────────────────────────────────────

function PhotoCapture({ onCapture, onCancel }: { onCapture: (dataUrl: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setReady(true);
        }
      })
      .catch(() => {
        toast.error('Camera access denied');
        onCancel();
      });

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onCancel]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(dataUrl);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden', backgroundColor: '#000' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: spacing['2'] }}>
        <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        <button onClick={takePhoto} disabled={!ready} style={confirmBtnStyle}>
          <Camera size={16} /> Capture
        </button>
      </div>
    </div>
  );
}

function VoiceCapture({ onCapture, onCancel }: { onCapture: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your note or tap to start voice recording..."
        rows={3}
        style={{
          width: '100%',
          padding: spacing['3'],
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.md,
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize.body,
          color: colors.textPrimary,
          backgroundColor: colors.surfaceRaised,
          resize: 'vertical',
          outline: 'none',
          minHeight: touchTarget.field,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: spacing['2'] }}>
        <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        <button onClick={() => text.trim() && onCapture(text.trim())} disabled={!text.trim()} style={confirmBtnStyle}>
          <Check size={16} /> Save Note
        </button>
      </div>
    </div>
  );
}

function CrewCapture({ onCapture, onCancel }: { onCapture: (data: { trade: string; company: string; headcount: number; hours: number }) => void; onCancel: () => void }) {
  const [trade, setTrade] = useState('');
  const [company, setCompany] = useState('');
  const [headcount, setHeadcount] = useState('');
  const [hours, setHours] = useState('8');

  const handleSubmit = () => {
    if (!trade && !company) return;
    onCapture({
      trade,
      company,
      headcount: parseInt(headcount) || 0,
      hours: parseFloat(hours) || 8,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
        <input
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          placeholder="Trade (e.g. Electrical)"
          style={inputStyle}
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          style={inputStyle}
        />
        <input
          value={headcount}
          onChange={(e) => setHeadcount(e.target.value)}
          placeholder="# Workers"
          type="number"
          inputMode="numeric"
          style={inputStyle}
        />
        <input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Hours"
          type="number"
          inputMode="decimal"
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: spacing['2'] }}>
        <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        <button onClick={handleSubmit} disabled={!trade && !company} style={confirmBtnStyle}>
          <Plus size={16} /> Add Crew
        </button>
      </div>
    </div>
  );
}

function SafetyCapture({ onCapture, onCancel }: { onCapture: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe the safety observation, toolbox talk, or incident..."
        rows={3}
        style={{
          width: '100%',
          padding: spacing['3'],
          border: `1px solid ${colors.statusCritical}40`,
          borderRadius: borderRadius.md,
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize.body,
          color: colors.textPrimary,
          backgroundColor: colors.surfaceRaised,
          resize: 'vertical',
          outline: 'none',
          minHeight: touchTarget.field,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: spacing['2'] }}>
        <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        <button onClick={() => text.trim() && onCapture(text.trim())} disabled={!text.trim()} style={confirmBtnStyle}>
          <AlertTriangle size={16} /> Log Safety Note
        </button>
      </div>
    </div>
  );
}

function VisitorCapture({ onCapture, onCancel }: { onCapture: (data: { name: string; company: string; purpose: string }) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState('');

  const handleSubmit = () => {
    if (!name && !company) return;
    onCapture({ name, company, purpose });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Visitor name"
        style={inputStyle}
      />
      <input
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company"
        style={inputStyle}
      />
      <input
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        placeholder="Purpose of visit"
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: spacing['2'] }}>
        <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        <button onClick={handleSubmit} disabled={!name && !company} style={confirmBtnStyle}>
          <UserPlus size={16} /> Add Visitor
        </button>
      </div>
    </div>
  );
}

// ── Shared Styles ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: spacing['3'],
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.md,
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.body,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceRaised,
  outline: 'none',
  minHeight: touchTarget.comfortable,
  boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing['1'],
  padding: `${spacing['2']} ${spacing['3']}`,
  minHeight: touchTarget.comfortable,
  backgroundColor: colors.surfaceRaised,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.md,
  cursor: 'pointer',
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  color: colors.textSecondary,
};

const confirmBtnStyle: React.CSSProperties = {
  flex: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing['2'],
  padding: `${spacing['2']} ${spacing['3']}`,
  minHeight: touchTarget.comfortable,
  backgroundColor: colors.primaryOrange,
  border: 'none',
  borderRadius: borderRadius.md,
  cursor: 'pointer',
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.semibold,
  color: colors.white,
};

// ── Main Component ───────────────────────────────────────────

export function DailyLogCapture({ logId, visible = true }: DailyLogCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCapture = useCallback(async (type: CaptureType, data: Record<string, unknown>) => {
    if (!logId) {
      toast.error('No active daily log');
      return;
    }

    setSaving(true);
    const result = await dailyLogService.addCapture(logId, type, data);
    setSaving(false);

    if (result.error) {
      toast.error(`Failed to save: ${result.error}`);
    } else {
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} added to daily log`);
      setMode(null);
      setExpanded(false);
      // Notify AutoDailyLog to refresh
      const refreshFn = (window as Record<string, unknown>).__refreshDailyLogEntries;
      if (typeof refreshFn === 'function') (refreshFn as () => void)();
    }
  }, [logId]);

  const handlePhotoCapture = useCallback((dataUrl: string) => {
    handleCapture('photo', {
      photoUrl: dataUrl,
      description: `Photo captured at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
    });
  }, [handleCapture]);

  const handleVoiceCapture = useCallback((text: string) => {
    handleCapture('voice', { description: text });
  }, [handleCapture]);

  const handleCrewCapture = useCallback((data: { trade: string; company: string; headcount: number; hours: number }) => {
    handleCapture('crew', data);
  }, [handleCapture]);

  const handleSafetyCapture = useCallback((text: string) => {
    handleCapture('safety', { description: text });
  }, [handleCapture]);

  const handleVisitorCapture = useCallback((data: { name: string; company: string; purpose: string }) => {
    handleCapture('visitor', {
      inspector_name: data.name,
      company: data.company,
      description: data.purpose,
      time_in: new Date().toISOString(),
    });
  }, [handleCapture]);

  if (!visible || !logId) return null;

  return (
    <>
      {/* Overlay when expanded */}
      <AnimatePresence>
        {(expanded || mode) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { setMode(null); setExpanded(false); }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: colors.overlayDark,
              zIndex: zIndex.fixed,
            }}
          />
        )}
      </AnimatePresence>

      {/* Capture bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: zIndex.modal,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <AnimatePresence mode="wait">
          {mode ? (
            <motion.div
              key="form"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              style={{
                margin: `0 ${spacing['3']}`,
                marginBottom: spacing['3'],
                padding: spacing['4'],
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.xl,
                boxShadow: shadows.panel,
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              {/* Close button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  {mode === 'photo' && 'Capture Photo'}
                  {mode === 'voice' && 'Voice Note'}
                  {mode === 'crew' && 'Add Crew'}
                  {mode === 'safety' && 'Safety Note'}
                  {mode === 'visitor' && 'Add Visitor'}
                </span>
                <button
                  onClick={() => setMode(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.full,
                    border: 'none',
                    backgroundColor: colors.surfaceInset,
                    cursor: 'pointer',
                    color: colors.textSecondary,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {saving ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing['6'], gap: spacing['2'] }}>
                  <Loader2 size={20} color={colors.primaryOrange} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>Saving...</span>
                </div>
              ) : (
                <>
                  {mode === 'photo' && <PhotoCapture onCapture={handlePhotoCapture} onCancel={() => setMode(null)} />}
                  {mode === 'voice' && <VoiceCapture onCapture={handleVoiceCapture} onCancel={() => setMode(null)} />}
                  {mode === 'crew' && <CrewCapture onCapture={handleCrewCapture} onCancel={() => setMode(null)} />}
                  {mode === 'safety' && <SafetyCapture onCapture={handleSafetyCapture} onCancel={() => setMode(null)} />}
                  {mode === 'visitor' && <VisitorCapture onCapture={handleVisitorCapture} onCancel={() => setMode(null)} />}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="bar"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                margin: `0 ${spacing['3']}`,
                marginBottom: spacing['3'],
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.xl,
                boxShadow: shadows.panel,
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {captureButtons.map((btn) => (
                  <button
                    key={btn.mode}
                    onClick={() => setMode(btn.mode)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: spacing['1'],
                      padding: `${spacing['2']} ${spacing['1']}`,
                      minHeight: touchTarget.comfortable,
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: borderRadius.md,
                      cursor: 'pointer',
                      fontFamily: typography.fontFamily,
                      transition: transitions.quick,
                    }}
                  >
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{btn.emoji}</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                      {btn.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </>
  );
}
