import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Check, Upload, Users, LayoutGrid } from 'lucide-react';
import { Btn, ProgressBar } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';

const TOTAL_STEPS = 6;

// Pre-compute confetti positions to avoid Math.random() during render
const CONFETTI_POSITIONS = Array.from({ length: 30 }).map(() => ({
  left: 10 + Math.random() * 80,
  top: Math.random() * 60,
  rotation: Math.random() * 360,
}));

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}

const Step1Welcome: React.FC<StepProps> = ({ onNext }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s ease-out' }}>
      <div style={{ width: 80, height: 80, background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, #FF9C42 100%)`, borderRadius: borderRadius.xl, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing['6'], fontSize: '36px', fontWeight: 700, color: 'white' }}>S</div>
      <h1 style={{ fontSize: '36px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'], letterSpacing: typography.letterSpacing.tight }}>Welcome to SiteSync AI</h1>
      <p style={{ fontSize: typography.fontSize.title, color: colors.textSecondary, margin: 0, marginBottom: spacing['8'], maxWidth: '480px', lineHeight: typography.lineHeight.relaxed }}>
        The construction operating system that thinks ahead. Let us set up your project in under 2 minutes.
      </p>
      <Btn size="lg" onClick={onNext} icon={<ArrowRight size={16} />} iconPosition="right">Get Started</Btn>
    </div>
  );
};

const Step2Project: React.FC<StepProps> = ({ onNext, onBack, onSkip }) => (
  <div style={{ maxWidth: '500px', margin: '0 auto' }}>
    <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Project Details</h2>
    <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginBottom: spacing['6'] }}>Tell us about your project.</p>
    {[
      { label: 'Project Name', placeholder: 'Meridian Tower', value: 'Meridian Tower' },
      { label: 'Type', placeholder: 'Mixed Use Building', value: 'Mixed Use Building' },
      { label: 'Total Value', placeholder: '$47,500,000', value: '$47,500,000' },
      { label: 'Location', placeholder: 'Dallas, TX', value: 'Dallas, TX' },
      { label: 'Start Date', placeholder: '2023-06-15', value: '2023-06-15' },
      { label: 'End Date', placeholder: '2025-12-31', value: '2025-12-31' },
    ].map((field) => (
      <div key={field.label} style={{ marginBottom: spacing['4'] }}>
        <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>{field.label}</label>
        <input defaultValue={field.value} placeholder={field.placeholder} style={{ width: '100%', padding: `${spacing['3']} ${spacing['4']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, color: colors.textPrimary, outline: 'none', backgroundColor: colors.surfaceRaised }} />
      </div>
    ))}
    <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['5'] }}>
      <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Back</Btn>
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onSkip}>Skip</Btn>
      <Btn onClick={onNext} icon={<ArrowRight size={14} />} iconPosition="right">Next</Btn>
    </div>
  </div>
);

const Step3Team: React.FC<StepProps> = ({ onNext, onBack, onSkip }) => (
  <div style={{ maxWidth: '500px', margin: '0 auto' }}>
    <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Invite Your Team</h2>
    <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginBottom: spacing['6'] }}>Add team members by email. You can always add more later.</p>
    <textarea defaultValue={'mpatterson@turnerconstruction.com\njlee@morrisarchitects.com\ndkumar@structuralsystems.com'} placeholder="Enter email addresses, one per line" style={{ width: '100%', height: '120px', padding: spacing['4'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, color: colors.textPrimary, resize: 'vertical', outline: 'none', backgroundColor: colors.surfaceRaised }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['3'], padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
      <Users size={16} color={colors.textTertiary} />
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>3 team members will be invited</span>
    </div>
    <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['5'] }}>
      <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Back</Btn>
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onSkip}>Skip</Btn>
      <Btn onClick={onNext} icon={<ArrowRight size={14} />} iconPosition="right">Next</Btn>
    </div>
  </div>
);

const Step4Import: React.FC<StepProps> = ({ onNext, onBack, onSkip }) => {
  const [importing, setImporting] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Import Data</h2>
      <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginBottom: spacing['6'] }}>Bring your existing project data into SiteSync.</p>
      {['Procore', 'Primavera P6', 'Microsoft Project', 'Excel Spreadsheet'].map((source) => (
        <button key={source} onClick={() => { setImporting(source); setTimeout(() => { setImporting(null); }, 1500); }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['4']}`, backgroundColor: importing === source ? colors.orangeSubtle : colors.surfaceRaised, border: `1px solid ${importing === source ? colors.primaryOrange : colors.borderDefault}`, borderRadius: borderRadius.md, cursor: 'pointer', marginBottom: spacing['2'], fontFamily: typography.fontFamily, fontSize: typography.fontSize.body, color: colors.textPrimary, transition: `all ${transitions.instant}` }}>
          <Upload size={16} color={importing === source ? colors.primaryOrange : colors.textTertiary} />
          <span style={{ flex: 1, textAlign: 'left' }}>{source}</span>
          {importing === source && <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange }}>Importing...</span>}
        </button>
      ))}
      <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['5'] }}>
        <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Back</Btn>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onSkip}>Skip</Btn>
        <Btn onClick={onNext} icon={<ArrowRight size={14} />} iconPosition="right">Next</Btn>
      </div>
    </div>
  );
};

