import React, { useCallback, useRef, useState } from 'react';
import { Camera, Upload, Loader2, ShieldAlert, AlertTriangle, CheckCircle, Plus, X, Sparkles, FileText } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { Btn, Card } from '../Primitives';
import { useProjectId } from '../../hooks/useProjectId';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface Violation {
  category: string;
  description: string;
  osha_reference: string;
  severity: 'Critical' | 'Serious' | 'Other';
  corrective_action: string;
}

interface AnalysisResult {
  id?: string;
  safety_score: number;
  summary: string;
  scene_description?: string;
  violations: Violation[];
  analyzed_by?: string;
  analyzed_at?: string;
}

const SEVERITY: Record<Violation['severity'], { color: string; bg: string; icon: React.ElementType }> = {
  Critical: { color: colors.statusCritical, bg: colors.statusCriticalSubtle, icon: ShieldAlert },
  Serious: { color: colors.statusPending, bg: colors.statusPendingSubtle, icon: AlertTriangle },
  Other: { color: colors.statusInfo, bg: colors.statusInfoSubtle, icon: CheckCircle },
};

const BASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hypxrmcppjfbtlwuoafc.supabase.co';

// Circular score gauge
const ScoreGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 140 }) => {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const gaugeColor = score >= 80 ? colors.statusActive : score >= 60 ? colors.statusPending : colors.statusCritical;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceInset} strokeWidth={10} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} stroke={gaugeColor} strokeWidth={10} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 32, fontWeight: typography.fontWeight.bold, color: gaugeColor, lineHeight: 1 }}>
          {score}
        </div>
        <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: 2 }}>
          Safety Score
        </div>
      </div>
    </div>
  );
};

