import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Check, Upload, Users, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Btn, ProgressBar } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useOrganization } from '../hooks/useOrganization';
import {
  useCreateOnboardingProject,
  useInviteOnboardingTeam,
  useMarkOnboardingComplete,
} from '../hooks/mutations/onboarding';
import { supabase } from '../lib/supabase';

const TOTAL_STEPS = 6;

type ProjectForm = {
  name: string;
  type: string;
  totalValue: string;
  location: string;
  startDate: string;
  endDate: string;
};

type StepProps = {
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
};

const Step1Welcome: React.FC<StepProps> = ({ onNext }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s ease-out' }}>
      <div style={{ width: 80, height: 80, background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`, borderRadius: borderRadius.xl, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing['6'], fontSize: '36px', fontWeight: 700, color: 'white' }}>S</div>
      <h1 style={{ fontSize: '36px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'], letterSpacing: typography.letterSpacing.tight }}>Welcome to SiteSync PM</h1>
      <p style={{ fontSize: typography.fontSize.title, color: colors.textSecondary, margin: 0, marginBottom: spacing['8'], maxWidth: '480px', lineHeight: typography.lineHeight.relaxed }}>
        The construction operating system that thinks ahead. Let us set up your project in under 2 minutes.
      </p>
      <Btn size="lg" onClick={onNext} icon={<ArrowRight size={16} />} iconPosition="right">Get Started</Btn>
    </div>
  );
};

type Step2Props = StepProps & {
  form: ProjectForm;
  setForm: React.Dispatch<React.SetStateAction<ProjectForm>>;
  submitting: boolean;
};

const Step2Project: React.FC<Step2Props> = ({ onNext, onBack, onSkip, form, setForm, submitting }) => {
  const fields: Array<{ key: keyof ProjectForm; label: string; placeholder: string; type?: string }> = [
    { key: 'name', label: 'Project Name', placeholder: 'e.g. Riverside Tower' },
    { key: 'type', label: 'Type', placeholder: 'e.g. Multifamily, Commercial' },
    { key: 'totalValue', label: 'Total Value', placeholder: 'e.g. 12000000' },
    { key: 'location', label: 'Location', placeholder: 'e.g. Dallas, TX' },
    { key: 'startDate', label: 'Start Date', placeholder: 'YYYY-MM-DD', type: 'date' },
    { key: 'endDate', label: 'End Date', placeholder: 'YYYY-MM-DD', type: 'date' },
  ];

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Project Details</h2>
      <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginBottom: spacing['6'] }}>Tell us about your project.</p>
      {fields.map((field) => (
        <div key={field.key} style={{ marginBottom: spacing['4'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>{field.label}</label>
          <input
            type={field.type ?? 'text'}
            value={form[field.key]}
            placeholder={field.placeholder}
            onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
            style={{ width: '100%', padding: `${spacing['3']} ${spacing['4']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, color: colors.textPrimary, outline: 'none', backgroundColor: colors.surfaceRaised }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['5'] }}>
        <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Back</Btn>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onSkip}>Skip</Btn>
        <Btn onClick={onNext} loading={submitting} disabled={submitting || form.name.trim().length === 0} icon={<ArrowRight size={14} />} iconPosition="right">Next</Btn>
      </div>
    </div>
  );
};

type Step3Props = StepProps & {
  emails: string;
  setEmails: (v: string) => void;
  submitting: boolean;
};

const Step3Team: React.FC<Step3Props> = ({ onNext, onBack, onSkip, emails, setEmails, submitting }) => {
  const count = emails
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@')).length;

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Invite Your Team</h2>
      <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginBottom: spacing['6'] }}>Add team members by email. You can always add more later.</p>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="Enter email addresses, one per line"
        style={{ width: '100%', height: '120px', padding: spacing['4'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, color: colors.textPrimary, resize: 'vertical', outline: 'none', backgroundColor: colors.surfaceRaised }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['3'], padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
        <Users size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
          {count} team member{count === 1 ? '' : 's'} will be invited
        </span>
      </div>
      <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['5'] }}>
        <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Back</Btn>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onSkip}>Skip</Btn>
        <Btn onClick={onNext} loading={submitting} disabled={submitting} icon={<ArrowRight size={14} />} iconPosition="right">Next</Btn>
      </div>
    </div>
  );
};

