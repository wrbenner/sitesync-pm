import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw, Clipboard } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { summarizeDailyLog } from '../../api/endpoints/aiService';
import { Skeleton } from '../Primitives';

interface AutoNarrativeProps {
  logData: Record<string, unknown>;
}

export const AutoNarrative: React.FC<AutoNarrativeProps> = ({ logData }) => {
  const [summary, setSummary] = useState<string | null>(
    (logData.ai_summary as string | null) ?? null
  );
  const [loading, setLoading] = useState<boolean>(!(logData.ai_summary as string | null));
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await summarizeDailyLog(logData);
      if (result) {
        setSummary(result);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!(logData.ai_summary as string | null)) {
      fetchSummary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleRegenerate = () => {
    setSummary(null);
    fetchSummary();
  };

  return (
    <div style={{ backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, padding: spacing['4'], border: `1px solid ${colors.statusReview}15` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Bot size={14} color={colors.primaryOrange} />
          <span style={{ fontSize: '12px', color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>AI Summary</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          {summary && !loading && (
            <button
              onClick={handleCopy}
              style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: 'transparent', border: 'none', color: copied ? colors.statusActive : colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, cursor: 'pointer', borderRadius: borderRadius.sm, transition: `color ${transitions.instant}` }}
            >
              <Clipboard size={12} />{copied ? 'Copied' : 'Copy'}
            </button>
          )}
          <button
            onClick={handleRegenerate}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: 'transparent', border: 'none', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, cursor: loading ? 'default' : 'pointer', borderRadius: borderRadius.sm, transition: `color ${transitions.instant}` }}
          >
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Regenerate
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          <Skeleton width="100%" height="14px" />
          <Skeleton width="80%" height="14px" />
          <Skeleton width="60%" height="14px" />
        </div>
      )}
      {!loading && error && (
        <p style={{ fontSize: '14px', color: colors.textTertiary, margin: 0 }}>AI summary unavailable.</p>
      )}
      {!loading && !error && summary && (
        <p style={{ fontSize: '14px', color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{summary}</p>
      )}
    </div>
  );
};
