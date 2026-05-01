// ─────────────────────────────────────────────────────────────────────────────
// IrisDailySummaryButton
// ─────────────────────────────────────────────────────────────────────────────
// Header button that calls the `ai-daily-summary` edge function for a given
// date. Opens a slide-in panel with: 2-3 sentence summary, bulleted
// highlights, bulleted concerns. Demo beat: "Iris reads the day's photos,
// crew hours, weather, and field notes, and writes the summary."
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Sparkles, X, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { colors, typography, spacing } from '../../styles/theme';

const IRIS_INDIGO = '#4F46E5';
const IRIS_INDIGO_BG = 'rgba(79, 70, 229, 0.04)';
const IRIS_INDIGO_BORDER = 'rgba(79, 70, 229, 0.20)';

interface SummaryResponse {
  summary: string;
  highlights: string[];
  concerns: string[];
}

interface Props {
  projectId: string | null | undefined;
  date: string;                  // YYYY-MM-DD
  buttonStyle?: React.CSSProperties;
}

export const IrisDailySummaryButton: React.FC<Props> = ({ projectId, date, buttonStyle }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const m = useMutation<SummaryResponse>({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('ai-daily-summary', {
        body: { project_id: projectId, date },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (res.error) throw res.error;
      return (res.data ?? {}) as SummaryResponse;
    },
  });

  const handleOpen = () => {
    setOpen(true);
    if (!m.data && !m.isPending) m.mutate();
  };

  const handleRetry = () => {
    m.reset();
    m.mutate();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!projectId || !user}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px',
          border: `1px solid ${IRIS_INDIGO_BORDER}`, borderRadius: 6,
          backgroundColor: IRIS_INDIGO_BG, color: IRIS_INDIGO,
          fontSize: 13, fontWeight: 600, fontFamily: typography.fontFamily,
          cursor: projectId && user ? 'pointer' : 'not-allowed',
          opacity: projectId && user ? 1 : 0.5,
          whiteSpace: 'nowrap',
          ...buttonStyle,
        }}
        title="Iris generates a 2-3 sentence narrative from today's photos, crew hours, weather, and field notes."
        aria-label="Iris auto-summarize today's daily log"
      >
        <Sparkles size={13} strokeWidth={2.25} aria-hidden />
        AI summary
      </button>

      {open && (
        <>
          {/* Scrim */}
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 15, 15, 0.40)', zIndex: 1040,
            }}
          />
          {/* Panel */}
          <aside
            role="dialog"
            aria-label="Iris daily summary"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 480, maxWidth: '94vw', zIndex: 1041,
              backgroundColor: '#FFFFFF',
              borderLeft: `1px solid ${colors.borderSubtle}`,
              display: 'flex', flexDirection: 'column',
              fontFamily: typography.fontFamily,
              boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.08)',
            }}
          >
            <header style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: `1px solid ${colors.borderSubtle}`,
              backgroundColor: '#FAFAF8',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} color={IRIS_INDIGO} strokeWidth={2.25} aria-hidden />
                <h2 style={{
                  margin: 0, fontSize: 13, fontWeight: 700, color: IRIS_INDIGO,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  Iris · daily summary
                </h2>
                <span style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                  {date}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: colors.textTertiary, padding: 6, borderRadius: 4,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </header>

            <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
              {m.isPending && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 12,
                  padding: '32px 8px', alignItems: 'center', justifyContent: 'center',
                  textAlign: 'center', color: colors.textSecondary,
                }}>
                  <Loader2 size={20} color={IRIS_INDIGO} className="iris-spin" aria-hidden />
                  <style>{`@keyframes iris-spin { to { transform: rotate(360deg); } } .iris-spin { animation: iris-spin 1s linear infinite; }`}</style>
                  <span style={{ fontSize: 13 }}>
                    Iris is reading photos, crew hours, weather, and field notes…
                  </span>
                  <span style={{ fontSize: 11, color: colors.textTertiary }}>
                    This typically takes 4–8 seconds.
                  </span>
                </div>
              )}

              {m.error && (
                <div role="alert" style={{
                  padding: 12,
                  backgroundColor: '#FCE7E7',
                  border: '1px solid rgba(201, 59, 59, 0.20)',
                  borderRadius: 6,
                  color: '#9A2929',
                  fontSize: 13,
                }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>Summary failed</strong>
                  <span style={{ fontSize: 12 }}>
                    {(m.error as Error).message ?? 'Unknown error.'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRetry}
                    style={{
                      marginTop: 10,
                      padding: '6px 12px', border: '1px solid #C93B3B', borderRadius: 6,
                      backgroundColor: 'transparent', color: '#C93B3B',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {m.data && (
                <>
                  {/* Summary paragraph */}
                  <section style={{ marginBottom: 20 }}>
                    <SectionLabel>Narrative</SectionLabel>
                    <p style={{
                      margin: 0, fontSize: 14, lineHeight: 1.6, color: colors.textPrimary,
                    }}>
                      {m.data.summary || 'No narrative available for this date.'}
                    </p>
                  </section>

                  {/* Highlights */}
                  {(m.data.highlights ?? []).length > 0 && (
                    <section style={{ marginBottom: 20 }}>
                      <SectionLabel icon={<CheckCircle size={11} color="#2D8A6E" aria-hidden />}>
                        Highlights
                      </SectionLabel>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {m.data.highlights.map((h, i) => (
                          <li key={`h-${i}`} style={{
                            paddingLeft: 12,
                            borderLeft: '2px solid rgba(45, 138, 110, 0.40)',
                            fontSize: 13, color: colors.textSecondary, lineHeight: 1.5,
                          }}>
                            {h}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Concerns */}
                  {(m.data.concerns ?? []).length > 0 && (
                    <section style={{ marginBottom: 20 }}>
                      <SectionLabel icon={<AlertTriangle size={11} color="#C4850C" aria-hidden />}>
                        Concerns
                      </SectionLabel>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {m.data.concerns.map((c, i) => (
                          <li key={`c-${i}`} style={{
                            paddingLeft: 12,
                            borderLeft: '2px solid rgba(196, 133, 12, 0.40)',
                            fontSize: 13, color: colors.textSecondary, lineHeight: 1.5,
                          }}>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Footer */}
                  <footer style={{
                    marginTop: 24, paddingTop: 12,
                    borderTop: `1px dashed ${colors.borderSubtle}`,
                    fontSize: 11, color: colors.textTertiary,
                  }}>
                    Generated by Anthropic Claude over today's daily-log entries, photos,
                    weather, and crew hours.&nbsp;
                    <button
                      type="button"
                      onClick={handleRetry}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        color: IRIS_INDIGO, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', textDecoration: 'underline',
                      }}
                    >
                      Re-generate
                    </button>
                  </footer>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({ children, icon }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, fontWeight: 700, color: '#5C5550',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    marginBottom: 8,
  }}>
    {icon}
    {children}
  </div>
);

export default IrisDailySummaryButton;