const ViolationCard: React.FC<{
  v: Violation;
  onCreateObservation: (v: Violation) => void;
}> = ({ v, onCreateObservation }) => {
  const cfg = SEVERITY[v.severity] || SEVERITY.Other;
  const Icon = cfg.icon;
  return (
    <div style={{
      display: 'flex', gap: spacing['3'],
      padding: spacing['3'],
      backgroundColor: cfg.bg,
      borderRadius: borderRadius.md,
      borderLeft: `3px solid ${cfg.color}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: borderRadius.base,
        backgroundColor: cfg.color, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color={colors.white} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'], flexWrap: 'wrap' }}>
          <span style={{
            fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
            color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {v.severity}
          </span>
          <span style={{
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}>
            {v.category}
          </span>
          <span style={{
            fontSize: typography.fontSize.xs, color: colors.textTertiary,
            fontFamily: 'monospace',
          }}>
            {v.osha_reference}
          </span>
        </div>
        <p style={{ margin: `${spacing['2']} 0 ${spacing['2']} 0`, fontSize: typography.fontSize.sm, color: colors.textPrimary, lineHeight: 1.5 }}>
          {v.description}
        </p>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: spacing['2'],
          padding: spacing['2'], backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.sm, marginBottom: spacing['2'],
        }}>
          <CheckCircle size={13} color={colors.statusActive} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, lineHeight: 1.5 }}>
            <strong style={{ color: colors.textPrimary }}>Corrective action:</strong> {v.corrective_action}
          </span>
        </div>
        <Btn size="sm" variant="secondary" onClick={() => onCreateObservation(v)}>
          <Plus size={12} />
          <span style={{ marginLeft: 4 }}>Create Observation</span>
        </Btn>
      </div>
    </div>
  );
};

export const SafetyPhotoAnalyzer: React.FC<{
  onClose?: () => void;
  onCreateObservation?: (v: Violation, photoUrl: string) => void;
}> = ({ onClose, onCreateObservation }) => {
  const projectId = useProjectId();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [sceneMismatch, setSceneMismatch] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = useCallback(async (file: File): Promise<string> => {
    if (!projectId) throw new Error('No active project');
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `safety-photos/${projectId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('attachments')
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    const { data: signed, error: signErr } = await supabase.storage
      .from('attachments')
      .createSignedUrl(path, 3600);
    if (signErr || !signed?.signedUrl) throw signErr || new Error('Signing failed');
    return signed.signedUrl;
  }, [projectId]);

  const analyze = useCallback(async (url: string) => {
    setAnalyzing(true);
    setResult(null);
    setSceneMismatch(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BASE_URL}/functions/v1/analyze-safety-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ project_id: projectId, photo_url: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Analysis failed');
      if (data.ok === false && data.reason === 'not_a_construction_site') {
        setSceneMismatch(data.scene_description || 'Image does not show a construction site');
        return;
      }
      setResult(data as AnalysisResult);
      toast.success(`Safety score: ${data.safety_score}/100`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [projectId]);

  const onFile = useCallback(async (f: File | undefined) => {
    if (!f) return;
    try {
      toast.info('Uploading photo…');
      const url = await uploadPhoto(f);
      setPhotoUrl(url);
      await analyze(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  }, [uploadPhoto, analyze]);

  const handleCreateObservation = useCallback((v: Violation) => {
    if (onCreateObservation && photoUrl) {
      onCreateObservation(v, photoUrl);
    } else {
      toast.success(`Observation drafted: ${v.description.slice(0, 50)}…`);
    }
  }, [onCreateObservation, photoUrl]);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'] }}>
        <div style={{
          width: 40, height: 40, borderRadius: borderRadius.md,
          backgroundColor: colors.primaryOrange, color: colors.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            AI Safety Scan
          </div>
          <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
            OSHA-trained vision model identifies violations and safety score
          </div>
        </div>
        {onClose && (
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
            <X size={18} />
          </button>
        )}
      </div>

      {!photoUrl && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: spacing['6'],
          backgroundColor: colors.surfaceInset,
          border: `2px dashed ${colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          gap: spacing['3'],
        }}>
          <Camera size={40} color={colors.textTertiary} />
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: 'center' }}>
            Upload a site photo or take one with your camera to scan for safety violations.
          </div>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <input
              ref={cameraInputRef}
              type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <input
              ref={fileInputRef}
              type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Btn variant="primary" onClick={() => cameraInputRef.current?.click()}>
              <Camera size={14} />
              <span style={{ marginLeft: 4 }}>Take Photo</span>
            </Btn>
            <Btn variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />
              <span style={{ marginLeft: 4 }}>Upload</span>
            </Btn>
          </div>
        </div>
      )}

      {photoUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden', backgroundColor: colors.surfaceInset }}>
            <img src={photoUrl} alt="Safety scan subject" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }} />
            {analyzing && (
              <div style={{
                position: 'absolute', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: spacing['3'],
                color: colors.white,
              }}>
                <Loader2 size={32} className="animate-spin" />
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>
                  Analyzing for OSHA violations…
                </div>
              </div>
            )}
          </div>

          {sceneMismatch && (
            <div style={{
              padding: spacing['3'],
              backgroundColor: colors.statusPendingSubtle,
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.statusPending}`,
            }}>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, marginBottom: 4 }}>
                Not a construction site
              </div>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                {sceneMismatch}
              </div>
            </div>
          )}

          {result && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: spacing['4'],
                padding: spacing['4'],
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.lg,
              }}>
                <ScoreGauge score={result.safety_score} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['2'] }}>
                    Assessment
                  </div>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.55 }}>
                    {result.summary}
                  </p>
                  {result.scene_description && (
                    <p style={{ margin: `${spacing['2']} 0 0 0`, fontSize: typography.fontSize.xs, color: colors.textTertiary, fontStyle: 'italic' }}>
                      {result.scene_description}
                    </p>
                  )}
                </div>
              </div>

              {result.violations.length > 0 ? (
                <div>
                  <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['3'], display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <FileText size={14} />
                    {result.violations.length} Violation{result.violations.length === 1 ? '' : 's'} Identified
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                    {result.violations.map((v, i) => (
                      <ViolationCard key={`${v.category}-${i}`} v={v} onCreateObservation={handleCreateObservation} />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: spacing['4'],
                  backgroundColor: colors.statusActiveSubtle,
                  borderRadius: borderRadius.md,
                  borderLeft: `3px solid ${colors.statusActive}`,
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                }}>
                  <CheckCircle size={20} color={colors.statusActive} />
                  <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                    No violations identified. Great work maintaining safety standards.
                  </div>
                </div>
              )}
            </>
          )}

          <Btn variant="secondary" onClick={() => { setPhotoUrl(null); setResult(null); setSceneMismatch(null); }}>
            Analyze another photo
          </Btn>
        </div>
      )}
    </Card>
  );
};

export default SafetyPhotoAnalyzer;
