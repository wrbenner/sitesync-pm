import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface AutoNarrativeProps {
  workers: number;
  hours: number;
  incidents: number;
  weather: string;
  summary: string;
}

export const AutoNarrative: React.FC<AutoNarrativeProps> = ({ workers, hours, incidents, weather, summary }) => {
  const [generating, setGenerating] = useState(true);
  const [displayedText, setDisplayedText] = useState('');

  const fullText = `14 crews active across floors 7 through 10. Concrete pour on Level 9 completed ahead of schedule with ${workers} workers on site. Electrical rough in progressing on floors 3 through 5 at 60% completion. ${incidents === 0 ? 'Zero safety incidents reported.' : `${incidents} safety incident(s) reported and documented.`} Weather clear at ${weather.split(' ')[0] || '78F'} with no precipitation expected through end of week. MEP coordination meeting held at 2 PM, 3 action items assigned. ${summary} Total of ${hours.toLocaleString()} man hours logged. Overall productivity rated at 87% against baseline.`;

  useEffect(() => {
    if (!generating) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 2;
      if (i >= fullText.length) {
        setDisplayedText(fullText);
        setGenerating(false);
        clearInterval(interval);
      } else {
        setDisplayedText(fullText.slice(0, i));
      }
    }, 15);
    return () => clearInterval(interval);
  }, [generating, fullText]);

  const handleRegenerate = () => {
    setDisplayedText('Regenerating...');
    setTimeout(() => {
      setDisplayedText('');
      setGenerating(true);
    }, 500);
  };

  return (
    <div style={{ backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, padding: spacing['4'], border: `1px solid ${colors.statusReview}15` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Sparkles size={14} color={colors.statusReview} />
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>AI Generated Summary</span>
        </div>
        <button
          onClick={handleRegenerate}
          style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: 'transparent', border: 'none', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, cursor: 'pointer', borderRadius: borderRadius.sm, transition: `color ${transitions.instant}` }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.statusReview; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
        >
          <RefreshCw size={12} /> Regenerate
        </button>
      </div>
      <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>
        {displayedText}
        {generating && <span style={{ color: colors.statusReview, animation: 'pulse 1s infinite' }}>|</span>}
      </p>
    </div>
  );
};
