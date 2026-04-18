import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, Phone, Mail, Building, Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageContainer, Card, MetricBox, Avatar, Tag, Btn } from '../components/Primitives';
import { Drawer } from '../components/Drawer';
import { PermissionGate } from '../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useDirectoryStore } from '../stores/directoryStore';
import type { Company, Contact } from '../stores/directoryStore';
import type { InsuranceStatus } from '../services/directoryService';
import { toast } from 'sonner';

// ── Animation variants ────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// ── Contact form modal ────────────────────────────────────────────────────────

interface ContactFormModalProps {
  projectId: string;
  onClose: () => void;
  initial?: Partial<Contact> & { id?: string };
}

const ContactFormModal: React.FC<ContactFormModalProps> = ({ projectId, onClose, initial }) => {
  const store = useDirectoryStore();
  const [form, setForm] = useState({
    contact_name: initial?.contact_name ?? '',
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
    if (!form.contact_name.trim()) { setErr('Name required'); return; }
    setSaving(true); setErr(null);
    try {
      if (editing) {
        const { error } = await store.updateContact(initial!.id!, form);
        if (error) throw new Error(error);
        toast.success('Contact updated');
      } else {
        const { error } = await store.createContact({ ...form, project_id: projectId });
        if (error) throw new Error(error);
        toast.success('Contact added');
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing['3']} ${spacing['3']}`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.base,
    marginBottom: spacing['3'],
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily,
    boxSizing: 'border-box',
    minHeight: '48px',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.overlayScrim,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          padding: spacing['6'],
          width: '100%',
          maxWidth: 480,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: spacing['4'], fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
          {editing ? 'Edit Contact' : 'Add Contact'}
        </h2>
        {(
          [
            ['contact_name', 'Full Name *'],
            ['company', 'Company'],
            ['role', 'Role'],
            ['trade', 'Trade'],
            ['phone', 'Phone'],
            ['email', 'Email'],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, display: 'block', marginBottom: spacing['1'] }}>
              {label}
            </label>
            <input
              style={inputStyle}
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
            />
          </div>
        ))}
        {err && <p style={{ color: colors.statusCritical, margin: `0 0 ${spacing['3']}`, fontSize: typography.fontSize.sm }}>{err}</p>}
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Contact'}
          </Btn>
        </div>
      </motion.div>
    </div>
  );
};

// ── Company form modal ────────────────────────────────────────────────────────

interface CompanyFormModalProps {
  projectId: string;
  onClose: () => void;
}

const CompanyFormModal: React.FC<CompanyFormModalProps> = ({ projectId, onClose }) => {
  const store = useDirectoryStore();
  const [form, setForm] = useState({
    name: '',
    trade: '',
    insurance_status: 'missing' as InsuranceStatus,
    insurance_expiry: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!form.name.trim()) { setErr('Company name required'); return; }
    setSaving(true); setErr(null);
    try {
      const { error } = await store.createCompany({
        project_id: projectId,
        name: form.name.trim(),
        trade: form.trade.trim() || undefined,
        insurance_status: form.insurance_status,
        insurance_expiry: form.insurance_expiry || undefined,
      });
      if (error) throw new Error(error);
      toast.success('Company added');
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add company');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing['3']} ${spacing['3']}`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.base,
    marginBottom: spacing['3'],
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily,
    boxSizing: 'border-box',
    minHeight: '48px',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.overlayScrim,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          padding: spacing['6'],
          width: '100%',
          maxWidth: 480,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: spacing['4'], fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
          Add Company
        </h2>
        <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, display: 'block', marginBottom: spacing['1'] }}>Company Name *</label>
        <input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, display: 'block', marginBottom: spacing['1'] }}>Trade</label>
        <input style={inputStyle} value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))} />
        <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, display: 'block', marginBottom: spacing['1'] }}>Insurance Status</label>
        <select style={{ ...inputStyle, appearance: 'auto' }} value={form.insurance_status} onChange={e => setForm(p => ({ ...p, insurance_status: e.target.value as InsuranceStatus }))}>
          <option value="current">Current</option>
          <option value="expiring">Expiring Soon</option>
          <option value="expired">Expired</option>
          <option value="missing">Not on File</option>
        </select>
        <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, display: 'block', marginBottom: spacing['1'] }}>Insurance Expiry</label>
        <input type="date" style={inputStyle} value={form.insurance_expiry} onChange={e => setForm(p => ({ ...p, insurance_expiry: e.target.value }))} />
        {err && <p style={{ color: colors.statusCritical, margin: `0 0 ${spacing['3']}`, fontSize: typography.fontSize.sm }}>{err}</p>}
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Company'}</Btn>
        </div>
      </motion.div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getInsuranceDot(status: InsuranceStatus): { color: string; label: string } {
  switch (status) {
    case 'current':  return { color: colors.statusActive,   label: 'Insurance current' };
    case 'expiring': return { color: colors.statusPending,  label: 'Insurance expiring soon' };
    case 'expired':  return { color: colors.statusCritical, label: 'Insurance expired' };
    case 'missing':  return { color: colors.statusCritical, label: 'No insurance on file' };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
          padding: `${spacing['2']} ${spacing['4']}`,
          minHeight: '40px',
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
  const phoneDigits = (contact.phone ?? '').replace(/\D/g, '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
        <Avatar initials={getInitials(contact.contact_name)} size={52} />
        <div>
          <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{contact.contact_name}</p>
          <p style={{ margin: `${spacing['0.5']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{contact.role}</p>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{contact.company}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {[
          { icon: <Building size={14} />, label: 'Company', value: contact.company, href: undefined },
          { icon: <Building size={14} />, label: 'Trade', value: contact.trade, href: undefined },
          { icon: <Phone size={14} />, label: 'Phone', value: contact.phone, href: contact.phone ? `tel:${phoneDigits}` : undefined },
          { icon: <Mail size={14} />, label: 'Email', value: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined },
        ].map(({ icon, label, value, href }) => (
          <div key={label} style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-start' }}>
            <span style={{ color: colors.textTertiary, flexShrink: 0, marginTop: '2px' }}>{icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              {href ? (
                <a href={href} style={{ fontSize: typography.fontSize.body, color: colors.orangeText, textDecoration: 'none' }}>{value}</a>
              ) : (
                <p style={{ margin: 0, fontSize: typography.fontSize.body, color: colors.textPrimary }}>{value ?? '—'}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {(contact.phone || contact.email) && (
        <div style={{ display: 'flex', gap: spacing['2'], paddingTop: spacing['4'], borderTop: `1px solid ${colors.borderSubtle}` }}>
          {contact.phone && (
            <a
              href={`tel:${phoneDigits}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: spacing['3'], minHeight: '48px', backgroundColor: colors.primaryOrange, color: colors.white, borderRadius: borderRadius.base, textDecoration: 'none', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily }}
            >
              <Phone size={14} /> Call
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: spacing['3'], minHeight: '48px', backgroundColor: colors.surfaceInset, color: colors.textPrimary, borderRadius: borderRadius.base, textDecoration: 'none', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderSubtle}` }}
            >
              <Mail size={14} /> Email
            </a>
          )}
        </div>
      )}
    </div>
  );
};

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

// ── Skeleton loader ───────────────────────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <tr>
    {[220, 160, 160, 130, 140, 200, 90].map((w, i) => (
      <td key={i} style={{ padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div style={{
          height: 14,
          width: `${w * 0.6}px`,
          borderRadius: borderRadius.base,
          backgroundColor: colors.surfaceInset,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </td>
    ))}
  </tr>
);

const SkeletonCard: React.FC = () => (
  <div style={{
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.lg,
    padding: spacing['5'],
    boxShadow: shadows.card,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['4'],
  }}>
    {[80, 60, 40].map((w, i) => (
      <div key={i} style={{
        height: 14,
        width: `${w}%`,
        borderRadius: borderRadius.base,
        backgroundColor: colors.surfaceInset,
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
    ))}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const Directory: React.FC = () => {
  const projectId = useProjectId();
  const reducedMotion = useReducedMotion();
  const store = useDirectoryStore();
  const { companies, contacts, loading, error } = store;

  const [view, setView] = useState<'people' | 'companies'>('people');
  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    store.loadCompanies(projectId);
    store.loadContacts(projectId);
  }, [projectId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    const { error: err } = await store.deleteContact(id);
    if (err) toast.error(err);
    else toast.success('Contact deleted');
  };

  const handleSearchChange = (val: string) => {
    setRawSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(val), 200);
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.contact_name.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q) ||
      (c.trade ?? '').toLowerCase().includes(q) ||
      (c.role ?? '').toLowerCase().includes(q)
    );
  }, [searchQuery, contacts]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.trade ?? '').toLowerCase().includes(q)
    );
  }, [searchQuery, companies]);

  const totalContacts  = contacts.length;
  const activeCompanies = companies.filter(c => c.insurance_status === 'current').length;
  const expiringCerts  = companies.filter(c => c.insurance_status === 'expiring').length;
  const missingInsurance = companies.filter(c =>
    c.insurance_status === 'missing' || c.insurance_status === 'expired'
  ).length;

  const isEmpty = view === 'people'
    ? filteredContacts.length === 0
    : filteredCompanies.length === 0;

  const motionProps = (variants: typeof itemVariants) =>
    reducedMotion ? {} : { variants, initial: 'hidden', animate: 'visible', exit: 'exit' };

  return (
    <PageContainer
      title="Directory"
      subtitle={`${totalContacts} contacts across ${companies.length} companies`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ViewToggle view={view} onChange={setView} />
          {view === 'companies' ? (
            <PermissionGate permission="directory.manage" fallback={
              <span title="Your role doesn't allow adding companies.">
                <Btn icon={<Plus size={14} />} disabled>Add Company</Btn>
              </span>
            }>
              <Btn icon={<Plus size={14} />} onClick={() => setShowAddCompany(true)}>Add Company</Btn>
            </PermissionGate>
          ) : (
            <PermissionGate permission="directory.manage" fallback={
              <span title="Your role doesn't allow adding contacts.">
                <Btn icon={<Plus size={14} />} disabled>Add Contact</Btn>
              </span>
            }>
              <Btn icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Contact</Btn>
            </PermissionGate>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>

        {/* Metrics */}
        <motion.div
          {...(reducedMotion ? {} : { variants: containerVariants, initial: 'hidden', animate: 'visible' })}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}
        >
          {[
            { label: 'Total Contacts',    value: totalContacts },
            { label: 'Active Companies',  value: activeCompanies },
            { label: 'Expiring Certs',    value: expiringCerts,    colorOverride: expiringCerts > 0 ? 'warning' as const : undefined },
            { label: 'Missing Insurance', value: missingInsurance, colorOverride: missingInsurance > 0 ? 'danger' as const : undefined },
          ].map(({ label, value, colorOverride }) => (
            <motion.div key={label} {...(reducedMotion ? {} : { variants: itemVariants })}>
              <MetricBox label={label} value={value} colorOverride={colorOverride} />
            </motion.div>
          ))}
        </motion.div>

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          minHeight: '48px',
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.full,
        }}>
          <Search size={16} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          <input
            type="text"
            value={rawSearch}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search by name, company, email, phone, or trade…"
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

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              {...motionProps(fadeVariants)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: spacing['4'],
                backgroundColor: colors.statusCriticalSubtle,
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.statusCritical}`,
              }}
            >
              <AlertTriangle size={18} style={{ color: colors.statusCritical, flexShrink: 0 }} />
              <p style={{ margin: 0, flex: 1, fontSize: typography.fontSize.body, color: colors.statusCritical }}>{error}</p>
              <button
                onClick={() => {
                  if (!projectId) return;
                  store.clearError();
                  store.loadCompanies(projectId);
                  store.loadContacts(projectId);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  minHeight: '36px',
                  border: `1px solid ${colors.statusCritical}`,
                  borderRadius: borderRadius.base,
                  backgroundColor: 'transparent',
                  color: colors.statusCritical,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} /> Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              {...motionProps(fadeVariants)}
            >
              {view === 'people' ? (
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
                          <TH width="90px">Status</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing['4'] }}>
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              )}
            </motion.div>
          )}

          {/* Empty state */}
          {!loading && isEmpty && (
            <motion.div
              key="empty"
              {...motionProps(fadeVariants)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing['4'],
                padding: `${spacing['16']} ${spacing['8']}`,
                textAlign: 'center',
              }}
            >
              <div style={{
                width: 64,
                height: 64,
                borderRadius: borderRadius.xl,
                backgroundColor: colors.surfaceInset,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textTertiary,
              }}>
                <Users size={28} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  {searchQuery ? 'No results found' : view === 'people' ? 'No contacts yet' : 'No companies yet'}
                </p>
                <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.body, color: colors.textSecondary, maxWidth: 360 }}>
                  {searchQuery
                    ? 'Try a different search term.'
                    : view === 'people'
                      ? 'Add every stakeholder so your team always knows who to call.'
                      : 'Add subcontractors and vendors to track insurance and contacts.'}
                </p>
              </div>
              {!searchQuery && (
                <PermissionGate permission="directory.manage" fallback={
                  <span title="Your role doesn't allow adding contacts.">
                    <Btn disabled>{view === 'people' ? 'Add First Contact' : 'Add First Company'}</Btn>
                  </span>
                }>
                  <Btn onClick={() => view === 'people' ? setShowAdd(true) : setShowAddCompany(true)}>
                    {view === 'people' ? 'Add First Contact' : 'Add First Company'}
                  </Btn>
                </PermissionGate>
              )}
            </motion.div>
          )}

          {/* People table */}
          {!loading && view === 'people' && !isEmpty && (
            <motion.div key="people" {...motionProps(fadeVariants)}>
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
                        <TH width="90px">Status</TH>
                      </tr>
                    </thead>
                    <motion.tbody
                      variants={reducedMotion ? undefined : containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredContacts.map(contact => {
                        const isHovered = hoveredRow === contact.id;
                        const phoneDigits = (contact.phone ?? '').replace(/\D/g, '');
                        return (
                          <motion.tr
                            key={contact.id}
                            variants={reducedMotion ? undefined : itemVariants}
                            onClick={() => setSelectedContact(contact)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedContact(contact); } }}
                            onMouseEnter={() => setHoveredRow(contact.id)}
                            onMouseLeave={() => setHoveredRow(null)}
                            tabIndex={0}
                            role="button"
                            aria-label={`View details for ${contact.contact_name}`}
                            style={{
                              backgroundColor: isHovered ? colors.surfaceHover : 'transparent',
                              cursor: 'pointer',
                              transition: `background-color ${transitions.quick}`,
                              borderBottom: `1px solid ${colors.borderSubtle}`,
                              minHeight: '48px',
                            }}
                          >
                            <td style={{ padding: `${spacing['3']} ${spacing['4']}`, minHeight: '48px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                                <Avatar initials={getInitials(contact.contact_name)} size={28} />
                                <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                                  {contact.contact_name}
                                </span>
                              </span>
                            </td>
                            <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                              <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>{contact.company ?? '—'}</span>
                            </td>
                            <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                              <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>{contact.role ?? '—'}</span>
                            </td>
                            <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{contact.trade ?? '—'}</span>
                            </td>
                            <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                              {contact.phone ? (
                                <a href={`tel:${phoneDigits}`} onClick={e => e.stopPropagation()} style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, textDecoration: 'none' }}>
                                  {contact.phone}
                                </a>
                              ) : <span style={{ color: colors.textTertiary }}>—</span>}
                            </td>
                            <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                              {contact.email ? (
                                <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, textDecoration: 'none' }}>
                                  {contact.email}
                                </a>
                              ) : <span style={{ color: colors.textTertiary }}>—</span>}
                            </td>
                            <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                              <Tag
                                label={contact.status === 'inactive' ? 'Inactive' : 'Active'}
                                color={contact.status === 'inactive' ? colors.textTertiary : colors.statusActive}
                                backgroundColor={contact.status === 'inactive' ? colors.statusNeutralSubtle : colors.statusActiveSubtle}
                                fontSize={typography.fontSize.caption}
                              />
                            </td>
                          </motion.tr>
                        );
                      })}
                    </motion.tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Companies grid */}
          {!loading && view === 'companies' && !isEmpty && (
            <motion.div
              key="companies"
              variants={reducedMotion ? undefined : containerVariants}
              initial="hidden"
              animate="visible"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing['4'] }}
            >
              {filteredCompanies.map((company: Company) => {
                const insStatus = (company.insurance_status ?? 'missing') as InsuranceStatus;
                const { color: dotColor, label: dotLabel } = getInsuranceDot(insStatus);
                const memberCount = contacts.filter(c => c.company === company.name).length;
                const isHovered = hoveredCard === company.id;
                return (
                  <motion.div
                    key={company.id}
                    variants={reducedMotion ? undefined : itemVariants}
                    onMouseEnter={() => setHoveredCard(company.id)}
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing['3'] }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                        <div style={{
                          width: 40, height: 40,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.orangeSubtle,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Building size={18} style={{ color: colors.orangeText }} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{company.name}</p>
                          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{company.trade ?? ''}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], flexShrink: 0 }} title={dotLabel}>
                        <div style={{ width: 8, height: 8, borderRadius: borderRadius.full, backgroundColor: dotColor }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: spacing['4'] }}>
                      <div>
                        <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contacts</p>
                        <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{memberCount}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Insurance</p>
                        <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: dotColor }}>
                          {insStatus === 'current' && 'Current'}
                          {insStatus === 'expiring' && `Expiring ${company.insurance_expiry ?? ''}`}
                          {insStatus === 'expired' && `Expired ${company.insurance_expiry ?? ''}`}
                          {insStatus === 'missing' && 'Not on file'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                      {contacts.filter(c => c.company === company.name).slice(0, 4).map((c, i) => (
                        <div key={c.id} title={c.contact_name} style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 4 - i, position: 'relative' }}>
                          <Avatar initials={getInitials(c.contact_name)} size={26} />
                        </div>
                      ))}
                      {memberCount > 4 && (
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['1'] }}>
                          +{memberCount - 4} more
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Contact detail drawer */}
      <Drawer
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        title={selectedContact?.contact_name ?? ''}
      >
        {selectedContact && <ContactDetailPanel contact={selectedContact} />}
        {selectedContact && (
          <PermissionGate permission="directory.manage">
            <div style={{ display: 'flex', gap: spacing['2'], padding: spacing['4'] }}>
              <Btn
                variant="secondary"
                onClick={() => { setEditing(selectedContact); setSelectedContact(null); }}
              >
                Edit
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => { handleDelete(selectedContact.id); setSelectedContact(null); }}
              >
                Delete
              </Btn>
            </div>
          </PermissionGate>
        )}
      </Drawer>

      <AnimatePresence>
        {showAdd && projectId && (
          <ContactFormModal projectId={projectId} onClose={() => setShowAdd(false)} />
        )}
        {editing && projectId && (
          <ContactFormModal
            projectId={projectId}
            onClose={() => setEditing(null)}
            initial={editing}
          />
        )}
        {showAddCompany && projectId && (
          <CompanyFormModal projectId={projectId} onClose={() => setShowAddCompany(false)} />
        )}
      </AnimatePresence>
    </PageContainer>
  );
};
