import React, { useState, useMemo, useRef } from 'react';
import { Search, Users, Phone, Mail, Building } from 'lucide-react';
import { PageContainer, Card, MetricBox, Avatar, Tag, Btn } from '../components/Primitives';
import { Drawer } from '../components/Drawer';
import { PermissionGate } from '../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';

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

// ── Mock Data ─────────────────────────────────────────────────────────────────

const CONTACTS: Contact[] = [
  { id: '1', name: 'Marcus Rodriguez', company: 'Turner GC', role: 'Project Manager', trade: 'General Contractor', phone: '(415) 555-0101', email: 'mrodriguez@turnergc.com', status: 'active' },
  { id: '2', name: 'Sandra Kim', company: 'Turner GC', role: 'Superintendent', trade: 'General Contractor', phone: '(415) 555-0102', email: 'skim@turnergc.com', status: 'active' },
  { id: '3', name: 'James Okafor', company: 'Turner GC', role: 'Safety Officer', trade: 'General Contractor', phone: '(415) 555-0103', email: 'jokafor@turnergc.com', status: 'active' },
  { id: '4', name: 'Priya Nair', company: 'MEP Solutions', role: 'MEP Engineer', trade: 'Mechanical', phone: '(510) 555-0201', email: 'pnair@mepsolutions.com', status: 'active' },
  { id: '5', name: 'Derek Walsh', company: 'MEP Solutions', role: 'Plumbing Foreman', trade: 'Plumbing', phone: '(510) 555-0202', email: 'dwalsh@mepsolutions.com', status: 'active' },
  { id: '6', name: 'Ana Flores', company: 'MEP Solutions', role: 'HVAC Technician', trade: 'Mechanical', phone: '(510) 555-0203', email: 'aflores@mepsolutions.com', status: 'inactive' },
  { id: '7', name: 'Tom Bridger', company: 'Steel Fabricators Inc', role: 'Structural Foreman', trade: 'Structural Steel', phone: '(650) 555-0301', email: 'tbridger@steelfab.com', status: 'active' },
  { id: '8', name: 'Kenji Tanaka', company: 'Steel Fabricators Inc', role: 'Iron Worker', trade: 'Structural Steel', phone: '(650) 555-0302', email: 'ktanaka@steelfab.com', status: 'active' },
  { id: '9', name: 'Rosa Martinez', company: 'Pacific Concrete', role: 'Concrete Superintendent', trade: 'Concrete', phone: '(925) 555-0401', email: 'rmartinez@pacificconcrete.com', status: 'active' },
  { id: '10', name: 'Bill Nguyen', company: 'Pacific Concrete', role: 'Quality Control', trade: 'Concrete', phone: '(925) 555-0402', email: 'bnguyen@pacificconcrete.com', status: 'active' },
  { id: '11', name: 'Cheryl Simmons', company: 'Valley Electric', role: 'Electrical Foreman', trade: 'Electrical', phone: '(707) 555-0501', email: 'csimmons@valleyelectric.com', status: 'active' },
  { id: '12', name: 'Ahmad Hassan', company: 'Valley Electric', role: 'Journeyman Electrician', trade: 'Electrical', phone: '(707) 555-0502', email: 'ahassan@valleyelectric.com', status: 'inactive' },
];

const COMPANIES: CompanyInfo[] = [
  { name: 'Turner GC', trade: 'General Contractor', insuranceStatus: 'current', insuranceExpiry: 'Mar 15, 2027' },
  { name: 'MEP Solutions', trade: 'Mechanical / Electrical / Plumbing', insuranceStatus: 'expiring', insuranceExpiry: 'May 1, 2026' },
  { name: 'Steel Fabricators Inc', trade: 'Structural Steel', insuranceStatus: 'current', insuranceExpiry: 'Jan 10, 2027' },
  { name: 'Pacific Concrete', trade: 'Concrete', insuranceStatus: 'missing', insuranceExpiry: '' },
  { name: 'Valley Electric', trade: 'Electrical', insuranceStatus: 'expired', insuranceExpiry: 'Dec 31, 2025' },
];

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
  const [view, setView] = useState<'people' | 'companies'>('people');
  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [searchQuery]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return COMPANIES;
    const q = searchQuery.toLowerCase();
    return COMPANIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.trade.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Metrics
  const totalContacts = CONTACTS.length;
  const activeCompanies = COMPANIES.filter(c => c.insuranceStatus === 'current').length;
  const expiringCerts = COMPANIES.filter(c => c.insuranceStatus === 'expiring').length;
  const missingInsurance = COMPANIES.filter(c => c.insuranceStatus === 'missing' || c.insuranceStatus === 'expired').length;

  const isEmpty = view === 'people' ? filteredContacts.length === 0 : filteredCompanies.length === 0;

  return (
    <PageContainer
      title="Directory"
      subtitle={`${totalContacts} contacts across ${COMPANIES.length} companies`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ViewToggle view={view} onChange={setView} />
          <PermissionGate permission="directory.manage"><Btn onClick={() => {}}>Add Contact</Btn></PermissionGate>
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
                Build your project directory.
              </p>
              <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.body, color: colors.textSecondary, maxWidth: 360 }}>
                Add every stakeholder so your team always knows who to call.
              </p>
            </div>
            <PermissionGate permission="directory.manage"><Btn onClick={() => {}}>Add First Contact</Btn></PermissionGate>
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
                        onMouseEnter={() => setHoveredRow(contact.id)}
                        onMouseLeave={() => setHoveredRow(null)}
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
      </Drawer>
    </PageContainer>
  );
};
