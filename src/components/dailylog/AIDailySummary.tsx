import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Mic, Copy, CheckSquare, AlertTriangle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../../styles/theme';
import { supabase } from '../../lib/supabase';

interface AIDailySummaryProps {
  projectId: string;
  logDate: string;
  workSummary: string;
  crewCount: number;
  weatherDescription: string;
  safetyIncidents: number;
  onSummaryGenerated: (summary: string) => void;
}

type UIState = 'idle' | 'loading' | 'success' | 'error';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition ?? null)
    : null;

export const AIDailySummary: React.FC<AIDailySummaryProps> = ({
  projectId,
  logDate,
  workSummary,
  crewCount,


  onSummaryGenerated,
}) => {
  const [uiState, setUiState] = useState<UIState>('idle');
  const [summary, setSummary] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleGenerate = async () => {
    setUiState('loading');
    setSummary('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-daily-summary', {
        body: {
          projectId,
          logDate,
          field_notes: workSummary,
          crew_count: crewCount,
          temperature_high: null,
          temperature_low: null,
        },
      });

      if (error) {
        // Handle 404 (function not deployed) and other errors the same way
        setUiState('error');
        return;
      }

      const text: string =
        typeof data === 'string'
          ? data
          : (data as { summary?: string })?.summary ?? '';

      if (!text) {
        setUiState('error');
        return;
      }

      setSummary(text);
      setUiState('success');
    } catch {
      setUiState('error');
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard can fail in iframes, in private browsing, or without
      // page focus. The previous silent catch left the user thinking the
      // copy worked. Surface the failure as a transient state the UI can
      // render as a "select-to-copy" hint.
      setCopied(false);
    });
  };

  const handleInsert = () => {
    onSummaryGenerated(summary);
  };

  const handleRetry = () => {
    setUiState('idle');
    setSummary('');
  };

  const handleMicClick = () => {
    if (!SpeechRecognitionAPI) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        onSummaryGenerated(transcript);
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div
      style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        padding: spacing['5'],
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadows.card,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <Sparkles size={16} color={colors.primaryOrange} />
        <span
          style={{
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}
        >
          AI Daily Summary
        </span>
      </div>

      {/* Generate button (idle state) */}
      {uiState === 'idle' && (
        <button
          onClick={handleGenerate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            padding: `${spacing['2']} ${spacing['4']}`,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
            transition: `opacity ${transitions.instant}`,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Sparkles size={14} />
          Generate AI Summary
        </button>
      )}

      {/* Loading state — spinner replacing button */}
      {uiState === 'loading' && (
        <button
          disabled
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            padding: `${spacing['2']} ${spacing['4']}`,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily,
            cursor: 'default',
            opacity: 0.8,
            minWidth: '160px',
          }}
        >
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid rgba(255,255,255,0.4)',
              borderTopColor: colors.white,
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.75s linear infinite',
              flexShrink: 0,
            }}
          />
          Generating...
        </button>
      )}

      {/* Success state — summary block */}
      {uiState === 'success' && summary && (
        <div>
          <div
            style={{
              backgroundColor: `rgba(244, 120, 32, 0.05)`,
              borderRadius: borderRadius.xl,
              padding: spacing['4'],
              marginBottom: spacing['3'],
              border: `1px solid rgba(244, 120, 32, 0.12)`,
            }}
          >
            <p
              style={{
                fontSize: typography.fontSize.body,
                color: colors.textPrimary,
                lineHeight: typography.lineHeight.relaxed,
                margin: 0,
              }}
            >
              {summary}
            </p>
          </div>

          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1.5']} ${spacing['3']}`,
                backgroundColor: 'transparent',
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
                color: copied ? colors.statusActive : colors.textSecondary,
                cursor: 'pointer',
                transition: `color ${transitions.instant}`,
              }}
            >
              <Copy size={13} />
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={handleInsert}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1.5']} ${spacing['3']}`,
                backgroundColor: colors.primaryOrange,
                border: 'none',
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
                color: colors.white,
                cursor: 'pointer',
                transition: `opacity ${transitions.instant}`,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <CheckSquare size={13} />
              Insert into Log
            </button>

            <button
              onClick={handleRetry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1.5']} ${spacing['3']}`,
                backgroundColor: 'transparent',
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
                color: colors.textTertiary,
                cursor: 'pointer',
              }}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      {/* Error state — toast style */}
      {uiState === 'error' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.statusCriticalSubtle,
            borderRadius: borderRadius.md,
            padding: `${spacing['2']} ${spacing['3']}`,
            border: `1px solid ${colors.statusCritical}22`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <AlertTriangle size={14} color={colors.statusCritical} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
              AI summary unavailable. Try again later.
            </span>
          </div>
          <button
            onClick={handleRetry}
            style={{
              padding: `${spacing['1']} ${spacing['2.5']}`,
              backgroundColor: 'transparent',
              border: `1px solid ${colors.statusCritical}44`,
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              color: colors.statusCritical,
              cursor: 'pointer',
              fontWeight: typography.fontWeight.medium,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Voice to text section */}
      {SpeechRecognitionAPI !== null && (
        <div
          style={{
            marginTop: spacing['4'],
            paddingTop: spacing['4'],
            borderTop: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
          }}
        >
          <button
            onClick={handleMicClick}
            title={isRecording ? 'Stop recording' : 'Dictate field notes'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `1px solid ${isRecording ? colors.statusCritical : colors.borderDefault}`,
              backgroundColor: isRecording ? colors.statusCriticalSubtle : 'transparent',
              cursor: 'pointer',
              transition: `background-color ${transitions.quick}, border-color ${transitions.quick}`,
              flexShrink: 0,
            }}
          >
            <Mic size={16} color={isRecording ? colors.statusCritical : colors.textSecondary} />
          </button>

          {isRecording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <style>{`@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: colors.statusCritical,
                  display: 'inline-block',
                  animation: 'pulse-dot 1s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                Recording... speak your notes
              </span>
            </div>
          ) : (
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              Dictate field notes directly
            </span>
          )}
        </div>
      )}
    </div>
  );
};
