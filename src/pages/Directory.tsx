import React, { useState, useMemo, useRef } from 'react';
import { Search, Users, Phone, Mail, Building, Plus, ShieldCheck, FileText, Upload, MessageSquare, Clock, AlertTriangle } from 'lucide-react';
import { PageContainer, Card, MetricBox, Avatar, Tag, Btn } from '../components/Primitives';
import { Drawer } from '../components/Drawer';
import { PermissionGate } from '../components/auth/PermissionGate';
import { PageInsightBanners } from '../components/ai/PredictiveAlert';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useDirectoryContacts, useCompanies } from '../hooks/queries/directory-contacts';
import {
  usePrequalifications,
  useCommunicationLogs,
  useLastContactMap,
  type PrequalStatus as PrequalStatusRemote,
  type CommunicationChannel,
} from '../hooks/queries/directory';
import {
  useUpsertPrequalification,
  useCreateCommunicationLog,
} from '../hooks/mutations/directory';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { DirectoryContact } from '../types/database';

interface ContactFormModalProps {
  projectId: string;
  onClose: () => void;
  initial?: Partial<Contact> & { id?: string };
}

const ContactFormModal: React.FC<ContactFormModalProps> = ({ projectId, onClose, initial }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    company: initial?.company ?? '',
    role: initial?.role ?? '',
    trade: initial?.trade ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const editing = !!initial?.id;
  const submit = async () => {
    if (!form.name.trim()) { setErr('Name required'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form, project_id: projectId };
      if (editing) {
        const { error } = await supabase.from('directory_contacts').update(payload).eq('id', initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('directory_contacts').insert(payload);
        if (error) throw error;
      }
      toast.success(editing ? 'Contact updated' : 'Contact added');
      qc.invalidateQueries({ queryKey: ['directory_contacts'] });
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
  };
  const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, marginBottom: spacing['3'], fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing['6'], width: '100%', maxWidth: 480 }}>
        <h2 style={{ margin: 0, marginBottom: spacing['4'], fontSize: 18 }}>{editing ? 'Edit Contact' : 'Add Contact'}</h2>
        {(['name', 'company', 'role', 'trade', 'phone', 'email'] as const).map(k => (
          <div key={k}>
            <label style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{k}{k === 'name' ? ' *' : ''}</label>
            <input style={input} value={form[k]} onChange={(e) => setForm(p => ({ ...p, [k]: e.target.value }))} />
          </div>
        ))}
        {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: spacing['3'] }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Save' : 'Add Contact')}</Btn>
        </div>
      </div>
    </div>
  );
};

interface CompanyFormModalProps {
  projectId: string;
  onClose: () => void;
}

const CompanyFormModal: React.FC<CompanyFormModalProps> = ({ projectId, onClose }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    trade: '',
    insurance_status: 'missing' as 'current' | 'expiring' | 'expired' | 'missing',
    insurance_expiry: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!form.name.trim()) { setErr('Company name required'); return; }
    setSaving(true); setErr(null);
    try {
      const { error } = await supabase.from('companies').insert({
        project_id: projectId,
        name: form.name.trim(),
        trade: form.trade.trim() || null,
        insurance_status: form.insurance_status,
        insurance_expiry: form.insurance_expiry || null,
      });
      if (error) throw error;
      toast.success('Company added');
      qc.invalidateQueries({ queryKey: ['companies'] });
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
  };
  const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, marginBottom: spacing['3'], fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing['6'], width: '100%', maxWidth: 480 }}>
        <h2 style={{ margin: 0, marginBottom: spacing['4'], fontSize: 18 }}>Add Company</h2>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Company Name *</label>
        <input style={input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <label style={{ fontSize: 13, fontWeight: 500 }}>Trade</label>
        <input style={input} value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))} />
        <label style={{ fontSize: 13, fontWeight: 500 }}>Insurance Status</label>
        <select style={{ ...input, appearance: 'auto' }} value={form.insurance_status} onChange={e => setForm(p => ({ ...p, insurance_status: e.target.value as typeof form.insurance_status }))}>
          <option value="current">Current</option>
          <option value="expiring">Expiring Soon</option>
          <option value="expired">Expired</option>
          <option value="missing">Not on File</option>
        </select>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Insurance Expiry Date</label>
        <input type="date" style={input} value={form.insurance_expiry} onChange={e => setForm(p => ({ ...p, insurance_expiry: e.target.value }))} />
        {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: spacing['3'] }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Add Company'}</Btn>
        </div>
      </div>
    </div>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  trade: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
}

type InsuranceStatus = 'current' | 'expiring' | 'expired' | 'missing';

