// ─────────────────────────────────────────────────────────────────────────────
// CreateProject — single-screen project creation (Tab T-Onboarding)
// ─────────────────────────────────────────────────────────────────────────────
// Replaces the 6-step wizard. Two-column desktop layout: dense form on the
// left, live cockpit-style preview on the right. Five ZonePanels (Basics,
// Schedule, Team, Templates, AI Setup), Iris-suggest inline based on
// address, smart defaults for project number, single Create button.
// No parchment. No Garamond. No "Step 1 of 5".
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Briefcase, Calendar, Check, ChevronRight, Edit3, FileText, Layers,
  MapPin, Plus, Save, Sparkles, Upload, Users, X,
} from 'lucide-react';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { PermissionGate } from '../components/auth/PermissionGate';
import { useOrganization } from '../hooks/useOrganization';
import { useCreateOnboardingProject } from '../hooks/mutations/onboarding';
import { typography } from '../styles/theme';
import { ProjectCreatePreview } from '../components/projects/ProjectCreatePreview';
import type { ProjectPreviewData } from '../components/projects/ProjectCreatePreview';

// ── Constants ───────────────────────────────────────────────────────────────

const PAGE_BG = '#FCFCFA';
const SURFACE = '#FFFFFF';
const SURFACE_INSET = '#F5F4F1';
const BORDER = '#E8E5DF';
const BORDER_STRONG = '#D9D5CD';
const INK = '#1A1613';
const INK_2 = '#5C5550';
const INK_3 = '#8C857E';

const STATUS = {
  brandAction: '#F47820',
  iris: '#4F46E5',
  irisSubtle: '#4F46E512',
  onTrack: '#2D8A6E',
  info: '#3B82F6',
} as const;

// ── Types ───────────────────────────────────────────────────────────────────

type ProjectType = 'commercial' | 'residential' | 'industrial' | 'mixed_use' | '';
type Template = 'blank' | 'procore_import' | 'previous' | 'industry';
type IrisProvider = 'procore' | 'bluebeam' | 'plangrid';

interface FormState {
  name: string;
  number: string;
  numberAuto: boolean;
  type: ProjectType;
  address: string;
  startDate: string;
  endDate: string;
  contractValue: string;
  squareFeet: string;
  ownerName: string;
  gcName: string;
  architectName: string;
  template: Template;
  irisAutoImport: boolean;
  irisProviders: IrisProvider[];
}

// ── Smart defaults ──────────────────────────────────────────────────────────

function autoProjectNumber(): string {
  const year = new Date().getFullYear();
  // Random 4-digit sequence — server has unique constraints; this is a hint
  // value and the user can override before submit.
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `${year}-${seq}`;
}

// ── Iris heuristics ─────────────────────────────────────────────────────────
// Public-records lookup is post-Wave-1; until that edge function lands we
// surface a deterministic heuristic on the address so the suggestion is
// directionally correct rather than fabricated.

interface IrisAddressSuggestion {
  type: ProjectType;
  squareFeet: number;
  rationale: string;
}

function inferFromAddress(address: string): IrisAddressSuggestion | null {
  const a = address.toLowerCase();
  if (!a || a.length < 5) return null;

  const commercial = /(tower|plaza|center|centre|mall|office|hq|hotel|hospital|terminal|airport|broadway|main st|market st|park ave)/;
  const industrial = /(industrial|warehouse|distribution|logistics|factory|plant|manufactur|terminal rd|freight)/;
  const residential = /(\b\d+\s+\w+\s+(?:dr|drive|ln|lane|ct|court|way|cir|circle|terrace|trail)\b|apartments?|residences?|townhomes?|condo|loft)/;

  if (industrial.test(a)) {
    return { type: 'industrial', squareFeet: 75_000, rationale: 'industrial-zone keyword in address' };
  }
  if (commercial.test(a)) {
    return { type: 'commercial', squareFeet: 45_000, rationale: 'commercial-corridor keyword in address' };
  }
  if (residential.test(a)) {
    return { type: 'residential', squareFeet: 8_500, rationale: 'residential-pattern address' };
  }
  return null;
}

// ── ZonePanel ───────────────────────────────────────────────────────────────

