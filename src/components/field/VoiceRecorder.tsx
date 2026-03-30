import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, CheckCircle, X, Sparkles } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface VoiceRecorderProps {
  onClose: () => void;
  onSave: (transcript: string) => void;
}

// Transcription comes from Web Speech API or Whisper edge function
const mockTranscription: Array<{ time: number; text: string }> = [];

const aiExtraction = {
  type: 'Punch List Item',
  title: 'Drywall crack, Floor 8, Unit 801',
  location: 'Floor 8, North Wall, Unit 801',
  priority: 'Medium',
  assignee: 'Finishing Crew F',
};

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onClose, onSave }) => {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [showExtraction, setShowExtraction] = useState(false);
  const [waveform, setWaveform] = useState<number[]>(Array(32).fill(4));
  const intervalRef = useRef<number | undefined>(undefined);
  const waveRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!recording) return;

    // Timer
    intervalRef.current = window.setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        // Simulated transcription
        const segment = mockTranscription.findLast((s) => s.time <= next);
        if (segment) setTranscript(segment.text);
        if (next >= 7.5) {
          setRecording(false);
          setTimeout(() => setShowExtraction(true), 500);
        }
        return next;
      });
    }, 100);

    // Waveform animation
    waveRef.current = window.setInterval(() => {
      setWaveform(Array(32).fill(0).map(() => 4 + Math.random() * 28));
    }, 80);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(waveRef.current);
    };
  }, [recording]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = () => {
    setRecording(false);
    clearInterval(intervalRef.current);
    clearInterval(waveRef.current);
    setWaveform(Array(32).fill(4));
    setTimeout(() => setShowExtraction(true), 500);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1060, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, backgroundColor: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
        <X size={24} />
      </button>

      {/* Waveform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 64, marginBottom: spacing['6'] }}>
        {waveform.map((h, i) => (
          <div
            key={i}
            style={{
              width: 3, height: `${h}px`, borderRadius: 2,
              backgroundColor: recording ? colors.statusCritical : colors.textTertiary,
              transition: recording ? 'none' : `height ${transitions.quick}`,
              opacity: recording ? 0.8 : 0.3,
            }}
          />
        ))}
      </div>

      {/* Timer */}
      <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: 'white', margin: 0, marginBottom: spacing['2'], fontFeatureSettings: '"tnum"' }}>
        {formatTime(elapsed)}
      </p>
      <p style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.5)', margin: 0, marginBottom: spacing['8'] }}>
        {recording ? 'Listening...' : elapsed > 0 ? 'Recording complete' : 'Tap to start recording'}
      </p>

      {/* Record / Stop button */}
      {!showExtraction && (
        <button
          onClick={() => recording ? handleStop() : setRecording(true)}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            backgroundColor: recording ? 'rgba(255,255,255,0.15)' : colors.statusCritical,
            border: `3px solid ${recording ? colors.statusCritical : 'transparent'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: `all ${transitions.quick}`,
          }}
        >
          {recording ? <Square size={24} color="white" fill="white" /> : <Mic size={28} color="white" />}
        </button>
      )}

      {/* Transcription */}
      {transcript && (
        <div style={{ marginTop: spacing['8'], maxWidth: '480px', width: '100%', padding: `0 ${spacing['4']}` }}>
          <p style={{ fontSize: typography.fontSize.caption, color: 'rgba(255,255,255,0.4)', margin: 0, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
            Transcription
          </p>
          <p style={{ fontSize: typography.fontSize.body, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: typography.lineHeight.relaxed }}>
            {transcript}
            {recording && <span style={{ opacity: 0.5, animation: 'pulse 1s infinite' }}>|</span>}
          </p>
        </div>
      )}

      {/* AI extraction card */}
      {showExtraction && (
        <div style={{ marginTop: spacing['6'], maxWidth: '480px', width: '100%', padding: `0 ${spacing['4']}`, animation: 'slideInUp 300ms ease-out' }}>
          <div style={{ backgroundColor: 'rgba(124, 93, 199, 0.12)', borderRadius: borderRadius.lg, padding: spacing['5'], border: `1px solid rgba(124, 93, 199, 0.25)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
              <Sparkles size={14} color={colors.statusReview} />
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>AI Detected Action Item</span>
            </div>
            <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: 'white', margin: 0, marginBottom: spacing['3'] }}>
              Create {aiExtraction.type}: {aiExtraction.title}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'], marginBottom: spacing['4'] }}>
              {Object.entries(aiExtraction).filter(([k]) => k !== 'type' && k !== 'title').map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{key}</span>
                  <span style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.85)', fontWeight: typography.fontWeight.medium }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: spacing['2'] }}>
              <button
                onClick={() => onSave(transcript)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: `${spacing['3']}`, backgroundColor: colors.statusReview, color: 'white', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer' }}
              >
                <CheckCircle size={16} /> Confirm
              </button>
              <button
                onClick={onClose}
                style={{ padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, cursor: 'pointer' }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