const Step4Import: React.FC<StepProps> = ({ onNext, onBack, onSkip }) => {
  const [importing, setImporting] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Import Data</h2>
      <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginBottom: spacing['6'] }}>Bring your existing project data into SiteSync.</p>
      {['Procore', 'Primavera P6', 'Microsoft Project', 'Excel Spreadsheet'].map((source) => (
        <button key={source} onClick={() => { setImporting(source); setTimeout(() => { setImporting(null); }, 1500); }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['4']}`, backgroundColor: importing === source ? colors.orangeSubtle : colors.surfaceRaised, border: `1px solid ${importing === source ? colors.primaryOrange : colors.borderDefault}`, borderRadius: borderRadius.md, cursor: 'pointer', marginBottom: spacing['2'], fontFamily: typography.fontFamily, fontSize: typography.fontSize.body, color: colors.textPrimary, transition: `all ${transitions.instant}` }}>
          <Upload size={16} color={importing === source ? colors.orangeText : colors.textTertiary} />
          <span style={{ flex: 1, textAlign: 'left' }}>{source}</span>
          {importing === source && <span style={{ fontSize: typography.fontSize.caption, color: colors.orangeText }}>Importing...</span>}
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

type Step5Props = StepProps & {
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
};

const Step5Widgets: React.FC<Step5Props> = ({ onNext, onBack, selected, setSelected }) => {
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
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.normal, color: isSelected ? colors.orangeText : colors.textPrimary }}>{w.label}</span>
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
      {confetti && Array.from({ length: 30 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${10 + ((i * 37 + 13) % 80)}%`,
          top: `${((i * 29 + 7) % 60)}%`,
          width: 8, height: 8,
          backgroundColor: [colors.primaryOrange, colors.statusActive, colors.statusInfo, colors.statusReview, colors.statusPending][i % 5],
          borderRadius: i % 2 === 0 ? '50%' : '2px',
          transform: `rotate(${(i * 47) % 360}deg)`,
          opacity: 0.7,
          animation: `fadeIn 0.3s ease-out ${i * 0.05}s both`,
        }} />
      ))}

      <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: `${colors.statusActive}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing['5'], zIndex: 1 }}>
        <Check size={40} color={colors.statusActive} />
      </div>
      <h1 style={{ fontSize: '32px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'], zIndex: 1 }}>Your Project is Ready!</h1>
      <p style={{ fontSize: typography.fontSize.title, color: colors.textSecondary, margin: 0, marginBottom: spacing['8'], maxWidth: '400px', lineHeight: typography.lineHeight.relaxed, zIndex: 1 }}>
        Your project has been set up with AI powered insights. Your team will be notified shortly.
      </p>
      <Btn size="lg" onClick={onNext} icon={<LayoutGrid size={16} />}>Go to Dashboard</Btn>
    </div>
  );
};

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<ProjectForm>({
    name: '',
    type: '',
    totalValue: '',
    location: '',
    startDate: '',
    endDate: '',
  });
  const [inviteEmails, setInviteEmails] = useState('');
  const [selectedWidgets, setSelectedWidgets] = useState<Set<string>>(
    new Set(['weather-impact', 'ai-insights', 'cash-flow', 'live-site']),
  );
  const [projectId, setProjectId] = useState<string | null>(null);

  const createProject = useCreateOnboardingProject();
  const inviteTeam = useInviteOnboardingTeam();
  const markComplete = useMarkOnboardingComplete();

  const goBack = () => setStep((s) => Math.max(s - 1, 1));
  const skipToNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  const handleStep2Next = async () => {
    if (form.name.trim().length === 0) {
      toast.error('Project name is required');
      return;
    }
    if (projectId) {
      setStep(3);
      return;
    }
    const parsedValue = form.totalValue.replace(/[^0-9.]/g, '');
    try {
      const project = await createProject.mutateAsync({
        name: form.name,
        project_type: form.type || undefined,
        total_value: parsedValue ? Number(parsedValue) : undefined,
        address: form.location || undefined,
        start_date: form.startDate || undefined,
        scheduled_end_date: form.endDate || undefined,
        organization_id: currentOrg?.id,
      });
      setProjectId(project.id);
      toast.success('Project created');
      setStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  const handleStep3Next = async () => {
    const emailList = inviteEmails
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emailList.length === 0) {
      setStep(4);
      return;
    }
    if (!projectId || !currentOrg?.id) {
      toast.error('Missing project or organization context');
      setStep(4);
      return;
    }
    try {
      const result = await inviteTeam.mutateAsync({
        emails: emailList,
        organization_id: currentOrg.id,
        organization_name: currentOrg.name,
        project_id: projectId,
      });
      if (!result.skipped) {
        const sent = result.results.filter((r) => r.status === 'sent' || r.status === 'queued').length;
        if (sent > 0) toast.success(`Invited ${sent} team member${sent === 1 ? '' : 's'}`);
        const failed = result.results.filter((r) => r.status === 'failed');
        if (failed.length > 0) toast.error(`${failed.length} invite${failed.length === 1 ? '' : 's'} failed`);
      }
      setStep(4);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invites');
    }
  };

  const handleFinish = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await markComplete.mutateAsync({
          user_id: user.id,
          dashboard_widgets: Array.from(selectedWidgets),
        });
      }
    } catch (err) {
      // Non-fatal — the user still gets into the app. We log but don't
      // block the final navigation on a profile write failure.
      console.warn('[Onboarding] Failed to mark onboarding complete:', err);
    }
    navigate('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.surfacePage, display: 'flex', flexDirection: 'column' }}>
      {step < TOTAL_STEPS && (
        <div style={{ padding: `${spacing['4']} ${spacing['6']}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>Step {step} of {TOTAL_STEPS - 1}</span>
            <button onClick={skipToNext} style={{ backgroundColor: 'transparent', border: 'none', color: colors.textTertiary, cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>Skip</button>
          </div>
          <ProgressBar value={(step / (TOTAL_STEPS - 1)) * 100} height={3} color={colors.primaryOrange} />
        </div>
      )}

      <div style={{ flex: 1, padding: `${spacing['8']} ${spacing['6']}` }}>
        {step === 1 && <Step1Welcome onNext={() => setStep(2)} />}
        {step === 2 && (
          <Step2Project
            onNext={handleStep2Next}
            onBack={goBack}
            onSkip={skipToNext}
            form={form}
            setForm={setForm}
            submitting={createProject.isPending}
          />
        )}
        {step === 3 && (
          <Step3Team
            onNext={handleStep3Next}
            onBack={goBack}
            onSkip={skipToNext}
            emails={inviteEmails}
            setEmails={setInviteEmails}
            submitting={inviteTeam.isPending}
          />
        )}
        {step === 4 && <Step4Import onNext={() => setStep(5)} onBack={goBack} onSkip={skipToNext} />}
        {step === 5 && (
          <Step5Widgets
            onNext={() => setStep(6)}
            onBack={goBack}
            selected={selectedWidgets}
            setSelected={setSelectedWidgets}
          />
        )}
        {step === 6 && <Step6Complete onNext={handleFinish} />}
      </div>
    </div>
  );
};