const ZonePanel: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, children }) => (
  <section style={{
    backgroundColor: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 14,
  }}>
    <header style={{
      display: 'flex', alignItems: 'center',
      gap: 10, padding: '10px 14px',
      borderBottom: `1px solid ${BORDER}`,
      backgroundColor: '#FAFAF8',
    }}>
      {icon}
      <h2 style={{
        margin: 0, fontFamily: typography.fontFamily,
        fontSize: 13, fontWeight: 600, color: INK,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {title}
      </h2>
      {subtitle && (
        <span style={{ fontSize: 11, color: INK_3, fontFamily: typography.fontFamily }}>
          {subtitle}
        </span>
      )}
    </header>
    <div style={{ padding: 16 }}>{children}</div>
  </section>
);

// ── Field primitive ─────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, htmlFor, hint, required, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label htmlFor={htmlFor} style={{
      fontSize: 11, fontWeight: 600, color: INK_3,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {label}
      {required && <span style={{ color: STATUS.brandAction, marginLeft: 4 }}>*</span>}
    </label>
    {children}
    {hint && (
      <span style={{ fontSize: 11, color: INK_3, lineHeight: 1.4 }}>{hint}</span>
    )}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  border: `1px solid ${BORDER}`, borderRadius: 6,
  backgroundColor: SURFACE,
  fontFamily: typography.fontFamily, fontSize: 13,
  color: INK, outline: 'none',
  boxSizing: 'border-box',
};

// ── Iris suggest pill ──────────────────────────────────────────────────────

const IrisSuggest: React.FC<{
  text: string;
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}> = ({ text, onAccept, onEdit, onDismiss }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px',
    border: `1px solid ${STATUS.iris}33`,
    backgroundColor: STATUS.irisSubtle,
    borderRadius: 6,
    fontFamily: typography.fontFamily,
  }}>
    <Sparkles size={14} color={STATUS.iris} />
    <span style={{ fontSize: 12, color: INK_2, flex: 1 }}>
      Iris suggests: <strong style={{ color: INK }}>{text}</strong>
    </span>
    <button type="button" onClick={onAccept} style={miniPrimaryStyle}>
      <Check size={11} /> Accept
    </button>
    <button type="button" onClick={onEdit} style={miniSecondaryStyle}>
      <Edit3 size={11} /> Edit
    </button>
    <button type="button" onClick={onDismiss} aria-label="Dismiss"
      style={{ ...miniSecondaryStyle, padding: '3px 6px' }}>
      <X size={11} />
    </button>
  </div>
);

// ── Templates grid ──────────────────────────────────────────────────────────

const TEMPLATE_CARDS: Array<{ id: Template; label: string; subtitle: string; icon: React.ReactNode }> = [
  { id: 'blank',          label: 'Blank',           subtitle: 'Start from scratch — five sections to fill.', icon: <FileText size={16} /> },
  { id: 'procore_import', label: 'Procore Import',  subtitle: 'Pull existing project data from Procore.',   icon: <Upload size={16} /> },
  { id: 'previous',       label: 'Previous Project', subtitle: 'Clone settings, contacts, templates.',       icon: <Layers size={16} /> },
  { id: 'industry',       label: 'Industry Template', subtitle: 'Mid-rise, healthcare, K-12, TI, etc.',     icon: <Briefcase size={16} /> },
];

// ── Provider chips ──────────────────────────────────────────────────────────

const PROVIDERS: Array<{ id: IrisProvider; label: string }> = [
  { id: 'procore', label: 'Procore' },
  { id: 'bluebeam', label: 'Bluebeam' },
  { id: 'plangrid', label: 'PlanGrid' },
];

// ─────────────────────────────────────────────────────────────────────────────

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="region" aria-label="New project" style={{
    flex: 1, minHeight: 0, overflow: 'auto',
    backgroundColor: PAGE_BG,
    fontFamily: typography.fontFamily,
    color: INK,
  }}>
    {children}
  </div>
);

