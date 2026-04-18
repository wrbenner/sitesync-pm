import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2, Sparkles } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { useProjectId } from '../../hooks/useProjectId';
import { toast } from 'sonner';

type NoteKind = 'daily_log' | 'safety' | 'punch_list' | 'meeting' | 'general';

interface Props {
  kind?: NoteKind;
  onTranscript?: (transcript: string) => void;
  onStructured?: (structured: unknown, transcript: string) => void;
  compact?: boolean;
  label?: string;
}

type Status = 'idle' | 'recording' | 'processing' | 'done';

const BASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://hypxrmcppjfbtlwuoafc.supabase.co';

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Live waveform visualization
const Waveform: React.FC<{ analyser: AnalyserNode | null }> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const bars = 32;
      const step = Math.floor(dataArray.length / bars);
      const barWidth = (w / bars) * 0.7;
      const gap = (w / bars) * 0.3;
      for (let i = 0; i < bars; i++) {
        const v = dataArray[i * step] / 255;
        const barHeight = Math.max(2, v * h);
        ctx.fillStyle = colors.primaryOrange;
        const x = i * (barWidth + gap);
        ctx.fillRect(x, (h - barHeight) / 2, barWidth, barHeight);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser]);
  return <canvas ref={canvasRef} width={200} height={32} style={{ display: 'block' }} />;
};

export const VoiceRecorder: React.FC<Props> = ({ kind = 'general', onTranscript, onStructured, compact, label }) => {
  const projectId = useProjectId();
  const [status, setStatus] = useState<Status>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startTsRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setAnalyser(null);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startRecording = useCallback(async () => {
    if (status !== 'idle' && status !== 'done') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const an = audioCtx.createAnalyser();
      an.fftSize = 128;
      source.connect(an);
      setAnalyser(an);

      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(250);
      startTsRef.current = Date.now();
      setElapsed(0);
      intervalRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startTsRef.current);
      }, 250);
      setStatus('recording');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not access microphone');
      cleanup();
    }
  }, [status, cleanup]);

  const stopRecording = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || status !== 'recording') return;
    setStatus('processing');

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
    });
    cleanup();

    try {
      if (!projectId) throw new Error('No active project');
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 200) throw new Error('Recording too short');

      // Upload to Storage
      const path = `voice-notes/${projectId}/${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage
        .from('attachments')
        .upload(path, blob, { contentType: 'audio/webm', upsert: false });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from('attachments')
        .createSignedUrl(path, 300);
      if (signErr || !signed?.signedUrl) throw signErr || new Error('Could not sign URL');

      const { data: { session } } = await supabase.auth.getSession();
      const auth = `Bearer ${session?.access_token || ''}`;

      // Transcribe
      const tRes = await fetch(`${BASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ project_id: projectId, audio_url: signed.signedUrl }),
      });
      const tData = await tRes.json();
      if (!tRes.ok) throw new Error(tData.error?.message || 'Transcription failed');
      const transcript: string = tData.transcript || '';
      if (onTranscript) onTranscript(transcript);

      // Structure (optional consumer)
      if (onStructured) {
        const sRes = await fetch(`${BASE_URL}/functions/v1/structure-field-note`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ project_id: projectId, transcript, kind }),
        });
        const sData = await sRes.json();
        if (!sRes.ok) throw new Error(sData.error?.message || 'Structuring failed');
        onStructured(sData.structured, transcript);
      }

      setStatus('done');
      toast.success('Voice note captured');
    } catch (e) {
      setStatus('idle');
      toast.error(e instanceof Error ? e.message : 'Voice capture failed');
    }
  }, [status, cleanup, projectId, kind, onTranscript, onStructured]);

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';

  if (compact) {
    return (
      <button
        type="button"
        aria-label={label || 'Record voice note'}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        style={{
          width: 56, height: 56, minWidth: 56, minHeight: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: isProcessing ? 'wait' : 'pointer',
          backgroundColor: isRecording ? colors.statusCritical : colors.primaryOrange,
          color: colors.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: shadows.md,
          transition: transitions.base,
        }}
      >
        {isProcessing ? <Loader2 size={22} className="animate-spin" /> : isRecording ? <Square size={22} /> : <Mic size={22} />}
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        padding: spacing['3'],
        backgroundColor: colors.surfaceInset,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg,
      }}
    >
      <button
        type="button"
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        style={{
          width: 56, height: 56, minWidth: 56, minHeight: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: isProcessing ? 'wait' : 'pointer',
          backgroundColor: isRecording ? colors.statusCritical : colors.primaryOrange,
          color: colors.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: shadows.sm,
          transition: transitions.base,
        }}
      >
        {isProcessing ? <Loader2 size={22} className="animate-spin" /> : isRecording ? <Square size={22} /> : <Mic size={22} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          {label || 'Voice note'}
        </div>
        <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {isRecording && (
            <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusCritical, animation: 'pulse 1.2s ease-in-out infinite' }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDuration(elapsed)}</span>
              <Waveform analyser={analyser} />
            </>
          )}
          {isProcessing && <><Sparkles size={12} /> Transcribing…</>}
          {status === 'idle' && 'Tap the mic to begin'}
          {status === 'done' && 'Recorded ✓  Tap to record again'}
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorder;