interface CompanyInfo {
  name: string;
  trade: string;
  insuranceStatus: InsuranceStatus;
  insuranceExpiry: string;
}

type PrequalStatus = 'not_started' | 'in_review' | 'approved' | 'rejected' | 'expired';

interface PrequalInfo {
  status: PrequalStatus;
  bondingCapacity: string;
  insuranceLimits: string;
  emrRate: number;
  yearsInBusiness: number;
  licenseNumbers: string;
  lastUpdated: string;
}

interface COIRecord {
  type: 'GL' | 'Auto' | 'Workers Comp' | 'Umbrella' | 'Professional Liability';
  carrier: string;
  policyNumber: string;
  coverageAmount: string;
  expirationDate: string;
  additionalInsured: boolean;
}

interface CommLogEntry {
  id: string;
  date: string;
  type: 'email' | 'call' | 'meeting' | 'letter';
  subject: string;
  summary: string;
  loggedBy: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getInsuranceDot(status: InsuranceStatus): { color: string; label: string } {
  switch (status) {
    case 'current': return { color: colors.statusActive, label: 'Insurance current' };
    case 'expiring': return { color: colors.statusPending, label: 'Insurance expiring soon' };
    case 'expired': return { color: colors.statusCritical, label: 'Insurance expired' };
    case 'missing': return { color: colors.statusCritical, label: 'No insurance on file' };
  }
}

function getPrequalColor(status: PrequalStatus): { fg: string; bg: string; label: string } {
  switch (status) {
    case 'not_started': return { fg: colors.textTertiary, bg: colors.statusNeutralSubtle, label: 'Not Started' };
    case 'in_review': return { fg: colors.statusPending, bg: colors.statusPendingSubtle, label: 'In Review' };
    case 'approved': return { fg: colors.statusActive, bg: colors.statusActiveSubtle, label: 'Approved' };
    case 'rejected': return { fg: colors.statusCritical, bg: colors.statusCriticalSubtle, label: 'Rejected' };
    case 'expired': return { fg: colors.statusCritical, bg: colors.statusCriticalSubtle, label: 'Expired' };
  }
}

function getCOIExpiryColor(expirationDate: string): { color: string; label: string } {
  const now = new Date();
  const exp = new Date(expirationDate);
  const daysUntil = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return { color: colors.statusCritical, label: 'Expired' };
  if (daysUntil <= 30) return { color: colors.statusPending, label: `Expires in ${daysUntil}d` };
  return { color: colors.statusActive, label: 'Current' };
}

function isPrequalExpired(lastUpdated: string): boolean {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return new Date(lastUpdated) < oneYearAgo;
}

// ── Default empty states ────────────────────────────────────────────────────
// TODO: Wire to Supabase tables: 'prequalifications', 'communication_logs'
// These tables need to be created. For now, using local state with empty defaults.

const DEFAULT_PREQUAL: PrequalInfo = {
  status: 'not_started',
  bondingCapacity: '',
  insuranceLimits: '',
  emrRate: 0,
  yearsInBusiness: 0,
  licenseNumbers: '',
  lastUpdated: '',
};

function _getDefaultPrequal(): PrequalInfo {
  return { ...DEFAULT_PREQUAL };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const PrequalDetailPanel: React.FC<{ companyContactId: string; projectId?: string; onStatusChange?: (s: PrequalStatus) => void }> = ({ companyContactId, projectId, onStatusChange }) => {
  const { data: prequalRows } = usePrequalifications(projectId);
  const upsert = useUpsertPrequalification();
  const row = useMemo(
    () => (prequalRows ?? []).find(r => r.company_id === companyContactId) ?? null,
    [prequalRows, companyContactId],
  );
  const pq: PrequalInfo = useMemo(() => ({
    status: (row?.status ?? 'not_started') as PrequalStatus,
    bondingCapacity: row?.bonding_capacity ?? '',
    insuranceLimits: row?.insurance_limits ?? '',
    emrRate: row?.emr_rate ?? 0,
    yearsInBusiness: row?.years_in_business ?? 0,
    licenseNumbers: row?.license_numbers ?? '',
    lastUpdated: row?.updated_at ? row.updated_at.slice(0, 10) : '',
  }), [row]);

  const { fg, bg, label } = getPrequalColor(pq.status);
  const expired = pq.lastUpdated ? isPrequalExpired(pq.lastUpdated) : false;
  const fields = [
    { label: 'Bonding Capacity', value: pq.bondingCapacity || '—' },
    { label: 'Insurance Limits', value: pq.insuranceLimits || '—' },
    { label: 'EMR Rate', value: pq.emrRate ? String(pq.emrRate) : '—' },
    { label: 'Years in Business', value: pq.yearsInBusiness ? String(pq.yearsInBusiness) : '—' },
    { label: 'License Numbers', value: pq.licenseNumbers || '—' },
    { label: 'Last Updated', value: pq.lastUpdated || '—' },
  ];

  const requestPrequal = async () => {
    if (!projectId || !companyContactId) return;
    try {
      const newStatus: PrequalStatusRemote = 'in_review';
      await upsert.mutateAsync({
        projectId,
        companyId: companyContactId,
        status: newStatus,
        submittedAt: new Date().toISOString(),
      });
      onStatusChange?.(newStatus as PrequalStatus);
      toast.success('Prequalification requested');
    } catch {
      /* toast surfaced by mutation onError */
    }
  };
  const requesting = upsert.isPending;

  return (
    <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <ShieldCheck size={16} style={{ color: fg }} />
          <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Prequalification</span>
        </div>
        <Tag label={expired && pq.status !== 'expired' ? 'Expired' : label} color={expired ? colors.statusCritical : fg} backgroundColor={expired ? colors.statusCriticalSubtle : bg} fontSize={typography.fontSize.caption} />
      </div>
      {expired && pq.status !== 'expired' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['2'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
          <AlertTriangle size={13} /> Prequalification expired (older than 1 year)
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
        {fields.map(f => (
          <div key={f.label}>
            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</p>
            <p style={{ margin: 0, fontSize: typography.fontSize.body, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{f.value}</p>
          </div>
        ))}
      </div>
      {(pq.status === 'not_started' || pq.status === 'expired') && (
        <Btn variant="secondary" onClick={requestPrequal} disabled={requesting} style={{ alignSelf: 'flex-start' }}>
          <ShieldCheck size={13} /> {requesting ? 'Requesting...' : 'Request Prequalification'}
        </Btn>
      )}
    </div>
  );
};

const COISection: React.FC<{ companyName: string; projectId?: string }> = ({ companyName, projectId }) => {
  const [records, setRecords] = useState<COIRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load COI records from insurance_certificates table
  React.useEffect(() => {
    if (!projectId || !companyName) return;
    supabase
      .from('insurance_certificates')
      .select('*')
      .eq('project_id', projectId)
      .eq('company', companyName)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setRecords(data.map(r => ({
            type: (r.policy_type || 'GL') as COIRecord['type'],
            carrier: r.carrier || '',
            policyNumber: r.policy_number || '',
            coverageAmount: r.coverage_amount ? `$${r.coverage_amount.toLocaleString()}` : '',
            expirationDate: r.expiration_date || '',
            additionalInsured: r.additional_insured ?? false,
          })));
        }
      });
  }, [projectId, companyName]);

  const handleCOIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setUploading(true);
    try {
      const filePath = `coi/${projectId}/${companyName}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('insurance_certificates').insert({
        project_id: projectId,
        company: companyName,
        document_url: publicUrl,
        policy_type: 'GL',
      });
      if (insertError) throw insertError;
      toast.success('COI uploaded successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <FileText size={16} style={{ color: colors.orangeText }} />
          <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Certificates of Insurance</span>
        </div>
        <Btn variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ fontSize: typography.fontSize.sm, padding: `${spacing['1']} ${spacing['2']}` }}>
          <Upload size={13} /> {uploading ? 'Uploading...' : 'Upload COI'}
        </Btn>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.png" style={{ display: 'none' }} onChange={handleCOIUpload} />
      </div>
      {records.map(r => {
        const { color: expColor, label: expLabel } = getCOIExpiryColor(r.expirationDate);
        return (
          <div key={r.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{r.type}</p>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{r.carrier} &middot; {r.policyNumber} &middot; {r.coverageAmount}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexShrink: 0 }}>
              {r.additionalInsured && <Tag label="Add'l Insured" color={colors.statusInfo} backgroundColor={colors.statusInfoSubtle} fontSize={typography.fontSize.caption} />}
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: expColor }}>{expLabel}</span>
              <div style={{ width: 8, height: 8, borderRadius: borderRadius.full, backgroundColor: expColor }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CommunicationLog: React.FC<{ contactId: string; contactName: string; projectId?: string }> = ({ contactId, projectId }) => {
  const { data: rows } = useCommunicationLogs(projectId, contactId);
  const createLog = useCreateCommunicationLog();
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState<{ channel: CommunicationChannel; subject: string; summary: string }>({ channel: 'email', subject: '', summary: '' });
  const typeIcons: Record<CommLogEntry['type'], React.ReactNode> = {
    email: <Mail size={12} />,
    call: <Phone size={12} />,
    meeting: <Users size={12} />,
    letter: <FileText size={12} />,
  };
  const comms: CommLogEntry[] = useMemo(
    () => (rows ?? []).map(r => ({
      id: r.id,
      date: r.occurred_at.slice(0, 10),
      type: (r.channel === 'phone' ? 'call' : r.channel === 'note' ? 'letter' : r.channel) as CommLogEntry['type'],
      subject: r.subject ?? '',
      summary: r.summary,
      loggedBy: r.logged_by ? 'Team member' : 'System',
    })),
    [rows],
  );

  const addEntry = async () => {
    if (!newEntry.subject.trim() || !projectId) return;
    try {
      await createLog.mutateAsync({
        projectId,
        contactId,
        channel: newEntry.channel,
        subject: newEntry.subject.trim(),
        summary: newEntry.summary,
      });
      setNewEntry({ channel: 'email', subject: '', summary: '' });
      setShowForm(false);
      toast.success('Communication logged');
    } catch {
      /* mutation toasts on error */
    }
  };
  const saving = createLog.isPending;
  const inputSt: React.CSSProperties = { width: '100%', padding: '6px 10px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <MessageSquare size={16} style={{ color: colors.statusInfo }} />
          <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Communications</span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>({comms.length})</span>
        </div>
        <Btn variant="ghost" onClick={() => setShowForm(!showForm)} style={{ fontSize: typography.fontSize.sm, padding: `${spacing['1']} ${spacing['2']}` }}>
          <Plus size={13} /> Add Entry
        </Btn>
      </div>
      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
          <select style={{ ...inputSt, appearance: 'auto' }} value={newEntry.channel} onChange={e => setNewEntry(p => ({ ...p, channel: e.target.value as CommunicationChannel }))}>
            <option value="email">Email</option><option value="phone">Phone</option><option value="meeting">Meeting</option><option value="note">Note</option>
          </select>
          <input style={inputSt} placeholder="Subject *" value={newEntry.subject} onChange={e => setNewEntry(p => ({ ...p, subject: e.target.value }))} />
          <textarea style={{ ...inputSt, resize: 'vertical', minHeight: 48 }} placeholder="Summary..." value={newEntry.summary} onChange={e => setNewEntry(p => ({ ...p, summary: e.target.value }))} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={addEntry} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
          </div>
        </div>
      )}
      {comms.map(c => (
        <div key={c.id} style={{ display: 'flex', gap: spacing['3'], padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <span style={{ color: colors.textTertiary, marginTop: 2, flexShrink: 0 }}>{typeIcons[c.type]}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{c.subject}</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{c.date}</span>
            </div>
            <p style={{ margin: `${spacing['0.5']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{c.summary}</p>
            <p style={{ margin: `${spacing['0.5']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Logged by {c.loggedBy} &middot; {c.type}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const ViewToggle: React.FC<{
  view: 'people' | 'companies';
  onChange: (v: 'people' | 'companies') => void;
}> = ({ view, onChange }) => (
  <div style={{
    display: 'flex',
    backgroundColor: colors.surfaceInset,
    borderRadius: borderRadius.full,
    padding: '3px',
  }}>
    {(['people', 'companies'] as const).map(v => (
      <button
        key={v}
        onClick={() => onChange(v)}
        style={{
          padding: `${spacing['1']} ${spacing['4']}`,
          border: 'none',
          borderRadius: borderRadius.full,
          backgroundColor: view === v ? colors.surfaceRaised : 'transparent',
          color: view === v ? colors.textPrimary : colors.textTertiary,
          fontSize: typography.fontSize.sm,
          fontWeight: view === v ? typography.fontWeight.medium : typography.fontWeight.normal,
          fontFamily: typography.fontFamily,
          cursor: 'pointer',
          transition: `all ${transitions.quick}`,
          boxShadow: view === v ? shadows.sm : 'none',
        }}
      >
        {v === 'people' ? 'People' : 'Companies'}
      </button>
    ))}
  </div>
);

const ContactDetailPanel: React.FC<{ contact: Contact }> = ({ contact }) => {
  const phoneDigits = contact.phone.replace(/\D/g, '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
        <Avatar initials={getInitials(contact.name)} size={52} />
        <div>
          <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{contact.name}</p>
          <p style={{ margin: `${spacing['0.5']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{contact.role}</p>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{contact.company}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {[
          { icon: <Building size={14} />, label: 'Company', value: contact.company, href: undefined },
          { icon: <Building size={14} />, label: 'Trade', value: contact.trade, href: undefined },
          { icon: <Phone size={14} />, label: 'Phone', value: contact.phone, href: `tel:${phoneDigits}` },
          { icon: <Mail size={14} />, label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
        ].map(({ icon, label, value, href }) => (
          <div key={label} style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-start' }}>
            <span style={{ color: colors.textTertiary, flexShrink: 0, marginTop: '2px' }}>{icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              {href ? (
                <a href={href} style={{ fontSize: typography.fontSize.body, color: colors.orangeText, textDecoration: 'none' }}>{value}</a>
              ) : (
                <p style={{ margin: 0, fontSize: typography.fontSize.body, color: colors.textPrimary }}>{value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: spacing['2'], paddingTop: spacing['4'], borderTop: `1px solid ${colors.borderSubtle}` }}>
        <a
          href={`tel:${phoneDigits}`}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.primaryOrange, color: colors.white, borderRadius: borderRadius.base, textDecoration: 'none', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily }}
        >
          <Phone size={14} /> Call
        </a>
        <a
          href={`mailto:${contact.email}`}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.surfaceInset, color: colors.textPrimary, borderRadius: borderRadius.base, textDecoration: 'none', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderSubtle}` }}
        >
          <Mail size={14} /> Email
        </a>
      </div>
    </div>
  );
};

// ── Table Header Cell ─────────────────────────────────────────────────────────

const TH: React.FC<{ children: React.ReactNode; width?: string }> = ({ children, width }) => (
  <th style={{
    width,
    padding: `${spacing['3']} ${spacing['4']}`,
    textAlign: 'left',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }}>
    {children}
  </th>
);

// ── Main Component ────────────────────────────────────────────────────────────

export const Directory: React.FC = () => {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const { data: contactsResult } = useDirectoryContacts(projectId);
  const { data: companiesData } = useCompanies(projectId);
  useRealtimeInvalidation(projectId);
  const CONTACTS: Contact[] = useMemo(() => {
    const rows: DirectoryContact[] = contactsResult?.data ?? [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? '',
      company: r.company ?? '',
      role: r.role ?? '',
      trade: r.trade ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      status: 'active' as const,
    }));
  }, [contactsResult]);

  const companies: CompanyInfo[] = useMemo(() => {
    return (companiesData ?? []).map((r) => ({
      name: r.name,
      trade: r.trade ?? '',
      insuranceStatus: (r.insurance_status ?? 'missing') as InsuranceStatus,
      insuranceExpiry: r.insurance_expiry ?? '',
    }));
  }, [companiesData]);

  const [nowMs] = useState(Date.now);
  const { data: prequalRows } = usePrequalifications(projectId);
  const { data: lastContactMap } = useLastContactMap(projectId);
  const createCommLog = useCreateCommunicationLog();

  // Map company name → prequal status via any contact from that company.
  // prequal.company_id FK is directory_contacts(id) — so we resolve status
  // by walking contacts → find one with the same company name → look up its prequal row.
  const companyPrequalStatus = useMemo(() => {
    const contactByCompany = new Map<string, string>();
    for (const c of CONTACTS) {
      if (c.company && !contactByCompany.has(c.company)) contactByCompany.set(c.company, c.id);
    }
    const statusByContact = new Map<string, PrequalStatus>();
    for (const row of prequalRows ?? []) {
      statusByContact.set(row.company_id, row.status as PrequalStatus);
    }
    const out = new Map<string, PrequalStatus>();
    for (const [companyName, contactId] of contactByCompany) {
      out.set(companyName, statusByContact.get(contactId) ?? 'not_started');
    }
    return out;
  }, [CONTACTS, prequalRows]);

  const [view, setView] = useState<'people' | 'companies'>('people');
  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [prequalFilter, setPrequalFilter] = useState<PrequalStatus | 'all'>('all');
  const [commFilter, setCommFilter] = useState<'all' | 'stale'>('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    const { error } = await supabase.from('directory_contacts').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['directory_contacts'] }); }
  };

  const handleSearchChange = (val: string) => {
    setRawSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(val), 200);
  };

  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const tradeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of CONTACTS) if (c.trade) set.add(c.trade);
    for (const c of companies) if (c.trade) set.add(c.trade);
    return Array.from(set).sort();
  }, [CONTACTS, companies]);

  const STALE_DAYS = 30;
  const staleThresholdMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  const filteredContacts = useMemo(() => {
    let result = CONTACTS;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.trade.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q)
      );
    }
    if (tradeFilter !== 'all') {
      result = result.filter(c => c.trade === tradeFilter);
    }
    if (commFilter === 'stale' && lastContactMap) {
      result = result.filter(c => {
        const last = lastContactMap.get(c.id);
        if (!last) return true; // never contacted
        return nowMs - new Date(last).getTime() > staleThresholdMs;
      });
    }
    return result;
  }, [searchQuery, CONTACTS, tradeFilter, commFilter, lastContactMap, staleThresholdMs, nowMs]);

  const filteredCompanies = useMemo(() => {
    let result = companies;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.trade.toLowerCase().includes(q)
      );
    }
    if (tradeFilter !== 'all') {
      result = result.filter(c => c.trade === tradeFilter);
    }
    if (prequalFilter !== 'all') {
      result = result.filter(c => (companyPrequalStatus.get(c.name) ?? 'not_started') === prequalFilter);
    }
    return result;
  }, [searchQuery, companies, tradeFilter, prequalFilter, companyPrequalStatus]);

  const formatLastContact = (contactId: string): string => {
    const iso = lastContactMap?.get(contactId);
    if (!iso) return '—';
    const days = Math.floor((nowMs - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  const logContactQuick = async (contactId: string) => {
    if (!projectId) return;
    try {
      await createCommLog.mutateAsync({
        projectId,
        contactId,
        channel: 'note',
        subject: 'Contact logged',
        summary: '',
      });
      toast.success('Contact logged');
    } catch {
      /* mutation toasts on error */
    }
  };

  // Metrics
  const totalContacts = CONTACTS.length;
  const activeCompanies = companies.filter(c => c.insuranceStatus === 'current').length;
  const expiringCerts = companies.filter(c => c.insuranceStatus === 'expiring').length;
  const missingInsurance = companies.filter(c => c.insuranceStatus === 'missing' || c.insuranceStatus === 'expired').length;

  const isEmpty = view === 'people' ? filteredContacts.length === 0 : filteredCompanies.length === 0;

  return (
    <PageContainer
      title="Directory"
      subtitle={`${totalContacts} contacts across ${companies.length} companies`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ViewToggle view={view} onChange={setView} />
          {view === 'companies' ? (
            <PermissionGate permission="directory.manage" fallback={<span title="Your role doesn't allow adding companies. Request access from your admin."><Btn icon={<Plus size={14} />} disabled>Add Company</Btn></span>}><Btn icon={<Plus size={14} />} onClick={() => setShowAddCompany(true)}>Add Company</Btn></PermissionGate>
          ) : (
            <PermissionGate permission="directory.manage" fallback={<span title="Your role doesn't allow adding contacts. Request access from your admin."><Btn icon={<Plus size={14} />} disabled>Add Contact</Btn></span>}><Btn icon={<Plus size={14} />} onClick={() => setShowAdd(true)} data-testid="create-contact-button">Add Contact</Btn></PermissionGate>
          )}
        </div>
      }
    >
      <PageInsightBanners page="directory" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
          <MetricBox label="Total Contacts" value={totalContacts} />
          <MetricBox label="Active Companies" value={activeCompanies} />
          <MetricBox
            label="Expiring Certs"
            value={expiringCerts}
            colorOverride={expiringCerts > 0 ? 'warning' : undefined}
          />
          <MetricBox
            label="Missing Insurance"
            value={missingInsurance}
            colorOverride={missingInsurance > 0 ? 'danger' : undefined}
          />
        </div>
        {/* TODO: Add prequal/COI/stale metrics once prequalifications and communication_logs tables exist */}

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.full,
        }}>
          <Search size={16} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          <input
            type="text"
            value={rawSearch}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search by name, company, email, phone, or trade..."
            aria-label="Search directory"
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: typography.fontSize.body,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], flexWrap: 'wrap' }}>
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Trade:</span>
          <select
            value={tradeFilter}
            onChange={e => setTradeFilter(e.target.value)}
            aria-label="Filter by trade"
            style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              border: `1px solid ${tradeFilter !== 'all' ? colors.primaryOrange : colors.borderSubtle}`,
              borderRadius: borderRadius.full,
              backgroundColor: tradeFilter !== 'all' ? colors.orangeSubtle : 'transparent',
              color: tradeFilter !== 'all' ? colors.orangeText : colors.textSecondary,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            <option value="all">All trades</option>
            {tradeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {view === 'companies' && (
            <>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Prequal:</span>
              {(['all', 'not_started', 'in_review', 'approved', 'rejected', 'expired'] as const).map(s => {
                const labels: Record<string, string> = { all: 'All', not_started: 'Not Started', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected', expired: 'Expired' };
                return (
                  <button key={s} onClick={() => setPrequalFilter(s)} style={{
                    padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${prequalFilter === s ? colors.primaryOrange : colors.borderSubtle}`,
                    borderRadius: borderRadius.full, backgroundColor: prequalFilter === s ? colors.orangeSubtle : 'transparent',
                    color: prequalFilter === s ? colors.orangeText : colors.textSecondary, fontSize: typography.fontSize.sm,
                    cursor: 'pointer', fontFamily: typography.fontFamily, transition: `all ${transitions.quick}`,
                  }}>{labels[s]}</button>
                );
              })}
            </>
          )}
          {view === 'people' && (
            <>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Filter:</span>
              <button onClick={() => setCommFilter('all')} style={{
                padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${commFilter === 'all' ? colors.primaryOrange : colors.borderSubtle}`,
                borderRadius: borderRadius.full, backgroundColor: commFilter === 'all' ? colors.orangeSubtle : 'transparent',
                color: commFilter === 'all' ? colors.orangeText : colors.textSecondary, fontSize: typography.fontSize.sm,
                cursor: 'pointer', fontFamily: typography.fontFamily,
              }}>All Contacts</button>
              <button onClick={() => setCommFilter('stale')} style={{
                padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${commFilter === 'stale' ? colors.primaryOrange : colors.borderSubtle}`,
                borderRadius: borderRadius.full, backgroundColor: commFilter === 'stale' ? colors.orangeSubtle : 'transparent',
                color: commFilter === 'stale' ? colors.orangeText : colors.textSecondary, fontSize: typography.fontSize.sm,
                cursor: 'pointer', fontFamily: typography.fontFamily,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}><Clock size={12} /> Not Contacted 30+ Days</span>
              </button>
            </>
          )}
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: spacing['4'],
            padding: `${spacing['16']} ${spacing['8']}`,
            textAlign: 'center',
          }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: borderRadius.xl,
              backgroundColor: colors.surfaceInset,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.textTertiary,
            }}>
              <Users size={26} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                No contacts
              </p>
              <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.body, color: colors.textSecondary, maxWidth: 360 }}>
                Add every stakeholder so your team always knows who to call.
              </p>
            </div>
            <PermissionGate permission="directory.manage" fallback={<span title="Your role doesn't allow adding contacts. Request access from your admin."><Btn disabled>Add First Contact</Btn></span>}><Btn onClick={() => setShowAdd(true)}>Add First Contact</Btn></PermissionGate>
          </div>
        )}

        {/* People View */}
        {view === 'people' && !isEmpty && (
          <Card padding="0">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH width="220px">Name</TH>
                    <TH width="160px">Company</TH>
                    <TH width="160px">Role</TH>
                    <TH width="130px">Trade</TH>
                    <TH width="140px">Phone</TH>
                    <TH>Email</TH>
                    <TH width="100px">Last Contact</TH>
                    <TH width="90px">Status</TH>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(contact => {
                    const isHovered = hoveredRow === contact.id;
                    const phoneDigits = contact.phone.replace(/\D/g, '');
                    return (
                      <tr
                        key={contact.id}
                        onClick={() => setSelectedContact(contact)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedContact(contact); } }}
                        onMouseEnter={() => setHoveredRow(contact.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for ${contact.name}`}
                        style={{
                          backgroundColor: isHovered ? colors.surfaceHover : 'transparent',
                          cursor: 'pointer',
                          transition: `background-color ${transitions.quick}`,
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                        }}
                      >
                        <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                            <Avatar initials={getInitials(contact.name)} size={28} />
                            <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                              {contact.name}
                            </span>
                          </span>
                        </td>
                        <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                          <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>{contact.company}</span>
                        </td>
                        <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                          <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>{contact.role}</span>
                        </td>
                        <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{contact.trade}</span>
                        </td>
                        <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                          <a
                            href={`tel:${phoneDigits}`}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, textDecoration: 'none' }}
                          >
                            {contact.phone}
                          </a>
                        </td>
                        <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                          <a
                            href={`mailto:${contact.email}`}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, textDecoration: 'none' }}
                          >
                            {contact.email}
                          </a>
                        </td>
                        <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{formatLastContact(contact.id)}</span>
                        </td>
                        <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                            <Tag
                              label={contact.status === 'active' ? 'Active' : 'Inactive'}
                              color={contact.status === 'active' ? colors.statusActive : colors.textTertiary}
                              backgroundColor={contact.status === 'active' ? colors.statusActiveSubtle : colors.statusNeutralSubtle}
                              fontSize={typography.fontSize.caption}
                            />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); logContactQuick(contact.id); }}
                              title="Log a contact interaction"
                              aria-label={`Log contact for ${contact.name}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                                padding: `${spacing['1']} ${spacing['2']}`,
                                border: `1px solid ${colors.borderSubtle}`,
                                borderRadius: borderRadius.base,
                                backgroundColor: 'transparent',
                                color: colors.textSecondary,
                                fontSize: typography.fontSize.caption,
                                cursor: 'pointer',
                                fontFamily: typography.fontFamily,
                              }}
                            >
                              <MessageSquare size={11} /> Log
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Companies View */}
        {view === 'companies' && !isEmpty && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing['4'] }}>
            {filteredCompanies.map(company => {
              const { color: dotColor, label: dotLabel } = getInsuranceDot(company.insuranceStatus);
              const memberCount = CONTACTS.filter(c => c.company === company.name).length;
              const isHovered = hoveredCard === company.name;
              return (
                <div
                  key={company.name}
                  onMouseEnter={() => setHoveredCard(company.name)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: borderRadius.lg,
                    padding: spacing['5'],
                    boxShadow: isHovered ? shadows.cardHover : shadows.card,
                    transition: `box-shadow ${transitions.quick}`,
                    cursor: 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing['4'],
                  }}
                >
                  {/* Company header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing['3'] }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: borderRadius.md,
                        backgroundColor: colors.orangeSubtle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Building size={18} style={{ color: colors.orangeText }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{company.name}</p>
                        <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{company.trade}</p>
                      </div>
                    </div>
                    {/* Insurance status dot */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], flexShrink: 0 }} title={dotLabel}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: borderRadius.full,
                        backgroundColor: dotColor,
                        flexShrink: 0,
                      }} />
                    </div>
                  </div>

                  {(() => {
                    const status = companyPrequalStatus.get(company.name) ?? 'not_started';
                    const { fg, bg, label } = getPrequalColor(status);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <ShieldCheck size={13} style={{ color: fg }} />
                        <Tag label={`Prequal: ${label}`} color={fg} backgroundColor={bg} fontSize={typography.fontSize.caption} />
                      </div>
                    );
                  })()}

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: spacing['4'] }}>
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contacts</p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{memberCount}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Insurance</p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: dotColor }}>
                        {company.insuranceStatus === 'current' && 'Current'}
                        {company.insuranceStatus === 'expiring' && `Expiring ${company.insuranceExpiry}`}
                        {company.insuranceStatus === 'expired' && `Expired ${company.insuranceExpiry}`}
                        {company.insuranceStatus === 'missing' && 'Not on file'}
                      </p>
                    </div>
                  </div>

                  {/* Contact avatars */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    {CONTACTS.filter(c => c.company === company.name).slice(0, 4).map((c, i) => (
                      <div
                        key={c.id}
                        title={c.name}
                        style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 4 - i, position: 'relative' }}
                      >
                        <Avatar initials={getInitials(c.name)} size={26} />
                      </div>
                    ))}
                    {memberCount > 4 && (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['1'] }}>
                        +{memberCount - 4} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact Detail Drawer */}
      <Drawer
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        title={selectedContact?.name ?? ''}
      >
        {selectedContact && <ContactDetailPanel contact={selectedContact} />}
        {selectedContact && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'], padding: `${spacing['4']} 0` }}>
            <PrequalDetailPanel companyContactId={selectedContact.id} projectId={projectId} onStatusChange={() => qc.invalidateQueries({ queryKey: ['companies'] })} />
            <COISection companyName={selectedContact.company} projectId={projectId} />
            <CommunicationLog contactId={selectedContact.id} contactName={selectedContact.name} projectId={projectId} />
          </div>
        )}
        {selectedContact && (
          <PermissionGate permission="directory.manage">
            <div style={{ display: 'flex', gap: 8, padding: spacing['4'] }}>
              <Btn variant="secondary" onClick={() => { setEditing(selectedContact); setSelectedContact(null); }}>Edit</Btn>
              <Btn variant="ghost" onClick={() => { handleDelete(selectedContact.id); setSelectedContact(null); }}>Delete</Btn>
            </div>
          </PermissionGate>
        )}
      </Drawer>
      {showAdd && projectId && <ContactFormModal projectId={projectId} onClose={() => setShowAdd(false)} />}
      {editing && projectId && <ContactFormModal projectId={projectId} onClose={() => setEditing(null)} initial={editing} />}
      {showAddCompany && projectId && <CompanyFormModal projectId={projectId} onClose={() => setShowAddCompany(false)} />}
    </PageContainer>
  );
};