const Step5Widgets: React.FC<StepProps> = ({ onNext, onBack }) => {
  const [selected, setSelected] = useState(new Set(['weather-impact', 'ai-insights', 'cash-flow', 'live-site']));
  const widgets = [
    { id: 'weather-impact', icon: '🌤️', label: 'Weather Impact' },
    { id: 'live-site', icon: '📍', label: 'Live Site' },
    { id: 'ai-insights', icon: '✨', label: 'AI Insights' },
    { id: 'cash-flow', icon: '💰', label: 'Cash Flow' },
    { id: 'risk-heatmap', icon: '🔥', label: 'Risk Heatmap' },
    { id: 'productivity-pulse', icon: '📊', label: 'Productivity' },
    { id: 'milestone-timeline', icon: '🎯', label: 'Milestones' },
    { id: 'photo-feed', icon: '📸', label: 'Photo Feed' },
  ];

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Customize Dashboard</h2>
      <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginBottom: spacing['6'] }}>Pick the widgets for your command center.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing['2'] }}>
        {widgets.map((w) => {
          const isSelected = selected.has(w.id);
          return (
            <button key={w.id} onClick={() => { const next = new Set(selected); if (next.has(w.id)) next.delete(w.id); else next.add(w.id); setSelected(next); }}
              style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: spacing['4'], backgroundColor: isSelected ? colors.orangeSubtle : colors.surfaceRaised, border: `1px solid ${isSelected ? colors.primaryOrange : colors.borderDefault}`, borderRadius: borderRadius.md, cursor: 'pointer', fontFamily: typography.fontFamily, transition: `all ${transitions.instant}` }}>
              <span style={{ fontSize: '20px' }}>{w.icon}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.normal, color: isSelected ? colors.primaryOrange : colors.textPrimary }}>{w.label}</span>
              {isSelected && <Check size={14} color={colors.primaryOrange} style={{ marginLeft: 'auto' }} />}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['5'] }}>
        <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Back</Btn>
        <div style={{ flex: 1 }} />
        <Btn onClick={onNext} icon={<ArrowRight size={14} />} iconPosition="right">Finish</Btn>
      </div>
    </div>
  );
};

const Step6Complete: React.FC<StepProps> = ({ onNext }) => {
  const [confetti, setConfetti] = useState(false);
  useEffect(() => { setTimeout(() => setConfetti(true), 300); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', position: 'relative' }}>
      {/* Confetti simulation */}
      {confetti && CONFETTI_POSITIONS.map((pos, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${pos.left}%`,
          top: `${pos.top}%`,
          width: 8, height: 8,
          backgroundColor: [colors.primaryOrange, colors.statusActive, colors.statusInfo, colors.statusReview, colors.statusPending][i % 5],
          borderRadius: i % 2 === 0 ? '50%' : '2px',
          transform: `rotate(${pos.rotation}deg)`,
          opacity: 0.7,
          animation: `fadeIn 0.3s ease-out ${i * 0.05}s both`,
        }} />
      ))}

      <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: `${colors.statusActive}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing['5'], zIndex: 1 }}>
        <Check size={40} color={colors.statusActive} />
      </div>
      <h1 style={{ fontSize: '32px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'], zIndex: 1 }}>Your Project is Ready!</h1>
      <p style={{ fontSize: typography.fontSize.title, color: colors.textSecondary, margin: 0, marginBottom: spacing['8'], maxWidth: '400px', lineHeight: typography.lineHeight.relaxed, zIndex: 1 }}>
        Meridian Tower has been set up with AI powered insights. Your team will be notified shortly.
      </p>
      <Btn size="lg" onClick={onNext} icon={<LayoutGrid size={16} />}>Go to Dashboard</Btn>
    </div>
  );
};

export const Onboarding: React.FC = () => {
  const [step, setStep] = useState(1);
  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.surfacePage, display: 'flex', flexDirection: 'column' }}>
      {/* Progress bar */}
      {step < TOTAL_STEPS && (
        <div style={{ padding: `${spacing['4']} ${spacing['6']}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>Step {step} of {TOTAL_STEPS - 1}</span>
            <button onClick={goNext} style={{ backgroundColor: 'transparent', border: 'none', color: colors.textTertiary, cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>Skip</button>
          </div>
          <ProgressBar value={(step / (TOTAL_STEPS - 1)) * 100} height={3} color={colors.primaryOrange} />
        </div>
      )}

      {/* Steps */}
      <div style={{ flex: 1, padding: `${spacing['8']} ${spacing['6']}` }}>
        {step === 1 && <Step1Welcome onNext={goNext} />}
        {step === 2 && <Step2Project onNext={goNext} onBack={goBack} onSkip={goNext} />}
        {step === 3 && <Step3Team onNext={goNext} onBack={goBack} onSkip={goNext} />}
        {step === 4 && <Step4Import onNext={goNext} onBack={goBack} onSkip={goNext} />}
        {step === 5 && <Step5Widgets onNext={goNext} onBack={goBack} />}
        {step === 6 && <Step6Complete onNext={() => window.location.hash = '#/dashboard'} />}
      </div>
    </div>
  );
};
