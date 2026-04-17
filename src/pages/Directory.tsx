import React, { useState, useMemo, useRef } from 'react';
import { Search, Users, Phone, Mail, Building, Plus } from 'lucide-react';
import { PageContainer, Card, MetricBox, Avatar, Tag, Btn } from '../components/Primitives';
import { Drawer } from '../components/Drawer';
import { PermissionGate } from '../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useDirectoryContacts, useCompanies } from '../hooks/queries/directory-contacts';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ContactFormModalProps {
  projectId: string;
  onClose: () => void;
  initial?: Partial<Contact> & { id?: string };
}

const ContactFormModal: React.FC<ContactFormModalProps> = ({ projectId, onClose, initial }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    contact_name: initial?.name ?? '',
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
        {(['contact_name', 'company', 'role', 'trade', 'phone', 'email'] as const).map(k => (
          <div key={k}>
            <label style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{k.replace('_', ' ')}{k === 'contact_name' ? ' *' : ''}</label>
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
  const CONTACTS: Contact[] = useMemo(() => {
    const rows = (contactsResult?.data ?? []) as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.contact_name ?? r.name ?? ''),
      company: String(r.company ?? ''),
      role: String(r.role ?? ''),
      trade: String(r.trade ?? ''),
      phone: String(r.phone ?? ''),
      email: String(r.email ?? ''),
      status: (r.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
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

  const [view, setView] = useState<'people' | 'companies'>('people');
  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
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

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return CONTACTS;
    const q = searchQuery.toLowerCase();
    return CONTACTS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.trade.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q)
    );
  }, [searchQuery, CONTACTS]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.trade.toLowerCase().includes(q)
    );
  }, [searchQuery, companies]);

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
          <PermissionGate permission="directory.manage" fallback={<span title="Your role doesn't allow adding contacts. Request access from your admin."><Btn icon={<Plus size={14} />} disabled>Add Contact</Btn></span>}><Btn icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Contact</Btn></PermissionGate>
        </div>
      }
    >
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
                          <Tag
                            label={contact.status === 'active' ? 'Active' : 'Inactive'}
                            color={contact.status === 'active' ? colors.statusActive : colors.textTertiary}
                            backgroundColor={contact.status === 'active' ? colors.statusActiveSubtle : colors.statusNeutralSubtle}
                            fontSize={typography.fontSize.caption}
                          />
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
    </PageContainer>
  );
};