const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const createProject = useCreateOnboardingProject();
  const nameRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => ({
    name: '',
    number: autoProjectNumber(),
    numberAuto: true,
    type: '',
    address: '',
    startDate: '',
    endDate: '',
    contractValue: '',
    squareFeet: '',
    ownerName: '',
    gcName: '',
    architectName: '',
    template: 'blank',
    irisAutoImport: true,
    irisProviders: ['procore'],
  }));
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [irisDismissed, setIrisDismissed] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Focus the name field on mount — a PM coming from the dashboard wants to
  // start typing immediately.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Iris suggestion based on address. Recomputes on every keystroke; user
  // can dismiss to silence further suggestions for the same address run.
  const irisSuggestion = useMemo<IrisAddressSuggestion | null>(() => {
    if (irisDismissed) return null;
    return inferFromAddress(form.address);
  }, [form.address, irisDismissed]);
  // Don't pester the user once they've already filled in both fields.
  const irisShouldShow = !!irisSuggestion && (form.type === '' || !form.squareFeet);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onAcceptIris = useCallback(() => {
    if (!irisSuggestion) return;
    setForm((prev) => ({
      ...prev,
      type: prev.type || irisSuggestion.type,
      squareFeet: prev.squareFeet || String(irisSuggestion.squareFeet),
    }));
  }, [irisSuggestion]);

  const onEditIris = useCallback(() => {
    // Treat Edit as "accept and let me adjust" — same fill, then leave the
    // pill so the user can re-trigger if they wipe values.
    onAcceptIris();
    setIrisDismissed(true);
  }, [onAcceptIris]);

  const onDismissIris = useCallback(() => setIrisDismissed(true), []);

  // ── Live preview data ────────────────────────────────────────────────────
  const previewData: ProjectPreviewData = useMemo(() => ({
    name: form.name,
    number: form.number,
    address: form.address,
    type: form.type ? labelForType(form.type) : '',
    startDate: form.startDate,
    endDate: form.endDate,
    contractValue: form.contractValue ? Number(form.contractValue.replace(/[^0-9.]/g, '')) : null,
    squareFeet: form.squareFeet ? Number(form.squareFeet.replace(/[^0-9.]/g, '')) : null,
    ownerName: form.ownerName,
    gcName: form.gcName,
    architectName: form.architectName,
    template: labelForTemplate(form.template),
    irisAutoImport: form.irisAutoImport,
    irisProviders: form.irisProviders.map((p) => labelForProvider(p)),
  }), [form]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const valid = form.name.trim().length > 0;
  const submitting = createProject.isPending;

  const handleCreate = useCallback(async () => {
    if (!valid) {
      toast.error('Project name is required');
      nameRef.current?.focus();
      return;
    }
    try {
      const project = await createProject.mutateAsync({
        name: form.name.trim(),
        project_type: form.type || undefined,
        total_value: form.contractValue
          ? Number(form.contractValue.replace(/[^0-9.]/g, ''))
          : undefined,
        address: form.address.trim() || undefined,
        start_date: form.startDate || undefined,
        scheduled_end_date: form.endDate || undefined,
        organization_id: currentOrg?.id,
      });
      toast.success(`${form.name.trim()} created`);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    }
  }, [valid, createProject, form, currentOrg?.id, navigate]);

  const handleSaveDraft = useCallback(async () => {
    setSavingDraft(true);
    try {
      // Drafts persist to localStorage so the user can come back to a
      // partially-filled form. A real "Project draft" record would be
      // post-Wave-1 once the projects.status enum has 'draft'.
      localStorage.setItem('siteSync:project-draft', JSON.stringify(form));
      toast.success('Draft saved locally');
    } catch {
      toast.error('Could not save draft');
    } finally {
      setSavingDraft(false);
    }
  }, [form]);

  // Hydrate any saved draft on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('siteSync:project-draft');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<FormState>;
      if (parsed && typeof parsed === 'object' && parsed.name) {
        setForm((prev) => ({ ...prev, ...parsed, numberAuto: parsed.numberAuto ?? false }));
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <PageShell>
      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        backgroundColor: PAGE_BG,
        borderBottom: `1px solid ${BORDER}`,
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <h1 style={{
          margin: 0, fontFamily: typography.fontFamily,
          fontSize: 18, fontWeight: 700, color: INK,
          letterSpacing: '-0.01em', lineHeight: 1.2,
        }}>
          New Project
        </h1>
        <nav aria-label="Breadcrumb" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: INK_3,
        }}>
          <span>Onboarding</span>
          <ChevronRight size={11} />
          <span style={{ color: INK_2, fontWeight: 500 }}>Project Details</span>
        </nav>

        <div className="cp-mobile-preview-toggle" style={{
          display: 'none',
          marginLeft: 'auto',
        }}>
          <button type="button"
            onClick={() => setShowPreviewMobile((s) => !s)}
            style={ghostBtnStyle}
          >
            {showPreviewMobile ? 'Hide preview' : 'Show preview'}
          </button>
        </div>

        <div className="cp-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            style={ghostBtnStyle}
            data-testid="save-draft-button"
          >
            <Save size={13} />
            {savingDraft ? 'Saving…' : 'Save draft'}
          </button>
          <PermissionGate permission="project.settings">
            <button type="button"
              onClick={handleCreate}
              disabled={!valid || submitting}
              style={!valid || submitting ? primaryDisabledStyle : primaryBtnStyle}
              data-testid="create-project-button"
            >
              <Plus size={14} />
              {submitting ? 'Creating…' : 'Create Project'}
            </button>
          </PermissionGate>
        </div>
      </header>

      {/* Body — 2-column ≥1024px, single column < 1024px */}
      <main className="cp-body" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
        gap: 16,
        padding: 24,
        maxWidth: 'none',
      }}>
        <div>
          {/* 1. Basics */}
          <ZonePanel title="Basics" icon={<Briefcase size={13} color={INK_3} />}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
              <Field label="Project name" htmlFor="cp-name" required>
                <input
                  ref={nameRef}
                  id="cp-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Riverside Tower"
                  style={inputStyle}
                />
              </Field>
              <Field label="Project number" htmlFor="cp-num"
                hint={form.numberAuto ? 'Auto-generated. Edit to override.' : undefined}>
                <input
                  id="cp-num"
                  type="text"
                  value={form.number}
                  onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value, numberAuto: false }))}
                  style={{ ...inputStyle, fontFamily: typography.fontFamilyMono, fontVariantNumeric: 'tabular-nums' }}
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginTop: 12 }}>
              {(['commercial', 'residential', 'industrial', 'mixed_use'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={form.type === t}
                  onClick={() => setField('type', t)}
                  style={{
                    padding: '8px 10px',
                    border: `1px solid ${form.type === t ? INK : BORDER}`,
                    borderRadius: 6,
                    backgroundColor: form.type === t ? INK : SURFACE,
                    color: form.type === t ? '#FFFFFF' : INK_2,
                    fontSize: 12, fontWeight: 600,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {labelForType(t)}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <Field label="Address" htmlFor="cp-addr"
                hint="Iris uses this to suggest project type + sq ft from public records.">
                <input
                  id="cp-addr"
                  type="text"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="1100 Market Street, San Francisco, CA"
                  style={inputStyle}
                />
              </Field>
              {irisShouldShow && irisSuggestion && (
                <div style={{ marginTop: 8 }}>
                  <IrisSuggest
                    text={`${labelForType(irisSuggestion.type)} · ${new Intl.NumberFormat('en-US').format(irisSuggestion.squareFeet)} sq ft`}
                    onAccept={onAcceptIris}
                    onEdit={onEditIris}
                    onDismiss={onDismissIris}
                  />
                  <div style={{ marginTop: 4, fontSize: 11, color: INK_3 }}>
                    {irisSuggestion.rationale}. Override anytime.
                  </div>
                </div>
              )}
              <MapPlaceholder address={form.address} />
            </div>
          </ZonePanel>

          {/* 2. Schedule */}
          <ZonePanel title="Schedule" icon={<Calendar size={13} color={INK_3} />}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <Field label="Start date" htmlFor="cp-start">
                <input id="cp-start" type="date"
                  value={form.startDate}
                  onChange={(e) => setField('startDate', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Target completion" htmlFor="cp-end">
                <input id="cp-end" type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setField('endDate', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Contract value" htmlFor="cp-contract"
                hint="Used for budget rollups and the cockpit summary.">
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 13, color: INK_3,
                  }}>$</span>
                  <input id="cp-contract" type="text" inputMode="numeric"
                    value={form.contractValue}
                    onChange={(e) => setField('contractValue', e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="12,000,000"
                    style={{ ...inputStyle, paddingLeft: 20, fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
              </Field>
              <Field label="Square footage" htmlFor="cp-sqft">
                <input id="cp-sqft" type="text" inputMode="numeric"
                  value={form.squareFeet}
                  onChange={(e) => setField('squareFeet', e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="45,000"
                  style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                />
              </Field>
            </div>
          </ZonePanel>

          {/* 3. Team */}
          <ZonePanel title="Team" subtitle="Search the directory or add new contacts inline."
            icon={<Users size={13} color={INK_3} />}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <Field label="Owner" htmlFor="cp-owner">
                <input id="cp-owner" type="text"
                  list="cp-team-options"
                  value={form.ownerName}
                  onChange={(e) => setField('ownerName', e.target.value)}
                  placeholder="Owner name or company"
                  style={inputStyle}
                />
              </Field>
              <Field label="General contractor" htmlFor="cp-gc">
                <input id="cp-gc" type="text"
                  list="cp-team-options"
                  value={form.gcName}
                  onChange={(e) => setField('gcName', e.target.value)}
                  placeholder="GC name or company"
                  style={inputStyle}
                />
              </Field>
              <Field label="Architect" htmlFor="cp-arch">
                <input id="cp-arch" type="text"
                  list="cp-team-options"
                  value={form.architectName}
                  onChange={(e) => setField('architectName', e.target.value)}
                  placeholder="Architect of record"
                  style={inputStyle}
                />
              </Field>
            </div>
            <datalist id="cp-team-options">
              {/* Project-scoped directory wires in once a project exists; for
                  the create flow this stays empty so PMs can free-type. */}
            </datalist>
          </ZonePanel>

          {/* 4. Templates */}
          <ZonePanel title="Templates" subtitle="Start fast. Override anything once the project lives."
            icon={<Layers size={13} color={INK_3} />}>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
              {TEMPLATE_CARDS.map((t) => {
                const active = form.template === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setField('template', t.id)}
                    aria-pressed={active}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      gap: 6, padding: 12, textAlign: 'left',
                      border: `1px solid ${active ? INK : BORDER}`,
                      backgroundColor: active ? INK : SURFACE,
                      color: active ? '#FFFFFF' : INK_2,
                      borderRadius: 6, cursor: 'pointer',
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600,
                      color: active ? '#FFFFFF' : INK,
                    }}>
                      {t.icon}
                      {t.label}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: active ? 'rgba(255,255,255,0.78)' : INK_3,
                      lineHeight: 1.4,
                    }}>
                      {t.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </ZonePanel>

          {/* 5. AI setup */}
          <ZonePanel title="AI setup" icon={<Sparkles size={13} color={STATUS.iris} />}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={form.irisAutoImport}
                onChange={(e) => setField('irisAutoImport', e.target.checked)}
                style={{ marginTop: 3, accentColor: STATUS.iris, width: 14, height: 14 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                  Iris auto-imports drawings, RFIs, schedule
                </div>
                <div style={{ fontSize: 12, color: INK_3, lineHeight: 1.4, marginTop: 2 }}>
                  Iris reads from existing tools the moment the project is created and stages drafts for your review. You approve before anything ships.
                </div>
              </div>
            </label>

            {form.irisAutoImport && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: INK_3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  Source providers
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PROVIDERS.map((p) => {
                    const active = form.irisProviders.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            irisProviders: active
                              ? prev.irisProviders.filter((x) => x !== p.id)
                              : [...prev.irisProviders, p.id],
                          }));
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '5px 11px', borderRadius: 999,
                          border: `1px solid ${active ? STATUS.iris : BORDER}`,
                          backgroundColor: active ? STATUS.irisSubtle : SURFACE,
                          color: active ? STATUS.iris : INK_2,
                          fontSize: 12, fontWeight: 600,
                          fontFamily: typography.fontFamily, cursor: 'pointer',
                        }}
                      >
                        {active && <Check size={10} />}
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </ZonePanel>

          {/* Bottom create row (mobile and as a fallback if the user scrolls
              past the sticky header) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={handleSaveDraft} disabled={savingDraft} style={ghostBtnStyle}>
              <Save size={13} /> Save draft
            </button>
            <PermissionGate permission="project.settings">
              <button type="button"
                onClick={handleCreate}
                disabled={!valid || submitting}
                style={!valid || submitting ? primaryDisabledStyle : primaryBtnStyle}
              >
                <Plus size={14} />
                {submitting ? 'Creating…' : 'Create Project'}
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Right column — preview */}
        <div className="cp-preview-col">
          <ProjectCreatePreview data={previewData} />
          {showPreviewMobile && (
            <div className="cp-preview-mobile-spacer" style={{ height: 0 }} />
          )}
        </div>
      </main>

      <style>{`
        @media (max-width: 1023px) {
          .cp-body { grid-template-columns: minmax(0, 1fr) !important; }
          .cp-preview-col { display: none; }
          .cp-mobile-preview-toggle { display: block !important; }
        }
      `}</style>
      <style>{`
        @media (max-width: 1023px) {
          .cp-preview-col-mobile { display: ${showPreviewMobile ? 'block' : 'none'}; }
        }
      `}</style>
    </PageShell>
  );
};

// ── Map placeholder (Mapbox-not-configured graceful degradation) ─────────────

const MapPlaceholder: React.FC<{ address: string }> = ({ address }) => {
  const hasAddress = !!address.trim();
  return (
    <div style={{
      marginTop: 12,
      padding: 12,
      backgroundColor: SURFACE_INSET,
      border: `1px dashed ${BORDER_STRONG}`,
      borderRadius: 6,
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: typography.fontFamily,
    }}>
      <MapPin size={16} color={INK_3} />
      <span style={{ fontSize: 12, color: INK_2, lineHeight: 1.4 }}>
        {hasAddress
          ? <>Pin will drop on <strong style={{ color: INK }}>{address}</strong> once Mapbox is configured.</>
          : <>Type an address above to drop a pin.</>}
      </span>
    </div>
  );
};

// ── Labels ──────────────────────────────────────────────────────────────────

function labelForType(t: ProjectType): string {
  switch (t) {
    case 'commercial': return 'Commercial';
    case 'residential': return 'Residential';
    case 'industrial': return 'Industrial';
    case 'mixed_use': return 'Mixed use';
    default: return '';
  }
}

function labelForTemplate(t: Template): string {
  switch (t) {
    case 'blank': return 'Blank';
    case 'procore_import': return 'Procore Import';
    case 'previous': return 'Previous Project';
    case 'industry': return 'Industry Template';
  }
}

function labelForProvider(p: IrisProvider): string {
  switch (p) {
    case 'procore': return 'Procore';
    case 'bluebeam': return 'Bluebeam';
    case 'plangrid': return 'PlanGrid';
  }
}

// ── Inline button styles ────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', border: 'none', borderRadius: 6,
  backgroundColor: STATUS.brandAction, color: '#FFFFFF',
  fontSize: 13, fontWeight: 600,
  fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
};

const primaryDisabledStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  backgroundColor: SURFACE_INSET, color: INK_3, cursor: 'not-allowed',
};

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 11px',
  border: `1px solid ${BORDER}`, borderRadius: 6,
  backgroundColor: SURFACE, color: INK_2,
  fontSize: 13, fontWeight: 500,
  fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
};

const miniPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 9px', border: 'none', borderRadius: 4,
  backgroundColor: STATUS.iris, color: '#FFFFFF',
  fontSize: 11, fontWeight: 600,
  cursor: 'pointer', fontFamily: typography.fontFamily,
};

const miniSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 9px', border: `1px solid ${BORDER}`, borderRadius: 4,
  backgroundColor: 'transparent', color: INK_2,
  fontSize: 11, fontWeight: 500,
  cursor: 'pointer', fontFamily: typography.fontFamily,
};

// ── Public export ───────────────────────────────────────────────────────────

export const CreateProject: React.FC = () => (
  <ErrorBoundary message="Project creation could not load. Reload and try again.">
    <CreateProjectPage />
  </ErrorBoundary>
);

export default CreateProject;
