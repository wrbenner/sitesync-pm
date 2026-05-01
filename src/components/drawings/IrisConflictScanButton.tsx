// ─────────────────────────────────────────────────────────────────────────────
// IrisConflictScanButton
// ─────────────────────────────────────────────────────────────────────────────
// Header button on /drawings that calls the `ai-conflict-detection` edge
// function (Anthropic Claude over schedule + RFIs + submittals + drawings)
// to surface coordination conflicts. Slide-in panel with severity-grouped
// findings and per-conflict mitigation.
//
// Demo beat: "We don't just store drawings. We read them against the
// schedule, the RFIs, and the submittals — and surface the conflicts
// before they become $50K mistakes in the field."
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Sparkles, X, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { colors, typography } from '../../styles/theme';

const IRIS_INDIGO = '#4F46E5';
const IRIS_INDIGO_BG = 'rgba(79, 70, 229, 0.04)';
const IRIS_INDIGO_BORDER = 'rgba(79, 70, 229, 0.20)';

interface ConflictItem {
  type: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  affected_items?: string[];
  recommendation?: string;
}

interface ConflictResponse {
  conflicts: ConflictItem[];
}

const SEVERITY_TONE: Record<ConflictItem['severity'], { bg: string; fg: string; label: string }> = {
  critical: { bg: 'rgba(201, 59, 59, 0.10)',  fg: '#C93B3B', label: 'CRITICAL' },
  major:    { bg: 'rgba(196, 133, 12, 0.10)', fg: '#C4850C', label: 'MAJOR'    },
  minor:    { bg: 'rgba(92, 85, 80, 0.08)',   fg: '#5C5550', label: 'MINOR'    },
};

interface Props {
  projectId: string | null | undefined;
}

export const IrisConflictScanButton: React.FC<Props> = ({ projectId }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const m = useMutation<ConflictResponse>({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('ai-conflict-detection', {
        body: { project_id: projectId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (res.error) throw res.error;
      return (res.data ?? { conflicts: [] }) as ConflictResponse;
    },
  });

  const handleOpen = () => {
    setOpen(true);
    if (!m.data && !m.isPending) m.mutate();
  };

  const sorted = (m.data?.conflicts ?? []).slice().sort((a, b) => {
    const order = { critical: 0, major: 1, minor: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

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
        }}
        title="Iris reads drawings against schedule + RFIs + submittals to surface coordination conflicts."
        aria-label="Run Iris conflict scan"
      >
        <Sparkles size={13} strokeWidth={2.25} aria-hidden />
        Conflict scan
      </button>

      {open && (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 15, 15, 0.40)', zIndex: 1040 }}
          />
          <aside
            role="dialog"
            aria-label="Iris conflict scan results"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 540, maxWidth: '94vw', zIndex: 1041,
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
                  Iris · conflict scan
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => m.mutate()}
                  disabled={m.isPending}
                  aria-label="Re-scan"
                  title="Re-scan"
                  style={{
                    border: 'none', background: 'transparent', cursor: m.isPending ? 'default' : 'pointer',
                    color: colors.textTertiary, padding: 6, borderRadius: 4,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    opacity: m.isPending ? 0.4 : 1,
                  }}
                >
                  <RefreshCw size={13} aria-hidden style={{ animation: m.isPending ? 'iris-spin 1s linear infinite' : undefined }} />
                </button>
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
              </div>
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
                    Iris is reading drawings against schedule, RFIs, and submittals…
                  </span>
                  <span style={{ fontSize: 11, color: colors.textTertiary }}>
                    Typically takes 6–12 seconds.
                  </span>
                </div>
              )}

              {m.error && (
                <div role="alert" style={{
                  padding: 12,
                  backgroundColor: '#FCE7E7',
                  border: '1px solid rgba(201, 59, 59, 0.20)',
                  borderRadius: 6, color: '#9A2929', fontSize: 13,
                }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>Conflict scan failed</strong>
                  <span style={{ fontSize: 12 }}>
                    {(m.error as Error).message ?? 'Unknown error.'}
                  </span>
                </div>
              )}

              {m.data && sorted.length === 0 && !m.isPending && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '40px 16px', textAlign: 'center', gap: 12,
                  color: '#2D8A6E',
                }}>
                  <Sparkles size={28} aria-hidden />
                  <strong style={{ fontSize: 14, fontWeight: 600 }}>No conflicts detected</strong>
                  <span style={{ fontSize: 12, color: colors.textTertiary }}>
                    Iris read the drawing set against schedule, RFIs, and submittals and found nothing requiring attention.
                  </span>
                </div>
              )}

              {sorted.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sorted.map((c, i) => {
                    const tone = SEVERITY_TONE[c.severity];
                    return (
                      <li
                        key={`${c.type}-${i}`}
                        style={{
                          padding: 14,
                          backgroundColor: '#FAFAF8',
                          border: `1px solid ${colors.borderSubtle}`,
                          borderLeft: `3px solid ${tone.fg}`,
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '2px 7px', borderRadius: 4,
                            backgroundColor: tone.bg, color: tone.fg,
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                          }}>
                            <AlertTriangle size={9} style={{ marginRight: 4 }} aria-hidden />
                            {tone.label}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {c.type}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 6px', fontSize: 13, lineHeight: 1.5, color: colors.textPrimary }}>
                          {c.description}
                        </p>
                        {(c.affected_items ?? []).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, marginBottom: 6 }}>
                            {c.affected_items!.map((a, j) => (
                              <span
                                key={`${a}-${j}`}
                                style={{
                                  padding: '2px 8px', borderRadius: 999,
                                  backgroundColor: '#F1ECE2', color: colors.textSecondary,
                                  fontSize: 11, fontFamily: typography.fontFamilyMono,
                                }}
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                        {c.recommendation && (
                          <p style={{
                            margin: 0, marginTop: 8,
                            padding: '8px 10px',
                            backgroundColor: 'rgba(79, 70, 229, 0.06)',
                            borderRadius: 4,
                            fontSize: 12, lineHeight: 1.45, color: colors.textPrimary,
                          }}>
                            <strong style={{ color: IRIS_INDIGO, fontWeight: 600 }}>Recommendation: </strong>
                            {c.recommendation}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {m.data && (
                <footer style={{
                  marginTop: 24, paddingTop: 12,
                  borderTop: `1px dashed ${colors.borderSubtle}`,
                  fontSize: 11, color: colors.textTertiary,
                }}>
                  Generated by Anthropic Claude over project schedule, open RFIs, submittals, and drawings.
                </footer>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
};

export default IrisConflictScanButton;
